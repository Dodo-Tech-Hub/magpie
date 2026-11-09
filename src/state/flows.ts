import type { Dispatch } from 'react';
import { ApiError, listMySubscriptions } from '@/api/youtube';
import { getAccessToken, signedInAccountId, signIn, signOut } from '@/auth/google';
import { recoverInterrupted, runMove } from '@/move/mover';
import { nextQuotaReset } from '@/move/quotaReset';
import { askOnce, cancelReminder, scheduleReminder } from '@/reminders/reminder';
import {
  findProgressForPair,
  getChannels,
  getOrCreateProgress,
  getProgress,
  markAlreadyThere,
  releaseTomorrow,
  saveChannels,
  setPicked,
  type StoredChannel,
} from '@/store/progressStore';
import { signInTo, strings, wrongAccount } from '@/strings';
import type { Action, State } from '@/state/AppState';

type D = Dispatch<Action>;

export const isMovable = (c: StoredChannel) =>
  c.picked && (c.status === 'waiting' || c.status === 'tomorrow');

function noticeFor(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.kind === 'retry') return strings.offline;
    if (e.kind === 'tomorrow') return strings.limitReached;
  }
  return strings.signInFailed;
}

async function reload(progressId: string, dispatch: D) {
  dispatch({ type: 'setChannels', channels: await getChannels(progressId) });
}

// Old account: read-only. Its list is loaded once and kept (research R2).
export async function signInOld(state: State, dispatch: D): Promise<void> {
  dispatch({ type: 'setNotice', notice: null });
  const res = await signIn('old');
  if (!res.ok) {
    if (res.reason === 'failed') dispatch({ type: 'setNotice', notice: strings.signInFailed });
    return;
  }
  if (state.newAccount && res.account.id === state.newAccount.id) {
    await signOut();
    dispatch({ type: 'setNotice', notice: strings.sameAsNew });
    return;
  }
  try {
    const list = await listMySubscriptions(await getAccessToken());
    const channels: StoredChannel[] = list.map((c) => ({ ...c, picked: true, status: 'waiting' }));
    dispatch({ type: 'setOld', account: res.account, channels });
    // The SDK now holds the old account, so the new account must sign in again before moving.
    dispatch({ type: 'setNew', account: null });
    dispatch({ type: 'setStep', step: 'pick' });
  } catch (e) {
    dispatch({ type: 'setNotice', notice: noticeFor(e) });
  }
}

// New account: needs subscribe access. Creates or opens the progress for the pair.
export async function signInNew(state: State, dispatch: D): Promise<void> {
  dispatch({ type: 'setNotice', notice: null });
  const res = await signIn('new');
  if (!res.ok) {
    if (res.reason === 'failed') dispatch({ type: 'setNotice', notice: strings.signInFailed });
    return;
  }
  if (state.expectedNew && res.account.id !== state.expectedNew.id) {
    await signOut();
    dispatch({ type: 'setNotice', notice: wrongAccount(state.expectedNew.email) });
    return;
  }
  const old = state.oldAccount;
  if (old && res.account.id === old.id) {
    await signOut();
    dispatch({ type: 'setNotice', notice: strings.sameAsOld });
    return;
  }
  dispatch({ type: 'setNew', account: res.account });
  dispatch({ type: 'setExpectedNew', account: null });
  if (!old) return;
  try {
    const existed = (await findProgressForPair(old.id, res.account.id)) !== null;
    const progressId = await getOrCreateProgress(old, res.account);
    await saveChannels(progressId, state.channels);
    if (!existed) {
      const unpicked = state.channels.filter((c) => !c.picked).map((c) => c.channelId);
      await setPicked(progressId, unpicked, false);
    }
    await markFollowed(progressId);
    dispatch({ type: 'setProgress', progressId, channels: await getChannels(progressId) });
    dispatch({ type: 'setStep', step: 'pick' });
  } catch (e) {
    dispatch({ type: 'setNotice', notice: noticeFor(e) });
  }
}

// "Already there": channels the new account follows already (research R6).
async function markFollowed(progressId: string) {
  const followed = new Set((await listMySubscriptions(await getAccessToken())).map((c) => c.channelId));
  await recoverInterrupted(progressId, followed);
  await markAlreadyThere(progressId, [...followed]);
}

export async function togglePick(state: State, dispatch: D, ids: string[], picked: boolean) {
  const movable = new Set(
    state.channels.filter((c) => c.status !== 'already_there').map((c) => c.channelId),
  );
  const target = ids.filter((id) => movable.has(id));
  if (state.progressId) {
    await setPicked(state.progressId, target, picked);
    await reload(state.progressId, dispatch);
  } else {
    const set = new Set(target);
    dispatch({
      type: 'setChannels',
      channels: state.channels.map((c) => (set.has(c.channelId) ? { ...c, picked } : c)),
    });
  }
}

export async function startMove(state: State, dispatch: D): Promise<void> {
  const { progressId, newAccount } = state;
  dispatch({ type: 'setNotice', notice: null });
  if (!newAccount || !progressId) {
    dispatch({ type: 'setNotice', notice: strings.needNewAccount });
    return;
  }
  const movable = state.channels.filter(isMovable).length;
  if (movable === 0) {
    if (state.channels.some((c) => c.status === 'already_there')) {
      dispatch({ type: 'setMoveState', moveState: 'done' });
    } else {
      dispatch({ type: 'setNotice', notice: strings.needPick });
    }
    return;
  }
  // The SDK holds one account. If it is not the new one, moving would use the wrong login.
  if (signedInAccountId() !== newAccount.id) {
    dispatch({ type: 'setNew', account: null });
    dispatch({ type: 'setNotice', notice: strings.needNewAccount });
    return;
  }
  dispatch({ type: 'setMoveState', moveState: 'moving' });
  await releaseTomorrow(progressId);
  const result = await runMove(progressId, {
    getToken: getAccessToken,
    onUpdate: () => void reload(progressId, dispatch),
  });
  await reload(progressId, dispatch);
  if (result === 'auth') {
    dispatch({ type: 'setNew', account: null });
    dispatch({ type: 'setNotice', notice: strings.signInAgain });
  }
  if (result === 'offline') dispatch({ type: 'setNotice', notice: strings.offline });
  if (result === 'limit') {
    if (await askOnce()) await scheduleReminder(progressId, nextQuotaReset(new Date()));
  } else if (result === 'done') {
    await cancelReminder(progressId);
  }
  dispatch({
    type: 'setMoveState',
    moveState: result === 'done' ? 'done' : result === 'limit' ? 'limit' : result,
  });
}

// Open a saved progress. The old account and its channels come from the phone.
// The new account must sign in again if it is signed out (FR-033).
export async function openProgress(dispatch: D, progressId: string): Promise<void> {
  const saved = await getProgress(progressId);
  if (!saved) return;
  const channels = await getChannels(progressId);
  dispatch({ type: 'setOld', account: saved.oldAccount, channels });
  dispatch({ type: 'setProgress', progressId, channels });
  dispatch({ type: 'setNew', account: null });
  dispatch({ type: 'setExpectedNew', account: saved.newAccount });
  dispatch({ type: 'setStep', step: 'to' });
  dispatch({ type: 'setNotice', notice: signInTo(saved.newAccount.email) });
}
