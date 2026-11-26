import * as WebBrowser from 'expo-web-browser';
import { ALL_SCOPES, REDIRECT_URI, kindsOf, scopesFor, signIn, signOut } from '@/auth/bluesky';
import { blueskyStores } from '@/auth/blueskySession';
import { __dump, __reset } from '../mocks/expoSecureStore';
import { __calls, __reset as resetBrowser, __set } from '../mocks/expoWebBrowser';
import { account, did, mockBluesky } from '../mocks/blueskyFetch';
import { mockClient, resetClient, userSignsInAs } from '../mocks/oauthClient';

jest.mock('@atproto/oauth-client', () => ({
  ...jest.requireActual('@atproto/oauth-client'),
  OAuthClient: require('../mocks/oauthClient').OAuthClient,
}));

const AUD = 'did:web:api.bsky.app%23bsky_appview';
const split = (s: string) => s.split(' ');

describe('access asked of the new account', () => {
  it('asks only for the base scope when no kind is picked', () => {
    expect(scopesFor('new', [])).toBe('atproto');
  });

  it.each([
    ['person', ['repo:app.bsky.graph.follow?action=create']],
    ['block', ['repo:app.bsky.graph.block?action=create']],
    ['list', ['repo:app.bsky.graph.list?action=create', 'repo:app.bsky.graph.listitem?action=create']],
    ['mute', [`rpc:app.bsky.graph.muteActor?aud=${AUD}`, `rpc:app.bsky.graph.getMutes?aud=${AUD}`]],
    ['feed', [`rpc:app.bsky.actor.getPreferences?aud=${AUD}`, `rpc:app.bsky.actor.putPreferences?aud=${AUD}`]],
  ])('asks for exactly the access of %s', (kind, scopes) => {
    expect(split(scopesFor('new', [kind])).sort()).toEqual(['atproto', ...scopes].sort());
  });

  it('asks for the access of every picked kind once, and for nothing of the others', () => {
    const asked = split(scopesFor('new', ['person', 'block']));
    expect(asked.sort()).toEqual(['atproto', 'repo:app.bsky.graph.block?action=create', 'repo:app.bsky.graph.follow?action=create'].sort());
    expect(split(scopesFor('new', ['person', 'person']))).toHaveLength(2);
  });

  it('ignores a kind it does not know', () => {
    expect(scopesFor('new', ['gist'])).toBe('atproto');
  });

  it('never asks for access to the whole account', () => {
    const all = scopesFor('new', ['person', 'block', 'list', 'mute', 'feed']);
    expect(all).not.toContain('transition:generic');
    expect(all).not.toContain('transition:chat');
    expect(split(all).every((s) => s === 'atproto' || s.startsWith('repo:') || s.startsWith('rpc:'))).toBe(true);
    expect(all).not.toContain('repo:*');
    expect(all).not.toContain('aud=*');
  });
});

describe('access asked of the old account after Allow', () => {
  it('is only to read, never to create or change', () => {
    const asked = split(scopesFor('old', ['mute', 'feed']));
    expect(asked.sort()).toEqual(['atproto', `rpc:app.bsky.actor.getPreferences?aud=${AUD}`, `rpc:app.bsky.graph.getMutes?aud=${AUD}`].sort());
    expect(asked.some((s) => s.startsWith('repo:') || /put|mute(?!s)|create/i.test(s.replace('getMutes', '')))).toBe(false);
  });

  it('is nothing more than the base scope for kinds that are public', () => {
    expect(scopesFor('old', ['person', 'block', 'list'])).toBe('atproto');
    expect(scopesFor('old', [])).toBe('atproto');
  });
});

describe('the kinds a granted scope covers', () => {
  it('maps the scopes Bluesky says were granted back to kinds', () => {
    expect(kindsOf(scopesFor('new', ['person', 'list', 'feed'])).sort()).toEqual(['feed', 'list', 'person']);
    expect(kindsOf('atproto')).toEqual([]);
  });

  it('leaves out a kind when the user took away one of its scopes on Bluesky page', () => {
    const asked = split(scopesFor('new', ['list', 'mute']));
    const granted = asked.filter((s) => !s.includes('listitem')).join(' ');
    expect(kindsOf(granted)).toEqual(['mute']);
  });

  it('does not count a scope for another collection or another action', () => {
    expect(kindsOf('atproto repo:app.bsky.graph.follow?action=delete')).toEqual([]);
    expect(kindsOf('atproto repo:app.bsky.feed.post?action=create')).toEqual([]);
  });
});

