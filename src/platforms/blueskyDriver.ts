import { grantedScope, kindsOf, signIn, signOut } from '@/auth/bluesky';
import { blueskyStores } from '@/auth/blueskySession';
import type { Driver } from '@/platforms/driver';
import { blueskyWords } from '@/strings';

// The Bluesky platform driver (specs/013-bluesky-platform/contracts/platform-driver.md).
// The old account is typed in as a handle and needs no sign-in. The new account signs in in the system browser.
export const blueskyDriver: Driver = {
  id: 'bluesky',
  words: blueskyWords,
  // Pick order. Mutes and feeds are private, so they are read only after "Allow" signs in to the old account.
  kinds: [
    { id: 'person', heading: 'People' },
    { id: 'block', heading: 'Blocked' },
    { id: 'list', heading: 'Lists' },
    { id: 'mute', heading: 'Mutes', needsOld: true },
    { id: 'feed', heading: 'Feeds', needsOld: true },
  ],
  handleInput: true,
  // There is no sign-in to switch to: Sign out on To, and Change on From (words.changeOld).
  switchSignsOut: true,
  // The new account's session is kept for an unfinished move, so Continue needs no new sign-in.
  resumesNew: true,

  async signIn(role, kinds, _onCode, _signal, handle) {
    return handle?.trim() ? signIn(role, kinds, handle) : { ok: false, reason: 'not_found' };
  },

  async signOut(role) {
    return (await signOut(role)) ? undefined : false;
  },

  async granted() {
    return kindsOf(await grantedScope());
  },

  async canAct(role, accountId) {
    if (role === 'old') return blueskyStores.hasSession(accountId);
    return (await blueskyStores.getNewDid()) === accountId && (await blueskyStores.hasSession(accountId));
  },

  // ponytail: reading, checking, and adding come with the API module in the next tasks (T038 to T041).
  async listOld() {
    return { items: [], missing: [] };
  },
  async checkNew() {
    return [];
  },
  async add() {
    return { kind: 'couldnt_move', reason: "Bluesky didn't allow this one." };
  },
};
