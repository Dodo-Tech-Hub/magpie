import React, { createContext, useContext, useMemo, useReducer } from 'react';
import type { AccountInfo, StoredChannel } from '@/store/progressStore';

export type Step = 'from' | 'pick' | 'to';
export type MoveState = 'idle' | 'moving' | 'limit' | 'done' | 'offline' | 'auth';

export type State = {
  step: Step;
  settingsOpen: boolean;
  oldAccount: AccountInfo | null;
  newAccount: AccountInfo | null;
  channels: StoredChannel[];
  progressId: string | null;
  // Set when a saved progress is opened: only this exact new account may sign in (FR-033).
  expectedNew: AccountInfo | null;
  moveState: MoveState;
  notice: string | null;
};

export type Action =
  | { type: 'setStep'; step: Step }
  | { type: 'openSettings' }
  | { type: 'closeSettings' }
  | { type: 'setOld'; account: AccountInfo | null; channels: StoredChannel[] }
  | { type: 'setNew'; account: AccountInfo | null }
  | { type: 'setProgress'; progressId: string | null; channels: StoredChannel[] }
  | { type: 'setChannels'; channels: StoredChannel[] }
  | { type: 'setExpectedNew'; account: AccountInfo | null }
  | { type: 'setMoveState'; moveState: MoveState }
  | { type: 'setNotice'; notice: string | null }
  | { type: 'reset' };

export const initialState: State = {
  step: 'from',
  settingsOpen: false,
  oldAccount: null,
  newAccount: null,
  channels: [],
  progressId: null,
  expectedNew: null,
  moveState: 'idle',
  notice: null,
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
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
        channels: action.channels,
        progressId: null,
        expectedNew: null,
        moveState: 'idle',
        notice: null,
      };
    case 'setNew':
      return { ...state, newAccount: action.account, notice: null };
    case 'setProgress':
      return { ...state, progressId: action.progressId, channels: action.channels, moveState: 'idle' };
    case 'setChannels':
      return { ...state, channels: action.channels };
    case 'setExpectedNew':
      return { ...state, expectedNew: action.account };
    case 'setMoveState':
      return { ...state, moveState: action.moveState };
    case 'setNotice':
      return { ...state, notice: action.notice };
    case 'reset':
      return initialState;
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
