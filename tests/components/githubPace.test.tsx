import { fireEvent, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { recordAdd } from '@/store/progressStore';
import { answerReminder, eventually, githubWorld, person, renderGithub, repo, resetGithub, seconds, signInBoth } from './githubWorld';

let w: ReturnType<typeof githubWorld>;
const scheduled = Notifications.scheduleNotificationAsync as jest.Mock;
const permission = Notifications.getPermissionsAsync as jest.Mock;
const request = Notifications.requestPermissionsAsync as jest.Mock;
const BREAK = "GitHub needs a break. We'll remind you when you can move the rest.";
const PUT = 'PUT https://api.github.com/*';

beforeEach(async () => {
  jest.useFakeTimers();
  await resetGithub();
  answerReminder('Yes');
  permission.mockResolvedValue({ granted: false, canAskAgain: true });
  request.mockImplementation(async () => {
    permission.mockResolvedValue({ granted: true, canAskAgain: true });
    return { granted: true };
  });
  w = githubWorld();
});
afterEach(() => jest.useRealTimers());

const stars = (n: number) => Array.from({ length: n }, (_, i) => repo(i + 1));
const move = async (label: string) => fireEvent.press(await screen.findByLabelText(label));
const puts = () => w.gh.calls.filter((c) => c.method === 'PUT');

describe('time left', () => {
  it.each([
    [80, 'About 4 minutes'],
    [10, 'Less than a minute'],
    [20, 'About 1 minute'],
    [301, 'More than one session'],
  ])('shows it for %i items before Move', async (n, text) => {
    w.data.old.stars = stars(n);
    await renderGithub();
    await signInBoth(w);
    expect(screen.getByText(text)).toBeTruthy();
  });
});

describe('waits', () => {
  it('waits and goes on after a short wait, with the row still Moving and no message', async () => {
    w.data.old.stars = stars(1);
    await renderGithub();
    await signInBoth(w);
    w.gh.set(PUT, [{ status: 403, headers: { 'retry-after': '30' }, json: { message: 'slow down' } }, { status: 204 }]);
    await move('Move 1 item');
    await seconds(10);
    expect((await screen.findAllByText('Moving…')).length).toBeGreaterThan(0);
    expect(screen.queryByText(BREAK)).toBeNull();
    expect(await eventually('1 moved')).toBeTruthy();
    expect(puts()).toHaveLength(2);
  });

  it('stops on a long wait: rest is Later, the message shows, one reminder is set an hour on', async () => {
    w.data.old.stars = stars(3);
    await renderGithub();
    await signInBoth(w);
    w.gh.set(PUT, [{ status: 204 }, { status: 403, headers: { 'retry-after': '3600' }, json: { message: 'limit' } }]);
    await move('Move 3 items');
    expect(await eventually(BREAK)).toBeTruthy();
    expect(screen.getAllByText('Later')).toHaveLength(2);
    expect(screen.getByText('1 moved · 2 waiting')).toBeTruthy();
    expect(scheduled).toHaveBeenCalledTimes(1);
    const at = scheduled.mock.calls[0][0].trigger.date.getTime();
    expect(at).toBeGreaterThan(Date.now() + 3_500_000);
    expect(scheduled.mock.calls[0][0].content.body).toBe('You can move the rest now.');
  });

  it('waits 60 seconds once when there is no time, then stops as Later one hour on', async () => {
    w.data.old.stars = stars(2);
    await renderGithub();
    await signInBoth(w);
    w.gh.set(PUT, { status: 403, json: { message: 'You have exceeded a secondary rate limit' } });
    await move('Move 2 items');
    expect(await eventually(BREAK)).toBeTruthy();
    expect(puts()).toHaveLength(2);
    expect(puts()[1].at - puts()[0].at).toBeGreaterThanOrEqual(60_000);
  });

  it('stops the same way when 300 adds are done in the last hour', async () => {
    w.data.old.stars = stars(3);
    await renderGithub();
    await signInBoth(w);
    for (let i = 0; i < 299; i += 1) await recordAdd('github:2', Date.now() - 1000 - i);
    await move('Move 3 items');
    expect(await eventually(BREAK)).toBeTruthy();
    expect(puts()).toHaveLength(1);
    expect(screen.getAllByText('Later')).toHaveLength(2);
  });
});

describe('continuing', () => {
  it('shows Continue on Home, and Continue moves only the rest with no item moved twice', async () => {
    w.data.old.stars = stars(3);
    await renderGithub();
    await signInBoth(w);
    w.gh.set(PUT, [{ status: 204 }, { status: 403, headers: { 'retry-after': '3600' }, json: { message: 'limit' } }]);
    await move('Move 3 items');
    await eventually(BREAK);
    await fireEvent.press(screen.getByLabelText('Home'));
    expect(await screen.findByLabelText('Continue GitHub, 2 left')).toBeTruthy();
    await seconds(3601);
    w.gh.set(PUT, { status: 204 });
    const before = puts().length;
    await fireEvent.press(screen.getByLabelText('Continue GitHub, 2 left'));
    await fireEvent.press(await screen.findByLabelText('Move 2 items'));
    expect(await eventually('3 moved')).toBeTruthy();
    const urls = puts().map((c) => c.url);
    expect(urls.filter((u) => u.endsWith('/r1'))).toHaveLength(1);
    expect(urls.length - before).toBe(2);
  });
});

describe('a paused account', () => {
  it('stops after three 403 answers in a row that are not rate limits, with no more adds', async () => {
    w.data.old.stars = stars(5);
    await renderGithub();
    await signInBoth(w);
    w.gh.set(PUT, { status: 403, json: { message: 'Forbidden' } });
    await move('Move 5 items');
    expect(await eventually("GitHub paused your account's activity. Try again later.")).toBeTruthy();
    expect(puts()).toHaveLength(3);
    expect(screen.getAllByText("Couldn't move")).toHaveLength(2);
    expect(screen.queryByText(BREAK)).toBeNull();
  });
});

describe('losing the internet', () => {
  it('pauses with a message and puts the unfinished rows back to waiting', async () => {
    w.data.old.stars = stars(2);
    await renderGithub();
    await signInBoth(w);
    w.gh.set(PUT, () => {
      throw new Error('offline');
    });
    await move('Move 2 items');
    expect(await eventually("No internet. Try again when you're online.")).toBeTruthy();
    expect(screen.queryByText('Moving…')).toBeNull();
    expect(screen.getByText('0 moved · 2 waiting')).toBeTruthy();
  });
});

describe('people too', () => {
  it('counts a follow as one add', async () => {
    w.data.old.people = [person(1), person(2)];
    await renderGithub();
    await signInBoth(w);
    expect(screen.getByText('Less than a minute')).toBeTruthy();
  });
});
