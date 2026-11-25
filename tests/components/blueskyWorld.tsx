import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../../App';
import { blueskyStores } from '@/auth/blueskySession';
import { blueskyDriver } from '@/platforms/blueskyDriver';
import { PLATFORMS, type Platform } from '@/platforms/platforms';
import { closeStore, type NewItem } from '@/store/progressStore';
import { __reset } from '../mocks/expoSecureStore';
import { __reset as resetBrowser } from '../mocks/expoWebBrowser';
import { account, did, mockBluesky } from '../mocks/blueskyFetch';
import { resetClient } from '../mocks/oauthClient';

// Three Bluesky accounts: the old one, the new one, and a stranger.
export const OLD = { did: did(1), handle: 'old.bsky.social', name: 'Old Me' };
export const NEW = { did: did(2), handle: 'new.bsky.social', name: 'New Me' };
export const OTHER = { did: did(3), handle: 'other.bsky.social', name: 'Other One' };

// The Bluesky card is not in the platform list until its logo is added, so a test adds it for its own length.
const entry: Platform = {
  id: 'bluesky',
  name: 'Bluesky',
  logo: 1 as never,
  section: 'automatic',
  ready: true,
  driver: blueskyDriver,
  open: (dispatch) => dispatch({ type: 'openPlatform', platform: 'bluesky' }),
  unfinished: async () => ({ left: 0, ids: [] }),
};

export function registerBluesky() {
  if (!PLATFORMS.includes(entry)) PLATFORMS.push(entry);
}
export function unregisterBluesky() {
  const i = PLATFORMS.indexOf(entry);
  if (i >= 0) PLATFORMS.splice(i, 1);
}

// The fake world: the three accounts can be looked up. A test adds routes for what else it needs.
export function blueskyWorld(extra: Parameters<typeof mockBluesky>[0] = {}) {
  return mockBluesky({
    ...account(OLD.handle, OLD.did, { displayName: OLD.name }),
    ...account(NEW.handle, NEW.did, { displayName: NEW.name }),
    ...account(OTHER.handle, OTHER.did, { displayName: OTHER.name }),
    ...extra,
  });
}

export async function resetBluesky() {
  jest.clearAllMocks();
  __reset();
  resetBrowser();
  resetClient();
  for (const d of blueskyStores.oldDids()) blueskyStores.clearOld(d);
  blueskyStores.capture(false);
  await closeStore();
  registerBluesky();
}

export async function renderBluesky() {
  const view = await render(<App />);
  await fireEvent.press(await screen.findByLabelText('Bluesky'));
  return view;
}

export const item = (kind: string, id: string, title = id, data: unknown = null): NewItem => ({
  itemId: `${kind}:${id}`,
  kind,
  title,
  thumbnailUrl: null,
  data: data === null ? null : JSON.stringify(data),
});

// Type a handle in the box of the open step and tap its sign-in button.
export async function signInWithHandle(step: 'Old account' | 'New account', handle: string) {
  await fireEvent.changeText(screen.getByLabelText('Bluesky handle'), handle);
  await fireEvent.press(screen.getByLabelText(`Sign in with Bluesky: ${step}`));
}
