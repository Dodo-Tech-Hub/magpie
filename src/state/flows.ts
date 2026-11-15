import type { Dispatch } from 'react';
import { DriverError, type Driver } from '@/platforms/driver';
import { driverFor, PLATFORMS, type PlatformId } from '@/platforms/platforms';
import { recoverInterrupted, runMove } from '@/move/mover';
import { askOnce, cancelReminder, scheduleReminder } from '@/reminders/reminder';
import {
  findProgressForPair,
  getItems,
  getOrCreateProgress,
  getProgress,
  markAlreadyThere,
  releaseLater,
  saveItems,
  setPicked,
  type StoredItem,
} from '@/store/progressStore';
import { signInTo, strings, wrongAccount } from '@/strings';
import type { Action, State } from '@/state/AppState';

type D = Dispatch<Action>;

export const isMovable = (c: StoredItem) =>
  c.picked && (c.status === 'waiting' || c.status === 'later');

const driverOf = (state: State): Driver => driverFor(state.platform!);
const pickOrder = (driver: Driver) => driver.kinds.map((k) => k.id);

function noticeFor(e: unknown, driver: Driver): string {
  if (e instanceof DriverError) {
    if (e.kind === 'retry') return strings.offline;
    if (e.kind === 'later') return driver.words.limitReached;
  }
  return strings.signInFailed;
}

async function reload(progressId: string, driver: Driver, dispatch: D) {
  dispatch({ type: 'setItems', items: await getItems(progressId, pickOrder(driver)) });
}

// Old account: read-only. Its list is loaded once and kept (research R2).
export async function signInOld(state: State, dispatch: D): Promise<void> {
  const driver = driverOf(state);
  dispatch({ type: 'setNotice', notice: null });
  const res = await driver.signIn('old', [], () => undefined);
  if (!res.ok) {
    if (res.reason === 'failed') dispatch({ type: 'setNotice', notice: strings.signInFailed });
    return;
  }
  if (state.newAccount && res.account.id === state.newAccount.id) {
    await driver.signOut('old');
    dispatch({ type: 'setNotice', notice: strings.sameAsNew });
    return;
  }
  try {
    const { items } = await driver.listOld();
    const stored: StoredItem[] = items.map((c) => ({ ...c, picked: true, status: 'waiting', reason: null }));
    dispatch({ type: 'setOld', account: res.account, items: stored });
    // A platform may hold only one account at a time. Then the new account signs in again.
    if (state.newAccount && !(await driver.canAct('new', state.newAccount.id))) {
      dispatch({ type: 'setNew', account: null });
    }
    dispatch({ type: 'setStep', step: 'pick' });
  } catch (e) {
    dispatch({ type: 'setNotice', notice: noticeFor(e, driver) });
  }
}

// New account: needs add access. Creates or opens the progress for the pair.
export async function signInNew(state: State, dispatch: D): Promise<void> {
  const driver = driverOf(state);
  dispatch({ type: 'setNotice', notice: null });
  const res = await driver.signIn('new', [], () => undefined);
  if (!res.ok) {
    if (res.reason === 'failed') dispatch({ type: 'setNotice', notice: strings.signInFailed });
    return;
  }
  if (state.expectedNew && res.account.id !== state.expectedNew.id) {
    await driver.signOut('new');
    dispatch({ type: 'setNotice', notice: wrongAccount(state.expectedNew.handle) });
    return;
  }
  const old = state.oldAccount;
  if (old && res.account.id === old.id) {
    await driver.signOut('new');
    dispatch({ type: 'setNotice', notice: strings.sameAsOld });
    return;
  }
  dispatch({ type: 'setNew', account: res.account });
  dispatch({ type: 'setExpectedNew', account: null });
  if (!old) return;
  try {
    const existed = (await findProgressForPair(driver.id, old.id, res.account.id)) !== null;
    const progressId = await getOrCreateProgress(driver.id, old, res.account);
    await saveItems(progressId, state.items);
    if (!existed) {
      const unpicked = state.items.filter((c) => !c.picked).map((c) => c.itemId);
      await setPicked(progressId, unpicked, false);
    }
    await markAlreadyThere(progressId, await checkNew(progressId, driver, state.items));
    dispatch({ type: 'setProgress', progressId, items: await getItems(progressId, pickOrder(driver)) });
    dispatch({ type: 'setStep', step: 'pick' });
  } catch (e) {
    dispatch({ type: 'setNotice', notice: noticeFor(e, driver) });
  }
}

