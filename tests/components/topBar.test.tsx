import { fireEvent, screen } from '@testing-library/react-native';
import { ch, listMock, nextSignIn, renderApp, resetWorld } from './helpers';

jest.mock('@/api/youtube', () => ({
  ...jest.requireActual('@/api/youtube'),
  listMySubscriptions: jest.fn(),
  subscribe: jest.fn(),
}));

beforeEach(resetWorld);

const stepState = (name: string) =>
  screen.getByRole('tab', { name }).props.accessibilityValue?.text as string;

describe('top bar', () => {
  it('always shows From, Pick and To, with From as the current step at the start', async () => {
    await renderApp();
    expect(screen.getByRole('tab', { name: 'From' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Pick' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'To' })).toBeTruthy();
    expect(stepState('From')).toBe('current');
  });

  it('locks Pick until the old account is signed in and says why', async () => {
    await renderApp();
    expect(stepState('Pick')).toBe('locked');
    await fireEvent.press(screen.getByRole('tab', { name: 'Pick' }));
    expect(await screen.findByText('Sign in to your old account first')).toBeTruthy();
  });

  it('lets the user open the steps in any order', async () => {
    await renderApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    expect(screen.getByLabelText('Sign in with Google: New account')).toBeTruthy();
    expect(stepState('To')).toBe('current');
    await fireEvent.press(screen.getByRole('tab', { name: 'From' }));
    expect(screen.getByLabelText('Sign in with Google: Old account')).toBeTruthy();
  });

  it('marks a step done after its account is signed in, and unlocks Pick', async () => {
    listMock.mockResolvedValueOnce([ch('a')]);
    await renderApp();
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
    await screen.findByLabelText('a');
    expect(stepState('From')).toBe('done');
    expect(stepState('Pick')).toBe('current');
  });

  it('still works when the user signs in to the new account first', async () => {
    listMock.mockResolvedValueOnce([ch('a')]);
    await renderApp();
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    nextSignIn('new');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
    await fireEvent.press(screen.getByRole('tab', { name: 'From' }));
    expect(stepState('To')).toBe('done');
    expect(stepState('Pick')).toBe('locked');
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
    await screen.findByLabelText('a');
    expect(stepState('Pick')).toBe('current');
  });

  it('has a Home button that returns to Home with nothing lost', async () => {
    listMock.mockResolvedValueOnce([ch('a'), ch('b')]);
    await renderApp();
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
    await screen.findByLabelText('a');
    await fireEvent.press(screen.getByLabelText('a'));
    await fireEvent.press(screen.getByRole('button', { name: 'Home' }));
    expect(await screen.findByText('Automatic')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'From' })).toBeNull();
    await fireEvent.press(screen.getByLabelText('YouTube. We move them for you'));
    expect(stepState('From')).toBe('done');
    expect(screen.getByLabelText('b')).toBeTruthy();
    expect(screen.getByLabelText('a').props.accessibilityState?.checked).toBe(false);
  });
});
