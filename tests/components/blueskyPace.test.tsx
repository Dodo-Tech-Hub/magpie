import { fireEvent, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { recordAdd } from '@/store/progressStore';
import { NEW, OLD, answerReminder, blueskyWorld, eventually, renderBluesky, resetBluesky, seconds, signInNewAccount, signInWithHandle } from './blueskyWorld';
import { rateLimited } from '../mocks/blueskyFetch';

jest.mock('@atproto/oauth-client', () => ({
  ...jest.requireActual('@atproto/oauth-client'),
  OAuthClient: require('../mocks/oauthClient').OAuthClient,
}));

let w: ReturnType<typeof blueskyWorld>;
const scheduled = Notifications.scheduleNotificationAsync as jest.Mock;
const permission = Notifications.getPermissionsAsync as jest.Mock;
const request = Notifications.requestPermissionsAsync as jest.Mock;
const BREAK = 'Bluesky lets Magpie move only some items each hour and each day. Magpie must wait a little.';
const FOLLOW = 'POST https://morel.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord';
const KEY = `bluesky:${NEW.did}`;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

beforeEach(async () => {
  jest.useFakeTimers();
  await resetBluesky();
  answerReminder('Yes');
  permission.mockResolvedValue({ granted: false, canAskAgain: true });
  request.mockImplementation(async () => {
    permission.mockResolvedValue({ granted: true, canAskAgain: true });
    return { granted: true };
  });
  w = blueskyWorld();
});
afterEach(() => {
  jest.useRealTimers();
});

// Follow numbers newest first: 1..n.
const follows = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const move = async (label: string) => fireEvent.press(await screen.findByLabelText(label));
async function openPick(n: number) {
  w.data.old.follows = follows(n);
  await renderBluesky();
  await signInWithHandle('Old account', OLD.handle);
  await screen.findByRole('checkbox', { name: 'All' });
  await signInNewAccount();
}
const writes = () => w.writes.filter((x) => x.collection === 'app.bsky.graph.follow');

describe('time left', () => {
  it.each([
    [10, 'Less than a minute'],
    [600, 'About 2 minutes'],
    [1501, 'More than one session'],
  ])('shows it for %i items before Move', async (n, text) => {
    await openPick(n);
    expect(screen.getByText(text)).toBeTruthy();
  });
});

describe('pace', () => {
  it('adds at least 120 ms apart', async () => {
    await openPick(5);
    const at: number[] = [];
    w.f.set(FOLLOW, () => {
      at.push(Date.now());
      return { json: { uri: 'at://x', cid: 'c' } };
    });
    await move('Move 5 items');
    expect(await eventually('5 moved')).toBeTruthy();
    expect(at).toHaveLength(5);
    expect(at.every((t, i) => i === 0 || t - at[i - 1] >= 120)).toBe(true);
  });
});

describe('waits', () => {
  it('waits and goes on after a short wait, with the row still Moving and no message', async () => {
    await openPick(1);
    w.answerNext('app.bsky.graph.follow', rateLimited(30));
    await move('Move 1 item');
    await seconds(10);
    expect((await screen.findAllByText('Moving…')).length).toBeGreaterThan(0);
    expect(screen.queryByText(BREAK)).toBeNull();
    expect(await eventually('1 moved')).toBeTruthy();
  });

  it('stops on a long wait: the rest is Later, the reason shows, and one reminder is set for the time Bluesky gave', async () => {
    await openPick(3);
    w.answerNext('app.bsky.graph.follow', 'ok', rateLimited(1200));
    await move('Move 3 items');
    expect(await eventually(BREAK)).toBeTruthy();
    expect(writes()).toHaveLength(1);
    expect(screen.getAllByText('Later')).toHaveLength(2);
    expect(scheduled).toHaveBeenCalledTimes(1);
    const at = scheduled.mock.calls[0][0].trigger.date.getTime();
    expect(at).toBeGreaterThan(Date.now() + 1_100_000);
    expect(at).toBeLessThan(Date.now() + 1_300_000);
    expect(scheduled.mock.calls[0][0].content.body).toBe('You can move the rest now.');
  });

  it('stops for an hour when Bluesky gives no time', async () => {
    await openPick(2);
    w.f.set(FOLLOW, { status: 429, json: { error: 'RateLimitExceeded' } });
    await move('Move 2 items');
    expect(await eventually(BREAK)).toBeTruthy();
    const at = scheduled.mock.calls[0][0].trigger.date.getTime();
    expect(at).toBeGreaterThan(Date.now() + HOUR - 5000);
  });
});

describe('the limits of the pace', () => {
  it('stops when 1,500 adds are done in the last hour, and sets the reminder for when the hour allows the next add', async () => {
    await openPick(3);
    const oldest = Date.now() - 2000;
    for (let i = 0; i < 1500; i += 1) await recordAdd(KEY, oldest + i, DAY);
    await move('Move 3 items');
    expect(await eventually(BREAK)).toBeTruthy();
    expect(writes()).toHaveLength(0);
    expect(screen.getAllByText('Later')).toHaveLength(3);
    const at = scheduled.mock.calls[0][0].trigger.date.getTime();
    expect(Math.abs(at - (oldest + HOUR))).toBeLessThan(2000);
  });

  it('stops when 10,000 adds are done in the last day even though the last hour is quiet', async () => {
    await openPick(2);
    const oldest = Date.now() - 20 * HOUR;
    for (let i = 0; i < 10_000; i += 1) await recordAdd(KEY, oldest + Math.floor((i * 18 * HOUR) / 10_000), DAY);
    await move('Move 2 items');
    expect(await eventually(BREAK)).toBeTruthy();
    expect(writes()).toHaveLength(0);
    const at = scheduled.mock.calls[0][0].trigger.date.getTime();
    expect(Math.abs(at - (oldest + DAY))).toBeLessThan(2000);
  });
});

describe('continuing', () => {
  it('shows Continue on Home, and Continue moves only the rest with no item moved twice', async () => {
    await openPick(3);
    w.answerNext('app.bsky.graph.follow', 'ok', rateLimited(3600));
    await move('Move 3 items');
    await eventually(BREAK);
    expect(writes()).toHaveLength(1);
    await fireEvent.press(screen.getByLabelText('Home'));
    expect(await screen.findByLabelText('Continue Bluesky, 2 left')).toBeTruthy();
    await seconds(3601);
    await fireEvent.press(screen.getByLabelText('Continue Bluesky, 2 left'));
    await fireEvent.press(await screen.findByLabelText('Move 2 items'));
    expect(await eventually('3 moved')).toBeTruthy();
    const subjects = writes().map((x) => x.record.subject);
    expect(subjects).toHaveLength(3);
    expect(new Set(subjects).size).toBe(3);
  });
});
