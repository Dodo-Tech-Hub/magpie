import * as api from '@/api/github';
import { signIn as authSignIn } from '@/auth/github';
import { dropOld, getNew, getOld, setNew, setOld } from '@/auth/githubTokens';
import { DriverError, type Pacer } from '@/platforms/driver';
import { githubDriver as d } from '@/platforms/githubDriver';
import type { StoredItem } from '@/store/progressStore';
import { githubWords } from '@/strings';
import { __dump, __reset } from '../mocks/expoSecureStore';

jest.mock('@/api/github');
jest.mock('@/auth/github', () => ({
  ...jest.requireActual('@/auth/github'),
  signIn: jest.fn(),
}));

const A = api as jest.Mocked<typeof api>;
const signInMock = authSignIn as jest.Mock;

const stored = (itemId: string, kind: string, data: unknown = null, status: StoredItem['status'] = 'waiting', title = itemId): StoredItem => ({
  itemId,
  kind,
  title,
  thumbnailUrl: null,
  data: data === null ? null : JSON.stringify(data),
  picked: true,
  status,
  reason: null,
});
const acct = (id: string) => ({ id, handle: `u${id}`, name: `u${id}`, photoUrl: null });
const signedIn = (id: string, scopes: string[], token = 'tok') => ({
  ok: true,
  account: acct(id),
  token,
  scopes,
  expiresAt: Date.now() + 3_600_000,
});
const saveNew = (scopes: string[], accountId = '2') =>
  setNew({ token: 'newtok', accountId, scopes, expiresAt: Date.now() + 3_600_000 });
const item = (id: string, kind: string) => ({ itemId: id, kind, title: id, thumbnailUrl: null, data: null });

beforeEach(() => {
  Object.values(A).forEach((f) => (f as jest.Mock).mockReset?.());
  signInMock.mockReset();
  __reset();
  dropOld();
});

describe('shape', () => {
  it('has the kinds in Pick order and the items move in another order', () => {
    expect(d.kinds.map((k) => [k.id, k.heading])).toEqual([
      ['repo', 'Stars'],
      ['list', 'Lists'],
      ['gist', 'Gists'],
      ['person', 'People'],
    ]);
    expect(d.moveOrder).toEqual(['repo', 'person', 'gist', 'list']);
    expect(d.words).toBe(githubWords);
    expect(d.switchSignsOut).toBe(true);
    expect(d.removeAccessUrl).toBe('https://github.com/settings/applications');
  });

  it('counts one add per item plus one per repository of a list', () => {
    const list = stored('list:1', 'list', { repoItemIds: ['repo:1', 'repo:2', 'repo:3'] });
    expect(d.pace!.adds([stored('repo:1', 'repo'), list, stored('person:1', 'person')])).toBe(1 + 4 + 1);
    expect(d.pace!.adds([])).toBe(0);
  });
});

describe('signing in', () => {
  it('asks for no scope for the old account and keeps the token in memory only', async () => {
    signInMock.mockResolvedValue(signedIn('1', []));
    const res = await d.signIn('old', ['repo'], jest.fn());
    expect(signInMock.mock.calls[0][0]).toBe('');
    expect(res).toEqual({ ok: true, account: acct('1') });
    expect(getOld()).toBe('tok');
    expect(__dump()).toEqual({});
  });

  it('asks for the scopes of the picked kinds and saves the token with the granted scopes', async () => {
    signInMock.mockResolvedValue(signedIn('2', ['user:follow']));
    await d.signIn('new', ['person', 'repo'], jest.fn());
    expect(signInMock.mock.calls[0][0].split(' ').sort()).toEqual(['public_repo', 'user:follow']);
    expect(await getNew()).toMatchObject({ token: 'tok', accountId: '2', scopes: ['user:follow'] });
    expect(getOld()).toBeNull();
  });

  it('returns a failed sign-in as it is', async () => {
    signInMock.mockResolvedValue({ ok: false, reason: 'cancelled' });
    expect(await d.signIn('new', [], jest.fn())).toEqual({ ok: false, reason: 'cancelled' });
    expect(__dump()).toEqual({});
  });

  it('keeps the saved token when a different account signs in again', async () => {
    await saveNew(['public_repo'], '2');
    signInMock.mockResolvedValue(signedIn('9', ['gist'], 'other'));
    const res = await d.signIn('new', ['gist'], jest.fn());
    expect(res).toMatchObject({ ok: true, account: { id: '9' } });
    expect((await getNew())?.token).toBe('newtok');
  });

  it('replaces the saved token when the same account signs in again', async () => {
    await saveNew(['public_repo'], '2');
    signInMock.mockResolvedValue(signedIn('2', ['public_repo', 'gist'], 'fresh'));
    await d.signIn('new', ['repo', 'gist'], jest.fn());
    expect(await getNew()).toMatchObject({ token: 'fresh', scopes: ['public_repo', 'gist'] });
  });
});

