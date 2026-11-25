import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../../App';
import { blueskyStores } from '@/auth/blueskySession';
import { blueskyDriver } from '@/platforms/blueskyDriver';
import { PLATFORMS, type Platform } from '@/platforms/platforms';
import { closeStore, type NewItem } from '@/store/progressStore';
import { __reset } from '../mocks/expoSecureStore';
import { __reset as resetBrowser } from '../mocks/expoWebBrowser';
import { PUBLIC, SERVER, account, did, mockBluesky, type Answer, type Req } from '../mocks/blueskyFetch';
import { resetClient, userSignsInAs } from '../mocks/oauthClient';
import { scopesFor } from '@/auth/bluesky';

// Three Bluesky accounts: the old one, the new one, and a stranger.
export const OLD = { did: did(1), handle: 'old.bsky.social', name: 'Old Me' };
export const NEW = { did: did(2), handle: 'new.bsky.social', name: 'New Me' };
export const OTHER = { did: did(3), handle: 'other.bsky.social', name: 'Other One' };

// The Bluesky card is not in the platform list until its logo is added, so a test adds it for its own length.
const entry: Platform = {
  id: 'bluesky',
  name: 'Bluesky',
  logo: 1 as never,
  section: 'automatic',
  ready: true,
  driver: blueskyDriver,
  open: (dispatch) => dispatch({ type: 'openPlatform', platform: 'bluesky' }),
  unfinished: async () => ({ left: 0, ids: [] }),
};

export function registerBluesky() {
  if (!PLATFORMS.includes(entry)) PLATFORMS.push(entry);
}
export function unregisterBluesky() {
  const i = PLATFORMS.indexOf(entry);
  if (i >= 0) PLATFORMS.splice(i, 1);
}

// A person that accounts follow, block, or put in lists. Person n always has the same ID, handle, and name.
export const person = (n: number) => ({ did: did(100 + n), handle: `p${n}.bsky.social`, displayName: `Person ${n}` });
export type FakeList = { name: string; purpose?: 'curatelist' | 'modlist'; members: number[] };
type Side = { follows: number[]; blocks: number[]; lists: FakeList[] };
const emptySide = (): Side => ({ follows: [], blocks: [], lists: [] });

