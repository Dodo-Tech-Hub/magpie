// A fake `fetch` for GitHub. Routes are "METHOD url" (no query), "METHOD url?query" for an exact match, or "METHOD url*" for a prefix.
// An answer is { status, headers, json }, a function of the request, or a list used one by one (the last repeats).
// Any host other than GitHub's three is refused, so a test cannot reach the real internet.
export type Req = { method: string; url: string; auth: string | null; body: unknown; headers: Record<string, string> };
export type Answer = { status?: number; headers?: Record<string, string>; json?: unknown };
type Route = Answer | ((req: Req) => Answer) | Answer[];

const HOSTS = ['github.com', 'api.github.com', 'avatars.githubusercontent.com'];

export function mockGithub(routes: Record<string, Route> = {}) {
  const calls: Req[] = [];
  const used = new Map<string, number>();
  const table = { ...routes };

  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const host = new URL(url).host;
    if (!HOSTS.includes(host)) throw new Error(`Test tried to reach ${host}`);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]),
    );
    let body: unknown = init?.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // keep the text
      }
    }
    const req: Req = { method, url, auth: headers.authorization ?? null, body, headers };
    calls.push(req);

    const bare = url.split('?')[0];
    // A route ending in * matches by prefix. The longest prefix wins.
    const wild = Object.keys(table)
      .filter((k) => k.endsWith('*') && `${method} ${url}`.startsWith(k.slice(0, -1)))
      .sort((a, b) => b.length - a.length)[0];
    const key = [`${method} ${url}`, `${method} ${bare}`, wild].find((k) => k !== undefined && k in table);
    if (!key) return reply({ status: 404, json: { message: `no route for ${method} ${url}` } });
    let route = table[key];
    if (Array.isArray(route)) {
      const n = used.get(key) ?? 0;
      used.set(key, n + 1);
      route = route[Math.min(n, route.length - 1)];
    }
    return reply(typeof route === 'function' ? route(req) : route);
  }) as unknown as typeof fetch;

  return {
    calls,
    callsTo: (method: string, urlStart: string) =>
      calls.filter((c) => c.method === method && c.url.startsWith(urlStart)),
    set: (key: string, route: Route) => {
      table[key] = route;
      used.delete(key);
    },
  };
}

function reply(a: Answer) {
  const status = a.status ?? 200;
  const headers = Object.fromEntries(Object.entries(a.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => {
      if (a.json === undefined) throw new Error('no body');
      return a.json;
    },
    text: async () => JSON.stringify(a.json ?? ''),
  };
}

// Ready-made answers.
export const DEVICE_URL = 'POST https://github.com/login/device/code';
export const TOKEN_URL = 'POST https://github.com/login/oauth/access_token';
export const USER_URL = 'GET https://api.github.com/user';

export const deviceCode = (over: Record<string, unknown> = {}): Answer => ({
  json: {
    device_code: 'dev-123',
    user_code: 'ABCD-1234',
    verification_uri: 'https://github.com/login/device',
    expires_in: 900,
    interval: 5,
    ...over,
  },
});
export const token = (scope: string, over: Record<string, unknown> = {}): Answer => ({
  json: {
    access_token: 'gho_secret',
    token_type: 'bearer',
    scope,
    expires_in: 28800,
    refresh_token: 'ghr_refresh',
    refresh_token_expires_in: 15811200,
    ...over,
  },
});
export const pending = (): Answer => ({ json: { error: 'authorization_pending' } });
export const user = (id: number, login: string): Answer => ({
  json: { id, login, name: null, avatar_url: `https://avatars.githubusercontent.com/u/${id}` },
});
export const noContent: Answer = { status: 204 };
