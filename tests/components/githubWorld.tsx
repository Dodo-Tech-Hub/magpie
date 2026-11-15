import { Linking } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import App from '../../App';
import { PLATFORMS } from '@/platforms/platforms';
import { closeStore } from '@/store/progressStore';
import { dropNew, dropOld } from '@/auth/githubTokens';
import { __reset } from '../mocks/expoSecureStore';
import { deviceCode, mockGithub, noContent, pending, token, type Answer, type Req } from '../mocks/githubFetch';

// Two GitHub accounts and what each stars, follows, and has in lists.
export const OLD = { id: 1, login: 'old-me' };
export const NEW = { id: 2, login: 'new-me' };

const AV = 'https://avatars.githubusercontent.com/u/1';
export const repo = (id: number) => ({ id, full_name: `o/r${id}`, node_id: `N${id}`, owner: { avatar_url: AV } });
export const person = (id: number, login = `p${id}`) => ({ id, login, avatar_url: AV });
export const gist = (id: string, description = id) => ({ id, description, owner: { avatar_url: AV } });
export const gqlList = (id: string, name: string, repos: number[]) => ({
  id,
  name,
  description: `${name} desc`,
  isPrivate: false,
  items: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: repos.map((r) => ({ id: `N${r}`, databaseId: r })) },
});

export type Side = { stars: unknown[]; people: unknown[]; gists: unknown[]; lists: unknown[] };
const emptySide = (): Side => ({ stars: [], people: [], gists: [], lists: [] });

export function githubWorld() {
  const data = { old: emptySide(), new: emptySide() };
  // What each sign-in does: pending answers first, then a token (named tok-old or tok-new...).
  const queue: { pending: number; token: string; scope: string; error?: string }[] = [];
  const accounts: Record<string, { id: number; login: string }> = {};
  const roleOf = (r: Req) => (r.auth?.includes('tok-old') ? 'old' : 'new');
  const side = (r: Req) => data[roleOf(r)];
  const failures: Record<string, Answer> = {};

  const gh = mockGithub({
    'POST https://github.com/login/device/code': () => deviceCode({ interval: 1 }),
    'POST https://github.com/login/oauth/access_token': () => {
      const q = queue[0];
      if (!q) return pending();
      if (q.error) {
        queue.shift();
        return { json: { error: q.error } };
      }
      if (q.pending > 0) {
        q.pending -= 1;
        return pending();
      }
      queue.shift();
      return token(q.scope, { access_token: q.token });
    },
    'GET https://api.github.com/user': (r) => ({
      json: { ...accounts[r.auth!.replace('Bearer ', '')], name: null, avatar_url: AV },
    }),
    'GET https://api.github.com/user/starred': (r) => failures.stars ?? page(r, side(r).stars),
    'GET https://api.github.com/user/following': (r) => failures.people ?? page(r, side(r).people),
    'GET https://api.github.com/gists/starred': (r) => failures.gists ?? page(r, side(r).gists),
    'POST https://api.github.com/graphql': (r) => {
      const q = (r.body as { query: string }).query;
      if (q.includes('createUserList')) {
        return { json: { data: { createUserList: { list: { id: `LNEW-${Math.random().toString(36).slice(2, 6)}`, name: 'x' } } } } };
      }
      if (q.includes('updateUserListsForItem')) return { json: { data: { updateUserListsForItem: {} } } };
      if (failures.lists) return failures.lists;
      return {
        json: { data: { viewer: { lists: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: side(r).lists } } } },
      };
    },
    'PUT https://api.github.com/*': noContent,
  });

  // Only the first page: the tests here do not page.
  function page(r: Req, items: unknown[]): Answer {
    const n = Number(new URL(r.url).searchParams.get('page') ?? '1');
    return { json: items.slice((n - 1) * 100, n * 100) };
  }

  return {
    data,
    gh,
    queue,
    accounts,
    failures,
    // The next sign-in ends with this account.
    signIn: (who: 'old' | 'new', opts: { pending?: number; scope?: string; tok?: string; as?: { id: number; login: string }; error?: string } = {}) => {
      const tok = opts.tok ?? (who === 'old' ? 'tok-old' : 'tok-new');
      accounts[tok] = opts.as ?? (who === 'old' ? OLD : NEW);
      queue.push({ pending: opts.pending ?? 0, token: tok, scope: opts.scope ?? (who === 'old' ? '' : 'public_repo,user:follow,user'), error: opts.error });
    },
  };
}

export async function resetGithub() {
  process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID = 'client-test';
  jest.clearAllMocks();
  __reset();
  dropOld();
  await dropNew();
  await closeStore();
  (Clipboard.setStringAsync as jest.Mock).mockClear();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
}

// The GitHub card is hidden until the feature is ready (Phase 8). Tests show it.
export function showGithub() {
  PLATFORMS.find((p) => p.id === 'github')!.ready = true;
}

export async function renderGithub() {
  showGithub();
  const view = await render(<App />);
  await fireEvent.press(await screen.findByLabelText('GitHub'));
  return view;
}

// Let fake time pass so a poll can happen, inside act.
export const seconds = (n: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(n * 1000);
  });
