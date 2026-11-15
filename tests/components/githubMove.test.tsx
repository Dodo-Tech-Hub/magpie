import { fireEvent, screen } from '@testing-library/react-native';
import { addsSince, recordAdd } from '@/store/progressStore';
import { eventually, gist, githubWorld, gqlList, person, renderGithub, repo, resetGithub, seconds, signInBoth } from './githubWorld';

let w: ReturnType<typeof githubWorld>;

beforeEach(async () => {
  jest.useFakeTimers();
  await resetGithub();
  w = githubWorld();
});
afterEach(() => jest.useRealTimers());

const writes = () => w.gh.calls.filter((c) => c.auth === 'Bearer tok-new' && c.method !== 'GET' && !c.url.includes('github.com/login'));
const move = async (label: string) => fireEvent.press(await screen.findByLabelText(label));
const graphqlSent = (name: string) =>
  w.gh.calls.filter((c) => c.url.endsWith('/graphql') && (c.body as { query: string }).query.includes(name));

describe('a full move', () => {
  it('moves stars, people, gists, then lists, and shows the summary', async () => {
    w.data.old.stars = [repo(1), repo(2)];
    w.data.old.people = [person(7, 'bob')];
    w.data.old.gists = [gist('g1')];
    w.data.old.lists = [gqlList('L1', 'Work', [1])];
    await renderGithub();
    await signInBoth(w);
    await move('Move 5 items');
    expect(await eventually('5 moved')).toBeTruthy();
    expect(writes().map((c) => `${c.method} ${c.url.replace('https://api.github.com', '')}`)).toEqual([
      'PUT /user/starred/o/r1',
      'PUT /user/starred/o/r2',
      'PUT /user/following/bob',
      'PUT /gists/g1/star',
      'POST /graphql', // read the lists of the new account
      'POST /graphql', // make the list
      'POST /graphql', // put the repository in it
    ]);
    expect(screen.getAllByText('Moved')).toHaveLength(5);
  });

  it('changes a row in place to Moving while it is added', async () => {
    w.data.old.stars = [repo(1)];
    await renderGithub();
    await signInBoth(w);
    w.gh.set('PUT https://api.github.com/*', { delay: 5000, status: 204 });
    await move('Move 1 item');
    expect((await screen.findAllByText('Moving…')).length).toBeGreaterThan(0);
    expect(await eventually('Moved')).toBeTruthy();
  });

  it('never touches the old account: no write with its token, and no DELETE at all', async () => {
    w.data.old.stars = [repo(1)];
    w.data.old.people = [person(7)];
    await renderGithub();
    await signInBoth(w);
    await move('Move 2 items');
    await eventually('2 moved');
    const oldCalls = w.gh.calls.filter((c) => c.auth === 'Bearer tok-old');
    expect(oldCalls.length).toBeGreaterThan(0);
    expect(oldCalls.every((c) => c.method === 'GET' || c.url.endsWith('/graphql'))).toBe(true);
    expect(oldCalls.filter((c) => c.url.endsWith('/graphql') && (c.body as { query: string }).query.includes('mutation'))).toEqual([]);
    expect(w.gh.calls.some((c) => c.method === 'DELETE')).toBe(false);
    // The old token is not used after the list is read.
    const lastOld = Math.max(...w.gh.calls.map((c, i) => (c.auth === 'Bearer tok-old' ? i : -1)));
    const firstWrite = w.gh.calls.findIndex((c) => c.method === 'PUT');
    expect(lastOld).toBeLessThan(firstWrite);
  });

  it('shows a failed person with the reason and goes on with the rest', async () => {
    w.data.old.people = [person(7, 'bob'), person(8, 'amy')];
    await renderGithub();
    await signInBoth(w);
    w.gh.set('PUT https://api.github.com/user/following/bob', { status: 404, json: { message: 'Not Found' } });
    await move('Move 2 items');
    expect(await eventually('1 moved · 1 couldn\'t move')).toBeTruthy();
    expect(screen.getByText("Couldn't move")).toBeTruthy();
    expect(screen.getByText('Account was deleted.')).toBeTruthy();
  });

  it('needs the new account', async () => {
    w.data.old.stars = [repo(1)];
    w.signIn('old');
    await renderGithub();
    await fireEvent.press(screen.getByLabelText('Sign in with GitHub: Old account'));
    await seconds(2);
    await move('Move 1 item');
    expect(await screen.findByText('Sign in to your new account first')).toBeTruthy();
  });
});

