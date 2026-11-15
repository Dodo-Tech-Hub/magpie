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
  it('has YouTube first, ready, and GitHub after it in the Automatic section', () => {
    expect(PLATFORMS.map((p) => p.id)).toEqual(['youtube', 'github']);
    expect(PLATFORMS[0]).toMatchObject({ id: 'youtube', name: 'YouTube', section: 'automatic', ready: true });
    expect(PLATFORMS[1]).toMatchObject({ id: 'github', name: 'GitHub', section: 'automatic', ready: true });
  });

  it('shows GitHub on Home after YouTube', () => {
    expect(readyBySection(PLATFORMS)[0].platforms.map((p) => p.name)).toEqual(['YouTube', 'GitHub']);
  });

  it('gives GitHub a dark-look logo', () => {
    expect(PLATFORMS[1].logoDark).toBeDefined();
    expect(PLATFORMS[0].logoDark).toBeUndefined();
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

describe('GitHub entry', () => {
  const gh = PLATFORMS[1];

  it('counts only GitHub progresses', async () => {
    const yt = await getOrCreateProgress('youtube', acct('o1'), acct('n1'));
    await saveItems(yt, ['a', 'b'].map(ch));
    const g = await getOrCreateProgress('github', acct('o1'), acct('n1'));
    await saveItems(g, ['c'].map(ch));
    expect(await gh.unfinished()).toEqual({ left: 1, ids: [g] });
  });

  it('opens the GitHub flow', () => {
    const dispatch = jest.fn();
    gh.open(dispatch);
    expect(dispatch).toHaveBeenCalledWith({ type: 'openPlatform', platform: 'github' });
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
