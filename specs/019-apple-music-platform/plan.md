# Implementation Plan: Apple Music Platform

**Branch**: `feature/apple-music-platform` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/019-apple-music-platform/spec.md`

## Summary

Add Apple Music as the third Automatic platform, on iOS only: move library songs, albums, own playlists, added Apple playlists, and (if Apple allows) favorite artists from an old Apple Account to a new one, through the same From, Pick, To flow as YouTube and GitHub.

The platform driver from spec 008 already makes the flow platform-neutral, so no restructure is needed. The work has two parts with an owner check between them.

| Step | What | Needs | Ships as |
| --- | --- | --- | --- |
| Owner | Developer Program, MusicKit key, developer token, test accounts, logo (quickstart, "Before you start"). Approve the four exceptions in Complexity Tracking. | Owner | Nothing in the repository |
| Part A | Sign-in bridge page, developer token script, web sign-in in the app, the bare driver that signs in and reads the storefront. | Owner steps | Its own pull request |
| Check | Owner runs the access check ([quickstart.md](quickstart.md), step 0). | Part A on a dev build | Result written in research R1 |
| Part B | Read, check, add, playlists with resume, pace, words, logo, limits page, iOS-only entry. | Check passed | One or more pull requests |

Technical approach:

- **Sign-in** (research R2, [contracts/sign-in-bridge.md](contracts/sign-in-bridge.md)): a static page on the existing GitHub Pages site runs Apple's MusicKit JS. The app opens it in the iOS system auth browser (`expo-web-browser`, ephemeral session) with the developer token and a random `state` in the URL fragment. The page redirects to `magpie://apple-music` with the music user token. The app checks `state` and the token before use. An ephemeral session per sign-in means the old account is never remembered, so the To step simply signs in again (FR-AM-006).
- **Developer token** (R3): signed by the owner on their machine with `scripts/apple-music-token.mjs`, valid 180 days, in the local `.env`. The private key never enters the repository or the app.
- **Account** (R4): Apple gives no account ID, so the driver uses a fingerprint of library IDs and refuses a new account that shares library IDs with the old one.
- **Driver** ([contracts/platform-driver.md](contracts/platform-driver.md)): `src/platforms/appleMusicDriver.ts` with four kinds. Two small, optional contract additions: a `save(data)` callback on `add` for playlist resume, and the pacer reads its numbers from `driver.pace`.
- **Move** ([contracts/apple-music-api.md](contracts/apple-music-api.md)): one call per song, album, artist, or shared playlist. Own playlists: create, save the new ID, add songs in chunks of 100, save the count after each chunk (FR-AM-011). Region lookups in `checkNew` mark songs not sold in the new region.
- **iOS only** (R10): the platform entry is `ready: Platform.OS === 'ios'`. Nothing else checks the OS.

## Technical Context

**Language/Version**: TypeScript (strict), React Native 0.88 via Expo SDK 58 (unchanged). The bridge page is plain HTML and JavaScript.

**Primary Dependencies**: Two added, both Expo SDK modules: `expo-web-browser` (system auth browser, Principle III, rule 2) and `expo-crypto` (random `state`, SHA-256 fingerprint). Already installed: `expo-secure-store`. `fetch` for all calls. MusicKit JS loads in the browser page only, not in the app.

**Storage**: `expo-sqlite` schema version 2, unchanged (no migration). Two shared additions: `NewItem.reason` and `setItemData` ([data-model.md](data-model.md)). `expo-secure-store` for the new account's token.

**Testing**: Jest with `jest-expo` and React Native Testing Library. `fetch`, `expo-web-browser`, `expo-crypto`, and the secure store are mocked. The bridge page's callback rules are tested through the app's callback check. See "Tests".

**Target Platform**: iOS 16+ only for this feature. Android builds include the code but never show or run it.

**Project Type**: Mobile app (single Expo project, no backend) plus one static page on the existing GitHub Pages site.

**Performance Goals**: Reading 5,000 songs takes 50 requests. 500 songs, 50 albums, and 10 playlists of up to 120 songs move in about 10 minutes at 60 adds per minute (SC-001 counts taps, not time).

