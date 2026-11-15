import { Linking } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { getOld, setNew } from '@/auth/githubTokens';
import { addsSince, listUnfinished } from '@/store/progressStore';
import { __dump } from '../mocks/expoSecureStore';
import { answerReminder, eventually, githubWorld, person, renderGithub, repo, resetGithub, seconds, signInBoth } from './githubWorld';

let w: ReturnType<typeof githubWorld>;
const NOTE = "Magpie's access ends on its own within 8 hours. To end it now, open GitHub settings.";
const BREAK = "GitHub needs a break. We'll remind you when you can move the rest.";
const PUT = 'PUT https://api.github.com/*';

beforeEach(async () => {
  jest.useFakeTimers();
  await resetGithub();
  w = githubWorld();
});
afterEach(() => jest.useRealTimers());

const stars = (n: number) => Array.from({ length: n }, (_, i) => repo(i + 1));
const move = async (label: string) => fireEvent.press(await screen.findByLabelText(label));
const openTo = () => fireEvent.press(screen.getByRole('tab', { name: 'To' }));
const openFrom = () => fireEvent.press(screen.getByRole('tab', { name: 'From' }));
const openUrl = Linking.openURL as jest.Mock;

describe('tokens on the phone', () => {
  it('holds no token for the old account once its list is read, and never writes it down', async () => {
    w.data.old.stars = stars(1);
    w.signIn('old');
    await renderGithub();
    await fireEvent.press(screen.getByLabelText('Sign in with GitHub: Old account'));
    await seconds(2);
    await screen.findByLabelText('o/r1');
    expect(getOld()).toBeNull();
    expect(__dump()).toEqual({});
  });

  it('keeps the new account token while a move is unfinished, and a paused move continues with it', async () => {
    w.data.old.stars = stars(2);
    await renderGithub();
    await signInBoth(w);
    answerReminder('No');
    w.gh.set(PUT, [{ status: 204 }, { status: 403, headers: { 'retry-after': '3600' }, json: { message: 'limit' } }]);
    await move('Move 2 items');
    await eventually(BREAK);
    expect(Object.keys(__dump())).toEqual(['github.new']);
    await seconds(3601);
    w.gh.set(PUT, { status: 204 });
    await fireEvent.press(screen.getByLabelText('Continue'));
    expect(await eventually('2 moved')).toBeTruthy();
  });

  it('deletes the new account token when the summary shows', async () => {
    w.data.old.stars = stars(1);
    await renderGithub();
    await signInBoth(w);
    expect(Object.keys(__dump())).toEqual(['github.new']);
    await move('Move 1 item');
    await eventually('1 moved');
    expect(__dump()).toEqual({});
  });

  it('never stores the refresh token', async () => {
    w.data.old.stars = stars(1);
    await renderGithub();
    await signInBoth(w);
    expect(JSON.stringify(__dump())).not.toContain('refresh');
    expect(JSON.stringify(__dump())).not.toContain('ghr_refresh');
  });
});

describe('Sign out', () => {
  it('deletes the token and shows the step signed out with a Sign in button', async () => {
    w.data.old.stars = stars(1);
    await renderGithub();
    await signInBoth(w);
    await openTo();
    await fireEvent.press(screen.getByLabelText('Sign out New account'));
    expect(__dump()).toEqual({});
    expect(await screen.findByLabelText('Sign in with GitHub: New account')).toBeTruthy();
  });

  it('shows the remove-access line and button on To after Sign out, and the button opens GitHub settings', async () => {
    w.data.old.stars = stars(1);
    await renderGithub();
    await signInBoth(w);
    await openTo();
    expect(screen.queryByText(NOTE)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Sign out New account'));
    expect(await screen.findByText(NOTE)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Open GitHub settings'));
    expect(openUrl).toHaveBeenCalledWith('https://github.com/settings/applications');
  });

  it('signs the old account out too, and the Pick list goes', async () => {
    w.data.old.stars = stars(1);
    await renderGithub();
    await signInBoth(w);
    await openFrom();
    await fireEvent.press(screen.getByLabelText('Sign out Old account'));
    expect(await screen.findByLabelText('Sign in with GitHub: Old account')).toBeTruthy();
  });
});

describe('the summary and Settings', () => {
  it('shows the line and the button on the summary after a finished move', async () => {
    w.data.old.stars = stars(1);
    await renderGithub();
    await signInBoth(w);
    await move('Move 1 item');
    await eventually('1 moved');
    expect(screen.getByText(NOTE)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Open GitHub settings'));
    expect(openUrl).toHaveBeenCalledWith('https://github.com/settings/applications');
  });

  it('shows the same button in Settings next to Delete all', async () => {
    await renderGithub();
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(screen.getByText(NOTE)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Open GitHub settings'));
    expect(openUrl).toHaveBeenCalledWith('https://github.com/settings/applications');
  });

  it('Delete all leaves no GitHub account, token, list, progress, or add log', async () => {
    w.data.old.stars = stars(2);
    await renderGithub();
    await signInBoth(w);
    w.gh.set(PUT, [{ status: 204 }, { status: 403, headers: { 'retry-after': '3600' }, json: { message: 'limit' } }]);
    answerReminder('No');
    await move('Move 2 items');
    await eventually(BREAK);
    expect((await listUnfinished()).length).toBe(1);
    expect((await addsSince('github:2', 0)).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByLabelText('Settings'));
    answerReminder('Delete');
    await fireEvent.press(screen.getByLabelText('Delete all my data'));
    await seconds(1);
    expect(__dump()).toEqual({});
    expect(await listUnfinished()).toEqual([]);
    expect(await addsSince('github:2', 0)).toEqual([]);
    expect(getOld()).toBeNull();
  });
});

describe('when the token runs out', () => {
  it('shows the sign-in message and keeps the progress', async () => {
    w.data.old.people = [person(5), person(6)];
    await renderGithub();
    await signInBoth(w);
    w.gh.set(PUT, { status: 401, json: { message: 'Bad credentials' } });
    await move('Move 2 items');
    expect(await eventually('Your sign-in ran out. Sign in again to keep going.')).toBeTruthy();
    expect((await listUnfinished()).length).toBe(1);
  });

  it('is not usable once its time has passed', async () => {
    w.data.old.people = [person(1)];
    await renderGithub();
    await signInBoth(w);
    await setNew({ token: 'tok-new', accountId: '2', scopes: ['user'], expiresAt: Date.now() - 1 });
    await move('Move 1 item');
    expect(await screen.findByText('Sign in to your new account first')).toBeTruthy();
  });
});
