import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import App from '../../App';
import { githubWorld, person, renderGithub, repo, resetGithub, seconds, signInBoth } from './githubWorld';
import { setWindow } from './window';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => require('./window').mockWindow,
}));

let w: ReturnType<typeof githubWorld>;

beforeEach(async () => {
  jest.useFakeTimers();
  await resetGithub();
  w = githubWorld();
  setWindow(400);
});
afterEach(() => jest.useRealTimers());

const resize = async (width: number) => {
  setWindow(width);
  await screen.rerender(<App />);
};
const heading = (name: string) => screen.getByRole('button', { name });

describe('keep my place on GitHub', () => {
  it('keeps the same sign-in code while the window changes, and still finishes the sign-in', async () => {
    w.signIn('old', { pending: 3 });
    await renderGithub();
    await fireEvent.press(screen.getByLabelText('Sign in with GitHub: Old account'));
    await seconds(0);
    expect(await screen.findByText('ABCD-1234')).toBeTruthy();
    await resize(700);
    await resize(360);
    expect(screen.getByText('ABCD-1234')).toBeTruthy();
    expect(w.gh.callsTo('POST', 'https://github.com/login/device/code')).toHaveLength(1);
    await seconds(6);
    await fireEvent.press(screen.getByRole('tab', { name: 'From' }));
    expect(await screen.findByText('old-me')).toBeTruthy();
  });

  it('keeps a collapsed section collapsed', async () => {
    w.data.old.stars = [repo(1), repo(2)];
    w.data.old.people = [person(7, 'bob')];
    await renderGithub();
    await signInBoth(w);
    await fireEvent.press(heading('Stars, 2'));
    await resize(700);
    await resize(360);
    expect(heading('Stars, 2').props.accessibilityState.expanded).toBe(false);
    expect(screen.queryByLabelText('o/r1')).toBeNull();
    expect(screen.getByLabelText('bob')).toBeTruthy();
  });
});
