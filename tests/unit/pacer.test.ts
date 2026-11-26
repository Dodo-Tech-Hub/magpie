import { createPacer, timeLeft } from '@/move/pacer';
import { closeStore, initStore } from '@/store/progressStore';

const GITHUB = { gapMs: 3000, perHour: 300 };
const PER_HOUR = GITHUB.perHour;
const BLUESKY = { gapMs: 120, perHour: 1500, perDay: 10_000 };
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// A fake clock and a fake log, so no database is needed. keeps: the keep time of each record, by account.

function setup(start = 10_000_000) {
  let clock = start;
  const log = new Map<string, number[]>();
  const keeps: (number | undefined)[] = [];
  const deps = {
    now: () => clock,
    addsSince: async (key: string, since: number) =>
      (log.get(key) ?? []).filter((t) => t >= since).sort((a, b) => a - b),
    recordAdd: async (key: string, at: number, keepMs?: number) => {
      log.set(key, [...(log.get(key) ?? []), at]);
      keeps.push(keepMs);
    },
  };
  return { deps, log, keeps, tick: (ms: number) => (clock += ms), now: () => clock };
}

describe('pacer', () => {
  it('lets the first add go now and keeps adds 3 seconds apart (20 per minute)', async () => {
    const s = setup();
    const p = createPacer('github:1', GITHUB, s.deps);
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
    const p = createPacer('github:1', GITHUB, s.deps);
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
    const p = createPacer('github:1', GITHUB, s.deps);
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
    const p = createPacer('github:1', GITHUB, s.deps);
    expect(await p.nextAt!()).toBe(0);
    await p.beforeAdd();
    expect(await p.nextAt!()).toBe(0);
  });

  it('keeps a log per account', async () => {
    const s = setup();
    await createPacer('github:1', GITHUB, s.deps).beforeAdd();
    expect(await createPacer('github:2', GITHUB, s.deps).beforeAdd()).toEqual({ wait: 0 });
  });

  it('counts the time left from the gap of the pace', () => {
    expect(timeLeft(80, GITHUB)).toBe(240);
    expect(timeLeft(0, GITHUB)).toBe(0);
    expect(timeLeft(100, BLUESKY)).toBeCloseTo(12);
  });
});

describe('pacer with an hourly and a daily limit', () => {
  it('keeps adds one gap apart and keeps each add for a day', async () => {
    const s = setup();
    const p = createPacer('bluesky:1', BLUESKY, s.deps);
    expect(await p.beforeAdd()).toEqual({ wait: 0 });
    expect(await p.beforeAdd()).toEqual({ wait: 120 });
    expect(await p.beforeAdd()).toEqual({ wait: 240 });
    expect(s.keeps.every((k) => k === DAY)).toBe(true);
  });

  it('keeps each add for an hour when the pace has no daily limit', async () => {
    const s = setup();
    await createPacer('github:1', GITHUB, s.deps).beforeAdd();
    expect(s.keeps).toEqual([HOUR]);
  });

  it('stops after the hourly limit and says when the next add is allowed', async () => {
    const s = setup();
    const first = s.now();
    for (let i = 0; i < BLUESKY.perHour; i += 1) s.log.set('bluesky:1', [...(s.log.get('bluesky:1') ?? []), first + i * 1000]);
    s.tick(BLUESKY.perHour * 1000);
    const p = createPacer('bluesky:1', BLUESKY, s.deps);
    expect(await p.beforeAdd()).toEqual({ later: first + HOUR });
    expect(await p.nextAt!()).toBe(first + HOUR);
  });

  it('stops after the daily limit even when the hour is quiet, and says when the day allows the next add', async () => {
    const s = setup(100 * HOUR);
    const first = s.now() - 20 * HOUR;
    // 10,000 adds spread over the last 20 hours: fewer than 1,500 in any recent hour.
    const times = Array.from({ length: BLUESKY.perDay }, (_, i) => first + Math.floor((i * 19 * HOUR) / BLUESKY.perDay));
    s.log.set('bluesky:1', times);
    const p = createPacer('bluesky:1', BLUESKY, s.deps);
    expect(await p.beforeAdd()).toEqual({ later: first + DAY });
    expect(await p.nextAt!()).toBe(first + DAY);
  });

  it('answers with the later time when both limits are reached', async () => {
    const s = setup(100 * HOUR);
    const dayStart = s.now() - 23 * HOUR;
    const day = Array.from({ length: BLUESKY.perDay - BLUESKY.perHour }, (_, i) => dayStart + i);
    const hour = Array.from({ length: BLUESKY.perHour }, (_, i) => s.now() - 1000 + i);
    s.log.set('bluesky:1', [...day, ...hour]);
    const p = createPacer('bluesky:1', BLUESKY, s.deps);
    expect(await p.beforeAdd()).toEqual({ later: dayStart + DAY });
  });

  it('allows adds again when the oldest add leaves the day', async () => {
    const s = setup(100 * HOUR);
    s.log.set('bluesky:1', Array.from({ length: BLUESKY.perDay }, (_, i) => s.now() - DAY + 1000 + i));
    const p = createPacer('bluesky:1', BLUESKY, s.deps);
    expect('later' in (await p.beforeAdd())).toBe(true);
    s.tick(2000);
    expect('wait' in (await p.beforeAdd())).toBe(true);
  });
});

describe('pacer with the real store', () => {
  it('remembers adds after an app restart', async () => {
    await closeStore();
    await initStore();
    const first = await createPacer('github:9', GITHUB).beforeAdd();
    expect(first).toEqual({ wait: 0 });
    // A new pacer reads the same log.
    expect(((await createPacer('github:9', GITHUB).beforeAdd()) as { wait: number }).wait).toBeGreaterThan(0);
  });
});
