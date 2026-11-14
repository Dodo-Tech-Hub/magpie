# Implementation Plan: GitHub Platform

**Branch**: `feature/github-platform` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-github-platform/spec.md`

## Summary

Add GitHub as the second Automatic platform: move starred repositories, star lists, starred gists, and followed people from an old account to a new one, through the same From, Pick, To flow as YouTube.

The work has one gate and two parts.

| Step | What | Needs | Ships as |
| --- | --- | --- | --- |
| Gate | Owner runs [verify-access.sh](verify-access.sh) with a test GitHub App to prove a GitHub App token can star, follow, star a gist, and make a star list. | Owner, 10 minutes | Result pasted in the pull request |
| Part A | Make the Automatic flow platform-neutral behind a platform driver. YouTube is the only driver. No behavior change. | Owner approval of the restructure (Principle IV) | Its own pull request, before Part B |
| Part B | Add the GitHub driver, the code sign-in, sections on Pick, the pacer, token handling, and the texts. | Gate passed, Part A merged, three client IDs | One or more pull requests |

**Why a gate**: research found one firsthand report that a GitHub App user token gets 403 when it stars a repository the app is not installed on, and every tool that edits star lists uses a classic token. GitHub's docs were not reachable to settle it. If the test fails, the owner chooses between a classic OAuth app, a smaller scope, a guided flow, or cancelling ([research.md](research.md), R1), and the spec changes before tasks. Part A does not depend on the gate.

Technical approach:

- **Platform driver** ([contracts/platform-driver.md](contracts/platform-driver.md)): one object per platform with sign in, sign out, read old, check new, add one item, and words. `flows.ts`, `mover.ts`, the screens, and Settings stop importing Google and YouTube modules and call the driver of the open platform.
- **Store** ([data-model.md](data-model.md)): a version 1 schema with `platform` on `progress`, `kind`, `data`, and `reason` on items, the state `tomorrow` renamed `later`, a new state `not_available`, and a small `add_log` table for the pace. One migration, tested with a version 0 database.
- **Sign-in**: device code flow with no secret (R2). The driver calls back with the code; the account card shows it in place, copies it, and opens `github.com/login/device` in the browser. No new screen. After sign-in the driver reads `GET /user` and the flow refuses the same account on both steps (R4).
- **Tokens** (R5): old account token in memory, dropped after the read. New account and gist tokens in `expo-secure-store`, deleted at the summary, on Switch, and on Delete all. No refresh token saved. A line with a button opens GitHub's page to remove access.
- **Pick**: one section per kind with a heading, built as header rows in the existing list. Gist rows are greyed out with an "Allow gists" button until the optional sign-in is done. Private repositories show "Not available" (R7).
- **Move** ([contracts/github-api.md](contracts/github-api.md)): one REST call per star, follow, and gist; star lists through GraphQL, last, sending the union of list IDs so nothing on the new account is removed (R8). A pacer keeps 20 per minute and 300 per hour and turns GitHub's wait answers into a short sleep or "Later" with a reminder (R9).

## Technical Context

**Language/Version**: TypeScript (strict), React Native 0.88 via Expo SDK 58 (unchanged)

**Primary Dependencies**: Two added, both Expo SDK modules: `expo-secure-store` (token storage, required by Principle III, rule 3) and `expo-clipboard` (copy the sign-in code). `Linking` from React Native opens the browser. `fetch` for all calls, as today.

**Storage**: `expo-sqlite`, schema version 1 with a migration from today's schema. `expo-secure-store` for two GitHub tokens.

**Testing**: Jest with `jest-expo` and React Native Testing Library. `fetch`, the secure store, the clipboard, and `Linking` are mocked. See "Tests" below.

**Target Platform**: Android 8.0+ first, iOS 16+. No platform-specific behavior. No deep link, no URL scheme, no new permission.

**Project Type**: Mobile app (single Expo project, no backend)

**Performance Goals**: 50 items move in about 2.5 minutes at 3 seconds per item (SC-001 allows 5). A list of 1,000 stars loads in 10 requests. Sign-in ends within one poll interval (5 seconds) of the user's return.

**Constraints**: At most 20 adds per minute and 300 per hour per new account (FR-GH-010). Hosts: `github.com`, `api.github.com`, `avatars.githubusercontent.com`. No client secret. No refresh token saved. All text in `src/strings.ts`.

**Scale/Scope**: Part A: about 12 edited files, 2 new, 1 renamed, every existing test file touched for renames only. Part B: about 8 new files, about 8 edited, 1 logo asset, about 10 new test files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.4.0.

| Principle / rule | How the plan complies | Status |
| --- | --- | --- |
| I. New screen justified | No new screen. The sign-in code, the hint, "Allow gists", and the remove-access line show in place on existing steps (FR-GH-002). | Pass |
| I. Icons, labels, simple words | Sign-in button uses `logo-github` with "Sign in with GitHub". "Allow gists" uses `key-outline`. The remove-access button uses `open-outline`. Texts are the spec's. | Pass |
| I. Accessibility | The code is read letter by letter in its label. Section headings are headings. Greyed rows say why. Every new button has a label. | Pass |
| I. Confirmations | None added. | N/A |
| II. Tests | Unit tests for the driver, the pacer, the migration, and the mover. Component tests for the code sign-in, sections, gists, pause, and sign-out. No real GitHub calls. | Pass |
| III.1 Least privilege | Three GitHub Apps with the access table in the spec. Read-only for the old account. Gist access only on request. **Depends on the gate (R1)**: a classic OAuth app would need a new exception. | Pass if the gate passes |
| III.2 Sign-in flow | Device code flow in the system browser. Native SDK does not exist; PKCE needs a secret (R2). Every value from the flow is checked before use. | Pass |
| III.3 Token storage | `expo-secure-store` only. Tokens cannot be cancelled without a secret: **approved exception** with 3 safeguards (FR-GH-019), listed below. | Pass with approved exception |
| III.4 No secrets | Three public client IDs in `EXPO_PUBLIC_*`. No secret is created. | Pass |
| III.5 Network | Three hosts, listed in the spec and above. HTTPS only. | Pass |
| III.6 Data | Account ID, username, picture, item IDs, names, pictures, progress, add times. Delete all removes all of it. | Pass |
| III.7 Logging | Drivers log nothing about accounts, codes, tokens, or items. | Pass |
| III.8 Untrusted input | Every GitHub answer and the saved `data` JSON are shape-checked before use. | Pass |
| III.9 to III.10 | No new permission. `allowBackup` stays `false`. | Pass |
| III.11 Dependencies | Two Expo SDK modules. Lockfile committed. | Pass |
| IV. One home per thing | Drivers in `src/platforms/`. GitHub calls in `src/api/github.ts`, sign-in in `src/auth/github.ts`, pacer in `src/move/`. No new folder. | Pass |
| IV. Extend, do not patch | No `if (platform === 'github')` in shared code. Shared code reads the driver. | Pass |
| IV. Restructure instead of forcing it | The feature reshapes many modules, so the restructure (Part A) is proposed here, is its own change, and is done and tested before Part B. **Needs owner approval.** | Pass once approved |
| V. Platform rules | Official API only. Pace far under GitHub's limits. No scripted taps. Official, unmodified logo. | Pass |

**Gate result (pre-research)**: Pass with one approved exception. **Gate result (post-design)**: Pass, with two open items for the owner: approve the restructure, and run the access test.

## Project Structure

### Documentation (this feature)

```text
specs/008-github-platform/
├── plan.md                  # This file
├── research.md              # Phase 0 decisions, R1 is the open gate
├── data-model.md            # Phase 1: store version 1, GitHub kinds, tokens
├── quickstart.md            # Phase 1: how to check the result
├── verify-access.sh         # The access test for the gate
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
.env.example                     # B: three GitHub client IDs
assets/platforms/github.png      # B: official mark, from the owner
src/
├── api/
│   ├── youtube.ts               # A: Outcome and ApiError move to the driver contract
│   └── github.ts                # B: new. Read, add, answer-to-outcome table
├── auth/
│   ├── google.ts                # unchanged
│   ├── github.ts                # B: new. Device code sign-in, answer checks
│   └── githubTokens.ts          # B: new. Memory and secure-store tokens
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
│   ├── AppState.tsx             # A: items, signInCode, unlocked
│   └── flows.ts                 # A: calls the driver. B: extra sign-in, token drop at summary
├── store/progressStore.ts       # A: schema version 1, migration. B: add_log
├── strings.ts                   # A: words per platform. B: GitHub texts
└── ui/
    ├── AccountCard.tsx          # A: sign-in label and icon from words. B: code panel
    ├── ItemRow.tsx              # A: renamed from ChannelRow. B: reason, greyed rows
    ├── PickStep.tsx             # A: items. B: section headers, time left, Allow gists
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

