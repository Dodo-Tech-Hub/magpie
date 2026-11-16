import { initialState, reducer, type State } from '@/state/AppState';

const busy: State = {
  ...initialState,
  step: 'pick',
  settingsOpen: true,
  progressId: 'p1',
  moveState: 'moving',
  notice: 'hi',
  items: [{ itemId: 'a', kind: 'channel', title: 'A', thumbnailUrl: null, data: null, picked: true, status: 'waiting', reason: null }],
};

describe('platform field', () => {
  it('starts on Home', () => {
    expect(initialState.platform).toBeNull();
  });

  it('openPlatform sets the platform, closes Settings, and keeps the rest', () => {
    const next = reducer(busy, { type: 'openPlatform', platform: 'youtube' });
    expect(next).toEqual({ ...busy, platform: 'youtube', flowPlatform: 'youtube', settingsOpen: false });
  });

  it('goHome shows Home, closes Settings, and keeps the rest', () => {
    const inFlow = { ...busy, platform: 'youtube' as const };
    expect(reducer(inFlow, { type: 'goHome' })).toEqual({ ...busy, platform: null, settingsOpen: false });
  });

  it('reset clears everything but keeps the platform', () => {
    const inFlow = { ...busy, platform: 'youtube' as const };
    expect(reducer(inFlow, { type: 'reset' })).toEqual({ ...initialState, platform: 'youtube' });
    expect(reducer(busy, { type: 'reset' })).toEqual(initialState);
  });
});

describe('sign-in code and granted kinds', () => {
  it('sets and clears the code', () => {
    const code = { role: 'new' as const, code: 'ABCD-1234', hint: null };
    const next = reducer(busy, { type: 'setSignInCode', code });
    expect(next.signInCode).toEqual(code);
    expect(reducer(next, { type: 'setSignInCode', code: null }).signInCode).toBeNull();
  });

  it('sets the granted kinds, reset clears both, and setOld leaves granted alone', () => {
    const s = reducer(
      reducer(busy, { type: 'setGranted', kinds: ['repo'] }),
      { type: 'setSignInCode', code: { role: 'old', code: 'X', hint: 'h' } },
    );
    expect(s.granted).toEqual(['repo']);
    expect(reducer(s, { type: 'setOld', account: null, items: [] }).granted).toEqual(['repo']);
    expect(reducer(s, { type: 'reset' })).toMatchObject({ granted: [], signInCode: null });
  });
});

describe('move state', () => {
  it('can be stopped, when the platform paused the account', () => {
    expect(reducer(busy, { type: 'setMoveState', moveState: 'stopped' }).moveState).toBe('stopped');
  });
});

describe('flow per platform (FR-GH-022)', () => {
  it('goHome keeps the platform of the flow, so the same card can resume it', () => {
    const open = reducer(busy, { type: 'openPlatform', platform: 'github' });
    const home = reducer(open, { type: 'goHome' });
    expect(home.platform).toBeNull();
    expect(home.flowPlatform).toBe('github');
    expect(home.progressId).toBe('p1');
  });

  it('startFlow clears the old flow and opens the platform at the start', () => {
    const next = reducer({ ...busy, flowPlatform: 'github' }, { type: 'startFlow', platform: 'youtube' });
    expect(next).toEqual({ ...initialState, platform: 'youtube', flowPlatform: 'youtube' });
  });

  it('forProgress applies only while that progress is the open one', () => {
    const act = { type: 'setMoveState', moveState: 'done' } as const;
    expect(reducer(busy, { type: 'forProgress', progressId: 'p1', action: act }).moveState).toBe('done');
    expect(reducer(busy, { type: 'forProgress', progressId: 'other', action: act })).toBe(busy);
  });
});
