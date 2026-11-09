const BASE = 'https://www.googleapis.com/youtube/v3';

export type Outcome = { kind: 'moved' | 'tomorrow' | 'couldnt_move' | 'auth' | 'retry' };

export type SubChannel = { channelId: string; title: string; thumbnailUrl: string | null };

export class ApiError extends Error {
  constructor(public kind: Outcome['kind']) {
    super(`YouTube request failed: ${kind}`);
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

// Error table from contracts/youtube-api.md
export function mapError(status: number, reason?: string): Outcome {
  if (status === 400 && reason === 'subscriptionDuplicate') return { kind: 'moved' };
  if (status === 403 && (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded'))
    return { kind: 'tomorrow' };
  if (status === 401) return { kind: 'auth' };
  if (status === 429 || status >= 500) return { kind: 'retry' };
  return { kind: 'couldnt_move' };
}

async function errorReason(res: Response): Promise<string | undefined> {
  try {
    const body: unknown = await res.json();
    if (!isRecord(body) || !isRecord(body.error) || !Array.isArray(body.error.errors)) return;
    const first: unknown = body.error.errors[0];
    return isRecord(first) && typeof first.reason === 'string' ? first.reason : undefined;
  } catch {
    return undefined;
  }
}

function parseItem(raw: unknown): SubChannel | null {
  if (!isRecord(raw) || !isRecord(raw.snippet)) return null;
  const { resourceId, title, thumbnails } = raw.snippet;
  const channelId = isRecord(resourceId) ? resourceId.channelId : undefined;
  if (typeof channelId !== 'string' || typeof title !== 'string') return null;
  const thumb = isRecord(thumbnails) && isRecord(thumbnails.default) ? thumbnails.default.url : null;
  return { channelId, title, thumbnailUrl: typeof thumb === 'string' ? thumb : null };
}

// 1 quota unit per page of 50 channels.
export async function listMySubscriptions(token: string): Promise<SubChannel[]> {
  const out: SubChannel[] = [];
  let pageToken: string | undefined;
  do {
    const url =
      `${BASE}/subscriptions?part=snippet&mine=true&maxResults=50` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      throw new ApiError('retry');
    }
    if (!res.ok) throw new ApiError(mapError(res.status, await errorReason(res)).kind);
    const body: unknown = await res.json();
    if (!isRecord(body) || !Array.isArray(body.items)) throw new ApiError('retry');
    for (const raw of body.items) {
      const item = parseItem(raw);
      if (item) out.push(item);
    }
    pageToken = typeof body.nextPageToken === 'string' ? body.nextPageToken : undefined;
  } while (pageToken);
  return out;
}

// 50 quota units per call.
export async function subscribe(token: string, channelId: string): Promise<Outcome> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/subscriptions?part=snippet`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snippet: { resourceId: { kind: 'youtube#channel', channelId } },
      }),
    });
  } catch {
    return { kind: 'retry' };
  }
  if (res.ok) return { kind: 'moved' };
  return mapError(res.status, await errorReason(res));
}
