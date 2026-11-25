import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { scopesFor } from '@/auth/bluesky';
import { blueskyStores } from '@/auth/blueskySession';
import { blueskyDriver } from '@/platforms/blueskyDriver';
import { NEW, OLD, OTHER, blueskyWorld, item, renderBluesky, resetBluesky, signInWithHandle } from './blueskyWorld';
import { __calls, __set } from '../mocks/expoWebBrowser';
import { __dump } from '../mocks/expoSecureStore';
import { mockClient, userSignsInAs } from '../mocks/oauthClient';

jest.mock('@atproto/oauth-client', () => ({
  ...jest.requireActual('@atproto/oauth-client'),
  OAuthClient: require('../mocks/oauthClient').OAuthClient,
}));

beforeEach(async () => {
  await resetBluesky();
  blueskyWorld();
});
afterEach(() => {
  jest.restoreAllMocks();
});

const readsOld = (rows: ReturnType<typeof item>[]) =>
  jest.spyOn(blueskyDriver, 'listOld').mockResolvedValue({ items: rows, missing: [] });
const openTo = () => fireEvent.press(screen.getByRole('tab', { name: 'To' }));
const asked = () => (mockClient.authorize.mock.calls.at(-1)?.[1] as { scope: string }).scope;

describe('sign in to the new account', () => {
  it('opens the browser for the typed handle and shows the account that signed in, with no extra tap', async () => {
    await userSignsInAs(NEW.did);
    await renderBluesky();
    await openTo();
    await signInWithHandle('New account', '@New.bsky.social ');
    expect(await screen.findByText(NEW.handle)).toBeTruthy();
    expect(mockClient.authorize).toHaveBeenCalledWith(NEW.handle, expect.anything());
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Sign out New account')).toBeTruthy();
  });

  it('asks for the follow, block, and list access of the picked kinds, and nothing else, when the old list has no private kinds read yet', async () => {
    readsOld([item('person', '1', 'Alice'), item('block', '2', 'Bert'), item('list', '3', 'Cats', { purpose: 'curatelist' })]);
    await renderBluesky();
    await signInWithHandle('Old account', OLD.handle);
    await screen.findByLabelText('Alice');
    await userSignsInAs(NEW.did, scopesFor('new', ['person', 'block', 'list']));
    await openTo();
    await signInWithHandle('New account', NEW.handle);
    await waitFor(() => expect(mockClient.callback).toHaveBeenCalledTimes(1));
    expect(asked().split(' ').sort()).toEqual(scopesFor('new', ['person', 'block', 'list']).split(' ').sort());
    expect(asked()).not.toMatch(/mute|Preferences|transition/);
  });

  it('asks only for the kinds that are still picked', async () => {
    readsOld([item('person', '1', 'Alice'), item('block', '2', 'Bert')]);
    await renderBluesky();
    await signInWithHandle('Old account', OLD.handle);
    await screen.findByLabelText('Alice');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'All Blocked' }));
    await userSignsInAs(NEW.did);
    await openTo();
    await signInWithHandle('New account', NEW.handle);
    await waitFor(() => expect(mockClient.callback).toHaveBeenCalledTimes(1));
    expect(asked().split(' ').sort()).toEqual(scopesFor('new', ['person']).split(' ').sort());
  });

  it('refuses the old account on To, with the text the other platforms use, and keeps no session', async () => {
    await userSignsInAs(OLD.did);
    await renderBluesky();
    await signInWithHandle('Old account', OLD.handle);
    await openTo();
    await signInWithHandle('New account', OLD.handle);
    expect(await screen.findByText('This is your old account. Pick a different one.')).toBeTruthy();
    expect(screen.getByLabelText('Sign in with Bluesky: New account')).toBeTruthy();
    await waitFor(() => expect(__dump()).toEqual({}));
  });

  it('shows another account that signs in as itself, since it may be the right one', async () => {
    await userSignsInAs(OTHER.did);
    await renderBluesky();
    await openTo();
    await signInWithHandle('New account', NEW.handle);
    expect(await screen.findByText(OTHER.handle)).toBeTruthy();
  });

  it('leaves To signed out with no error line when the user cancels', async () => {
    __set({ type: 'cancel' });
    await renderBluesky();
    await openTo();
    await signInWithHandle('New account', NEW.handle);
    await waitFor(() => expect(__calls()).toHaveLength(1));
    expect(screen.getByLabelText('Sign in with Bluesky: New account')).toBeTruthy();
    expect(screen.queryByText(/didn't finish|can't|Check the name/i)).toBeNull();
    expect(__dump()).toEqual({});
  });

  it('says why when the account is not found or hosted elsewhere, and opens no browser', async () => {
    blueskyWorld({
      'GET https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=nobody.bsky.social': { status: 400, json: { error: 'InvalidRequest' } },
      'GET https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=web.example.com': { json: { did: 'did:web:web.example.com' } },
    });
    await renderBluesky();
    await openTo();
    await signInWithHandle('New account', 'nobody');
    expect(await screen.findByText("We can't find that account. Check the name.")).toBeTruthy();
    await signInWithHandle('New account', 'web.example.com');
    expect(await screen.findByText('Magpie works only with accounts hosted by Bluesky for now.')).toBeTruthy();
    expect(__calls()).toHaveLength(0);
  });

  it('keeps the new account for a move that is not finished', async () => {
    await userSignsInAs(NEW.did);
    await renderBluesky();
    await openTo();
    await signInWithHandle('New account', NEW.handle);
    await screen.findByText(NEW.handle);
    expect(await blueskyStores.getNewDid()).toBe(NEW.did);
    expect(await blueskyDriver.canAct('new', NEW.did)).toBe(true);
  });
});
