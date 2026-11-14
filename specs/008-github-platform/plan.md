# Implementation Plan: GitHub Platform

**Branch**: `feature/github-platform` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-github-platform/spec.md`

## Summary

Add GitHub as the second Automatic platform: move starred repositories, star lists, starred gists, and followed people from an old account to a new one, through the same From, Pick, To flow as YouTube.

The work has two parts and one check before Part B.

| Step | What | Needs | Ships as |
| --- | --- | --- | --- |
| Check | Owner creates the OAuth app and runs [verify-access.sh](verify-access.sh) to confirm star, follow, gist star, and star lists with the planned scopes. | Owner, 10 minutes | Result pasted in the pull request |
| Part A | Make the Automatic flow platform-neutral behind a platform driver. YouTube is the only driver. No behavior change. | Owner approval of the restructure (Principle IV) | Its own pull request, before Part B |
| Part B | Add the GitHub driver, the code sign-in, sections on Pick, the pacer, token handling, and the texts. | Check passed, Part A merged, one client ID | One or more pull requests |

**App type**: GitHub's docs show a GitHub App can star only repositories where it is installed, so the plan uses one classic OAuth app, approved by the owner on 2026-11-14 ([research.md](research.md), R1). The check confirms the one scope the docs do not name: `user` for star lists. Part A does not depend on it.

Technical approach:

- **Platform driver** ([contracts/platform-driver.md](contracts/platform-driver.md)): one object per platform with sign in, sign out, read old, check new, add one item, and words. `flows.ts`, `mover.ts`, the screens, and Settings stop importing Google and YouTube modules and call the driver of the open platform.
- **Store** ([data-model.md](data-model.md)): a version 1 schema with `platform` on `progress`, `kind`, `data`, and `reason` on items, the state `tomorrow` renamed `later`, a new state `not_available`, and a small `add_log` table for the pace. One migration, tested with a version 0 database.
- **Sign-in**: device code flow with no secret (R2). The old account asks for no scope. The new account asks only for the scopes of the picked kinds, never `gist`; an "Allow" button on a greyed kind signs in again for that scope too. The app reads the granted scopes from GitHub's answer. The driver calls back with the code; the account card shows it in place, copies it, and opens `github.com/login/device` in the browser. No new screen. After sign-in the driver reads `GET /user` and the flow refuses the same account on both steps (R4).
- **Tokens** (R5): old account token in memory, dropped after the read. New account token in `expo-secure-store`, deleted at the summary, on Switch, and on Delete all. Tokens run out 8 hours after sign-in ("Expire user access tokens" is on); the refresh token is never saved. The summary says access ends within 8 hours and shows a button to GitHub's page to remove it now.
- **Pick**: one section per kind with a heading, built as header rows in the existing list. A kind without a granted scope is greyed out with an "Allow" button. Private repositories show "Not available" (R7).
- **Move** ([contracts/github-api.md](contracts/github-api.md)): one REST call per star, follow, and gist; star lists through GraphQL, last, sending the union of list IDs so nothing on the new account is removed (R8). A pacer keeps 20 per minute and 300 per hour and turns GitHub's wait answers into a short sleep or "Later" with a reminder (R9).

## Technical Context

**Language/Version**: TypeScript (strict), React Native 0.88 via Expo SDK 58 (unchanged)

**Primary Dependencies**: Two added, both Expo SDK modules: `expo-secure-store` (token storage, required by Principle III, rule 3) and `expo-clipboard` (copy the sign-in code). `Linking` from React Native opens the browser. `fetch` for all calls, as today.

**Storage**: `expo-sqlite`, schema version 1 with a migration from today's schema. `expo-secure-store` for one GitHub token.

**Testing**: Jest with `jest-expo` and React Native Testing Library. `fetch`, the secure store, the clipboard, and `Linking` are mocked. See "Tests" below.

**Target Platform**: Android 8.0+ first, iOS 16+. No platform-specific behavior. No deep link, no URL scheme, no new permission.

**Project Type**: Mobile app (single Expo project, no backend)

**Performance Goals**: 50 items move in about 2.5 minutes at 3 seconds per item (SC-001 allows 5). A list of 1,000 stars loads in 10 requests. Sign-in ends within one poll interval (5 seconds) of the user's return.

**Constraints**: At most 20 adds per minute and 300 per hour per new account (FR-GH-010). Hosts: `github.com`, `api.github.com`, `avatars.githubusercontent.com`. No client secret. No refresh token saved. All text in `src/strings.ts`.

**Scale/Scope**: Part A: about 12 edited files, 2 new, 1 renamed, every existing test file touched for renames only. Part B: about 8 new files, about 8 edited, 1 logo asset, about 10 new test files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.5.0.

| Principle / rule | How the plan complies | Status |
| --- | --- | --- |
| I. New screen justified | No new screen. The sign-in code, the hint, "Allow", and the remove-access line show in place on existing steps (FR-GH-002). | Pass |
| I. Icons, labels, simple words | Sign-in button uses `logo-github` with "Sign in with GitHub". "Allow" uses `key-outline`. The remove-access button uses `open-outline`. Texts are the spec's. | Pass |
| I. Accessibility | The code is read letter by letter in its label. Section headings are headings. Greyed rows say why. Every new button has a label. | Pass |
| I. Confirmations | None added. | N/A |
| II. Tests | Unit tests for the driver, the pacer, the migration, and the mover. Component tests for the code sign-in, sections, gists, pause, and sign-out. No real GitHub calls. | Pass |
| II. Tests check behavior | Each test checks what the user sees or a business rule (pace, list union, scope per kind, migration). A test asserts a mocked call only where that call is the behavior itself: the browser opens, the token is saved or deleted. No coverage-only tests. | Pass |
| III.1 Least privilege | One classic OAuth app. No scope for the old account. Scopes per picked kind for the new account; `gist` only on request; the user can untick any scope. `public_repo`, `user`, and `gist` are broader than needed: **approved exception** (2026-11-14), listed below. | Pass with approved exception |
| III.2 Sign-in flow | Device code flow in the system browser. Native SDK does not exist; PKCE needs a secret (R2). Every value from the flow is checked before use. | Pass |
| III.3 Token storage | `expo-secure-store` only. Tokens cannot be cancelled without a secret, and run out after 8 hours: **approved exception** with safeguards (FR-GH-019), listed below. | Pass with approved exception |
| III.4 No secrets | One public client ID in `EXPO_PUBLIC_GITHUB_CLIENT_ID`. No secret is created. | Pass |
| III.5 Network | Three hosts, listed in the spec and above. HTTPS only. | Pass |
| III.6 Data | Account ID, username, picture, item IDs, names, pictures, progress, add times. Delete all removes all of it. | Pass |
| III.7 Logging | Drivers log nothing about accounts, codes, tokens, or items. | Pass |
| III.8 Untrusted input | Every GitHub answer and the saved `data` JSON are shape-checked before use. | Pass |
| III.9 to III.10 | No new permission. `allowBackup` stays `false`. | Pass |
| III.11 Dependencies | Two Expo SDK modules. Lockfile committed. | Pass |
| IV. One home per thing | Drivers in `src/platforms/`. GitHub calls in `src/api/github.ts`, sign-in in `src/auth/github.ts`, pacer in `src/move/`. No new folder. | Pass |
| IV. Extend, do not patch | No `if (platform === 'github')` in shared code. Shared code reads the driver. | Pass |
| IV. Simplest solution first | `fetch` and `Linking` (built in), `expo-secure-store` and `expo-clipboard` (Expo SDK, the first is required by III.3), no new HTTP, state, or navigation library. The driver has two real users (YouTube, GitHub), not a hypothetical one. Known shortcuts carry a `// ponytail:` comment: the pace numbers are fixed constants, and "Not available" uses only the `private` flag (R7). | Pass |
| IV. Restructure instead of forcing it | The feature reshapes many modules, so the restructure (Part A) is proposed here, is its own change, and is done and tested before Part B. **Needs owner approval.** | Pass once approved |
| V. Platform rules | Official API only. Pace far under GitHub's limits. No scripted taps. Official, unmodified logo. | Pass |

