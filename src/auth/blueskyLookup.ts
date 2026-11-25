import type { AccountInfo } from '@/store/progressStore';

// Find a Bluesky account from the handle the user typed, with no sign-in (research R5, contracts/bluesky-api.md "Lookup").
// Only accounts that Bluesky hosts are supported (FR-BS-022), so the app talks only to hosts it knows: the public
// read server, the account directory, and the account's own server, which is checked before any call to it.
const PUBLIC = 'https://public.api.bsky.app/xrpc';
const DIRECTORY = 'https://plc.directory';
const PICTURES = 'https://cdn.bsky.app/';
const DID = /^did:plc:[a-z2-7]{24}$/;
const SERVER_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.host\.bsky\.network$/;

export type LookupFailure = 'not_found' | 'not_supported' | 'unavailable';
export type Lookup = { ok: true; account: AccountInfo; server: string } | { ok: false; reason: LookupFailure };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const fail = (reason: LookupFailure): Lookup => ({ ok: false, reason });

// Trim, drop leading @ signs, lower-case, and treat a name with no dot as a name on bsky.social.
export function cleanHandle(input: string): string {
  const handle = input.trim().replace(/^@+/, '').toLowerCase();
  return handle.includes('.') ? handle : `${handle}.bsky.social`;
}

// null: the request got no answer.
async function get(url: string): Promise<{ status: number; json: unknown } | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      // no body
    }
    return { status: res.status, json };
  } catch {
    return null;
  }
}

// The address of the account's own server, if it is a Bluesky server. Anything else is refused.
function serverOf(doc: unknown): string | null {
  if (!isRecord(doc) || !Array.isArray(doc.service)) return null;
  const pds = doc.service.find((s) => isRecord(s) && s.id === '#atproto_pds' && s.type === 'AtprotoPersonalDataServer');
  if (!isRecord(pds) || typeof pds.serviceEndpoint !== 'string') return null;
  try {
    const url = new URL(pds.serviceEndpoint);
    if (url.protocol !== 'https:' || url.port !== '' || !SERVER_HOST.test(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function lookup(typed: string): Promise<Lookup> {
  const handle = cleanHandle(typed);
  const resolved = await get(`${PUBLIC}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
  if (!resolved) return fail('unavailable');
  if (resolved.status === 400) return fail('not_found');
  const id = isRecord(resolved.json) ? resolved.json.did : null;
  if (resolved.status !== 200 || typeof id !== 'string') return fail('unavailable');
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