// The fake world: the three accounts can be looked up, and the old and the new account hold follows, blocks, and
// lists that the app reads (public, no sign-in) and writes (with the new account's session). Follows are listed
// newest first, and blocks and lists oldest first, as Bluesky gives them. People numbers: see person(n).
export function blueskyWorld(extra: Parameters<typeof mockBluesky>[0] = {}) {
  const data = { old: emptySide(), new: emptySide() };
  const sideOf = (d: string | null) => (d === NEW.did ? data.new : d === OLD.did ? data.old : emptySide());
  const known = new Map<string, ReturnType<typeof person>>();
  const remember = (n: number) => known.set(person(n).did, person(n));
  // Everything the new account was asked to write, in order.
  const writes: { repo: string; collection: string; record: Record<string, unknown> }[] = [];
  // Numbers of people whose account is gone: Bluesky no longer knows them.
  const gone = new Set<number>();
  // The next answer to a write, if a test wants one other than success.
  const answers: Record<string, Answer[]> = {};
  const q = (r: Req, name: string) => new URL(r.url).searchParams.get(name);
  const listUri = (owner: string, i: number) => `at://${owner}/app.bsky.graph.list/${i + 1}`;

  const f = mockBluesky({
    ...account(OLD.handle, OLD.did, { displayName: OLD.name }),
    ...account(NEW.handle, NEW.did, { displayName: NEW.name }),
    ...account(OTHER.handle, OTHER.did, { displayName: OTHER.name }),
    [`GET ${PUBLIC}/app.bsky.graph.getFollows*`]: (r) => {
      const all = sideOf(q(r, 'actor')).follows.filter((n) => !gone.has(n));
      all.forEach(remember);
      return { json: { follows: all.map(person) } };
    },
    [`GET ${SERVER}/xrpc/com.atproto.repo.listRecords*`]: (r) => {
      const all = sideOf(q(r, 'repo')).blocks;
      all.forEach(remember);
      return { json: { records: all.map((n, i) => ({ uri: `at://x/app.bsky.graph.block/${i}`, value: { subject: person(n).did } })) } };
    },
    [`GET ${PUBLIC}/app.bsky.actor.getProfiles*`]: (r) => ({
      json: { profiles: new URL(r.url).searchParams.getAll('actors').flatMap((d) => (known.has(d) && !gone.has(Number(known.get(d)!.handle.slice(1).split('.')[0])) ? [known.get(d)!] : [])) },
    }),
    [`GET ${PUBLIC}/app.bsky.graph.getLists*`]: (r) => {
      const owner = q(r, 'actor')!;
      return {
        json: {
          lists: sideOf(owner).lists.map((l, i) => ({
            uri: listUri(owner, i),
            name: l.name,
            purpose: `app.bsky.graph.defs#${l.purpose ?? 'curatelist'}`,
            description: `About ${l.name}`,
            indexedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
          })),
        },
      };
    },
    [`GET ${PUBLIC}/app.bsky.graph.getList*`]: (r) => {
      const uri = q(r, 'list')!;
      const owner = uri.split('/')[2];
      const list = sideOf(owner).lists[Number(uri.split('/').pop()) - 1];
      list?.members.forEach(remember);
      return { json: { items: (list?.members ?? []).filter((n) => !gone.has(n)).map((n) => ({ subject: person(n) })) } };
    },
    [`POST ${SERVER}/xrpc/com.atproto.repo.createRecord`]: (r) => {
      const body = r.body as { repo: string; collection: string; record: Record<string, unknown> };
      const next = answers[body.collection]?.shift();
      if (next) return next;
      writes.push(body);
      const side = sideOf(body.repo);
      // The new account now has what was written, so a later read sees it.
      const subject = [...known.values()].find((p) => p.did === body.record.subject);
      const n = subject ? Number(subject.handle.slice(1).split('.')[0]) : null;
      if (body.collection === 'app.bsky.graph.follow' && n !== null) side.follows.unshift(n);
      if (body.collection === 'app.bsky.graph.block' && n !== null) side.blocks.push(n);
      if (body.collection === 'app.bsky.graph.list') {
        const purpose = String(body.record.purpose).endsWith('modlist') ? 'modlist' : 'curatelist';
        side.lists.push({ name: String(body.record.name), purpose, members: [] });
        return { json: { uri: listUri(body.repo, side.lists.length - 1), cid: 'c' } };
      }
      if (body.collection === 'app.bsky.graph.listitem' && n !== null) {
        const list = side.lists[Number(String(body.record.list).split('/').pop()) - 1];
        list?.members.push(n);
      }
      return { json: { uri: `at://${body.repo}/${body.collection}/1`, cid: 'c' } };
    },
    ...extra,
  });

  return {
    f,
    data,
    writes,
    gone,
    // The answers to the next writes of a kind of record (for example a rate limit), before they succeed again.
    answerNext: (collection: string, ...a: Answer[]) => {
      answers[collection] = [...(answers[collection] ?? []), ...a];
    },
  };
}

export async function resetBluesky() {
  jest.clearAllMocks();
  __reset();
  resetBrowser();
  resetClient();
  for (const d of blueskyStores.oldDids()) blueskyStores.clearOld(d);
  blueskyStores.capture(false);
  await closeStore();
  registerBluesky();
}

export async function renderBluesky() {
  const view = await render(<App />);
  await fireEvent.press(await screen.findByLabelText('Bluesky'));
  return view;
}

export const item = (kind: string, id: string, title = id, data: unknown = null): NewItem => ({
  itemId: `${kind}:${id}`,
  kind,
  title,
  thumbnailUrl: null,
  data: data === null ? null : JSON.stringify(data),
});

// Type a handle in the box of the open step and tap its sign-in button.
export async function signInWithHandle(step: 'Old account' | 'New account', handle: string) {
  await fireEvent.changeText(screen.getByLabelText('Bluesky handle'), handle);
  await fireEvent.press(screen.getByLabelText(`Sign in with Bluesky: ${step}`));
}

// Sign in to the new account in the browser (the old account was typed in before), and land on Pick.
// The new account is granted the public kinds unless told otherwise.
export async function signInNewAccount(newScope = scopesFor('new', ['person', 'block', 'list'])) {
  await userSignsInAs(NEW.did, newScope);
  await fireEvent.press(await screen.findByRole('tab', { name: 'To' }));
  await signInWithHandle('New account', NEW.handle);
  await screen.findByRole('checkbox', { name: 'All' });
}

// Type the old handle (no sign-in), then sign in to the new account, and land on Pick.
export async function signInBoth(newScope?: string) {
  await signInWithHandle('Old account', OLD.handle);
  await signInNewAccount(newScope);
}
