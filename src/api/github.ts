import { DriverError, type Outcome } from '@/platforms/driver';
import type { NewItem } from '@/store/progressStore';

// Every GitHub call. Contract: specs/008-github-platform/contracts/github-api.md
const API = 'https://api.github.com';
const AVATARS = 'https://avatars.githubusercontent.com/';
const HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

const MAX_WAIT_MS = 60_000;
const GENERIC = "GitHub didn't allow this one.";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const avatar = (v: unknown) => (typeof v === 'string' && v.startsWith(AVATARS) ? v : null);

type Raw = { status: number; headers: { get(k: string): string | null }; json: unknown };

// Null when the request never got an answer (no network).
async function call(token: string, method: string, path: string, body?: unknown): Promise<Raw | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        ...HEADERS,
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? (method === 'PUT' ? { 'Content-Length': '0' } : {}) : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      // 204 has no body
    }
    return { status: res.status, headers: res.headers, json };
  } catch {
    return null;
  }
}

// ---- Answer to outcome ------------------------------------------------------------------

export type Strikes = number;

function rateLimitWait(headers: Raw['headers'], body: unknown): { limited: boolean; ms: number | null } {
  const retryAfter = headers.get('retry-after');
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  const message = isRecord(body) && typeof body.message === 'string' ? body.message.toLowerCase() : '';
  const limited = retryAfter !== null || remaining === '0' || message.includes('rate limit');
  let ms: number | null = null;
  if (retryAfter !== null && Number.isFinite(Number(retryAfter))) ms = Number(retryAfter) * 1000;
  else if (remaining === '0' && reset !== null && Number.isFinite(Number(reset))) ms = Number(reset) * 1000 - Date.now();
  return { limited, ms: ms === null ? null : Math.max(ms, 1000) };
}

// strikes: how many answers in a row were a 403 that is not a rate limit. The caller keeps the count.
export function mapAnswer(
  status: number,
  headers: Raw['headers'],
  body: unknown,
  ctx: { person?: boolean; strikes: Strikes },
): { outcome: Outcome; strikes: Strikes } {
  const done = (outcome: Outcome) => ({ outcome, strikes: 0 });
  if (status >= 200 && status < 300) return done({ kind: 'moved' });
  if (status === 401) return done({ kind: 'auth' });
  if (status === 404) {
    return done({
      kind: 'couldnt_move',
      reason: ctx.person ? 'Account was deleted.' : 'It was deleted or is private.',
    });
  }
  if (status === 422) return done({ kind: 'couldnt_move', reason: GENERIC });
  if (status === 403 || status === 429) {
    const { limited, ms } = rateLimitWait(headers, body);
    if (limited || status === 429) {
      if (ms === null) return done({ kind: 'wait', ms: MAX_WAIT_MS });
      if (ms <= MAX_WAIT_MS) return done({ kind: 'wait', ms });
      return done({ kind: 'later', resumeAt: Date.now() + ms });
    }
    if (ctx.strikes + 1 >= 3) {
      return {
        outcome: { kind: 'stop', notice: "GitHub paused your account's activity. Try again later." },
        strikes: ctx.strikes + 1,
      };
    }
    return { outcome: { kind: 'couldnt_move', reason: GENERIC }, strikes: ctx.strikes + 1 };
  }
  if (status >= 500) return done({ kind: 'retry' });
  return done({ kind: 'couldnt_move', reason: GENERIC });
}

export type AddResult = { outcome: Outcome; strikes: Strikes };

async function put(token: string, path: string, ctx: { person?: boolean; strikes: Strikes }): Promise<AddResult> {
  const raw = await call(token, 'PUT', path);
  if (!raw) return { outcome: { kind: 'retry' }, strikes: ctx.strikes };
  return mapAnswer(raw.status, raw.headers, raw.json, ctx);
}

const seg = encodeURIComponent;

export const starRepo = (token: string, fullName: string, strikes: Strikes) =>
  put(token, `/user/starred/${fullName.split('/').map(seg).join('/')}`, { strikes });
export const followPerson = (token: string, login: string, strikes: Strikes) =>
  put(token, `/user/following/${seg(login)}`, { person: true, strikes });
export const starGist = (token: string, gistId: string, strikes: Strikes) =>
  put(token, `/gists/${seg(gistId)}/star`, { strikes });

// ---- Reading -----------------------------------------------------------------------------

function fail(raw: Raw | null): never {
  if (!raw) throw new DriverError('retry');
  if (raw.status === 401) throw new DriverError('auth');
  if (raw.status === 403 || raw.status === 429) throw new DriverError('later');
  throw new DriverError('retry');
}

