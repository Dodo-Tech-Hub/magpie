import React, { createContext, useContext, useMemo, useReducer } from 'react';
import type { PlatformId } from '@/platforms/platforms';
import type { AccountInfo, StoredItem } from '@/store/progressStore';

export type Step = 'from' | 'pick' | 'to';
export type MoveState = 'idle' | 'moving' | 'limit' | 'done' | 'offline' | 'auth' | 'stopped';

export type State = {
  // null shows Home. A platform id shows that platform's flow.
  platform: PlatformId | null;
  // The platform the flow fields below belong to. Stays while Home shows, so the same card resumes it (FR-GH-022).
  flowPlatform: PlatformId | null;
  step: Step;
  settingsOpen: boolean;
  oldAccount: AccountInfo | null;
  newAccount: AccountInfo | null;
  items: StoredItem[];
  progressId: string | null;
  // Set when a saved progress is opened: only this exact new account may sign in (FR-033).
  expectedNew: AccountInfo | null;
  moveState: MoveState;
  notice: string | null;
  // The code a sign-in is waiting on. The account card shows it in place. Native sign-ins never set it.
  signInCode: { role: 'old' | 'new'; code: string; hint: string | null } | null;
  // Kinds the new account has access for, from the platform.
  granted: string[];
  // Kinds that need an old-account sign-in and were read in this app run. ponytail: not saved, so after a restart an
  // empty section of such a kind asks for "Allow" again; save it on the progress if users notice.
  oldRead: string[];
  // The old list is being read.
  loading: boolean;
  // The new account's token was deleted from the phone (summary or Sign out), so the remove-access note shows.
  accessEnded: boolean;
};

export type Action =
  | { type: 'openPlatform'; platform: PlatformId }
  | { type: 'goHome' }
  // A fresh flow for this platform: every flow field back to its start.
  | { type: 'startFlow'; platform: PlatformId }
  // A running move reports through this. It is dropped when its progress is no longer the open one.
  | { type: 'forProgress'; progressId: string; action: Action }
  | { type: 'setStep'; step: Step }
  | { type: 'openSettings' }
  | { type: 'closeSettings' }
  | { type: 'setOld'; account: AccountInfo | null; items: StoredItem[] }
  | { type: 'setNew'; account: AccountInfo | null }
  | { type: 'setProgress'; progressId: string | null; items: StoredItem[] }
  | { type: 'setItems'; items: StoredItem[] }
  | { type: 'setExpectedNew'; account: AccountInfo | null }
  | { type: 'setMoveState'; moveState: MoveState }
  | { type: 'setNotice'; notice: string | null }
  | { type: 'setSignInCode'; code: State['signInCode'] }
  | { type: 'setGranted'; kinds: string[] }
  | { type: 'setOldRead'; kinds: string[] }
  | { type: 'setLoading'; loading: boolean }
  | { type: 'setAccessEnded'; ended: boolean }
  | { type: 'reset' };

export const initialState: State = {
  platform: null,
  flowPlatform: null,
  step: 'from',
  settingsOpen: false,
  oldAccount: null,
  newAccount: null,
  items: [],
  progressId: null,
  expectedNew: null,
  moveState: 'idle',
  notice: null,
  signInCode: null,
  granted: [],
  oldRead: [],
  loading: false,
  accessEnded: false,
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'openPlatform':
      return { ...state, platform: action.platform, flowPlatform: action.platform, settingsOpen: false };
    case 'startFlow':
      return { ...initialState, platform: action.platform, flowPlatform: action.platform };
    case 'forProgress':
      return state.progressId === action.progressId ? reducer(state, action.action) : state;
    case 'goHome':
      return { ...state, platform: null, settingsOpen: false };
    case 'setStep':
      return { ...state, step: action.step, settingsOpen: false, notice: null };
    case 'openSettings':
      return { ...state, settingsOpen: true };
    case 'closeSettings':
      return { ...state, settingsOpen: false };
    case 'setOld':
      // A different old account means a different list and no active progress.
      return {
        ...state,
        oldAccount: action.account,
        items: action.items,
        progressId: null,
        expectedNew: null,
        oldRead: [],
        moveState: 'idle',
        notice: null,
      };
    case 'setNew':
      return {
        ...state,
        newAccount: action.account,
        accessEnded: action.account ? false : state.accessEnded,
        notice: null,
      };
    case 'setProgress':
      return { ...state, progressId: action.progressId, items: action.items, moveState: 'idle' };
    case 'setItems':
      return { ...state, items: action.items };
    case 'setExpectedNew':
      return { ...state, expectedNew: action.account };
    case 'setMoveState':
      return { ...state, moveState: action.moveState };
    case 'setNotice':
      return { ...state, notice: action.notice };
    case 'setSignInCode':
      return { ...state, signInCode: action.code };
    case 'setGranted':
      return { ...state, granted: action.kinds };
    case 'setAccessEnded':
      return { ...state, accessEnded: action.ended };
    case 'setOldRead':
      return { ...state, oldRead: action.kinds };
    case 'setLoading':
      return { ...state, loading: action.loading };
    case 'reset':
      // Delete all keeps the user where they are (FR-010, research R1).
      return { ...initialState, platform: state.platform, flowPlatform: state.flowPlatform };
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function AppStateProvider({
  children,
  initial = initialState,
}: {
  children: React.ReactNode;
  initial?: State;
}) {
  const [state, dispatch] = useReducer(reducer, initial);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