describe('access', () => {
  it.each([
    [['public_repo'], ['repo']],
    [['user:follow'], ['person']],
    [['user'], ['person', 'list']],
    [['gist'], ['gist']],
    [['public_repo', 'user', 'gist'], ['repo', 'person', 'list', 'gist']],
    [[], []],
  ])('turns scopes %j into kinds %j', async (scopes, kinds) => {
    await saveNew(scopes);
    expect((await d.granted()).sort()).toEqual([...kinds].sort());
  });

  it('has no kinds with no token', async () => {
    expect(await d.granted()).toEqual([]);
  });

  it('can act as the new account only with its own, live token', async () => {
    expect(await d.canAct('new', '2')).toBe(false);
    await saveNew(['user'], '2');
    expect(await d.canAct('new', '2')).toBe(true);
    expect(await d.canAct('new', '3')).toBe(false);
    await setNew({ token: 't', accountId: '2', scopes: [], expiresAt: Date.now() - 1 });
    expect(await d.canAct('new', '2')).toBe(false);
  });
});

describe('reading the old account', () => {
  it('reads the four kinds and drops the old token', async () => {
    setOld('oldtok');
    A.listStars.mockResolvedValue([item('repo:1', 'repo')]);
    A.listLists.mockResolvedValue([item('list:1', 'list')]);
    A.listGists.mockResolvedValue([]);
    A.listPeople.mockResolvedValue([item('person:1', 'person')]);
    const res = await d.listOld();
    expect(res.items.map((i) => i.itemId).sort()).toEqual(['list:1', 'person:1', 'repo:1']);
    expect(res.missing).toEqual([]);
    expect(A.listStars).toHaveBeenCalledWith('oldtok');
    expect(getOld()).toBeNull();
  });

  it('leaves out a kind whose read fails, names it, and still returns the others', async () => {
    setOld('oldtok');
    A.listStars.mockResolvedValue([item('repo:1', 'repo')]);
    A.listLists.mockRejectedValue(new DriverError('retry'));
    A.listGists.mockResolvedValue([]);
    A.listPeople.mockResolvedValue([]);
    expect(await d.listOld()).toEqual({ items: [item('repo:1', 'repo')], missing: ['list'] });
    expect(getOld()).toBeNull();
  });

  it('fails with the reason when every read fails', async () => {
    setOld('oldtok');
    for (const f of [A.listStars, A.listLists, A.listGists, A.listPeople]) f.mockRejectedValue(new DriverError('auth'));
    await expect(d.listOld()).rejects.toEqual(new DriverError('auth'));
    expect(getOld()).toBeNull();
  });

  it('needs a token', async () => {
    await expect(d.listOld()).rejects.toEqual(new DriverError('auth'));
  });
});

describe('checking the new account', () => {
  it('finds what it has with one read per kind and no request per item, and counts the account itself', async () => {
    await saveNew(['public_repo', 'user', 'gist'], '5');
    A.listStars.mockResolvedValue([item('repo:1', 'repo'), item('repo:99', 'repo')]);
    A.listPeople.mockResolvedValue([item('person:7', 'person')]);
    A.listGists.mockResolvedValue([]);
    const mine = [item('repo:1', 'repo'), item('repo:2', 'repo'), item('person:5', 'person'), item('person:7', 'person')];
    const have = await d.checkNew(mine as unknown as StoredItem[], ['repo', 'person', 'list', 'gist']);
    expect(have.sort()).toEqual(['person:5', 'person:7', 'repo:1']);
    expect(A.listStars).toHaveBeenCalledTimes(1);
    expect(A.listPeople).toHaveBeenCalledTimes(1);
    expect(A.readMyLists).not.toHaveBeenCalled();
  });

  it('reads only the kinds the new account has access for', async () => {
    await saveNew(['user:follow'], '5');
    A.listPeople.mockResolvedValue([]);
    await d.checkNew([], ['person']);
    expect(A.listStars).not.toHaveBeenCalled();
    expect(A.listGists).not.toHaveBeenCalled();
  });
});

const ok = { outcome: { kind: 'moved' as const }, strikes: 0 };