// REST list, 100 per page, until a page has fewer than 100.
async function readPages(token: string, path: string, parse: (raw: unknown) => NewItem | null): Promise<NewItem[]> {
  const out: NewItem[] = [];
  for (let page = 1; ; page += 1) {
    const raw = await call(token, 'GET', `${path}?per_page=100&page=${page}`);
    if (!raw || raw.status !== 200) fail(raw);
    if (!Array.isArray(raw!.json)) throw new DriverError('retry');
    for (const r of raw!.json) {
      const item = parse(r);
      if (item) out.push(item);
    }
    if (raw!.json.length < 100) return out;
  }
}

export const listStars = (token: string) =>
  readPages(token, '/user/starred', (r) => {
    if (!isRecord(r) || typeof r.id !== 'number' || typeof r.full_name !== 'string' || typeof r.node_id !== 'string') return null;
    return {
      itemId: `repo:${r.id}`,
      kind: 'repo',
      title: r.full_name,
      thumbnailUrl: isRecord(r.owner) ? avatar(r.owner.avatar_url) : null,
      data: JSON.stringify({ fullName: r.full_name, nodeId: r.node_id }),
    };
  });

export const listPeople = (token: string) =>
  readPages(token, '/user/following', (r) => {
    if (!isRecord(r) || typeof r.id !== 'number' || typeof r.login !== 'string') return null;
    return {
      itemId: `person:${r.id}`,
      kind: 'person',
      title: r.login,
      thumbnailUrl: avatar(r.avatar_url),
      data: JSON.stringify({ login: r.login }),
    };
  });

export const listGists = (token: string) =>
  readPages(token, '/gists/starred', (r) => {
    if (!isRecord(r) || typeof r.id !== 'string') return null;
    const firstFile = isRecord(r.files) ? Object.keys(r.files)[0] : undefined;
    const title = typeof r.description === 'string' && r.description ? r.description : (firstFile ?? r.id);
    return {
      itemId: `gist:${r.id}`,
      kind: 'gist',
      title,
      thumbnailUrl: isRecord(r.owner) ? avatar(r.owner.avatar_url) : null,
      data: JSON.stringify({ gistId: r.id }),
    };
  });

// ---- Star lists (GraphQL) ------------------------------------------------------------------

export type UserList = {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  // The repositories in it: item IDs (repo:<id>) and GraphQL node IDs.
  repoItemIds: string[];
  repoNodeIds: string[];
};


async function graphql(token: string, query: string, variables: Record<string, unknown>): Promise<Raw | null> {
  return call(token, 'POST', '/graphql', { query, variables });
}

const LISTS_QUERY = `query($after: String) { viewer { lists(first: 50, after: $after) {
  pageInfo { hasNextPage endCursor }
  nodes { id name description isPrivate items(first: 100) {
    pageInfo { hasNextPage endCursor }
    nodes { ... on Repository { id databaseId } } } } } } }`;
const MORE_ITEMS_QUERY = `query($id: ID!, $after: String) { node(id: $id) { ... on UserList {
  items(first: 100, after: $after) { pageInfo { hasNextPage endCursor }
    nodes { ... on Repository { id databaseId } } } } } }`;

function readRepos(items: unknown): { itemIds: string[]; nodeIds: string[]; more: string | null } {
  const itemIds: string[] = [];
  const nodeIds: string[] = [];
  if (!isRecord(items) || !Array.isArray(items.nodes)) throw new DriverError('retry');
  for (const n of items.nodes) {
    if (isRecord(n) && typeof n.id === 'string' && typeof n.databaseId === 'number') {
      itemIds.push(`repo:${n.databaseId}`);
      nodeIds.push(n.id);
    }
  }
  const info = items.pageInfo;
  const more = isRecord(info) && info.hasNextPage === true && typeof info.endCursor === 'string' ? info.endCursor : null;
  return { itemIds, nodeIds, more };
}

function data(raw: Raw | null): Record<string, unknown> {
  if (!raw || raw.status !== 200) fail(raw);
  const j = raw!.json;
  if (!isRecord(j) || !isRecord(j.data) || Array.isArray(j.errors)) throw new DriverError('retry');
  return j.data;
}

