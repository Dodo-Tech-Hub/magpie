import * as auth from '@/auth/bluesky';
import { NobleKey } from '@/auth/blueskyKey';
import { blueskyStores } from '@/auth/blueskySession';
import * as api from '@/api/bluesky';
import * as lookups from '@/auth/blueskyLookup';
import { DriverError } from '@/platforms/driver';
import { blueskyDriver as driver } from '@/platforms/blueskyDriver';
import type { StoredItem } from '@/store/progressStore';
import { __reset } from '../mocks/expoSecureStore';
import { did } from '../mocks/blueskyFetch';

jest.mock('@/auth/bluesky', () => ({
  ...jest.requireActual('@/auth/bluesky'),
  signIn: jest.fn(),
  signOut: jest.fn(),
  newAccountFetch: jest.fn(),
  oldAccountFetch: jest.fn(),
}));
jest.mock('@/auth/blueskyLookup', () => ({ ...jest.requireActual('@/auth/blueskyLookup'), lookup: jest.fn() }));
jest.mock('@/api/bluesky', () => ({
  ...jest.requireActual('@/api/bluesky'),
  readFollows: jest.fn(),
  readBlocks: jest.fn(),
  readLists: jest.fn(),
  haveOnNew: jest.fn(),
  followPerson: jest.fn(),
  blockPerson: jest.fn(),
  addList: jest.fn(),
  readMutes: jest.fn(),
  readFeeds: jest.fn(),
  muteActor: jest.fn(),
  addFeed: jest.fn(),
}));
const signIn = auth.signIn as jest.Mock;
const signOut = auth.signOut as jest.Mock;
const newFetch = auth.newAccountFetch as jest.Mock;
const oldFetch = auth.oldAccountFetch as jest.Mock;
const lookup = lookups.lookup as jest.Mock;
const mocked = (f: unknown) => f as jest.Mock;

const ALICE = did(1);
const BOB = did(2);

async function saveNew(sub: `did:plc:${string}`, scope: string) {
  await blueskyStores.sessionStore.set(sub, {
    dpopKey: await NobleKey.generate(['ES256']),
    authMethod: { method: 'none' },
    tokenSet: { iss: 'https://bsky.social', sub, aud: 'https://x.host.bsky.network', scope: scope as 'atproto', token_type: 'DPoP', access_token: 'a', refresh_token: 'r', expires_at: '2030-01-01T00:00:00.000Z' },
  });
  await blueskyStores.setNewDid(sub);
}

const SERVER = 'https://morel.us-east.host.bsky.network';
const fetcher = jest.fn();

beforeEach(async () => {
  __reset();
  jest.clearAllMocks();
  signIn.mockReset();
  signOut.mockReset();
  newFetch.mockReset();
  lookup.mockReset();
  for (const f of ['readFollows', 'readBlocks', 'readLists', 'haveOnNew', 'followPerson', 'blockPerson', 'addList', 'readMutes', 'readFeeds', 'muteActor', 'addFeed'] as const) mocked(api[f]).mockReset();
  oldFetch.mockReset();
  oldFetch.mockResolvedValue(null);
  newFetch.mockResolvedValue({ did: ALICE, fetch: fetcher });
  await driver.signOut('old'); // forgets the old account
});

