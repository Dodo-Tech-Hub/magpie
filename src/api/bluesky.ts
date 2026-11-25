import { DID, PUBLIC, blueskyServer, isRecord, picture } from '@/auth/blueskyLookup';
import { DriverError, type Outcome, type Pacer } from '@/platforms/driver';
import type { NewItem, StoredItem } from '@/store/progressStore';

// Every Bluesky call that reads or writes lists and records. Contract: specs/013-bluesky-platform/contracts/bluesky-api.md
// Public reads need no sign-in. Answers are untrusted: every shape is checked, and an account ID or an address that
// does not look right is left out (constitution III.8).
const PAGE = 100;
const PROFILE_BATCH = 25;
const MAX_PAGES = 500; // 50,000 items. A guard against a server that never stops giving a cursor.
const AT_URI = /^at:\/\/did:plc:[a-z2-7]{24}\/[A-Za-z.]+\/[A-Za-z0-9._~:@!$&'()*+,;=-]+$/;
const BAD = () => new Error('Bluesky answered with something unexpected');

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

// Get a public answer. No network: retry. Rate limited: later. Any other failure: an error for that kind only.
async function getJson(url: string): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new DriverError('retry');
  }
  if (res.status === 429) throw new DriverError('later');
  if (!res.ok) throw BAD();
  const body: unknown = await res.json().catch(() => null);
  if (!isRecord(body)) throw BAD();
  return body;
}

// Every page of a list, until the answer has no cursor.
async function* pages(url: (cursor?: string) => string): AsyncGenerator<Record<string, unknown>> {
  let cursor: string | undefined;
  for (let n = 0; n < MAX_PAGES; n += 1) {
    const page = await getJson(url(cursor));
    yield page;
    cursor = str(page.cursor) ?? undefined;
    if (!cursor) return;
  }
}

const arrayOf = (v: unknown): unknown[] => {
  if (!Array.isArray(v)) throw BAD();
  return v;
};

type Profile = { did: string; handle: string; displayName?: unknown; avatar?: unknown };
const profileOf = (v: unknown): Profile | null =>
  isRecord(v) && typeof v.did === 'string' && DID.test(v.did) && typeof v.handle === 'string' ? (v as Profile) : null;

// The number of the item among those the account made, 0 for the oldest. `order`: how the server gave them.
const seqOf = (index: number, total: number, order: 'newest-first' | 'oldest-first') =>
  order === 'newest-first' ? total - 1 - index : index;

function personItem(kind: 'person' | 'block' | 'mute', p: Profile, seq: number): NewItem {
  return {
    itemId: `${kind}:${p.did}`,
    kind,
    title: str(p.displayName) ?? p.handle,
    thumbnailUrl: picture(p.avatar),
    data: JSON.stringify({ did: p.did, handle: p.handle, seq }),
  };
}

// ---- Read the old account (public, no sign-in) ------------------------------------------------------------

// The people an account follows. The server gives them newest first.
export async function readFollows(did: string): Promise<NewItem[]> {
  const found: Profile[] = [];
  for await (const page of pages((c) => `${PUBLIC}/app.bsky.graph.getFollows?actor=${did}&limit=${PAGE}${c ? `&cursor=${encodeURIComponent(c)}` : ''}`)) {
    for (const f of arrayOf(page.follows)) {
      const p = profileOf(f);
      if (p) found.push(p);
    }
  }
  return found.map((p, i) => personItem('person', p, seqOf(i, found.length, 'newest-first')));
}

// Names for account IDs, 25 at a time. An account the app view no longer knows is not in the answer.
async function profilesOf(dids: string[]): Promise<Map<string, Profile>> {
  const out = new Map<string, Profile>();
  for (let i = 0; i < dids.length; i += PROFILE_BATCH) {
    const query = dids.slice(i, i + PROFILE_BATCH).map((d) => `actors=${d}`).join('&');
    for (const raw of arrayOf((await getJson(`${PUBLIC}/app.bsky.actor.getProfiles?${query}`)).profiles)) {
      const p = profileOf(raw);
      if (p) out.set(p.did, p);
    }
  }
  return out;
}

// The accounts a record list points at, oldest first. Records are public on the account's own server.
async function subjectsOf(did: string, server: string, collection: string): Promise<string[]> {
  const origin = blueskyServer(server);
  if (!origin) throw BAD();
  const subjects: string[] = [];
  for await (const page of pages((c) => `${origin}/xrpc/com.atproto.repo.listRecords?repo=${did}&collection=${collection}&limit=${PAGE}&reverse=true${c ? `&cursor=${encodeURIComponent(c)}` : ''}`)) {
    for (const r of arrayOf(page.records)) {
      const subject = isRecord(r) && isRecord(r.value) ? r.value.subject : null;
      if (typeof subject === 'string' && DID.test(subject)) subjects.push(subject);
    }
  }
  return subjects;
}

