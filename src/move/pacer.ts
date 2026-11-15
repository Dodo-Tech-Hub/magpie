import type { PaceAnswer, Pacer } from '@/platforms/driver';
import { addsSince, recordAdd } from '@/store/progressStore';

// The pace for GitHub (FR-GH-010, research R9). The log lives in the store, so it survives a restart.
// ponytail: fixed numbers, tune them from real runs if GitHub's limits change
export const GAP_MS = 3000; // 20 per minute
export const PER_HOUR = 300;
const HOUR = 3_600_000;

type Deps = { now: () => number; addsSince: typeof addsSince; recordAdd: typeof recordAdd };

export function createPacer(accountKey: string, deps: Partial<Deps> = {}): Pacer {
  const now = deps.now ?? Date.now;
  const since = deps.addsSince ?? addsSince;
  const record = deps.recordAdd ?? recordAdd;

  // When the hourly pace allows the next add: 0 = now.
  const hourlyAt = (times: number[]) => (times.length >= PER_HOUR ? times[times.length - PER_HOUR] + HOUR : 0);

  return {
    // The only place that records an add. Records it at the time it will happen.
    async beforeAdd(): Promise<PaceAnswer> {
      const t = now();
      const times = await since(accountKey, t - HOUR);
      const later = hourlyAt(times);
      if (later > t) return { later };
      const at = Math.max(t, (times[times.length - 1] ?? 0) + GAP_MS);
      await record(accountKey, at);
      return { wait: at - t };
    },
    async nextAt() {
      return hourlyAt(await since(accountKey, now() - HOUR));
    },
  };
}

// Seconds the adds need at this pace.
export const timeLeft = (adds: number) => (adds * GAP_MS) / 1000;