describe('the Bluesky driver, sign-in part', () => {
  it('asks for a handle and keeps the Switch button as Sign out', () => {
    expect(driver.id).toBe('bluesky');
    expect(driver.handleInput).toBe(true);
    expect(driver.switchSignsOut).toBe(true);
    expect(driver.resumesNew).toBe(true);
    expect(driver.words.signIn).toBe('Sign in with Bluesky');
    expect(driver.words.changeOld).toBe('Change');
  });

  it('has the five kinds in Pick order, and asks no kind apart: mutes and feeds only need the old account', () => {
    expect(driver.kinds).toEqual([
      { id: 'person', heading: 'People' },
      { id: 'block', heading: 'Blocked' },
      { id: 'list', heading: 'Lists' },
      { id: 'mute', heading: 'Mutes', needsOld: true },
      { id: 'feed', heading: 'Feeds', needsOld: true },
    ]);
    expect(driver.kinds.some((k) => k.optional)).toBe(false);
  });

  it('signs in with the role, the kinds, and the typed handle, and gives back the account', async () => {
    const account = { id: ALICE, handle: 'alice.bsky.social', name: 'Alice', photoUrl: null };
    signIn.mockResolvedValue({ ok: true, account });
    expect(await driver.signIn('new', ['person'], () => undefined, undefined, 'alice.bsky.social')).toEqual({ ok: true, account });
    expect(signIn).toHaveBeenCalledWith('new', ['person'], 'alice.bsky.social');
  });

  it('says not_found for an empty handle, without looking anything up', async () => {
    expect(await driver.signIn('old', [], () => undefined, undefined, '  ')).toEqual({ ok: false, reason: 'not_found' });
    expect(await driver.signIn('old', [], () => undefined)).toEqual({ ok: false, reason: 'not_found' });
    expect(signIn).not.toHaveBeenCalled();
  });

  it('never asks for the sign-in code panel', async () => {
    signIn.mockResolvedValue({ ok: false, reason: 'cancelled' });
    const onCode = jest.fn();
    await driver.signIn('new', [], onCode, undefined, 'alice');
    expect(onCode).not.toHaveBeenCalled();
  });

  it('reads the kinds the new account was granted from the saved session', async () => {
    expect(await driver.granted()).toEqual([]);
    await saveNew(ALICE, auth.scopesFor('new', ['person', 'mute']));
    expect(await driver.granted()).toEqual(['person', 'mute']);
  });

  it('says it can act only for the new account that has a saved session', async () => {
    expect(await driver.canAct('new', ALICE)).toBe(false);
    await saveNew(ALICE, 'atproto');
    expect(await driver.canAct('new', ALICE)).toBe(true);
    expect(await driver.canAct('new', BOB)).toBe(false);
  });

  it('says it can act for the old account only while its session is in memory', async () => {
    expect(await driver.canAct('old', BOB)).toBe(false);
    blueskyStores.markOld(BOB);
    expect(await driver.canAct('old', BOB)).toBe(false);
    await blueskyStores.sessionStore.set(BOB, {
      dpopKey: await NobleKey.generate(['ES256']),
      authMethod: { method: 'none' },
      tokenSet: { iss: 'https://bsky.social', sub: BOB, aud: 'x', scope: 'atproto', token_type: 'DPoP', access_token: 'a', expires_at: '2030-01-01T00:00:00.000Z' },
    });
    expect(await driver.canAct('old', BOB)).toBe(true);
  });

  it('passes on whether Bluesky could cancel the access when it signs out', async () => {
    signOut.mockResolvedValue(true);
    expect(await driver.signOut('new')).toBe(false); // the access token outlives the cancel (FR-BS-013)
    signOut.mockResolvedValue(false);
    expect(await driver.signOut('new')).toBe(false);
    expect(signOut).toHaveBeenLastCalledWith('new');
  });
});


// ---- Read, check, add ---------------------------------------------------------------------------------------

const OLDER = did(3);
const row = (kind: string, id: string, data: unknown = { did: did(100), handle: 'x.bsky.social', seq: 0 }): StoredItem => ({
  itemId: `${kind}:${id}`,
  kind,
  title: id,
  thumbnailUrl: null,
  data: data === null ? null : JSON.stringify(data),
  picked: true,
  status: 'waiting',
  reason: null,
});
const asOld = async () => {
  signIn.mockResolvedValue({ ok: true, account: { id: OLDER, handle: 'older.bsky.social', name: 'o', photoUrl: null }, server: SERVER });
  await driver.signIn('old', [], () => undefined, undefined, 'older.bsky.social');
};

