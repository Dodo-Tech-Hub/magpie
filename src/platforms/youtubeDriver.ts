import { ApiError, listMySubscriptions, subscribe } from '@/api/youtube';
import { getAccessToken, signedInAccountId, signIn, signOut } from '@/auth/google';
import { nextQuotaReset } from '@/move/quotaReset';
import { DriverError, type Driver, type Outcome } from '@/platforms/driver';
import { youtubeWords } from '@/strings';

// Wraps today's Google sign-in and YouTube calls. No behavior change (spec 008, Part A).
async function add(channelId: string): Promise<Outcome> {
  let token = await getAccessToken();
  let outcome = await subscribe(token, channelId);
  if (outcome.kind === 'auth') {
    // One fresh token, then one more try. A second 401 is the user's to fix.
    token = await getAccessToken(token);
    outcome = await subscribe(token, channelId);
  }
  switch (outcome.kind) {
    case 'tomorrow':
      return { kind: 'later', resumeAt: nextQuotaReset(new Date()).getTime() };
    case 'couldnt_move':
      return { kind: 'couldnt_move', reason: '' };
    default:
      return { kind: outcome.kind };
  }
}

async function readAll() {
  try {
    return await listMySubscriptions(await getAccessToken());
  } catch (e) {
    if (e instanceof ApiError) {
      throw new DriverError(e.kind === 'retry' ? 'retry' : e.kind === 'tomorrow' ? 'later' : 'auth');
    }
    throw e;
  }
}

export const youtubeDriver: Driver = {
  id: 'youtube',
  words: youtubeWords,
  kinds: [{ id: 'channel', heading: '' }],

  async signIn(role) {
    const res = await signIn(role);
    if (!res.ok) return res;
    const { id, email, name, photoUrl } = res.account;
    return { ok: true, account: { id, handle: email, name, photoUrl } };
  },
  signOut: () => signOut(),
  granted: async () => ['channel'],
  canAct: async (_role, accountId) => signedInAccountId() === accountId,
  async listOld() {
    const list = await readAll();
    return {
      items: list.map((c) => ({
        itemId: c.channelId,
        kind: 'channel',
        title: c.title,
        thumbnailUrl: c.thumbnailUrl,
        data: null,
      })),
      missing: [],
    };
  },
  async checkNew() {
    return (await readAll()).map((c) => c.channelId);
  },
  add: (item) => add(item.itemId),
};