describe('the scopes the metadata file must list', () => {
  it('holds every scope the app can ask for, once each', () => {
    const asked = new Set([
      ...split(scopesFor('new', ['person', 'block', 'list', 'mute', 'feed'])),
      ...split(scopesFor('old', ['mute', 'feed'])),
    ]);
    expect(new Set(ALL_SCOPES)).toEqual(asked);
    expect(new Set(ALL_SCOPES).size).toBe(ALL_SCOPES.length);
  });
});

// ---- Sign-in ------------------------------------------------------------------------------------------

const ALICE = did(1); // the new account
const BOB = did(2); // another account
const OLDER = did(3); // the old account
beforeEach(() => {
  __reset();
  resetBrowser();
  resetClient();
  blueskyStores.clearOld(OLDER);
  mockBluesky({
    ...account('alice.bsky.social', ALICE, { displayName: 'Alice' }),
    ...account('bob.bsky.social', BOB, { displayName: 'Bob' }),
    ...account('older.bsky.social', OLDER, { displayName: 'Older' }),
  });
});

describe('sign-in of the new account', () => {
  it('looks the handle up first, and opens no browser for an account that is not found or not supported', async () => {
    mockBluesky({
      ...account('alice.bsky.social', ALICE),
      'GET https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=nobody.bsky.social': {
        status: 400,
        json: { error: 'InvalidRequest' },
      },
      'GET https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=web.example.com': { json: { did: 'did:web:web.example.com' } },
    });
    expect(await signIn('new', ['person'], 'nobody.bsky.social')).toEqual({ ok: false, reason: 'not_found' });
    expect(await signIn('new', ['person'], 'web.example.com')).toEqual({ ok: false, reason: 'not_supported' });
    expect(__calls()).toHaveLength(0);
    expect(mockClient.authorize).not.toHaveBeenCalled();
  });

  it('asks Bluesky for the scope of the picked kinds, with the typed handle, and the redirect of the app', async () => {
    await userSignsInAs(ALICE, scopesFor('new', ['person', 'block']));
    await signIn('new', ['person', 'block'], '@Alice');
    expect(mockClient.authorize).toHaveBeenCalledWith('alice.bsky.social', expect.objectContaining({ scope: scopesFor('new', ['person', 'block']), redirect_uri: REDIRECT_URI }));
  });

  it('opens the sign-in page in the system browser, with no saved login, and gives the account that signed in', async () => {
    await userSignsInAs(ALICE);
    const res = await signIn('new', [], 'alice.bsky.social');
    expect(__calls()).toEqual([{ url: 'https://bsky.social/oauth/authorize?request_uri=r', redirect: REDIRECT_URI }]);
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(expect.any(String), REDIRECT_URI, expect.objectContaining({ preferEphemeralSession: true }));
    expect(res).toEqual({ ok: true, account: { id: ALICE, handle: 'alice.bsky.social', name: 'Alice', photoUrl: null }, server: 'https://morel.us-east.host.bsky.network' });
    // The return link is handed to Bluesky's client to check state and issuer.
    expect(mockClient.callback).toHaveBeenCalledWith(expect.any(URLSearchParams), { redirect_uri: REDIRECT_URI });
  });

  it('shows the account that actually signed in, not the one that was typed', async () => {
    await userSignsInAs(BOB);
    const res = await signIn('new', [], 'alice.bsky.social');
    expect(res).toMatchObject({ ok: true, account: { id: BOB, handle: 'bob.bsky.social' } });
  });

  it('keeps the session in the secure storage, remembers the new account, and says which kinds were granted', async () => {
    await userSignsInAs(ALICE, scopesFor('new', ['person', 'list']));
    await signIn('new', ['person', 'list'], 'alice.bsky.social');
    expect(await blueskyStores.getNewDid()).toBe(ALICE);
    expect(Object.keys(__dump()).sort()).toEqual(['bluesky.new', `bluesky.session.${ALICE.replace(/:/g, '_')}`]);
    expect(kindsOf((await blueskyStores.sessionStore.get(ALICE))!.tokenSet.scope)).toEqual(['person', 'list']);
  });

  it('gives back no token and no key', async () => {
    await userSignsInAs(ALICE);
    const res = JSON.stringify(await signIn('new', [], 'alice.bsky.social'));
    expect(res).not.toMatch(/secret|access|refresh|dpop|"d"/i);
  });

  it('leaves the step signed out with no error when the user cancels or closes the page', async () => {
    for (const type of ['cancel', 'dismiss'] as const) {
      __set({ type });
      expect(await signIn('new', [], 'alice.bsky.social')).toEqual({ ok: false, reason: 'cancelled' });
    }
    expect(mockClient.callback).not.toHaveBeenCalled();
    expect(__dump()).toEqual({});
  });

  it('says failed when Bluesky refuses the return (a wrong state or issuer), and saves nothing', async () => {
    mockClient.callback.mockRejectedValue(new Error('bad state'));
    __set({ type: 'success', url: `${REDIRECT_URI}?code=c&state=wrong` });
    expect(await signIn('new', [], 'alice.bsky.social')).toEqual({ ok: false, reason: 'failed' });
    expect(__dump()).toEqual({});
  });

  it('says failed when the sign-in client cannot start', async () => {
    mockClient.authorize.mockRejectedValue(new Error('no server'));
    expect(await signIn('new', [], 'alice.bsky.social')).toEqual({ ok: false, reason: 'failed' });
    expect(__calls()).toHaveLength(0);
  });

  it('revokes and refuses a session from a sign-in server that is not Bluesky', async () => {
    const session = await userSignsInAs(ALICE, 'atproto', 'https://evil.example');
    expect(await signIn('new', [], 'alice.bsky.social')).toEqual({ ok: false, reason: 'failed' });
    expect(session.signOut).toHaveBeenCalled();
    expect(__dump()).toEqual({});
  });

  it('revokes and refuses a session of an account that is not a did:plc', async () => {
    const session = await userSignsInAs('did:web:evil.example' as never);
    expect(await signIn('new', [], 'alice.bsky.social')).toEqual({ ok: false, reason: 'failed' });
    expect(session.signOut).toHaveBeenCalled();
  });

  it('keeps the saved new account when another account signs in on an Allow sign-in, and revokes the stranger', async () => {
    await userSignsInAs(ALICE, scopesFor('new', ['person']));
    await signIn('new', ['person'], 'alice.bsky.social');
    const stranger = await userSignsInAs(BOB, scopesFor('new', ['person', 'block']));
    const res = await signIn('new', ['person', 'block'], 'alice.bsky.social', ALICE);
    expect(res).toMatchObject({ ok: true, account: { id: BOB } });
    expect(stranger.signOut).toHaveBeenCalled();
    expect(await blueskyStores.getNewDid()).toBe(ALICE);
    expect(await blueskyStores.hasSession(BOB)).toBe(false);
    expect(await blueskyStores.hasSession(ALICE)).toBe(true);
  });
});