**Gate result (pre-research)**: Pass with approved exceptions. **Gate result (post-design)**: Pass with two approved exceptions, and two open items for the owner: approve the restructure, and run the access check.

## Project Structure

### Documentation (this feature)

```text
specs/008-github-platform/
├── plan.md                  # This file
├── research.md              # Phase 0 decisions, R1 is the app type
├── data-model.md            # Phase 1: store version 1, GitHub kinds, tokens
├── quickstart.md            # Phase 1: how to check the result
├── verify-access.sh         # The access check before Part B
├── contracts/
│   ├── platform-driver.md   # What every platform driver provides
│   └── github-api.md        # Every GitHub call and how answers map to row states
├── checklists/
│   └── requirements.md      # From the specify step
└── tasks.md                 # From /speckit-tasks (not created yet)
```

### Source Code (repository root)

```text
App.tsx                          # A: show the steps for any open platform
app.config.ts                    # B: expo-secure-store plugin
.env.example                     # B: GitHub client ID
assets/platforms/github.png      # B: official mark, from the owner
src/
├── api/
│   ├── youtube.ts               # A: Outcome and ApiError move to the driver contract
│   └── github.ts                # B: new. Read, add, answer-to-outcome table
├── auth/
│   ├── google.ts                # unchanged
│   ├── github.ts                # B: new. Device code sign-in, answer checks
│   └── githubTokens.ts          # B: new. Memory and secure-store token, granted scopes
├── move/
│   ├── mover.ts                 # A: takes add() and a pacer instead of YouTube calls
│   ├── pacer.ts                 # B: new. 20 per minute, 300 per hour, time left
│   └── quotaReset.ts            # unchanged
├── platforms/
│   ├── platforms.ts             # A: each entry gets its driver. B: GitHub entry
│   ├── driver.ts                # A: new. Driver, Outcome, Role types
│   ├── youtubeDriver.ts         # A: new. Wraps auth/google and api/youtube
│   └── githubDriver.ts          # B: new. Wraps auth/github, api/github, tokens
├── reminders/reminder.ts        # A: reminder text from the driver's words
├── state/
│   ├── AppState.tsx             # A: items, signInCode, granted
│   └── flows.ts                 # A: calls the driver. B: Allow sign-in, token drop at summary
├── store/progressStore.ts       # A: schema version 1, migration. B: add_log
├── strings.ts                   # A: words per platform. B: GitHub texts
└── ui/
    ├── AccountCard.tsx          # A: sign-in label and icon from words. B: code panel
    ├── ItemRow.tsx              # A: renamed from ChannelRow. B: reason, greyed rows
    ├── PickStep.tsx             # A: items. B: section headers, time left, Allow
    ├── FromStep.tsx, ToStep.tsx # A: handle instead of email. B: remove-access line
    └── SettingsView.tsx         # A: Delete all signs out of every driver
tests/
├── unit/                        # A: migration, youtubeDriver. B: github api, auth, tokens, pacer, driver
├── components/                  # B: githubSignIn, githubPick, githubMove, githubSignOut
└── mocks/                       # B: expoSecureStore, expoClipboard
```

