import type { AccountInfo } from '@/store/progressStore';

// GitHub sign-in with the device code flow: no client secret (specs/008-github-platform/research.md R2).
const DEVICE_URL = 'https://github.com/login/device/code';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';
const HOUR8 = 8 * 3_600_000;

export type GithubSignIn =
  | { ok: true; account: AccountInfo; token: string; scopes: string[]; expiresAt: number }
  | { ok: false; reason: 'cancelled' | 'failed' };

export type CodeInfo = { code: string; url: string };

// Scope per kind. Lists need `user`, which already includes `user:follow`.
const SCOPE_OF: Record<string, string> = {
  repo: 'public_repo',
  person: 'user:follow',
  list: 'user',
  gist: 'gist',
};

// The scopes to ask for the picked kinds, plus any scopes the new account already granted.
export function scopesFor(kinds: string[], already: string[] = []): string {
  const all = new Set([...already, ...kinds.map((k) => SCOPE_OF[k]).filter(Boolean)]);
  if (all.has('user')) all.delete('user:follow');
  return [...all].join(' ');
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

async function post(url: string, body: Record<string, string>): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json: unknown = await res.json();
    return isRecord(json) ? json : null;
  } catch {
    return null;
  }
}

type Device = { deviceCode: string; userCode: string; url: string; expiresIn: number; interval: number };

// Principle III, rules 2 and 8: every value is checked before use.
function readDevice(v: Record<string, unknown> | null): Device | null {
  if (!v) return null;
  const { device_code, user_code, verification_uri, expires_in, interval } = v;
  if (typeof device_code !== 'string' || !device_code) return null;
  if (typeof user_code !== 'string' || !/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(user_code)) return null;
  if (typeof verification_uri !== 'string' || !verification_uri.startsWith('https://github.com/')) return null;
  if (typeof expires_in !== 'number' || expires_in < 60 || expires_in > 1800) return null;
  if (typeof interval !== 'number' || interval < 1 || interval > 60) return null;
  return { deviceCode: device_code, userCode: user_code, url: verification_uri, expiresIn: expires_in, interval };
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });
}

async function readAccount(token: string): Promise<AccountInfo | null> {
  try {
    const res = await fetch(USER_URL, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (!res.ok) return null;
    const u: unknown = await res.json();
    if (!isRecord(u) || typeof u.id !== 'number' || typeof u.login !== 'string') return null;
    const avatar = typeof u.avatar_url === 'string' && u.avatar_url.startsWith('https://avatars.githubusercontent.com/');
    return {
      id: String(u.id),
      handle: u.login,
      name: typeof u.name === 'string' && u.name ? u.name : u.login,
      photoUrl: avatar ? (u.avatar_url as string) : null,
    };
  } catch {
    return null;
  }
}

// onCode: called with the code to show, and with null when the wait ends. Abort = the user tapped Cancel.
export async function signIn(
  scope: string,
  onCode: (code: CodeInfo | null) => void,
  signal?: AbortSignal,
): Promise<GithubSignIn> {
  const clientId = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID;
  const failed = { ok: false, reason: 'failed' } as const;
  if (!clientId) return failed;
  const device = readDevice(await post(DEVICE_URL, { client_id: clientId, scope }));
  if (!device) return failed;

  onCode({ code: device.userCode, url: device.url });
  try {
    const deadline = Date.now() + device.expiresIn * 1000;
    let interval = device.interval;
    for (;;) {
      await wait(interval * 1000, signal);
      if (signal?.aborted) return { ok: false, reason: 'cancelled' };
      if (Date.now() >= deadline) return failed;
      const a = await post(TOKEN_URL, {
        client_id: clientId,
        device_code: device.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });
      // A dropped request is not an answer: ask again until the code runs out.
      if (!a) continue;
      if (typeof a.error === 'string') {
        if (a.error === 'authorization_pending') continue;
        if (a.error === 'slow_down') {
          interval += 5;
          continue;
        }
        return a.error === 'access_denied' ? { ok: false, reason: 'cancelled' } : failed;
      }
      const { access_token, token_type, scope: granted, expires_in } = a;
      if (typeof access_token !== 'string' || !access_token) return failed;
      if (typeof token_type !== 'string' || token_type.toLowerCase() !== 'bearer') return failed;
      if (typeof granted !== 'string') return failed;
      const account = await readAccount(access_token);
      if (!account) return failed;
      // The refresh token in the answer is ignored on purpose (FR-GH-019).
      return {
        ok: true,
        account,
        token: access_token,
        scopes: granted.split(',').filter(Boolean),
        expiresAt: Date.now() + (typeof expires_in === 'number' ? expires_in * 1000 : HOUR8),
      };
    }
  } finally {
    onCode(null);
  }
}
