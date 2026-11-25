import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { scopesFor } from '@/auth/bluesky';
import { blueskyStores } from '@/auth/blueskySession';
import { NEW, OLD, OTHER, blueskyWorld, feedUri, person, renderBluesky, resetBluesky, signInNewAccount, signInWithHandle } from './blueskyWorld';
import { __dump } from '../mocks/expoSecureStore';
import { mockClient, userSignsInAs } from '../mocks/oauthClient';

jest.mock('@atproto/oauth-client', () => ({
  ...jest.requireActual('@atproto/oauth-client'),
  OAuthClient: require('../mocks/oauthClient').OAuthClient,
}));

let w: ReturnType<typeof blueskyWorld>;
const READ = scopesFor('old', ['mute', 'feed']);
const PUBLIC_KINDS = ['person', 'block', 'list'];
const asked = () => (mockClient.authorize.mock.calls.at(-1)?.[1] as { scope: string }).scope;
const move = async (label: string) => fireEvent.press(await screen.findByLabelText(label));
const finished = (text: string | RegExp) => screen.findByText(text, {}, { timeout: 8000 });

beforeEach(async () => {
  await resetBluesky();
  w = blueskyWorld();
  w.data.old.follows = [1];
  w.data.old.mutes = [4, 3, 2]; // newest first: person 2 was muted first
  w.data.old.feeds = [{ n: 1, pinned: true }, { n: 2, pinned: false }];
  w.data.new.otherPrefs = [{ $type: 'app.bsky.actor.defs#adultContentPref', enabled: false }];
  w.data.new.feeds = [{ n: 9, pinned: true }];
});

async function openPick() {
  await renderBluesky();
  await signInWithHandle('Old account', OLD.handle);
  await screen.findByLabelText('Person 1');
}
// "Allow" on Mutes: sign in to the old account for mutes and feeds, read-only.
async function allowOld() {
  await userSignsInAs(OLD.did, READ);
  await fireEvent.press(screen.getByLabelText('Allow Mutes'));
  await screen.findByLabelText('Person 2');
}

describe('Mutes and Feeds on Pick', () => {
  it('are greyed with Allow until the old account signs in, and are not counted', async () => {
    await openPick();
    expect(screen.getByLabelText('Allow Mutes')).toBeTruthy();
    expect(screen.getByLabelText('Allow Feeds')).toBeTruthy();
    expect(screen.getByText('1 of 1 picked')).toBeTruthy();
  });

  it('open the old account sign-in for the old handle, with only the access to read', async () => {
    await openPick();
    await allowOld();
    expect(mockClient.authorize).toHaveBeenCalledWith(OLD.handle, expect.objectContaining({ scope: READ }));
    expect(asked().split(' ').every((x) => x === 'atproto' || /get(Mutes|Preferences)/.test(x))).toBe(true);
    expect(asked()).not.toMatch(/put|create|muteActor/);
  });

  it('show the five rows picked, keep what was picked before, and leave no session of the old account', async () => {
    await openPick();
    await fireEvent.press(screen.getByLabelText('Person 1'));
    expect(screen.getByText('0 of 1 picked')).toBeTruthy();
    await allowOld();
    expect(screen.getByLabelText('Person 3')).toBeTruthy();
    expect(screen.getByLabelText('Feed 1')).toBeTruthy();
    expect(screen.getByLabelText('Feed 2')).toBeTruthy();
    expect(screen.getByText('5 of 6 picked')).toBeTruthy();
    expect(screen.queryByLabelText('Allow Mutes')).toBeNull();
    expect(mockClient.sessions.size).toBe(0);
    expect(await blueskyStores.hasSession(OLD.did)).toBe(false);
    expect(__dump()).toEqual({});
  });

  it('refuse another account, and read nothing', async () => {
    await openPick();
    await userSignsInAs(OTHER.did, READ);
    await fireEvent.press(screen.getByLabelText('Allow Mutes'));
    expect(await screen.findByText('Use your old account here.')).toBeTruthy();
    expect(screen.queryByLabelText('Person 2')).toBeNull();
    expect(screen.getByLabelText('Allow Mutes')).toBeTruthy();
    expect(__dump()).toEqual({});
  });

  it('leave out a muted person whose account is gone', async () => {
    w.gone.add(3);
    await openPick();
    await allowOld();
    expect(screen.queryByLabelText('Person 3')).toBeNull();
    expect(screen.getByLabelText('Person 4')).toBeTruthy();
  });

  it('are greyed again for the new account, which signs in again with the earlier access plus that kind', async () => {
    await openPick();
    await allowOld();
    await signInNewAccount();
    expect(screen.getByText('Magpie needs extra access to move mutes.')).toBeTruthy();
    expect(screen.getByText('Magpie needs extra access to move feeds.')).toBeTruthy();
    // Kinds without access stay unpicked, so only the follow is picked.
    expect(screen.getByText('1 of 6 picked')).toBeTruthy();
    await userSignsInAs(NEW.did, scopesFor('new', [...PUBLIC_KINDS, 'mute']));
    await fireEvent.press(screen.getByLabelText('Allow Mutes'));
    await waitFor(() => expect(screen.getByLabelText('Move 4 items')).toBeTruthy());
    expect(asked().split(' ').sort()).toEqual(scopesFor('new', [...PUBLIC_KINDS, 'mute']).split(' ').sort());
    expect(screen.getByText('Magpie needs extra access to move feeds.')).toBeTruthy();
  });
});

describe('moving mutes and feeds', () => {
  async function ready() {
    await openPick();
    await allowOld();
    await userSignsInAs(NEW.did, scopesFor('new', [...PUBLIC_KINDS, 'mute', 'feed']));
    await signInNewAccount(scopesFor('new', [...PUBLIC_KINDS, 'mute', 'feed']));
  }

  it('mutes the people, saves both feeds with the same one pinned after its own pinned feed, and changes no other setting', async () => {
    await ready();
    await move('Move 6 items');
    expect(await finished('6 moved')).toBeTruthy();
    expect(w.data.new.mutes.slice().sort()).toEqual([2, 3, 4]);
    expect(w.muted).toEqual([person(2).did, person(3).did, person(4).did]);
    expect(w.data.new.feeds).toEqual([{ n: 9, pinned: true }, { n: 1, pinned: true }, { n: 2, pinned: false }]);
    expect(w.data.new.otherPrefs).toEqual([{ $type: 'app.bsky.actor.defs#adultContentPref', enabled: false }]);
    expect(w.prefWrites).toHaveLength(2);
    expect(w.data.old.mutes).toEqual([4, 3, 2]);
  });

  it('does not count Mutes and Feeds as failed when the user never tapped Allow', async () => {
    await openPick();
    await signInNewAccount();
    await move('Move 1 item');
    expect(await finished('1 moved')).toBeTruthy();
    expect(screen.queryByText(/couldn't move/i)).toBeNull();
    expect(w.muted).toEqual([]);
    expect(w.prefWrites).toEqual([]);
  });

  it('shows a mute the new account already has as already there', async () => {
    w.data.new.mutes = [3];
    w.data.new.feeds = [{ n: 9, pinned: true }, { n: 2, pinned: false }];
    await ready();
    await fireEvent.press(screen.getByRole('tab', { name: 'Pick' }));
    await waitFor(() => expect(screen.getAllByText('Already there')).toHaveLength(2));
    await move('Move 4 items');
    expect(await finished(/4 moved/)).toBeTruthy();
  });
});