// The people an account blocks.
export async function readBlocks(did: string, server: string): Promise<NewItem[]> {
  const subjects = await subjectsOf(did, server, 'app.bsky.graph.block');
  const names = await profilesOf(subjects);
  // The number is the place among the blocks that still exist, so the oldest of them is 0.
  const known = subjects.filter((d) => names.has(d));
  return known.map((d, i) => personItem('block', names.get(d)!, seqOf(i, known.length, 'oldest-first')));
}

const PURPOSES: Record<string, 'curatelist' | 'modlist'> = {
  'app.bsky.graph.defs#curatelist': 'curatelist',
  'app.bsky.graph.defs#modlist': 'modlist',
};

// The lists an account made, with their members. People lists and moderation lists; other kinds are skipped.
export async function readLists(did: string): Promise<NewItem[]> {
  const lists: { uri: string; name: string; purpose: 'curatelist' | 'modlist'; description: string; avatar: unknown; indexedAt: string }[] = [];
  for await (const page of pages((c) => `${PUBLIC}/app.bsky.graph.getLists?actor=${did}&limit=${PAGE}${c ? `&cursor=${encodeURIComponent(c)}` : ''}`)) {
    for (const l of arrayOf(page.lists)) {
      if (!isRecord(l)) continue;
      const purpose = typeof l.purpose === 'string' ? PURPOSES[l.purpose] : undefined;
      // The address must be a list of this account.
      if (!purpose || typeof l.uri !== 'string' || !AT_URI.test(l.uri) || !l.uri.startsWith(`at://${did}/`) || !str(l.name)) continue;
      lists.push({ uri: l.uri, name: String(l.name), purpose, description: str(l.description) ?? '', avatar: l.avatar, indexedAt: str(l.indexedAt) ?? '' });
    }
  }
  const oldestFirst = [...lists].sort((a, b) => a.indexedAt.localeCompare(b.indexedAt));
  const items: NewItem[] = [];
  for (const l of lists) {
    const members: string[] = [];
    for await (const page of pages((c) => `${PUBLIC}/app.bsky.graph.getList?list=${encodeURIComponent(l.uri)}&limit=${PAGE}${c ? `&cursor=${encodeURIComponent(c)}` : ''}`)) {
      for (const m of arrayOf(page.items)) {
        const p = isRecord(m) ? profileOf(m.subject) : null;
        if (p) members.push(p.did);
      }
    }
    items.push({
      itemId: `list:${l.uri}`,
      kind: 'list',
      title: l.name,
      thumbnailUrl: picture(l.avatar),
      data: JSON.stringify({ purpose: l.purpose, description: l.description, members, seq: oldestFirst.indexOf(l) }),
    });
  }
  return items;
}

// ---- Check the new account ----------------------------------------------------------------------------------

// The item IDs the new account already has, from public reads only. The new account itself counts as there,
// because an account cannot follow or block itself.
export async function haveOnNew(did: string, server: string): Promise<Set<string>> {
  const [follows, blocks] = await Promise.all([readFollows(did), subjectsOf(did, server, 'app.bsky.graph.block')]);
  return new Set([
    ...follows.map((f) => f.itemId),
    ...blocks.map((d) => `block:${d}`),
    `person:${did}`,
    `block:${did}`,
  ]);
}

// ---- Add to the new account ---------------------------------------------------------------------------------

// The signed-in fetch of a session. It sends the request to the account's own server, with the token and a fresh proof.
export type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

const GENERIC = "Bluesky didn't allow this one.";
const PAUSED = "Bluesky paused your account's activity. Try again later.";
const PAUSED_ERRORS = ['AccountTakedown', 'AccountDeactivated', 'RepoTakendown', 'RepoDeactivated'];
const SIGN_IN_ERRORS = ['ExpiredToken', 'InvalidToken'];
const MAX_WAIT_MS = 60_000;
const HOUR = 3_600_000;

// What a row shows for an answer of Bluesky. Only the error name is read; its text is never shown (FR-BS-017).
export function mapAnswer(res: { status: number; headers: { get(name: string): string | null } }, body: unknown): Outcome {
  const error = isRecord(body) && typeof body.error === 'string' ? body.error : '';
  if (res.status >= 200 && res.status < 300) return { kind: 'moved' };
  if (res.status === 401 || SIGN_IN_ERRORS.includes(error)) return { kind: 'auth' };
  if (res.status === 429) {
    // The time Bluesky says the limit resets, in seconds since 1970.
    const reset = Number(res.headers.get('ratelimit-reset'));
    if (!Number.isFinite(reset) || reset <= 0) return { kind: 'later', resumeAt: Date.now() + HOUR };
    const ms = reset * 1000 - Date.now();
    return ms <= MAX_WAIT_MS ? { kind: 'wait', ms: Math.max(ms, 1000) } : { kind: 'later', resumeAt: reset * 1000 };
  }
  if (res.status >= 500) return { kind: 'retry' };
  if (PAUSED_ERRORS.includes(error)) return { kind: 'stop', notice: PAUSED };
  if (res.status === 404) return { kind: 'couldnt_move', reason: 'Account was deleted.' };
  if (res.status === 403) return { kind: 'couldnt_move', reason: "Magpie doesn't have access for this." };
  return { kind: 'couldnt_move', reason: GENERIC };
}

