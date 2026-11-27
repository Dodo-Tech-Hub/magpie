import {
  addRepoToList,
  findOrCreateList,
  followPerson,
  listGists,
  listLists,
  listPeople,
  listStars,
  mapAnswer,
  readMyLists,
  starGist,
  starRepo,
  type UserList,
} from '@/api/github';
import { DriverError } from '@/platforms/driver';
import { mockGithub, noContent } from '../mocks/githubFetch';

const API = 'https://api.github.com';
const h = (o: Record<string, string> = {}) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
const AV = 'https://avatars.githubusercontent.com/u/1';

beforeEach(() => jest.useFakeTimers().setSystemTime(1_000_000));
afterEach(() => jest.useRealTimers());

const repo = (id: number) => ({ id, full_name: `o/r${id}`, node_id: `N${id}`, owner: { avatar_url: AV } });
const page = (n: number, from = 1) => Array.from({ length: n }, (_, i) => repo(from + i));

describe('reading with paging', () => {
  it('reads stars 100 at a time until a page has fewer than 100', async () => {
    const gh = mockGithub({
      [`GET ${API}/user/starred?per_page=100&page=1`]: { json: page(100) },
      [`GET ${API}/user/starred?per_page=100&page=2`]: { json: page(100, 101) },
      [`GET ${API}/user/starred?per_page=100&page=3`]: { json: page(20, 201) },
    });
    const items = await listStars('tok');
    expect(items).toHaveLength(220);
    expect(gh.calls).toHaveLength(3);
    expect(items[0]).toEqual({
      itemId: 'repo:1',
      kind: 'repo',
      title: 'o/r1',
      thumbnailUrl: AV,
      data: JSON.stringify({ fullName: 'o/r1', nodeId: 'N1' }),
    });
  });

  it('reads people and gists into their kinds', async () => {
    mockGithub({
      [`GET ${API}/user/following`]: { json: [{ id: 7, login: 'bob', avatar_url: AV }] },
      [`GET ${API}/gists/starred`]: {
        json: [
          { id: 'g1', description: 'My gist', owner: { avatar_url: AV } },
          { id: 'g2', description: '', files: { 'a.txt': {} } },
          { id: 'g3', files: {} },
        ],
      },
    });
    expect(await listPeople('t')).toEqual([
      { itemId: 'person:7', kind: 'person', title: 'bob', thumbnailUrl: AV, data: '{"login":"bob"}' },
    ]);
    const gists = await listGists('t');
    expect(gists.map((g) => [g.itemId, g.title, g.data])).toEqual([
      ['gist:g1', 'My gist', '{"gistId":"g1"}'],
      ['gist:g2', 'a.txt', '{"gistId":"g2"}'],
      ['gist:g3', 'g3', '{"gistId":"g3"}'],
    ]);
  });

  it('skips an item of the wrong shape and drops a picture from outside GitHub', async () => {
    mockGithub({
      [`GET ${API}/user/starred`]: { json: [{ id: 'x' }, null, { ...repo(2), owner: { avatar_url: 'https://evil.example/a' } }] },
    });
    const items = await listStars('t');
    expect(items).toHaveLength(1);
    expect(items[0].thumbnailUrl).toBeNull();
  });

  it('rejects an answer that is not a list', async () => {
    mockGithub({ [`GET ${API}/user/starred`]: { json: { message: 'hi' } } });
    await expect(listStars('t')).rejects.toBeInstanceOf(DriverError);
  });

  it('turns failed reads into driver errors', async () => {
    mockGithub({
      [`GET ${API}/user/starred`]: { status: 401, json: {} },
      [`GET ${API}/user/following`]: { status: 403, json: {} },
      [`GET ${API}/gists/starred`]: { status: 500, json: {} },
    });
    await expect(listStars('t')).rejects.toEqual(new DriverError('auth'));
    await expect(listPeople('t')).rejects.toEqual(new DriverError('later'));
    await expect(listGists('t')).rejects.toEqual(new DriverError('retry'));
  });

  it('sends the three headers on every call', async () => {
    const gh = mockGithub({ [`GET ${API}/user/following`]: { json: [] } });
    await listPeople('secret');
    expect(gh.calls[0].auth).toBe('Bearer secret');
    expect(gh.calls[0].headers.accept).toBe('application/vnd.github+json');
    expect(gh.calls[0].headers['x-github-api-version']).toBe('2022-11-28');
  });
});

