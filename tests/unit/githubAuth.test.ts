import { signIn } from '@/auth/github';
import { DEVICE_URL, TOKEN_URL, USER_URL, deviceCode, mockGithub, pending, token, user } from '../mocks/githubFetch';

const OK_SCOPE = 'public_repo user';
let log: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(1_000_000);
  process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID = 'client-1';
  log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// Start a sign-in and let the timers run for this many seconds.
async function run(scope = OK_SCOPE, seconds = 5, signal?: AbortSignal) {
  const onCode = jest.fn();
  const p = signIn(scope, onCode, signal);
  await jest.advanceTimersByTimeAsync(seconds * 1000);
  return { p, onCode };
}

const happy = (over: Record<string, unknown> = {}) => ({
  [DEVICE_URL]: deviceCode(over),
  [TOKEN_URL]: token(OK_SCOPE.replace(' ', ',')),
  [USER_URL]: user(42, 'octo'),
});

describe('device code', () => {
  it('asks for a code with the client ID and the scope, with no secret', async () => {
    const gh = mockGithub(happy());
    const { p } = await run('gist');
    await p;
    const call = gh.callsTo('POST', 'https://github.com/login/device/code')[0];
    expect(call.body).toEqual({ client_id: 'client-1', scope: 'gist' });
    expect(JSON.stringify(gh.calls)).not.toContain('client_secret');
  });

  it('asks with an empty scope for the old account', async () => {
    const gh = mockGithub(happy());
    const { p } = await run('');
    await p;
    expect(gh.callsTo('POST', 'https://github.com/login/device/code')[0].body).toMatchObject({ scope: '' });
  });

  it.each([
    ['a page outside GitHub', { verification_uri: 'https://evil.example/login/device' }],
    ['a user code of the wrong shape', { user_code: 'ABC' }],
    ['an interval of 0', { interval: 0 }],
    ['an interval over 60', { interval: 61 }],
    ['an expiry under 60', { expires_in: 59 }],
    ['an expiry over 1800', { expires_in: 1801 }],
    ['no device code', { device_code: undefined }],
  ])('rejects %s', async (_n, over) => {
    mockGithub(happy(over));
    const { p, onCode } = await run();
    expect(await p).toEqual({ ok: false, reason: 'failed' });
    expect(onCode).not.toHaveBeenCalledWith(expect.objectContaining({ code: expect.anything() }));
  });

  it('fails with no client ID', async () => {
    delete process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID;
    const gh = mockGithub(happy());
    const { p } = await run();
    expect(await p).toEqual({ ok: false, reason: 'failed' });
    expect(gh.calls).toHaveLength(0);
  });
});