describe('the pace', () => {
  it('adds at least 3 seconds apart (FR-GH-010)', async () => {
    w.data.old.stars = [repo(1), repo(2), repo(3)];
    await renderGithub();
    await signInBoth(w);
    await move('Move 3 items');
    await eventually('3 moved');
    const at = writes().map((c) => c.at);
    expect(at).toHaveLength(3);
    expect(at[1] - at[0]).toBeGreaterThanOrEqual(3000);
    expect(at[2] - at[1]).toBeGreaterThanOrEqual(3000);
  });
});

describe('star lists', () => {
  it('reuses a list with the same name, adds only what moved, and says how many it left out', async () => {
    w.data.old.stars = [repo(1), repo(2)];
    w.data.old.lists = [gqlList('L1', 'Work', [1, 2])];
    w.data.new.lists = [gqlList('LW', 'work', [])];
    await renderGithub();
    await signInBoth(w);
    // The user unpicks one repository. Picking a list never picks its repositories.
    await fireEvent.press(screen.getByRole('checkbox', { name: 'o/r2' }));
    await move('Move 2 items');
    await eventually('2 moved');
    expect(graphqlSent('createUserList')).toHaveLength(0);
    const updates = graphqlSent('updateUserListsForItem');
    expect(updates).toHaveLength(1);
    expect((updates[0].body as { variables: unknown }).variables).toEqual({ itemId: 'N1', listIds: ['LW'] });
    expect(screen.getByText('1 left out')).toBeTruthy();
  });

  it('makes the list with the same name and description when there is none', async () => {
    w.data.old.stars = [repo(1)];
    w.data.old.lists = [gqlList('L1', 'Work', [1])];
    await renderGithub();
    await signInBoth(w);
    await move('Move 2 items');
    await eventually('2 moved');
    const made = graphqlSent('createUserList');
    expect(made).toHaveLength(1);
    expect((made[0].body as { variables: unknown }).variables).toEqual({ name: 'Work', description: 'Work desc', isPrivate: false });
  });

  it('keeps a repository in the other lists it is in on the new account (FR-GH-009)', async () => {
    w.data.old.stars = [repo(1)];
    w.data.old.lists = [gqlList('L1', 'Work', [1])];
    w.data.new.stars = [repo(1)];
    w.data.new.lists = [gqlList('LX', 'Other', [1]), gqlList('LW', 'Work', [])];
    await renderGithub();
    await signInBoth(w);
    await move('Move 1 item');
    await eventually('1 moved · 1 already there');
    const sent = (graphqlSent('updateUserListsForItem')[0].body as { variables: { listIds: string[] } }).variables;
    expect([...sent.listIds].sort()).toEqual(['LW', 'LX']);
  });

  it('pauses part way when the hourly pace runs out, and Continue runs the whole list again without dropping a list', async () => {
    w.data.old.stars = [repo(1), repo(2), repo(3)];
    w.data.old.lists = [gqlList('L1', 'Work', [1, 2, 3])];
    w.data.new.stars = [repo(1), repo(2), repo(3)];
    w.data.new.lists = [gqlList('LX', 'Other', [2])];
    await renderGithub();
    await signInBoth(w);
    // 297 adds already in the last hour: the list create is #298, then two repository adds, then the pace is full.
    for (let i = 0; i < 297; i += 1) await recordAdd('github:2', Date.now() - 1000 - i);
    await move('Move 1 item');
    expect(await eventually('GitHub needs a break. We\'ll remind you when you can move the rest.')).toBeTruthy();
    expect(screen.getByText('Later')).toBeTruthy();
    expect(graphqlSent('updateUserListsForItem').length).toBeLessThan(3);
    const before = graphqlSent('updateUserListsForItem').length;

    // An hour on, Continue runs the list again. Every repository keeps the lists it had.
    await seconds(3601);
    await fireEvent.press(await screen.findByLabelText('Continue'));
    await eventually('1 moved · 3 already there');
    const all = graphqlSent('updateUserListsForItem').slice(before);
    expect(all.length).toBeGreaterThanOrEqual(3);
    const withTwo = all.map((c) => (c.body as { variables: { itemId: string; listIds: string[] } }).variables).find((v) => v.itemId === 'N2')!;
    expect(withTwo.listIds).toContain('LX');
    expect((await addsSince('github:2', 0)).length).toBeGreaterThan(0);
  });
});
