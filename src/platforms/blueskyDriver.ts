import { addFeed, addList, blockPerson, followPerson, haveOnNew, muteActor, readBlocks, readFeeds, readFollows, readLists, readMutes } from '@/api/bluesky';
import { grantedScope, kindsOf, newAccountFetch, oldAccountFetch, signIn, signOut } from '@/auth/bluesky';
import { lookup } from '@/auth/blueskyLookup';
import { blueskyStores } from '@/auth/blueskySession';
import { DriverError, type Driver, type Outcome } from '@/platforms/driver';
import type { NewItem, StoredItem } from '@/store/progressStore';
import { blueskyWords } from '@/strings';

// The Bluesky platform driver (specs/013-bluesky-platform/contracts/platform-driver.md).
// The old account is typed in as a handle and needs no sign-in. The new account signs in in the system browser.
const GENERIC = "Bluesky didn't allow this one.";
const DID = /^did:plc:[a-z2-7]{24}$/;

// The old account that was typed in: where to read its public lists. Memory only.
let oldTarget: { did: string; server: string } | null = null;

// Principle III.8: the saved `data` is JSON that this app wrote, but it is checked on read.
function parse(data: string | null): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(data ?? '');
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
const seq = (item: StoredItem) => {
  const n = parse(item.data)?.seq;
  return typeof n === 'number' ? n : 0;
};
const didOf = (item: StoredItem) => {
  const d = parse(item.data)?.did;
  return typeof d === 'string' && DID.test(d) ? d : null;
};

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
  // A list moves after the people it holds. The private kinds come last.
  moveOrder: ['person', 'block', 'list', 'mute', 'feed'],
  // Oldest first within a kind, so the new account shows them in the same order (FR-BS-010).
  itemOrder: (a, b) => seq(a) - seq(b),
  pace: {
    // ponytail: fixed numbers, tune them from real runs if Bluesky's limits change. Bluesky allows about 1,666 adds an
    // hour and 11,666 a day and has no per-minute limit, so this stays under both and leaves room for the user's posts.
    gapMs: 120, // 500 per minute
    perHour: 1500,
    perDay: 10_000,
    // One add per item, plus one per member of each list.
    adds: (items) =>
      items.reduce((n, i) => {
        const members = i.kind === 'list' ? parse(i.data)?.members : null;
        return n + 1 + (Array.isArray(members) ? members.length : 0);
      }, 0),
  },
  // Page that explains this platform's limits (spec 009, FR-BS-019). Lives in docs/limits/bluesky.md.
  limitsUrl: 'https://dodo-tech-hub.github.io/magpie/limits/bluesky',
  handleInput: true,
  // There is no sign-in to switch to: Sign out on To, and Change on From (words.changeOld).
  switchSignsOut: true,
  // The new account's session is kept after a move too, until Sign out, Delete all, or "Don't save" (FR-BS-013). So there is
  // no endMove, and Continue or a second move needs no new sign-in.
  resumesNew: true,

  async signIn(role, kinds, _onCode, _signal, handle) {
    if (!handle?.trim()) return { ok: false, reason: 'not_found' };
    const res = await signIn(role, kinds, handle);
    if (res.ok && role === 'old' && res.server) oldTarget = { did: res.account.id, server: res.server };
    return res.ok ? { ok: true, account: res.account } : res;
  },

  async signOut(role) {
    if (role !== 'new') oldTarget = null;
    await signOut(role);
    // Always false: Bluesky's access token keeps working until it runs out, even after a successful cancel, so the screen says so (FR-BS-013).
    return false;
  },

  async granted() {
    return kindsOf(await grantedScope());
  },

  async canAct(role, accountId) {
    if (role === 'old') return blueskyStores.hasSession(accountId);
    return (await blueskyStores.getNewDid()) === accountId && (await blueskyStores.hasSession(accountId));
  },

  async listOld() {
    if (!oldTarget) throw new DriverError('auth');
    const { did, server } = oldTarget;
    const reads: [string, Promise<NewItem[]>][] = [
      ['person', readFollows(did)],
      ['block', readBlocks(did, server)],
      ['list', readLists(did)],
    ];
    // After "Allow" there is a session for the private kinds. It is used for this one read, then cancelled and dropped
    // (FR-BS-020). Without it, mutes and feeds are simply not read.
    const signedIn = await oldAccountFetch(did);
    if (signedIn) reads.push(['mute', readMutes(signedIn)], ['feed', readFeeds(signedIn)]);
    try {
      const done = await Promise.allSettled(reads.map(([, p]) => p));
      const items: NewItem[] = [];
      const missing: string[] = [];
      done.forEach((r, i) => (r.status === 'fulfilled' ? items.push(...r.value) : missing.push(reads[i][0])));
      // Every read failed: show the reason instead of an empty list.
      const first = done.find((r) => r.status === 'rejected');
      if (missing.length === reads.length && first?.status === 'rejected') throw first.reason;
      return { items, missing };
    } finally {
      if (signedIn) await signOut('old');
    }
  },

  async checkNew(items, granted) {
    const did = await blueskyStores.getNewDid();
    if (!did || !(await blueskyStores.hasSession(did))) throw new DriverError('auth');
    const where = await lookup(did);
    if (!where.ok) throw new DriverError('retry');
    // Mutes and feeds are private: read them with the new account's session, and only if it was granted them.
    const privateKinds = granted.filter((k) => k === 'mute' || k === 'feed');
    const signedIn = privateKinds.length > 0 ? await newAccountFetch() : null;
    const have = await haveOnNew(did, where.server, signedIn ? { fetch: signedIn.fetch, kinds: privateKinds } : undefined);
    const mine = new Set(items.map((i) => i.itemId));
    return [...have].filter((id) => mine.has(id));
  },

  async add(item, _items, pacer): Promise<Outcome> {
    const signedIn = await newAccountFetch();
    if (!signedIn) return { kind: 'auth' };
    const { did, fetch } = signedIn;
    const subject = didOf(item);
    switch (item.kind) {
      case 'person':
        return subject ? followPerson(fetch, did, subject) : { kind: 'couldnt_move', reason: GENERIC };
      case 'block':
        return subject ? blockPerson(fetch, did, subject) : { kind: 'couldnt_move', reason: GENERIC };
      case 'list':
        return addList(fetch, did, item, pacer);
      case 'mute':
        return subject ? muteActor(fetch, subject) : { kind: 'couldnt_move', reason: GENERIC };
      case 'feed':
        return addFeed(fetch, item);
      default:
        return { kind: 'couldnt_move', reason: GENERIC };
    }
  },
};
