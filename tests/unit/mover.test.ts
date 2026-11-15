import { recoverInterrupted, runMove } from '@/move/mover';
import type { Outcome, Pacer } from '@/platforms/driver';
import {
  closeStore,
  getItems,
  getOrCreateProgress,
  initStore,
  listUnfinished,
  releaseLater,
  saveItems,
  setPicked,
  setStatus,
  type StoredItem,
} from '@/store/progressStore';

const acct = (id: string) => ({ id, handle: `${id}@x.com`, name: id, photoUrl: null });
const item = (id: string, kind = 'channel') => ({ itemId: id, kind, title: id, thumbnailUrl: null, data: null });
let pid: string;
const statuses = async () => Object.fromEntries((await getItems(pid)).map((c) => [c.itemId, c.status]));
const sleep = jest.fn(async () => undefined);
const add = jest.fn<Promise<Outcome>, [StoredItem, StoredItem[], Pacer | undefined]>();
const run = (extra = {}) => runMove(pid, { add, sleep, ...extra });
const ids = () => add.mock.calls.map((c) => c[0].itemId);

beforeEach(async () => {
  jest.clearAllMocks();
  add.mockReset();
  await closeStore();
  await initStore();
  pid = await getOrCreateProgress('youtube', acct('o'), acct('n'));
  await saveItems(pid, ['a', 'b', 'c'].map((id) => item(id)));
});

describe('runMove', () => {
  it('moves only picked waiting channels', async () => {
    await setPicked(pid, ['b'], false);
    await setStatus(pid, 'c', 'moved');
    add.mockResolvedValue({ kind: 'moved' });
    expect(await run()).toBe('done');
    expect(ids()).toEqual(['a']);
    expect(await statuses()).toEqual({ a: 'moved', b: 'waiting', c: 'moved' });
  });

  it('saves "moving" before each request', async () => {
    const seen: string[] = [];
    add.mockImplementation(async (it) => {
      seen.push((await statuses())[it.itemId]);
      return { kind: 'moved' };
    });
    await run();
    expect(seen).toEqual(['moving', 'moving', 'moving']);
  });

  it('marks a failing channel and keeps going', async () => {
    add.mockResolvedValueOnce({ kind: 'couldnt_move', reason: '' }).mockResolvedValue({ kind: 'moved' });
    expect(await run()).toBe('done');
    expect(await statuses()).toEqual({ a: 'couldnt_move', b: 'moved', c: 'moved' });
  });

  it('saves the reason of a failed item', async () => {
    add.mockResolvedValueOnce({ kind: 'couldnt_move', reason: 'Account was deleted.' }).mockResolvedValue({ kind: 'moved' });
    await run();
    expect((await getItems(pid)).find((i) => i.itemId === 'a')!.reason).toBe('Account was deleted.');
  });

  it('stops and asks to sign in again on an auth outcome', async () => {
    add.mockResolvedValue({ kind: 'auth' });
    expect(await run()).toBe('auth');
    expect(await statuses()).toEqual({ a: 'waiting', b: 'waiting', c: 'waiting' });
  });

  it('retries twice with 1 s and 4 s waits, then succeeds', async () => {
    add
      .mockResolvedValueOnce({ kind: 'retry' })
      .mockResolvedValueOnce({ kind: 'retry' })
      .mockResolvedValue({ kind: 'moved' });
    expect(await run()).toBe('done');
    expect(sleep.mock.calls).toEqual([[1000], [4000]]);
  });

  it('stops offline after two retries and puts the channel back to waiting', async () => {
    add.mockResolvedValueOnce({ kind: 'moved' }).mockResolvedValue({ kind: 'retry' });
    expect(await run()).toBe('offline');
    expect(await statuses()).toEqual({ a: 'moved', b: 'waiting', c: 'waiting' });
    expect(add).toHaveBeenCalledTimes(4);
  });

  it('on a later outcome: keeps moved ones, turns the rest into later, records both times', async () => {
    add.mockResolvedValueOnce({ kind: 'moved' }).mockResolvedValue({ kind: 'later', resumeAt: 5000 });
    expect(await run()).toBe('limit');
    expect(await statuses()).toEqual({ a: 'moved', b: 'later', c: 'later' });
    const p = (await listUnfinished())[0];
    expect(p.limitHitAt).not.toBeNull();
    expect(p.resumeAt).toBe(5000);
    expect(add).toHaveBeenCalledTimes(2);
  });

  it('can pretend the limit was hit after N moves (development test switch)', async () => {
    add.mockResolvedValue({ kind: 'moved' });
    expect(await run({ simulateQuotaAfter: 1 })).toBe('limit');
    expect(add).toHaveBeenCalledTimes(1);
    expect(await statuses()).toEqual({ a: 'moved', b: 'later', c: 'later' });
  });

  it('reports every status change', async () => {
    add.mockResolvedValue({ kind: 'moved' });
    const onUpdate = jest.fn();
    await run({ onUpdate });
    expect(onUpdate).toHaveBeenCalledTimes(6);
  });

  it('moves the kinds in the order given', async () => {
    await saveItems(pid, [item('z', 'person')]);
    add.mockResolvedValue({ kind: 'moved' });
    await run({ kindOrder: ['person', 'channel'] });
    expect(ids()).toEqual(['z', 'a', 'b', 'c']);
  });
});

