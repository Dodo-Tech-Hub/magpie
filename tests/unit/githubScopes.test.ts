import { scopesFor } from '@/auth/github';

describe('scopesFor', () => {
  it.each([
    [['repo'], 'public_repo'],
    [['person'], 'user:follow'],
    [['list'], 'user'],
    [['gist'], 'gist'],
    [[], ''],
  ])('%j asks for "%s"', (kinds, scope) => {
    expect(scopesFor(kinds)).toBe(scope);
  });

  it('asks for all four without repeating, and leaves out user:follow when user is there', () => {
    expect(scopesFor(['repo', 'person', 'list', 'gist']).split(' ').sort()).toEqual(['gist', 'public_repo', 'user']);
  });

  it('adds what was granted before', () => {
    expect(scopesFor(['gist'], ['public_repo', 'user']).split(' ').sort()).toEqual(['gist', 'public_repo', 'user']);
    expect(scopesFor(['person'], ['public_repo']).split(' ').sort()).toEqual(['public_repo', 'user:follow']);
  });

  it('drops user:follow from earlier scopes when user comes in', () => {
    expect(scopesFor(['list'], ['user:follow']).split(' ')).toEqual(['user']);
  });
});