**Structure Decision**: Same single Expo project and the same folders. No new folder: `src/platforms/` already owns "which platforms the app supports", so the drivers live there.

## Part A. Restructure (own change, YouTube only)

Order matters: each step keeps the tests green.

1. `src/platforms/driver.ts`: the types from the contract.
2. Store: version 1 schema, migration, `NewItem` and `StoredItem`, `handle`, `later`, `not_available`, `reason`. Old function names are renamed (`getChannels` to `getItems`, and so on).
3. `youtubeDriver.ts`: wraps the Google and YouTube modules. `add` returns `later` with a resume time.
4. `mover.ts`: takes `add` from the driver and an optional pacer. `wait`, `later`, and `stop` outcomes handled once here.
5. `flows.ts`, `App.tsx`, `SettingsView.tsx`, `reminder.ts`: use the driver of the open platform. `openProgress()` reads the platform from the saved progress.
6. Screens and `strings.ts`: `ChannelRow` becomes `ItemRow`; texts with "channel" or "Google" come from the driver's words. YouTube's words are today's texts, letter for letter.

Done when: every existing test passes with renames only, the migration test passes, and `grep -r "auth/google\|api/youtube" src` finds only `youtubeDriver.ts`.

## Part B. GitHub (after the check and Part A)

1. `auth/github.ts` and `auth/githubTokens.ts`: device code sign-in, checks, token rules (R2, R5).
2. `api/github.ts`: read calls, add calls, the answer-to-outcome table (R6, R8).
3. `move/pacer.ts` and `add_log` (R9).
4. `githubDriver.ts` and the entry in `platforms.ts`, the logo, the client ID.
5. Account card: code panel, copy, open browser, hint. Flow: same-account refusal, scopes per picked kind, "Allow" sign-in.
6. Pick: section headers, time left, "Allow" on kinds without a scope, "Not available", reasons on rows.
7. Token drop at the summary, the line that Magpie can still use the account with the remove-access button, Delete all.
8. Texts, including "Magpie is not made by or linked with GitHub" in Settings.

