import { subscribe } from '@/api/youtube';
import {
  getChannels,
  markWaitingAsTomorrow,
  setLimitHit,
  setStatus,
} from '@/store/progressStore';

export type MoveResult = 'done' | 'limit' | 'auth' | 'offline';

export type MoveOptions = {
  getToken: (staleToken?: string) => Promise<string>;
  onUpdate?: () => void;
  sleep?: (ms: number) => Promise<void>;
  // Development test switch: pretend the daily limit hits after this many follows.
  simulateQuotaAfter?: number;
};

const RETRY_WAITS = [1000, 4000];
const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function devQuotaSwitch(): number | undefined {
  if (!__DEV__) return undefined;
  const n = Number(process.env.EXPO_PUBLIC_SIMULATE_QUOTA_AFTER);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

// Sequential on purpose: each status is saved before and after its request (research R5).
export async function runMove(progressId: string, opts: MoveOptions): Promise<MoveResult> {
  const sleep = opts.sleep ?? realSleep;
  const notify = () => opts.onUpdate?.();
  const simulate = opts.simulateQuotaAfter ?? devQuotaSwitch();
  const todo = (await getChannels(progressId)).filter((c) => c.picked && c.status === 'waiting');
  let followed = 0;

  const hitLimit = async (channelId: string): Promise<MoveResult> => {
    await setStatus(progressId, channelId, 'tomorrow');
    await markWaitingAsTomorrow(progressId);
    await setLimitHit(progressId, Date.now());
    notify();
    return 'limit';
  };

  for (const channel of todo) {
    await setStatus(progressId, channel.channelId, 'moving');
    notify();

    if (simulate !== undefined && followed >= simulate) return hitLimit(channel.channelId);

    let token = await opts.getToken();
    let refreshed = false;
    let retries = 0;
    let outcome = await subscribe(token, channel.channelId);

    for (;;) {
      if (outcome.kind === 'auth' && !refreshed) {
        refreshed = true;
        token = await opts.getToken(token);
      } else if (outcome.kind === 'retry' && retries < RETRY_WAITS.length) {
        await sleep(RETRY_WAITS[retries]);
        retries += 1;
      } else {
        break;
      }
      outcome = await subscribe(token, channel.channelId);
    }

    if (outcome.kind === 'auth' || outcome.kind === 'retry') {
      await setStatus(progressId, channel.channelId, 'waiting');
      notify();
      return outcome.kind === 'auth' ? 'auth' : 'offline';
    }
    if (outcome.kind === 'tomorrow') return hitLimit(channel.channelId);

    await setStatus(progressId, channel.channelId, outcome.kind);
    if (outcome.kind === 'moved') followed += 1;
    notify();
  }
  return 'done';
}

// A channel left in "moving" means the app stopped mid-request (research R5, SC-004).
// If the new account follows it, it is moved. Otherwise it goes back to waiting.
export async function recoverInterrupted(progressId: string, followedIds: Set<string>) {
  for (const c of await getChannels(progressId)) {
    if (c.status === 'moving') {
      await setStatus(progressId, c.channelId, followedIds.has(c.channelId) ? 'moved' : 'waiting');
    }
  }
}
