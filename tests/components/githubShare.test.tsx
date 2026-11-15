import { fireEvent, screen } from '@testing-library/react-native';
import { gist, githubWorld, gqlList, person, renderGithub, repo, resetGithub, seconds, signInBoth, eventually, OLD } from './githubWorld';

let w: ReturnType<typeof githubWorld>;

beforeEach(async () => {
  jest.useFakeTimers();
  await resetGithub();
  w = githubWorld();
  w.data.old.stars = [repo(1)];
  w.data.old.lists = [gqlList('L1', 'Work', [1])];
  w.data.old.gists = [gist('g1', 'My gist')];
  w.data.old.people = [person(7, 'bob')];
});
afterEach(() => jest.useRealTimers());

const scopes = () =>
  w.gh
    .callsTo('POST', 'https://github.com/login/device/code')
    .map((c) => String((c.body as { scope: string }).scope).split(' ').filter(Boolean).sort());
const checked = (name: string) => screen.getByRole('checkbox', { name }).props.accessibilityState;
const toggle = (name: string) => fireEvent.press(screen.getByRole('checkbox', { name }));

async function signInOldThenPick() {
  w.signIn('old');
  await renderGithub();
  await fireEvent.press(screen.getByLabelText('Sign in with GitHub: Old account'));
  await seconds(2);
  await screen.findByRole('checkbox', { name: 'All' });
}
async function signInNewWith(scope: string, tok = 'tok-new') {
  w.signIn('new', { scope, tok });
  await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
  await fireEvent.press(screen.getByLabelText('Sign in with GitHub: New account'));
  await seconds(2);
  await screen.findByRole('checkbox', { name: 'All' });
}

describe('what the new sign-in asks for', () => {
  it('asks for the access of the picked kinds and never gists', async () => {
    await signInOldThenPick();
    await signInNewWith('public_repo,user');
    expect(scopes()[1]).toEqual(['public_repo', 'user']);
  });

  it('asks only for follow access when only People is picked', async () => {
    await signInOldThenPick();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'All' }));
    await toggle('bob');
    await signInNewWith('user:follow');
    expect(scopes()[1]).toEqual(['user:follow']);
  });

  it('leaves out the access of a kind that is unpicked before the sign-in', async () => {
    await signInOldThenPick();
    await toggle('o/r1');
    await signInNewWith('user');
    expect(scopes()[1]).toEqual(['user']);
  });

  it('asks for no scope for the old account', async () => {
    await signInOldThenPick();
    expect(scopes()[0]).toEqual([]);
  });
});

describe('a kind without access', () => {
  beforeEach(async () => {
    await signInOldThenPick();
    await signInNewWith('user:follow');
  });

  it('shows greyed out with a line and an Allow button, and its rows cannot be picked', () => {
    expect(screen.getByText('Magpie needs extra access to move stars.')).toBeTruthy();
    expect(screen.getByText('Magpie needs extra access to move gists.')).toBeTruthy();
    expect(screen.getByLabelText('Allow Gists')).toBeTruthy();
    expect(screen.getByLabelText('Allow Stars')).toBeTruthy();
    expect(checked('o/r1')).toMatchObject({ checked: false, disabled: true });
    expect(checked('My gist')).toMatchObject({ checked: false, disabled: true });
    expect(checked('bob')).toMatchObject({ checked: true });
    expect(screen.queryByLabelText('Allow People')).toBeNull();
  });

  it('keeps the Allow button when the greyed section is collapsed', async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Gists, 1' }));
    expect(screen.queryByLabelText('My gist')).toBeNull();
    expect(screen.getByLabelText('Allow Gists')).toBeTruthy();
  });

  it('runs the move for the other kinds and does not count the greyed kind as failed', async () => {
    await fireEvent.press(screen.getByLabelText('Move 1 item'));
    expect(await eventually('1 moved')).toBeTruthy();
    expect(screen.queryByText(/couldn't move/)).toBeNull();
    expect(w.gh.calls.some((c) => c.method === 'PUT' && c.url.includes('/starred/'))).toBe(false);
  });
});

describe('Allow', () => {
  it('signs in again with the earlier access plus that kind, then the rows can be picked and move with the new token', async () => {
    await signInOldThenPick();
    await signInNewWith('public_repo,user');
    expect(screen.getByLabelText('Allow Gists')).toBeTruthy();
    w.signIn('new', { scope: 'public_repo,user,gist', tok: 'tok-new2' });
    await fireEvent.press(screen.getByLabelText('Allow Gists'));
    await seconds(2);
    expect(scopes()[2]).toEqual(['gist', 'public_repo', 'user']);
    expect(screen.queryByLabelText('Allow Gists')).toBeNull();
    expect(checked('My gist')).toMatchObject({ checked: true, disabled: false });
    await fireEvent.press(screen.getByLabelText(/^Move \d+ items$/));
    await eventually(/moved/);
    const star = w.gh.calls.find((c) => c.url.endsWith('/gists/g1/star'));
    expect(star?.auth).toBe('Bearer tok-new2');
  });

  it('refuses a different account', async () => {
    await signInOldThenPick();
    await signInNewWith('public_repo,user');
    w.signIn('new', { scope: 'public_repo,user,gist', tok: 'tok-other', as: OLD });
    await fireEvent.press(screen.getByLabelText('Allow Gists'));
    await seconds(2);
    expect(await screen.findByText('Use your new account here too.')).toBeTruthy();
    expect(screen.getByLabelText('Allow Gists')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/^Move \d+ items$/));
    await eventually(/moved/);
    expect(w.gh.calls.filter((c) => c.method === 'PUT').every((c) => c.auth === 'Bearer tok-new')).toBe(true);
  });

  it('keeps a kind greyed when GitHub grants less than was asked', async () => {
    await signInOldThenPick();
    await signInNewWith('user,user:follow');
    expect(screen.getByLabelText('Allow Stars')).toBeTruthy();
    expect(checked('o/r1')).toMatchObject({ checked: false, disabled: true });
    expect(checked('Work')).toMatchObject({ checked: true });
  });
});
