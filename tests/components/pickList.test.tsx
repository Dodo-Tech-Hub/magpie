import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../../App';
import { ch, listMock, nextSignIn, resetWorld } from './helpers';

jest.mock('@/api/youtube', () => ({
  ...jest.requireActual('@/api/youtube'),
  listMySubscriptions: jest.fn(),
  subscribe: jest.fn(),
}));

beforeEach(resetWorld);

async function openList() {
  listMock.mockResolvedValueOnce([
    ch('a', 'Alpha'),
    ch('b', 'Beta'),
    ch('c', 'Gamma'),
    ch('d', 'Alphabet Soup'),
  ]);
  await render(<App />);
  nextSignIn('old');
  await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
  await screen.findByLabelText('Alpha');
}

const checked = (label: string) => screen.getByLabelText(label).props.accessibilityState.checked;

describe('pick list', () => {
  it('shows how many are picked out of all', async () => {
    await openList();
    expect(screen.getByText('4 of 4 picked')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Beta'));
    expect(screen.getByText('3 of 4 picked')).toBeTruthy();
  });

  it('filters by name while typing', async () => {
    await openList();
    await fireEvent.changeText(screen.getByLabelText('Search channels'), 'alpha');
    expect(screen.getByLabelText('Alpha')).toBeTruthy();
    expect(screen.getByLabelText('Alphabet Soup')).toBeTruthy();
    expect(screen.queryByLabelText('Beta')).toBeNull();
  });

  it('All unpicks and picks only the channels that are shown', async () => {
    await openList();
    await fireEvent.changeText(screen.getByLabelText('Search channels'), 'alpha');
    await fireEvent.press(screen.getByLabelText('All'));
    expect(checked('Alpha')).toBe(false);
    expect(checked('Alphabet Soup')).toBe(false);
    expect(screen.getByText('2 of 4 picked')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('All'));
    expect(screen.getByText('4 of 4 picked')).toBeTruthy();
  });

  it('keeps picks after the search is cleared', async () => {
    await openList();
    await fireEvent.changeText(screen.getByLabelText('Search channels'), 'beta');
    await fireEvent.press(screen.getByLabelText('Beta'));
    await fireEvent.changeText(screen.getByLabelText('Search channels'), '');
    expect(checked('Beta')).toBe(false);
    expect(checked('Gamma')).toBe(true);
    expect(screen.getByText('3 of 4 picked')).toBeTruthy();
  });
});
