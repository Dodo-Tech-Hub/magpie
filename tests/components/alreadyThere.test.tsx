import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../../App';
import { ch, listMock, nextSignIn, resetWorld, subMock } from './helpers';

jest.mock('@/api/youtube', () => ({
  ...jest.requireActual('@/api/youtube'),
  listMySubscriptions: jest.fn(),
  subscribe: jest.fn(),
}));

beforeEach(resetWorld);

async function open(newFollows: ReturnType<typeof ch>[]) {
  listMock
    .mockResolvedValueOnce([ch('a', 'Alpha'), ch('b', 'Beta'), ch('c', 'Gamma')])
    .mockResolvedValueOnce(newFollows);
  await render(<App />);
  nextSignIn('old');
  await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
  await screen.findByLabelText('Alpha');
  await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
  nextSignIn('new');
  await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
}

describe('already there', () => {
  it('marks channels the new account follows, cannot be picked, and leaves them out of the count', async () => {
    await open([ch('b', 'Beta')]);
    expect(await screen.findByText('Already there')).toBeTruthy();
    const beta = screen.getByLabelText('Beta');
    expect(beta.props.accessibilityState.disabled).toBe(true);
    expect(beta.props.accessibilityState.checked).toBe(false);
    expect(screen.getByLabelText('Move 2 channels')).toBeTruthy();
    expect(screen.getByText('2 of 2 picked')).toBeTruthy();
  });

  it('does not move them', async () => {
    await open([ch('b', 'Beta')]);
    await fireEvent.press(await screen.findByLabelText('Move 2 channels'));
    expect(await screen.findByText('2 moved · 1 already there')).toBeTruthy();
    expect(subMock.mock.calls.map((c) => c[1]).sort()).toEqual(['a', 'c']);
  });

  it('ends at once with a summary when everything is already there', async () => {
    await open([ch('a'), ch('b'), ch('c')]);
    await fireEvent.press(await screen.findByLabelText('Move 0 channels'));
    expect(await screen.findByText('0 moved · 3 already there')).toBeTruthy();
    expect(subMock).not.toHaveBeenCalled();
  });
});