// A call that changes something. A dead sign-in is auth. No answer at all is retry.
async function send(f: Fetcher, path: string, body: unknown, headers: Record<string, string> = {}): Promise<{ outcome: Outcome; json: unknown }> {
  try {
    const res = await f(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const json: unknown = await res.json().catch(() => null);
    return { outcome: mapAnswer(res, json), json };
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    return { outcome: /^Token(Refresh|Revoked|Invalid)Error$/.test(name) ? { kind: 'auth' } : { kind: 'retry' }, json: null };
  }
}

// A record in the new account's own repository. `subject`: who the record is about.
async function createRecord(f: Fetcher, repo: string, collection: string, record: Record<string, unknown>) {
  return send(f, '/xrpc/com.atproto.repo.createRecord', {
    repo,
    collection,
    record: { $type: collection, ...record, createdAt: new Date().toISOString() },
  });
}

export async function followPerson(f: Fetcher, repo: string, subject: string): Promise<Outcome> {
  return (await createRecord(f, repo, 'app.bsky.graph.follow', { subject })).outcome;
}

export async function blockPerson(f: Fetcher, repo: string, subject: string): Promise<Outcome> {
  return (await createRecord(f, repo, 'app.bsky.graph.block', { subject })).outcome;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const PURPOSE_NAME = { curatelist: 'app.bsky.graph.defs#curatelist', modlist: 'app.bsky.graph.defs#modlist' } as const;

// The saved data of a list row, checked on read. null: it is not what this app wrote.
function listData(raw: string | null): { purpose: keyof typeof PURPOSE_NAME; description: string; members: string[] } | null {
  try {
    const v: unknown = JSON.parse(raw ?? '');
    if (!isRecord(v) || (v.purpose !== 'curatelist' && v.purpose !== 'modlist') || !Array.isArray(v.members)) return null;
    return {
      purpose: v.purpose,
      description: typeof v.description === 'string' ? v.description : '',
      members: v.members.filter((m): m is string => typeof m === 'string' && DID.test(m)),
    };
  } catch {
    return null;
  }
}

// A list of the new account with the same name and purpose, and who is in it. Public reads.
async function findList(repo: string, name: string, purpose: string): Promise<{ uri: string; members: Set<string> } | null> {
  for await (const page of pages((c) => `${PUBLIC}/app.bsky.graph.getLists?actor=${repo}&limit=${PAGE}${c ? `&cursor=${encodeURIComponent(c)}` : ''}`)) {
    for (const l of arrayOf(page.lists)) {
      if (!isRecord(l) || l.name !== name || l.purpose !== purpose || typeof l.uri !== 'string' || !AT_URI.test(l.uri)) continue;
      const members = new Set<string>();
      for await (const inner of pages((c) => `${PUBLIC}/app.bsky.graph.getList?list=${encodeURIComponent(l.uri as string)}&limit=${PAGE}${c ? `&cursor=${encodeURIComponent(c)}` : ''}`)) {
        for (const m of arrayOf(inner.items)) {
          const p = isRecord(m) ? profileOf(m.subject) : null;
          if (p) members.add(p.did);
        }
      }
      return { uri: l.uri, members };
    }
  }
  return null;
}

// Make a list like the old one, or use the one with the same name, and add the members that are not in it (FR-BS-018).
// Nothing is removed from any list. Each member is one add, so the pace is asked before each.
export async function addList(f: Fetcher, repo: string, item: StoredItem, pacer?: Pacer): Promise<Outcome> {
  const data = listData(item.data);
  if (!data) return { kind: 'couldnt_move', reason: GENERIC };
  let existing: Awaited<ReturnType<typeof findList>>;
  try {
    existing = await findList(repo, item.title, PURPOSE_NAME[data.purpose]);
  } catch (e) {
    return e instanceof DriverError && e.kind === 'later' ? { kind: 'later', resumeAt: Date.now() + HOUR } : { kind: 'retry' };
  }
  let uri = existing?.uri ?? null;
  if (!uri) {
    const made = await createRecord(f, repo, 'app.bsky.graph.list', { purpose: PURPOSE_NAME[data.purpose], name: item.title, description: data.description });
    const given = isRecord(made.json) ? made.json.uri : null;
    if (made.outcome.kind !== 'moved') return made.outcome;
    if (typeof given !== 'string' || !given.startsWith(`at://${repo}/`)) return { kind: 'couldnt_move', reason: GENERIC };
    uri = given;
  }
  let leftOut = 0;
  for (const member of data.members) {
    if (existing?.members.has(member)) continue;
    if (pacer) {
      const pace = await pacer.beforeAdd();
      if ('later' in pace) return { kind: 'later', resumeAt: pace.later };
      if (pace.wait > 0) await sleep(pace.wait);
    }
    const out = (await createRecord(f, repo, 'app.bsky.graph.listitem', { subject: member, list: uri })).outcome;
    if (out.kind === 'couldnt_move') leftOut += 1;
    else if (out.kind !== 'moved') return out;
  }
  return leftOut > 0 ? { kind: 'moved', reason: `${leftOut} left out` } : { kind: 'moved' };
}