describe('waits, stops, and the pace', () => {
  it('sleeps on a short wait and tries the same item again', async () => {
    add.mockResolvedValueOnce({ kind: 'wait', ms: 30_000 }).mockResolvedValue({ kind: 'moved' });
    expect(await run()).toBe('done');
    expect(sleep).toHaveBeenCalledWith(30_000);
    expect(ids().slice(0, 2)).toEqual(['a', 'a']);
  });

  it('turns a second wait for the same item into later one hour on', async () => {
    jest.useFakeTimers().setSystemTime(1_000_000);
    add.mockResolvedValue({ kind: 'wait', ms: 1000 });
    expect(await run()).toBe('limit');
    expect(await statuses()).toEqual({ a: 'later', b: 'later', c: 'later' });
    expect((await listUnfinished())[0].resumeAt).toBe(1_000_000 + 3_600_000);
    jest.useRealTimers();
  });

  it('puts the item back to waiting on stop and keeps the notice', async () => {
    const onStop = jest.fn();
    add.mockResolvedValueOnce({ kind: 'moved' }).mockResolvedValue({ kind: 'stop', notice: 'Paused.' });
    expect(await run({ onStop })).toBe('stopped');
    expect(onStop).toHaveBeenCalledWith('Paused.');
    expect(await statuses()).toEqual({ a: 'moved', b: 'waiting', c: 'waiting' });
  });

  it('sleeps as long as the pacer says before an add, and gives the pacer to add', async () => {
    const pacer: Pacer = { beforeAdd: jest.fn(async () => ({ wait: 3000 })) };
    add.mockResolvedValue({ kind: 'moved' });
    await run({ pacer });
    expect(sleep.mock.calls).toEqual([[3000], [3000], [3000]]);
    expect(pacer.beforeAdd).toHaveBeenCalledTimes(3);
    expect(add.mock.calls[0][2]).toBe(pacer);
  });

  it('stops as later at the time the pacer gives, without an add', async () => {
    const pacer: Pacer = { beforeAdd: jest.fn(async () => ({ later: 9000 })) };
    expect(await run({ pacer })).toBe('limit');
    expect(add).not.toHaveBeenCalled();
    expect((await listUnfinished())[0].resumeAt).toBe(9000);
    expect(await statuses()).toEqual({ a: 'later', b: 'later', c: 'later' });
  });

  it('saves the later of the outcome time and the pace time', async () => {
    const pacer: Pacer = { beforeAdd: async () => ({ wait: 0 }), nextAt: async () => 8000 };
    add.mockResolvedValue({ kind: 'later', resumeAt: 5000 });
    await run({ pacer });
    expect((await listUnfinished())[0].resumeAt).toBe(8000);
  });

  it('moves 1,000 items exactly once across three pauses (SC-006)', async () => {
    await closeStore();
    await initStore();
    pid = await getOrCreateProgress('github', acct('o'), acct('n'));
    await saveItems(pid, Array.from({ length: 1000 }, (_, i) => item(`i${i}`)));
    const done = new Map<string, number>();
    let pauses = 0;
    add.mockImplementation(async (it) => {
      // Every 300th add asks for a pause, three times.
      if (pauses < 3 && done.size === 300 * (pauses + 1)) {
        pauses += 1;
        return { kind: 'later', resumeAt: Date.now() + 1 };
      }
      done.set(it.itemId, (done.get(it.itemId) ?? 0) + 1);
      return { kind: 'moved' };
    });
    let result = await run();
    while (result === 'limit') {
      await releaseLater(pid);
      result = await run();
    }
    expect(result).toBe('done');
    expect(pauses).toBe(3);
    expect(done.size).toBe(1000);
    expect([...done.values()].every((n) => n === 1)).toBe(true);
  });
});

describe('recoverInterrupted', () => {
  it('resolves channels left in "moving" by checking what the new account has', async () => {
    await setStatus(pid, 'a', 'moving');
    await setStatus(pid, 'b', 'moving');
    await recoverInterrupted(pid, new Set(['a']));
    expect(await statuses()).toEqual({ a: 'moved', b: 'waiting', c: 'waiting' });
  });
});
