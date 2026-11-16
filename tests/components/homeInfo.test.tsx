import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../../App';
import { PLATFORMS, type Platform } from '@/platforms/platforms';
import { AppStateProvider, useApp } from '@/state/AppState';
import { getOrCreateProgress, initStore, saveItems } from '@/store/progressStore';
import { ThemeProvider } from '@/theme/theme';
import { HomeView } from '@/ui/HomeView';
import { NEW, OLD, resetWorld } from './helpers';

jest.mock('@/api/youtube', () => ({
  ...jest.requireActual('@/api/youtube'),
  listMySubscriptions: jest.fn(),
  subscribe: jest.fn(),
}));

// Spec 009, US2: the info button on each Home card opens that platform's limits page in the system browser.
const YT_PAGE = 'https://dodo-tech-hub.github.io/magpie/limits/youtube';
const GH_PAGE = 'https://dodo-tech-hub.github.io/magpie/limits/github';
const FAILED = "Couldn't open the page.";

let openSpy: jest.SpyInstance;
beforeEach(async () => {
  await resetWorld();
  openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});
afterEach(() => openSpy.mockRestore());

const acct = (u: typeof OLD) => ({ id: u.id, handle: u.email, name: u.name, photoUrl: u.photo });

function renderHome(platforms: Platform[], extra?: React.ReactNode) {
  return render(
    <ThemeProvider>
      <AppStateProvider>
        <HomeView platforms={platforms} />
        {extra}
      </AppStateProvider>
    </ThemeProvider>,
  );
}

describe('info button on Home cards', () => {
  it('names the platform on each card', async () => {
    await render(<App />);
    expect(await screen.findByLabelText('About YouTube limits')).toBeTruthy();
    expect(screen.getByLabelText('About GitHub limits')).toBeTruthy();
  });

  it('opens the YouTube limits page and not the YouTube flow', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('About YouTube limits'));
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(YT_PAGE);
    expect(screen.getByLabelText('YouTube')).toBeTruthy();
    expect(screen.queryByLabelText('Sign in with Google: Old account')).toBeNull();
  });

  it('opens the GitHub limits page and not the GitHub flow', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('About GitHub limits'));
    expect(openSpy).toHaveBeenCalledWith(GH_PAGE);
    expect(screen.queryByLabelText('Sign in with GitHub: Old account')).toBeNull();
  });

  it('opens only the page on a card with a Continue note', async () => {
    await initStore();
    const pid = await getOrCreateProgress('youtube', acct(OLD), acct(NEW));
    await saveItems(pid, ['a', 'b'].map((id) => ({ itemId: id, kind: 'channel', title: id, thumbnailUrl: null, data: null })));
    await render(<App />);
    const note = await screen.findByLabelText('Continue YouTube, 2 left');
    await fireEvent.press(screen.getByLabelText('About YouTube limits'));
    expect(openSpy).toHaveBeenCalledWith(YT_PAGE);
    expect(note).toBeTruthy();
    expect(screen.getByLabelText('Continue YouTube, 2 left')).toBeTruthy();
    expect(screen.queryByLabelText('Sign in with Google: New account')).toBeNull();
  });

  it('stays on Home and says so when the page cannot open', async () => {
    openSpy.mockRejectedValue(new Error('no browser'));
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('About YouTube limits'));
    expect(await screen.findByText(FAILED)).toBeTruthy();
    expect(screen.getByLabelText('YouTube')).toBeTruthy();
  });

  it('shows no info button for a platform without a limits page', async () => {
    const noPage: Platform = { ...PLATFORMS[0], driver: { ...PLATFORMS[0].driver, limitsUrl: undefined } };
    await renderHome([noPage]);
    expect(screen.getByLabelText('YouTube')).toBeTruthy();
    expect(screen.queryByLabelText('About YouTube limits')).toBeNull();
  });

  it("does not show a flow's notice on Home", async () => {
    function FlowNotice() {
      const { dispatch } = useApp();
      useEffect(() => dispatch({ type: 'setNotice', notice: "No internet. Try again when you're online." }), [dispatch]);
      return null;
    }
    await renderHome(PLATFORMS, <FlowNotice />);
    expect(screen.getByLabelText('YouTube')).toBeTruthy();
    expect(screen.queryByText("No internet. Try again when you're online.")).toBeNull();
  });
});