// "Already there": items the new account has already (research R6, R7).
async function checkNew(progressId: string, driver: Driver, items: StoredItem[]): Promise<string[]> {
  const have = await driver.checkNew(items, await driver.granted());
  await recoverInterrupted(progressId, new Set(have));
  return have;
}

export async function togglePick(state: State, dispatch: D, ids: string[], picked: boolean) {
  const movable = new Set(state.items.filter((c) => c.status !== 'already_there').map((c) => c.itemId));
  const target = ids.filter((id) => movable.has(id));
  if (state.progressId) {
    await setPicked(state.progressId, target, picked);
    await reload(state.progressId, driverOf(state), dispatch);
  } else {
    const set = new Set(target);
    dispatch({
      type: 'setItems',
      items: state.items.map((c) => (set.has(c.itemId) ? { ...c, picked } : c)),
    });
  }
}

export async function startMove(state: State, dispatch: D): Promise<void> {
  const driver = driverOf(state);
  const { progressId, newAccount } = state;
  dispatch({ type: 'setNotice', notice: null });
  if (!newAccount || !progressId) {
    dispatch({ type: 'setNotice', notice: strings.needNewAccount });
    return;
  }
  const movable = state.items.filter(isMovable).length;
  if (movable === 0) {
    if (state.items.some((c) => c.status === 'already_there')) {
      dispatch({ type: 'setMoveState', moveState: 'done' });
    } else {
      dispatch({ type: 'setNotice', notice: driver.words.needPick });
    }
    return;
  }
  // A platform may hold one account. If it is not the new one, moving would use the wrong login.
  if (!(await driver.canAct('new', newAccount.id))) {
    dispatch({ type: 'setNew', account: null });
    dispatch({ type: 'setNotice', notice: strings.needNewAccount });
    return;
  }
  dispatch({ type: 'setMoveState', moveState: 'moving' });
  await releaseLater(progressId);
  let stopNotice: string | null = null;
  const result = await runMove(progressId, {
    add: (item, all, pacer) => driver.add(item, all, pacer),
    kindOrder: driver.moveOrder ?? pickOrder(driver),
    onUpdate: () => void reload(progressId, driver, dispatch),
    onStop: (notice) => (stopNotice = notice),
  });
  await reload(progressId, driver, dispatch);
  if (result === 'auth') {
    dispatch({ type: 'setNew', account: null });
    dispatch({ type: 'setNotice', notice: strings.signInAgain });
  }
  if (result === 'offline') dispatch({ type: 'setNotice', notice: strings.offline });
  if (result === 'stopped') dispatch({ type: 'setNotice', notice: stopNotice });
  if (result === 'limit') {
    if (await askOnce()) {
      const resumeAt = (await getProgress(progressId))?.resumeAt ?? Date.now() + 3_600_000;
      await scheduleReminder(progressId, new Date(resumeAt), driver.words.reminderBody);
    }
  } else if (result === 'done') {
    await cancelReminder(progressId);
  }
  dispatch({ type: 'setMoveState', moveState: result === 'done' ? 'done' : result });
}

// Open a saved progress. The old account and its items come from the phone.
// The new account must sign in again if it is signed out (FR-033).
export async function openProgress(dispatch: D, progressId: string): Promise<void> {
  const saved = await getProgress(progressId);
  const platform = PLATFORMS.find((p) => p.id === saved?.platform);
  if (!saved || !platform) return;
  const items = await getItems(progressId, pickOrder(platform.driver));
  // A reminder or the Continue note opens the flow from Home or Settings (FR-009).
  dispatch({ type: 'openPlatform', platform: platform.id as PlatformId });
  dispatch({ type: 'setOld', account: saved.oldAccount, items });
  dispatch({ type: 'setProgress', progressId, items });
  dispatch({ type: 'setNew', account: null });
  dispatch({ type: 'setExpectedNew', account: saved.newAccount });
  dispatch({ type: 'setStep', step: 'to' });
  dispatch({ type: 'setNotice', notice: signInTo(saved.newAccount.handle) });
}
