import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from '../../App';
import { ch, listMock, nextSignIn, renderApp, resetWorld, subMock } from './helpers';
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

beforeEach(async () => {
  await resetWorld();
  setWindow(400);
});

const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);
const resize = async (width: number) => {
  setWindow(width);
  await screen.rerender(<App />);
};
// Unfold and fold again: Compact to Medium and back.
const windowChange = async () => {
  await resize(700);
  await resize(360);
};

// Jest has no real layout, so these are the only tests of this feature that assert a style.
describe('the column', () => {
  it.each([700, 360])('holds Home in a centered column at %i points, and the background fills the window', async (width) => {
    setWindow(width);
    await render(<App />);
    await screen.findByText('Automatic');
    expect(flat('body')).toMatchObject({ maxWidth: 600, alignSelf: 'center' });
    expect(flat('root').maxWidth).toBeUndefined();
  });

  it.each([700, 360])('lines the top bar up with the column at %i points, and its line spans the window', async (width) => {
    setWindow(width);
    await renderApp();
    expect(flat('bar-content')).toMatchObject({ maxWidth: 600, alignSelf: 'center' });
    expect(StyleSheet.flatten(screen.getByTestId('bar-content').parent!.props.style).maxWidth).toBeUndefined();
  });
});

async function openPick() {
  listMock.mockResolvedValueOnce([ch('a', 'Alpha'), ch('b', 'Beta'), ch('c', 'Gamma')]);
  await renderApp();
  nextSignIn('old');
  await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
  await screen.findByLabelText('Alpha');
}

describe('keep my place', () => {
  it('stays on From, on To, and in Settings', async () => {
    await renderApp();
    await windowChange();
    expect(screen.getByLabelText('Sign in with Google: Old account')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    await windowChange();
    expect(screen.getByLabelText('Sign in with Google: New account')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Settings'));
    await windowChange();
    expect(screen.getByLabelText('Delete all my data')).toBeTruthy();
  });

  it('keeps the picks and the search text on Pick', async () => {
    await openPick();
    await fireEvent.press(screen.getByLabelText('Gamma'));
    await fireEvent.changeText(screen.getByLabelText('Search channels'), 'b');
    await windowChange();
    expect(screen.getByLabelText('Search channels').props.value).toBe('b');
    expect(screen.getByLabelText('Beta')).toBeTruthy();
    expect(screen.queryByLabelText('Alpha')).toBeNull();
    expect(screen.getByText('2 of 3 picked')).toBeTruthy();
  });

  it('keeps a running move going, and adds nothing twice', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    subMock.mockImplementation(async (_t: string, id: string) => {
      if (id === 'b') await gate;
      return { kind: 'moved' };
    });
    listMock.mockResolvedValueOnce([ch('a', 'Alpha'), ch('b', 'Beta'), ch('c', 'Gamma')]).mockResolvedValueOnce([]);
    await renderApp();
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
    await screen.findByLabelText('Alpha');
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    nextSignIn('new');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
    await fireEvent.press(await screen.findByLabelText('Move 3 channels'));
    await waitFor(() => expect(subMock).toHaveBeenCalledTimes(2));
    for (let i = 0; i < 5; i++) await windowChange();
    release();
    expect(await screen.findByText('3 moved')).toBeTruthy();
    expect(subMock).toHaveBeenCalledTimes(3);
  });

  it('keeps a notice on screen', async () => {
    await openPick();
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
    await screen.findByText('This is your old account. Pick a different one.');
    await windowChange();
    expect(screen.getByText('This is your old account. Pick a different one.')).toBeTruthy();
  });
});
