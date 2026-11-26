# Research: Bluesky Platform

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-23

Sources checked on 2026-11-23: [OAuth for AT Protocol](https://atproto.com/guides/oauth), [OAuth scopes](https://atproto.com/guides/scopes), [atproto OAuth spec](https://atproto.com/specs/oauth), [Bluesky OAuth client guide](https://docs.bsky.app/docs/advanced-guides/oauth-client), [Bluesky rate limits](https://docs.bsky.app/docs/advanced-guides/rate-limits), and the published npm packages `@atproto/oauth-client` 0.9.6 and `@atproto/oauth-client-expo` 0.2.14 (source read from the package tarballs).

## R1. Sign-in library

**Decision**: Use Bluesky's official base client `@atproto/oauth-client`, with Magpie's own small runtime (key and hash functions) and its own session store in `expo-secure-store`. Open the sign-in page with `expo-web-browser` (`openAuthSessionAsync`). Do not use `@atproto/oauth-client-expo`.

**Rationale**:

- atproto OAuth needs PAR, PKCE, DPoP proofs signed with an ES256 key, DPoP nonce handling, token refresh, and revocation. Writing that by hand is a lot of security-sensitive code. The base client does all of it and is maintained by Bluesky.
- `@atproto/oauth-client-expo` would be the shortest path, but its source shows it saves the session (access token, refresh token, and the DPoP private key) in `react-native-mmkv`, a plain file store, and its options type removes `sessionStore`, so it cannot be changed. That breaks Principle III, rule 3 ("never store tokens in ... files"). Its key class is not exported (the package `exports` map has only `.`), so it cannot be reused alone.
- The base client takes a `runtimeImplementation` (create a key, random bytes, SHA-256) and any `sessionStore` and `stateStore`. That is the documented plug point, so Magpie supplies its own without patching the library.

**Alternatives considered**:

| Option | Why not |
| --- | --- |
| `@atproto/oauth-client-expo` | Tokens and the DPoP private key land in MMKV files (III.3). It also adds `react-native-mmkv` as a native dependency the app would not otherwise need. |
| Own OAuth code on `fetch` | Rebuilds PAR, DPoP, nonces, refresh, and revocation. More code and more risk than the base client. |
| App passwords | Full account access, typed into the app. Forbidden by the spec and by III.2 (never collect passwords). |

## R2. Keys and hashes on the phone

**Decision**: The runtime uses `@noble/curves` (P-256) to make and sign with the ES256 DPoP key, `@noble/hashes` for SHA-256, and `expo-crypto` (`getRandomValues`) for random bytes. A `NobleKey` class extends `Key` from `@atproto/oauth-client` and implements `createJwt`. `verifyJwt` is not needed by a public client and throws.

**Rationale**: Hermes has no WebCrypto `subtle`, so the `jose`-based key classes do not run. The noble libraries are pure TypeScript, audited, widely used, and have no native code. `expo-crypto` is an Expo SDK module.

**Alternatives considered**: a native module for ES256 (more native code to own); `react-native-quick-crypto` (large native dependency for one curve).

**Polyfills**: the base client needs `URL` with `searchParams` and `Symbol.asyncDispose`. The Expo client's own polyfill file shows the two it needs: `react-native-url-polyfill/auto` and `core-js/proposals/explicit-resource-management`. They are imported once, in the Bluesky auth module, not app-wide.

## R3. Where tokens and keys live

**Decision**:

| What | Where | When it is deleted |
| --- | --- | --- |
| New account session (access token, refresh token, DPoP private key) | `expo-secure-store`, one key per account: `bluesky.session.<did>` | At the summary, on Sign out, on Delete all, and when "Don't save" deletes the progress. Revoked on Bluesky first. |
| Old account session (only after "Allow", FR-BS-020) | Memory only | Revoked and dropped as soon as mutes and saved feeds are read. |
| Sign-in state (PKCE verifier, DPoP key during sign-in) | Memory only, 10 minutes | When sign-in ends or is cancelled. |
| Caches (handle, DID, server metadata, DPoP nonce) | Memory only | When the app closes. |

The session store knows which DID is the old account (the flow resolved it from the handle before sign-in), so the old account's session never reaches secure storage.

**Size check**: iOS secure storage may reject values over about 2 KB. A Bluesky session with granular scopes is close to that. The store splits the value into the key part and the token part under two secure-store keys if the joined value is over 2,000 bytes, and the Check (R11) measures a real session.

**Rationale**: III.3. The refresh token must be kept for the new account while a move is unfinished, because Continue must work without a new sign-in (`resumesNew`, as for GitHub).

## R4. Revocation (FR-BS-013)

**Decision**: Sign out calls the client's `session.signOut()`, which calls the sign-in server's revocation endpoint, then deletes the secure-store keys in a `finally`, so the phone is clean even when the call fails. When the call fails, the driver reports it and the step shows one line: "Magpie's access ends on its own soon." (`words.accessNote`). There is no remove-access page link, because Bluesky's web app has no page for one app's access that the docs name.

**Status**: failed for the access token (R11 results, 2026-11-26). The refresh token is refused after sign-out, but the access token still works. Work stops until the owner decides (Clarifications, 2026-11-23).

## R5. Finding accounts and keeping the host list (FR-BS-005, FR-BS-022)

**Decision**: Before any read or sign-in, the driver resolves the handle itself:

1. Clean the input: trim, drop a leading `@`, lower case, add `.bsky.social` when there is no dot.
2. `com.atproto.identity.resolveHandle` on `public.api.bsky.app` gives the DID. Unknown handle: "We can't find that account. Check the name."
3. The DID must start with `did:plc:`. Otherwise: "Magpie works only with accounts hosted by Bluesky for now."
4. `plc.directory/<did>` gives the account's server. Its host must end in `.host.bsky.network`. Otherwise the same message.
5. `app.bsky.actor.getProfile` gives the display name and picture.

The OAuth client is built with `handleResolver: 'https://public.api.bsky.app'` and `plcDirectoryUrl: 'https://plc.directory'`, and `signIn` is called with the DID, not the handle (with the handle as `login_hint`), so the library never resolves a handle through DNS or a personal website. After sign-in, the session's issuer MUST be `https://bsky.social`; any other issuer is revoked and refused.

**Rationale**: this keeps every call on the hosts in the spec. Personal domain handles still work, because step 2 resolves them through Bluesky's server, not through the domain.

## R6. Granular scopes per kind

**Decision**: every sign-in asks for `atproto` plus the scopes of the kinds that need them. The mapping lives in one table in `src/auth/bluesky.ts`.

| Kind | New account | Old account, after "Allow" |
| --- | --- | --- |
| person | `repo:app.bsky.graph.follow?action=create` | none |
| block | `repo:app.bsky.graph.block?action=create` | none |
| list | `repo:app.bsky.graph.list?action=create repo:app.bsky.graph.listitem?action=create` | none |
| mute | `rpc:app.bsky.graph.muteActor?aud=did:web:api.bsky.app%23bsky_appview rpc:app.bsky.graph.getMutes?aud=did:web:api.bsky.app%23bsky_appview` | `rpc:app.bsky.graph.getMutes?aud=did:web:api.bsky.app%23bsky_appview` |
| feed | `rpc:app.bsky.actor.getPreferences?aud=did:web:api.bsky.app%23bsky_appview rpc:app.bsky.actor.putPreferences?aud=did:web:api.bsky.app%23bsky_appview` | `rpc:app.bsky.actor.getPreferences?aud=did:web:api.bsky.app%23bsky_appview` |

The client metadata file lists the union of all of them in `scope`, because a sign-in may ask only for scopes the metadata declares. Each sign-in asks for a subset.

The session answer lists the scopes the user actually granted. `granted()` maps them back to kinds, as GitHub's driver does.

**Open in the Check (R11)**: the preferences calls are answered by the account's own server, not proxied to the app view. The Check MUST confirm which `aud` the server accepts for them. If the app view `aud` is refused, the fallback is `aud=*` for those two scopes only, which the spec allows.

## R7. Reading the old account

**Decision**:

| Kind | Call | Host | Order |
| --- | --- | --- | --- |
| person | `app.bsky.graph.getFollows?actor=<did>&limit=100`, paged | `public.api.bsky.app` | Newest first; the driver numbers them so the oldest has the lowest number |
| block | `com.atproto.repo.listRecords?repo=<did>&collection=app.bsky.graph.block&limit=100&reverse=true`, paged; names from `app.bsky.actor.getProfiles` (25 per call) | account's server, then `public.api.bsky.app` | Oldest first |
| list | `app.bsky.graph.getLists?actor=<did>&purposes=curatelist&purposes=modlist`, then `app.bsky.graph.getList?list=<uri>` per list for members, paged | `public.api.bsky.app` | Oldest first by `indexedAt` |
| mute | `app.bsky.graph.getMutes`, paged, through the old session | account's server (passed on to the app view) | Newest first, numbered as for follows |
| feed | `app.bsky.actor.getPreferences`, the `savedFeedsPrefV2` item, through the old session; names from `app.bsky.feed.getFeedGenerators` and `app.bsky.graph.getList` | account's server, then `public.api.bsky.app` | The saved order |

Blocks use the public record list on the account's server because `app.bsky.graph.getBlocks` needs the account's own sign-in. Saved feeds of type `timeline` are skipped (the new account always has it). Accounts the app view no longer knows (deleted or suspended) are left out of every list.

**Logged-out visibility**: an account that chose "Discourage apps from showing my account to logged-out users" still has public records. The Check (R11) MUST confirm that `getFollows` and `getLists` answer for such an account. If they refuse, From shows "This account hides its lists from apps. Sign in to read them." and the read uses an old-account sign-in with the base `atproto` scope only.

## R8. Writing to the new account

**Decision**: all writes go through the session's DPoP-bound `fetchHandler` to the account's server.

| Kind | Call |
| --- | --- |
| person | `com.atproto.repo.createRecord`, collection `app.bsky.graph.follow`, record `{ subject: did, createdAt: now }` |
| block | same, collection `app.bsky.graph.block` |
| list | `createRecord` `app.bsky.graph.list` `{ purpose, name, description, createdAt }` unless a list with the same name and purpose exists; then one `createRecord` `app.bsky.graph.listitem` `{ subject, list: uri, createdAt }` per missing member, each paced |
| mute | `app.bsky.graph.muteActor` `{ actor: did }` with header `atproto-proxy: did:web:api.bsky.app#bsky_appview` |
| feed | `getPreferences`, add the feed to `savedFeedsPrefV2.items` (same `type`, `value`, `pinned`, a new `id`), `putPreferences` with every other preference unchanged |

`createRecord` does not refuse a second follow of the same person. The "Already there" check before the move (R9) and `recoverInterrupted` after a crash keep the app from writing twice.

Feeds are written one at a time, each with a fresh read just before the write (FR-BS-021). Pinned feeds keep the old account's pin order and go after the new account's own pinned feeds.

**Answer to outcome**: [contracts/bluesky-api.md](contracts/bluesky-api.md).

## R9. "Already there"

**Decision**: `checkNew` reads, for the new account: follows (`getFollows`, public), blocks (`listRecords`, public), mutes (`getMutes`, needs the mute scope), saved feeds (`getPreferences`, needs the feed scope). A follow or block of the new account itself counts as there. Lists are never "Already there": a list with the same name and purpose is reused and gets only the missing members (FR-BS-018).

**Spec alignment**: the spec's edge case asked that a block of the new account say "This is your new account". It now shows "Already there", the same as a follow of the new account, so no new row state is needed. The spec edge case is updated.

## R10. Pace (FR-BS-010)

**Decision**: one shared pacer, configured per driver: 120 ms apart (500 per minute), 1,500 per hour, 10,000 per day for Bluesky; GitHub keeps 3 seconds and 300 per hour with no daily cap. The add log gets a `keep_until` column so each platform's entries are deleted on time: 1 hour for GitHub (FR-GH-014), 1 day for Bluesky (FR-BS-014).

**Rationale**: the pacer today has GitHub's numbers as constants and ignores `driver.pace`. Making it read `driver.pace` is the change the second paced platform needs; there is no second pacer.

Bluesky publishes no per-minute limit, and the owner chose speed (spec Clarifications, 2026-11-24). 100 follows take about 12 seconds. 1,500 adds an hour use 4,500 of Bluesky's 5,000 hourly points, and 10,000 a day use 30,000 of 35,000, which leaves room for the user's own posts. The hourly cap is what a large move hits: 1,500 adds take about 3 minutes, then the move waits for the hour to pass. Risk: a burst of follows on a new account may trip Bluesky's spam checks; the `stop` outcome covers it, and the numbers live in the driver if they need to come down.

**Bluesky's wait answer**: 429 with `ratelimit-reset` (seconds since 1970). Up to 60 seconds away: `wait`. Later: `later` at that time.

## R11. The Check before Part B

Like GitHub's access check, a short check with two real Bluesky-hosted test accounts runs before any sign-in code is built on it. It is a Node script, `specs/013-bluesky-platform/check-access.mjs`, using `@atproto/oauth-client-node` as a loopback development client (`client_id` on `http://localhost`, no hosted metadata needed). The owner runs it on their own machine.

It MUST answer:

1. Granular scopes: sign in with only `atproto repo:app.bsky.graph.follow?action=create` and confirm a follow works and a block is refused.
2. Revocation: after `signOut()`, both the access token and the refresh token are refused.
3. Preferences `aud`: which `aud` the server accepts for `getPreferences` and `putPreferences` (R6).
4. Logged-out visibility: `getFollows` and `getLists` answer for an account with the setting on (R7).
5. Session size: the stored session's length in bytes (R3).

Results are recorded in this file under R11. Items 1 and 2 block Part B. Items 3 to 5 change only the details named in R3, R6, and R7.

### R11 results

Run on 2026-11-26 with two Bluesky-hosted test accounts.

| # | Result | Detail |
| --- | --- | --- |
| 1 | PASS | Narrow scope: follow 200, block 403. |
| 2 | FAIL | After `signOut()` the refresh token is refused ("Invalid refresh token"), but the access token still works (`getSession` answers 200). The run did not measure how long it keeps working. |
| 3 | PASS | `get` and `put` of preferences work with `aud=did:web:api.bsky.app#bsky_appview` and with `aud=*`. The scopes in R6 stay as they are; the `aud=*` fallback is not needed. |
| 4 | Not run | No account with the logged-out setting on was given (`--hidden`). |
| 5 | NOTE | The stored session is 1,340 bytes, under the 2,000 split limit in R3. The script asked for the follow scope only, so a session with more scopes is larger. |

## R12. Client metadata and the redirect

**Decision**: the client metadata file is `docs/oauth/bluesky-client-metadata.json` in this repository, served by GitHub Pages at `https://dodo-tech-hub.github.io/magpie/oauth/bluesky-client-metadata.json`. That URL is the `client_id`. The redirect is `io.github.dodo-tech-hub:/oauth/bluesky` (the reverse of the host, one slash). `app.config.ts` registers the scheme `io.github.dodo-tech-hub`.

```json
{
  "client_id": "https://dodo-tech-hub.github.io/magpie/oauth/bluesky-client-metadata.json",
  "client_name": "Magpie",
  "client_uri": "https://dodo-tech-hub.github.io/magpie/",
  "redirect_uris": ["io.github.dodo-tech-hub:/oauth/bluesky"],
  "scope": "atproto <every scope in R6>",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "application_type": "native",
  "dpop_bound_access_tokens": true
}
```

The app ships the same values in code (the client needs them) and a unit test checks they match the file. Bluesky's sign-in server fetches the file; the app never does, so `dodo-tech-hub.github.io` is not on the app's host list.

**Deep link**: `openAuthSessionAsync` receives the redirect. The app handles no other route on that scheme and ignores any link that arrives outside a sign-in (III.8). The client checks `state` and `iss` (FR-BS-016).

**Browser**: iOS uses an ephemeral session (`preferEphemeralSession: true`), so each sign-in starts with no saved Bluesky login and the user picks the account on purpose. Android Custom Tabs share the browser's login; `login_hint` sets the account, and the app refuses a wrong account after sign-in.

## R13. Driver additions

The platform driver ([008 contract](../008-github-platform/contracts/platform-driver.md)) gets four optional parts. Each is used by Bluesky and is a no-op for the others. The full contract change is in [contracts/platform-driver.md](contracts/platform-driver.md).

| Addition | Why | Who reads it |
| --- | --- | --- |
| `handleInput: true` and a `handle` argument to `signIn` | From and To take a typed handle (FR-BS-005, FR-BS-006). For the old role, `signIn` only looks the account up. | `AccountCard`, `flows.signInOld`, `flows.signInNew` |
| `kinds[].needsOld: true` | Mutes and Feeds need an old account sign-in (FR-BS-020). Pick shows them greyed with "Allow" until read. | `PickStep`, `flows.allowOld` |
| `moveOrder` per item: `itemOrder(a, b)` | Oldest first within a kind (FR-BS-010). | `mover` |
| `pace.perDay` and `pace.gapMs` | Bluesky's numbers (R10). | `pacer`, `PickStep` time left |

`signOut` and `endMove` return `false` when the platform could not cancel the access; the flow then shows `words.accessNote` (R4).

## R14. Logo and icon

**Decision**: the official Bluesky butterfly from Bluesky's press kit, unmodified, as `assets/platforms/bluesky.png`. The sign-in button uses Ionicons `logo-bluesky` if the installed `@expo/vector-icons` has it, else `log-in-outline`. The owner adds the logo file, as for GitHub.
