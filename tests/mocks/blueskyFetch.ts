// A fake `fetch` for Bluesky. Routes are "METHOD url" (no query), "METHOD url?query" for an exact match, or "METHOD url*" for a prefix.
// An answer is { status, headers, json }, a function of the request, or a list used one by one (the last repeats).
// Any host outside the ones the app may talk to is refused, so a test cannot reach the real internet.
export type Req = { at: number; method: string; url: string; auth: string | null; body: unknown; headers: Record<string, string> };
export type Answer = { delay?: number; status?: number; headers?: Record<string, string>; json?: unknown };
type Route = Answer | ((req: Req) => Answer) | Answer[];

const HOSTS = ['public.api.bsky.app', 'plc.directory', 'bsky.social', 'cdn.bsky.app'];
const allowed = (host: string) => HOSTS.includes(host) || host.endsWith('.host.bsky.network');

export function mockBluesky(routes: Record<string, Route> = {}) {
  const calls: Req[] = [];
  const used = new Map<string, number>();
  const table = { ...routes };

  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const host = new URL(url).host;
    if (!allowed(host)) throw new Error(`Test tried to reach ${host}`);
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
    const req: Req = { at: Date.now(), method, url, auth: headers.authorization ?? null, body, headers };
    calls.push(req);

    const bare = url.split('?')[0];
    // A route ending in * matches by prefix. The longest prefix wins.
    const wild = Object.keys(table)
      .filter((k) => k.endsWith('*') && `${method} ${url}`.startsWith(k.slice(0, -1)))
      .sort((a, b) => b.length - a.length)[0];
    const key = [`${method} ${url}`, `${method} ${bare}`, wild].find((k) => k !== undefined && k in table);
    if (!key) return reply({ status: 404, json: { error: 'NotFound', message: `no route for ${method} ${url}` } });
    let route = table[key];
    if (Array.isArray(route)) {
      const n = used.get(key) ?? 0;
      used.set(key, n + 1);
      route = route[Math.min(n, route.length - 1)];
    }
    const answer = typeof route === 'function' ? route(req) : route;
    if (answer.delay) await new Promise((r) => setTimeout(r, answer.delay));
    return reply(answer);
  }) as unknown as typeof fetch;

  return {
    calls,
    callsTo: (method: string, urlStart: string) =>
      calls.filter((c) => c.method === method && c.url.startsWith(urlStart)),
    hosts: () => [...new Set(calls.map((c) => new URL(c.url).host))],
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

// Ready-made answers and routes.
export const PUBLIC = 'https://public.api.bsky.app/xrpc';
// A valid account ID (did:plc plus 24 characters of a-z and 2-7) that is different for each number.
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
export const did = (n: number): `did:plc:${string}` =>
  `did:plc:${[...String(n)].map((d) => ALPHABET[Number(d)]).join('').padEnd(24, 'z')}`;

export const resolve = (handle: string, d: string): Record<string, Route> => ({
  [`GET ${PUBLIC}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`]: { json: { did: d } },
});
export const didDoc = (d: string, server = `https://morel.us-east.host.bsky.network`): Record<string, Route> => ({
  [`GET https://plc.directory/${d}`]: {
    json: {
      id: d,
      service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: server }],
    },
  },
});
export const profile = (d: string, handle: string, extra: Record<string, unknown> = {}): Record<string, Route> => ({
  [`GET ${PUBLIC}/app.bsky.actor.getProfile?actor=${d}`]: { json: { did: d, handle, ...extra } },
});
// A whole account that the app can look up.
export const account = (handle: string, d: string, extra: Record<string, unknown> = {}) => ({
  ...resolve(handle, d),
  ...didDoc(d),
  ...profile(d, handle, extra),
});
export const rateLimited = (resetSeconds: number): Answer => ({
  status: 429,
  headers: { 'ratelimit-reset': String(Math.floor(Date.now() / 1000) + resetSeconds) },
  json: { error: 'RateLimitExceeded', message: 'Rate Limit Exceeded' },
});
