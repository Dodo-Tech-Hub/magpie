import { PLATFORMS, driverFor, readyBySection, type Platform } from '@/platforms/platforms';
import { youtubeDriver } from '@/platforms/youtubeDriver';
import { closeStore, getOrCreateProgress, initStore, saveItems } from '@/store/progressStore';

const acct = (id: string) => ({ id, handle: `${id}@x.com`, name: id, photoUrl: null });
const ch = (id: string) => ({ itemId: id, kind: 'channel', title: id, thumbnailUrl: null, data: null });

beforeEach(async () => {
  await closeStore();
  await initStore();
});

describe('platform list', () => {
  it('holds only YouTube at launch, as a ready Automatic platform', () => {
    expect(PLATFORMS).toHaveLength(1);
    const [yt] = PLATFORMS;
    expect(yt).toMatchObject({
      id: 'youtube',
      name: 'YouTube',
      section: 'automatic',
      ready: true,
    });
  });

});

describe('drivers', () => {
  it('gives each platform its driver', () => {
    expect(PLATFORMS.every((p) => p.driver.id === p.id)).toBe(true);
    expect(driverFor('youtube')).toBe(youtubeDriver);
  });
});

describe('readyBySection', () => {
  const make = (id: string, section: Platform['section'], ready: boolean) =>
    ({ ...PLATFORMS[0], id, section, ready }) as Platform;

  it('shows only ready platforms, Automatic first, and drops empty sections', () => {
    const list = [make('g1', 'guided', true), make('a1', 'automatic', true), make('a2', 'automatic', false)];
    const groups = readyBySection(list);
    expect(groups.map((g) => g.section)).toEqual(['automatic', 'guided']);
    expect(groups[0].platforms.map((p) => p.id)).toEqual(['a1']);
  });

  it('hides a section with no ready platform', () => {
    expect(readyBySection([make('g1', 'guided', false), make('a1', 'automatic', true)]).map((g) => g.section)).toEqual([
      'automatic',
    ]);
    expect(readyBySection(PLATFORMS).map((g) => g.section)).toEqual(['automatic']);
  });
});

describe('YouTube entry', () => {
  const yt = PLATFORMS[0];

  it('has nothing unfinished with no progress', async () => {
    expect(await yt.unfinished()).toEqual({ left: 0, ids: [] });
  });

  it('sums what is left across all unfinished progresses', async () => {
    const p1 = await getOrCreateProgress('youtube', acct('o1'), acct('n1'));
    await saveItems(p1, ['a', 'b', 'c'].map(ch));
    const p2 = await getOrCreateProgress('youtube', acct('o2'), acct('n1'));
    await saveItems(p2, ['d', 'e'].map(ch));
    const res = await yt.unfinished();
    expect(res.left).toBe(5);
    expect([...res.ids].sort()).toEqual([p1, p2].sort());
  });

  it('counts only YouTube progresses', async () => {
    const other = await getOrCreateProgress('other', acct('o9'), acct('n9'));
    await saveItems(other, ['z'].map(ch));
    expect(await yt.unfinished()).toEqual({ left: 0, ids: [] });
  });

  it('opens the YouTube flow', () => {
    const dispatch = jest.fn();
    yt.open(dispatch);
    expect(dispatch).toHaveBeenCalledWith({ type: 'openPlatform', platform: 'youtube' });
  });
});