describe('a fresh sign-in over a saved new account', () => {
  it('cancels the saved one and saves the account that signed in', async () => {
    const first = await userSignsInAs(ALICE, scopesFor('new', ['person']));
    await signIn('new', ['person'], 'alice.bsky.social');
    const second = await userSignsInAs(BOB, scopesFor('new', ['person']));
    await signIn('new', ['person'], 'bob.bsky.social');
    expect(first.signOut).toHaveBeenCalled();
    expect(second.signOut).not.toHaveBeenCalled();
    expect(await blueskyStores.getNewDid()).toBe(BOB);
    expect(await blueskyStores.hasSession(BOB)).toBe(true);
    expect(await blueskyStores.hasSession(ALICE)).toBe(false);
  });
});

describe('sign-in of the old account', () => {
  it('only looks the account up when no kind needs a sign-in: no browser, no session', async () => {
    const res = await signIn('old', [], 'older.bsky.social');
    expect(res).toMatchObject({ ok: true, account: { id: OLDER } });
    expect(__calls()).toHaveLength(0);
    expect(__dump()).toEqual({});
  });

  it('asks only to read, and keeps the session in memory, never in the secure storage', async () => {
    await userSignsInAs(OLDER, scopesFor('old', ['mute']));
    const res = await signIn('old', ['mute'], 'older.bsky.social');
    expect(res).toMatchObject({ ok: true, account: { id: OLDER } });
    expect(mockClient.authorize).toHaveBeenCalledWith('older.bsky.social', expect.objectContaining({ scope: scopesFor('old', ['mute']) }));
    expect(__dump()).toEqual({});
    expect((await blueskyStores.sessionStore.get(OLDER))?.tokenSet.access_token).toBe('secret-access');
  });

  it('revokes and drops a session of another account, so it is never saved', async () => {
    const stranger = await userSignsInAs(BOB, scopesFor('old', ['mute']));
    const res = await signIn('old', ['mute'], 'older.bsky.social');
    expect(res).toMatchObject({ ok: true, account: { id: BOB } });
    expect(stranger.signOut).toHaveBeenCalled();
    expect(__dump()).toEqual({});
  });

  it('is cancelled with no session left in memory', async () => {
    __set({ type: 'cancel' });
    expect(await signIn('old', ['mute'], 'older.bsky.social')).toEqual({ ok: false, reason: 'cancelled' });
    expect(await blueskyStores.hasSession(OLDER)).toBe(false);
  });
});