describe('the Bluesky driver, reading the old account', () => {
  it('reads follows, blocks, and lists of the account that was typed in, with no sign-in', async () => {
    await asOld();
    mocked(api.readFollows).mockResolvedValue([row('person', 'a')]);
    mocked(api.readBlocks).mockResolvedValue([row('block', 'b')]);
    mocked(api.readLists).mockResolvedValue([row('list', 'c', { purpose: 'curatelist', description: '', members: [], seq: 0 })]);
    const res = await driver.listOld();
    expect(res.items.map((i) => i.itemId)).toEqual(['person:a', 'block:b', 'list:c']);
    expect(res.missing).toEqual([]);
    expect(api.readFollows).toHaveBeenCalledWith(OLDER);
    expect(api.readBlocks).toHaveBeenCalledWith(OLDER, SERVER);
    expect(api.readLists).toHaveBeenCalledWith(OLDER);
  });

  it('reports the kinds that could not be read and still loads the others', async () => {
    await asOld();
    mocked(api.readFollows).mockResolvedValue([row('person', 'a')]);
    mocked(api.readBlocks).mockRejectedValue(new Error('bad page'));
    mocked(api.readLists).mockResolvedValue([]);
    const res = await driver.listOld();
    expect(res.missing).toEqual(['block']);
    expect(res.items).toHaveLength(1);
  });

  it('throws the reason when every kind failed, so the screen says why instead of showing an empty list', async () => {
    await asOld();
    for (const f of ['readFollows', 'readBlocks', 'readLists'] as const) mocked(api[f]).mockRejectedValue(new DriverError('retry'));
    await expect(driver.listOld()).rejects.toEqual(new DriverError('retry'));
  });

  it('needs the account to be typed in first, and forgets it when the old account is changed', async () => {
    await expect(driver.listOld()).rejects.toEqual(new DriverError('auth'));
    await asOld();
    mocked(api.readFollows).mockResolvedValue([]);
    mocked(api.readBlocks).mockResolvedValue([]);
    mocked(api.readLists).mockResolvedValue([]);
    await expect(driver.listOld()).resolves.toEqual({ items: [], missing: [] });
    await driver.signOut('old');
    await expect(driver.listOld()).rejects.toEqual(new DriverError('auth'));
  });
});

describe('the Bluesky driver, checking the new account', () => {
  it('gives back only the items of the move that the new account already has', async () => {
    await saveNew(ALICE, 'atproto');
    lookup.mockResolvedValue({ ok: true, account: { id: ALICE }, server: SERVER });
    mocked(api.haveOnNew).mockResolvedValue(new Set(['person:a', 'person:zzz', `block:${ALICE}`]));
    const items = [row('person', 'a'), row('person', 'b'), row('block', ALICE)];
    expect(await driver.checkNew(items, ['person'])).toEqual(['person:a', `block:${ALICE}`]);
    expect(api.haveOnNew).toHaveBeenCalledWith(ALICE, SERVER, undefined);
  });

  it('says the sign-in ran out when there is no new account session', async () => {
    await expect(driver.checkNew([row('person', 'a')], [])).rejects.toEqual(new DriverError('auth'));
  });

  it('passes on a failed read: no network is retry, a limit is later', async () => {
    await saveNew(ALICE, 'atproto');
    lookup.mockResolvedValue({ ok: false, reason: 'unavailable' });
    await expect(driver.checkNew([row('person', 'a')], [])).rejects.toEqual(new DriverError('retry'));
  });
});