**Constraints**: At most 60 adds per minute and 3,000 per hour per new account (guessed, research R9). Hosts: `api.music.apple.com` and Apple artwork hosts from the app; `dodo-tech-hub.github.io`, `js-cdn.music.apple.com`, and Apple's sign-in hosts from the auth browser. No secret in the app. All text in `src/strings.ts`.

**Scale/Scope**: Part A: about 5 new files (page, script, auth module, token module, driver skeleton), 3 edited (`app.config.ts`, `platforms.ts`, `.env.example`), 4 test files. Part B: about 3 new files (API module, limits page, logo), about 6 edited (driver, mover, pacer, store, strings, platforms), about 6 test files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.7.0.

| Principle / rule | How the plan complies | Status |
| --- | --- | --- |
| I. New screen justified | No new screen. The sign-in sheet is Apple's page in the system browser. | Pass |
| I. Icons, labels, simple words | Sign-in button uses the `musical-notes` icon with "Sign in to Apple Music". Row reasons are the spec's plain words. | Pass |
| I. Accessibility | Existing rows, headings, and buttons. The bridge page has one labelled button and one heading. | Pass |
| I. Confirmations | None added. | Pass |
| II. Tests | Unit tests for the auth callback checks, token rules, fingerprint, API answer mapping, playlist resume, pacer numbers, and store additions. Component tests for sign-in, Pick, move, and the iOS-only card. No real Apple calls. | Pass |
| II. Tests check behavior | Each test checks what the user sees or a rule (same account refused, no second playlist, region skip). Mocked calls are asserted only where the call is the behavior (sheet opened with an ephemeral session, token deleted). | Pass |
| III.1 Least privilege | Apple Music has no scopes. Old token only reads and is never saved; new token only adds. **Exception needed** (Complexity Tracking). | Needs owner approval |
| III.2 Sign-in flow | Web sign-in in the system auth browser, never a WebView. The native SDK exists but signs in only the device's account; the owner chose web sign-in on 2026-11-23 (spec Clarifications). `state` and the token are checked before use. **Exception** to the order of preference, approved in the spec. | Pass with approved exception |
| III.3 Token storage | `expo-secure-store` only; old token in memory. Apple has no revoke API; `unauthorize()` is used if the check shows it ends the token. **Exception needed** if it does not. | Needs owner approval (conditional) |
| III.4 No secrets | The private key stays on the owner's machine. The signed developer token is public by Apple's design (MusicKit JS puts it in web pages) and comes from the local `.env`, never committed. | Pass |
| III.5 Network | App hosts: `api.music.apple.com`, Apple artwork hosts. Auth browser: the bridge page on `dodo-tech-hub.github.io`, Apple's MusicKit and sign-in hosts. The bridge page is static and the tokens stay in the fragment, so no user data reaches GitHub. Using the project's static site for a sign-in page is a new role for it. **Exception needed** (Complexity Tracking). | Needs owner approval |
| III.6 Data | Library IDs, names, artwork URLs, progress. Delete all removes everything. | Pass |
| III.7 Logging | The driver, auth module, and page log nothing about tokens, accounts, or items. | Pass |
| III.8 Untrusted input | Every API answer, the callback URL, and saved `data` JSON are shape-checked. A `magpie://` scheme is added, but no deep link listener; the callback comes back only through the auth session. | Pass |
| III.9, III.10 | No new permission. `allowBackup` stays `false`. | Pass |
| III.11 Dependencies | Two Expo SDK modules. Lockfile committed. | Pass |
| IV. One home per thing | Driver in `src/platforms/`, calls in `src/api/appleMusic.ts`, sign-in in `src/auth/appleMusic.ts`, tokens in `src/auth/appleMusicTokens.ts`. The page in `docs/` with the other site pages, the token script in `scripts/`. No new folder in `src/`. | Pass |
| IV. Extend, do not patch | No `if (platform === 'apple-music')` in shared code. The two contract additions are optional parameters every driver can use. | Pass |
| IV. Simplest solution first | `fetch`, Expo SDK modules, the existing pacer, store, and site. Shortcuts carry `// ponytail:`: the 180-day token baked into the build, guessed pace numbers, one add per song, the fingerprint. | Pass |
| IV. Restructure instead of forcing it | Not needed: the 008 driver covers it. | Pass |
| V. Platform rules | Official API and MusicKit JS only, unchanged. Free, no ads (FR-AM-017, rule added in 1.7.0). Official, unmodified mark. iOS only, per Apple terms 2.8. | Pass |
| VI. Adaptive layout | No new screen. Shared flow layout from spec 010. | Pass |

