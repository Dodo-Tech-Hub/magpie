import { runMove } from '@/move/mover';
import { createPacer } from '@/move/pacer';
import { blueskyDriver } from '@/platforms/blueskyDriver';
import { githubDriver } from '@/platforms/githubDriver';
import { closeStore, getItems, getOrCreateProgress, initStore, getProgress, releaseLater, saveItems } from '@/store/progressStore';

const acct = (id: string) => ({ id, handle: id, name: id, photoUrl: null });
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const pace = blueskyDriver.pace!;

beforeEach(async () => {
  await closeStore();
  await initStore();
});

describe('a move of 5,000 items on the Bluesky pace', () => {
  it('finishes across the hourly pauses with no item moved twice and none lost (SC-007)', async () => {
    const pid = await getOrCreateProgress('bluesky', acct('o'), acct('n'));
    const rows = Array.from({ length: 5000 }, (_, i) => ({
      itemId: `person:${i}`,
      kind: 'person',
      title: `P${i}`,
      thumbnailUrl: null,
      data: JSON.stringify({ seq: i }),
    }));
    await saveItems(pid, rows);

    // A clock the test moves, and no real waiting between adds.
    let clock = 1_800_000_000_000;
    const moved: string[] = [];
    const run = () =>
      runMove(pid, {
        add: async (item) => {
          moved.push(item.itemId);
          return { kind: 'moved' };
        },
        pacer: createPacer('bluesky:n', pace, { now: () => clock }),
        itemOrder: blueskyDriver.itemOrder,
        kindOrder: blueskyDriver.moveOrder,
        sleep: async () => undefined,
      });

    const stops: number[] = [];
    for (let session = 0; session < 6 && moved.length < 5000; session += 1) {
      const result = await run();
      if (result === 'limit') {
        stops.push(moved.length);
        // The hour passes (and a little more, for the adds that were spaced out), then Continue.
        clock += HOUR + 200_000;
        await releaseLater(pid);
      }
    }

    expect(stops).toEqual([1500, 3000, 4500]);
    expect(moved).toHaveLength(5000);
    expect(new Set(moved).size).toBe(5000);
    expect((await getItems(pid)).every((c) => c.status === 'moved')).toBe(true);
    expect((await getProgress(pid))?.left).toBe(0);
    // Oldest first: the order of the moves is the order the account made them.
    expect(moved.slice(0, 3)).toEqual(['person:0', 'person:1', 'person:2']);
  });
});

describe('how long the pace keeps an add on record', () => {
  it('keeps Bluesky adds for a day and GitHub adds for an hour', async () => {
    const at = Date.now();
    await createPacer('bluesky:x', pace, { now: () => at }).beforeAdd();
    await createPacer('github:x', githubDriver.pace!, { now: () => at }).beforeAdd();
    const db = await initStore();
    const rows = await db.getAllAsync<{ account_key: string; keep: number }>('SELECT account_key, keep_until - at AS keep FROM add_log ORDER BY account_key');
    expect(rows).toEqual([
      { account_key: 'bluesky:x', keep: DAY },
      { account_key: 'github:x', keep: HOUR },
    ]);
  });
});
