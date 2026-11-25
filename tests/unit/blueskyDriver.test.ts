import * as auth from '@/auth/bluesky';
import { NobleKey } from '@/auth/blueskyKey';
import { blueskyStores } from '@/auth/blueskySession';
import { blueskyDriver as driver } from '@/platforms/blueskyDriver';
import { __reset } from '../mocks/expoSecureStore';
import { did } from '../mocks/blueskyFetch';

jest.mock('@/auth/bluesky', () => ({
  ...jest.requireActual('@/auth/bluesky'),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));
const signIn = auth.signIn as jest.Mock;
const signOut = auth.signOut as jest.Mock;

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

beforeEach(() => {
  __reset();
  signIn.mockReset();
  signOut.mockReset();
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
    expect(await driver.signOut('new')).toBeUndefined();
    signOut.mockResolvedValue(false);
    expect(await driver.signOut('new')).toBe(false);
    expect(signOut).toHaveBeenLastCalledWith('new');
  });
});
