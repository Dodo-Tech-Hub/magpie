import {
  closeStore,
  deleteAll,
  deleteProgress,
  findProgressForPair,
  getItems,
  getOrCreateProgress,
  initStore,
  listUnfinished,
  markAlreadyThere,
  markWaitingAsLater,
  releaseLater,
  saveItems,
  setLimitHit,
  setPicked,
  setStatus,
} from '@/store/progressStore';

const acct = (id: string) => ({ id, handle: `${id}@x.com`, name: id, photoUrl: null });
const ch = (id: string, kind = 'channel') => ({ itemId: id, kind, title: `T-${id}`, thumbnailUrl: null, data: null });

async function seed(oldId = 'o1', newId = 'n1', ids = ['a', 'b', 'c']) {
  const pid = await getOrCreateProgress('youtube', acct(oldId), acct(newId));
  await saveItems(pid, ids.map(ch));
  return pid;
}

beforeEach(async () => {
  await closeStore();
  await initStore();
});

describe('progress per account pair', () => {
  it('returns the same progress for the same pair and a new one for another pair', async () => {
    const p1 = await getOrCreateProgress('youtube', acct('o1'), acct('n1'));
    const p1again = await getOrCreateProgress('youtube', acct('o1'), acct('n1'));
    const p2 = await getOrCreateProgress('youtube', acct('o2'), acct('n1'));
    expect(p1again).toBe(p1);
    expect(p2).not.toBe(p1);
    expect(await findProgressForPair('youtube', 'o1', 'n1')).toBe(p1);
    expect(await findProgressForPair('youtube', 'o9', 'n9')).toBeNull();
  });
});

describe('channels', () => {
  it('saves channels picked and waiting by default', async () => {
    const pid = await seed();
    const rows = await getItems(pid);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.picked && r.status === 'waiting')).toBe(true);
  });

  it('keeps picks and statuses when the same list is saved again', async () => {
    const pid = await seed();
    await setPicked(pid, ['a'], false);
    await setStatus(pid, 'b', 'moved');
    await saveItems(pid, ['a', 'b', 'c', 'd'].map(ch));
    const rows = Object.fromEntries((await getItems(pid)).map((r) => [r.itemId, r]));
    expect(rows.a.picked).toBe(false);
    expect(rows.b.status).toBe('moved');
    expect(rows.d.status).toBe('waiting');
  });

  it('marks already-followed channels and unpicks them', async () => {
    const pid = await seed();
    await markAlreadyThere(pid, ['a', 'zzz']);
    const a = (await getItems(pid)).find((r) => r.itemId === 'a')!;
    expect(a.status).toBe('already_there');
    expect(a.picked).toBe(false);
  });

  it('does not change a channel that is already moved', async () => {
    const pid = await seed();
    await setStatus(pid, 'a', 'moved');
    await markAlreadyThere(pid, ['a']);
    expect((await getItems(pid)).find((r) => r.itemId === 'a')!.status).toBe('moved');
  });

  it('turns picked waiting channels into tomorrow and back', async () => {
    const pid = await seed();
    await setPicked(pid, ['c'], false);
    await setStatus(pid, 'a', 'moved');
    await markWaitingAsLater(pid);
    let s = Object.fromEntries((await getItems(pid)).map((r) => [r.itemId, r.status]));
    expect(s).toEqual({ a: 'moved', b: 'later', c: 'waiting' });
    await releaseLater(pid);
    s = Object.fromEntries((await getItems(pid)).map((r) => [r.itemId, r.status]));
    expect(s).toEqual({ a: 'moved', b: 'waiting', c: 'waiting' });
  });
});

describe('platforms, reasons, and order', () => {
  it('keeps the same two accounts on two platforms as two progresses', async () => {
    const a = await getOrCreateProgress('youtube', acct('o'), acct('n'));
    const b = await getOrCreateProgress('github', acct('o'), acct('n'));
    expect(b).not.toBe(a);
    await saveItems(a, [ch('x')]);
    await saveItems(b, [ch('y')]);
    expect((await listUnfinished('github')).map((p) => p.id)).toEqual([b]);
    expect((await listUnfinished('youtube')).map((p) => p.id)).toEqual([a]);
    expect(await listUnfinished()).toHaveLength(2);
  });

  it('saves the reason with a status and clears it with the next status', async () => {
    const pid = await seed();
    await setStatus(pid, 'a', 'couldnt_move', 'Account was deleted.');
    expect((await getItems(pid)).find((r) => r.itemId === 'a')!.reason).toBe('Account was deleted.');
    await setStatus(pid, 'a', 'waiting');
    expect((await getItems(pid)).find((r) => r.itemId === 'a')!.reason).toBeNull();
  });

  it('saves when the limit was hit and when the move can go on', async () => {
    const pid = await seed();
    await setLimitHit(pid, 1, 2);
    expect(await listUnfinished()).toMatchObject([{ limitHitAt: 1, resumeAt: 2 }]);
  });

  it('reads an unknown status as waiting', async () => {
    const pid = await seed();
    const db = await initStore();
    await db.runAsync("UPDATE progress_item SET status = 'from_the_future' WHERE item_id = 'a'");
    expect((await getItems(pid)).find((r) => r.itemId === 'a')!.status).toBe('waiting');
  });

  it('sorts by the position of the kind, then by title ignoring case', async () => {
    const pid = await getOrCreateProgress('github', acct('o'), acct('n'));
    await saveItems(pid, [
      { itemId: '1', kind: 'person', title: 'bob', thumbnailUrl: null, data: null },
      { itemId: '2', kind: 'repo', title: 'Zed', thumbnailUrl: null, data: null },
      { itemId: '3', kind: 'repo', title: 'apple', thumbnailUrl: null, data: null },
      { itemId: '4', kind: 'person', title: 'Amy', thumbnailUrl: null, data: null },
    ]);
    expect((await getItems(pid, ['repo', 'person'])).map((r) => r.title)).toEqual(['apple', 'Zed', 'Amy', 'bob']);
    expect((await getItems(pid, ['person', 'repo'])).map((r) => r.title)).toEqual(['Amy', 'bob', 'apple', 'Zed']);
  });
});

describe('unfinished list', () => {
  it('counts picked waiting and tomorrow channels and hides finished progresses', async () => {
    const p1 = await seed('o1', 'n1', ['a', 'b', 'c']);
    await setStatus(p1, 'a', 'moved');
    await setStatus(p1, 'b', 'couldnt_move');
    const p2 = await seed('o2', 'n2', ['x']);
    await setStatus(p2, 'x', 'moved');
    const list = await listUnfinished();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: p1, left: 1 });
    expect(list[0].oldAccount.handle).toBe('o1@x.com');
    expect(list[0].newAccount.handle).toBe('n1@x.com');
  });

  it('records when the daily limit was hit', async () => {
    const pid = await seed();
    await setLimitHit(pid, 123, 456);
    expect((await listUnfinished())[0].limitHitAt).toBe(123);
  });
});

describe('deleting', () => {
  it('deleting a progress removes its channels too', async () => {
    const pid = await seed();
    await deleteProgress(pid);
    expect(await getItems(pid)).toEqual([]);
    expect(await listUnfinished()).toEqual([]);
  });

  it('delete all removes every progress', async () => {
    await seed('o1', 'n1');
    await seed('o2', 'n2');
    await deleteAll();
    expect(await listUnfinished()).toEqual([]);
  });
});
