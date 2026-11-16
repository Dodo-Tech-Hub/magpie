import type { Dispatch } from 'react';
import { Alert, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { DriverError, type Driver, type Role, type SignInResult } from '@/platforms/driver';
import { driverFor, PLATFORMS, type PlatformId } from '@/platforms/platforms';
import { recoverInterrupted, runMove } from '@/move/mover';
import { createPacer } from '@/move/pacer';
import { askOnce, cancelReminder, scheduleReminder } from '@/reminders/reminder';
import {
  attachNew,
  deleteProgress,
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
import { dontSave, signInCodeHint, signInTo, strings, wrongAccount } from '@/strings';
import type { Action, State } from '@/state/AppState';

type D = Dispatch<Action>;

export const isMovable = (c: StoredItem) =>
  c.picked && (c.status === 'waiting' || c.status === 'later');

// A kind the new account has no access for is not moved and not counted (FR-GH-020).
// Before the new account signs in, nothing is known, so nothing is held back.
export const hasAccess = (state: State, c: StoredItem) =>
  !state.newAccount || state.granted.includes(c.kind);

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

// The move that is running, so "Don't save" can stop it and a second Move cannot start beside it.
let running: { progressId: string; abort: AbortController; done: Promise<unknown> } | null = null;

// The sign-in that is waiting for the user, so Cancel can stop it.
let waiting: AbortController | null = null;
export const cancelSignIn = () => waiting?.abort();

// One sign-in. A code (device sign-in) shows in place, is copied, and opens the browser.
async function signInAs(state: State, dispatch: D, role: Role, kinds: string[]): Promise<SignInResult> {
  const driver = driverOf(state);
  const ctl = new AbortController();
  waiting = ctl;
  const other = role === 'old' ? state.newAccount : state.oldAccount;
  try {
    return await driver.signIn(
      role,
      kinds,
      (c) => {
        dispatch({
          type: 'setSignInCode',
          code: c ? { role, code: c.code, hint: other ? signInCodeHint(role) : null } : null,
        });
        if (c) {
          void Clipboard.setStringAsync(c.code);
          void Linking.openURL(c.url);
        }
      },
      ctl.signal,
    );
  } finally {
    if (waiting === ctl) waiting = null;
  }
}

// The kinds the new account is asked for: the picked ones, never an optional one (FR-GH-020).
function kindsToAsk(state: State, driver: Driver): string[] {
  const optional = new Set(driver.kinds.filter((k) => k.optional).map((k) => k.id));
  const picked = new Set(state.items.filter((c) => c.picked).map((c) => c.kind));
  const all = driver.kinds.map((k) => k.id);
  return (state.items.length ? all.filter((k) => picked.has(k)) : all).filter((k) => !optional.has(k));
}

// Old account: read-only. Its list is loaded once and kept (research R2).
export async function signInOld(state: State, dispatch: D): Promise<void> {
  const driver = driverOf(state);
  dispatch({ type: 'setNotice', notice: null });
  const res = await signInAs(state, dispatch, 'old', []);
  if (!res.ok) {
    if (res.reason === 'failed') dispatch({ type: 'setNotice', notice: strings.signInFailed });
    return;
  }
  if (state.newAccount && res.account.id === state.newAccount.id) {
    await driver.signOut('old');
    dispatch({ type: 'setNotice', notice: strings.sameAsNew });
    return;
  }
  dispatch({ type: 'setLoading', loading: true });
  try {
    const { items, missing } = await driver.listOld();
    const stored: StoredItem[] = items.map((c) => ({ ...c, picked: true, status: 'waiting', reason: null }));
    // A platform may hold only one account at a time. Then the new account signs in again.
    const keepNew = state.newAccount && (await driver.canAct('new', state.newAccount.id)) ? state.newAccount : null;
    // The progress starts here, with or without a new account (FR-GH-021). Old picks stay, new items are picked.
    const progressId = await getOrCreateProgress(driver.id, res.account, keepNew);
    await saveItems(progressId, stored);
    dispatch({ type: 'setOld', account: res.account, items: stored });
    if (state.newAccount && !keepNew) dispatch({ type: 'setNew', account: null });
    if (keepNew) await openPair(driver, dispatch, progressId);
    else dispatch({ type: 'setProgress', progressId, items: await getItems(progressId, pickOrder(driver)) });
    dispatch({ type: 'setStep', step: 'pick' });
    if (missing.length > 0) dispatch({ type: 'setNotice', notice: strings.loadPartial });
  } catch (e) {
    dispatch({ type: 'setNotice', notice: noticeFor(e, driver) });
  } finally {
    dispatch({ type: 'setLoading', loading: false });
  }
}

// New account: needs add access. Creates or opens the progress for the pair.
export async function signInNew(state: State, dispatch: D): Promise<void> {
  const driver = driverOf(state);
  dispatch({ type: 'setNotice', notice: null });
  const res = await signInAs(state, dispatch, 'new', kindsToAsk(state, driver));
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
  const granted = await driver.granted();
  dispatch({ type: 'setNew', account: res.account });
  dispatch({ type: 'setGranted', kinds: granted });
  dispatch({ type: 'setExpectedNew', account: null });
  if (!old) return;
  try {
    const existed = (await findProgressForPair(driver.id, old.id, res.account.id)) !== null;
    // The open progress gets its new account. If this pair already has a progress, that one opens instead (FR-GH-021).
    const open = state.progressId ? await getProgress(state.progressId) : null;
    const progressId =
      open && open.newAccount === null
        ? await attachNew(open.id, res.account)
        : await getOrCreateProgress(driver.id, old, res.account);
    await saveItems(progressId, state.items);
    if (!existed) {
      const unpicked = state.items.filter((c) => !c.picked).map((c) => c.itemId);
      await setPicked(progressId, unpicked, false);
    }
    await openPair(driver, dispatch, progressId);
    dispatch({ type: 'setStep', step: 'pick' });
  } catch (e) {
    dispatch({ type: 'setNotice', notice: noticeFor(e, driver) });
  }
}

// Both accounts are known: hold back kinds without access and mark what the new account already has.
async function openPair(driver: Driver, dispatch: D, progressId: string) {
  // A kind without access is not picked, so it is never moved and never counted (FR-GH-020).
  const granted = await driver.granted();
  const items = await getItems(progressId, pickOrder(driver));
  await setPicked(progressId, items.filter((c) => !granted.includes(c.kind)).map((c) => c.itemId), false);
  await markAlreadyThere(progressId, await checkNew(progressId, driver, items));
  dispatch({ type: 'setProgress', progressId, items: await getItems(progressId, pickOrder(driver)) });
}

// "Already there": items the new account has already (research R6, R7).
async function checkNew(progressId: string, driver: Driver, items: StoredItem[]): Promise<string[]> {
  const have = await driver.checkNew(items, await driver.granted());
  await recoverInterrupted(progressId, new Set(have));
  return have;
}

// A move ended with nothing left: the platform drops what it holds for the new account.
async function endMove(driver: Driver, dispatch: D) {
  if (!driver.endMove) return;
  await driver.endMove();
  dispatch({ type: 'setAccessEnded', ended: true });
}

// The Switch button. A platform whose sign-in cannot be switched in place signs out instead (US4).
export async function switchAccount(state: State, dispatch: D, role: Role): Promise<void> {
  const driver = driverOf(state);
  if (!driver.switchSignsOut) {
    await (role === 'old' ? signInOld(state, dispatch) : signInNew(state, dispatch));
    return;
  }
  await driver.signOut(role);
  if (role === 'new') {
    dispatch({ type: 'setNew', account: null });
    dispatch({ type: 'setGranted', kinds: [] });
    dispatch({ type: 'setAccessEnded', ended: true });
  } else {
    dispatch({ type: 'setOld', account: null, items: [] });
  }
}

// "Allow" on a kind the new account has no access for: sign in again, asking for what it had plus this kind (FR-GH-020).
export async function allowKind(state: State, dispatch: D, kind: string): Promise<void> {
  const driver = driverOf(state);
  const { progressId, newAccount } = state;
  if (!newAccount || !progressId) return;
  dispatch({ type: 'setNotice', notice: null });
  const res = await signInAs(state, dispatch, 'new', [...state.granted, kind]);
  if (!res.ok) {
    if (res.reason === 'failed') dispatch({ type: 'setNotice', notice: strings.signInFailed });
    return;
  }
  // The driver kept the old token for a different account, so there is nothing to undo.
  if (res.account.id !== newAccount.id) {
    dispatch({ type: 'setNotice', notice: strings.allowOtherAccount });
    return;
  }
  const granted = await driver.granted();
  dispatch({ type: 'setGranted', kinds: granted });
  try {
    const items = await getItems(progressId, pickOrder(driver));
    await markAlreadyThere(progressId, await checkNew(progressId, driver, items));
    // Rows of a kind that now has access become pickable, all picked.
    const fresh = await getItems(progressId, pickOrder(driver));
    await setPicked(progressId, fresh.filter((c) => c.kind === kind && granted.includes(kind)).map((c) => c.itemId), true);
    await reload(progressId, driver, dispatch);
  } catch (e) {
    dispatch({ type: 'setNotice', notice: noticeFor(e, driver) });
  }
}

export async function togglePick(state: State, dispatch: D, ids: string[], picked: boolean) {
  const movable = new Set(
    state.items.filter((c) => c.status !== 'already_there' && hasAccess(state, c)).map((c) => c.itemId),
  );
  const target = ids.filter((id) => movable.has(id));
  // Picks are always saved, from the old sign-in on (FR-GH-021).
  if (!state.progressId) return;
  await setPicked(state.progressId, target, picked);
  await reload(state.progressId, driverOf(state), dispatch);
}

export async function startMove(state: State, dispatch: D): Promise<void> {
  const driver = driverOf(state);
  const { progressId, newAccount } = state;
  dispatch({ type: 'setNotice', notice: null });
  if (!newAccount || !progressId) {
    dispatch({ type: 'setNotice', notice: strings.needNewAccount });
    return;
  }
  const movable = state.items.filter((c) => isMovable(c) && hasAccess(state, c)).length;
  if (movable === 0) {
    if (state.items.some((c) => c.status === 'already_there')) {
      await endMove(driver, dispatch);
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
  // A move goes on when the user leaves the flow (Save in FR-GH-022). It reports only while its progress is open.
  if (running?.progressId === progressId) return;
  const d: D = (action) => dispatch({ type: 'forProgress', progressId, action });
  const ctl = new AbortController();
  d({ type: 'setMoveState', moveState: 'moving' });
  await releaseLater(progressId);
  let stopNotice: string | null = null;
  const done = runMove(progressId, {
    add: (item, all, pacer) => driver.add(item, all, pacer),
    pacer: driver.pace ? createPacer(`${driver.id}:${newAccount.id}`) : undefined,
    kindOrder: driver.moveOrder ?? pickOrder(driver),
    onUpdate: () => void reload(progressId, driver, d),
    onStop: (notice) => (stopNotice = notice),
    signal: ctl.signal,
  });
  running = { progressId, abort: ctl, done };
  let result: Awaited<typeof done>;
  try {
    result = await done;
  } finally {
    running = null;
  }
  if (ctl.signal.aborted) return;
  await reload(progressId, driver, d);
  if (result === 'auth') {
    d({ type: 'setNew', account: null });
    d({ type: 'setNotice', notice: strings.signInAgain });
  }
  if (result === 'offline') d({ type: 'setNotice', notice: strings.offline });
  if (result === 'stopped') d({ type: 'setNotice', notice: stopNotice });
  if (result === 'limit') {
    if (await askOnce(driver.words.limitReached)) {
      const resumeAt = (await getProgress(progressId))?.resumeAt ?? Date.now() + 3_600_000;
      await scheduleReminder(progressId, new Date(resumeAt), driver.words.reminderBody);
    }
  } else if (result === 'done') {
    await cancelReminder(progressId);
    await endMove(driver, d);
  }
  d({ type: 'setMoveState', moveState: result === 'done' ? 'done' : result });
}

// Open a saved progress. The old account and its items come from the phone.
// The new account must sign in again if it is signed out (FR-033).
export async function openProgress(dispatch: D, progressId: string): Promise<void> {
  const saved = await getProgress(progressId);
  const platform = PLATFORMS.find((p) => p.id === saved?.platform);
  if (!saved || !platform) return;
  const items = await getItems(progressId, pickOrder(platform.driver));
  // A reminder or the Continue note opens the flow from Home or Settings (FR-009).
  dispatch({ type: 'startFlow', platform: platform.id as PlatformId });
  dispatch({ type: 'setOld', account: saved.oldAccount, items });
  dispatch({ type: 'setProgress', progressId, items });
  // A move kept running by Save is still moving (FR-GH-022).
  if (running?.progressId === progressId) dispatch({ type: 'setMoveState', moveState: 'moving' });
  const driver = platform.driver;
  // No new account yet: the user picks and signs in to the new account when ready (FR-GH-021).
  if (!saved.newAccount) {
    dispatch({ type: 'setNew', account: null });
    dispatch({ type: 'setExpectedNew', account: null });
    dispatch({ type: 'setStep', step: 'pick' });
    return;
  }
  // A paused move keeps its sign-in on the phone (FR-GH-019), so it can go on at once.
  if (driver.resumesNew && (await driver.canAct('new', saved.newAccount.id))) {
    const granted = await driver.granted();
    dispatch({ type: 'setNew', account: saved.newAccount });
    dispatch({ type: 'setGranted', kinds: granted });
    dispatch({ type: 'setExpectedNew', account: null });
    dispatch({ type: 'setStep', step: 'pick' });
    return;
  }
  dispatch({ type: 'setNew', account: null });
  dispatch({ type: 'setExpectedNew', account: saved.newAccount });
  dispatch({ type: 'setStep', step: 'to' });
  dispatch({ type: 'setNotice', notice: signInTo(saved.newAccount.handle) });
}

const askToSave = (name: string) =>
  new Promise<'save' | 'discard' | 'cancel'>((resolve) =>
    Alert.alert(
      strings.saveProgressTitle(name),
      undefined,
      [
        { text: strings.save, onPress: () => resolve('save') },
        { text: dontSave, style: 'destructive', onPress: () => resolve('discard') },
        { text: strings.cancel, style: 'cancel', onPress: () => resolve('cancel') },
      ],
      { cancelable: true, onDismiss: () => resolve('cancel') },
    ),
  );

// Call before opening a platform's flow from Home. The same platform resumes where the user left. Another
// platform starts fresh, after asking whether to save an unfinished progress (FR-GH-022).
// Returns false when the user cancels.
export async function leaveFlowFor(state: State, dispatch: D, platform: PlatformId): Promise<boolean> {
  const from = state.flowPlatform;
  if (!from || from === platform) return true;
  const left = state.progressId ? ((await getProgress(state.progressId))?.left ?? 0) : 0;
  if (left > 0) {
    const name = PLATFORMS.find((p) => p.id === from)?.name ?? '';
    const choice = await askToSave(name);
    if (choice === 'cancel') return false;
    if (choice === 'discard') await discardFlow(state, from);
  }
  dispatch({ type: 'startFlow', platform });
  return true;
}

// "Don't save": stop the move, delete the progress and the platform's sign-ins. Moved items stay moved.
async function discardFlow(state: State, platform: PlatformId) {
  const progressId = state.progressId!;
  if (running?.progressId === progressId) {
    running.abort.abort();
    await running.done.catch(() => undefined);
  }
  await cancelReminder(progressId);
  await deleteProgress(progressId);
  const driver = driverFor(platform);
  await driver.signOut('old');
  await driver.signOut('new');
}

// Opens a platform's limits page in the system browser. false = it could not open; the screen says so (research R3, R6).
// No canOpenURL: on Android 11+ it answers false unless the app lists the links it asks about.
export async function openLimits(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
