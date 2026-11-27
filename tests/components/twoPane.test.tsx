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
  setWindow(900);
});

const SIGN_IN_OLD = 'Sign in with Google: Old account';
const SIGN_IN_NEW = 'Sign in with Google: New account';
const LOCKED = 'Sign in to your old account first';
const NEED_NEW = 'Sign in to your new account first';
const CHANNELS = [ch('a', 'Alpha'), ch('b', 'Beta'), ch('c', 'Gamma')];

const resize = async (width: number) => {
  setWindow(width);
  await screen.rerender(<App />);
};
const selected = (name: string) => screen.getByRole('tab', { name }).props.accessibilityState.selected;
const touch = (pane: string) => fireEvent(screen.getByTestId(pane), 'touchStart');
const barWidth = () => StyleSheet.flatten(screen.getByTestId('bar-content').props.style).maxWidth;

async function signInOld(list = CHANNELS) {
  listMock.mockResolvedValueOnce(list);
  nextSignIn('old');
  await fireEvent.press(screen.getByLabelText(SIGN_IN_OLD));
  await screen.findByLabelText('Alpha');
}

describe('the move flow in a wide window', () => {
  it('shows From, To, and the locked Pick together', async () => {
    await renderApp();
    expect(screen.getByLabelText(SIGN_IN_OLD)).toBeTruthy();
    expect(screen.getByLabelText(SIGN_IN_NEW)).toBeTruthy();
    expect(screen.getByText(LOCKED)).toBeTruthy();
  });

  it('shows one step just under 840 points', async () => {
    setWindow(839);
    await renderApp();
    expect(screen.getByLabelText(SIGN_IN_OLD)).toBeTruthy();
    expect(screen.queryByLabelText(SIGN_IN_NEW)).toBeNull();
    expect(screen.queryByText(LOCKED)).toBeNull();
  });

  it('loads the list beside the accounts after the old account signs in', async () => {
    await renderApp();
    await signInOld();
    expect(screen.getByLabelText('Gamma')).toBeTruthy();
    expect(screen.getByText('old.me@gmail.com')).toBeTruthy();
    expect(screen.getByLabelText(SIGN_IN_NEW)).toBeTruthy();
  });

  it('asks for the new account once, next to Move, and a touch on another pane clears it', async () => {
    await renderApp();
    await signInOld();
    await fireEvent.press(screen.getByLabelText('Move 3 channels'));
    expect(await screen.findAllByText(NEED_NEW)).toHaveLength(1);
    expect(screen.getByLabelText(SIGN_IN_NEW)).toBeTruthy();
    expect(screen.getByLabelText('Alpha')).toBeTruthy();
    expect(selected('Pick')).toBe(true);
    await touch('pane-to');
    expect(screen.queryByText(NEED_NEW)).toBeNull();
  });

  it('makes the touched pane the current step', async () => {
    await renderApp();
    await touch('pane-pick');
    expect(selected('Pick')).toBe(true);
    await touch('pane-to');
    expect(selected('To')).toBe(true);
    await touch('pane-from');
    expect(selected('From')).toBe(true);
  });

  it('keeps Home and Settings in the column', async () => {
    await render(<App />);
    await screen.findByText('Automatic');
    expect(screen.queryByTestId('panes')).toBeNull();
    expect(screen.getByTestId('body')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(screen.queryByTestId('panes')).toBeNull();
    expect(screen.getByTestId('body')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Back'));
    await fireEvent.press(screen.getByLabelText('YouTube'));
    expect(screen.getByTestId('panes')).toBeTruthy();
    expect(barWidth()).toBe(960);
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(screen.queryByTestId('panes')).toBeNull();
    expect(screen.getByTestId('body')).toBeTruthy();
    expect(barWidth()).toBe(600);
  });

  it('does a whole move without a tap on a step', async () => {
    await renderApp();
    listMock.mockResolvedValueOnce(CHANNELS).mockResolvedValueOnce([]);
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText(SIGN_IN_OLD));
    await screen.findByLabelText('Alpha');
    nextSignIn('new');
    await fireEvent.press(screen.getByLabelText(SIGN_IN_NEW));
    await screen.findByText('new.me@gmail.com');
    await fireEvent.press(await screen.findByLabelText('Move 3 channels'));
    expect(await screen.findByText('3 moved')).toBeTruthy();
  });
});

describe('between one and two panes', () => {
  it('keeps the picks and the search text when Pick is the current step', async () => {
    setWindow(360);
    await renderApp();
    await signInOld();
    await fireEvent.press(screen.getByLabelText('Gamma'));
    await fireEvent.changeText(screen.getByLabelText('Search channels'), 'b');
    await resize(900);
    expect(screen.getByLabelText('Search channels').props.value).toBe('b');
    expect(screen.getByText('2 of 3 picked')).toBeTruthy();
    expect(screen.getByText('old.me@gmail.com')).toBeTruthy();
    expect(screen.getByLabelText(SIGN_IN_NEW)).toBeTruthy();
    await resize(360);
    expect(screen.getByLabelText('Search channels').props.value).toBe('b');
    expect(screen.getByText('2 of 3 picked')).toBeTruthy();
    expect(screen.queryByLabelText(SIGN_IN_NEW)).toBeNull();
  });

  it('falls back to the step last touched, with the picks kept', async () => {
    await renderApp();
    await signInOld();
    await fireEvent.press(screen.getByLabelText('Gamma'));
    await touch('pane-to');
    await resize(360);
    expect(screen.getByLabelText(SIGN_IN_NEW)).toBeTruthy();
    expect(screen.queryByLabelText('Alpha')).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Pick' }));
    expect(screen.getByText('2 of 3 picked')).toBeTruthy();
  });

  it('keeps a running move going, and adds nothing twice', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    subMock.mockImplementation(async (_t: string, id: string) => {
      if (id === 'b') await gate;
      return { kind: 'moved' };
    });
    await renderApp();
    listMock.mockResolvedValueOnce(CHANNELS).mockResolvedValueOnce([]);
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText(SIGN_IN_OLD));
    await screen.findByLabelText('Alpha');
    nextSignIn('new');
    await fireEvent.press(screen.getByLabelText(SIGN_IN_NEW));
    await screen.findByText('new.me@gmail.com');
    await fireEvent.press(await screen.findByLabelText('Move 3 channels'));
    await waitFor(() => expect(subMock).toHaveBeenCalledTimes(2));
    for (let i = 0; i < 5; i++) {
      await resize(360);
      await resize(900);
    }
    release();
    expect(await screen.findByText('3 moved')).toBeTruthy();
    expect(subMock).toHaveBeenCalledTimes(3);
  });
});
