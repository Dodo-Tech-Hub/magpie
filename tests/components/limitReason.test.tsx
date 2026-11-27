import { Alert, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { fireEvent, screen } from '@testing-library/react-native';
import { youtubeDriver } from '@/platforms/youtubeDriver';
import { answerAlert, ch, listMock, nextSignIn, renderApp, resetWorld, subMock } from './helpers';

jest.mock('@/api/youtube', () => ({
  ...jest.requireActual('@/api/youtube'),
  listMySubscriptions: jest.fn(),
  subscribe: jest.fn(),
}));

// Spec 009: the reason comes first, in the popup and on Pick, with a link to the limits page.
// GitHub's cases are in githubLimitReason.test.tsx: the GitHub world does not share a file with the Google mocks.
const YT = "YouTube lets Magpie move only some channels each day. Today's limit is reached.";
const ASK = 'Can we remind you when you can move the rest?';
const YT_PAGE = 'https://dodo-tech-hub.github.io/magpie/limits/youtube';

const permission = Notifications.getPermissionsAsync as jest.Mock;
const message = (spy: jest.SpyInstance) => spy.mock.calls[0][1] as string;

describe('YouTube stop at the daily limit', () => {
  let alertSpy: jest.SpyInstance;
  let openSpy: jest.SpyInstance;
  const savedUrl = youtubeDriver.limitsUrl;

  beforeEach(async () => {
    await resetWorld();
    alertSpy = jest.spyOn(Alert, 'alert');
    answerAlert(alertSpy, 'No');
    openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    permission.mockResolvedValue({ granted: false, canAskAgain: true });
  });
  afterEach(() => {
    youtubeDriver.limitsUrl = savedUrl;
    openSpy.mockRestore();
  });

  async function hitLimitAfterOne() {
    subMock.mockResolvedValueOnce({ kind: 'moved' }).mockResolvedValueOnce({ kind: 'tomorrow' });
    listMock.mockResolvedValueOnce([ch('a', 'Alpha'), ch('b', 'Beta'), ch('c', 'Gamma')]).mockResolvedValueOnce([]);
    await renderApp();
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
    await screen.findByLabelText('Alpha');
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    nextSignIn('new');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
    await fireEvent.press(await screen.findByLabelText('Move 3 channels'));
    await screen.findByText(YT);
  }

  it('says the reason in the popup before the question', async () => {
    await hitLimitAfterOne();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(message(alertSpy).startsWith(YT)).toBe(true);
    expect(message(alertSpy).endsWith(ASK)).toBe(true);
  });

  it('shows the same sentence on Pick, with the paused rows and Continue, and promises no reminder', async () => {
    await hitLimitAfterOne();
    expect(screen.getByText(YT)).toBeTruthy();
    expect(screen.getAllByText('Tomorrow')).toHaveLength(2);
    expect(screen.getByLabelText('Continue')).toBeTruthy();
    expect(screen.queryByText(/remind you/)).toBeNull();
  });

  it('asks only once, and the sentence still shows on Pick at the next stop', async () => {
    await hitLimitAfterOne();
    subMock.mockResolvedValueOnce({ kind: 'moved' }).mockResolvedValueOnce({ kind: 'tomorrow' });
    await fireEvent.press(screen.getByLabelText('Continue'));
    await screen.findByText('2 moved · 1 waiting');
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText(YT)).toBeTruthy();
  });

  it('opens the YouTube limits page from Learn more and stays on Pick', async () => {
    await hitLimitAfterOne();
    await fireEvent.press(screen.getByLabelText('Learn more about YouTube limits'));
    expect(openSpy).toHaveBeenCalledWith(YT_PAGE);
    expect(screen.getAllByText('Tomorrow')).toHaveLength(2);
    expect(screen.getByLabelText('Continue')).toBeTruthy();
  });

  it('says so on Pick when the page cannot open', async () => {
    openSpy.mockRejectedValue(new Error('no browser'));
    await hitLimitAfterOne();
    await fireEvent.press(screen.getByLabelText('Learn more about YouTube limits'));
    expect(await screen.findByText("Couldn't open the page.")).toBeTruthy();
    expect(screen.getByText(YT)).toBeTruthy();
  });

  it('shows no Learn more when the platform has no limits page', async () => {
    youtubeDriver.limitsUrl = undefined;
    await hitLimitAfterOne();
    expect(screen.getByText(YT)).toBeTruthy();
    expect(screen.queryByLabelText('Learn more about YouTube limits')).toBeNull();
  });
});
