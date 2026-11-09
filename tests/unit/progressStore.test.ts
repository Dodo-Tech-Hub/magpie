import {
  closeStore,
  deleteAll,
  deleteProgress,
  findProgressForPair,
  getChannels,
  getOrCreateProgress,
  initStore,
  listUnfinished,
  markAlreadyThere,
  markWaitingAsTomorrow,
  releaseTomorrow,
  saveChannels,
  setLimitHit,
  setPicked,
  setStatus,
} from '@/store/progressStore';

const acct = (id: string) => ({ id, email: `${id}@x.com`, name: id, photoUrl: null });
const ch = (id: string) => ({ channelId: id, title: `T-${id}`, thumbnailUrl: null });

async function seed(oldId = 'o1', newId = 'n1', ids = ['a', 'b', 'c']) {
  const pid = await getOrCreateProgress(acct(oldId), acct(newId));
  await saveChannels(pid, ids.map(ch));
  return pid;
}

beforeEach(async () => {
  await closeStore();
  await initStore();
});

describe('progress per account pair', () => {
  it('returns the same progress for the same pair and a new one for another pair', async () => {
    const p1 = await getOrCreateProgress(acct('o1'), acct('n1'));
    const p1again = await getOrCreateProgress(acct('o1'), acct('n1'));
    const p2 = await getOrCreateProgress(acct('o2'), acct('n1'));
    expect(p1again).toBe(p1);
    expect(p2).not.toBe(p1);
    expect(await findProgressForPair('o1', 'n1')).toBe(p1);
    expect(await findProgressForPair('o9', 'n9')).toBeNull();
  });
});

describe('channels', () => {
  it('saves channels picked and waiting by default', async () => {
    const pid = await seed();
    const rows = await getChannels(pid);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.picked && r.status === 'waiting')).toBe(true);
  });

  it('keeps picks and statuses when the same list is saved again', async () => {
    const pid = await seed();
    await setPicked(pid, ['a'], false);
    await setStatus(pid, 'b', 'moved');
    await saveChannels(pid, ['a', 'b', 'c', 'd'].map(ch));
    const rows = Object.fromEntries((await getChannels(pid)).map((r) => [r.channelId, r]));
    expect(rows.a.picked).toBe(false);
    expect(rows.b.status).toBe('moved');
    expect(rows.d.status).toBe('waiting');
  });

  it('marks already-followed channels and unpicks them', async () => {
    const pid = await seed();
    await markAlreadyThere(pid, ['a', 'zzz']);
    const a = (await getChannels(pid)).find((r) => r.channelId === 'a')!;
    expect(a.status).toBe('already_there');
    expect(a.picked).toBe(false);
  });

  it('does not change a channel that is already moved', async () => {
    const pid = await seed();
    await setStatus(pid, 'a', 'moved');
    await markAlreadyThere(pid, ['a']);
    expect((await getChannels(pid)).find((r) => r.channelId === 'a')!.status).toBe('moved');
  });

  it('turns picked waiting channels into tomorrow and back', async () => {
    const pid = await seed();
    await setPicked(pid, ['c'], false);
    await setStatus(pid, 'a', 'moved');
    await markWaitingAsTomorrow(pid);
    let s = Object.fromEntries((await getChannels(pid)).map((r) => [r.channelId, r.status]));
    expect(s).toEqual({ a: 'moved', b: 'tomorrow', c: 'waiting' });
    await releaseTomorrow(pid);
    s = Object.fromEntries((await getChannels(pid)).map((r) => [r.channelId, r.status]));
    expect(s).toEqual({ a: 'moved', b: 'waiting', c: 'waiting' });
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
    expect(list[0].oldAccount.email).toBe('o1@x.com');
    expect(list[0].newAccount.email).toBe('n1@x.com');
  });

  it('records when the daily limit was hit', async () => {
    const pid = await seed();
    await setLimitHit(pid, 123);
    expect((await listUnfinished())[0].limitHitAt).toBe(123);
  });
});

describe('deleting', () => {
  it('deleting a progress removes its channels too', async () => {
    const pid = await seed();
    await deleteProgress(pid);
    expect(await getChannels(pid)).toEqual([]);
    expect(await listUnfinished()).toEqual([]);
  });

  it('delete all removes every progress', async () => {
    await seed('o1', 'n1');
    await seed('o2', 'n2');
    await deleteAll();
    expect(await listUnfinished()).toEqual([]);
  });
});
