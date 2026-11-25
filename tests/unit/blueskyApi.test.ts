import { DriverError } from '@/platforms/driver';
import { addFeed, addList, blockPerson, followPerson, haveOnNew, mapAnswer, muteActor, readBlocks, readFeeds, readFollows, readLists, readMutes } from '@/api/bluesky';
import type { Pacer } from '@/platforms/driver';
import type { StoredItem } from '@/store/progressStore';
import { PUBLIC, did, mockBluesky, type Answer, type Req } from '../mocks/blueskyFetch';

const ME = did(1);
const SERVER = 'https://morel.us-east.host.bsky.network';
const AV = 'https://cdn.bsky.app/img/avatar/plain/x/y@jpeg';
const person = (n: number, extra: Record<string, unknown> = {}) => ({ did: did(100 + n), handle: `p${n}.bsky.social`, displayName: `Person ${n}`, avatar: AV, ...extra });
const json = (data: unknown): Answer => ({ json: data });
const q = (r: Req, name: string) => new URL(r.url).searchParams.get(name);

// Serves `all` in pages of `size` by cursor (the cursor is the index to start from).
function paged(key: string, all: unknown[], size: number, wrap: (items: unknown[], cursor?: string) => unknown) {
  return (r: Req): Answer => {
    const from = Number(q(r, 'cursor') ?? 0);
    const next = from + size < all.length ? String(from + size) : undefined;
    return json(wrap(all.slice(from, from + size), next));
  };
}

describe('reading follows', () => {
  it('pages until there is no cursor, newest first, and numbers them so the oldest is 0', async () => {
    const all = Array.from({ length: 5 }, (_, i) => person(i + 1)); // as the server gives them: newest first
    const f = mockBluesky({ [`GET ${PUBLIC}/app.bsky.graph.getFollows*`]: paged('follows', all, 2, (items, cursor) => ({ follows: items, cursor })) });
    const items = await readFollows(ME);
    expect(items).toHaveLength(5);
    expect(f.calls).toHaveLength(3);
    expect(q(f.calls[0] as Req, 'limit')).toBe('100');
    expect(items[0]).toEqual({
      itemId: `person:${did(101)}`,
      kind: 'person',
      title: 'Person 1',
      thumbnailUrl: AV,
      data: JSON.stringify({ did: did(101), handle: 'p1.bsky.social', seq: 4 }),
    });
    expect(items.map((i) => JSON.parse(i.data!).seq)).toEqual([4, 3, 2, 1, 0]);
  });

  it('uses the handle as the title when there is no display name, and drops a picture off the picture host', async () => {
    mockBluesky({ [`GET ${PUBLIC}/app.bsky.graph.getFollows*`]: json({ follows: [person(1, { displayName: '', avatar: 'https://evil.example/a.jpg' })] }) });
    const [one] = await readFollows(ME);
    expect(one).toMatchObject({ title: 'p1.bsky.social', thumbnailUrl: null });
  });

  it('drops an entry that is not an account ID of the right shape, and keeps the rest', async () => {
    mockBluesky({ [`GET ${PUBLIC}/app.bsky.graph.getFollows*`]: json({ follows: [person(1), { did: 'did:web:x', handle: 'x' }, { did: 5 }, null, person(2)] }) });
    expect((await readFollows(ME)).map((i) => i.title)).toEqual(['Person 1', 'Person 2']);
  });

  it('fails when a page is the wrong shape, and says retry when there is no network, later when it is limited', async () => {
    mockBluesky({ [`GET ${PUBLIC}/app.bsky.graph.getFollows*`]: json({ follows: 'no' }) });
    await expect(readFollows(ME)).rejects.toThrow();
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    await expect(readFollows(ME)).rejects.toEqual(new DriverError('retry'));
    mockBluesky({ [`GET ${PUBLIC}/app.bsky.graph.getFollows*`]: { status: 429, json: {} } });
    await expect(readFollows(ME)).rejects.toEqual(new DriverError('later'));
  });
});

