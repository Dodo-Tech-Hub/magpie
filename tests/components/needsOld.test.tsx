import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import App from '../../App';
import { youtubeDriver } from '@/platforms/youtubeDriver';
import type { SignInResult } from '@/platforms/driver';
import type { NewItem } from '@/store/progressStore';
import { patchDriver } from './patchDriver';
import { renderApp, resetWorld } from './helpers';
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

// A platform with a public kind (person) and a kind that needs an old-account sign-in (mute).
const patched = patchDriver(youtubeDriver);
const row = (kind: string, id: string, title: string): NewItem => ({ itemId: `${kind}:${id}`, kind, title, thumbnailUrl: null, data: null });
const account = (id: string) => ({ id, handle: `${id}-handle`, name: id, photoUrl: null });

let session: boolean;
let muted: NewItem[];
let granted: string[];
let otherAccount: boolean;
const listOld = jest.fn();
const signIn = jest.fn<Promise<SignInResult>, unknown[]>();

function fakePlatform() {
  session = false;
  muted = [row('mute', '1', 'Mia'), row('mute', '2', 'Max')];
  granted = ['person', 'mute'];
  otherAccount = false;
  listOld.mockReset();
  // Like a real driver: the old session is read once, then dropped.
  listOld.mockImplementation(async () => {
    const items = [row('person', '1', 'Alice'), row('person', '2', 'Ana'), ...(session ? muted : [])];
    session = false;
    return { items, missing: [] };
  });
  signIn.mockReset();
  signIn.mockImplementation(async (role, kinds) => {
    if (role === 'old' && (kinds as string[]).length > 0) {
      session = true;
      return { ok: true, account: account(otherAccount ? 'someone-else' : 'old') };
    }
    return { ok: true, account: account(String(role)) };
  });
  patched.apply({
    kinds: [
      { id: 'person', heading: 'People' },
      { id: 'mute', heading: 'Mutes', needsOld: true },
    ],
    words: { ...youtubeDriver.words, moveButton: (n: number) => `Move ${n} items` },
    signIn,
    signOut: jest.fn(async () => undefined),
    listOld,
    granted: async () => granted,
    canAct: async () => true,
    checkNew: async () => [],
  });
}

async function openPick() {
  await renderApp();
  await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
  await screen.findByLabelText('Alice');
}

beforeEach(async () => {
  await resetWorld();
  setWindow(400);
  fakePlatform();
});
afterEach(() => patched.restore());

describe.each([
  ['Compact', 400],
  ['Medium', 700],
])('kinds that need the old account, at a %s window', (_name, width) => {
  beforeEach(() => setWindow(width));

  it('greys the section out with a line and an Allow button until the old account signs in', async () => {
    await openPick();
    expect(screen.getByLabelText('Mutes')).toBeTruthy();
    expect(screen.getByText('Sign in to your old account to move these.')).toBeTruthy();
    expect(screen.getByLabelText('Allow Mutes')).toBeTruthy();
    expect(screen.queryByLabelText('Mia')).toBeNull();
    expect(screen.getByLabelText('Move 2 items')).toBeTruthy();
  });

  it('signs in to the old account for that kind, reads it, and shows the rows picked', async () => {
    await openPick();
    await fireEvent.press(screen.getByLabelText('Allow Mutes'));
    expect(await screen.findByLabelText('Mia')).toBeTruthy();
    expect(signIn).toHaveBeenLastCalledWith('old', ['mute'], expect.any(Function), expect.anything(), 'old-handle');
    expect(screen.getByText('4 of 4 picked')).toBeTruthy();
    expect(screen.getByLabelText('Move 4 items')).toBeTruthy();
    // The sign-in is not asked for again, and the old session was dropped by the read.
    expect(screen.queryByLabelText('Allow Mutes')).toBeNull();
    expect(session).toBe(false);
  });

  it('keeps picks the user already made and picks the new rows', async () => {
    await openPick();
    await fireEvent.press(screen.getByLabelText('Alice'));
    expect(screen.getByText('1 of 2 picked')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Allow Mutes'));
    await screen.findByLabelText('Mia');
    expect(screen.getByText('3 of 4 picked')).toBeTruthy();
    expect(screen.getByLabelText('Move 3 items')).toBeTruthy();
  });

  it('refuses another account and reads nothing', async () => {
    await openPick();
    otherAccount = true;
    await fireEvent.press(screen.getByLabelText('Allow Mutes'));
    expect(await screen.findByText('Use your old account here.')).toBeTruthy();
    expect(listOld).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Mia')).toBeNull();
    expect(screen.getByLabelText('Allow Mutes')).toBeTruthy();
  });

  it('shows no section and no Allow when the old account has none of that kind', async () => {
    await openPick();
    muted = [];
    await fireEvent.press(screen.getByLabelText('Allow Mutes'));
    await waitFor(() => expect(screen.queryByLabelText('Allow Mutes')).toBeNull());
    expect(screen.queryByLabelText('Mutes')).toBeNull();
  });

  it('asks the new account for that kind separately when it has no access for it', async () => {
    granted = ['person'];
    await openPick();
    await fireEvent.press(screen.getByLabelText('Allow Mutes'));
    await screen.findByLabelText('Mia');
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
    await screen.findByLabelText('Move 2 items');
    // Mutes are read but the new account cannot take them yet: greyed with the new-account Allow.
    expect(screen.getByText('Magpie needs extra access to move mutes.')).toBeTruthy();
    granted = ['person', 'mute'];
    await fireEvent.press(screen.getByLabelText('Allow Mutes'));
    await waitFor(() => expect(screen.getByLabelText('Move 4 items')).toBeTruthy());
    // The new account's handle goes along, so a platform where the user types it signs in to the same account.
    expect(signIn).toHaveBeenLastCalledWith('new', ['person', 'mute'], expect.any(Function), expect.anything(), 'new-handle');
  });
});

it('renders again after a window change with the same section', async () => {
  await openPick();
  setWindow(700);
  await screen.rerender(<App />);
  expect(screen.getByLabelText('Allow Mutes')).toBeTruthy();
});
