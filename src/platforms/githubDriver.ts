import * as api from '@/api/github';
import { scopesFor, signIn as githubSignIn } from '@/auth/github';
import { dropNew, dropOld, getNew, getOld, setNew, setOld } from '@/auth/githubTokens';
import { DriverError, type Driver, type Outcome, type Pacer } from '@/platforms/driver';
import type { NewItem, StoredItem } from '@/store/progressStore';
import { githubWords } from '@/strings';

const GENERIC = "GitHub didn't allow this one.";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// The scope of each kind, the other way round: what a saved token can do.
function kindsOf(scopes: string[]): string[] {
  const out = new Set<string>();
  if (scopes.includes('public_repo')) out.add('repo');
  if (scopes.includes('user') || scopes.includes('user:follow')) out.add('person');
  if (scopes.includes('user')) out.add('list');
  if (scopes.includes('gist')) out.add('gist');
  return [...out];
}

// Principle III.8: the saved `data` is JSON that was written by this app, but is checked on read.
function parse(data: string | null): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(data ?? '');
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

// How many answers in a row were a 403 that is not a rate limit (research R9). Reset when a move ends.
let strikes = 0;
const track = (r: api.AddResult): Outcome => {
  strikes = r.strikes;
  return r.outcome;
};

async function addList(item: StoredItem, items: StoredItem[], token: string, pacer?: Pacer): Promise<Outcome> {
  const d = parse(item.data);
  const repoIds = Array.isArray(d?.repoItemIds) ? d.repoItemIds.filter((x): x is string => typeof x === 'string') : null;
  if (!d || !repoIds) return { kind: 'couldnt_move', reason: GENERIC };

  let existing: api.UserList[];
  try {
    existing = await api.readMyLists(token);
  } catch (e) {
    return e instanceof DriverError && e.kind === 'auth' ? { kind: 'auth' } : { kind: 'retry' };
  }
  const made = await api.findOrCreateList(
    token,
    { name: item.title, description: str(d.description) ?? '', isPrivate: d.isPrivate === true },
    existing,
    strikes,
  );
  strikes = made.strikes;
  if (made.outcome.kind !== 'moved' || !made.list) return made.outcome;

  // Only repositories that are Moved or Already there can go in the list (FR-GH-018).
  const byId = new Map(items.map((i) => [i.itemId, i]));
  let added = 0;
  for (const id of repoIds) {
    const repo = byId.get(id);
    const nodeId = str(parse(repo?.data ?? null)?.nodeId);
    if (!repo || !nodeId || (repo.status !== 'moved' && repo.status !== 'already_there')) continue;
    if (pacer) {
      const pace = await pacer.beforeAdd();
      if ('later' in pace) return { kind: 'later', resumeAt: pace.later };
      if (pace.wait > 0) await sleep(pace.wait);
    }
    const out = track(await api.addRepoToList(token, nodeId, made.list.id, existing, strikes));
    if (out.kind !== 'moved') return out;
    added += 1;
  }
  const left = repoIds.length - added;
  return left > 0 ? { kind: 'moved', reason: `${left} left out` } : { kind: 'moved' };
}

