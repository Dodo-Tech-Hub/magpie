import * as WebBrowser from 'expo-web-browser';
import { OAuthClient } from '@atproto/oauth-client';
import { WAIT_MS, isEmail, lookup } from '@/auth/blueskyLookup';
import { runtimeImplementation } from '@/auth/blueskyKey';
import { blueskyStores } from '@/auth/blueskySession';
import type { Fetcher } from '@/api/bluesky';
import type { SignInResult } from '@/platforms/driver';

// The app's identity on Bluesky: its client ID is the address of the public file that describes it
// (docs/oauth/bluesky-client-metadata.json, served by GitHub Pages), and the sign-in comes back through a link that
// starts with the same address read backwards. Bluesky's server fetches the file; the app never does.
// A test checks that the file and these values match.
export const CLIENT_ID = 'https://dodo-tech-hub.github.io/magpie/oauth/bluesky-client-metadata.json';
export const REDIRECT_URI = 'io.github.dodo-tech-hub:/oauth/bluesky';

// What the Bluesky sign-in asks for, kind by kind (research R6, spec "Bluesky section"). Every sign-in includes the
// base scope `atproto`. Access to the whole account (`transition:generic`) is never asked.
//
// The `aud` is the service that answers the call for the account's server. Research R11 (the Check) confirms which
// `aud` the server accepts for the settings calls; if it must change, it changes in this one place.
const APPVIEW = 'did:web:api.bsky.app%23bsky_appview';
const rpc = (method: string) => `rpc:${method}?aud=${APPVIEW}`;
const create = (collection: string) => `repo:${collection}?action=create`;

// What the new account needs to take each kind.
const WRITE: Record<string, string[]> = {
  person: [create('app.bsky.graph.follow')],
  block: [create('app.bsky.graph.block')],
  list: [create('app.bsky.graph.list'), create('app.bsky.graph.listitem')],
  mute: [rpc('app.bsky.graph.muteActor'), rpc('app.bsky.graph.getMutes')],
  feed: [rpc('app.bsky.actor.getPreferences'), rpc('app.bsky.actor.putPreferences')],
};

// What the old account needs to read the kinds that are private. The others are public.
const READ: Record<string, string[]> = {
  mute: [rpc('app.bsky.graph.getMutes')],
  feed: [rpc('app.bsky.actor.getPreferences')],
};

// The scope string for a sign-in: the base scope plus the access of the kinds, each scope once.
export function scopesFor(role: 'old' | 'new', kinds: string[]): string {
  const table = role === 'old' ? READ : WRITE;
  return ['atproto', ...new Set(kinds.flatMap((k) => table[k] ?? []))].join(' ');
}

// Every scope the app can ask for. The client metadata file must list all of them, because a sign-in may only ask
// for scopes that the file declares.
export const ALL_SCOPES: string[] = [...new Set(['atproto', ...Object.values(WRITE).flat(), ...Object.values(READ).flat()])];

// The kinds a granted scope string covers. A kind counts only when every one of its scopes was granted, so a scope
// the user took away on Bluesky's page leaves the kind out.
// ponytail: compares the scope text as written, so if Bluesky returns the same permission in another form this
// reads fewer kinds. The Check (R11) shows what Bluesky returns; normalize here if it differs.
export function kindsOf(granted: string): string[] {
  const have = new Set(granted.split(' '));
  return Object.keys(WRITE).filter((kind) => WRITE[kind].every((s) => have.has(s)));
}

export const clientMetadata = {
  client_id: CLIENT_ID,
  client_name: 'Magpie',
  client_uri: 'https://dodo-tech-hub.github.io/magpie/',
  redirect_uris: [REDIRECT_URI],
  scope: ALL_SCOPES.join(' '),
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
  application_type: 'native',
  dpop_bound_access_tokens: true,
} as const;

// ---- Sign-in --------------------------------------------------------------------------------------------

const DID = /^did:plc:[a-z2-7]{24}$/;
const ISSUER = 'https://bsky.social';

// The sign-in library sets no time limit on most of its requests, so a dead connection could hold sign-in without end.
// The limit is on each request, so the time the user spends on Bluesky's page does not count. A signed-in call to the
// account's server keeps no limit, because a write that was cut off may still have worked.
const limitedFetch: typeof fetch = (input, init) => {
  const request = typeof input === 'object' && 'url' in input ? input : null;
  const { host, pathname } = new URL(request ? request.url : String(input));
  if (host.endsWith('.host.bsky.network') && pathname.startsWith('/xrpc/')) return fetch(input, init);
  const ctl = new AbortController();
  // Not cleared when the answer starts: the limit covers the body too, and a late abort of a finished request does nothing.
  setTimeout(() => ctl.abort(), WAIT_MS);
  // The library's own reason to stop still counts.
  const theirs = init?.signal ?? request?.signal;
  if (theirs?.aborted) ctl.abort();
  else theirs?.addEventListener('abort', () => ctl.abort());
  return fetch(input, { ...init, signal: ctl.signal });
};

let client: OAuthClient | null = null;
function getClient(): OAuthClient {
  client ??= new OAuthClient({
    clientMetadata: clientMetadata as never,
    responseMode: 'query',
    fetch: limitedFetch,
    // Handles and account IDs are looked up on the two hosts the app already talks to.
    handleResolver: 'https://public.api.bsky.app',
    plcDirectoryUrl: 'https://plc.directory',
    runtimeImplementation,
    sessionStore: blueskyStores.sessionStore,
    stateStore: blueskyStores.stateStore,
  });
  return client;
}