describe('reading blocks', () => {
  const rec = (n: number) => ({ uri: `at://${ME}/app.bsky.graph.block/${n}`, value: { subject: did(200 + n), createdAt: `2026-01-0${n}T00:00:00Z` } });

  it('reads the public records from the account server, oldest first, and names the people 25 at a time', async () => {
    const records = Array.from({ length: 30 }, (_, i) => rec(i % 9 + 1)).map((r, i) => ({ ...r, value: { ...r.value, subject: did(200 + i) } }));
    const f = mockBluesky({
      [`GET ${SERVER}/xrpc/com.atproto.repo.listRecords*`]: paged('records', records, 100, (items, cursor) => ({ records: items, cursor })),
      [`GET ${PUBLIC}/app.bsky.actor.getProfiles*`]: (r) => json({ profiles: new URL(r.url).searchParams.getAll('actors').map((d, i) => ({ did: d, handle: `b${i}.bsky.social`, displayName: `Blocked ${d.slice(-3)}` })) }),
    });
    const items = await readBlocks(ME, SERVER);
    expect(items).toHaveLength(30);
    const list = f.callsTo('GET', `${SERVER}/xrpc/com.atproto.repo.listRecords`)[0];
    expect(q(list, 'collection')).toBe('app.bsky.graph.block');
    expect(q(list, 'repo')).toBe(ME);
    expect(q(list, 'reverse')).toBe('true');
    const lookups = f.callsTo('GET', `${PUBLIC}/app.bsky.actor.getProfiles`);
    expect(lookups.map((c) => new URL(c.url).searchParams.getAll('actors').length)).toEqual([25, 5]);
    expect(items.map((i) => JSON.parse(i.data!).seq)).toEqual(Array.from({ length: 30 }, (_, i) => i));
    expect(items[0]).toMatchObject({ kind: 'block', itemId: `block:${did(200)}` });
  });

  it('leaves out a blocked account the app view no longer knows', async () => {
    mockBluesky({
      [`GET ${SERVER}/xrpc/com.atproto.repo.listRecords*`]: json({ records: [rec(1), rec(2)] }),
      [`GET ${PUBLIC}/app.bsky.actor.getProfiles*`]: json({ profiles: [{ did: did(201), handle: 'b1.bsky.social' }] }),
    });
    expect((await readBlocks(ME, SERVER)).map((i) => i.itemId)).toEqual([`block:${did(201)}`]);
  });

  it('refuses a server that is not a Bluesky server, and makes no call to it', async () => {
    const f = mockBluesky({});
    await expect(readBlocks(ME, 'https://pds.example.com')).rejects.toThrow();
    expect(f.calls).toHaveLength(0);
  });

  it('drops a record whose subject is not an account ID of the right shape', async () => {
    mockBluesky({
      [`GET ${SERVER}/xrpc/com.atproto.repo.listRecords*`]: json({ records: [{ uri: 'x', value: { subject: 'did:web:x' } }, rec(1), { value: null }] }),
      [`GET ${PUBLIC}/app.bsky.actor.getProfiles*`]: (r) => json({ profiles: new URL(r.url).searchParams.getAll('actors').map((d) => ({ did: d, handle: 'b.bsky.social' })) }),
    });
    expect(await readBlocks(ME, SERVER)).toHaveLength(1);
  });
});

describe('reading lists', () => {
  const list = (n: number, purpose = 'app.bsky.graph.defs#curatelist', extra: Record<string, unknown> = {}) => ({
    uri: `at://${ME}/app.bsky.graph.list/${n}`,
    name: `List ${n}`,
    purpose,
    description: `About ${n}`,
    avatar: AV,
    indexedAt: `2026-01-0${n}T00:00:00Z`,
    ...extra,
  });
  const member = (n: number) => ({ uri: `at://x/app.bsky.graph.listitem/${n}`, subject: person(n) });

  it('reads people lists and moderation lists with their members, paged, oldest first', async () => {
    const members = Array.from({ length: 5 }, (_, i) => member(i + 1));
    mockBluesky({
      [`GET ${PUBLIC}/app.bsky.graph.getLists*`]: json({ lists: [list(2, 'app.bsky.graph.defs#modlist'), list(1)] }),
      [`GET ${PUBLIC}/app.bsky.graph.getList*`]: paged('items', members, 2, (items, cursor) => ({ items, cursor })),
    });
    const items = await readLists(ME);
    expect(items.map((i) => i.title)).toEqual(['List 2', 'List 1']);
    const data = items.map((i) => JSON.parse(i.data!));
    expect(data[1]).toEqual({ purpose: 'curatelist', description: 'About 1', members: [did(101), did(102), did(103), did(104), did(105)], seq: 0 });
    expect(data[0]).toMatchObject({ purpose: 'modlist', seq: 1 });
    expect(items[1]).toMatchObject({ itemId: `list:at://${ME}/app.bsky.graph.list/1`, kind: 'list', thumbnailUrl: AV });
  });

  it('skips lists of other purposes, and leaves out members that are not accounts of the right shape', async () => {
    mockBluesky({
      [`GET ${PUBLIC}/app.bsky.graph.getLists*`]: json({ lists: [list(1, 'app.bsky.graph.defs#referencelist'), list(2)] }),
      [`GET ${PUBLIC}/app.bsky.graph.getList*`]: json({ items: [member(1), { subject: { did: 'did:web:x', handle: 'x' } }, { subject: null }] }),
    });
    const items = await readLists(ME);
    expect(items).toHaveLength(1);
    expect(JSON.parse(items[0].data!).members).toEqual([did(101)]);
  });

  it('refuses a list whose address is not one of this account', async () => {
    mockBluesky({
      [`GET ${PUBLIC}/app.bsky.graph.getLists*`]: json({ lists: [list(1, undefined, { uri: 'https://evil.example/list' }), list(2, undefined, { uri: `at://${did(9)}/app.bsky.graph.list/1` })] }),
      [`GET ${PUBLIC}/app.bsky.graph.getList*`]: json({ items: [] }),
    });
    expect(await readLists(ME)).toEqual([]);
  });
});

