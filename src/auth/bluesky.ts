// The app's identity on Bluesky: its client ID is the address of the public file that describes it
// (docs/oauth/bluesky-client-metadata.json, served by GitHub Pages), and the sign-in comes back through a link that
// starts with the same address read backwards. Bluesky's server fetches the file; the app never does.
// A test checks that the file and these values match.
export const CLIENT_ID = 'https://dodo-tech-hub.github.io/magpie/oauth/bluesky-client-metadata.json';
export const REDIRECT_URI = 'io.github.dodo-tech-hub:/oauth/bluesky';

// What the Bluesky sign-in asks for, kind by kind (research R6, spec "Bluesky section"). Every sign-in includes the
// base scope `atproto`. Access to the whole account (`transition:generic`) is never asked.
//
// The `aud` is the service that answers the call for the account's server. Research R11 (the Check) confirms which
// `aud` the server accepts for the settings calls; if it must change, it changes in this one place.
const APPVIEW = 'did:web:api.bsky.app%23bsky_appview';
const rpc = (method: string) => `rpc:${method}?aud=${APPVIEW}`;
const create = (collection: string) => `repo:${collection}?action=create`;

// What the new account needs to take each kind.
const WRITE: Record<string, string[]> = {
  person: [create('app.bsky.graph.follow')],
  block: [create('app.bsky.graph.block')],
  list: [create('app.bsky.graph.list'), create('app.bsky.graph.listitem')],
  mute: [rpc('app.bsky.graph.muteActor'), rpc('app.bsky.graph.getMutes')],
  feed: [rpc('app.bsky.actor.getPreferences'), rpc('app.bsky.actor.putPreferences')],
};

// What the old account needs to read the kinds that are private. The others are public.
const READ: Record<string, string[]> = {
  mute: [rpc('app.bsky.graph.getMutes')],
  feed: [rpc('app.bsky.actor.getPreferences')],
};

// The scope string for a sign-in: the base scope plus the access of the kinds, each scope once.
export function scopesFor(role: 'old' | 'new', kinds: string[]): string {
  const table = role === 'old' ? READ : WRITE;
  return ['atproto', ...new Set(kinds.flatMap((k) => table[k] ?? []))].join(' ');
}

// Every scope the app can ask for. The client metadata file must list all of them, because a sign-in may only ask
// for scopes that the file declares.
export const ALL_SCOPES: string[] = [...new Set(['atproto', ...Object.values(WRITE).flat(), ...Object.values(READ).flat()])];

// The kinds a granted scope string covers. A kind counts only when every one of its scopes was granted, so a scope
// the user took away on Bluesky's page leaves the kind out.
// ponytail: compares the scope text as written, so if Bluesky returns the same permission in another form this
// reads fewer kinds. The Check (R11) shows what Bluesky returns; normalize here if it differs.
export function kindsOf(granted: string): string[] {
  const have = new Set(granted.split(' '));
  return Object.keys(WRITE).filter((kind) => WRITE[kind].every((s) => have.has(s)));
}

export const clientMetadata = {
  client_id: CLIENT_ID,
  client_name: 'Magpie',
  client_uri: 'https://dodo-tech-hub.github.io/magpie/',
  redirect_uris: [REDIRECT_URI],
  scope: ALL_SCOPES.join(' '),
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
  application_type: 'native',
  dpop_bound_access_tokens: true,
} as const;
