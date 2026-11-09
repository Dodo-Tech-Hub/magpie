import { recoverInterrupted, runMove } from '@/move/mover';
import { subscribe } from '@/api/youtube';
import {
  closeStore,
  getChannels,
  getOrCreateProgress,
  initStore,
  listUnfinished,
  saveChannels,
  setPicked,
  setStatus,
} from '@/store/progressStore';

jest.mock('@/api/youtube', () => ({ subscribe: jest.fn() }));
const sub = subscribe as jest.Mock;

const acct = (id: string) => ({ id, email: `${id}@x.com`, name: id, photoUrl: null });
let pid: string;
const statuses = async () =>
  Object.fromEntries((await getChannels(pid)).map((c) => [c.channelId, c.status]));
const sleep = jest.fn(async () => undefined);
const getToken = jest.fn(async (stale?: string) => (stale ? 'fresh' : 'tok1'));
const run = (extra = {}) => runMove(pid, { getToken, sleep, ...extra });

beforeEach(async () => {
  jest.clearAllMocks();
  await closeStore();
  await initStore();
  pid = await getOrCreateProgress(acct('o'), acct('n'));
  await saveChannels(
    pid,
    ['a', 'b', 'c'].map((id) => ({ channelId: id, title: id, thumbnailUrl: null })),
  );
});

describe('runMove', () => {
  it('moves only picked waiting channels', async () => {
    await setPicked(pid, ['b'], false);
    await setStatus(pid, 'c', 'moved');
    sub.mockResolvedValue({ kind: 'moved' });
    expect(await run()).toBe('done');
    expect(sub.mock.calls.map((c) => c[1])).toEqual(['a']);
    expect(await statuses()).toEqual({ a: 'moved', b: 'waiting', c: 'moved' });
  });

  it('saves "moving" before each request', async () => {
    const seen: string[] = [];
    sub.mockImplementation(async (_t: string, id: string) => {
      seen.push((await statuses())[id]);
      return { kind: 'moved' };
    });
    await run();
    expect(seen).toEqual(['moving', 'moving', 'moving']);
  });

  it('marks a failing channel and keeps going', async () => {
    sub
      .mockResolvedValueOnce({ kind: 'couldnt_move' })
      .mockResolvedValue({ kind: 'moved' });
    expect(await run()).toBe('done');
    expect(await statuses()).toEqual({ a: 'couldnt_move', b: 'moved', c: 'moved' });
  });

  it('refreshes the token once after a 401, then continues', async () => {
    sub.mockResolvedValueOnce({ kind: 'auth' }).mockResolvedValue({ kind: 'moved' });
    expect(await run()).toBe('done');
    expect(getToken).toHaveBeenCalledWith('tok1');
    expect(sub.mock.calls[1][0]).toBe('fresh');
  });

  it('stops and asks to sign in again when the 401 repeats', async () => {
    sub.mockResolvedValue({ kind: 'auth' });
    expect(await run()).toBe('auth');
    expect(await statuses()).toEqual({ a: 'waiting', b: 'waiting', c: 'waiting' });
  });

  it('retries twice with 1 s and 4 s waits, then succeeds', async () => {
    sub
      .mockResolvedValueOnce({ kind: 'retry' })
      .mockResolvedValueOnce({ kind: 'retry' })
      .mockResolvedValue({ kind: 'moved' });
    expect(await run()).toBe('done');
    expect(sleep.mock.calls).toEqual([[1000], [4000]]);
  });

  it('stops offline after two retries and puts the channel back to waiting', async () => {
    sub.mockResolvedValueOnce({ kind: 'moved' }).mockResolvedValue({ kind: 'retry' });
    expect(await run()).toBe('offline');
    expect(await statuses()).toEqual({ a: 'moved', b: 'waiting', c: 'waiting' });
    expect(sub).toHaveBeenCalledTimes(4);
  });

  it('on the daily limit: keeps moved ones, turns the rest into tomorrow, records the time', async () => {
    sub.mockResolvedValueOnce({ kind: 'moved' }).mockResolvedValue({ kind: 'tomorrow' });
    expect(await run()).toBe('limit');
    expect(await statuses()).toEqual({ a: 'moved', b: 'tomorrow', c: 'tomorrow' });
    expect((await listUnfinished())[0].limitHitAt).not.toBeNull();
    expect(sub).toHaveBeenCalledTimes(2);
  });

  it('can pretend the limit was hit after N follows (development test switch)', async () => {
    sub.mockResolvedValue({ kind: 'moved' });
    expect(await run({ simulateQuotaAfter: 1 })).toBe('limit');
    expect(sub).toHaveBeenCalledTimes(1);
    expect(await statuses()).toEqual({ a: 'moved', b: 'tomorrow', c: 'tomorrow' });
  });

  it('reports every status change', async () => {
    sub.mockResolvedValue({ kind: 'moved' });
    const onUpdate = jest.fn();
    await run({ onUpdate });
    expect(onUpdate).toHaveBeenCalledTimes(6);
  });
});

describe('recoverInterrupted', () => {
  it('resolves channels left in "moving" by checking what the new account follows', async () => {
    await setStatus(pid, 'a', 'moving');
    await setStatus(pid, 'b', 'moving');
    await recoverInterrupted(pid, new Set(['a']));
    expect(await statuses()).toEqual({ a: 'moved', b: 'waiting', c: 'waiting' });
  });
});