describe('what the new account already has', () => {
  it('lists the follows and the blocks it has, and counts the new account itself as there', async () => {
    const f = mockBluesky({
      [`GET ${PUBLIC}/app.bsky.graph.getFollows*`]: json({ follows: [person(1), person(2)] }),
      [`GET ${SERVER}/xrpc/com.atproto.repo.listRecords*`]: json({ records: [{ uri: 'u', value: { subject: did(201) } }] }),
    });
    const have = await haveOnNew(ME, SERVER);
    expect([...have].sort()).toEqual([`block:${did(201)}`, `block:${ME}`, `person:${did(101)}`, `person:${did(102)}`, `person:${ME}`].sort());
    expect(f.calls.every((c) => c.method === 'GET')).toBe(true);
    expect(f.calls.every((c) => c.auth === null)).toBe(true);
  });
});


// ---- Writes -------------------------------------------------------------------------------------------------

// The signed-in fetch of a session: it sends the request to the account's server.
const signedIn = (path: string, init?: RequestInit) => fetch(`${SERVER}${path}`, init);
const CREATE = `POST ${SERVER}/xrpc/com.atproto.repo.createRecord`;
const created = (f: ReturnType<typeof mockBluesky>) => f.callsTo('POST', `${SERVER}/xrpc/com.atproto.repo.createRecord`).map((c) => c.body as { repo: string; collection: string; record: Record<string, unknown> });
const NEW_ME = did(7);

describe('adding a follow and a block', () => {
  it('writes a follow record in the account of the new account', async () => {
    const f = mockBluesky({ [CREATE]: json({ uri: 'at://x', cid: 'c' }) });
    expect(await followPerson(signedIn, NEW_ME, did(101))).toEqual({ kind: 'moved' });
    const [call] = created(f);
    expect(call).toMatchObject({ repo: NEW_ME, collection: 'app.bsky.graph.follow', record: { $type: 'app.bsky.graph.follow', subject: did(101) } });
    expect(new Date(call.record.createdAt as string).toISOString()).toBe(call.record.createdAt);
  });

  it('writes a block record the same way', async () => {
    const f = mockBluesky({ [CREATE]: json({ uri: 'at://x' }) });
    expect(await blockPerson(signedIn, NEW_ME, did(101))).toEqual({ kind: 'moved' });
    expect(created(f)[0]).toMatchObject({ collection: 'app.bsky.graph.block', record: { $type: 'app.bsky.graph.block', subject: did(101) } });
  });
});