const node = (id: string, dbId: number) => ({ id, databaseId: dbId });
const list = (id: string, name: string, repos: [string, number][], more?: string) => ({
  id,
  name,
  description: `${name} d`,
  isPrivate: false,
  items: {
    pageInfo: { hasNextPage: !!more, endCursor: more ?? null },
    nodes: repos.map(([i, d]) => node(i, d)),
  },
});
const gql = (nodes: unknown[], next?: string) => ({
  json: { data: { viewer: { lists: { pageInfo: { hasNextPage: !!next, endCursor: next ?? null }, nodes } } } },
});

describe('star lists', () => {
  it('reads lists by cursor and each list\'s repositories, also past 100', async () => {
    const gh = mockGithub({
      [`POST ${API}/graphql`]: (req) => {
        const v = (req.body as { variables: Record<string, string | null> }).variables;
        if (v.id === 'L1') {
          return { json: { data: { node: { items: { pageInfo: { hasNextPage: false }, nodes: [node('N3', 3)] } } } } };
        }
        return v.after === null
          ? gql([list('L1', 'Work', [['N1', 1], ['N2', 2]], 'c1')], 'p2')
          : gql([list('L2', 'Fun', [])]);
      },
    });
    const lists = await readMyLists('t');
    expect(lists.map((l) => [l.id, l.name, l.repoItemIds, l.repoNodeIds])).toEqual([
      ['L1', 'Work', ['repo:1', 'repo:2', 'repo:3'], ['N1', 'N2', 'N3']],
      ['L2', 'Fun', [], []],
    ]);
    expect(gh.calls).toHaveLength(3);
  });

  it('turns lists into items with the repositories in data', async () => {
    mockGithub({ [`POST ${API}/graphql`]: gql([list('L1', 'Work', [['N1', 1]])]) });
    expect(await listLists('t')).toEqual([
      {
        itemId: 'list:L1',
        kind: 'list',
        title: 'Work',
        thumbnailUrl: null,
        data: JSON.stringify({ description: 'Work d', isPrivate: false, repoItemIds: ['repo:1'] }),
      },
    ]);
  });

  it('rejects an answer of the wrong shape or with errors', async () => {
    mockGithub({ [`POST ${API}/graphql`]: { json: { data: { viewer: {} } } } });
    await expect(readMyLists('t')).rejects.toBeInstanceOf(DriverError);
    mockGithub({ [`POST ${API}/graphql`]: { json: { errors: [{ type: 'X' }], data: {} } } });
    await expect(readMyLists('t')).rejects.toBeInstanceOf(DriverError);
  });
});

const mine = (name: string, id: string, nodes: string[] = []): UserList => ({
  id,
  name,
  description: '',
  isPrivate: false,
  repoItemIds: [],
  repoNodeIds: nodes,
});

describe('adding to a list', () => {
  const want = { name: 'Work', description: 'd', isPrivate: false };

  it('reuses a list with the same name, ignoring letter case, and makes no request', async () => {
    const gh = mockGithub();
    const res = await findOrCreateList('t', { ...want, name: 'work' }, [mine('WORK', 'L9')], 0);
    expect(res.list?.id).toBe('L9');
    expect(gh.calls).toHaveLength(0);
  });

  it('creates the list when there is none with that name', async () => {
    const gh = mockGithub({ [`POST ${API}/graphql`]: { json: { data: { createUserList: { list: { id: 'LNEW', name: 'Work' } } } } } });
    const res = await findOrCreateList('t', want, [mine('Other', 'L1')], 0);
    expect(res.outcome).toEqual({ kind: 'moved' });
    expect(res.list?.id).toBe('LNEW');
    expect(gh.calls[0].body).toMatchObject({ variables: want });
  });

  it('says it could not make the list when GraphQL answers with errors', async () => {
    mockGithub({ [`POST ${API}/graphql`]: { json: { errors: [{ message: 'no' }], data: null } } });
    const res = await findOrCreateList('t', want, [], 0);
    expect(res.outcome).toEqual({ kind: 'couldnt_move', reason: "GitHub couldn't make this list." });
  });

  it('sends the union of the lists the repository is already in and the target, so none is dropped (FR-GH-009)', async () => {
    const gh = mockGithub({ [`POST ${API}/graphql`]: { json: { data: { updateUserListsForItem: {} } } } });
    const lists = [mine('A', 'LA', ['N1']), mine('B', 'LB', ['N1', 'N2']), mine('T', 'LT')];
    const res = await addRepoToList('t', 'N1', 'LT', lists, 0);
    expect(res.outcome).toEqual({ kind: 'moved' });
    const sent = (gh.calls[0].body as { variables: { itemId: string; listIds: string[] } }).variables;
    expect(sent.itemId).toBe('N1');
    expect([...sent.listIds].sort()).toEqual(['LA', 'LB', 'LT']);
    // The snapshot now knows the repository is in the target list too.
    expect(lists[2].repoNodeIds).toEqual(['N1']);
  });
});