**Gate result (pre-research)**: Pass with one approved exception (III.2) and three open approvals (III.1, III.3 conditional, III.5). **Gate result (post-design)**: same. Part A MUST NOT merge until the owner approves the open exceptions or the constitution is amended.

## Project Structure

### Documentation (this feature)

```text
specs/019-apple-music-platform/
├── plan.md                      # This file
├── research.md                  # Phase 0 decisions, R1 is the access check gate
├── data-model.md                # Kinds, data shapes, tokens
├── quickstart.md                # Owner steps, access check, device checks
├── verify-access.sh             # The access check script
├── contracts/
│   ├── apple-music-api.md       # Every Apple Music call and answer mapping
│   ├── sign-in-bridge.md        # The bridge page and callback checks
│   └── platform-driver.md       # The two optional driver contract additions
├── checklists/
│   └── requirements.md          # From the specify step
└── tasks.md                     # From /speckit-tasks
```

### Source Code (repository root)

```text
app.config.ts                        # A: scheme 'magpie', expo-web-browser plugin if its docs need one
.env.example                         # A: EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN
scripts/apple-music-token.mjs        # A: new. Signs the developer token with node:crypto, 180 days
docs/apple-music/sign-in.html        # A: new. Bridge page (contracts/sign-in-bridge.md)
docs/limits/apple-music.md           # B: new. Limits page
assets/platforms/apple-music.png     # B: official mark from the owner
src/
├── api/appleMusic.ts                # B: new. Reads, region lookup, adds, answer-to-outcome table
├── auth/
│   ├── appleMusic.ts                # A: new. Open the bridge, check the callback, storefront check
│   └── appleMusicTokens.ts          # A: new. Old token in memory, new token in the secure store
├── move/
│   ├── mover.ts                     # B: passes save(data) to add
│   └── pacer.ts                     # B: reads perMinute and perHour from the driver's pace
├── platforms/
│   ├── driver.ts                    # B: optional save parameter on add
│   ├── appleMusicDriver.ts          # A: sign-in, fingerprint. B: kinds, listOld, checkNew, add, endMove
│   └── platforms.ts                 # A: entry, ready on iOS only
├── store/progressStore.ts           # B: NewItem.reason, setItemData
└── strings.ts                       # A: sign-in words. B: appleMusicWords, row reasons, kind headings
tests/
├── unit/                            # A: auth callback, tokens, fingerprint. B: api, driver, playlist resume, pacer, store
├── components/                      # A: sign-in on From and To. B: Pick, move, iOS-only card
└── mocks/                           # A: expoWebBrowser, expoCrypto
```

**Structure Decision**: Same single Expo project and folders. The bridge page lives in `docs/`, which GitHub Pages already serves; it is site content, not app code.

## Part A. Sign-in (before the access check)

1. `scripts/apple-music-token.mjs`: reads the `.p8`, signs `{ iss: teamId, iat, exp: iat + 180 days }` with header `{ alg: 'ES256', kid: keyId }` using `node:crypto`, prints the token. No dependency.
2. `docs/apple-music/sign-in.html`: per [contracts/sign-in-bridge.md](contracts/sign-in-bridge.md), including check mode.
3. `src/auth/appleMusic.ts`: build the URL, open `openAuthSessionAsync` with `preferEphemeralSession: true`, check the callback, return the user token. Abort dismisses the sheet.
4. `src/auth/appleMusicTokens.ts`: as GitHub's token module (memory for old, secure store for new, delete on the three moments).
5. `src/platforms/appleMusicDriver.ts`: `signIn` (storefront, fingerprint, same-account set), `signOut`, `canAct`, `granted`. Other functions throw "not ready" until Part B.
6. `platforms.ts` entry with `ready: false` until Part B is done, `app.config.ts` scheme, `.env.example`, sign-in words.

