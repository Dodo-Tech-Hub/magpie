import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ch, listMock, nextSignIn, renderApp, resetWorld, subMock } from './helpers';

jest.mock('@/api/youtube', () => ({
  ...jest.requireActual('@/api/youtube'),
  listMySubscriptions: jest.fn(),
  subscribe: jest.fn(),
}));

beforeEach(resetWorld);

async function signInBoth(oldList = [ch('a', 'Alpha'), ch('b', 'Beta'), ch('c', 'Gamma')], newList = [] as ReturnType<typeof ch>[]) {
  listMock.mockResolvedValueOnce(oldList).mockResolvedValueOnce(newList);
  await renderApp();
  nextSignIn('old');
  await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
  await screen.findByLabelText('Alpha');
  await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
  nextSignIn('new');
  await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
}

describe('moving channels', () => {
  it('shows the old account channels, all picked, with a Move button', async () => {
    listMock.mockResolvedValueOnce([ch('a', 'Alpha'), ch('b', 'Beta')]);
    await renderApp();
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
    expect(await screen.findByLabelText('Alpha')).toBeTruthy();
    expect(screen.getByLabelText('Move 2 channels')).toBeTruthy();
  });

  it('moves the picked channels and keeps a summary on the same screen', async () => {
    await signInBoth();
    await fireEvent.press(await screen.findByLabelText('Move 3 channels'));
    expect(await screen.findByText('3 moved')).toBeTruthy();
    expect(subMock.mock.calls.map((c) => c[1]).sort()).toEqual(['a', 'b', 'c']);
    expect(screen.getAllByText('Moved')).toHaveLength(3);
  });

  it('only moves channels that are still picked', async () => {
    await signInBoth();
    await fireEvent.press(await screen.findByLabelText('Beta'));
    await fireEvent.press(await screen.findByLabelText('Move 2 channels'));
    expect(await screen.findByText('2 moved')).toBeTruthy();
    expect(subMock.mock.calls.map((c) => c[1]).sort()).toEqual(['a', 'c']);
  });

  it("marks a channel that fails as \"Couldn't move\" and still moves the others", async () => {
    subMock.mockImplementation(async (_t: string, id: string) =>
      id === 'b' ? { kind: 'couldnt_move' } : { kind: 'moved' },
    );
    await signInBoth();
    await fireEvent.press(await screen.findByLabelText('Move 3 channels'));
    expect(await screen.findByText("2 moved · 1 couldn't move")).toBeTruthy();
    expect(screen.getByText("Couldn't move")).toBeTruthy();
  });

  it('goes to To and explains what is missing when the new account is not signed in', async () => {
    listMock.mockResolvedValueOnce([ch('a', 'Alpha')]);
    await renderApp();
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
    await fireEvent.press(await screen.findByLabelText('Move 1 channel'));
    expect(await screen.findByText('Sign in to your new account first')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'To' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Sign in with Google: New account')).toBeTruthy();
    expect(subMock).not.toHaveBeenCalled();
  });

  it('says to pick at least 1 channel when everything is unpicked', async () => {
    await signInBoth();
    for (const t of ['Alpha', 'Beta', 'Gamma']) await fireEvent.press(await screen.findByLabelText(t));
    await waitFor(() => expect(screen.getByLabelText('Move 0 channels')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Move 0 channels'));
    expect(await screen.findByText('Pick at least 1 channel')).toBeTruthy();
  });
});
