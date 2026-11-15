import { fireEvent, screen } from '@testing-library/react-native';
import { gist, githubWorld, gqlList, person, renderGithub, repo, resetGithub, seconds, signInBoth } from './githubWorld';

let w: ReturnType<typeof githubWorld>;

beforeEach(async () => {
  jest.useFakeTimers();
  await resetGithub();
  w = githubWorld();
});
afterEach(() => jest.useRealTimers());

const fill = () => {
  w.data.old.stars = [repo(1), repo(2)];
  w.data.old.lists = [gqlList('L1', 'Work', [1])];
  w.data.old.gists = [gist('g1', 'My gist')];
  w.data.old.people = [person(7, 'bob')];
};
const checked = (name: string) => screen.getByRole('checkbox', { name }).props.accessibilityState.checked;

describe('sections', () => {
  it('shows one section per kind under its heading, each row picked, in the Pick order', async () => {
    fill();
    await renderGithub();
    await signInBoth(w);
    for (const name of ['o/r1', 'o/r2', 'Work', 'My gist', 'bob']) expect(checked(name)).toBe(true);
    expect(screen.getByText('5 of 5 picked')).toBeTruthy();
    const order = screen.getAllByRole('header').map((h) => h.props.children);
    expect(order).toEqual(['Stars', 'Lists', 'Gists', 'People']);
  });

  it('shows no section for a kind with no items', async () => {
    w.data.old.stars = [repo(1)];
    w.data.old.people = [person(7)];
    await renderGithub();
    await signInBoth(w);
    expect(screen.getAllByRole('header').map((h) => h.props.children)).toEqual(['Stars', 'People']);
  });

  it('shows a plain list with no heading when there is one kind', async () => {
    w.data.old.stars = [repo(1), repo(2)];
    await renderGithub();
    await signInBoth(w);
    expect(screen.queryByRole('header')).toBeNull();
    expect(screen.getByLabelText('o/r1')).toBeTruthy();
  });

  it('searches and picks All across sections', async () => {
    fill();
    await renderGithub();
    await signInBoth(w);
    await fireEvent.changeText(screen.getByLabelText('Search'), 'o');
    expect(screen.getByLabelText('o/r1')).toBeTruthy();
    expect(screen.getByLabelText('bob')).toBeTruthy();
    expect(screen.getByLabelText('Work')).toBeTruthy();
    expect(screen.queryByLabelText('My gist')).toBeNull();
    expect(screen.queryByText('Gists')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Search'), '');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'All' }));
    expect(screen.getByText('0 of 5 picked')).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'All' }));
    expect(screen.getByText('5 of 5 picked')).toBeTruthy();
  });

  it('says "Move N items"', async () => {
    fill();
    await renderGithub();
    await signInBoth(w);
    expect(screen.getByLabelText('Move 5 items')).toBeTruthy();
  });
});

describe('already there', () => {
  it('marks what the new account has and cannot pick it, including the new account itself', async () => {
    w.data.old.stars = [repo(1), repo(2)];
    w.data.old.people = [person(2, 'new-me'), person(7, 'bob')];
    w.data.new.stars = [repo(1)];
    await renderGithub();
    await signInBoth(w);
    expect(screen.getAllByText('Already there')).toHaveLength(2);
    expect(screen.getByRole('checkbox', { name: 'o/r1' }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'new-me' }).props.accessibilityState.disabled).toBe(true);
    expect(checked('o/r2')).toBe(true);
    expect(screen.getByText('2 of 2 picked')).toBeTruthy();
  });
});

describe('reading the old account', () => {
  it('shows the other kinds and a line when one kind cannot load', async () => {
    fill();
    w.failures.lists = { status: 500, json: {} };
    w.signIn('old');
    await renderGithub();
    await fireEvent.press(screen.getByLabelText('Sign in with GitHub: Old account'));
    await seconds(2);
    expect(await screen.findByText("Some items couldn't load. The rest can still move.")).toBeTruthy();
    expect(screen.getByLabelText('o/r1')).toBeTruthy();
    expect(screen.queryByLabelText('Work')).toBeNull();
  });

  it('says so and offers no Move button when the account has nothing', async () => {
    await renderGithub();
    await signInBoth(w);
    expect(screen.getByText("This account doesn't follow anything yet")).toBeTruthy();
    expect(screen.queryByLabelText(/^Move/)).toBeNull();
  });

  it('shows a loading line while a long list loads, then all of it, searchable', async () => {
    w.data.old.stars = Array.from({ length: 250 }, (_, i) => repo(i + 1));
    w.gh.set('GET https://api.github.com/user/starred', (r) => {
      const n = Number(new URL(r.url).searchParams.get('page'));
      return { delay: 1000, json: w.data.old.stars.slice((n - 1) * 100, n * 100) };
    });
    w.signIn('old');
    await renderGithub();
    await fireEvent.press(screen.getByLabelText('Sign in with GitHub: Old account'));
    await seconds(2);
    expect(await screen.findByText('Loading your list…')).toBeTruthy();
    await seconds(5);
    expect(await screen.findByText('250 of 250 picked')).toBeTruthy();
    expect(screen.queryByText('Loading your list…')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Search'), 'o/r249');
    expect(screen.getByLabelText('o/r249')).toBeTruthy();
  });
});