Done when: tests pass, and the owner can sign in on an iPhone dev build (check row 0).

## Part B. Moving (after the check)

1. Store additions and the optional `save` on `add`, with tests that YouTube and GitHub behave as before.
2. Pacer reads numbers from `driver.pace`; GitHub keeps 20 and 300.
3. `src/api/appleMusic.ts`: reads, region lookup, adds, the answer table.
4. Driver: kinds (artists only if the check passed), `listOld`, `checkNew`, `add` with playlist resume, `endMove`.
5. Words, headings, row reasons, limits page, logo, Settings "not made by or linked with Apple".
6. `ready: Platform.OS === 'ios'`.

Done when: the tests below pass and quickstart Part B checks 1 to 11 pass on an iPhone.

## Tests

| Area | Test | Kind |
| --- | --- | --- |
| Callback | Wrong scheme, wrong `state`, `error=cancelled`, empty or long token, closed sheet: each gives the right result; ephemeral session asked | Unit |
| Tokens | Old token never reaches the secure store; new token deleted at summary, Sign out, Start again, Delete all | Unit |
| Fingerprint | Same library IDs refused; two empty libraries allowed; resume accepts a new account holding a moved item | Unit |
| Developer token script | Signs a token that verifies with the matching public key, `exp` is 180 days | Unit (Node) |
| API mapping | Paging with `next`, catalog ID from relation or `playParams`, uploaded song gets the reason, each row of the answer table | Unit |
| Region | IDs missing from the lookup give "Not available in your region" with no add call | Unit |
| Playlist resume | Stop after create: no second create. Stop after chunk 1 of 2: next add starts at song 101. Skipped region songs counted in the note | Unit |
| Pacer | Reads 60 and 3,000 from the Apple driver; GitHub numbers unchanged | Unit |
| Store | `reason` rows saved unpicked as `couldnt_move`; `setItemData` updates one row | Unit |
| Sign-in on the steps | Sheet opens, account card shows "Apple Music · <country>", same account refused on To | Component |
| Pick and move | Sections with counts, not-movable rows unpicked, rows change in place, playlist note | Component |
| iOS only | Android: no Apple Music card. iOS: card in Automatic | Component |
| YouTube, GitHub | All existing tests | Existing |

## What the project owner needs to do

1. Approve or refuse the exceptions in Complexity Tracking (III.1, III.3 if needed, III.5).
2. The steps in [quickstart.md](quickstart.md), "Before you start": Developer Program, MusicKit key, developer token in `.env`, test accounts, logo.
3. After Part A: run the access check (quickstart step 0) and paste the output in the pull request.
4. Every 6 months: make a new developer token and a new build (research R3).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| III.1: a music user token reads and writes the whole library of both accounts | Apple Music has no scopes. Safeguards: the old token is only used to read and never saved, the new token only adds, the driver never calls delete or change. **Needs owner approval.** | No narrower access exists. |
| III.2: web sign-in instead of the native SDK | The native SDK signs in only the device's Media & Purchases account, so the user would have to change it (spec Clarifications, 2026-11-23). Web sign-in still runs in the system browser, as rule 2 requires. **Approved by the owner on 2026-11-23.** | Native MusicKit: changes the device account, with purchase and 90-day switch risks. |
| III.3: token deleted but maybe not ended on Apple's side | Apple has no revoke API. If `unauthorize()` does not end the token (access check), it stays valid until it runs out, about 6 months. Safeguards: old token never saved, new token deleted at the summary, Sign out, Start again, and Delete all. **Needs owner approval if the check shows `unauthorize()` does not end it.** | A server to hold and revoke tokens breaks III.5. |
| III.5: the project's static site hosts a sign-in page | MusicKit JS needs an HTTPS web page, and rule 2 forbids a WebView. The page is static, loads only Apple's scripts, and keeps tokens in the URL fragment, so nothing reaches GitHub. Rule 5 names the static host for guide content only. **Needs owner approval, or a constitution amendment that names the sign-in page.** | Own backend breaks III.5. WebView breaks III.2. A page on a new host adds a host. |