describe('the answer to an add', () => {
  const now = () => Math.floor(Date.now() / 1000);
  const answer = (status: number, error?: string, headers: Record<string, string> = {}) =>
    mapAnswer({ status, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } }, error ? { error, message: 'x' } : null);

  it.each([
    [200, undefined, { kind: 'moved' }],
    [401, undefined, { kind: 'auth' }],
    [400, 'ExpiredToken', { kind: 'auth' }],
    [400, 'InvalidToken', { kind: 'auth' }],
    [400, 'InvalidRecord', { kind: 'couldnt_move', reason: "Bluesky didn't allow this one." }],
    [400, 'InvalidRequest', { kind: 'couldnt_move', reason: "Bluesky didn't allow this one." }],
    [403, undefined, { kind: 'couldnt_move', reason: "Magpie doesn't have access for this." }],
    [404, 'NotFound', { kind: 'couldnt_move', reason: 'Account was deleted.' }],
    [500, undefined, { kind: 'retry' }],
    [502, undefined, { kind: 'retry' }],
    [418, undefined, { kind: 'couldnt_move', reason: "Bluesky didn't allow this one." }],
  ])('maps %s %s', (status, error, outcome) => {
    expect(answer(status, error)).toEqual(outcome);
  });

  it.each(['AccountTakedown', 'AccountDeactivated', 'RepoTakendown', 'RepoDeactivated'])('stops and says the account was paused for %s', (error) => {
    expect(answer(400, error)).toEqual({ kind: 'stop', notice: "Bluesky paused your account's activity. Try again later." });
  });

  it('waits when Bluesky says to try again within a minute', () => {
    const out = answer(429, 'RateLimitExceeded', { 'ratelimit-reset': String(now() + 30) });
    expect(out).toMatchObject({ kind: 'wait' });
    expect((out as { ms: number }).ms).toBeGreaterThan(20_000);
    expect((out as { ms: number }).ms).toBeLessThanOrEqual(31_000);
  });

  it('stops with the time Bluesky gave when it is more than a minute away', () => {
    const at = now() + 1200;
    expect(answer(429, 'RateLimitExceeded', { 'ratelimit-reset': String(at) })).toEqual({ kind: 'later', resumeAt: at * 1000 });
  });

  it('stops for an hour when Bluesky gives no time, or a time that makes no sense', () => {
    const hour = (r: unknown) => (r as { resumeAt: number }).resumeAt - Date.now();
    expect(answer(429)).toMatchObject({ kind: 'later' });
    expect(hour(answer(429))).toBeGreaterThan(3_590_000);
    expect(hour(answer(429, undefined, { 'ratelimit-reset': 'soon' }))).toBeGreaterThan(3_590_000);
  });

  it('never shows the error text that Bluesky sent', () => {
    const out = answer(400, 'InvalidRecord');
    expect(JSON.stringify(out)).not.toMatch(/InvalidRecord|message/);
  });
});

describe('adding a follow when something goes wrong', () => {
  it('says retry when there is no network, and auth when the sign-in cannot be refreshed', async () => {
    const offline = async () => {
      throw new TypeError('Network request failed');
    };
    expect(await followPerson(offline, NEW_ME, did(101))).toEqual({ kind: 'retry' });
    for (const name of ['TokenRefreshError', 'TokenRevokedError', 'TokenInvalidError']) {
      const dead = async () => {
        throw Object.assign(new Error('x'), { name });
      };
      expect(await followPerson(dead, NEW_ME, did(101))).toEqual({ kind: 'auth' });
    }
  });

  it('maps a rate limit answer of the signed-in call', async () => {
    mockBluesky({ [CREATE]: { status: 429, headers: { 'ratelimit-reset': String(Math.floor(Date.now() / 1000) + 5) }, json: { error: 'RateLimitExceeded' } } });
    expect(await followPerson(signedIn, NEW_ME, did(101))).toMatchObject({ kind: 'wait' });
  });
});

