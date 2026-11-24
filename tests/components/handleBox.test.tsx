import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import App from '../../App';
import { youtubeDriver } from '@/platforms/youtubeDriver';
import type { SignInResult } from '@/platforms/driver';
import { renderApp, resetWorld } from './helpers';
import { patchDriver } from './patchDriver';
import { setWindow } from './window';

jest.mock('@/api/youtube', () => ({
  ...jest.requireActual('@/api/youtube'),
  listMySubscriptions: jest.fn(),
  subscribe: jest.fn(),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => require('./window').mockWindow,
}));

// A platform where the user types a handle, plugged into the YouTube flow for the length of a test.
const patched = patchDriver(youtubeDriver);
const original = patched.original;
const account = (role: string, handle: string) => ({ id: `id-${role}`, handle, name: handle, photoUrl: null });
const signIn = jest.fn<Promise<SignInResult>, unknown[]>();
const signOut = jest.fn(async () => undefined);

function typeHandlePlatform() {
  signIn.mockImplementation(async (role, _kinds, _onCode, _signal, handle) => ({
    ok: true,
    account: account(String(role), String(handle)),
  }));
  Object.assign(youtubeDriver, {
    handleInput: true,
    switchSignsOut: true,
    words: {
      ...original.words,
      signIn: 'Sign in with Bluesky',
      handleLabel: 'Bluesky handle',
      handlePlaceholder: 'name.bsky.social',
      changeOld: 'Change',
    },
    signIn,
    signOut,
    listOld: async () => ({
      items: [{ itemId: 'person:1', kind: 'channel', title: 'Alice', thumbnailUrl: null, data: null }],
      missing: [],
    }),
    granted: async () => ['channel'],
    canAct: async () => false,
    checkNew: async () => [],
  });
}

beforeEach(async () => {
  await resetWorld();
  signIn.mockReset();
  signOut.mockClear();
  setWindow(400);
});
afterEach(() => patched.restore());

describe('handle box', () => {
  it('shows a box for the handle on From and on To, next to the sign-in button', async () => {
    typeHandlePlatform();
    await renderApp();
    expect(screen.getByLabelText('Bluesky handle')).toBeTruthy();
    expect(screen.getByLabelText('Sign in with Bluesky: Old account')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    expect(screen.getByLabelText('Bluesky handle')).toBeTruthy();
    expect(screen.getByLabelText('Sign in with Bluesky: New account')).toBeTruthy();
  });

  it('signs in with the typed text, from the button and from the keyboard Go key', async () => {
    typeHandlePlatform();
    await renderApp();
    await fireEvent.changeText(screen.getByLabelText('Bluesky handle'), 'alice.bsky.social');
    await fireEvent.press(screen.getByLabelText('Sign in with Bluesky: Old account'));
    expect(signIn).toHaveBeenCalledWith('old', [], expect.any(Function), expect.anything(), 'alice.bsky.social');
    // The step shows the account, and Pick opens.
    expect(await screen.findByLabelText('Alice')).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    await fireEvent.changeText(screen.getByLabelText('Bluesky handle'), 'bob.bsky.social');
    await fireEvent(screen.getByLabelText('Bluesky handle'), 'submitEditing');
    expect(signIn).toHaveBeenLastCalledWith('new', expect.any(Array), expect.any(Function), expect.anything(), 'bob.bsky.social');
  });

  it('does not sign in with an empty box', async () => {
    typeHandlePlatform();
    await renderApp();
    await fireEvent.press(screen.getByLabelText('Sign in with Bluesky: Old account'));
    expect(signIn).not.toHaveBeenCalled();
  });

  it('keeps the typed text when the window changes', async () => {
    typeHandlePlatform();
    await renderApp();
    await fireEvent.changeText(screen.getByLabelText('Bluesky handle'), 'alice.bsky.social');
    for (const width of [700, 320, 400]) {
      setWindow(width);
      await screen.rerender(<App />);
      expect(screen.getByLabelText('Bluesky handle').props.value).toBe('alice.bsky.social');
    }
  });

  it.each([
    ['not_found', "We can't find that account. Check the name."],
    ['not_supported', 'Magpie works only with accounts hosted by Bluesky for now.'],
    ['unavailable', "This account can't be read right now."],
  ] as const)('says why on %s and keeps the step open with the typed text', async (reason, text) => {
    typeHandlePlatform();
    signIn.mockResolvedValue({ ok: false, reason });
    await renderApp();
    await fireEvent.changeText(screen.getByLabelText('Bluesky handle'), 'who.example.com');
    await fireEvent.press(screen.getByLabelText('Sign in with Bluesky: Old account'));
    expect(await screen.findByText(text)).toBeTruthy();
    expect(screen.getByLabelText('Bluesky handle').props.value).toBe('who.example.com');
  });

  it('names the old account button "Change" and brings the box back', async () => {
    typeHandlePlatform();
    await renderApp();
    await fireEvent.changeText(screen.getByLabelText('Bluesky handle'), 'alice.bsky.social');
    await fireEvent.press(screen.getByLabelText('Sign in with Bluesky: Old account'));
    await screen.findByLabelText('Alice');
    await fireEvent.press(screen.getByRole('tab', { name: 'From' }));
    expect(screen.getByText('alice.bsky.social')).toBeTruthy();
    expect(screen.queryByLabelText('Sign out Old account')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Change Old account'));
    await waitFor(() => expect(screen.getByLabelText('Bluesky handle')).toBeTruthy());
    expect(signOut).toHaveBeenCalledWith('old');
  });

  it('shows only the sign-in button for a platform without a handle box', async () => {
    await renderApp();
    expect(screen.queryByLabelText('Bluesky handle')).toBeNull();
    expect(screen.getByLabelText('Sign in with Google: Old account')).toBeTruthy();
  });
});
