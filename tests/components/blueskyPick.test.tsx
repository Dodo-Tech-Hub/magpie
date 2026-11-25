import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from '../../App';
import { NEW, OLD, blueskyWorld, person, renderBluesky, resetBluesky, signInNewAccount, signInWithHandle } from './blueskyWorld';
import { setWindow } from './window';
import { __calls } from '../mocks/expoWebBrowser';

jest.mock('@atproto/oauth-client', () => ({
  ...jest.requireActual('@atproto/oauth-client'),
  OAuthClient: require('../mocks/oauthClient').OAuthClient,
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => require('./window').mockWindow,
}));

let w: ReturnType<typeof blueskyWorld>;

beforeEach(async () => {
  await resetBluesky();
  setWindow(400);
  w = blueskyWorld();
  w.data.old.follows = [3, 2, 1];
  w.data.old.blocks = [4, 5];
  w.data.old.lists = [{ name: 'Cats', members: [1, 2] }];
});

const heading = (name: string) => screen.getByRole('button', { name });

describe.each([
  ['Compact', 400],
  ['Medium', 700],
])('Pick at a %s window', (_name, width) => {
  beforeEach(() => setWindow(width));

  it('lists People, Blocked, and Lists with their counts, all picked, after the old handle is typed with no sign-in', async () => {
    await renderBluesky();
    await signInWithHandle('Old account', '@Old.bsky.social ');
    expect(await screen.findByLabelText('Person 1')).toBeTruthy();
    expect(heading('People, 3')).toBeTruthy();
    expect(heading('Blocked, 2')).toBeTruthy();
    expect(heading('Lists, 1')).toBeTruthy();
    expect(screen.getByText('6 of 6 picked')).toBeTruthy();
    expect(screen.getByLabelText('Move 6 items')).toBeTruthy();
    expect(__calls()).toHaveLength(0);
  });

  it('keeps blocked people in their own section and picks them like the rest', async () => {
    await renderBluesky();
    await signInWithHandle('Old account', OLD.handle);
    await screen.findByLabelText('Person 4');
    expect(screen.getByRole('checkbox', { name: 'All Blocked' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'All People' }).props.accessibilityState.checked).toBe(true);
  });

  it('greys out Mutes and Feeds with a line and an Allow button, and leaves them out of the count', async () => {
    // A short list, so every section is drawn at once.
    w.data.old.follows = [1];
    w.data.old.blocks = [2];
    w.data.old.lists = [{ name: 'Cats', members: [1] }];
    await renderBluesky();
    await signInWithHandle('Old account', OLD.handle);
    await screen.findByLabelText('Person 1');
    expect(heading('Mutes')).toBeTruthy();
    expect(heading('Feeds')).toBeTruthy();
    expect(screen.getAllByText('Sign in to your old account to move these.')).toHaveLength(2);
    expect(screen.getByLabelText('Allow Mutes')).toBeTruthy();
    expect(screen.getByLabelText('Allow Feeds')).toBeTruthy();
    expect(screen.getByText('3 of 3 picked')).toBeTruthy();
  });

  it('shows "Already there" for what the new account has, including itself, and cannot be picked', async () => {
    w.data.new.follows = [2];
    w.data.new.blocks = [4];
    w.data.old.follows = [3, 2, 1];
    await renderBluesky();
    await signInWithHandle('Old account', OLD.handle);
    await screen.findByLabelText('Person 1');
    await signInNewAccount();
    await fireEvent.press(screen.getByRole('tab', { name: 'Pick' }));
    await waitFor(() => expect(screen.getAllByText('Already there')).toHaveLength(2));
    expect(screen.getByText('4 of 4 picked')).toBeTruthy();
    expect(screen.getByLabelText('Move 4 items')).toBeTruthy();
  });
});

describe('the Bluesky card on Home', () => {
  it('is in the Automatic section after YouTube and GitHub, with its logo', async () => {
    await render(<App />);
    await screen.findByLabelText('Bluesky');
    const logos = screen.getAllByTestId(/^logo-/, { includeHiddenElements: true }).map((l) => l.props.testID);
    expect(logos).toEqual(['logo-youtube', 'logo-github', 'logo-bluesky']);
    expect(screen.getByLabelText('Bluesky')).toBeTruthy();
  });
});

describe('Pick, other cases', () => {
  it('counts a follow of the new account itself as already there', async () => {
    w.data.old.follows = [1];
    w.data.old.blocks = [];
    w.data.old.lists = [];
    // The old account follows the new account: an account cannot follow itself.
    w.f.set(`GET https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows?actor=${OLD.did}&limit=100`, {
      json: { follows: [person(1), { did: NEW.did, handle: NEW.handle, displayName: NEW.name }] },
    });
    await renderBluesky();
    await signInWithHandle('Old account', OLD.handle);
    await screen.findByLabelText('Person 1');
    await signInNewAccount();
    await fireEvent.press(screen.getByRole('tab', { name: 'Pick' }));
    await waitFor(() => expect(screen.getAllByText('Already there')).toHaveLength(1));
    expect(screen.getByLabelText('Move 1 item')).toBeTruthy();
  });

  it('says the account does not follow anything yet, and offers no Move, when the old account has nothing public', async () => {
    w.data.old.follows = [];
    w.data.old.blocks = [];
    w.data.old.lists = [];
    await renderBluesky();
    await signInWithHandle('Old account', OLD.handle);
    expect(await screen.findByText("This account doesn't follow anything yet")).toBeTruthy();
    expect(screen.queryByLabelText(/^Move/)).toBeNull();
  });

  it('says the account was not found, or is hosted elsewhere, and stays on From without calling that server', async () => {
    w.f.set('GET https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=nobody.bsky.social', { status: 400, json: { error: 'InvalidRequest' } });
    w.f.set('GET https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=me.example.com', { json: { did: 'did:web:me.example.com' } });
    await renderBluesky();
    await signInWithHandle('Old account', 'nobody');
    expect(await screen.findByText("We can't find that account. Check the name.")).toBeTruthy();
    await signInWithHandle('Old account', 'me.example.com');
    expect(await screen.findByText('Magpie works only with accounts hosted by Bluesky for now.')).toBeTruthy();
    expect(screen.getByLabelText('Bluesky handle')).toBeTruthy();
    expect(w.f.hosts().every((h) => h === 'public.api.bsky.app')).toBe(true);
  });

  it('loads what it can when one kind fails, and says some items could not load', async () => {
    w.f.set('GET https://morel.us-east.host.bsky.network/xrpc/com.atproto.repo.listRecords*', { status: 500, json: {} });
    await renderBluesky();
    await signInWithHandle('Old account', OLD.handle);
    expect(await screen.findByLabelText('Person 1')).toBeTruthy();
    expect(screen.getByText("Some items couldn't load. The rest can still move.")).toBeTruthy();
    expect(screen.queryByLabelText('Person 4')).toBeNull();
  });

  it('shows the same Pick after the window changes', async () => {
    await renderBluesky();
    await signInWithHandle('Old account', OLD.handle);
    await screen.findByLabelText('Person 1');
    await fireEvent.press(heading('Blocked, 2'));
    setWindow(700);
    await screen.rerender(<App />);
    expect(screen.getByLabelText('Person 1')).toBeTruthy();
    expect(screen.queryByLabelText('Person 4')).toBeNull();
    expect(NEW.handle).toBeTruthy();
  });
});