describe('adding a list', () => {
  const stored = (members: string[], over: Record<string, unknown> = {}): StoredItem => ({
    itemId: `list:at://${ME}/app.bsky.graph.list/1`,
    kind: 'list',
    title: 'Cats',
    thumbnailUrl: null,
    data: JSON.stringify({ purpose: 'curatelist', description: 'Good cats', members, seq: 0, ...over }),
    picked: true,
    status: 'waiting',
    reason: null,
  });
  const members = [did(101), did(102), did(103)];
  const pacer = (answers: ({ wait: number } | { later: number })[] = []): Pacer & { calls: number } => {
    const p = { calls: 0, async beforeAdd() { p.calls += 1; return answers.shift() ?? { wait: 0 }; } };
    return p;
  };
  const empty = { [`GET ${PUBLIC}/app.bsky.graph.getLists*`]: json({ lists: [] }) };
  const items = (f: ReturnType<typeof mockBluesky>) => created(f).filter((c) => c.collection === 'app.bsky.graph.listitem');

  it('makes the list with the same name, description, and purpose, then one record per member, each after the pace', async () => {
    const f = mockBluesky({ ...empty, [CREATE]: (r) => json({ uri: `at://${NEW_ME}/${(r.body as { collection: string }).collection}/1`, cid: 'c' }) });
    const p = pacer();
    expect(await addList(signedIn, NEW_ME, stored(members), p)).toEqual({ kind: 'moved' });
    expect(created(f)[0]).toMatchObject({ collection: 'app.bsky.graph.list', record: { $type: 'app.bsky.graph.list', purpose: 'app.bsky.graph.defs#curatelist', name: 'Cats', description: 'Good cats' } });
    expect(items(f).map((c) => c.record.subject)).toEqual(members);
    expect(items(f).every((c) => c.record.list === `at://${NEW_ME}/app.bsky.graph.list/1`)).toBe(true);
    expect(p.calls).toBe(3);
  });

  it('makes a moderation list with the moderation purpose', async () => {
    const f = mockBluesky({ ...empty, [CREATE]: json({ uri: `at://${NEW_ME}/app.bsky.graph.list/1` }) });
    await addList(signedIn, NEW_ME, stored([], { purpose: 'modlist' }));
    expect(created(f)[0].record.purpose).toBe('app.bsky.graph.defs#modlist');
  });

  it('reuses a list with the same name and purpose, and adds only the members that are not in it', async () => {
    const mine = `at://${NEW_ME}/app.bsky.graph.list/9`;
    const f = mockBluesky({
      [`GET ${PUBLIC}/app.bsky.graph.getLists*`]: json({ lists: [{ uri: mine, name: 'Cats', purpose: 'app.bsky.graph.defs#curatelist' }, { uri: `at://${NEW_ME}/app.bsky.graph.list/8`, name: 'Cats', purpose: 'app.bsky.graph.defs#modlist' }] }),
      [`GET ${PUBLIC}/app.bsky.graph.getList*`]: json({ items: [{ subject: person(2) }] }),
      [CREATE]: json({ uri: 'at://x' }),
    });
    expect(await addList(signedIn, NEW_ME, stored(members))).toEqual({ kind: 'moved' });
    expect(created(f).some((c) => c.collection === 'app.bsky.graph.list')).toBe(false);
    expect(items(f).map((c) => c.record.subject)).toEqual([did(101), did(103)]);
    expect(items(f).every((c) => c.record.list === mine)).toBe(true);
  });

  it('stops with later when the pace says so, and writes no more members', async () => {
    const f = mockBluesky({ ...empty, [CREATE]: json({ uri: `at://${NEW_ME}/app.bsky.graph.list/1` }) });
    const out = await addList(signedIn, NEW_ME, stored(members), pacer([{ wait: 0 }, { wait: 0 }, { later: 99_000 }]));
    expect(out).toEqual({ kind: 'later', resumeAt: 99_000 });
    expect(items(f)).toHaveLength(2);
  });

  it('leaves out the members that Bluesky does not allow, and says how many', async () => {
    let n = 0;
    mockBluesky({
      ...empty,
      [CREATE]: (r) => {
        const collection = (r.body as { collection: string }).collection;
        if (collection === 'app.bsky.graph.list') return json({ uri: `at://${NEW_ME}/app.bsky.graph.list/1` });
        n += 1;
        return n === 2 ? { status: 400, json: { error: 'InvalidRecord' } } : json({ uri: 'at://x' });
      },
    });
    expect(await addList(signedIn, NEW_ME, stored(members))).toEqual({ kind: 'moved', reason: '1 left out' });
  });

  it('returns the outcome of a list that could not be made, and of a member that needs a stop or a sign-in', async () => {
    mockBluesky({ ...empty, [CREATE]: { status: 403, json: {} } });
    expect(await addList(signedIn, NEW_ME, stored(members))).toMatchObject({ kind: 'couldnt_move' });
    mockBluesky({ ...empty, [CREATE]: (r) => ((r.body as { collection: string }).collection === 'app.bsky.graph.list' ? json({ uri: `at://${NEW_ME}/app.bsky.graph.list/1` }) : { status: 401, json: {} }) });
    expect(await addList(signedIn, NEW_ME, stored(members))).toEqual({ kind: 'auth' });
  });

  it('says it could not move a list whose saved data is wrong, and writes nothing', async () => {
    const f = mockBluesky({ ...empty, [CREATE]: json({}) });
    expect(await addList(signedIn, NEW_ME, { ...stored(members), data: '{"purpose":"x"}' })).toMatchObject({ kind: 'couldnt_move' });
    expect(await addList(signedIn, NEW_ME, { ...stored(members), data: null })).toMatchObject({ kind: 'couldnt_move' });
    expect(f.calls).toHaveLength(0);
  });

  it('never deletes or changes anything', async () => {
    const f = mockBluesky({ ...empty, [CREATE]: json({ uri: `at://${NEW_ME}/app.bsky.graph.list/1` }) });
    await addList(signedIn, NEW_ME, stored(members));
    expect(f.calls.every((c) => c.method === 'GET' || c.url.endsWith('createRecord'))).toBe(true);
  });
});


