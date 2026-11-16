import { dropNew, dropOld, getNew, getOld, setNew, setOld, type NewToken } from '@/auth/githubTokens';
import * as SecureStore from 'expo-secure-store';
import { __dump, __reset } from '../mocks/expoSecureStore';

const token = (extra: Partial<NewToken> = {}): NewToken => ({
  token: 'tok',
  accountId: '42',
  scopes: ['public_repo', 'user'],
  expiresAt: Date.now() + 3_600_000,
  ...extra,
});

beforeEach(() => {
  __reset();
  dropOld();
});

describe('old account token', () => {
  it('lives in memory only and goes when dropped', () => {
    setOld('old-token');
    expect(getOld()).toBe('old-token');
    expect(__dump()).toEqual({});
    dropOld();
    expect(getOld()).toBeNull();
  });
});

describe('new account token', () => {
  it('is saved under github.new with the account and the granted scopes', async () => {
    await setNew(token());
    expect(Object.keys(__dump())).toEqual(['github.new']);
    expect(await getNew()).toMatchObject({ token: 'tok', accountId: '42', scopes: ['public_repo', 'user'] });
  });

  it('never saves a refresh token', async () => {
    await setNew({ ...token(), refresh_token: 'secret-refresh' } as NewToken);
    expect(JSON.stringify(__dump())).not.toContain('refresh');
    expect(JSON.stringify(__dump())).not.toContain('secret-refresh');
  });

  it('is gone once it has run out', async () => {
    await setNew(token({ expiresAt: Date.now() - 1 }));
    expect(await getNew()).toBeNull();
    expect(__dump()).toEqual({});
  });

  it('is deleted by dropNew', async () => {
    await setNew(token());
    await dropNew();
    expect(await getNew()).toBeNull();
    expect(__dump()).toEqual({});
  });

  it('is replaced by a newer one', async () => {
    await setNew(token());
    await setNew(token({ token: 'newer', scopes: ['gist'] }));
    expect(await getNew()).toMatchObject({ token: 'newer', scopes: ['gist'] });
  });

  it('is ignored when the saved value is not what we wrote', async () => {
    await SecureStore.setItemAsync('github.new', '{"token":1}');
    expect(await getNew()).toBeNull();
    await SecureStore.setItemAsync('github.new', 'not json');
    expect(await getNew()).toBeNull();
  });
});