describe('waiting for the user', () => {
  it('shows the code, polls every interval, and ends with the account and the granted scopes', async () => {
    const gh = mockGithub({ ...happy(), [TOKEN_URL]: [pending(), pending(), token('public_repo,user')] });
    const { p, onCode } = await run(OK_SCOPE, 15);
    const res = await p;
    expect(onCode).toHaveBeenNthCalledWith(1, { code: 'ABCD-1234', url: 'https://github.com/login/device' });
    expect(onCode).toHaveBeenLastCalledWith(null);
    expect(res).toMatchObject({
      ok: true,
      token: 'gho_secret',
      scopes: ['public_repo', 'user'],
      account: { id: '42', handle: 'octo', name: 'octo' },
    });
    expect(gh.callsTo('POST', 'https://github.com/login/oauth/access_token')).toHaveLength(3);
    const poll = gh.callsTo('POST', 'https://github.com/login/oauth/access_token')[0].body;
    expect(poll).toEqual({
      client_id: 'client-1',
      device_code: 'dev-123',
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
  });

  it('reads the scopes from the answer, not from what was asked', async () => {
    mockGithub({ ...happy(), [TOKEN_URL]: token('user:follow') });
    const { p } = await run('public_repo user:follow');
    expect(await p).toMatchObject({ ok: true, scopes: ['user:follow'] });
  });

  it('works out when the token runs out from expires_in, and never returns the refresh token', async () => {
    mockGithub(happy());
    const { p } = await run();
    const res = await p;
    expect(res).toMatchObject({ ok: true, expiresAt: Date.now() + 28800 * 1000 });
    expect(JSON.stringify(res)).not.toContain('ghr_refresh');
  });

  it('adds 5 seconds to the interval on slow_down', async () => {
    const gh = mockGithub({ ...happy(), [TOKEN_URL]: [{ json: { error: 'slow_down' } }, token('user')] });
    const { p } = await run(OK_SCOPE, 5);
    await jest.advanceTimersByTimeAsync(9_000);
    expect(gh.callsTo('POST', 'https://github.com/login/oauth/access_token')).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(await p).toMatchObject({ ok: true });
    expect(gh.callsTo('POST', 'https://github.com/login/oauth/access_token')).toHaveLength(2);
  });

  it.each([
    'expired_token',
    'incorrect_device_code',
    'incorrect_client_credentials',
    'unsupported_grant_type',
    'device_flow_disabled',
    'something_new',
  ])('stops with failed on %s', async (error) => {
    mockGithub({ ...happy(), [TOKEN_URL]: { json: { error } } });
    const { p, onCode } = await run();
    expect(await p).toEqual({ ok: false, reason: 'failed' });
    expect(onCode).toHaveBeenLastCalledWith(null);
  });

  it('stops with cancelled on access_denied', async () => {
    mockGithub({ ...happy(), [TOKEN_URL]: { json: { error: 'access_denied' } } });
    const { p } = await run();
    expect(await p).toEqual({ ok: false, reason: 'cancelled' });
  });

  it('stops asking when the code has run out', async () => {
    const gh = mockGithub({ ...happy({ expires_in: 60, interval: 10 }), [TOKEN_URL]: pending() });
    const { p } = await run(OK_SCOPE, 120);
    expect(await p).toEqual({ ok: false, reason: 'failed' });
    const n = gh.callsTo('POST', 'https://github.com/login/oauth/access_token').length;
    await jest.advanceTimersByTimeAsync(60_000);
    expect(gh.callsTo('POST', 'https://github.com/login/oauth/access_token')).toHaveLength(n);
  });

  it('stops asking when the user taps Cancel', async () => {
    const gh = mockGithub({ ...happy(), [TOKEN_URL]: pending() });
    const ctl = new AbortController();
    const { p, onCode } = await run(OK_SCOPE, 12, ctl.signal);
    ctl.abort();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(await p).toEqual({ ok: false, reason: 'cancelled' });
    expect(onCode).toHaveBeenLastCalledWith(null);
    const n = gh.callsTo('POST', 'https://github.com/login/oauth/access_token').length;
    await jest.advanceTimersByTimeAsync(30_000);
    expect(gh.callsTo('POST', 'https://github.com/login/oauth/access_token')).toHaveLength(n);
  });

  it('keeps asking after one dropped request', async () => {
    let n = 0;
    const gh = mockGithub({ ...happy() });
    gh.set(TOKEN_URL, () => {
      n += 1;
      if (n === 1) throw new Error('offline');
      return token('user');
    });
    const { p } = await run(OK_SCOPE, 10);
    expect(await p).toMatchObject({ ok: true });
  });
});

describe('answers are checked before use', () => {
  it.each([
    ['no access token', { access_token: undefined }],
    ['a token type that is not bearer', { token_type: 'mac' }],
    ['no scope text', { scope: undefined }],
  ])('rejects a token answer with %s', async (_n, over) => {
    mockGithub({ ...happy(), [TOKEN_URL]: token('user', over) });
    const { p } = await run();
    expect(await p).toEqual({ ok: false, reason: 'failed' });
  });

  it.each([
    ['a text id', { id: '42', login: 'octo' }],
    ['no login', { id: 42 }],
  ])('rejects an account with %s', async (_n, json) => {
    mockGithub({ ...happy(), [USER_URL]: { json } });
    const { p } = await run();
    expect(await p).toEqual({ ok: false, reason: 'failed' });
  });

  it('uses the name when there is one, and drops a picture from outside GitHub', async () => {
    mockGithub({
      ...happy(),
      [USER_URL]: { json: { id: 42, login: 'octo', name: 'Octo Cat', avatar_url: 'https://evil.example/a.png' } },
    });
    const { p } = await run();
    expect(await p).toMatchObject({ account: { name: 'Octo Cat', photoUrl: null } });
  });

  it('logs nothing', async () => {
    mockGithub(happy());
    const { p } = await run();
    await p;
    expect(log).not.toHaveBeenCalled();
  });
});
