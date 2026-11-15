import { Linking } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { NEW, OLD, githubWorld, renderGithub, resetGithub, seconds } from './githubWorld';

let w: ReturnType<typeof githubWorld>;

beforeEach(async () => {
  jest.useFakeTimers();
  await resetGithub();
  w = githubWorld();
});
afterEach(() => jest.useRealTimers());

const signInOld = () => fireEvent.press(screen.getByLabelText('Sign in with GitHub: Old account'));
const openTo = () => fireEvent.press(screen.getByRole('tab', { name: 'To' }));
const openFrom = () => fireEvent.press(screen.getByRole('tab', { name: 'From' }));
const signInNew = () => fireEvent.press(screen.getByLabelText('Sign in with GitHub: New account'));
const HINT_NEW = "GitHub may show your old account. Tap your picture, then 'Switch account', to use your new one.";

describe('the code', () => {
  it('shows the code in large text, copies it, and opens the sign-in page', async () => {
    w.signIn('old', { pending: 5 });
    await renderGithub();
    await signInOld();
    await seconds(0);
    expect(await screen.findByText('ABCD-1234')).toBeTruthy();
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('ABCD-1234');
    expect(Linking.openURL).toHaveBeenCalledWith('https://github.com/login/device');
  });

  it('reads the code one character at a time', async () => {
    w.signIn('old', { pending: 5 });
    await renderGithub();
    await signInOld();
    await seconds(0);
    expect(await screen.findByLabelText('Code A B C D dash 1 2 3 4')).toBeTruthy();
  });

  it('has a Copy button that copies again', async () => {
    w.signIn('old', { pending: 5 });
    await renderGithub();
    await signInOld();
    await seconds(0);
    (Clipboard.setStringAsync as jest.Mock).mockClear();
    await fireEvent.press(await screen.findByLabelText('Copy code'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('ABCD-1234');
  });
});

describe('finishing', () => {
  it('shows the account with its name when the user allows it, with no extra tap', async () => {
    w.signIn('old', { pending: 2 });
    await renderGithub();
    await signInOld();
    await seconds(1);
    expect(await screen.findByText('ABCD-1234')).toBeTruthy();
    await seconds(5);
    await screen.findByText('This account doesn\'t follow anything yet');
    await openFrom();
    expect(await screen.findByText('old-me')).toBeTruthy();
    expect(screen.queryByText('ABCD-1234')).toBeNull();
  });

  it('shows no switch hint on the first sign-in', async () => {
    w.signIn('old', { pending: 5 });
    await renderGithub();
    await signInOld();
    await seconds(0);
    await screen.findByText('ABCD-1234');
    expect(screen.queryByText(/Switch account/)).toBeNull();
  });

  it('shows the hint on the second sign-in, whichever step is first', async () => {
    w.signIn('old');
    w.signIn('new', { pending: 5 });
    await renderGithub();
    await signInOld();
    await seconds(2);
    await screen.findByText('This account doesn\'t follow anything yet');
    await openTo();
    await signInNew();
    await seconds(0);
    expect(await screen.findByText(HINT_NEW)).toBeTruthy();
  });

  it('shows the hint when To is signed in first', async () => {
    w.signIn('new');
    w.signIn('old', { pending: 5 });
    await renderGithub();
    await openTo();
    await signInNew();
    await seconds(2);
    await screen.findByText('new-me');
    await openFrom();
    await signInOld();
    await seconds(0);
    expect(await screen.findByText(/to use your old one/)).toBeTruthy();
  });
});

describe('refusing the same account', () => {
  it('refuses the old account on To', async () => {
    w.signIn('old');
    w.signIn('new', { tok: 'tok-new', as: OLD });
    await renderGithub();
    await signInOld();
    await seconds(2);
    await screen.findByText('This account doesn\'t follow anything yet');
    await openTo();
    await signInNew();
    await seconds(2);
    expect(await screen.findByText('This is your old account. Pick a different one.')).toBeTruthy();
    expect(screen.getByLabelText('Sign in with GitHub: New account')).toBeTruthy();
  });

  it('refuses the new account on From', async () => {
    w.signIn('new');
    w.signIn('old', { as: NEW });
    await renderGithub();
    await openTo();
    await signInNew();
    await seconds(2);
    await screen.findByText('new-me');
    await openFrom();
    await signInOld();
    await seconds(2);
    expect(await screen.findByText('This is your new account. Pick a different one.')).toBeTruthy();
  });
});

describe('when it does not finish', () => {
  it('stays signed out with a message when the code runs out', async () => {
    w.signIn('old', { error: 'expired_token' });
    await renderGithub();
    await signInOld();
    await seconds(2);
    expect(await screen.findByText("Sign-in didn't finish. Try again.")).toBeTruthy();
    expect(screen.getByLabelText('Sign in with GitHub: Old account')).toBeTruthy();
    const polls = w.gh.callsTo('POST', 'https://github.com/login/oauth/access_token').length;
    await seconds(30);
    expect(w.gh.callsTo('POST', 'https://github.com/login/oauth/access_token')).toHaveLength(polls);
  });

  it('stays signed out with no message when the user taps Cancel on GitHub', async () => {
    w.signIn('old', { error: 'access_denied' });
    await renderGithub();
    await signInOld();
    await seconds(2);
    expect(await screen.findByLabelText('Sign in with GitHub: Old account')).toBeTruthy();
    expect(screen.queryByText("Sign-in didn't finish. Try again.")).toBeNull();
  });

  it('stops asking and removes the code when the user taps Cancel in the app', async () => {
    w.signIn('old', { pending: 100 });
    await renderGithub();
    await signInOld();
    await seconds(2);
    await screen.findByText('ABCD-1234');
    await fireEvent.press(screen.getByLabelText('Cancel'));
    await seconds(2);
    expect(screen.queryByText('ABCD-1234')).toBeNull();
    expect(screen.getByLabelText('Sign in with GitHub: Old account')).toBeTruthy();
    const polls = w.gh.callsTo('POST', 'https://github.com/login/oauth/access_token').length;
    await seconds(30);
    expect(w.gh.callsTo('POST', 'https://github.com/login/oauth/access_token')).toHaveLength(polls);
  });
});
