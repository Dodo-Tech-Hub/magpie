import type { AccountInfo } from '@/store/progressStore';

// Find a Bluesky account from the handle the user typed, with no sign-in (research R5, contracts/bluesky-api.md "Lookup").
// Only accounts that Bluesky hosts are supported (FR-BS-022), so the app talks only to hosts it knows: the public
// read server, the account directory, and the account's own server, which is checked before any call to it.
export const PUBLIC = 'https://public.api.bsky.app/xrpc';
const DIRECTORY = 'https://plc.directory';
const PICTURES = 'https://cdn.bsky.app/';
export const DID = /^did:plc:[a-z2-7]{24}$/;
const SERVER_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.host\.bsky\.network$/;

export type LookupFailure = 'email' | 'not_found' | 'not_supported' | 'unavailable';
export type Lookup = { ok: true; account: AccountInfo; server: string } | { ok: false; reason: LookupFailure };

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
// A picture address, if it is on the picture host.
export const picture = (v: unknown) => (typeof v === 'string' && v.startsWith(PICTURES) ? v : null);
const fail = (reason: LookupFailure): Lookup => ({ ok: false, reason });

// Trim, drop leading @ signs, lower-case, and treat a name with no dot as a name on bsky.social.
export function cleanHandle(input: string): string {
  const handle = input.trim().replace(/^@+/, '').toLowerCase();
  return handle.includes('.') ? handle : `${handle}.bsky.social`;
}

// An email has an @ after the leading ones that people type before a handle. There is no public way to find an
// account by email, and an email must not be sent to the public lookup.
export const isEmail = (typed: string) => typed.trim().replace(/^@+/, '').includes('@');

// React Native's fetch can wait without end on a dead connection, so a public read gives up after this long.
const WAIT_MS = 20_000;

// A public read with that limit. The limit covers the body too, so `read` takes the body from the answer.
export async function fetchWithin<T>(url: string, read: (res: Response) => Promise<T>): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), WAIT_MS);
  try {
    return await read(await fetch(url, { headers: { Accept: 'application/json' }, signal: ctl.signal }));
  } finally {
    clearTimeout(timer);
  }
}

// null: the request got no answer.
async function get(url: string): Promise<{ status: number; json: unknown } | null> {
  try {
    return await fetchWithin(url, async (res) => ({ status: res.status, json: (await res.json().catch(() => null)) as unknown }));
  } catch {
    return null;
  }
}

// The address of a Bluesky server (https, no port, a host under host.bsky.network), or null. Any other address is
// refused, so the app never sends a request to a host outside the range (constitution III.5, FR-BS-022).
export function blueskyServer(address: string): string | null {
  try {
    const url = new URL(address);
    if (url.protocol !== 'https:' || url.port !== '' || !SERVER_HOST.test(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

// The address of the account's own server, if it is a Bluesky server.
function serverOf(doc: unknown): string | null {
  if (!isRecord(doc) || !Array.isArray(doc.service)) return null;
  const pds = doc.service.find((s) => isRecord(s) && s.id === '#atproto_pds' && s.type === 'AtprotoPersonalDataServer');
  return isRecord(pds) && typeof pds.serviceEndpoint === 'string' ? blueskyServer(pds.serviceEndpoint) : null;
}

// typed: a handle as the user typed it, or an account ID (a sign-in answers with the ID, and the account card needs the rest).
export async function lookup(typed: string): Promise<Lookup> {
  if (isEmail(typed)) return fail('email');
  const handle = typed.trim().startsWith('did:') ? typed.trim() : cleanHandle(typed);
  let id = handle;
  if (!handle.startsWith('did:')) {
    const resolved = await get(`${PUBLIC}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
    if (!resolved) return fail('unavailable');
    if (resolved.status === 400) return fail('not_found');
    const found = isRecord(resolved.json) ? resolved.json.did : null;
    if (resolved.status !== 200 || typeof found !== 'string') return fail('unavailable');
    id = found;
  }
  if (!DID.test(id)) return fail('not_supported');

  const doc = await get(`${DIRECTORY}/${id}`);
  if (!doc || doc.status !== 200) return fail('unavailable');
  const server = serverOf(doc.json);
  if (!server) return fail('not_supported');

  const found = await get(`${PUBLIC}/app.bsky.actor.getProfile?actor=${id}`);
  if (!found) return fail('unavailable');
  const p = found.json;
  if (found.status !== 200 || !isRecord(p) || p.did !== id) return fail('unavailable');
  const labels = Array.isArray(p.labels) ? p.labels : [];
  if (labels.some((l) => isRecord(l) && l.val === '!takedown')) return fail('unavailable');

  const shown = typeof p.handle === 'string' && p.handle && p.handle !== 'handle.invalid' ? p.handle : handle;
  return {
    ok: true,
    account: {
      id,
      handle: shown,
      name: typeof p.displayName === 'string' && p.displayName ? p.displayName : shown,
      photoUrl: typeof p.avatar === 'string' && p.avatar.startsWith(PICTURES) ? p.avatar : null,
    },
    server,
  };
}
