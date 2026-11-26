import * as SecureStore from 'expo-secure-store';
import type { SessionStore, StateStore } from '@atproto/oauth-client';
import { NobleKey } from '@/auth/blueskyKey';

// Where Bluesky sessions live (specs/013-bluesky-platform/data-model.md, "Sessions"). A session holds the access
// token, the refresh token, and the private part of the sign-in key.
// New account: the phone's secure storage. Old account (the short read after "Allow"): memory only.
// Sign-in state: memory only, 10 minutes. The sign-in client's own caches are memory only by default.
const PREFIX = 'bluesky.session.';
// The new account's ID, so Sign out, Delete all, and a restart can find its session. One new account at a time.
const NEW_KEY = 'bluesky.new';
const PART = 2000; // iOS secure storage may refuse a value over about 2 KB, so a longer session is split in parts.
const STATE_MINUTES = 10;

type Session = NonNullable<Awaited<ReturnType<SessionStore['get']>>>;
type State = NonNullable<Awaited<ReturnType<StateStore['get']>>>;

// Secure storage keys allow only letters, digits, dots, dashes, and underscores. A DID has colons.
const keyOf = (did: string) => `${PREFIX}${did.replace(/[^A-Za-z0-9._-]/g, '_')}`;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

// Principle III.8: the saved value was written by this app, but is checked on read.
function revive(text: string | null): Session | undefined {
  if (!text) return undefined;
  try {
    const v: unknown = JSON.parse(text);
    if (!isRecord(v) || !isRecord(v.dpopKey) || !isRecord(v.tokenSet) || !isRecord(v.authMethod)) return undefined;
    const { dpopKey, tokenSet } = v;
    const strings = ['kty', 'crv', 'x', 'y', 'd'].every((k) => typeof dpopKey[k] === 'string');
    if (!strings || typeof tokenSet.access_token !== 'string' || typeof tokenSet.sub !== 'string') return undefined;
    return { ...v, dpopKey: new NobleKey(dpopKey as never) } as unknown as Session;
  } catch {
    return undefined;
  }
}

const freeze = (session: Session) => JSON.stringify({ ...session, dpopKey: session.dpopKey.jwk });

export function createBlueskyStores(deps: { now?: () => number } = {}) {
  const now = deps.now ?? Date.now;
  const oldDids = new Set<string>();
  // While the old account signs in, a new session that comes back stays in memory, even one of another account.
  let capturing = false;
  const oldSessions = new Map<string, Session>();
  const states = new Map<string, { value: State; at: number }>();

  // The first part is saved under the key, the next under key.2, key.3, and so on.
  const partKey = (did: string, n: number) => (n === 1 ? keyOf(did) : `${keyOf(did)}.${n}`);
  const readSecure = async (did: string) => {
    let text = '';
    for (let n = 1; ; n += 1) {
      const part = await SecureStore.getItemAsync(partKey(did, n));
      if (part === null) return n === 1 ? null : text;
      text += part;
    }
  };
  // Deletes every part from n on.
  const deleteParts = async (did: string, from: number) => {
    for (let n = from; n === from || (await SecureStore.getItemAsync(partKey(did, n))) !== null; n += 1) {
      await SecureStore.deleteItemAsync(partKey(did, n));
    }
  };
  const deleteSecure = (did: string) => deleteParts(did, 1);

  // A token refresh keeps the session's key, a new sign-in makes a new one. So the same key as the saved one means the saved session was refreshed, for example by a move that runs during an "Allow" sign-in.
  const refreshesSaved = async (did: string, session: Session) => {
    const saved = revive(await readSecure(did));
    return saved !== undefined && saved.dpopKey.jwk.d === session.dpopKey.jwk.d;
  };

  const sessionStore: SessionStore = {
    async get(did) {
      return oldDids.has(did) ? oldSessions.get(did) : revive(await readSecure(did));
    },
    async set(did, session) {
      if ((capturing || oldDids.has(did)) && !(await refreshesSaved(did, session))) {
        oldDids.add(did);
        oldSessions.set(did, session);
        return;
      }
      const text = freeze(session);
      const count = Math.max(1, Math.ceil(text.length / PART));
      for (let n = 1; n <= count; n += 1) await SecureStore.setItemAsync(partKey(did, n), text.slice((n - 1) * PART, n * PART));
      // A shorter session than before must not leave its old parts behind.
      await deleteParts(did, count + 1);
    },
    async del(did) {
      oldSessions.delete(did);
      if (!oldDids.has(did)) await deleteSecure(did);
    },
  };

  const stateStore: StateStore = {
    get(key) {
      const saved = states.get(key);
      if (!saved) return undefined;
      if (now() - saved.at > STATE_MINUTES * 60_000) {
        states.delete(key);
        return undefined;
      }
      return saved.value;
    },
    set(key, value) {
      states.set(key, { value, at: now() });
    },
    del(key) {
      states.delete(key);
    },
  };

  return {
    sessionStore,
    stateStore,
    // The old account's session never reaches secure storage. Mark its DID before it signs in.
    markOld: (did: string) => void oldDids.add(did),
    capture: (on: boolean) => {
      capturing = on;
    },
    clearOld(did: string) {
      oldDids.delete(did);
      oldSessions.delete(did);
    },
    // Is a session saved? Reads the value only to see that it is there.
    hasSession: async (did: string) => (oldDids.has(did) ? oldSessions.has(did) : (await SecureStore.getItemAsync(keyOf(did))) !== null),
    // Every account that signed in as the old account and still holds a session in memory.
    oldDids: () => [...oldSessions.keys()],
    getNewDid: () => SecureStore.getItemAsync(NEW_KEY),
    setNewDid: (did: string) => SecureStore.setItemAsync(NEW_KEY, did),
    clearNewDid: () => SecureStore.deleteItemAsync(NEW_KEY),
    // Delete the phone's copy even when nothing else works (sign-out, summary, Delete all).
    // While the account is marked as old, only the memory copy goes: a saved session of the same account is the new account's.
    async deleteSession(did: string) {
      oldSessions.delete(did);
      if (!oldDids.has(did)) await deleteSecure(did);
    },
  };
}

export const blueskyStores = createBlueskyStores();
