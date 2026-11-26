#!/usr/bin/env node
// The Check before Part B (specs/013-bluesky-platform/research.md, R11). Run by the project owner with two
// Bluesky-hosted test accounts. It is not part of the app and uses a loopback development client, so no
// hosted metadata file is needed. It prints one PASS, FAIL, or NOTE line per question.
//
//   cd specs/013-bluesky-platform && npm install
//   node check-access.mjs --old old.bsky.social --target new.bsky.social [--hidden hidden.bsky.social]
//
// --old     the account to sign in with (any test account; it follows --target once, and that follow stays)
// --target  a second test account, followed in question 1
// --hidden  optional: a test account with "Discourage apps from showing my account to logged-out users" on
//
// Nothing is saved to disk, and tokens are never printed.
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import { parseArgs } from 'node:util';
import { NodeOAuthClient } from '@atproto/oauth-client-node';
import { buildAtprotoLoopbackClientMetadata } from '@atproto/oauth-types';

const { values: args } = parseArgs({
  options: { old: { type: 'string' }, target: { type: 'string' }, hidden: { type: 'string' } },
});
if (!args.old || !args.target) {
  console.error('Usage: node check-access.mjs --old <handle> --target <handle> [--hidden <handle>]');
  process.exit(2);
}

const APPVIEW = 'did:web:api.bsky.app#bsky_appview';
const PUBLIC = 'https://public.api.bsky.app/xrpc';
const results = [];
const say = (status, question, detail = '') => {
  results.push(status);
  console.log(`${status.padEnd(4)} ${question}${detail ? ` - ${detail}` : ''}`);
};

// ---- A one-off sign-in in the browser, with the scope given -------------------------------------------

async function signIn(handle, scope) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const redirect = `http://127.0.0.1:${server.address().port}/callback`;
  const store = new Map();
  const sessions = new Map();
  const client = new NodeOAuthClient({
    clientMetadata: buildAtprotoLoopbackClientMetadata({ scope, redirect_uris: [redirect] }),
    stateStore: { set: async (k, v) => void store.set(k, v), get: async (k) => store.get(k), del: async (k) => void store.delete(k) },
    sessionStore: { set: async (k, v) => void sessions.set(k, v), get: async (k) => sessions.get(k), del: async (k) => void sessions.delete(k) },
  });
  const url = await client.authorize(handle, { scope });
  console.log(`\nOpen this page, sign in as ${handle}, and accept:\n${url}\n`);
  exec(`${process.platform === 'darwin' ? 'open' : 'xdg-open'} "${url}"`, () => {});
  const params = await new Promise((resolve) => {
    server.on('request', (req, res) => {
      res.end('You can close this tab and go back to the terminal.');
      resolve(new URL(req.url, redirect).searchParams);
    });
  });
  server.close();
  const { session } = await client.callback(params);
  return { client, session, sessions };
}

const call = (session, path, init) => session.fetchHandler(path, init);
const json = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function resolveDid(handle) {
  const res = await fetch(`${PUBLIC}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
  if (!res.ok) throw new Error(`Cannot resolve ${handle}`);
  return (await res.json()).did;
}

const target = await resolveDid(args.target);

// ---- 1 and 2: narrow scope, then revoke --------------------------------------------------------------

const narrow = 'atproto repo:app.bsky.graph.follow?action=create';
const one = await signIn(args.old, narrow);
const did = one.session.did;

const record = (collection) => json({ repo: did, collection, record: { $type: collection, subject: target, createdAt: new Date().toISOString() } });
const follow = await call(one.session, '/xrpc/com.atproto.repo.createRecord', record('app.bsky.graph.follow'));
const block = await call(one.session, '/xrpc/com.atproto.repo.createRecord', record('app.bsky.graph.block'));
say(follow.ok && !block.ok ? 'PASS' : 'FAIL', '1. Narrow scope: follow works, block is refused', `follow ${follow.status}, block ${block.status}`);

// 5. Size of what the app would store: the key, the token set, and the scope.
const stored = one.sessions.get(did);
const size = Buffer.byteLength(JSON.stringify(stored)); // the library's store already holds the key as dpopJwk
say('NOTE', '5. Stored session size', `${size} bytes${size > 2000 ? ' (over 2,000: the app must split it, research R3)' : ''}`);

// 2. Keep a copy, revoke, put the copy back, and try each token.
const copy = structuredClone(stored);
await one.session.signOut();
one.sessions.set(did, copy);
let accessRefused = false;
let accessWhy = '';
try {
  const again = await one.client.restore(did, false);
  const check = await call(again, '/xrpc/com.atproto.server.getSession');
  accessRefused = check.status === 401 || check.status === 400;
  accessWhy = `HTTP ${check.status}`;
} catch (error) {
  accessWhy = error.message;
  accessRefused = true;
}
one.sessions.set(did, copy);
let refreshRefused = false;
let refreshWhy = '';
try {
  await one.client.restore(did, true);
} catch (error) {
  refreshWhy = error.message;
  refreshRefused = true;
}
say(accessRefused && refreshRefused ? 'PASS' : 'FAIL', '2. Revoke: access and refresh token refused after sign-out', `access ${accessRefused ? 'refused' : 'STILL WORKS'} (${accessWhy}), refresh ${refreshRefused ? 'refused' : 'STILL WORKS'} (${refreshWhy})`);

// ---- 3: which aud the account's server accepts for preferences ---------------------------------------

for (const aud of [encodeURIComponent(APPVIEW), '*']) {
  const scope = `atproto rpc:app.bsky.actor.getPreferences?aud=${aud} rpc:app.bsky.actor.putPreferences?aud=${aud}`;
  try {
    const { session } = await signIn(args.old, scope);
    const headers = { 'atproto-proxy': APPVIEW };
    const read = await call(session, '/xrpc/app.bsky.actor.getPreferences', { headers });
    let wrote = false;
    if (read.ok) {
      const prefs = await read.json();
      const put = await call(session, '/xrpc/app.bsky.actor.putPreferences', { ...json({ preferences: prefs.preferences }), headers: { ...json({}).headers, ...headers } });
      wrote = put.ok;
    }
    say(read.ok && wrote ? 'PASS' : 'FAIL', `3. Preferences with aud=${decodeURIComponent(aud)}`, `get ${read.status}, put ${wrote ? 'ok' : 'refused'} (put wrote back the same preferences)`);
    await session.signOut();
  } catch (error) {
    say('FAIL', `3. Preferences with aud=${decodeURIComponent(aud)}`, `sign-in refused: ${error.message}`);
  }
}

// ---- 4: logged-out visibility -------------------------------------------------------------------------

if (args.hidden) {
  const hidden = await resolveDid(args.hidden);
  const follows = await fetch(`${PUBLIC}/app.bsky.graph.getFollows?actor=${hidden}&limit=1`);
  const lists = await fetch(`${PUBLIC}/app.bsky.graph.getLists?actor=${hidden}&limit=1`);
  say(follows.ok && lists.ok ? 'PASS' : 'FAIL', '4. Hidden-from-logged-out account is still readable', `getFollows ${follows.status}, getLists ${lists.status}`);
} else {
  say('NOTE', '4. Hidden-from-logged-out account', 'skipped, pass --hidden to run it');
}

const failed = results.filter((s) => s === 'FAIL').length;
console.log(`\n${failed === 0 ? 'No FAIL lines.' : `${failed} FAIL line(s).`} Record these lines in research.md, "R11 results". Questions 1 and 2 block Part B.`);
process.exit(failed === 0 ? 0 : 1);
