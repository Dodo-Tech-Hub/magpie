import React from 'react';
import { PixelRatio } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import App from '../../App';
import { resetWorld } from './helpers';
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
  setWindow(320, 640, 2);
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
});
afterEach(() => jest.restoreAllMocks());

describe('Home at 320 points wide with the largest text', () => {
  it('uses one column', async () => {
    await render(<App />);
    await screen.findByText('Automatic');
    expect(screen.getByTestId('cell-youtube').props.style.width).toBe('100%');
  });

  it('lets a name wrap to 2 lines, with no cutting off', async () => {
    await render(<App />);
    await screen.findByText('Automatic');
    expect(screen.getByText('YouTube').props.numberOfLines).toBe(2);
  });

  it('keeps the grid inside a scroll view', async () => {
    await render(<App />);
    await screen.findByText('Automatic');
    let node = screen.getByTestId('cell-youtube').parent;
    while (node && String(node.type) !== 'RCTScrollView') node = node.parent;
    expect(node).toBeTruthy();
  });
});

describe('Home in a wide window', () => {
  // Columns are counted from the 600-point column, not the window: 600 / (160 * 2) gives 1.
  it('counts the columns from the column width', async () => {
    setWindow(900, 800, 2);
    await render(<App />);
    await screen.findByText('Automatic');
    expect(screen.getByTestId('cell-youtube').props.style.width).toBe('100%');
  });

  it('shows 3 columns at the normal text size', async () => {
    setWindow(900, 800, 1);
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    await render(<App />);
    await screen.findByText('Automatic');
    expect(screen.getByTestId('cell-youtube').props.style.width).toBe(`${100 / 3}%`);
  });
});
