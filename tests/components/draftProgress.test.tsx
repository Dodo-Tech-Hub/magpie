import { fireEvent, screen } from '@testing-library/react-native';
import { listUnfinished } from '@/store/progressStore';
import { githubWorld, person, renderGithub, repo, resetGithub, seconds } from './githubWorld';

let w: ReturnType<typeof githubWorld>;

beforeEach(async () => {
  jest.useFakeTimers();
  await resetGithub();
  w = githubWorld();
  w.data.old.stars = [repo(1), repo(2)];
  w.data.old.people = [person(7, 'bob')];
});
afterEach(() => jest.useRealTimers());

async function signInOld() {
  w.signIn('old');
  await fireEvent.press(screen.getByLabelText('Sign in with GitHub: Old account'));
  await seconds(2);
  await screen.findByRole('checkbox', { name: 'All' });
}
const picked = (name: string) => screen.getByRole('checkbox', { name }).props.accessibilityState.checked;

describe('progress from the old sign-in (FR-GH-021)', () => {
  it('saves picks before the new account signs in', async () => {
    await renderGithub();
    await signInOld();
    await fireEvent.press(screen.getByLabelText('o/r1'));
    expect(await listUnfinished('github')).toMatchObject([{ left: 2, newAccount: null }]);
    await fireEvent.press(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByText('Continue: 2 left')).toBeTruthy();
  });

  it('opens a progress with no new account on Pick, with picks kept', async () => {
    await renderGithub();
    await signInOld();
    await fireEvent.press(screen.getByLabelText('o/r1'));
    await fireEvent.press(screen.getByRole('button', { name: 'Home' }));
    await fireEvent.press(screen.getByRole('button', { name: /Continue/ }));
    expect(await screen.findByRole('checkbox', { name: 'o/r1' })).toBeTruthy();
    expect(picked('o/r1')).toBe(false);
    expect(picked('o/r2')).toBe(true);
    expect(screen.getByRole('tab', { name: 'Pick' }).props.accessibilityValue?.text).toBe('current');
  });

  it('lists it on From as "New account not chosen yet"', async () => {
    await renderGithub();
    await signInOld();
    await fireEvent.press(screen.getByRole('button', { name: 'Home' }));
    await fireEvent.press(screen.getByLabelText('GitHub'));
    await fireEvent.press(screen.getByRole('tab', { name: 'From' }));
    expect(screen.getByText(/New account not chosen yet/)).toBeTruthy();
  });

  it('signing in to the same old account again keeps picks, adds new items, and drops gone ones', async () => {
    await renderGithub();
    await signInOld();
    await fireEvent.press(screen.getByLabelText('o/r1'));
    w.data.old.stars = [repo(1), repo(3)];
    await fireEvent.press(screen.getByRole('tab', { name: 'From' }));
    await fireEvent.press(screen.getByLabelText('Sign out Old account'));
    w.signIn('old');
    await fireEvent.press(screen.getByLabelText('Sign in with GitHub: Old account'));
    await seconds(2);
    await screen.findByRole('checkbox', { name: 'All' });
    expect(picked('o/r1')).toBe(false);
    expect(picked('o/r3')).toBe(true);
    expect(screen.queryByLabelText('o/r2')).toBeNull();
    expect(await listUnfinished('github')).toHaveLength(1);
  });
});
