import { cleanHandle, lookup } from '@/auth/blueskyLookup';
import { PUBLIC, account, did, didDoc, mockBluesky, profile, resolve } from '../mocks/blueskyFetch';

const ALICE = did(1);

describe('cleanHandle', () => {
  it('trims, drops a leading @, lower-cases, and adds .bsky.social to a bare name', () => {
    expect(cleanHandle('  @Alice.BSKY.social ')).toBe('alice.bsky.social');
    expect(cleanHandle('alice')).toBe('alice.bsky.social');
    expect(cleanHandle('alice.com')).toBe('alice.com');
    expect(cleanHandle('@@alice')).toBe('alice.bsky.social');
  });
});

describe('lookup', () => {
  it('finds a Bluesky-hosted account and returns its ID, handle, name, picture, and server', async () => {
    mockBluesky(account('alice.bsky.social', ALICE, { displayName: 'Alice A', avatar: 'https://cdn.bsky.app/img/avatar/x.jpg' }));
    const res = await lookup(' @Alice ');
    expect(res).toEqual({
      ok: true,
      account: { id: ALICE, handle: 'alice.bsky.social', name: 'Alice A', photoUrl: 'https://cdn.bsky.app/img/avatar/x.jpg' },
      server: 'https://morel.us-east.host.bsky.network',
    });
  });

  it('finds an account by its ID too, which is how a sign-in answers, without resolving a handle', async () => {
    const f = mockBluesky({ ...didDoc(ALICE), ...profile(ALICE, 'alice.bsky.social', { displayName: 'Alice' }) });
    expect(await lookup(ALICE)).toMatchObject({ ok: true, account: { id: ALICE, name: 'Alice' } });
    expect(f.calls.some((c) => c.url.includes('resolveHandle'))).toBe(false);
    expect(await lookup('did:web:alice.example.com')).toEqual({ ok: false, reason: 'not_supported' });
  });

  it('uses the handle as the name when there is no display name, and drops a picture that is not on the picture host', async () => {
    mockBluesky(account('alice.bsky.social', ALICE, { displayName: '', avatar: 'https://evil.example/a.jpg' }));
    const res = await lookup('alice');
    expect(res).toMatchObject({ ok: true, account: { name: 'alice.bsky.social', photoUrl: null } });
  });

  it('finds an account whose handle is a personal domain', async () => {
    mockBluesky(account('alice.com', ALICE));
    expect(await lookup('Alice.com')).toMatchObject({ ok: true, account: { id: ALICE, handle: 'alice.com' } });
  });

  it('says not_found for a handle that does not exist', async () => {
    const f = mockBluesky({
      [`GET ${PUBLIC}/com.atproto.identity.resolveHandle?handle=nobody.bsky.social`]: {
        status: 400,
        json: { error: 'InvalidRequest', message: 'Unable to resolve handle' },
      },
    });
    expect(await lookup('nobody')).toEqual({ ok: false, reason: 'not_found' });
    expect(f.hosts()).toEqual(['public.api.bsky.app']);
  });

  it('says not_supported for an account that is not a did:plc, and asks nothing else', async () => {
    const f = mockBluesky(resolve('alice.example.com', 'did:web:alice.example.com'));
    expect(await lookup('alice.example.com')).toEqual({ ok: false, reason: 'not_supported' });
    expect(f.calls).toHaveLength(1);
  });

  it.each(['https://pds.example.com', 'http://morel.us-east.host.bsky.network', 'https://host.bsky.network.evil.com', 'https://evilhost.bsky.network'])(
    'says not_supported when the account lives on %s, and makes no call to it',
    async (server) => {
      const f = mockBluesky({ ...resolve('alice.bsky.social', ALICE), ...didDoc(ALICE, server) });
      expect(await lookup('alice')).toEqual({ ok: false, reason: 'not_supported' });
      expect(f.hosts().every((h) => ['public.api.bsky.app', 'plc.directory'].includes(h))).toBe(true);
    },
  );

  it.each(['AccountDeactivated', 'AccountTakedown'])('says unavailable for a profile that answers %s', async (error) => {
    mockBluesky({
      ...resolve('alice.bsky.social', ALICE),
      ...didDoc(ALICE),
      [`GET ${PUBLIC}/app.bsky.actor.getProfile?actor=${ALICE}`]: { status: 400, json: { error, message: 'x' } },
    });
    expect(await lookup('alice')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('says unavailable for a profile with a takedown label', async () => {
    mockBluesky(account('alice.bsky.social', ALICE, { labels: [{ val: '!takedown' }] }));
    expect(await lookup('alice')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('says unavailable, and does not crash, for answers of the wrong shape', async () => {
    for (const bad of [
      { ...resolve('alice.bsky.social', ALICE), ...didDoc(ALICE), ...{ [`GET ${PUBLIC}/app.bsky.actor.getProfile?actor=${ALICE}`]: { json: { did: did(9), handle: 'x' } } } },
      { ...resolve('alice.bsky.social', ALICE), [`GET https://plc.directory/${ALICE}`]: { json: { service: 'no' } } },
      { ...resolve('alice.bsky.social', ALICE), [`GET https://plc.directory/${ALICE}`]: { json: null } },
      { [`GET ${PUBLIC}/com.atproto.identity.resolveHandle?handle=alice.bsky.social`]: { json: { did: 5 } } },
    ]) {
      mockBluesky(bad as never);
      expect(await lookup('alice')).toEqual({ ok: false, reason: expect.stringMatching(/^(unavailable|not_supported)$/) });
    }
  });

  it('says unavailable when the network is down', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await lookup('alice')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('keeps asking only the hosts the app may talk to', async () => {
    const f = mockBluesky(profile(ALICE, 'alice.bsky.social'));
    await lookup('alice');
    expect(f.hosts().every((h) => h === 'public.api.bsky.app')).toBe(true);
  });
});
