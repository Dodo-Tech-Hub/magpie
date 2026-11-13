import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import App from '../../App';
import { PLATFORMS, type Platform } from '@/platforms/platforms';
import { AppStateProvider, useApp } from '@/state/AppState';
import { getOrCreateProgress, initStore, saveChannels, setStatus } from '@/store/progressStore';
import { ThemeProvider } from '@/theme/theme';
import { HomeView } from '@/ui/HomeView';
import { NEW, OLD, resetWorld } from './helpers';

jest.mock('@/api/youtube', () => ({
  ...jest.requireActual('@/api/youtube'),
  listMySubscriptions: jest.fn(),
  subscribe: jest.fn(),
}));

beforeEach(resetWorld);

const acct = (u: { id: string; email: string; name: string; photo: string | null }) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  photoUrl: u.photo,
});
const other = { id: 'other-id', email: 'other.me@gmail.com', name: 'Other', photo: null };

async function seed(old: typeof OLD, ids: string[]) {
  await initStore();
  const pid = await getOrCreateProgress(acct(old), acct(NEW));
  await saveChannels(pid, ids.map((id) => ({ channelId: id, title: id, thumbnailUrl: null })));
  return pid;
}
const idsOf = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}${i}`);

describe('Home sections', () => {
  it('shows the Automatic section with the YouTube card and no Guided section', async () => {
    await render(<App />);
    expect(await screen.findByText('Automatic')).toBeTruthy();
    expect(screen.getByLabelText('YouTube')).toBeTruthy();
    expect(screen.queryByText('Guided')).toBeNull();
  });

  it('marks both section headers as headings', async () => {
    const guided: Platform = { ...PLATFORMS[0], id: 'youtube', section: 'guided', name: 'Other' };
    await render(
      <ThemeProvider>
        <AppStateProvider>
          <HomeView platforms={[PLATFORMS[0], guided]} />
        </AppStateProvider>
      </ThemeProvider>,
    );
    expect(screen.getByRole('header', { name: 'Automatic' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Guided' })).toBeTruthy();
  });

  it('shows a ready Guided platform in its own section and opens it on tap', async () => {
    const open = jest.fn();
    const guided: Platform = { ...PLATFORMS[0], id: 'youtube', section: 'guided', name: 'Demo', open };
    await render(
      <ThemeProvider>
        <AppStateProvider>
          <HomeView platforms={[guided]} />
        </AppStateProvider>
      </ThemeProvider>,
    );
    expect(screen.queryByText('Automatic')).toBeNull();
    expect(screen.getByText('Guided')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Demo'));
    expect(open).toHaveBeenCalled();
  });
});

describe('Home bar', () => {
  it('shows the app icon as the heading, named Magpie, with the gear on the right', async () => {
    await render(<App />);
    expect(await screen.findByRole('header', { name: 'Magpie' })).toBeTruthy();
    expect(screen.queryByText('Magpie')).toBeNull();
    expect(screen.getByLabelText('Settings')).toBeTruthy();
  });
});

describe('card', () => {
  it('hides the logo from screen readers', async () => {
    await render(<App />);
    await screen.findByText('Automatic');
    const logo = screen.getByTestId('logo-youtube', { includeHiddenElements: true });
    expect(logo.props.accessibilityElementsHidden).toBe(true);
    expect(logo.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('still shows the name, and stays tappable, when the logo fails to load', async () => {
    await render(<App />);
    await screen.findByText('Automatic');
    await act(async () => screen.getByTestId('logo-youtube', { includeHiddenElements: true }).props.onError());
    expect(screen.queryByTestId('logo-youtube', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('YouTube')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('YouTube'));
    expect(screen.getByRole('tab', { name: 'From' })).toBeTruthy();
  });

  it('opens the YouTube flow from the card', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('YouTube'));
    expect(screen.getByRole('tab', { name: 'From' })).toBeTruthy();
  });
});

describe('Continue note', () => {
  it('is not shown with no progress', async () => {
    await render(<App />);
    await screen.findByText('Automatic');
    expect(screen.queryByText(/Continue:/)).toBeNull();
  });

  it('shows how many are left, reads as one action, and opens that progress', async () => {
    await seed(OLD, idsOf(12, 'a'));
    await render(<App />);
    const note = await screen.findByLabelText('Continue YouTube, 12 left');
    expect(screen.getByText('Continue: 12 left')).toBeTruthy();
    await fireEvent.press(note);
    expect(await screen.findByText('Sign in to new.me@gmail.com to keep going.')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'To' }).props.accessibilityState.selected).toBe(true);
  });

  it('adds the totals of several progresses and opens the From step with the Unfinished list', async () => {
    await seed(OLD, idsOf(12, 'a'));
    await seed({ ...OLD, ...other } as typeof OLD, idsOf(5, 'b'));
    await render(<App />);
    expect(await screen.findByText('Continue: 17 left')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Continue YouTube, 17 left'));
    expect(await screen.findByText('Unfinished')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'From' }).props.accessibilityState.selected).toBe(true);
  });

  it('is its own tap target apart from the card body, at least 48 points high', async () => {
    await seed(OLD, idsOf(3, 'a'));
    await render(<App />);
    const note = await screen.findByLabelText('Continue YouTube, 3 left');
    const body = screen.getByLabelText('YouTube');
    expect(note).not.toBe(body);
    expect(note.props.style.minHeight ?? 0).toBeGreaterThanOrEqual(48);
    expect(body.props.style.minHeight ?? 0).toBeGreaterThanOrEqual(48);
  });

  it('is added after the card shows, with no loading indicator', async () => {
    const pid = await seed(OLD, idsOf(2, 'a'));
    expect(pid).toBeTruthy();
    await render(<App />);
    expect(screen.getByLabelText('YouTube')).toBeTruthy();
    expect(screen.queryByText(/Loading|…/)).toBeNull();
    expect(await screen.findByText('Continue: 2 left')).toBeTruthy();
  });

  it('updates when the count changes while Home shows', async () => {
    const pid = await seed(OLD, idsOf(3, 'a'));
    let dispatch: ReturnType<typeof useApp>['dispatch'];
    const Probe = () => {
      dispatch = useApp().dispatch;
      return null;
    };
    await render(
      <ThemeProvider>
        <AppStateProvider>
          <Probe />
          <HomeView />
        </AppStateProvider>
      </ThemeProvider>,
    );
    expect(await screen.findByText('Continue: 3 left')).toBeTruthy();
    await setStatus(pid, 'a0', 'moved');
    await act(async () => dispatch({ type: 'setMoveState', moveState: 'limit' }));
    expect(await screen.findByText('Continue: 2 left')).toBeTruthy();
  });
});