// ---- Mutes and saved feeds (private: they need a session) -----------------------------------------------------

const PROXY = 'did:web:api.bsky.app#bsky_appview';
const PREFS_GET = `GET ${SERVER}/xrpc/app.bsky.actor.getPreferences`;
const PREFS_PUT = `POST ${SERVER}/xrpc/app.bsky.actor.putPreferences`;
const SAVED = 'app.bsky.actor.defs#savedFeedsPrefV2';
const feedUri = (n: number) => `at://${did(50 + n)}/app.bsky.feed.generator/f${n}`;
const savedPref = (items: unknown[]) => ({ $type: SAVED, items });
const feedItem = (n: number, pinned = false, type = 'feed') => ({ type, value: type === 'list' ? `at://${did(50 + n)}/app.bsky.graph.list/l${n}` : feedUri(n), pinned, id: `id${n}` });
const puts = (f: ReturnType<typeof mockBluesky>) => f.callsTo('POST', `${SERVER}/xrpc/app.bsky.actor.putPreferences`).map((c) => (c.body as { preferences: Record<string, unknown>[] }).preferences);

describe('reading mutes', () => {
  it('pages the muted people through the session with the proxy header, newest first, and numbers them so the oldest is 0', async () => {
    const all = Array.from({ length: 3 }, (_, i) => person(i + 1));
    const f = mockBluesky({ [`GET ${SERVER}/xrpc/app.bsky.graph.getMutes*`]: paged('mutes', all, 2, (items, cursor) => ({ mutes: items, cursor })) });
    const items = await readMutes(signedIn);
    expect(f.calls).toHaveLength(2);
    expect(f.calls.every((c) => c.headers['atproto-proxy'] === PROXY)).toBe(true);
    expect(items.map((i) => [i.itemId, JSON.parse(i.data!).seq])).toEqual([[`mute:${did(101)}`, 2], [`mute:${did(102)}`, 1], [`mute:${did(103)}`, 0]]);
    expect(items[0]).toMatchObject({ kind: 'mute', title: 'Person 1', thumbnailUrl: AV });
  });

  it('says auth when the session cannot read, and drops entries that are not accounts', async () => {
    mockBluesky({ [`GET ${SERVER}/xrpc/app.bsky.graph.getMutes*`]: { status: 401, json: {} } });
    await expect(readMutes(signedIn)).rejects.toEqual(new DriverError('auth'));
    mockBluesky({ [`GET ${SERVER}/xrpc/app.bsky.graph.getMutes*`]: json({ mutes: [person(1), { did: 'did:web:x', handle: 'x' }, null] }) });
    expect(await readMutes(signedIn)).toHaveLength(1);
  });
});

describe('reading saved feeds', () => {
  it('takes only the saved feeds part, skips the timeline, names feeds and lists, keeps the saved order, and drops every other setting', async () => {
    const f = mockBluesky({
      [PREFS_GET]: json({
        preferences: [
          { $type: 'app.bsky.actor.defs#adultContentPref', enabled: true },
          { $type: 'app.bsky.actor.defs#mutedWordsPref', items: [{ value: 'secret word' }] },
          savedPref([{ type: 'timeline', value: 'following', pinned: true, id: 't' }, feedItem(1, true), feedItem(2, false), feedItem(3, true, 'list')]),
        ],
      }),
      [`GET ${PUBLIC}/app.bsky.feed.getFeedGenerators*`]: json({ feeds: [{ uri: feedUri(1), displayName: 'Cats', avatar: AV }, { uri: feedUri(2), displayName: 'Dogs' }] }),
      [`GET ${PUBLIC}/app.bsky.graph.getList*`]: json({ list: { uri: 'x', name: 'Birds', avatar: AV }, items: [] }),
    });
    const items = await readFeeds(signedIn);
    expect(items.map((i) => [i.itemId, i.title, JSON.parse(i.data!)])).toEqual([
      [`feed:${feedUri(1)}`, 'Cats', { type: 'feed', value: feedUri(1), pinned: true, seq: 0 }],
      [`feed:${feedUri(2)}`, 'Dogs', { type: 'feed', value: feedUri(2), pinned: false, seq: 1 }],
      [`feed:at://${did(53)}/app.bsky.graph.list/l3`, 'Birds', { type: 'list', value: `at://${did(53)}/app.bsky.graph.list/l3`, pinned: true, seq: 2 }],
    ]);
    expect(JSON.stringify(items)).not.toMatch(/secret word|adultContent/);
    expect(f.callsTo('GET', PREFS_GET.slice(4))[0].headers['atproto-proxy']).toBe(PROXY);
  });

  it('uses the end of the address as the name of a feed that no longer exists, and finds no feeds when none are saved', async () => {
    mockBluesky({
      [PREFS_GET]: json({ preferences: [savedPref([feedItem(1)])] }),
      [`GET ${PUBLIC}/app.bsky.feed.getFeedGenerators*`]: json({ feeds: [] }),
    });
    expect((await readFeeds(signedIn))[0].title).toBe('f1');
    mockBluesky({ [PREFS_GET]: json({ preferences: [] }) });
    expect(await readFeeds(signedIn)).toEqual([]);
  });

  it('drops a feed whose address is not one of an account', async () => {
    mockBluesky({
      [PREFS_GET]: json({ preferences: [savedPref([{ type: 'feed', value: 'https://evil.example/x', pinned: false, id: 'z' }, feedItem(1)])] }),
      [`GET ${PUBLIC}/app.bsky.feed.getFeedGenerators*`]: json({ feeds: [] }),
    });
    expect(await readFeeds(signedIn)).toHaveLength(1);
  });
});

