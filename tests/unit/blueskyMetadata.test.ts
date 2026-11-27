import fs from 'fs';
import path from 'path';
import { ALL_SCOPES, CLIENT_ID, REDIRECT_URI, clientMetadata } from '@/auth/bluesky';

const file = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/oauth/bluesky-client-metadata.json'), 'utf8'));

describe('the client metadata file Bluesky reads', () => {
  it('is the same as what the app uses, so the two cannot drift apart', () => {
    expect(file).toEqual({ ...clientMetadata, redirect_uris: [...clientMetadata.redirect_uris], grant_types: [...clientMetadata.grant_types], response_types: [...clientMetadata.response_types] });
  });

  it('has the address it is served at as its ID', () => {
    expect(file.client_id).toBe('https://dodo-tech-hub.github.io/magpie/oauth/bluesky-client-metadata.json');
    expect(CLIENT_ID).toBe(file.client_id);
  });

  it('is a public phone app that proves itself with a key made on the phone, and has no secret', () => {
    expect(file.application_type).toBe('native');
    expect(file.token_endpoint_auth_method).toBe('none');
    expect(file.dpop_bound_access_tokens).toBe(true);
    expect(file.response_types).toEqual(['code']);
    expect(Object.keys(file).some((k) => /secret|jwks|private/i.test(k))).toBe(false);
  });

  it('comes back to the app through a link made of its own address read backwards, with one slash', () => {
    const host = new URL(file.client_id).hostname;
    const scheme = host.split('.').reverse().join('.');
    expect(file.redirect_uris).toEqual([REDIRECT_URI]);
    expect(REDIRECT_URI).toBe(`${scheme}:/oauth/bluesky`);
    expect(REDIRECT_URI).not.toContain('://');
  });

  it('lists every scope the app can ask for, and the base scope, and never access to the whole account', () => {
    const scopes: string[] = file.scope.split(' ');
    expect(new Set(scopes)).toEqual(new Set(ALL_SCOPES));
    expect(scopes).toContain('atproto');
    expect(file.scope).not.toContain('transition:');
  });

  it('uses the same scheme as the app registers', () => {
    // app.config.ts holds the scheme; it is the redirect without the path.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('../../app.config').default;
    expect(config.scheme).toBe(REDIRECT_URI.split(':')[0]);
  });
});
