// A stand-in for Bluesky's sign-in client (@atproto/oauth-client). It records what it is asked and answers as the test
// says. A test mocks the package with: jest.mock('@atproto/oauth-client', () => ({ ...jest.requireActual('@atproto/oauth-client'),
// OAuthClient: require('../mocks/oauthClient').OAuthClient }))  (the path is from the test file).
import { NobleKey } from '@/auth/blueskyKey';
import { REDIRECT_URI } from '@/auth/bluesky';
import { __set } from './expoWebBrowser';

type Store = { set(k: string, v: unknown): Promise<void>; del(k: string): Promise<void>; get(k: string): Promise<unknown> };
export type FakeSession = {
  did: `did:plc:${string}`;
  serverMetadata: { issuer: string };
  signOut: jest.Mock;
  saved: unknown;
};

export const mockClient = {
  authorize: jest.fn(),
  callback: jest.fn(),
  restore: jest.fn(),
  options: undefined as undefined | { sessionStore: Store; stateStore: Store },
  // Sessions the user signed in with, so restore() can give them back.
  sessions: new Map<string, FakeSession>(),
  // true: the revoke call fails, as if the phone were offline.
  offline: false,
};

export class OAuthClient {
  constructor(options: unknown) {
    mockClient.options = options as never;
  }
  authorize = (...a: unknown[]) => mockClient.authorize(...a);
  callback = (...a: unknown[]) => mockClient.callback(...a);
  restore = (...a: unknown[]) => mockClient.restore(...a);
}

export function resetClient() {
  mockClient.authorize.mockReset();
  mockClient.callback.mockReset();
  mockClient.restore.mockReset();
  mockClient.sessions.clear();
  mockClient.offline = false;
  mockClient.authorize.mockResolvedValue(new URL('https://bsky.social/oauth/authorize?request_uri=r'));
  mockClient.restore.mockImplementation(async (did: string) => {
    const session = mockClient.sessions.get(did);
    if (!session) throw new Error('no session');
    return session;
  });
}

async function sessionOf(sub: `did:plc:${string}`, scope: string, issuer: string): Promise<FakeSession> {
  const session: FakeSession = {
    did: sub,
    serverMetadata: { issuer },
    // Like the real one: tell Bluesky, then drop the saved copy.
    signOut: jest.fn(async () => {
      if (mockClient.offline) throw new Error('offline');
      await mockClient.options!.sessionStore.del(sub);
      mockClient.sessions.delete(sub);
    }),
    saved: {
      dpopKey: await NobleKey.generate(['ES256']),
      authMethod: { method: 'none' },
      tokenSet: { iss: issuer, sub, aud: 'https://pds.host.bsky.network', scope, token_type: 'DPoP', access_token: 'secret-access', refresh_token: 'secret-refresh', expires_at: '2030-01-01T00:00:00.000Z' },
    },
  };
  return session;
}

// What happens in the browser: the user signs in as this account and accepts the scope. Bluesky's client saves the
// session, then answers with it. Returns the session, so a test can check that it was revoked.
export async function userSignsInAs(sub: `did:plc:${string}`, scope = 'atproto', issuer = 'https://bsky.social') {
  const session = await sessionOf(sub, scope, issuer);
  mockClient.callback.mockImplementation(async () => {
    await mockClient.options!.sessionStore.set(sub, session.saved);
    mockClient.sessions.set(sub, session);
    return { session };
  });
  __set({ type: 'success', url: `${REDIRECT_URI}?code=c&state=s&iss=${encodeURIComponent('https://bsky.social')}` });
  return session;
}
