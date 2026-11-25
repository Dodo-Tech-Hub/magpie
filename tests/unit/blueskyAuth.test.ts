import { ALL_SCOPES, kindsOf, scopesFor } from '@/auth/bluesky';

const AUD = 'did:web:api.bsky.app%23bsky_appview';
const split = (s: string) => s.split(' ');

describe('access asked of the new account', () => {
  it('asks only for the base scope when no kind is picked', () => {
    expect(scopesFor('new', [])).toBe('atproto');
  });

  it.each([
    ['person', ['repo:app.bsky.graph.follow?action=create']],
    ['block', ['repo:app.bsky.graph.block?action=create']],
    ['list', ['repo:app.bsky.graph.list?action=create', 'repo:app.bsky.graph.listitem?action=create']],
    ['mute', [`rpc:app.bsky.graph.muteActor?aud=${AUD}`, `rpc:app.bsky.graph.getMutes?aud=${AUD}`]],
    ['feed', [`rpc:app.bsky.actor.getPreferences?aud=${AUD}`, `rpc:app.bsky.actor.putPreferences?aud=${AUD}`]],
  ])('asks for exactly the access of %s', (kind, scopes) => {
    expect(split(scopesFor('new', [kind])).sort()).toEqual(['atproto', ...scopes].sort());
  });

  it('asks for the access of every picked kind once, and for nothing of the others', () => {
    const asked = split(scopesFor('new', ['person', 'block']));
    expect(asked.sort()).toEqual(['atproto', 'repo:app.bsky.graph.block?action=create', 'repo:app.bsky.graph.follow?action=create'].sort());
    expect(split(scopesFor('new', ['person', 'person']))).toHaveLength(2);
  });

  it('ignores a kind it does not know', () => {
    expect(scopesFor('new', ['gist'])).toBe('atproto');
  });

  it('never asks for access to the whole account', () => {
    const all = scopesFor('new', ['person', 'block', 'list', 'mute', 'feed']);
    expect(all).not.toContain('transition:generic');
    expect(all).not.toContain('transition:chat');
    expect(split(all).every((s) => s === 'atproto' || s.startsWith('repo:') || s.startsWith('rpc:'))).toBe(true);
    expect(all).not.toContain('repo:*');
    expect(all).not.toContain('aud=*');
  });
});

describe('access asked of the old account after Allow', () => {
  it('is only to read, never to create or change', () => {
    const asked = split(scopesFor('old', ['mute', 'feed']));
    expect(asked.sort()).toEqual(['atproto', `rpc:app.bsky.actor.getPreferences?aud=${AUD}`, `rpc:app.bsky.graph.getMutes?aud=${AUD}`].sort());
    expect(asked.some((s) => s.startsWith('repo:') || /put|mute(?!s)|create/i.test(s.replace('getMutes', '')))).toBe(false);
  });

  it('is nothing more than the base scope for kinds that are public', () => {
    expect(scopesFor('old', ['person', 'block', 'list'])).toBe('atproto');
    expect(scopesFor('old', [])).toBe('atproto');
  });
});

describe('the kinds a granted scope covers', () => {
  it('maps the scopes Bluesky says were granted back to kinds', () => {
    expect(kindsOf(scopesFor('new', ['person', 'list', 'feed'])).sort()).toEqual(['feed', 'list', 'person']);
    expect(kindsOf('atproto')).toEqual([]);
  });

  it('leaves out a kind when the user took away one of its scopes on Bluesky page', () => {
    const asked = split(scopesFor('new', ['list', 'mute']));
    const granted = asked.filter((s) => !s.includes('listitem')).join(' ');
    expect(kindsOf(granted)).toEqual(['mute']);
  });

  it('does not count a scope for another collection or another action', () => {
    expect(kindsOf('atproto repo:app.bsky.graph.follow?action=delete')).toEqual([]);
    expect(kindsOf('atproto repo:app.bsky.feed.post?action=create')).toEqual([]);
  });
});

describe('the scopes the metadata file must list', () => {
  it('holds every scope the app can ask for, once each', () => {
    const asked = new Set([
      ...split(scopesFor('new', ['person', 'block', 'list', 'mute', 'feed'])),
      ...split(scopesFor('old', ['mute', 'feed'])),
    ]);
    expect(new Set(ALL_SCOPES)).toEqual(asked);
    expect(new Set(ALL_SCOPES).size).toBe(ALL_SCOPES.length);
  });
});
