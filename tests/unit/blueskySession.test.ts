import { NobleKey } from '@/auth/blueskyKey';
import { createBlueskyStores } from '@/auth/blueskySession';
import { __dump, __reset } from '../mocks/expoSecureStore';

const NEW = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa' as const;
const OLD = 'did:plc:bbbbbbbbbbbbbbbbbbbbbbbb' as const;

async function session(sub: `did:plc:${string}`, extra = '') {
  return {
    dpopKey: await NobleKey.generate(['ES256']),
    authMethod: { method: 'none' as const },
    tokenSet: {
      iss: 'https://bsky.social',
      sub,
      aud: 'https://pds.host.bsky.network',
      scope: 'atproto' as const,
      token_type: 'DPoP' as const,
      access_token: `access-${extra}`,
      refresh_token: `refresh-${extra}`,
      expires_at: '2030-01-01T00:00:00.000Z',
    },
  };
}

let clock = 1_000_000;
const stores = () => createBlueskyStores({ now: () => clock });

beforeEach(() => {
  __reset();
  clock = 1_000_000;
});

describe('the new account session', () => {
  it('is saved in the phone secure storage, under a key that holds only letters, dots, dashes, and underscores', async () => {
    const s = stores();
    await s.sessionStore.set(NEW, await session(NEW));
    const keys = Object.keys(__dump());
    expect(keys).toEqual(['bluesky.session.did_plc_aaaaaaaaaaaaaaaaaaaaaaaa']);
    expect(keys[0]).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('comes back whole, with a key that still signs', async () => {
    const s = stores();
    const saved = await session(NEW, 'x');
    await s.sessionStore.set(NEW, saved);
    const got = await s.sessionStore.get(NEW);
    expect(got?.tokenSet).toEqual(saved.tokenSet);
    expect(got?.dpopKey.privateJwk).toEqual(saved.dpopKey.privateJwk);
    expect(await got?.dpopKey.createJwt({ alg: 'ES256' }, { a: 1 })).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it('is split in parts of at most 2,000 bytes, read back whole, and the spare parts go when it fits again', async () => {
    const s = stores();
    const big = await session(NEW, 'y'.repeat(2500));
    await s.sessionStore.set(NEW, big);
    expect(Object.keys(__dump()).sort()).toEqual([
      'bluesky.session.did_plc_aaaaaaaaaaaaaaaaaaaaaaaa',
      'bluesky.session.did_plc_aaaaaaaaaaaaaaaaaaaaaaaa.2',
      'bluesky.session.did_plc_aaaaaaaaaaaaaaaaaaaaaaaa.3',
    ]);
    expect(Object.values(__dump()).every((v) => Buffer.byteLength(v) <= 2000)).toBe(true);
    expect((await s.sessionStore.get(NEW))?.tokenSet.access_token).toBe(`access-${'y'.repeat(2500)}`);
    await s.sessionStore.set(NEW, await session(NEW, 'short'));
    expect(Object.keys(__dump())).toEqual(['bluesky.session.did_plc_aaaaaaaaaaaaaaaaaaaaaaaa']);
  });

  it('is deleted with every part', async () => {
    const s = stores();
    await s.sessionStore.set(NEW, await session(NEW, 'y'.repeat(2500)));
    await s.sessionStore.del(NEW);
    expect(__dump()).toEqual({});
    expect(await s.sessionStore.get(NEW)).toBeUndefined();
  });

  it('is not trusted when the saved value is not what the app wrote', async () => {
    const s = stores();
    const key = 'bluesky.session.did_plc_aaaaaaaaaaaaaaaaaaaaaaaa';
    const SecureStore = jest.requireMock('expo-secure-store');
    for (const bad of ['not json', '{}', '{"dpopKey":{},"tokenSet":{"access_token":1}}', 'null']) {
      await SecureStore.setItemAsync(key, bad);
      expect(await s.sessionStore.get(NEW)).toBeUndefined();
    }
  });

  it('knows whether a session is saved, without reading its tokens', async () => {
    const s = stores();
    expect(await s.hasSession(NEW)).toBe(false);
    await s.sessionStore.set(NEW, await session(NEW));
    expect(await s.hasSession(NEW)).toBe(true);
  });
});

describe('the old account session', () => {
  it('stays in memory and never reaches the secure storage', async () => {
    const s = stores();
    s.markOld(OLD);
    await s.sessionStore.set(OLD, await session(OLD, 'old'));
    expect(__dump()).toEqual({});
    expect((await s.sessionStore.get(OLD))?.tokenSet.access_token).toBe('access-old');
    await s.sessionStore.del(OLD);
    expect(await s.sessionStore.get(OLD)).toBeUndefined();
  });

  it('does not touch the new account session', async () => {
    const s = stores();
    await s.sessionStore.set(NEW, await session(NEW, 'new'));
    s.markOld(OLD);
    await s.sessionStore.set(OLD, await session(OLD, 'old'));
    await s.sessionStore.del(OLD);
    expect((await s.sessionStore.get(NEW))?.tokenSet.access_token).toBe('access-new');
  });

  it('keeps a session of any account in memory while the old account signs in, even one that was not expected', async () => {
    const s = stores();
    s.capture(true);
    await s.sessionStore.set(NEW, await session(NEW, 'stranger'));
    s.capture(false);
    expect(__dump()).toEqual({});
    await s.sessionStore.del(NEW);
    s.clearOld(NEW);
    expect(await s.hasSession(NEW)).toBe(false);
  });

  it('saves a refresh of the new account that happens while the old account signs in, and never deletes it as old', async () => {
    const s = stores();
    const saved = await session(NEW, 'new');
    await s.sessionStore.set(NEW, saved);
    s.capture(true);
    await s.sessionStore.set(NEW, { ...saved, tokenSet: { ...saved.tokenSet, access_token: 'access-refreshed' } });
    s.capture(false);
    expect(s.oldDids()).toEqual([]);
    expect((await s.sessionStore.get(NEW))?.tokenSet.access_token).toBe('access-refreshed');
  });

  it('keeps the saved session when the same account signs in as the old one and is cancelled', async () => {
    const s = stores();
    await s.sessionStore.set(NEW, await session(NEW, 'new'));
    s.capture(true);
    await s.sessionStore.set(NEW, await session(NEW, 'stranger'));
    s.capture(false);
    await s.sessionStore.del(NEW);
    await s.deleteSession(NEW);
    s.clearOld(NEW);
    expect((await s.sessionStore.get(NEW))?.tokenSet.access_token).toBe('access-new');
  });

  it('is routed to the secure storage again once the mark is cleared', async () => {
    const s = stores();
    s.markOld(OLD);
    s.clearOld(OLD);
    await s.sessionStore.set(OLD, await session(OLD));
    expect(Object.keys(__dump())).toHaveLength(1);
  });
});

describe('the new account ID', () => {
  it('is remembered in the secure storage so a restart can find the session, and forgotten on request', async () => {
    const s = stores();
    expect(await s.getNewDid()).toBeNull();
    await s.setNewDid(NEW);
    expect(await s.getNewDid()).toBe(NEW);
    expect(__dump()).toEqual({ 'bluesky.new': NEW });
    await s.clearNewDid();
    expect(await s.getNewDid()).toBeNull();
  });
});

describe('the sign-in state', () => {
  const state = async () => ({
    iss: 'https://bsky.social',
    dpopKey: await NobleKey.generate(['ES256']),
    authMethod: { method: 'none' as const },
    verifier: 'v',
  });

  it('stays in memory and goes after 10 minutes', async () => {
    const s = stores();
    const data = await state();
    await s.stateStore.set('abc', data);
    expect(__dump()).toEqual({});
    expect(await s.stateStore.get('abc')).toBe(data);
    clock += 9 * 60_000;
    expect(await s.stateStore.get('abc')).toBe(data);
    clock += 2 * 60_000;
    expect(await s.stateStore.get('abc')).toBeUndefined();
  });

  it('is deleted when the sign-in ends', async () => {
    const s = stores();
    await s.stateStore.set('abc', await state());
    await s.stateStore.del('abc');
    expect(await s.stateStore.get('abc')).toBeUndefined();
  });
});
