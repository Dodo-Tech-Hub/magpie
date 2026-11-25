import { Alert, type AlertButton } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import App from '../../App';
import { blueskyStores } from '@/auth/blueskySession';
import { blueskyDriver } from '@/platforms/blueskyDriver';
import { PLATFORMS, type Platform } from '@/platforms/platforms';
import { closeStore, listUnfinished, type NewItem } from '@/store/progressStore';
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
  unfinished: async () => {
    const list = await listUnfinished('bluesky');
    return { left: list.reduce((n, p) => n + p.left, 0), ids: list.map((p) => p.id) };
  },
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
// A saved feed: feed n is at feedUri(n), and is named "Feed n".
export type FakeFeed = { n: number; pinned: boolean };
export const feedUri = (n: number) => `at://${did(50 + n)}/app.bsky.feed.generator/f${n}`;
type Side = { follows: number[]; blocks: number[]; lists: FakeList[]; mutes: number[]; feeds: FakeFeed[]; otherPrefs: Record<string, unknown>[] };
const emptySide = (): Side => ({ follows: [], blocks: [], lists: [], mutes: [], feeds: [], otherPrefs: [] });
const SAVED = 'app.bsky.actor.defs#savedFeedsPrefV2';

// The fake world: the three accounts can be looked up, and the old and the new account hold follows, blocks, and
// lists that the app reads (public, no sign-in) and writes (with the new account's session). Follows are listed
// newest first, and blocks and lists oldest first, as Bluesky gives them. People numbers: see person(n).
export function blueskyWorld(extra: Parameters<typeof mockBluesky>[0] = {}) {
  const data = { old: emptySide(), new: emptySide() };
  // The signed-in calls say who signed in: the fake session sends `DPoP <account ID>`.
  const signedSide = (r: Req) => sideOf(r.headers.authorization?.replace('DPoP ', '') ?? null);
  const sideOf = (d: string | null) => (d === NEW.did ? data.new : d === OLD.did ? data.old : emptySide());
  const known = new Map<string, ReturnType<typeof person>>();
  const remember = (n: number) => known.set(person(n).did, person(n));
  // Everything the new account was asked to write, in order.
  const writes: { repo: string; collection: string; record: Record<string, unknown> }[] = [];
  // Every settings write, and every account that was muted.
  const prefWrites: Record<string, unknown>[][] = [];
  const muted: string[] = [];
  // Numbers of people whose account is gone: Bluesky no longer knows them.
  const gone = new Set<number>();
  // The next answer to a write, if a test wants one other than success.
  const answers: Record<string, (Answer | 'ok')[]> = {};
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
    [`GET ${SERVER}/xrpc/app.bsky.graph.getMutes*`]: (r) => {
      const all = signedSide(r).mutes.filter((n) => !gone.has(n));
      all.forEach(remember);
      return { json: { mutes: all.map(person) } };
    },
    [`GET ${SERVER}/xrpc/app.bsky.actor.getPreferences`]: (r) => {
      const side = signedSide(r);
      const saved = { $type: SAVED, items: [{ type: 'timeline', value: 'following', pinned: true, id: 't' }, ...side.feeds.map((x) => ({ type: 'feed', value: feedUri(x.n), pinned: x.pinned, id: `id${x.n}` }))] };
      return { json: { preferences: [...side.otherPrefs, saved] } };
    },
    [`POST ${SERVER}/xrpc/app.bsky.actor.putPreferences`]: (r) => {
      const side = signedSide(r);
      const sent = (r.body as { preferences: { $type: string; items?: { type: string; value: string; pinned: boolean }[] }[] }).preferences;
      prefWrites.push(sent);
      side.otherPrefs = sent.filter((p) => p.$type !== SAVED);
      const items = sent.find((p) => p.$type === SAVED)?.items ?? [];
      side.feeds = items.filter((i) => i.type === 'feed').map((i) => ({ n: Number(i.value.split('/f').pop()), pinned: i.pinned }));
      return { status: 200 };
    },
    [`POST ${SERVER}/xrpc/app.bsky.graph.muteActor`]: (r) => {
      const subject = [...known.values()].find((p) => p.did === (r.body as { actor: string }).actor);
      if (subject) signedSide(r).mutes.unshift(Number(subject.handle.slice(1).split('.')[0]));
      muted.push((r.body as { actor: string }).actor);
      return { status: 200 };
    },
    [`GET ${PUBLIC}/app.bsky.feed.getFeedGenerators*`]: (r) => ({
      json: { feeds: new URL(r.url).searchParams.getAll('feeds').map((uri) => ({ uri, displayName: `Feed ${uri.split('/f').pop()}` })) },
    }),
    [`POST ${SERVER}/xrpc/com.atproto.repo.createRecord`]: (r) => {
      const body = r.body as { repo: string; collection: string; record: Record<string, unknown> };
      const next = answers[body.collection]?.shift();
      if (next && next !== 'ok') return next;
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
    prefWrites,
    muted,
    gone,
    // The answers to the next writes of a kind of record (for example a rate limit), before they succeed again.
    // 'ok' lets one write go through as usual.
    answerNext: (collection: string, ...a: (Answer | 'ok')[]) => {
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

// Let fake time pass so a wait can end, inside act.
export const seconds = (n: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(n * 1000);
  });

// A move runs on fake time. Wait for text while the clock moves on.
export const eventually = (text: string | RegExp) =>
  screen.findByText(text, {}, { timeout: 600_000, interval: 1000 });

// Answer the question about reminders right away.
export function answerReminder(text: string) {
  return jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_t: unknown, _m: unknown, buttons?: unknown) =>
      (buttons as AlertButton[] | undefined)?.find((b) => b.text === text)?.onPress?.(),
    );
}