describe('adding', () => {
  it('answers auth with no token', async () => {
    expect(await d.add(stored('repo:1', 'repo', { fullName: 'o/r', nodeId: 'N' }), [])).toEqual({ kind: 'auth' });
  });

  it('stars, follows, and stars gists with the new account token', async () => {
    await saveNew(['public_repo', 'user', 'gist']);
    A.starRepo.mockResolvedValue(ok);
    A.followPerson.mockResolvedValue(ok);
    A.starGist.mockResolvedValue(ok);
    await d.add(stored('repo:1', 'repo', { fullName: 'o/r', nodeId: 'N' }), []);
    await d.add(stored('person:1', 'person', { login: 'bob' }), []);
    await d.add(stored('gist:g', 'gist', { gistId: 'g' }), []);
    expect(A.starRepo).toHaveBeenCalledWith('newtok', 'o/r', 0);
    expect(A.followPerson).toHaveBeenCalledWith('newtok', 'bob', 0);
    expect(A.starGist).toHaveBeenCalledWith('newtok', 'g', 0);
  });

  it('turns an item with unreadable data into a failed row, not a crash', async () => {
    await saveNew(['public_repo']);
    const bad = { ...stored('repo:1', 'repo'), data: '{nope' };
    expect(await d.add(bad, [])).toEqual({ kind: 'couldnt_move', reason: "GitHub didn't allow this one." });
    expect(A.starRepo).not.toHaveBeenCalled();
  });

  it('carries the count of 403 answers from one call to the next', async () => {
    await saveNew(['public_repo']);
    A.starRepo.mockResolvedValueOnce({ outcome: { kind: 'couldnt_move', reason: 'x' }, strikes: 2 }).mockResolvedValue(ok);
    const it1 = stored('repo:1', 'repo', { fullName: 'o/r', nodeId: 'N' });
    await d.add(it1, []);
    await d.add(it1, []);
    expect(A.starRepo.mock.calls.map((c) => c[2])).toEqual([0, 2]);
  });

  describe('a star list', () => {
    const list = stored('list:L', 'list', { description: 'D', isPrivate: false, repoItemIds: ['repo:1', 'repo:2', 'repo:3'] }, 'waiting', 'Work');
    const repos = [
      stored('repo:1', 'repo', { fullName: 'o/r1', nodeId: 'N1' }, 'moved'),
      stored('repo:2', 'repo', { fullName: 'o/r2', nodeId: 'N2' }, 'already_there'),
      stored('repo:3', 'repo', { fullName: 'o/r3', nodeId: 'N3' }, 'couldnt_move'),
    ];
    const made = { ...ok, list: { id: 'LN', name: 'Work', description: 'D', isPrivate: false, repoItemIds: [], repoNodeIds: [] } };
    const go = (pacer?: Pacer) => d.add(list, [list, ...repos], pacer);

    beforeEach(async () => {
      await saveNew(['user']);
      A.readMyLists.mockResolvedValue([]);
      A.findOrCreateList.mockResolvedValue(made);
      A.addRepoToList.mockResolvedValue(ok);
    });

    it('adds the repositories that are Moved or Already there, and says how many it left out', async () => {
      const res = await go();
      expect(A.addRepoToList.mock.calls.map((c) => c[1])).toEqual(['N1', 'N2']);
      expect(res).toEqual({ kind: 'moved', reason: '1 left out' });
      expect(A.findOrCreateList.mock.calls[0][1]).toEqual({ name: 'Work', description: 'D', isPrivate: false });
    });

    it('asks the pacer before each repository add', async () => {
      const pacer: Pacer = { beforeAdd: jest.fn(async () => ({ wait: 0 })) };
      await go(pacer);
      expect(pacer.beforeAdd).toHaveBeenCalledTimes(2);
    });

    it('returns later at the time the pacer gives, part way through', async () => {
      const pacer: Pacer = {
        beforeAdd: jest.fn().mockResolvedValueOnce({ wait: 0 }).mockResolvedValueOnce({ later: 123 }),
      };
      expect(await go(pacer)).toEqual({ kind: 'later', resumeAt: 123 });
      expect(A.addRepoToList).toHaveBeenCalledTimes(1);
    });

    it('returns the outcome of a failed list create', async () => {
      A.findOrCreateList.mockResolvedValue({ outcome: { kind: 'couldnt_move', reason: 'no' }, strikes: 0 });
      expect(await go()).toEqual({ kind: 'couldnt_move', reason: 'no' });
      expect(A.addRepoToList).not.toHaveBeenCalled();
    });

    it('says retry when the new account lists cannot be read', async () => {
      A.readMyLists.mockRejectedValue(new DriverError('retry'));
      expect(await go()).toEqual({ kind: 'retry' });
    });

    it('stops at the first repository that does not move and passes its outcome up', async () => {
      A.addRepoToList.mockResolvedValue({ outcome: { kind: 'wait', ms: 5000 }, strikes: 0 });
      expect(await go()).toEqual({ kind: 'wait', ms: 5000 });
    });
  });
});

describe('ending', () => {
  it('drops the new account token when a move ends', async () => {
    await saveNew(['user']);
    await d.endMove!();
    expect(await getNew()).toBeNull();
  });

  it('signs out one role or both', async () => {
    setOld('o');
    await saveNew(['user']);
    await d.signOut('new');
    expect(await getNew()).toBeNull();
    expect(getOld()).toBe('o');
    await saveNew(['user']);
    await d.signOut();
    expect(getOld()).toBeNull();
    expect(await getNew()).toBeNull();
  });
});
