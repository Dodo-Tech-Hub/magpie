import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { NEW, OLD, blueskyWorld, person, renderBluesky, resetBluesky, signInNewAccount, signInWithHandle } from './blueskyWorld';

jest.mock('@atproto/oauth-client', () => ({
  ...jest.requireActual('@atproto/oauth-client'),
  OAuthClient: require('../mocks/oauthClient').OAuthClient,
}));

let w: ReturnType<typeof blueskyWorld>;

beforeEach(async () => {
  await resetBluesky();
  w = blueskyWorld();
});

const move = async (label: string) => fireEvent.press(await screen.findByLabelText(label));
const finished = (text: string | RegExp) => screen.findByText(text, {}, { timeout: 8000 });
const subjects = (collection: string) => w.writes.filter((x) => x.collection === collection).map((x) => x.record.subject);

async function openPick() {
  await renderBluesky();
  await signInWithHandle('Old account', OLD.handle);
  await screen.findByRole('checkbox', { name: 'All' });
  await signInNewAccount();
}

describe('moving to the new account', () => {
  beforeEach(() => {
    w.data.old.follows = [3, 2, 1]; // newest first: person 1 was followed first
    w.data.old.blocks = [4, 5]; // oldest first
    w.data.old.lists = [{ name: 'Cats', members: [1, 2] }];
  });

  it('adds follows, blocks, and the list, oldest first in each kind, and shows the summary at the end', async () => {
    await openPick();
    await move('Move 6 items');
    expect(await finished('6 moved')).toBeTruthy();
    expect(subjects('app.bsky.graph.follow')).toEqual([person(1).did, person(2).did, person(3).did]);
    expect(subjects('app.bsky.graph.block')).toEqual([person(4).did, person(5).did]);
    // A list moves after the people it holds.
    const order = w.writes.map((x) => x.collection);
    expect(order.indexOf('app.bsky.graph.list')).toBeGreaterThan(order.lastIndexOf('app.bsky.graph.block'));
  });

  it('makes the list with the same name, description, and purpose, and adds every member', async () => {
    w.data.old.lists = [{ name: 'Mods', purpose: 'modlist', members: [1, 2] }];
    w.data.old.follows = [1];
    w.data.old.blocks = [];
    await openPick();
    await move('Move 2 items');
    await finished('2 moved');
    const made = w.writes.find((x) => x.collection === 'app.bsky.graph.list')!;
    expect(made.record).toMatchObject({ name: 'Mods', description: 'About Mods', purpose: 'app.bsky.graph.defs#modlist' });
    expect(subjects('app.bsky.graph.listitem')).toEqual([person(1).did, person(2).did]);
    expect(w.data.new.lists).toEqual([{ name: 'Mods', purpose: 'modlist', members: [1, 2] }]);
  });

  it('reuses a list with the same name on the new account and adds only the missing members', async () => {
    w.data.new.lists = [{ name: 'Cats', members: [1] }];
    w.data.old.follows = [];
    w.data.old.blocks = [];
    await openPick();
    await move('Move 1 item');
    await finished('1 moved');
    expect(w.writes.some((x) => x.collection === 'app.bsky.graph.list')).toBe(false);
    expect(subjects('app.bsky.graph.listitem')).toEqual([person(2).did]);
    expect(w.data.new.lists).toEqual([{ name: 'Cats', members: [1, 2] }]);
  });

  it('does not pick the members of a list as follows on its own', async () => {
    w.data.old.follows = [];
    w.data.old.blocks = [];
    await openPick();
    expect(screen.queryByLabelText('Person 1')).toBeNull();
    await move('Move 1 item');
    await finished('1 moved');
    expect(subjects('app.bsky.graph.follow')).toEqual([]);
  });

  it('says how many members of a list were left out', async () => {
    w.data.old.follows = [];
    w.data.old.blocks = [];
    w.answerNext('app.bsky.graph.listitem', { status: 400, json: { error: 'InvalidRecord' } });
    await openPick();
    await move('Move 1 item');
    expect(await finished('1 left out')).toBeTruthy();
    expect(subjects('app.bsky.graph.listitem')).toEqual([person(2).did]);
  });

  it('shows the plain reason when an item cannot be moved, and goes on with the rest', async () => {
    w.answerNext('app.bsky.graph.follow', { status: 400, json: { error: 'InvalidRecord', message: 'secret details' } });
    await openPick();
    await move('Move 6 items');
    expect(await finished(/5 moved/)).toBeTruthy();
    expect(screen.getByText("Bluesky didn't allow this one.")).toBeTruthy();
    expect(screen.queryByText(/secret details|InvalidRecord/)).toBeNull();
  });

  it('leaves the old account unchanged, writes only to the new account, and takes nothing away from it', async () => {
    w.data.new.follows = [9];
    w.data.new.blocks = [8];
    const before = JSON.stringify(w.data.old);
    await openPick();
    await move('Move 6 items');
    await finished('6 moved');
    expect(JSON.stringify(w.data.old)).toBe(before);
    expect(w.writes.every((x) => x.repo === NEW.did)).toBe(true);
    expect(w.f.calls.filter((c) => c.method !== 'GET').every((c) => c.url.endsWith('.createRecord'))).toBe(true);
    expect(w.data.new.follows).toEqual(expect.arrayContaining([9, 1, 2, 3]));
    expect(w.data.new.blocks).toEqual(expect.arrayContaining([8, 4, 5]));
  });

  it('changes each row in place while it moves', async () => {
    w.data.old.follows = [1];
    w.data.old.blocks = [];
    w.data.old.lists = [];
    w.f.set(`POST https://morel.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord`, { delay: 400, json: { uri: 'at://x', cid: 'c' } });
    await openPick();
    await move('Move 1 item');
    // The row and the bottom button both say Moving while the add is on its way.
    await waitFor(() => expect(screen.getAllByText('Moving…').length).toBe(2));
    await waitFor(() => expect(screen.getByText('Moved')).toBeTruthy(), { timeout: 4000 });
  });
});