## Part B. GitHub (after the gate and Part A)

1. `auth/github.ts` and `auth/githubTokens.ts`: device code sign-in, checks, token rules (R2, R5).
2. `api/github.ts`: read calls, add calls, the answer-to-outcome table (R6, R8).
3. `move/pacer.ts` and `add_log` (R9).
4. `githubDriver.ts` and the entry in `platforms.ts`, the logo, the client IDs.
5. Account card: code panel, copy, open browser, hint. Flow: same-account refusal, `extra` sign-in.
6. Pick: section headers, time left, "Allow gists", "Not available", reasons on rows.
7. Token drop at the summary, remove-access line, Delete all.
8. Texts, including "Magpie is not made by or linked with GitHub" in Settings.

## Tests

| Area | Test | Kind |
| --- | --- | --- |
| Migration | Version 0 database opens as version 1 with the same data | Unit |
| Mover | `wait` sleeps and retries, `later` marks the rest and saves the time, `stop` saves and stops, pacer is asked before each add | Unit |
| Device sign-in | Pending, slow down, expired, denied, bad answer shapes, stops at expiry | Unit |
| Tokens | Old token never reaches the secure store, refresh token never saved, deleted at each of the three moments | Unit |
| GitHub calls | Paging, shape checks, each row of the answer-to-outcome table, list union never drops a list | Unit |
| Pacer | 3 seconds apart, 300 per hour, resume time, time-left text | Unit |
| Sign-in on the step | Code shown and copied, browser opened, hint on second sign-in, same account refused, code ran out | Component |
| Pick | Sections, one kind has no heading, search and All across sections, gists greyed until allowed, "Not available" | Component |
| Move | Rows change in place, pause shows "Later" and the break text, Continue moves only the rest, summary skips gists without access | Component |
| Sign-out | Remove-access line and button, Delete all leaves no GitHub data | Component |
| YouTube | All existing tests | Existing |

## What the project owner needs to do

1. **Approve the restructure** (Part A) as its own change.
2. **Run the access test** ([quickstart.md](quickstart.md), step 0) and paste the output.
3. After the gate: create the three GitHub Apps and set the three client IDs (spec, "What the project owner needs to do"), and add the official GitHub mark at `assets/platforms/github.png`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| III.3: tokens are deleted but not cancelled on sign-out | GitHub cancels a token only with the client secret, which a phone app cannot hold. Approved by the owner on 2026-11-13 with 3 safeguards: old token dropped after the read, no refresh token saved, new and gist tokens deleted at the summary, on sign-out, and on Delete all, plus a button to GitHub's remove-access page (FR-GH-019). | A server that holds the secret breaks III.5 (no own backend). |
| IV: many existing modules reshaped | The flow, mover, store, and screens are tied to YouTube today. A second Automatic platform cannot plug in without a driver. | `if (platform === 'github')` branches in shared code break IV ("Extend, do not patch"). A copied flow breaks FR-GH-002. |
