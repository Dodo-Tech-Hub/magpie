import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import App from '../../App';
import { youtubeDriver } from '@/platforms/youtubeDriver';
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

const NOTE = "Magpie's access ends on its own soon.";
const patched = patchDriver(youtubeDriver);
const original = patched.original;
const account = (role: string) => ({ id: `id-${role}`, handle: `${role}-handle`, name: role, photoUrl: null });
const signOut = jest.fn<Promise<void | false>, unknown[]>();
const endMove = jest.fn<Promise<void | false>, []>();

// A platform that reports whether it could cancel the access, plugged into the YouTube flow for one test.
function patch(extra: Record<string, unknown> = {}) {
  Object.assign(youtubeDriver, {
    switchSignsOut: true,
    words: { ...original.words, accessNote: NOTE, accessButton: 'Open settings', moveButton: (n: number) => `Move ${n} items` },
    signIn: async (role: string) => ({ ok: true, account: account(role) }),
    signOut,
    endMove,
    listOld: async () => ({
      items: [{ itemId: 'a', kind: 'channel', title: 'Alpha', thumbnailUrl: null, data: null }],
      missing: [],
    }),
    granted: async () => ['channel'],
    canAct: async () => true,
    checkNew: async () => [],
    add: async () => ({ kind: 'moved' }),
    ...extra,
  });
}

async function signInBoth() {
  await renderApp();
  await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
  await screen.findByLabelText('Alpha');
  await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
  await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
  await screen.findByLabelText('Move 1 items');
}

const signOutNew = async () => {
  await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
  await fireEvent.press(screen.getByLabelText('Sign out New account'));
};

beforeEach(async () => {
  await resetWorld();
  signOut.mockReset();
  endMove.mockReset();
  (Linking.openURL as jest.Mock).mockClear();
  setWindow(400);
});
afterEach(() => patched.restore());

describe.each([
  ['Compact', 400],
  ['Medium', 700],
])('access note at a %s window', (_name, width) => {
  beforeEach(() => setWindow(width));

  it('shows the line alone after Sign out when the platform could not cancel and has no page to end it', async () => {
    patch();
    signOut.mockResolvedValue(false);
    await signInBoth();
    await signOutNew();
    expect(await screen.findByText(NOTE)).toBeTruthy();
    expect(screen.queryByLabelText('Open settings')).toBeNull();
  });

  it('shows the line and a button to the platform page when it has one', async () => {
    patch({ removeAccessUrl: 'https://example.com/remove' });
    signOut.mockResolvedValue(false);
    await signInBoth();
    await signOutNew();
    expect(await screen.findByText(NOTE)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Open settings'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/remove');
  });

  it('shows no line when the platform cancelled the access', async () => {
    patch();
    signOut.mockResolvedValue(undefined);
    await signInBoth();
    await signOutNew();
    expect(await screen.findByLabelText('Sign in with Google: New account')).toBeTruthy();
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('shows the line at the summary when the end of the move could not cancel the access', async () => {
    patch();
    endMove.mockResolvedValue(false);
    await signInBoth();
    await fireEvent.press(screen.getByLabelText('Move 1 items'));
    expect(await screen.findByText('1 moved')).toBeTruthy();
    expect(screen.getByText(NOTE)).toBeTruthy();
  });

  it('shows no line at the summary when the end of the move cancelled the access', async () => {
    patch();
    endMove.mockResolvedValue(undefined);
    await signInBoth();
    await fireEvent.press(screen.getByLabelText('Move 1 items'));
    expect(await screen.findByText('1 moved')).toBeTruthy();
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('does not change a platform without a note', async () => {
    patch({ words: { ...original.words, moveButton: (n: number) => `Move ${n} items` } });
    signOut.mockResolvedValue(false);
    await signInBoth();
    await signOutNew();
    await screen.findByLabelText('Sign in with Google: New account');
    expect(screen.queryByText(NOTE)).toBeNull();
  });
});

it('renders again after a window change with the line still showing', async () => {
  patch();
  signOut.mockResolvedValue(false);
  await signInBoth();
  await signOutNew();
  await screen.findByText(NOTE);
  setWindow(700);
  await screen.rerender(<App />);
  expect(screen.getByText(NOTE)).toBeTruthy();
});
