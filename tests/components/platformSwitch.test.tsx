import { Alert } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { listUnfinished } from '@/store/progressStore';
import { answerAlert } from './helpers';
import { githubWorld, person, renderGithub, repo, resetGithub, seconds, signInBoth } from './githubWorld';

let w: ReturnType<typeof githubWorld>;
let alert: jest.SpyInstance;

beforeEach(async () => {
  jest.useFakeTimers();
  await resetGithub();
  w = githubWorld();
  w.data.old.stars = [repo(1), repo(2)];
  w.data.old.people = [person(7, 'bob')];
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  alert.mockRestore();
  jest.useRealTimers();
});

async function oldSignedInOnPick() {
  w.signIn('old');
  await renderGithub();
  await fireEvent.press(screen.getByLabelText('Sign in with GitHub: Old account'));
  await seconds(2);
  await screen.findByRole('checkbox', { name: 'All' });
}
const goHome = () => fireEvent.press(screen.getByRole('button', { name: 'Home' }));
const asked = () => alert.mock.calls.map((c) => c[0]);

describe('switching platforms (FR-GH-022)', () => {
  it('resumes the same flow when the same card is tapped', async () => {
    await oldSignedInOnPick();
    await fireEvent.press(screen.getByLabelText('o/r1'));
    await goHome();
    await fireEvent.press(screen.getByLabelText('GitHub'));
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'o/r1' }).props.accessibilityState.checked).toBe(false);
  });

  it('asks before leaving an unfinished progress for another platform, and Cancel stays on Home', async () => {
    await oldSignedInOnPick();
    await goHome();
    answerAlert(alert, 'Cancel');
    await fireEvent.press(screen.getByLabelText('YouTube'));
    expect(asked()).toEqual(['Save your GitHub progress?']);
    expect(screen.getByText('Automatic')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'From' })).toBeNull();
  });

  it('Save opens the other platform at the start and keeps the GitHub progress', async () => {
    await oldSignedInOnPick();
    await goHome();
    answerAlert(alert, 'Save');
    await fireEvent.press(screen.getByLabelText('YouTube'));
    expect(screen.getByLabelText('Sign in with Google: Old account')).toBeTruthy();
    expect(screen.queryByLabelText('o/r1')).toBeNull();
    await goHome();
    expect(screen.getByText('Continue: 3 left')).toBeTruthy();
    expect(await listUnfinished('github')).toHaveLength(1);
  });

  it("Don't save deletes the progress and opens the other platform at the start", async () => {
    await oldSignedInOnPick();
    await goHome();
    answerAlert(alert, "Don't save");
    await fireEvent.press(screen.getByLabelText('YouTube'));
    expect(screen.getByLabelText('Sign in with Google: Old account')).toBeTruthy();
    expect(await listUnfinished('github')).toEqual([]);
    await goHome();
    expect(screen.queryByText(/Continue:/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('GitHub'));
    expect(screen.getByLabelText('Sign in with GitHub: Old account')).toBeTruthy();
  });

  it('does not ask when nothing is unfinished', async () => {
    await renderGithub();
    await goHome();
    await fireEvent.press(screen.getByLabelText('YouTube'));
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Sign in with Google: Old account')).toBeTruthy();
  });

  it('asks on the Continue note of another platform too', async () => {
    await oldSignedInOnPick();
    await goHome();
    answerAlert(alert, 'Save');
    await fireEvent.press(screen.getByLabelText('YouTube'));
    await goHome();
    // Now the YouTube flow is open with no progress: Continue on GitHub needs no question.
    await fireEvent.press(screen.getByRole('button', { name: /Continue/ }));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('checkbox', { name: 'o/r1' })).toBeTruthy();
  });

  it('keeps a running move going on Save without touching the other platform', async () => {
    await renderGithub();
    await signInBoth(w);
    await fireEvent.press(screen.getByLabelText('Move 3 items'));
    await goHome();
    answerAlert(alert, 'Save');
    await fireEvent.press(screen.getByLabelText('YouTube'));
    await seconds(30);
    expect(screen.getByLabelText('Sign in with Google: Old account')).toBeTruthy();
    expect(screen.queryByText(/Moved/)).toBeNull();
    expect(await listUnfinished('github')).toEqual([]);
  });

  it("Don't save stops a running move before the next item and deletes the progress", async () => {
    await renderGithub();
    await signInBoth(w);
    await fireEvent.press(screen.getByLabelText('Move 3 items'));
    await goHome();
    answerAlert(alert, "Don't save");
    await fireEvent.press(screen.getByLabelText('YouTube'));
    await seconds(30);
    expect(await listUnfinished('github')).toEqual([]);
    expect(screen.getByLabelText('Sign in with Google: Old account')).toBeTruthy();
  });
});