// The lists of the signed-in account, with the repositories in each.
export async function readMyLists(token: string): Promise<UserList[]> {
  const out: UserList[] = [];
  let after: string | null = null;
  do {
    const d = data(await graphql(token, LISTS_QUERY, { after }));
    const lists = isRecord(d.viewer) ? d.viewer.lists : null;
    if (!isRecord(lists) || !Array.isArray(lists.nodes)) throw new DriverError('retry');
    for (const n of lists.nodes) {
      if (!isRecord(n) || typeof n.id !== 'string' || typeof n.name !== 'string') continue;
      const first = readRepos(n.items);
      const list: UserList = {
        id: n.id,
        name: n.name,
        description: typeof n.description === 'string' ? n.description : '',
        isPrivate: n.isPrivate === true,
        repoItemIds: first.itemIds,
        repoNodeIds: first.nodeIds,
      };
      let more = first.more;
      while (more) {
        const md = data(await graphql(token, MORE_ITEMS_QUERY, { id: n.id, after: more }));
        const page = readRepos(isRecord(md.node) ? md.node.items : null);
        list.repoItemIds.push(...page.itemIds);
        list.repoNodeIds.push(...page.nodeIds);
        more = page.more;
      }
      out.push(list);
    }
    const info = lists.pageInfo;
    after = isRecord(info) && info.hasNextPage === true && typeof info.endCursor === 'string' ? info.endCursor : null;
  } while (after);
  return out;
}

export async function listLists(token: string): Promise<NewItem[]> {
  return (await readMyLists(token)).map((l) => ({
    itemId: `list:${l.id}`,
    kind: 'list',
    title: l.name,
    thumbnailUrl: null,
    data: JSON.stringify({ description: l.description, isPrivate: l.isPrivate, repoItemIds: l.repoItemIds }),
  }));
}

// A GraphQL answer to a write: 200 with no errors is success.
function mapGraphql(raw: Raw | null, strikes: Strikes): AddResult {
  if (!raw) return { outcome: { kind: 'retry' }, strikes };
  if (raw.status === 200) {
    const errors = isRecord(raw.json) && Array.isArray(raw.json.errors) ? raw.json.errors : null;
    if (!errors || errors.length === 0) return { outcome: { kind: 'moved' }, strikes: 0 };
    const limited = errors.some((e) => isRecord(e) && e.type === 'RATE_LIMITED');
    if (limited) return { outcome: { kind: 'wait', ms: MAX_WAIT_MS }, strikes: 0 };
    return { outcome: { kind: 'couldnt_move', reason: "GitHub couldn't make this list." }, strikes: 0 };
  }
  return mapAnswer(raw.status, raw.headers, raw.json, { strikes });
}

// A list on the new account with this name (letter case ignored): reused. Otherwise it is made.
export async function findOrCreateList(
  token: string,
  want: { name: string; description: string; isPrivate: boolean },
  existing: UserList[],
  strikes: Strikes,
): Promise<AddResult & { list?: UserList }> {
  const same = existing.find((l) => l.name.toLowerCase() === want.name.toLowerCase());
  if (same) return { outcome: { kind: 'moved' }, strikes, list: same };
  const raw = await graphql(
    token,
    `mutation($name: String!, $description: String, $isPrivate: Boolean!) {
       createUserList(input: { name: $name, description: $description, isPrivate: $isPrivate }) { list { id name } } }`,
    want,
  );
  const res = mapGraphql(raw, strikes);
  if (res.outcome.kind !== 'moved') return res;
  const made = isRecord(raw!.json) && isRecord(raw!.json.data) ? raw!.json.data.createUserList : null;
  const list = isRecord(made) ? made.list : null;
  if (!isRecord(list) || typeof list.id !== 'string') {
    return { outcome: { kind: 'couldnt_move', reason: "GitHub couldn't make this list." }, strikes: 0 };
  }
  return { ...res, list: { id: list.id, name: want.name, description: want.description, isPrivate: want.isPrivate, repoItemIds: [], repoNodeIds: [] } };
}

// updateUserListsForItem SETS the lists of a repository, so we always send every list it is already in
// plus the target (FR-GH-009: nothing is taken away on the new account).
export async function addRepoToList(
  token: string,
  repoNodeId: string,
  targetListId: string,
  existing: UserList[],
  strikes: Strikes,
): Promise<AddResult> {
  const ids = new Set(existing.filter((l) => l.repoNodeIds.includes(repoNodeId)).map((l) => l.id));
  ids.add(targetListId);
  const raw = await graphql(
    token,
    `mutation($itemId: ID!, $listIds: [ID!]!) {
       updateUserListsForItem(input: { itemId: $itemId, listIds: $listIds }) { clientMutationId } }`,
    { itemId: repoNodeId, listIds: [...ids] },
  );
  const res = mapGraphql(raw, strikes);
  if (res.outcome.kind === 'moved') {
    const target = existing.find((l) => l.id === targetListId);
    if (target && !target.repoNodeIds.includes(repoNodeId)) target.repoNodeIds.push(repoNodeId);
  }
  return res;
}