export const githubDriver: Driver = {
  id: 'github',
  words: githubWords,
  // Pick order. A list moves after its repositories, so items move in a different order.
  kinds: [
    { id: 'repo', heading: 'Stars' },
    { id: 'list', heading: 'Lists' },
    { id: 'gist', heading: 'Gists', optional: true },
    { id: 'person', heading: 'People' },
  ],
  moveOrder: ['repo', 'person', 'gist', 'list'],
  pace: {
    // ponytail: fixed numbers, tune them from real runs if GitHub's limits change
    gapMs: 3000, // 20 per minute
    perHour: 300,
    // One add per item, plus one per repository of each list.
    adds: (items) =>
      items.reduce((n, i) => {
        const repos = i.kind === 'list' ? parse(i.data)?.repoItemIds : null;
        return n + 1 + (Array.isArray(repos) ? repos.length : 0);
      }, 0),
  },
  removeAccessUrl: 'https://github.com/settings/applications',
  limitsUrl: 'https://dodo-tech-hub.github.io/magpie/limits/github',
  switchSignsOut: true,
  resumesNew: true,

  async signIn(role, kinds, onCode, signal) {
    // The old account asks for no scope. The new one asks only for the picked kinds (FR-GH-020).
    const res = await githubSignIn(role === 'old' ? '' : scopesFor(kinds), onCode, signal);
    if (!res.ok) return res;
    if (role === 'old') {
      setOld(res.token);
    } else {
      // A different account on an "Allow" sign-in must not replace the saved token: the flow refuses it.
      const prev = await getNew();
      if (!prev || prev.accountId === res.account.id) {
        await setNew({ token: res.token, accountId: res.account.id, scopes: res.scopes, expiresAt: res.expiresAt });
      }
    }
    return { ok: true, account: res.account };
  },

  async signOut(role) {
    strikes = 0;
    if (role !== 'new') dropOld();
    if (role !== 'old') await dropNew();
  },

  granted: async () => kindsOf((await getNew())?.scopes ?? []),

  async canAct(role, accountId) {
    if (role === 'old') return getOld() !== null;
    return (await getNew())?.accountId === accountId;
  },

  async listOld() {
    const token = getOld();
    if (!token) throw new DriverError('auth');
    try {
      const reads: [string, Promise<NewItem[]>][] = [
        ['repo', api.listStars(token)],
        ['list', api.listLists(token)],
        ['gist', api.listGists(token)],
        ['person', api.listPeople(token)],
      ];
      const done = await Promise.allSettled(reads.map(([, p]) => p));
      const items: NewItem[] = [];
      const missing: string[] = [];
      done.forEach((r, i) => (r.status === 'fulfilled' ? items.push(...r.value) : missing.push(reads[i][0])));
      // Every read failed: show the reason instead of an empty list.
      const first = done.find((r) => r.status === 'rejected');
      if (missing.length === reads.length && first?.status === 'rejected') throw first.reason;
      return { items, missing };
    } finally {
      // The old account is read once. Its token goes as soon as the list is read (FR-GH-019).
      dropOld();
    }
  },

  async checkNew(items, granted) {
    const saved = await getNew();
    if (!saved) throw new DriverError('auth');
    const reads: Promise<NewItem[]>[] = [];
    if (granted.includes('repo')) reads.push(api.listStars(saved.token));
    if (granted.includes('person')) reads.push(api.listPeople(saved.token));
    if (granted.includes('gist')) reads.push(api.listGists(saved.token));
    const have = new Set((await Promise.all(reads)).flat().map((i) => i.itemId));
    // An account cannot follow itself, so the new account's own row counts as there (spec, Edge Cases).
    have.add(`person:${saved.accountId}`);
    const mine = new Set(items.map((i) => i.itemId));
    return [...have].filter((id) => mine.has(id));
  },

  async add(item, items, pacer) {
    const saved = await getNew();
    if (!saved) return { kind: 'auth' };
    const d = parse(item.data);
    switch (item.kind) {
      case 'repo': {
        const name = str(d?.fullName);
        return name ? track(await api.starRepo(saved.token, name, strikes)) : { kind: 'couldnt_move', reason: GENERIC };
      }
      case 'person': {
        const login = str(d?.login);
        return login ? track(await api.followPerson(saved.token, login, strikes)) : { kind: 'couldnt_move', reason: GENERIC };
      }
      case 'gist': {
        const id = str(d?.gistId);
        return id ? track(await api.starGist(saved.token, id, strikes)) : { kind: 'couldnt_move', reason: GENERIC };
      }
      case 'list':
        return addList(item, items, saved.token, pacer);
      default:
        return { kind: 'couldnt_move', reason: GENERIC };
    }
  },

  async endMove() {
    strikes = 0;
    await dropNew();
  },
};

