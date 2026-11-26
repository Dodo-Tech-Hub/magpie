# Implementation Plan: Bluesky Platform

**Branch**: `feature/bluesky-platform` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-bluesky-platform/spec.md`

## Summary

Add Bluesky as the third Automatic platform. It moves follows, blocks, lists, mutes, and saved feeds from an old account to a new one, through the same From, Pick, To flow as YouTube and GitHub, on top of the platform driver from spec 008.

| Step | What | Needs | Ships as |
| --- | --- | --- | --- |
| Check | Owner runs [check-access.mjs](check-access.mjs) with two test accounts: granular scopes, revocation, preferences `aud`, logged-out visibility, session size (research R11). | Two Bluesky-hosted test accounts | Results recorded in research R11 |
| Part A | Shared parts the driver needs: pacer reads `driver.pace` (with a daily cap), add log `keep_until` (store version 3), `itemOrder` in the mover, handle box on the account card, `needsOld` sections with "Allow" on Pick, `signOut` can report "not cancelled". YouTube and GitHub behave the same. | Nothing | Its own pull request |
| Part B | Bluesky: lookup, sign-in with Magpie's runtime and secure session store, reads, writes, driver, entry in the platform list, client metadata file, logo, texts, limits page. | Check items 1 and 2 pass, Part A merged | One pull request |

Technical approach:

- **Sign-in** (research R1 to R4, R12): Bluesky's official `@atproto/oauth-client` (PAR, PKCE, DPoP) with Magpie's own runtime (`@noble/curves` for the ES256 key, `expo-crypto` for random bytes) and a session store in `expo-secure-store`. The browser opens with `expo-web-browser`. The Expo variant of the client is not used: it saves tokens and the private key in MMKV files, which breaks III.3. Sign-out revokes, then deletes.
- **Accounts** (R5): the app resolves every handle itself through `public.api.bsky.app` and `plc.directory`, accepts only `did:plc` accounts on `*.host.bsky.network`, and passes the DID to the client, so no call leaves the host list.
- **Access** (R6): granular scopes per kind, built from one table. The old account needs no sign-in for follows, blocks, and lists. Mutes and saved feeds use an opt-in, read-only old sign-in, revoked right after the read.
- **Move** (R8 to R10): one `createRecord` per follow, block, list, and list member; `muteActor` per mute; read-then-write of preferences per feed. Oldest first within each kind. Up to 500 per minute, 1,500 per hour, 10,000 per day.

## Technical Context

**Language/Version**: TypeScript (strict), React Native 0.88 via Expo SDK 58 (unchanged)

**Primary Dependencies**: Added: `@atproto/oauth-client` (Bluesky's official OAuth client), `@noble/curves` and `@noble/hashes` (ES256 and SHA-256, pure TypeScript), `expo-web-browser` and `expo-crypto` (Expo SDK), `react-native-url-polyfill` (the client needs `URL.searchParams`). `core-js` comes with the client. Research R1, R2.

**Storage**: `expo-sqlite` store version 3 (`add_log.keep_until`). `expo-secure-store` for the new account's session. Memory for the old session, sign-in state, and caches.

**Testing**: Jest with `jest-expo` and React Native Testing Library. `fetch`, the OAuth client, `expo-web-browser`, `expo-crypto`, and the secure store are mocked. See "Tests".

**Target Platform**: Android 8.0+ first, iOS 16+. One URL scheme (`io.github.dodo-tech-hub`) for the sign-in return. No new permission.

**Project Type**: Mobile app (single Expo project, no backend)

**Performance Goals**: 100 follows move in about 12 seconds of adds (SC-001 allows 2 minutes with sign-in). A list of 10,000 follows reads in 100 pages. Sign-in returns to the app in one tap after Accept.

**Constraints**: Hosts: `public.api.bsky.app`, `plc.directory`, `*.host.bsky.network`, `bsky.social`, `cdn.bsky.app` (spec, Bluesky section). Pace in FR-BS-010. No client secret, no API key, no `.env` value. All text in `src/strings.ts`.

**Scale/Scope**: Part A: about 9 edited files, 1 migration, about 6 new or changed test files. Part B: about 7 new source files, 4 edited, 1 JSON file on the site, 1 limits page, 1 logo, about 10 new test files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.8.0.

| Principle / rule | How the plan complies | Status |
| --- | --- | --- |
| I. New screen justified | No new screen. The handle box sits in the From and To cards; "Allow" for old kinds is the same button as GitHub's (FR-BS-002). | Pass |
| I. Icons, labels, simple words | Sign-in button "Sign in with Bluesky" with `logo-bluesky` or `log-in-outline` (R14). The handle box has a label ("Bluesky handle") and an icon button. Texts are the spec's. | Pass |
| I. Accessibility | The handle box has an accessibility label and returns with the keyboard's Go key. Greyed sections say why. Every new button has a label. | Pass |
| I. Confirmations | None added. | Pass |
| II. Tests | Unit tests for lookup, scopes, session store, runtime key, reads, writes, answer mapping, pacer with a daily cap, migration 2 to 3, item order. Component tests for handle entry, Allow on old kinds, move, sign-out. No real Bluesky calls. | Pass |
| II. Tests check behavior | Each test checks what the user sees or a rule (host refusal, scope per kind, oldest first, other settings kept, token deleted). Mocked-call asserts only where the call is the behavior: revoke is called, the browser opens, the session is deleted. | Pass |
| III.1 Least privilege | No old sign-in for public kinds. Read-only scopes for the opt-in old sign-in. Granular create-only scopes per picked kind for the new account. Never `transition:generic`. `putPreferences` can change any setting: the spec names it, and the driver changes only saved feeds (FR-BS-021). | Pass |
| III.2 Sign-in flow | Authorization Code with PKCE (plus PAR and DPoP) in the system browser. Bluesky has no native SDK. `state`, `iss`, issuer host, and DID are checked (R5). | Pass |
| III.3 Token storage | New session in `expo-secure-store`; old session and sign-in state in memory. Kept after a move. Revoked and deleted on Sign out, on Delete all, and on "Don't save". The Check (2026-11-26) showed that the access token outlives revocation. Exception approved by the owner (FR-BS-013): the app cannot shorten the token's life, so it says access ends within an hour. | Pass, with an approved exception |
| III.4 No secrets | Public client: no secret, no key. The client ID is a public URL. | Pass |
| III.5 Network | Four hosts and one host range (`*.host.bsky.network`), listed in the spec and the API contract. v1.8.0 allows a range when a platform's account hosts cannot be listed one by one; the app checks every server host against the range before use and refuses any other. HTTPS only. The metadata host is read by Bluesky, not by the app. | Pass |
| III.6 Data | DID, handle, name, picture, item IDs, names, pictures, list members, progress, add times (1 day). Delete all removes all of it and the session. | Pass |
| III.7 Logging | The Bluesky modules log nothing. Mutes and feeds are never logged. | Pass |
| III.8 Untrusted input | Every answer is shape-checked; DIDs and at-uris match a pattern; picture URLs must be on `cdn.bsky.app`. The redirect route is the only deep link handled. | Pass |
| III.9, III.10 | No new permission. `allowBackup` stays `false`. | Pass |
| III.11 Dependencies | Two Expo SDK modules. `@atproto/oauth-client` is Bluesky's own, maintained. `@noble/*` are audited and widely used. `react-native-url-polyfill` is widely used. Lockfile committed; `npm audit` before release. | Pass |
| IV. One home per thing | `src/auth/bluesky.ts` (lookup, scopes, sign-in), `src/auth/blueskySession.ts` (stores), `src/auth/blueskyKey.ts` (runtime), `src/api/bluesky.ts` (reads, writes, answer mapping), `src/platforms/blueskyDriver.ts`. No new folder. | Pass |
| IV. Extend, do not patch | Four optional driver parts (R13), each a generic capability read by shared code. No `if (platform === 'bluesky')`. The pacer reads `driver.pace` instead of constants. | Pass |
| IV. Simplest solution first | The official client instead of own OAuth code. The Expo client is rejected for III.3, not for size. `oldRead` is session-only with a `// ponytail:` comment. Pace numbers are fixed with a `// ponytail:` comment. | Pass |
| IV. Restructure | Not needed: the driver from spec 008 takes Bluesky with optional additions. | Pass |
| V. Platform rules | Official API, far under Bluesky's limits, no scripted taps. Official, unmodified logo. | Pass |
| VI. Adaptive layout | No new screen. The handle box follows the default centered column, wraps at large text, and keeps its text across window changes (VI "Keep the user's place"). | Pass |

**Gate result (pre-research)**: Pass. **Gate result (post-design)**: Pass, with one item pending the Check: III.3 revocation (research R4, R11).

## Project Structure

### Documentation (this feature)

```text
specs/013-bluesky-platform/
├── plan.md                  # This file
├── research.md              # Phase 0 decisions, R11 is the Check
├── data-model.md            # Store version 3, Bluesky item data, sessions
├── quickstart.md            # How to check the result
├── check-access.mjs         # The Check (written in the first task)
├── contracts/
│   ├── platform-driver.md   # Driver additions
│   └── bluesky-api.md       # Every Bluesky call and how answers map to outcomes
├── checklists/
│   └── requirements.md      # From the specify step
└── tasks.md                 # From the tasks step
```

### Source Code (repository root)

```text
app.config.ts                    # B: scheme io.github.dodo-tech-hub
assets/platforms/bluesky.png     # B: official butterfly (owner adds)
docs/oauth/bluesky-client-metadata.json  # B: client metadata on GitHub Pages
docs/limits/bluesky.md           # B: limits page (spec 009)
src/
├── api/bluesky.ts               # B: new. Public reads, signed-in reads and writes, answer to outcome
├── auth/
│   ├── bluesky.ts               # B: new. Handle cleanup, lookup, host checks, scopes per kind, sign-in, sign-out
│   ├── blueskySession.ts        # B: new. Session store (secure store for new, memory for old), state store, caches
│   └── blueskyKey.ts            # B: new. Runtime: NobleKey, random bytes, SHA-256
├── move/
│   ├── mover.ts                 # A: itemOrder within a kind
│   └── pacer.ts                 # A: reads gapMs, perHour, perDay; timeLeft(adds, pace)
├── platforms/
│   ├── driver.ts                # A: optional handleInput, needsOld, itemOrder, perDay, gapMs, signOut false, new reasons
│   ├── githubDriver.ts          # A: pace as gapMs
│   ├── blueskyDriver.ts         # B: new
│   └── platforms.ts             # B: Bluesky entry after GitHub
├── state/
│   ├── AppState.tsx             # A: oldRead
│   └── flows.ts                 # A: handle passed to signIn, allowOld, access-not-cancelled line, new reasons
├── store/
│   ├── migrate.ts               # A: version 3
│   └── progressStore.ts         # A: recordAdd keepMs, prune by keep_until
├── strings.ts                   # A: reason texts, handle box. B: blueskyWords
└── ui/
    ├── AccountCard.tsx          # A: handle box when handleInput
    └── PickStep.tsx             # A: needsOld sections; time left from driver.pace
tests/
├── unit/                        # A: pacer daily cap, migration 2 to 3, mover itemOrder. B: blueskyAuth, blueskySession, blueskyKey, blueskyApi, blueskyDriver, metadata match
├── components/                  # A: handle box, needsOld section. B: blueskySignIn, blueskyPick, blueskyMove, blueskySignOut, blueskyWorld
└── mocks/                       # B: blueskyFetch, oauthClient, expoWebBrowser, expoCrypto
```

**Structure Decision**: Same single Expo project and folders. Bluesky's auth is split in three files because each has one job (Principle IV): lookup and sign-in, storage, and crypto.

## Part A. Shared parts (own change, no Bluesky yet)

Each step keeps the tests green.

1. `driver.ts`: the optional fields and reasons in [contracts/platform-driver.md](contracts/platform-driver.md). `pace.perMinute` becomes `gapMs`; GitHub's driver says `gapMs: 3000`.
2. Store version 3 and `recordAdd(accountKey, at, keepMs)` (data model).
3. `pacer.ts`: `createPacer(accountKey, pace)` reads `gapMs`, `perHour`, `perDay`; `later` is the latest of the hourly and daily times; `timeLeft(adds, pace)`. GitHub's numbers give the same answers as today.
4. `mover.ts`: sorts waiting items within each kind with `itemOrder` when given.
5. `AccountCard.tsx` and `flows.ts`: with `handleInput`, the card shows a handle box (keeps its text across window changes) and passes the handle to `signIn`. New reasons show their texts. `signOut` or `endMove` returning `false` sets the access-not-cancelled line.
6. `PickStep.tsx`, `AppState.tsx`, `flows.allowOld`: `needsOld` sections, "Allow" on them signs in to the old account, refuses another account, re-reads, saves, adds the kind to `oldRead`.

Done when: all existing tests pass unchanged except the `perMinute` rename, and the new Part A tests pass with a fake driver.

## Part B. Bluesky (after the Check and Part A)

1. `check-access.mjs` is written first and run by the owner (R11).
2. `blueskyKey.ts` and `blueskySession.ts` (R2, R3).
3. `auth/bluesky.ts`: lookup and host checks (R5), scopes (R6), sign-in and sign-out (R4, R12).
4. `api/bluesky.ts`: reads (R7), "Already there" (R9), writes (R8), answer mapping (contract).
5. `blueskyDriver.ts`, the platform entry, the logo, `blueskyWords`, "Magpie is not made by or linked with Bluesky." in Settings.
6. `docs/oauth/bluesky-client-metadata.json`, `docs/limits/bluesky.md`, the scheme in `app.config.ts`.

Done when: the Bluesky tests pass, all other tests pass, and quickstart rows 1 to 14 pass on an Android phone.

## Tests

| Area | Test | Kind |
| --- | --- | --- |
| Migration | Version 2 database opens as version 3; old add rows keep 1 hour | Unit |
| Pacer | 120 ms apart; 1,500 per hour; 10,000 per day gives `later` at the right time; GitHub numbers unchanged; time left | Unit |
| Mover | `itemOrder` sorts within a kind and keeps kind order | Unit |
| Handle cleanup | `@`, spaces, capitals, bare name gets `.bsky.social` | Unit |
| Lookup | Unknown handle, `did:web`, server off `*.host.bsky.network`, deactivated account, bad shapes | Unit |
| Scopes | Subset per role and picked kinds; old "Allow" read-only; never `transition:generic`; metadata file lists the union and matches the code | Unit |
| Session store | Old DID never reaches the secure store; split above 2,000 bytes; deleted even when revoke fails | Unit |
| Runtime key | A JWT signed by `NobleKey` verifies with the public key (test-only check with `@noble/curves`) | Unit |
| Reads | Paging, oldest-first `seq`, blocks from `listRecords`, deleted accounts left out, timeline feed skipped, bad page fails one kind | Unit |
| Writes | Each kind's request; list reuse adds only missing members; feeds keep pins and every other preference | Unit |
| Answer mapping | Each row of the contract table | Unit |
| Handle on From | No browser; account shows; Pick lists public kinds and greyed Mutes and Feeds; not found and not supported texts | Component |
| Sign-in on To | Browser opens with the handle; same account refused; cancel leaves it signed out | Component |
| Allow on old kinds | Old account only; rows come in picked; old session gone after the read | Component |
| Move | Rows change in place; oldest first; 429 wait and later; Continue moves the rest | Component |
| Sign-out | Revoke called and session deleted; offline revoke shows the access line; Delete all leaves nothing | Component |
| YouTube, GitHub | All existing tests | Existing |

## What the project owner needs to do

1. Run the Check (`node specs/013-bluesky-platform/check-access.mjs`) with two Bluesky-hosted test accounts once the first task writes it. Items 1 and 2 must pass.
2. Confirm that GitHub Pages serves `https://dodo-tech-hub.github.io/magpie/` from `docs/` on `main`, and will keep that URL. It becomes the app's ID on Bluesky.
3. Add the official Bluesky butterfly as `assets/platforms/bluesky.png` (Bluesky's press kit).
4. No `.env` value, no developer account, no app registration.

## Complexity Tracking

No constitution violations. One item is pending the Check: III.3 revocation (research R4). If the Check fails, Part B stops and the owner decides, as recorded in the spec's Clarifications.
