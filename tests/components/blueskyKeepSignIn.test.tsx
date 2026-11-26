import { fireEvent, screen } from '@testing-library/react-native';
import { scopesFor } from '@/auth/bluesky';
import { NEW, OLD, answerReminder, blueskyWorld, eventually, renderBluesky, resetBluesky, signInNewAccount, signInWithHandle } from './blueskyWorld';
import { __dump } from '../mocks/expoSecureStore';
import { mockClient, userSignsInAs } from '../mocks/oauthClient';

jest.mock('@atproto/oauth-client', () => ({
  ...jest.requireActual('@atproto/oauth-client'),
  OAuthClient: require('../mocks/oauthClient').OAuthClient,
}));

beforeEach(async () => {
  jest.useFakeTimers();
  await resetBluesky();
  answerReminder('No');
  blueskyWorld().data.old.follows = [2, 1];
});
afterEach(() => {
  jest.useRealTimers();
});

async function openPick() {
  await renderBluesky();
  await signInWithHandle('Old account', OLD.handle);
  await screen.findByRole('checkbox', { name: 'All' });
}

it('keeps the new account signed in after a move, so a second move needs no new sign-in', async () => {
  await openPick();
  await signInNewAccount();
  await fireEvent.press(screen.getByRole('checkbox', { name: /Person 1/ }));
  await fireEvent.press(await screen.findByLabelText('Move 1 item'));
  expect(await eventually('1 moved')).toBeTruthy();
  await fireEvent.press(screen.getByRole('checkbox', { name: /Person 1/ }));
  await fireEvent.press(await screen.findByLabelText('Move 1 item'));
  expect(await eventually('2 moved')).toBeTruthy();
  expect(screen.queryByText('Sign in to your new account first')).toBeNull();
  expect([...mockClient.sessions.values()][0].signOut).not.toHaveBeenCalled();
  expect(Object.keys(__dump()).some((k) => k.startsWith('bluesky.session.'))).toBe(true);
});

it('blocks Move while the new account is still signing in', async () => {
  await openPick();
  // The browser has closed, but Bluesky has not answered the app yet.
  let finish = () => {};
  const held = new Promise<void>((resolve) => (finish = resolve));
  await userSignsInAs(NEW.did, scopesFor('new', ['person', 'block', 'list']));
  const answer = mockClient.callback.getMockImplementation()!;
  mockClient.callback.mockImplementation(async (...a: unknown[]) => {
    await held;
    return answer(...a);
  });
  await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
  await signInWithHandle('New account', NEW.handle);
  await fireEvent.press(screen.getByRole('tab', { name: 'Pick' }));
  expect(screen.getByLabelText('Signing in…').props.accessibilityState).toMatchObject({ disabled: true });
  expect(screen.queryByLabelText('Move 2 items')).toBeNull();
  finish();
  expect(await screen.findByLabelText('Move 2 items')).toBeTruthy();
});
