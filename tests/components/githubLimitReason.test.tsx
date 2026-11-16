import { Alert, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { fireEvent, screen } from '@testing-library/react-native';
import { recordAdd } from '@/store/progressStore';
import { eventually, githubWorld, renderGithub, repo, resetGithub, signInBoth } from './githubWorld';

// Spec 009, US1.2: GitHub can stop for two causes; both give the one GitHub sentence, first in the popup, then on Pick.
const GH = 'GitHub lets Magpie move only some items each hour. Magpie must wait a little.';
const ASK = 'Can we remind you when you can move the rest?';
const PUT = 'PUT https://api.github.com/*';
const permission = Notifications.getPermissionsAsync as jest.Mock;
const alertMessage = () => (Alert.alert as unknown as jest.Mock).mock.calls[0][1] as string;

let w: ReturnType<typeof githubWorld>;

beforeEach(async () => {
  jest.useFakeTimers();
  await resetGithub();
  permission.mockResolvedValue({ granted: false, canAskAgain: true });
  w = githubWorld();
  w.data.old.stars = [repo(1), repo(2), repo(3)];
});
afterEach(() => jest.useRealTimers());

it('gives the reason first when GitHub asks Magpie to wait', async () => {
  await renderGithub();
  await signInBoth(w);
  w.gh.set(PUT, [{ status: 204 }, { status: 403, headers: { 'retry-after': '3600' }, json: { message: 'limit' } }]);
  await fireEvent.press(await screen.findByLabelText('Move 3 items'));
  expect(await eventually(GH)).toBeTruthy();
  expect(alertMessage()).toBe(`${GH}\n\n${ASK}`);
});

it('gives the same reason when the hourly pace is reached, with Learn more on Pick', async () => {
  await renderGithub();
  await signInBoth(w);
  for (let i = 0; i < 299; i += 1) await recordAdd('github:2', Date.now() - 1000 - i);
  await fireEvent.press(await screen.findByLabelText('Move 3 items'));
  expect(await eventually(GH)).toBeTruthy();
  expect(alertMessage()).toBe(`${GH}\n\n${ASK}`);
  await fireEvent.press(screen.getByLabelText('Learn more about GitHub limits'));
  expect(Linking.openURL).toHaveBeenCalledWith('https://dodo-tech-hub.github.io/magpie/limits/github');
});