describe('muting a person', () => {
  it('posts the mute with the proxy header', async () => {
    const f = mockBluesky({ [`POST ${SERVER}/xrpc/app.bsky.graph.muteActor`]: { status: 200 } });
    expect(await muteActor(signedIn, did(101))).toEqual({ kind: 'moved' });
    const [call] = f.calls;
    expect(call.body).toEqual({ actor: did(101) });
    expect(call.headers['atproto-proxy']).toBe(PROXY);
  });

  it('maps a missing account to a plain reason', async () => {
    mockBluesky({ [`POST ${SERVER}/xrpc/app.bsky.graph.muteActor`]: { status: 404, json: { error: 'NotFound' } } });
    expect(await muteActor(signedIn, did(101))).toEqual({ kind: 'couldnt_move', reason: 'Account was deleted.' });
  });
});

describe('adding a saved feed', () => {
  const stored = (n: number, pinned: boolean, type = 'feed'): StoredItem => ({
    itemId: `feed:${feedItem(n, pinned, type).value}`,
    kind: 'feed',
    title: `Feed ${n}`,
    thumbnailUrl: null,
    data: JSON.stringify({ type, value: feedItem(n, pinned, type).value, pinned, seq: n }),
    picked: true,
    status: 'waiting',
    reason: null,
  });
  const other = [{ $type: 'app.bsky.actor.defs#adultContentPref', enabled: false }, { $type: 'app.bsky.actor.defs#mutedWordsPref', items: [{ value: 'x', targets: ['content'] }] }];

  it('reads the settings right before the write, adds the feed with its pin, and writes every other setting back unchanged', async () => {
    const f = mockBluesky({ [PREFS_GET]: json({ preferences: [...other, savedPref([feedItem(9, true)])] }), [PREFS_PUT]: { status: 200 } });
    expect(await addFeed(signedIn, stored(1, false))).toEqual({ kind: 'moved' });
    const [written] = puts(f);
    expect(written.slice(0, 2)).toEqual(other);
    const items = (written[2] as { items: Record<string, unknown>[] }).items;
    expect(items.map((i) => i.value)).toEqual([feedItem(9).value, feedUri(1)]);
    expect(items[1]).toMatchObject({ type: 'feed', value: feedUri(1), pinned: false });
    expect(typeof items[1].id).toBe('string');
    expect(items[1].id).not.toBe('id9');
    // The read came before the write, in this order, with the proxy header on both.
    expect(f.calls.map((c) => c.method)).toEqual(['GET', 'POST']);
    expect(f.calls.every((c) => c.headers['atproto-proxy'] === PROXY)).toBe(true);
  });

  it("puts a pinned feed after the new account's own pinned feeds and before the unpinned ones", async () => {
    const f = mockBluesky({ [PREFS_GET]: json({ preferences: [savedPref([feedItem(8, true), feedItem(9, true), feedItem(7, false)])] }), [PREFS_PUT]: { status: 200 } });
    await addFeed(signedIn, stored(1, true));
    const items = (puts(f)[0][0] as { items: { value: string }[] }).items;
    expect(items.map((i) => i.value)).toEqual([feedUri(8), feedUri(9), feedUri(1), feedUri(7)]);
  });

  it('keeps the old pin order when several feeds are added one after the other', async () => {
    let current = [feedItem(9, true)];
    mockBluesky({
      [PREFS_GET]: () => json({ preferences: [savedPref(current)] }),
      [PREFS_PUT]: (r) => {
        current = ((r.body as { preferences: { items: typeof current }[] }).preferences[0]).items;
        return { status: 200 };
      },
    });
    for (const n of [1, 2, 3]) await addFeed(signedIn, stored(n, true));
    expect(current.map((i) => i.value)).toEqual([feedUri(9), feedUri(1), feedUri(2), feedUri(3)]);
  });

  it('leaves a feed the new account already saves as it is, with no write', async () => {
    const f = mockBluesky({ [PREFS_GET]: json({ preferences: [savedPref([feedItem(1, false)])] }), [PREFS_PUT]: { status: 200 } });
    expect(await addFeed(signedIn, stored(1, true))).toEqual({ kind: 'moved' });
    expect(puts(f)).toEqual([]);
  });

  it('makes the saved feeds setting when the new account has none, and never writes fewer settings than it read', async () => {
    const f = mockBluesky({ [PREFS_GET]: json({ preferences: other }), [PREFS_PUT]: { status: 200 } });
    await addFeed(signedIn, stored(1, false));
    const [written] = puts(f);
    expect(written).toHaveLength(3);
    expect(written.slice(0, 2)).toEqual(other);
    expect((written[2] as { $type: string }).$type).toBe(SAVED);
  });

  it('writes nothing when the settings cannot be read, and gives the outcome of the failed read', async () => {
    const f = mockBluesky({ [PREFS_GET]: { status: 500, json: {} }, [PREFS_PUT]: { status: 200 } });
    expect(await addFeed(signedIn, stored(1, false))).toEqual({ kind: 'retry' });
    mockBluesky({ [PREFS_GET]: { status: 401, json: {} } });
    expect(await addFeed(signedIn, stored(1, false))).toEqual({ kind: 'auth' });
    expect(puts(f)).toEqual([]);
  });

  it('maps a rate limit on the write, and says it could not move a feed whose saved data is wrong, with no call', async () => {
    mockBluesky({ [PREFS_GET]: json({ preferences: [] }), [PREFS_PUT]: { status: 429, headers: { 'ratelimit-reset': String(Math.floor(Date.now() / 1000) + 5) }, json: {} } });
    expect(await addFeed(signedIn, stored(1, false))).toMatchObject({ kind: 'wait' });
    const f = mockBluesky({});
    expect(await addFeed(signedIn, { ...stored(1, false), data: '{"type":"x"}' })).toMatchObject({ kind: 'couldnt_move' });
    expect(f.calls).toHaveLength(0);
  });
});