describe('the Bluesky driver, the private kinds', () => {
  const oldFetcher = jest.fn();

  it('reads mutes and feeds with the old account session when there is one, then cancels and drops the session', async () => {
    await asOld();
    oldFetch.mockResolvedValue(oldFetcher);
    mocked(api.readFollows).mockResolvedValue([row('person', 'a')]);
    mocked(api.readBlocks).mockResolvedValue([]);
    mocked(api.readLists).mockResolvedValue([]);
    mocked(api.readMutes).mockResolvedValue([row('mute', 'm')]);
    mocked(api.readFeeds).mockResolvedValue([row('feed', 'f')]);
    signOut.mockResolvedValue(true);
    const res = await driver.listOld();
    expect(res.items.map((i) => i.itemId)).toEqual(['person:a', 'mute:m', 'feed:f']);
    expect(api.readMutes).toHaveBeenCalledWith(oldFetcher);
    expect(api.readFeeds).toHaveBeenCalledWith(oldFetcher);
    expect(signOut).toHaveBeenCalledWith('old');
  });

  it('cancels and drops the old account session even when a read fails, and reports the kind that failed', async () => {
    await asOld();
    oldFetch.mockResolvedValue(oldFetcher);
    mocked(api.readFollows).mockResolvedValue([]);
    mocked(api.readBlocks).mockResolvedValue([]);
    mocked(api.readLists).mockResolvedValue([]);
    mocked(api.readMutes).mockResolvedValue([row('mute', 'm')]);
    mocked(api.readFeeds).mockRejectedValue(new Error('no access'));
    const res = await driver.listOld();
    expect(res.missing).toEqual(['feed']);
    expect(signOut).toHaveBeenCalledWith('old');
  });

  it('does not read them, and has nothing to drop, without the old account session', async () => {
    await asOld();
    mocked(api.readFollows).mockResolvedValue([]);
    mocked(api.readBlocks).mockResolvedValue([]);
    mocked(api.readLists).mockResolvedValue([]);
    signOut.mockClear();
    await driver.listOld();
    expect(api.readMutes).not.toHaveBeenCalled();
    expect(api.readFeeds).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('checks the new account for mutes and feeds only with the kinds it was granted', async () => {
    await saveNew(ALICE, 'atproto');
    lookup.mockResolvedValue({ ok: true, account: { id: ALICE }, server: SERVER });
    mocked(api.haveOnNew).mockResolvedValue(new Set(['mute:m']));
    expect(await driver.checkNew([row('mute', 'm'), row('person', 'a')], ['person', 'mute'])).toEqual(['mute:m']);
    expect(api.haveOnNew).toHaveBeenCalledWith(ALICE, SERVER, { fetch: fetcher, kinds: ['mute'] });
  });

  it('mutes people and saves feeds in the new account with its own session', async () => {
    mocked(api.muteActor).mockResolvedValue({ kind: 'moved' });
    mocked(api.addFeed).mockResolvedValue({ kind: 'moved' });
    const m = row('mute', 'm', { did: did(101), handle: 'm.bsky.social', seq: 0 });
    expect(await driver.add(m, [m])).toEqual({ kind: 'moved' });
    expect(api.muteActor).toHaveBeenCalledWith(fetcher, did(101));
    const f = row('feed', 'f', { type: 'feed', value: 'at://x', pinned: true, seq: 0 });
    await driver.add(f, [f]);
    expect(api.addFeed).toHaveBeenCalledWith(fetcher, f);
  });
});

describe('the Bluesky driver, adding', () => {
  const fol = row('person', 'p', { did: did(101), handle: 'p.bsky.social', seq: 0 });

  it('follows, blocks, and makes lists in the new account with its own session', async () => {
    mocked(api.followPerson).mockResolvedValue({ kind: 'moved' });
    mocked(api.blockPerson).mockResolvedValue({ kind: 'moved' });
    mocked(api.addList).mockResolvedValue({ kind: 'moved', reason: '1 left out' });
    expect(await driver.add(fol, [fol])).toEqual({ kind: 'moved' });
    expect(api.followPerson).toHaveBeenCalledWith(fetcher, ALICE, did(101));
    const blk = row('block', 'q', { did: did(102), handle: 'q.bsky.social', seq: 0 });
    await driver.add(blk, [blk]);
    expect(api.blockPerson).toHaveBeenCalledWith(fetcher, ALICE, did(102));
    const lst = row('list', 'l', { purpose: 'curatelist', description: '', members: [], seq: 0 });
    const pacer = { beforeAdd: jest.fn() };
    expect(await driver.add(lst, [lst], pacer)).toEqual({ kind: 'moved', reason: '1 left out' });
    expect(api.addList).toHaveBeenCalledWith(fetcher, ALICE, lst, pacer);
  });

  it('says the sign-in ran out when there is no usable new account session, and writes nothing', async () => {
    newFetch.mockResolvedValue(null);
    expect(await driver.add(fol, [fol])).toEqual({ kind: 'auth' });
    expect(api.followPerson).not.toHaveBeenCalled();
  });

  it('says it could not move an item whose saved data is wrong, and makes no call', async () => {
    for (const data of [null, { did: 'did:web:x' }, { did: 5 }]) {
      const bad = row('person', 'p', data);
      expect(await driver.add(bad, [bad])).toEqual({ kind: 'couldnt_move', reason: "Bluesky didn't allow this one." });
    }
    expect(api.followPerson).not.toHaveBeenCalled();
    const odd = row('gist', 'g');
    expect(await driver.add(odd, [odd])).toMatchObject({ kind: 'couldnt_move' });
  });

  it('never writes with the old account session', async () => {
    await asOld();
    mocked(api.followPerson).mockResolvedValue({ kind: 'moved' });
    await driver.add(fol, [fol]);
    expect(newFetch).toHaveBeenCalledTimes(1);
    expect(mocked(api.followPerson).mock.calls[0][0]).toBe(fetcher);
  });
});

describe('the Bluesky driver, the limits page', () => {
  it('has a page that tells the numbers the pace really uses', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const text: string = require('fs').readFileSync(require('path').join(__dirname, '../../docs/limits/bluesky.md'), 'utf8');
    expect(driver.limitsUrl).toBe('https://dodo-tech-hub.github.io/magpie/limits/bluesky');
    const { gapMs, perHour, perDay } = driver.pace!;
    expect(text).toContain(`${60_000 / gapMs} items a minute`);
    expect(text).toContain(`${perHour.toLocaleString('en-US')} an hour`);
    expect(text).toContain(`${perDay!.toLocaleString('en-US')} a day`);
    expect(text).toMatch(/Bluesky and the butterfly logo belong to Bluesky Social PBC/);
  });
});

describe('the Bluesky driver, the order and the pace', () => {
  it('moves people, then blocks, then lists, then the private kinds', () => {
    expect(driver.moveOrder).toEqual(['person', 'block', 'list', 'mute', 'feed']);
  });

  it('puts the oldest first within a kind', () => {
    const a = row('person', 'a', { did: did(101), handle: 'a', seq: 5 });
    const b = row('person', 'b', { did: did(102), handle: 'b', seq: 0 });
    const none = row('person', 'c', null);
    expect([a, b].sort(driver.itemOrder!).map((i) => i.itemId)).toEqual(['person:b', 'person:a']);
    expect([a, none].sort(driver.itemOrder!).map((i) => i.itemId)).toEqual(['person:c', 'person:a']);
  });

  it('is fast but under what Bluesky allows, and counts one add per item and per list member', () => {
    expect(driver.pace).toMatchObject({ gapMs: 120, perHour: 1500, perDay: 10_000 });
    const lst = row('list', 'l', { purpose: 'curatelist', description: '', members: [did(101), did(102), did(103)], seq: 0 });
    expect(driver.pace!.adds([row('person', 'a'), row('block', 'b'), lst])).toBe(1 + 1 + (1 + 3));
    expect(driver.pace!.adds([])).toBe(0);
  });
});
