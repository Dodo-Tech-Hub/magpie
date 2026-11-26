import type { PaceAnswer, Pace, Pacer } from '@/platforms/driver';
import { addsSince, recordAdd } from '@/store/progressStore';

// The pace of a platform (FR-GH-010, FR-BS-010, research R9 and R10). The numbers live in each driver.
// The log lives in the store, so it survives a restart.
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Deps = { now: () => number; addsSince: typeof addsSince; recordAdd: typeof recordAdd };

export function createPacer(accountKey: string, pace: Pace, deps: Partial<Deps> = {}): Pacer {
  const now = deps.now ?? Date.now;
  const since = deps.addsSince ?? addsSince;
  const record = deps.recordAdd ?? recordAdd;
  // With a daily limit the log holds a day of adds, so one read gives both windows.
  const keepMs = pace.perDay ? DAY : HOUR;

  // When the hourly and daily limits allow the next add: 0 = now.
  const allowedAt = (times: number[], t: number) => {
    const hour = times.filter((x) => x >= t - HOUR);
    const hourly = hour.length >= pace.perHour ? hour[hour.length - pace.perHour] + HOUR : 0;
    const daily = pace.perDay && times.length >= pace.perDay ? times[times.length - pace.perDay] + DAY : 0;
    return Math.max(hourly, daily);
  };
  const read = (t: number) => since(accountKey, t - keepMs);

  return {
    // The only place that records an add. Records it at the time it will happen.
    async beforeAdd(): Promise<PaceAnswer> {
      const t = now();
      const times = await read(t);
      const later = allowedAt(times, t);
      if (later > t) return { later };
      const at = Math.max(t, (times[times.length - 1] ?? 0) + pace.gapMs);
      await record(accountKey, at, keepMs);
      return { wait: at - t };
    },
    async nextAt() {
      const t = now();
      return allowedAt(await read(t), t);
    },
  };
}

// Seconds the adds need at this pace.
export const timeLeft = (adds: number, pace: Pace) => (adds * pace.gapMs) / 1000;