type Revocable = { did: string; signOut(): Promise<void> };

// Cancel the access on Bluesky, then delete the phone's copy even if the cancel call failed.
// false: Bluesky could not be told, so the access ends on its own when the token runs out (FR-BS-013).
export async function revokeSession(session: Revocable): Promise<boolean> {
  let cancelled = true;
  try {
    await session.signOut();
  } catch {
    cancelled = false;
  }
  await blueskyStores.deleteSession(session.did);
  return cancelled;
}

const failed = { ok: false, reason: 'failed' } as const;

// Sign in to an account in the system browser (Authorization Code with PKCE, plus a key made on the phone).
// role old with no kinds: only looks the account up. No browser, no session (FR-BS-005).
// role new with nothing typed, or an email: Bluesky's own page asks who it is. Nothing typed is sent anywhere (FR-BS-006).
// The result is the account that actually signed in, which may not be the one typed. Never returns a token.
// server: where the signed-in account lives, so the caller can read its public records.
// only: for "Allow" on the new account, the account ID that is signed in. Any other account must not replace it.
export type BlueskySignIn = SignInResult & { server?: string };
export async function signIn(role: 'old' | 'new', kinds: string[], typed: string, only?: string): Promise<BlueskySignIn> {
  // The address of Bluesky's sign-in server, given in place of a handle, opens its page with no account filled in.
  let account = ISSUER;
  let expected = '';
  if (role === 'old' || (typed.trim() && !isEmail(typed))) {
    const found = await lookup(typed);
    if (!found.ok) return found;
    if (role === 'old' && kinds.length === 0) return { ok: true, account: found.account, server: found.server };
    account = found.account.handle;
    expected = found.account.id;
  }
  if (role === 'old') blueskyStores.capture(true);
  try {
    const url = await getClient().authorize(account, { scope: scopesFor(role, kinds), redirect_uri: REDIRECT_URI });
    const page = await WebBrowser.openAuthSessionAsync(url.toString(), REDIRECT_URI, { preferEphemeralSession: true });
    if (page.type !== 'success') return { ok: false, reason: 'cancelled' };
    // The client checks the state, the issuer in the answer, and the key before it gives a session (FR-BS-016).
    const { session } = await getClient().callback(new URL(page.url).searchParams, { redirect_uri: REDIRECT_URI });
    if (!DID.test(session.did) || session.serverMetadata.issuer !== ISSUER) {
      await revokeSession(session);
      return failed;
    }
    const who = await lookup(session.did);
    if (!who.ok) {
      await revokeSession(session);
      return who;
    }
    if (role === 'old') {
      // Another account signed in: its session is revoked and dropped, and the flow refuses the account.
      if (session.did !== expected) {
        await revokeSession(session);
        blueskyStores.clearOld(session.did);
      }
      return { ok: true, account: who.account, server: who.server };
    }
    if (only && session.did !== only) {
      // An Allow sign-in with another account must not replace the saved one. The flow refuses the account.
      await revokeSession(session);
      return { ok: true, account: who.account, server: who.server };
    }
    // A fresh sign-in replaces the account saved before (kept after a move, and not shown after a restart).
    const saved = await blueskyStores.getNewDid();
    if (saved && saved !== session.did) await revokeDid(saved);
    await blueskyStores.setNewDid(session.did);
    return { ok: true, account: who.account, server: who.server };
  } catch {
    if (role === 'old') blueskyStores.clearOld(expected);
    return failed;
  } finally {
    blueskyStores.capture(false);
  }
}

// The scope text of the saved new account session, or '' when there is none.
export async function grantedScope(): Promise<string> {
  const did = await blueskyStores.getNewDid();
  return (did && (await blueskyStores.sessionStore.get(did))?.tokenSet.scope) || '';
}

// Cancel the access of one account on Bluesky and delete its session from the phone.
// false: it could not be cancelled (no network, or the session was already gone).
async function revokeDid(did: string): Promise<boolean> {
  try {
    return await revokeSession(await getClient().restore(did, false));
  } catch {
    await blueskyStores.deleteSession(did);
    return false;
  }
}

// Sign out of the new account, the old account, or both. false: Bluesky could not be told for at least one, so that
// access ends on its own when its token runs out. The phone's copy is always gone.
export async function signOut(role?: 'old' | 'new'): Promise<boolean> {
  const results: boolean[] = [];
  if (role !== 'old') {
    const did = await blueskyStores.getNewDid();
    if (did) results.push(await revokeDid(did));
    await blueskyStores.clearNewDid();
  }
  if (role !== 'new') {
    for (const did of blueskyStores.oldDids()) {
      results.push(await revokeDid(did));
      blueskyStores.clearOld(did);
    }
  }
  return results.every(Boolean);
}

// The signed-in fetch of the old account, after "Allow": its session is only in memory. null: there is none.
export async function oldAccountFetch(did: string): Promise<Fetcher | null> {
  if (!(await blueskyStores.hasSession(did))) return null;
  try {
    const session = await getClient().restore(did);
    return (path, init) => session.fetchHandler(path, init);
  } catch {
    return null;
  }
}

// The signed-in fetch of the new account, which sends each request to its server with the token and a fresh proof.
// null: there is no saved session, or it cannot be used any more (the token ran out or was revoked).
export async function newAccountFetch(): Promise<{ did: string; fetch: Fetcher } | null> {
  const did = await blueskyStores.getNewDid();
  if (!did) return null;
  try {
    const session = await getClient().restore(did);
    return { did, fetch: (path, init) => session.fetchHandler(path, init) };
  } catch {
    return null;
  }
}
