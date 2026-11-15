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
    expect(next).toEqual({ ...busy, platform: 'youtube', settingsOpen: false });
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

describe('move state', () => {
  it('can be stopped, when the platform paused the account', () => {
    expect(reducer(busy, { type: 'setMoveState', moveState: 'stopped' }).moveState).toBe('stopped');
  });
});