it('lists the scopes of every kind in the metadata', () => {
  expect(ALL_SCOPES).toContain('atproto');
});

describe('sign-out', () => {
  const signedInNew = async () => {
    const session = await userSignsInAs(ALICE, scopesFor('new', ['person']));
    await signIn('new', ['person'], 'alice.bsky.social');
    return session;
  };

  it('cancels the new account access on Bluesky, then deletes the session and the account ID from the phone', async () => {
    const session = await signedInNew();
    expect(Object.keys(__dump())).toHaveLength(2);
    expect(await signOut('new')).toBe(true);
    expect(session.signOut).toHaveBeenCalledTimes(1);
    expect(__dump()).toEqual({});
    expect(await blueskyStores.hasSession(ALICE)).toBe(false);
    expect(await blueskyStores.getNewDid()).toBeNull();
  });

  it('still deletes everything on the phone when Bluesky cannot be told, and says so with false', async () => {
    const session = await signedInNew();
    mockClient.offline = true;
    expect(await signOut('new')).toBe(false);
    expect(session.signOut).toHaveBeenCalled();
    expect(__dump()).toEqual({});
  });

  it('deletes the saved session and says false when it cannot be opened any more', async () => {
    await signedInNew();
    mockClient.restore.mockRejectedValue(new Error('token revoked'));
    expect(await signOut('new')).toBe(false);
    expect(__dump()).toEqual({});
  });

  it('makes no call when there is nothing to sign out of', async () => {
    expect(await signOut('new')).toBe(true);
    expect(await signOut()).toBe(true);
    expect(mockClient.restore).not.toHaveBeenCalled();
  });

  it('cancels and drops the old account session, which is only in memory, and leaves the new account alone', async () => {
    await signedInNew();
    const oldSession = await userSignsInAs(OLDER, scopesFor('old', ['mute']));
    await signIn('old', ['mute'], 'older.bsky.social');
    expect(await signOut('old')).toBe(true);
    expect(oldSession.signOut).toHaveBeenCalled();
    expect(await blueskyStores.hasSession(OLDER)).toBe(false);
    expect(await blueskyStores.hasSession(ALICE)).toBe(true);
    expect(await blueskyStores.getNewDid()).toBe(ALICE);
  });

  it('signs out of both when no account is named', async () => {
    const a = await signedInNew();
    const b = await userSignsInAs(OLDER, scopesFor('old', ['mute']));
    await signIn('old', ['mute'], 'older.bsky.social');
    expect(await signOut()).toBe(true);
    expect(a.signOut).toHaveBeenCalled();
    expect(b.signOut).toHaveBeenCalled();
    expect(__dump()).toEqual({});
  });

  it('logs nothing: no token, key, account ID, or handle reaches the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
    await signedInNew();
    await signOut();
    mockClient.offline = true;
    await signedInNew();
    await signOut();
    expect(spies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    spies.forEach((spy) => spy.mockRestore());
  });
});
