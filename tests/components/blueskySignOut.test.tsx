import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { blueskyStores } from '@/auth/blueskySession';
import { listUnfinished } from '@/store/progressStore';
import { NEW, OLD, answerReminder, blueskyWorld, eventually, renderBluesky, resetBluesky, seconds, signInNewAccount, signInWithHandle } from './blueskyWorld';
import { rateLimited } from '../mocks/blueskyFetch';
import { __dump } from '../mocks/expoSecureStore';
import { mockClient } from '../mocks/oauthClient';

jest.mock('@atproto/oauth-client', () => ({
  ...jest.requireActual('@atproto/oauth-client'),
  OAuthClient: require('../mocks/oauthClient').OAuthClient,
}));

let w: ReturnType<typeof blueskyWorld>;
const NOTE = "Magpie's access ends on its own within an hour.";

beforeEach(async () => {
  jest.useFakeTimers();
  await resetBluesky();
  answerReminder('No');
  w = blueskyWorld();
  w.data.old.follows = [2, 1];
});
afterEach(() => {
  jest.useRealTimers();
});

const move = async (label: string) => fireEvent.press(await screen.findByLabelText(label));
const openTo = () => fireEvent.press(screen.getByRole('tab', { name: 'To' }));
const secureKeys = () => Object.keys(__dump());
const revoked = () => [...mockClient.sessions.values()];

async function openPick() {
  await renderBluesky();
  await signInWithHandle('Old account', OLD.handle);
  await screen.findByRole('checkbox', { name: 'All' });
  await signInNewAccount();
}

describe('Sign out', () => {
  it('cancels the access on Bluesky, deletes the session, and shows To signed out with a Sign in button', async () => {
    await openPick();
    const session = revoked()[0];
    expect(secureKeys().some((k) => k.startsWith('bluesky.session.'))).toBe(true);
    await openTo();
    await fireEvent.press(screen.getByLabelText('Sign out New account'));
    expect(await screen.findByLabelText('Sign in with Bluesky: New account')).toBeTruthy();
    expect(session.signOut).toHaveBeenCalledTimes(1);
    expect(__dump()).toEqual({});
    // The access token outlives the cancel, so the line shows even when the cancel call worked.
    expect(await screen.findByText(NOTE)).toBeTruthy();
  });

  it('still deletes the session when Bluesky cannot be told, and says the access ends on its own, with no page to open', async () => {
    await openPick();
    mockClient.offline = true;
    await openTo();
    await fireEvent.press(screen.getByLabelText('Sign out New account'));
    expect(await screen.findByText(NOTE)).toBeTruthy();
    expect(__dump()).toEqual({});
    expect(screen.queryByLabelText(/^Open .* settings$/)).toBeNull();
  });

  it('brings the handle box back with Change on From, and keeps the progress', async () => {
    await openPick();
    await fireEvent.press(screen.getByRole('tab', { name: 'From' }));
    await fireEvent.press(screen.getByLabelText('Change Old account'));
    expect(await screen.findByLabelText('Bluesky handle')).toBeTruthy();
    expect((await listUnfinished('bluesky')).length).toBe(1);
  });
});

describe('the summary', () => {
  it('cancels the access and deletes the session when the move ends', async () => {
    await openPick();
    const session = revoked()[0];
    await move('Move 2 items');
    expect(await eventually('2 moved')).toBeTruthy();
    expect(session.signOut).toHaveBeenCalledTimes(1);
    expect(__dump()).toEqual({});
    expect(screen.getByText(NOTE)).toBeTruthy();
  });

  it('says the access ends on its own when it could not be cancelled', async () => {
    await openPick();
    mockClient.offline = true;
    await move('Move 2 items');
    expect(await eventually('2 moved')).toBeTruthy();
    expect(screen.getByText(NOTE)).toBeTruthy();
    expect(__dump()).toEqual({});
  });

  it('keeps the session while the move is unfinished, and Continue uses it with no new sign-in', async () => {
    await openPick();
    w.answerNext('app.bsky.graph.follow', 'ok', rateLimited(3600));
    await move('Move 2 items');
    await eventually('Bluesky lets Magpie move only some items each hour and each day. Magpie must wait a little.');
    expect(secureKeys().some((k) => k.startsWith('bluesky.session.'))).toBe(true);
    expect(revoked()[0].signOut).not.toHaveBeenCalled();
    await seconds(3601);
    await move('Continue');
    expect(await eventually('2 moved')).toBeTruthy();
    expect(__dump()).toEqual({});
  });
});

describe('the old account', () => {
  it('never has a session in the secure storage, from the typed handle to the end of the move', async () => {
    await renderBluesky();
    await signInWithHandle('Old account', OLD.handle);
    await screen.findByRole('checkbox', { name: 'All' });
    expect(__dump()).toEqual({});
    await signInNewAccount();
    expect(JSON.stringify(__dump())).not.toContain(OLD.did.replace(/:/g, '_'));
    expect(await blueskyStores.hasSession(OLD.did)).toBe(false);
  });
});

describe('Delete all', () => {
  it('leaves no Bluesky account, session, progress, or add log, even when Bluesky cannot be told', async () => {
    await openPick();
    w.answerNext('app.bsky.graph.follow', 'ok', rateLimited(3600));
    await move('Move 2 items');
    await eventually('Bluesky lets Magpie move only some items each hour and each day. Magpie must wait a little.');
    expect((await listUnfinished()).length).toBe(1);
    mockClient.offline = true;
    await fireEvent.press(screen.getByLabelText('Settings'));
    answerReminder('Delete');
    await fireEvent.press(screen.getByLabelText('Delete all my data'));
    await seconds(1);
    expect(__dump()).toEqual({});
    expect(await listUnfinished()).toEqual([]);
    expect(await blueskyStores.getNewDid()).toBeNull();
  });
});

describe("Don't save", () => {
  it('deletes the progress and the session when the user switches platform and does not save', async () => {
    await openPick();
    await fireEvent.press(screen.getByLabelText('Home'));
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => (buttons ?? []).find((b) => b.text === "Don't save")?.onPress?.());
    await fireEvent.press(screen.getByLabelText('YouTube'));
    await waitFor(async () => expect(await listUnfinished('bluesky')).toEqual([]));
    expect(__dump()).toEqual({});
    expect(NEW.handle).toBeTruthy();
  });
});
