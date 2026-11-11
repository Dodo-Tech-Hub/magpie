import React from 'react';
import { Appearance } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import App from '../../App';
import { palettes } from '@/theme/theme';
import { getSetting, setSetting } from '@/store/progressStore';
import { ch, listMock, nextSignIn, resetWorld } from './helpers';

jest.mock('@/api/youtube', () => ({
  ...jest.requireActual('@/api/youtube'),
  listMySubscriptions: jest.fn(),
  subscribe: jest.fn(),
}));

// The phone's look, changeable from a test.
let mockPhone: 'light' | 'dark' | null = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockPhone,
}));

let setScheme: jest.SpyInstance;
beforeEach(async () => {
  mockPhone = 'light';
  setScheme = jest.spyOn(Appearance, 'setColorScheme');
  await resetWorld();
});

// The app draws nothing until the saved choice is read.
const ready = () => screen.findByTestId('root');
const openSettings = () => fireEvent.press(screen.getByLabelText('Settings'));
const choose = (label: string) => fireEvent.press(screen.getByRole('radio', { name: label }));
const checked = (label: string) =>
  screen.getByRole('radio', { name: label }).props.accessibilityState?.checked as boolean;
const bg = () => {
  const s = screen.getByTestId('root').props.style;
  return [s].flat(3).find((x: { backgroundColor?: string }) => x?.backgroundColor)?.backgroundColor;
};

describe('Settings and the theme choice', () => {
  it('opens from the gear on every step and turns the gear into a back arrow', async () => {
    await render(<App />);
    await ready();
    for (const step of ['From', 'Pick', 'To']) {
      await fireEvent.press(screen.getByRole('tab', { name: step }));
      expect(screen.getByLabelText('Settings')).toBeTruthy();
    }
    await openSettings();
    expect(screen.getByText('Look')).toBeTruthy();
    expect(screen.queryByLabelText('Settings')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.queryByText('Look')).toBeNull();
  });

  it('shows Light, Dark and Auto as radios with Auto marked at the start', async () => {
    await render(<App />);
    await ready();
    await openSettings();
    expect(checked('Auto')).toBe(true);
    expect(checked('Light')).toBe(false);
    expect(checked('Dark')).toBe(false);
  });

  it('changes the whole app at once and saves the choice', async () => {
    await render(<App />);
    await ready();
    expect(bg()).toBe(palettes.light.background);
    await openSettings();
    await choose('Dark');
    expect(checked('Dark')).toBe(true);
    expect(bg()).toBe(palettes.dark.background);
    expect(setScheme).toHaveBeenLastCalledWith('dark');
    expect(await getSetting('themeChoice')).toBe('dark');
    await choose('Light');
    expect(bg()).toBe(palettes.light.background);
    expect(await getSetting('themeChoice')).toBe('light');
    await choose('Auto');
    expect(setScheme).toHaveBeenLastCalledWith('auto');
    expect(await getSetting('themeChoice')).toBe('system');
  });

  it('opens in the saved look after a restart', async () => {
    const first = await render(<App />);
    await ready();
    await openSettings();
    await choose('Dark');
    await first.unmount();
    await render(<App />);
    await ready();
    expect(bg()).toBe(palettes.dark.background);
  });
});

describe('Auto follows the phone', () => {
  it('matches a dark phone on a fresh start, and follows it when it changes', async () => {
    mockPhone = 'dark';
    const view = await render(<App />);
    await ready();
    expect(bg()).toBe(palettes.dark.background);
    mockPhone = 'light';
    await view.rerender(<App />);
    expect(bg()).toBe(palettes.light.background);
  });

  it('shows Light when the phone reports nothing', async () => {
    mockPhone = null;
    await render(<App />);
    await ready();
    expect(bg()).toBe(palettes.light.background);
  });

  it('ignores the phone when Light or Dark is chosen', async () => {
    await setSetting('themeChoice', 'light');
    mockPhone = 'dark';
    await render(<App />);
    await ready();
    expect(bg()).toBe(palettes.light.background);
  });

  it('treats a damaged saved value as Auto with no error', async () => {
    await setSetting('themeChoice', 'purple');
    await render(<App />);
    await ready();
    await openSettings();
    expect(checked('Auto')).toBe(true);
  });
});

describe('Settings keeps the user place', () => {
  it('does not show Delete all on the From step any more', async () => {
    await render(<App />);
    await ready();
    expect(screen.queryByLabelText('Delete all my data')).toBeNull();
  });

  it('keeps picks and the counter after opening and closing Settings', async () => {
    listMock.mockResolvedValueOnce([ch('a'), ch('b')]);
    await render(<App />);
    await ready();
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
    await fireEvent.press(await screen.findByLabelText('a'));
    expect(screen.getByText('1 of 2 picked')).toBeTruthy();
    await openSettings();
    await act(async () => undefined);
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.getByText('1 of 2 picked')).toBeTruthy();
  });

  it('closes Settings when a step tab is tapped', async () => {
    await render(<App />);
    await ready();
    await openSettings();
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    expect(screen.queryByText('Look')).toBeNull();
    expect(screen.getByLabelText('Sign in with Google: New account')).toBeTruthy();
  });
});

describe('Not-affiliated notice', () => {
  const notice =
    'Magpie is not made by or linked with YouTube or Google. YouTube is a trademark of Google LLC.';

  it('shows in Settings in Light and in Dark', async () => {
    await render(<App />);
    await ready();
    await openSettings();
    expect(screen.getByText(notice)).toBeTruthy();
    await choose('Dark');
    expect(screen.getByText(notice)).toBeTruthy();
    await choose('Light');
    expect(screen.getByText(notice)).toBeTruthy();
  });
});
