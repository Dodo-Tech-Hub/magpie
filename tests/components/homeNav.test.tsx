import React from 'react';
import { Alert, BackHandler } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import App from '../../App';
import { palettes } from '@/theme/theme';
import { getOrCreateProgress, initStore, listUnfinished, saveItems } from '@/store/progressStore';
import { answerAlert, ch, listMock, NEW, nextSignIn, OLD, renderApp, resetWorld, subMock } from './helpers';

jest.mock('@/api/youtube', () => ({
  ...jest.requireActual('@/api/youtube'),
  listMySubscriptions: jest.fn(),
  subscribe: jest.fn(),
}));

// Capture the Android back handlers the app registers.
type BackFn = Parameters<typeof BackHandler.addEventListener>[1];
let handlers: BackFn[] = [];
beforeEach(async () => {
  handlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_name, fn) => {
    handlers.push(fn);
    return { remove: () => (handlers = handlers.filter((h) => h !== fn)) };
  });
  await resetWorld();
});
afterEach(() => jest.restoreAllMocks());

const back = async () => {
  let result: boolean | null | undefined;
  await act(async () => {
    result = handlers.at(-1)?.({} as never);
  });
  return result;
};
const acct = (u: typeof OLD) => ({ id: u.id, handle: u.email, name: u.name, photoUrl: u.photo });

async function seed(ids = ['a', 'b']) {
  await initStore();
  const pid = await getOrCreateProgress('youtube', acct(OLD), acct(NEW));
  await saveItems(pid, ids.map((id) => ({ itemId: id, kind: 'channel', title: id, thumbnailUrl: null, data: null })));
  return pid;
}

describe('Android back', () => {
  it('goes Home from the YouTube flow', async () => {
    await renderApp();
    expect(await back()).toBe(true);
    expect(await screen.findByText('Automatic')).toBeTruthy();
  });

  it('closes Settings first, then goes Home from the flow', async () => {
    await renderApp();
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(screen.getByText('Look')).toBeTruthy();
    expect(await back()).toBe(true);
    expect(screen.queryByText('Look')).toBeNull();
    expect(screen.getByRole('tab', { name: 'From' })).toBeTruthy();
    expect(await back()).toBe(true);
    expect(screen.getByText('Automatic')).toBeTruthy();
  });

  it('lets the system handle back on Home', async () => {
    await render(<App />);
    await screen.findByText('Automatic');
    expect(await back()).toBe(false);
  });

  it('closes Settings opened from Home, then lets the system handle back', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Settings'));
    expect(await back()).toBe(true);
    expect(screen.getByText('Automatic')).toBeTruthy();
    expect(await back()).toBe(false);
  });
});

describe('Settings from Home', () => {
  it('opens with the gear and a theme choice changes the colors Home uses', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Settings'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(await screen.findByText('Automatic')).toBeTruthy();
    const s = screen.getByTestId('root').props.style;
    const bg = [s].flat(3).find((x: { backgroundColor?: string }) => x?.backgroundColor)?.backgroundColor;
    expect(bg).toBe(palettes.dark.background);
  });

  it('Delete all from Home removes every progress and the Continue note', async () => {
    await seed();
    answerAlert(jest.spyOn(Alert, 'alert'), 'Delete');
    await render(<App />);
    expect(await screen.findByText('Continue: 2 left')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Settings'));
    await fireEvent.press(screen.getByLabelText('Delete all my data'));
    await act(async () => undefined);
    expect(await listUnfinished()).toEqual([]);
    expect(screen.queryByText(/Continue:/)).toBeNull();
    expect(screen.getByText('Automatic')).toBeTruthy();
  });

  it('Delete all inside the YouTube flow keeps the user in the flow', async () => {
    await seed();
    answerAlert(jest.spyOn(Alert, 'alert'), 'Delete');
    await renderApp();
    await fireEvent.press(screen.getByLabelText('Settings'));
    await fireEvent.press(screen.getByLabelText('Delete all my data'));
    await act(async () => undefined);
    expect(screen.getByRole('tab', { name: 'From' })).toBeTruthy();
    expect(screen.queryByText('Automatic')).toBeNull();
  });
});

describe('a move while the user goes Home', () => {
  it('keeps running, and the Continue note updates when it ends', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    subMock.mockImplementation(async () => {
      await gate;
      return { kind: 'moved' };
    });
    listMock.mockResolvedValueOnce([ch('a'), ch('b')]).mockResolvedValueOnce([]);
    await renderApp();
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
    await screen.findByLabelText('a');
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    nextSignIn('new');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
    await fireEvent.press(await screen.findByLabelText('Move 2 channels'));
    await fireEvent.press(screen.getByRole('button', { name: 'Home' }));
    expect(await screen.findByText('Continue: 2 left')).toBeTruthy();
    await act(async () => release());
    await act(async () => undefined);
    expect(subMock).toHaveBeenCalledTimes(2);
    await screen.findByText('Automatic');
    expect(screen.queryByText(/Continue:/)).toBeNull();
  });
});
