import { PLATFORMS, readyBySection, type Platform } from '@/platforms/platforms';
import { closeStore, getOrCreateProgress, initStore, saveChannels } from '@/store/progressStore';
import { strings } from '@/strings';

const acct = (id: string) => ({ id, email: `${id}@x.com`, name: id, photoUrl: null });
const ch = (id: string) => ({ channelId: id, title: id, thumbnailUrl: null });

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
      label: strings.youtubeLine,
      section: 'automatic',
      ready: true,
    });
  });

  it('keeps every label to 6 words or fewer (FR-002)', () => {
    for (const p of PLATFORMS) expect(p.label.trim().split(/\s+/).length).toBeLessThanOrEqual(6);
    expect(strings.guidedLine.split(/\s+/).length).toBeLessThanOrEqual(6);
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
    const p1 = await getOrCreateProgress(acct('o1'), acct('n1'));
    await saveChannels(p1, ['a', 'b', 'c'].map(ch));
    const p2 = await getOrCreateProgress(acct('o2'), acct('n1'));
    await saveChannels(p2, ['d', 'e'].map(ch));
    const res = await yt.unfinished();
    expect(res.left).toBe(5);
    expect([...res.ids].sort()).toEqual([p1, p2].sort());
  });

  it('opens the YouTube flow', () => {
    const dispatch = jest.fn();
    yt.open(dispatch);
    expect(dispatch).toHaveBeenCalledWith({ type: 'openPlatform', platform: 'youtube' });
  });
});
