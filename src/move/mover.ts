import type { Outcome, Pacer } from '@/platforms/driver';
import {
  getItems,
  markWaitingAsLater,
  setLimitHit,
  setStatus,
  type Status,
  type StoredItem,
} from '@/store/progressStore';

export type MoveResult = 'done' | 'limit' | 'auth' | 'offline' | 'stopped';

export type MoveOptions = {
  add: (item: StoredItem, items: StoredItem[], pacer?: Pacer) => Promise<Outcome>;
  pacer?: Pacer;
  // The order items move in (kind IDs). Default: the order they are stored in.
  kindOrder?: string[];
  onUpdate?: () => void;
  // Aborted by "Don't save": the move stops before the next item (FR-GH-022).
  signal?: AbortSignal;
  // The platform paused the account: the notice to show.
  onStop?: (notice: string) => void;
  sleep?: (ms: number) => Promise<void>;
  // Development test switch: pretend the limit hits after this many items.
  simulateQuotaAfter?: number;
};

const RETRY_WAITS = [1000, 4000];
const HOUR = 3_600_000;
const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function devQuotaSwitch(): number | undefined {
  if (!__DEV__) return undefined;
  const n = Number(process.env.EXPO_PUBLIC_SIMULATE_QUOTA_AFTER);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

// Sequential on purpose: each status is saved before and after its request (research R5).
// Waits, pauses, and stops are handled here once, so no driver repeats them.
export async function runMove(progressId: string, opts: MoveOptions): Promise<MoveResult> {
  const sleep = opts.sleep ?? realSleep;
  const notify = () => opts.onUpdate?.();
  const simulate = opts.simulateQuotaAfter ?? devQuotaSwitch();
  const all = await getItems(progressId, opts.kindOrder);
  const todo = all.filter((c) => c.picked && c.status === 'waiting');
  let moved = 0;

  // Keep the list the driver sees in step with the saved statuses.
  const put = async (item: StoredItem, status: Status, reason?: string) => {
    await setStatus(progressId, item.itemId, status, reason);
    item.status = status;
    item.reason = reason ?? null;
  };

  const pause = async (item: StoredItem, resumeAt: number): Promise<MoveResult> => {
    await put(item, 'later');
    await markWaitingAsLater(progressId);
    // The pace may allow the next add later than the platform said. The later time wins.
    const paceAt = (await opts.pacer?.nextAt?.()) ?? 0;
    await setLimitHit(progressId, Date.now(), Math.max(resumeAt, paceAt));
    notify();
    return 'limit';
  };

  for (const item of todo) {
    if (opts.signal?.aborted) return 'stopped';
    await put(item, 'moving');
    notify();

    if (simulate !== undefined && moved >= simulate) return pause(item, Date.now() + HOUR);

    if (opts.pacer) {
      const pace = await opts.pacer.beforeAdd();
      if ('later' in pace) return pause(item, pace.later);
      if (pace.wait > 0) await sleep(pace.wait);
    }

    let retries = 0;
    let waited = false;
    let outcome = await opts.add(item, all, opts.pacer);

    for (;;) {
      if (outcome.kind === 'wait') {
        // A second wait for the same item is a long wait in disguise.
        if (waited) return pause(item, Date.now() + HOUR);
        waited = true;
        await sleep(outcome.ms);
      } else if (outcome.kind === 'retry' && retries < RETRY_WAITS.length) {
        await sleep(RETRY_WAITS[retries]);
        retries += 1;
      } else {
        break;
      }
      outcome = await opts.add(item, all, opts.pacer);
    }

    switch (outcome.kind) {
      case 'auth':
      case 'retry':
        await put(item, 'waiting');
        notify();
        return outcome.kind === 'auth' ? 'auth' : 'offline';
      case 'stop':
        await put(item, 'waiting');
        notify();
        opts.onStop?.(outcome.notice);
        return 'stopped';
      case 'later':
        return pause(item, outcome.resumeAt);
      case 'couldnt_move':
        await put(item, 'couldnt_move', outcome.reason || undefined);
        break;
      case 'moved':
        await put(item, 'moved', outcome.reason);
        moved += 1;
        break;
      default:
        // wait cannot reach here: the loop above consumed it.
        break;
    }
    notify();
  }
  return 'done';
}

// An item left in "moving" means the app stopped mid-request (research R5, SC-004).
// If the new account has it, it is moved. Otherwise it goes back to waiting.
export async function recoverInterrupted(progressId: string, haveIds: Set<string>) {
  for (const c of await getItems(progressId)) {
    if (c.status === 'moving') {
      await setStatus(progressId, c.itemId, haveIds.has(c.itemId) ? 'moved' : 'waiting');
    }
  }
}