## Tests

| Area | Test | Kind |
| --- | --- | --- |
| Migration | Version 0 database opens as version 1 with the same data | Unit |
| Mover | `wait` sleeps and retries, `later` marks the rest and saves the time, `stop` saves and stops, pacer is asked before each add | Unit |
| Device sign-in | Pending, slow down, expired, denied, bad answer shapes, stops at expiry, scope per kind, granted scopes read from the answer | Unit |
| Tokens | Old token never reaches the secure store, deleted at each of the three moments, "Allow" keeps earlier scopes | Unit |
| GitHub calls | Paging, shape checks, each row of the answer-to-outcome table, list union never drops a list | Unit |
| Pacer | 3 seconds apart, 300 per hour, resume time, time-left text | Unit |
| Sign-in on the step | Code shown and copied, browser opened, hint on second sign-in, same account refused, code ran out | Component |
| Pick | Sections, one kind has no heading, search and All across sections, kinds without a scope greyed until allowed, gists never asked first, "Not available" | Component |
| Move | Rows change in place, pause shows "Later" and the break text, Continue moves only the rest, summary skips kinds without access | Component |
| Sign-out | Remove-access line and button, Delete all leaves no GitHub data | Component |
| YouTube | All existing tests | Existing |

## What the project owner needs to do

1. **Approve the restructure** (Part A) as its own change.
2. **Create the OAuth app and run the access check** (spec, "What the project owner needs to do"; [quickstart.md](quickstart.md), step 0) and paste the output. Needed before Part B, not Part A.
3. Add the official GitHub mark at `assets/platforms/github.png`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| III.1: `public_repo` (stars), `user` (lists), and `gist` (gists) allow more than Magpie uses | GitHub has no narrower scope for these actions, and a GitHub App cannot star most repositories. Approved by the owner on 2026-11-14. Safeguards: each sign-in asks only for the picked kinds, `gist` only on request, the user can untick scopes, and the app moves only kinds it was granted (FR-GH-020). | GitHub Apps cannot star repositories where they are not installed. |
| III.3: tokens are deleted but not cancelled | GitHub cancels a token only with the client secret, which a phone app cannot hold. Tokens run out 8 hours after sign-in. Approved by the owner on 2026-11-13. Safeguards: old token dropped after the read, new token deleted at the summary, on Switch, and on Delete all, refresh token never saved, and a line with a button to GitHub's remove-access page (FR-GH-019). | A server that holds the secret breaks III.5 (no own backend). |
| IV: many existing modules reshaped | The flow, mover, store, and screens are tied to YouTube today. A second Automatic platform cannot plug in without a driver. | `if (platform === 'github')` branches in shared code break IV ("Extend, do not patch"). A copied flow breaks FR-GH-002. |