describe('adding stars, people, and gists', () => {
  it('sends the right call for each kind, with no body', async () => {
    const gh = mockGithub({
      [`PUT ${API}/user/starred/o/r`]: noContent,
      [`PUT ${API}/user/following/bob`]: noContent,
      [`PUT ${API}/gists/g1/star`]: noContent,
    });
    expect((await starRepo('t', 'o/r', 0)).outcome).toEqual({ kind: 'moved' });
    expect((await followPerson('t', 'bob', 0)).outcome).toEqual({ kind: 'moved' });
    expect((await starGist('t', 'g1', 0)).outcome).toEqual({ kind: 'moved' });
    expect(gh.calls.every((c) => c.method === 'PUT' && c.headers['content-length'] === '0' && c.body === undefined)).toBe(true);
  });

  it('answers retry when there is no network', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect((await starRepo('t', 'o/r', 0)).outcome).toEqual({ kind: 'retry' });
  });
});

describe('answer to outcome', () => {
  const map = (status: number, headers: Record<string, string> = {}, body: unknown = null, ctx = {}) =>
    mapAnswer(status, h(headers), body, { strikes: 0, ...ctx });

  it('204 is moved and 401 is auth', () => {
    expect(map(204).outcome).toEqual({ kind: 'moved' });
    expect(map(401).outcome).toEqual({ kind: 'auth' });
  });

  it('404 says why, and says it differently for a person', () => {
    expect(map(404).outcome).toEqual({ kind: 'couldnt_move', reason: 'It was deleted or is private.' });
    expect(map(404, {}, null, { person: true }).outcome).toEqual({ kind: 'couldnt_move', reason: 'Account was deleted.' });
  });

  it('422 is couldnt_move', () => {
    expect(map(422).outcome).toEqual({ kind: 'couldnt_move', reason: "GitHub didn't allow this one." });
  });

  it.each([403, 429])('%i with retry-after of 60 or less is a wait', (status) => {
    expect(map(status, { 'retry-after': '30' }).outcome).toEqual({ kind: 'wait', ms: 30_000 });
    expect(map(status, { 'retry-after': '60' }).outcome).toEqual({ kind: 'wait', ms: 60_000 });
  });

  it('a longer retry-after is later at that time', () => {
    expect(map(403, { 'retry-after': '3600' }).outcome).toEqual({ kind: 'later', resumeAt: 1_000_000 + 3_600_000 });
  });

  it('no requests left with a reset time is later at the reset', () => {
    const reset = String(1_000 + 7200);
    expect(map(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset }).outcome).toEqual({
      kind: 'later',
      resumeAt: (1_000 + 7200) * 1000,
    });
  });

  it('a rate limit with no time is a wait of 60 seconds', () => {
    expect(map(403, {}, { message: 'You have exceeded a secondary Rate Limit.' }).outcome).toEqual({ kind: 'wait', ms: 60_000 });
    expect(map(429).outcome).toEqual({ kind: 'wait', ms: 60_000 });
  });

  it('a 403 that is not a rate limit is couldnt_move, and the third in a row stops the move', () => {
    const first = map(403, {}, { message: 'Forbidden' });
    expect(first).toEqual({ outcome: { kind: 'couldnt_move', reason: "GitHub didn't allow this one." }, strikes: 1 });
    const second = map(403, {}, null, { strikes: 1 });
    expect(second.strikes).toBe(2);
    const third = map(403, {}, null, { strikes: 2 });
    expect(third.outcome).toEqual({ kind: 'stop', notice: "GitHub paused your account's activity. Try again later." });
  });

  it('any other answer resets the count', () => {
    expect(map(204, {}, null, { strikes: 2 }).strikes).toBe(0);
    expect(map(404, {}, null, { strikes: 2 }).strikes).toBe(0);
  });

  it('5xx is retry', () => {
    expect(map(502).outcome).toEqual({ kind: 'retry' });
  });
});
