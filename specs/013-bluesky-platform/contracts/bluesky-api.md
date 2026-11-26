# Contract: Bluesky API

Every Bluesky call the app makes, in `src/api/bluesky.ts` (reads and writes) and `src/auth/bluesky.ts` (lookup and sign-in). Public reads use plain `fetch` with no token. Signed-in calls go through the OAuth session's DPoP-bound `fetchHandler`. Research R5 to R9.

## Hosts

| Host | Calls |
| --- | --- |
| `public.api.bsky.app` | `resolveHandle`, `getProfile`, `getProfiles`, `getFollows`, `getLists`, `getList`, `getFeedGenerators` |
| `plc.directory` | DID document (the account's server) |
| `*.host.bsky.network` (the account's server, checked) | `listRecords` (public), `createRecord`, `getPreferences`, `putPreferences`, and `getMutes` and `muteActor` passed on to the app view |
| `bsky.social` | Sign-in server: metadata, PAR, authorize page (in the browser), token, revoke |
| `cdn.bsky.app` | Pictures |

Any other host in an answer (a picture URL, a server endpoint, an issuer) is dropped or refused.

## Lookup (no token)

| Step | Call | Checks |
| --- | --- | --- |
| Handle to DID | `GET public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=` | 400 = not found. `did` starts with `did:plc:`. |
| DID to server | `GET plc.directory/<did>` | `service` with id `#atproto_pds`, type `AtprotoPersonalDataServer`, HTTPS, host ends in `.host.bsky.network`. Else "not supported" (FR-BS-022). |
| Profile | `GET public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=<did>` | `did` matches. Labels `!takedown` or a deactivated account: "This account can't be read right now." |

## Read the old account

See research R7 for the calls. All are paged with `cursor` until there is none, 100 per page (25 for `getProfiles`). Each page's shape is checked; a bad page fails that kind only (`missing`), as for GitHub.

## Check the new account

Research R9. Follows and blocks are public reads. Mutes and feeds need the matching scope; a kind without it is not checked (it is greyed).

## Writes

All on the account's server, with the session. `repo` is the new account's DID. Research R8.

| Kind | Request |
| --- | --- |
| person | `POST /xrpc/com.atproto.repo.createRecord` `{ repo, collection: "app.bsky.graph.follow", record: { $type, subject, createdAt } }` |
| block | Same, `app.bsky.graph.block` |
| list | `createRecord` `app.bsky.graph.list` `{ $type, purpose, name, description, createdAt }` (skipped when reused), then `createRecord` `app.bsky.graph.listitem` `{ $type, subject, list, createdAt }` per missing member, each after `pacer.beforeAdd()` |
| mute | `POST /xrpc/app.bsky.graph.muteActor` `{ actor }`, header `atproto-proxy: did:web:api.bsky.app#bsky_appview` |
| feed | `GET /xrpc/app.bsky.actor.getPreferences`, then `POST /xrpc/app.bsky.actor.putPreferences` with the same list plus the feed in `savedFeedsPrefV2` |

## Answer to outcome

`add` maps every answer to an `Outcome` (platform driver contract). Bluesky errors have a JSON body `{ error, message }`; only `error` is read, never shown.

| Answer | Outcome | Row text or notice |
| --- | --- | --- |
| 200 | `moved` | Moved (a list may add "N left out") |
| No answer (network) | `retry` | Mover handles it |
| 401, or the session cannot refresh (`TokenRefreshError`, `TokenRevokedError`, `TokenInvalidError`) | `auth` | Mover saves; To shows signed out |
| 429 with `ratelimit-reset` 60 seconds or less away | `wait` with that time | None |
| 429, reset later or missing | `later` at reset, or 1 hour | "Later" rows, limit reason (spec 009) |
| 400 `AccountTakedown`, `AccountDeactivated`, `RepoTakendown`, `RepoDeactivated` | `stop` | "Bluesky paused your account's activity. Try again later." |
| 400 `InvalidRecord`, `InvalidRequest` | `couldnt_move` | "Bluesky didn't allow this one." |
| 403 (scope missing) | `couldnt_move` | "Magpie doesn't have access for this." The kind stays greyed next time (granted is re-read). |
| 404 `NotFound` on `muteActor` | `couldnt_move` | "Account was deleted." |
| 5xx | `retry` | Mover handles it |

A second 429 for the same item, after a `wait`, becomes `later` (FR-BS-012). The mover already handles this: the driver returns `later` when its own count of waits for the item is 1.

## Sign-in

| Step | What the app checks |
| --- | --- |
| Before | Lookup above passed. The role's expected DID is known. |
| `client.authorize(handle, { scope, redirect_uri })` | Scope is the subset for the role and the picked kinds (research R6). The client sets `login_hint` from the handle, so Bluesky's page asks for that account even when the browser remembers another. |
| `openAuthSessionAsync(url, redirect, { preferEphemeralSession: true })` | `cancel` or `dismiss`: `{ ok: false, reason: 'cancelled' }`. |
| `client.callback(params)` | The client checks `state` and `iss` and the DPoP binding. The app checks: `session.did` is a `did:plc:` on a Bluesky host; issuer is `https://bsky.social`; for "Allow" on old kinds, `session.did` is the old DID. Else revoke and refuse. |
| Account | `getProfile` for `session.did`, as in Lookup. |

`signOut` calls `session.signOut()` (revoke), then deletes the stored session in `finally`. It returns `false` when the revoke call failed. The driver's `signOut` and `endMove` always return `false`, because the access token outlives the revoke (FR-BS-013).
