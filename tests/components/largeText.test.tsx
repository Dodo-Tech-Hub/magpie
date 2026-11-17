import { StyleSheet } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { ch, listMock, nextSignIn, renderApp, resetWorld } from './helpers';
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
});

type Node = ReturnType<typeof screen.getByText>;
const scrolls = (node: Node) => {
  let n: Node | null = node;
  while (n && String(n.type) !== 'RCTScrollView') n = n.parent;
  return !!n;
};
const LONG = 'A'.repeat(80);

async function signInBoth() {
  listMock.mockResolvedValueOnce([ch('a', LONG), ch('b', 'Beta')]).mockResolvedValueOnce([]);
  await renderApp();
  nextSignIn('old');
  await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
  await screen.findByLabelText('Beta');
  await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
  nextSignIn('new');
  await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
  await screen.findByLabelText('Move 2 channels');
}

describe('a 320-point window with the largest text', () => {
  it('lets Settings, From, and To scroll', async () => {
    await renderApp();
    expect(scrolls(screen.getByLabelText('Sign in with Google: Old account'))).toBe(true);
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    expect(scrolls(screen.getByLabelText('Sign in with Google: New account'))).toBe(true);
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(scrolls(screen.getByLabelText('Delete all my data'))).toBe(true);
  });

  it('keeps a long name and its tag on one line, with the checkbox still there', async () => {
    await signInBoth();
    await fireEvent.press(screen.getByLabelText('Move 2 channels'));
    await screen.findByText('2 moved');
    expect(screen.getByText(LONG).props.numberOfLines).toBe(1);
    for (const tag of screen.getAllByText('Moved')) expect(tag.props.numberOfLines).toBe(1);
    expect(screen.getByRole('checkbox', { name: LONG })).toBeTruthy();
  });

  it('keeps the Move button outside the scrolling list', async () => {
    await signInBoth();
    expect(scrolls(screen.getByLabelText('Move 2 channels'))).toBe(false);
  });

  it('keeps each step label in the top bar on one line', async () => {
    await renderApp();
    for (const label of ['From', 'Pick', 'To']) expect(screen.getByText(label).props.numberOfLines).toBe(1);
  });

  // Jest has no real layout, so the touch targets are checked by style, as the column is in windowChange.test.tsx.
  it('gives every main control a 48-point touch target', async () => {
    const tall = (node: Node) => expect(StyleSheet.flatten(node.props.style).minHeight).toBeGreaterThanOrEqual(48);
    await renderApp();
    tall(screen.getByLabelText('Sign in with Google: Old account'));
    await fireEvent.press(screen.getByLabelText('Settings'));
    tall(screen.getByLabelText('Delete all my data'));
    for (const choice of screen.getAllByRole('radio')) tall(choice);
    await fireEvent.press(screen.getByLabelText('Back'));
    listMock.mockResolvedValueOnce([ch('b', 'Beta')]);
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
    await screen.findByLabelText('Beta');
    tall(screen.getByLabelText('Move 1 channel'));
    tall(screen.getByLabelText('Search channels').parent!);
    await fireEvent.press(screen.getByRole('tab', { name: 'From' }));
    tall(screen.getByLabelText('Switch Old account'));
  });
});
