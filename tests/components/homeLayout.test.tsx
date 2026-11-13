import React from 'react';
import { PixelRatio } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import App from '../../App';
import { resetWorld } from './helpers';

jest.mock('@/api/youtube', () => ({
  ...jest.requireActual('@/api/youtube'),
  listMySubscriptions: jest.fn(),
  subscribe: jest.fn(),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 320, height: 640, scale: 2, fontScale: 2 }),
}));

beforeEach(async () => {
  await resetWorld();
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
});
afterEach(() => jest.restoreAllMocks());

describe('Home at 320 points wide with the largest text', () => {
  it('uses one column', async () => {
    await render(<App />);
    await screen.findByText('Automatic');
    expect(screen.getByTestId('cell-youtube').props.style.width).toBe('100%');
  });

  it('lets a name wrap to 2 lines and a label to 3, with no cutting off', async () => {
    await render(<App />);
    await screen.findByText('Automatic');
    expect(screen.getByText('YouTube').props.numberOfLines).toBe(2);
    expect(screen.getByText('We move them for you').props.numberOfLines).toBe(3);
  });

  it('keeps the grid inside a scroll view', async () => {
    await render(<App />);
    await screen.findByText('Automatic');
    let node = screen.getByTestId('cell-youtube').parent;
    while (node && String(node.type) !== 'RCTScrollView') node = node.parent;
    expect(node).toBeTruthy();
  });
});
