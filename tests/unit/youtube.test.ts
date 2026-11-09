import { ApiError, listMySubscriptions, mapError, subscribe } from '@/api/youtube';

const json = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const item = (id: string, title = id) => ({
  snippet: {
    resourceId: { channelId: id },
    title,
    thumbnails: { default: { url: `https://img/${id}.jpg` } },
  },
});

const errBody = (reason: string) => ({ error: { errors: [{ reason }] } });

beforeEach(() => {
  global.fetch = jest.fn();
});

describe('listMySubscriptions', () => {
  it('reads every page and sends the bearer token', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(json(200, { items: [item('a'), item('b')], nextPageToken: 'p2' }))
      .mockResolvedValueOnce(json(200, { items: [item('c')] }));
    const out = await listMySubscriptions('tok');
    expect(out.map((c) => c.channelId)).toEqual(['a', 'b', 'c']);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('https://www.googleapis.com/youtube/v3/subscriptions');
    expect(url).toContain('mine=true');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('pageToken=p2');
  });

  it('skips items that do not have the expected shape', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      json(200, { items: [item('a'), { snippet: {} }, null, { snippet: { title: 'x' } }] }),
    );
    expect((await listMySubscriptions('t')).map((c) => c.channelId)).toEqual(['a']);
  });

  it('keeps a missing thumbnail as null', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      json(200, { items: [{ snippet: { resourceId: { channelId: 'a' }, title: 'A' } }] }),
    );
    expect((await listMySubscriptions('t'))[0].thumbnailUrl).toBeNull();
  });

  it('throws an ApiError with a kind when the API says no', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(json(401, {}));
    await expect(listMySubscriptions('t')).rejects.toMatchObject({ kind: 'auth' });
  });

  it('throws a retry error when the network fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(listMySubscriptions('t')).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects a response that has no items list', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(json(200, { nope: true }));
    await expect(listMySubscriptions('t')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('mapError (contract error table)', () => {
  it.each([
    [400, 'subscriptionDuplicate', 'moved'],
    [403, 'quotaExceeded', 'tomorrow'],
    [403, 'dailyLimitExceeded', 'tomorrow'],
    [403, 'subscriptionForbidden', 'couldnt_move'],
    [404, 'publisherNotFound', 'couldnt_move'],
    [404, 'channelNotFound', 'couldnt_move'],
    [404, 'subscriberNotFound', 'couldnt_move'],
    [401, undefined, 'auth'],
    [429, undefined, 'retry'],
    [500, undefined, 'retry'],
    [503, undefined, 'retry'],
    [400, 'somethingElse', 'couldnt_move'],
    [403, 'somethingElse', 'couldnt_move'],
  ])('%i %s becomes %s', (status, reason, kind) => {
    expect(mapError(status, reason)).toEqual({ kind });
  });
});

describe('subscribe', () => {
  it('posts the channel and returns moved on 200', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(json(200, {}));
    expect(await subscribe('tok', 'UC1')).toEqual({ kind: 'moved' });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('subscriptions?part=snippet');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      snippet: { resourceId: { kind: 'youtube#channel', channelId: 'UC1' } },
    });
  });

  it('maps an error body to an outcome', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(json(403, errBody('quotaExceeded')));
    expect(await subscribe('t', 'UC1')).toEqual({ kind: 'tomorrow' });
  });

  it('treats a network failure as retry', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    expect(await subscribe('t', 'UC1')).toEqual({ kind: 'retry' });
  });

  it('survives an error body that is not JSON', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => {
        throw new Error('bad json');
      },
    });
    expect(await subscribe('t', 'UC1')).toEqual({ kind: 'couldnt_move' });
  });
});
