import { youtubeDriver } from '@/platforms/youtubeDriver';
import { nextQuotaReset } from '@/move/quotaReset';
import { ApiError, subscribe, listMySubscriptions } from '@/api/youtube';
import { DriverError } from '@/platforms/driver';
import { getAccessToken, signIn, signedInAccountId, signOut } from '@/auth/google';
import { youtubeWords } from '@/strings';
import type { StoredItem } from '@/store/progressStore';

jest.mock('@/api/youtube', () => ({
  ...jest.requireActual('@/api/youtube'),
  subscribe: jest.fn(),
  listMySubscriptions: jest.fn(),
}));
jest.mock('@/auth/google', () => ({
  getAccessToken: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  signedInAccountId: jest.fn(),
}));

const sub = subscribe as jest.Mock;
const list = listMySubscriptions as jest.Mock;
const token = getAccessToken as jest.Mock;

const item: StoredItem = {
  itemId: 'UC1',
  kind: 'channel',
  title: 'One',
  thumbnailUrl: null,
  data: null,
  picked: true,
  status: 'waiting',
  reason: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  token.mockImplementation(async (stale?: string) => (stale ? 'fresh' : 'tok1'));
});

describe('add', () => {
  it.each([['moved'], ['retry']])('passes %s through', async (kind) => {
    sub.mockResolvedValue({ kind });
    expect(await youtubeDriver.add(item, [item])).toEqual({ kind });
  });

  it('maps couldnt_move to an empty reason', async () => {
    sub.mockResolvedValue({ kind: 'couldnt_move' });
    expect(await youtubeDriver.add(item, [item])).toEqual({ kind: 'couldnt_move', reason: '' });
  });

  it('refreshes the token once after a 401 and tries again', async () => {
    sub.mockResolvedValueOnce({ kind: 'auth' }).mockResolvedValueOnce({ kind: 'moved' });
    expect(await youtubeDriver.add(item, [item])).toEqual({ kind: 'moved' });
    expect(token).toHaveBeenLastCalledWith('tok1');
    expect(sub.mock.calls[1][0]).toBe('fresh');
  });

  it('answers auth when the 401 repeats', async () => {
    sub.mockResolvedValue({ kind: 'auth' });
    expect(await youtubeDriver.add(item, [item])).toEqual({ kind: 'auth' });
    expect(sub).toHaveBeenCalledTimes(2);
  });

  it('turns the daily limit into later at the next quota reset', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-15T12:00:00Z'));
    sub.mockResolvedValue({ kind: 'tomorrow' });
    expect(await youtubeDriver.add(item, [item])).toEqual({
      kind: 'later',
      resumeAt: nextQuotaReset(new Date()).getTime(),
    });
    jest.useRealTimers();
  });
});

describe('reading and signing in', () => {
  it('lists the old account as channels with no data', async () => {
    list.mockResolvedValue([{ channelId: 'UC1', title: 'One', thumbnailUrl: 'u' }]);
    expect(await youtubeDriver.listOld()).toEqual({
      items: [{ itemId: 'UC1', kind: 'channel', title: 'One', thumbnailUrl: 'u', data: null }],
      missing: [],
    });
  });

  it('turns a failed read into a driver error', async () => {
    list.mockRejectedValue(new ApiError('retry'));
    await expect(youtubeDriver.listOld()).rejects.toEqual(new DriverError('retry'));
    list.mockRejectedValue(new ApiError('tomorrow'));
    await expect(youtubeDriver.listOld()).rejects.toEqual(new DriverError('later'));
  });

  it('checks the new account by the channels it follows', async () => {
    list.mockResolvedValue([{ channelId: 'UC1', title: 'One', thumbnailUrl: null }]);
    expect(await youtubeDriver.checkNew([item], ['channel'])).toEqual(['UC1']);
  });

  it('signs in with the email as the handle', async () => {
    (signIn as jest.Mock).mockResolvedValue({
      ok: true,
      account: { id: 'g1', email: 'a@b.com', name: 'A', photoUrl: null },
    });
    expect(await youtubeDriver.signIn('old', [], jest.fn())).toEqual({
      ok: true,
      account: { id: 'g1', handle: 'a@b.com', name: 'A', photoUrl: null },
    });
  });

  it('passes a failed sign-in through', async () => {
    (signIn as jest.Mock).mockResolvedValue({ ok: false, reason: 'cancelled' });
    expect(await youtubeDriver.signIn('new', [], jest.fn())).toEqual({ ok: false, reason: 'cancelled' });
  });

  it('can act only as the signed-in Google account', async () => {
    (signedInAccountId as jest.Mock).mockReturnValue('g1');
    expect(await youtubeDriver.canAct('new', 'g1')).toBe(true);
    expect(await youtubeDriver.canAct('new', 'g2')).toBe(false);
  });

  it('signs out through Google', async () => {
    await youtubeDriver.signOut();
    expect(signOut).toHaveBeenCalled();
  });
});

describe('shape', () => {
  it('has one kind with no heading, full access, and today\'s words', async () => {
    expect(youtubeDriver.kinds).toEqual([{ id: 'channel', heading: '' }]);
    expect(await youtubeDriver.granted()).toEqual(['channel']);
    expect(youtubeDriver.words).toBe(youtubeWords);
    expect(youtubeWords.later).toBe('Tomorrow');
    expect(youtubeWords.signIn).toBe('Sign in with Google');
    expect(youtubeDriver.pace).toBeUndefined();
    expect(youtubeDriver.removeAccessUrl).toBeUndefined();
  });
});
