import { PER_HOUR, createPacer, timeLeft } from '@/move/pacer';
import { closeStore, initStore } from '@/store/progressStore';

// A fake clock and a fake log, so no database is needed.
function setup(start = 10_000_000) {
  let clock = start;
  const log = new Map<string, number[]>();
  const deps = {
    now: () => clock,
    addsSince: async (key: string, since: number) =>
      (log.get(key) ?? []).filter((t) => t >= since).sort((a, b) => a - b),
    recordAdd: async (key: string, at: number) => {
      log.set(key, [...(log.get(key) ?? []), at]);
    },
  };
  return { deps, log, tick: (ms: number) => (clock += ms), now: () => clock };
}

describe('pacer', () => {
  it('lets the first add go now and keeps adds 3 seconds apart (20 per minute)', async () => {
    const s = setup();
    const p = createPacer('github:1', s.deps);
    expect(await p.beforeAdd()).toEqual({ wait: 0 });
    expect(await p.beforeAdd()).toEqual({ wait: 3000 });
    expect(await p.beforeAdd()).toEqual({ wait: 6000 });
    s.tick(10_000);
    expect(await p.beforeAdd()).toEqual({ wait: 0 });
    // 20 adds fit in a minute at the earliest.
    const times = s.log.get('github:1')!;
    expect(times.every((t, i) => i === 0 || t - times[i - 1] >= 3000)).toBe(true);
  });

  it('stops after 300 adds in the last hour and says when the next one is allowed', async () => {
    const s = setup();
    const p = createPacer('github:1', s.deps);
    const first = s.now();
    for (let i = 0; i < PER_HOUR; i += 1) {
      const a = await p.beforeAdd();
      expect('wait' in a).toBe(true);
      s.tick(3000);
    }
    const a = await p.beforeAdd();
    expect(a).toEqual({ later: first + 3_600_000 });
    expect(await p.nextAt!()).toBe(first + 3_600_000);
  });

  it('allows adds again after the hour, and records an add only when it lets one go', async () => {
    const s = setup();
    const p = createPacer('github:1', s.deps);
    for (let i = 0; i < PER_HOUR; i += 1) {
      await p.beforeAdd();
      s.tick(3000);
    }
    const recorded = s.log.get('github:1')!.length;
    await p.beforeAdd();
    expect(s.log.get('github:1')).toHaveLength(recorded);
    s.tick(3_600_000);
    expect('wait' in (await p.beforeAdd())).toBe(true);
  });

  it('nextAt is 0 when an add is allowed now', async () => {
    const s = setup();
    const p = createPacer('github:1', s.deps);
    expect(await p.nextAt!()).toBe(0);
    await p.beforeAdd();
    expect(await p.nextAt!()).toBe(0);
  });

  it('keeps a log per account', async () => {
    const s = setup();
    await createPacer('github:1', s.deps).beforeAdd();
    expect(await createPacer('github:2', s.deps).beforeAdd()).toEqual({ wait: 0 });
  });

  it('counts the time left as 3 seconds per add', () => {
    expect(timeLeft(80)).toBe(240);
    expect(timeLeft(0)).toBe(0);
  });
});

describe('pacer with the real store', () => {
  it('remembers adds after an app restart', async () => {
    await closeStore();
    await initStore();
    const first = await createPacer('github:9').beforeAdd();
    expect(first).toEqual({ wait: 0 });
    // A new pacer reads the same log.
    expect(((await createPacer('github:9').beforeAdd()) as { wait: number }).wait).toBeGreaterThan(0);
  });
});
