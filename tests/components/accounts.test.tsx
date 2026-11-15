import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { GoogleSignin, mockUser, signInAs } from '../mocks/googleSignin';
import { listUnfinished } from '@/store/progressStore';
import { ch, listMock, nextSignIn, renderApp, resetWorld, subMock } from './helpers';

jest.mock('@/api/youtube', () => ({
  ...jest.requireActual('@/api/youtube'),
  listMySubscriptions: jest.fn(),
  subscribe: jest.fn(),
}));

beforeEach(resetWorld);

async function bothSignedIn() {
  listMock
    .mockResolvedValueOnce([ch('a', 'Alpha'), ch('b', 'Beta')])
    .mockResolvedValueOnce([]);
  await renderApp();
  nextSignIn('old');
  await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
  await screen.findByLabelText('Alpha');
  await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
  nextSignIn('new');
  await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
  await screen.findByLabelText('Move 2 channels');
}

describe('accounts', () => {
  it('shows who is signed in with a Switch button', async () => {
    await bothSignedIn();
    await fireEvent.press(screen.getByRole('tab', { name: 'From' }));
    expect(screen.getByText('old.me@gmail.com')).toBeTruthy();
    expect(screen.getByLabelText('Switch Old account')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    expect(screen.getByText('new.me@gmail.com')).toBeTruthy();
  });

  it('refuses the old account as the new account', async () => {
    listMock.mockResolvedValueOnce([ch('a', 'Alpha')]);
    await renderApp();
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
    await screen.findByLabelText('Alpha');
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
    expect(await screen.findByText('This is your old account. Pick a different one.')).toBeTruthy();
    expect(screen.getByLabelText('Sign in with Google: New account')).toBeTruthy();
  });

  it('refuses the new account as the old account', async () => {
    await renderApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    nextSignIn('new');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
    await fireEvent.press(await screen.findByRole('tab', { name: 'From' }));
    nextSignIn('new');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
    expect(await screen.findByText('This is your new account. Pick a different one.')).toBeTruthy();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('reloads the list for a switched old account and keeps the earlier progress saved', async () => {
    await bothSignedIn();
    await fireEvent.press(screen.getByRole('tab', { name: 'From' }));
    listMock.mockResolvedValueOnce([ch('x', 'Xavier')]);
    signInAs(mockUser('old2-id', 'second.old@gmail.com'));
    await fireEvent.press(screen.getByLabelText('Switch Old account'));
    expect(await screen.findByLabelText('Xavier')).toBeTruthy();
    expect(screen.queryByLabelText('Alpha')).toBeNull();
    const saved = await listUnfinished();
    expect(saved).toHaveLength(1);
    expect(saved[0].oldAccount.handle).toBe('old.me@gmail.com');
  });

  it('blocks Switch while a move is running', async () => {
    let finish: (v: { kind: string }) => void = () => undefined;
    subMock.mockReturnValue(new Promise((r) => (finish = r)));
    await bothSignedIn();
    await fireEvent.press(screen.getByLabelText('Move 2 channels'));
    await fireEvent.press(screen.getByRole('tab', { name: 'From' }));
    expect(screen.getByLabelText('Switch Old account').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    expect(screen.getByLabelText('Switch New account').props.accessibilityState.disabled).toBe(true);
    finish({ kind: 'moved' });
    await waitFor(() => expect(GoogleSignin.signIn).toHaveBeenCalledTimes(2));
  });
});