describe('what the new account already has: mutes and feeds', () => {
  it('adds muted people and saved feeds when the new account was granted those kinds', async () => {
    mockBluesky({
      [`GET ${PUBLIC}/app.bsky.graph.getFollows*`]: json({ follows: [] }),
      [`GET ${SERVER}/xrpc/com.atproto.repo.listRecords*`]: json({ records: [] }),
      [`GET ${SERVER}/xrpc/app.bsky.graph.getMutes*`]: json({ mutes: [person(1)] }),
      [PREFS_GET]: json({ preferences: [savedPref([feedItem(2), { type: 'timeline', value: 'following', pinned: true, id: 't' }])] }),
    });
    const have = await haveOnNew(ME, SERVER, { fetch: signedIn, kinds: ['mute', 'feed'] });
    expect(have.has(`mute:${did(101)}`)).toBe(true);
    expect(have.has(`feed:${feedUri(2)}`)).toBe(true);
    expect([...have].some((id) => id.includes('following'))).toBe(false);
  });

  it('does not read them when the new account has no access for them', async () => {
    const f = mockBluesky({ [`GET ${PUBLIC}/app.bsky.graph.getFollows*`]: json({ follows: [] }), [`GET ${SERVER}/xrpc/com.atproto.repo.listRecords*`]: json({ records: [] }) });
    await haveOnNew(ME, SERVER, { fetch: signedIn, kinds: ['person', 'block'] });
    expect(f.calls.some((c) => /getMutes|getPreferences/.test(c.url))).toBe(false);
  });
});
