# Implementation Plan: Guided Migration

**Branch**: `feature/guided-migration` (planned on `chore/clarify-004-005`) | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-guided-migration/spec.md`

## Summary

One shared guided flow (intro, get your data, checklist, finished) that any Guided platform plugs into through the spec 004 platform list. The user's list comes from a data export picked from the phone's files, read on the phone, or for Twitch from a one-time read of followed channels. The checklist opens each profile with a normal `https` link and the user taps Follow. Progress is saved in the existing SQLite database after every tap. Guides ship inside the app; a newer copy may come from one static guide host.

Technical approach:

- **Plug-in point**: each Guided platform is one entry in `src/platforms/platforms.ts` (spec 004 contract) plus a `GuidedPlatform` entry in `src/guided/guidedPlatforms.ts` with its parser or Twitch reader, profile link template, and bundled guide. See [contracts/guided-platform.md](contracts/guided-platform.md).
- **Flow screen**: `src/ui/GuidedFlow.tsx` holds the current part (intro, data, checklist, finished) in local state. It opens on the checklist when saved progress exists (R1).
- **Export files**: `expo-document-picker` to choose, `expo-file-system` to read, `fflate` to unzip only the needed entry. The cached copy is deleted after reading (R3, R4).
- **Parsers**: one file per platform in `src/guided/parsers/`, each turning the export into follow items. Shared code dedupes and sorts newest first. Each platform's format is verified with a real export before that platform's `ready` flag turns on (R5).
- **Twitch**: Device Code Grant Flow, the only Twitch flow for a public app without a secret. The app opens Twitch's activate page in the system browser, waits for approval, reads followed channels, revokes the token, and forgets it. This needs a recorded exception to constitution III.2 (R2).
- **Profiles**: `Linking.openURL` with an `https` profile link built from a validated handle. The phone opens the other app when installed, else the browser. No app list to declare (R7).
- **Saved progress**: new `src/store/guidedStore.ts` with two tables in the existing database. `deleteAll()` clears them (R8).
- **Guides**: bundled JSON and images in `assets/guides/`. Remote refresh from the guide host is P3 and waits for the owner to set the host (R9).

## Technical Context

**Language/Version**: TypeScript (strict), React Native 0.88 via Expo SDK 58 (unchanged)

**Primary Dependencies**: Added: `expo-document-picker`, `expo-file-system`, `expo-web-browser` (Expo SDK modules, installed with `npx expo install`), and `fflate` (pure TypeScript unzip, no dependencies, widely used). See [research.md](research.md) R3, R4, R2.

**Storage**: Existing SQLite database (`progress.db`). New tables `guided_progress` and `follow_item`. Last good fetched guide in the existing `setting` table. See [data-model.md](data-model.md).

**Testing**: Jest with `jest-expo` and React Native Testing Library. Unit: each parser against a small fixture export (no real user data), dedupe and sort, guide validator, guided store (tick, untick, skip, start again, clear, delete all), Twitch reader with mocked `fetch` (pagination, revoke called on success and on failure). Component: intro text, data steps with pictures, wrong and empty file messages, checklist (tap name opens link, tap box does not, count updates, search, order), finished screen Keep and Clear, Continue note on Home. No test touches a real platform.

**Target Platform**: Android 8.0+ first, iOS 16+. Differences in [contracts/guided-platform.md](contracts/guided-platform.md) and the spec table.

**Project Type**: Mobile app (single Expo project, no backend)

**Performance Goals**: Checklist of 1,000 rows scrolls without stutter; tick shows within 0.5 s (SC-004). Large export read shows a working indicator and keeps the screen responsive.

**Constraints**: Export never leaves the phone (FR-006). No Twitch token stored (clarification). New hosts: `id.twitch.tv`, `api.twitch.tv`, the guide host. `www.twitch.tv` opens only in the system browser. No device permissions. All text in `src/strings.ts`.

**Scale/Scope**: Shared flow first, then one task group per platform. About 2 new folders (`src/guided/`, `assets/guides/`), 12 new source files, 3 edited (`src/store/progressStore.ts` for `deleteAll`, `src/platforms/platforms.ts`, `src/strings.ts`), 4 dependencies, about 8 test files and fixture exports.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.3.0.

| Principle / rule | How the plan complies | Status |
|------------------|-----------------------|--------|
| I. New screens justified | One flow screen with four parts shown in place (intro, data, checklist, finished), not four routes. The flow is required by principle V. | Pass |
| I. Confirmations | Only Start again and Clear list, both destructive. | Pass |
| I. Icons, labels, simple words | Every button and row action has an icon, a label, and an accessibility label (FR-024). Text drafts in the contract. | Pass |
| II. Tests | Listed above. Parsers tested on fixtures, Twitch with mocked network. | Pass |
| III.1 Least privilege | Twitch scope `user:read:follows` only. No other platform sign-in. | Pass |
| III.2 Secure sign-in | Twitch offers no Authorization Code with PKCE for public clients. The plan uses Device Code Grant Flow in the system browser: no embedded WebView, no password, no secret. This is not the flow III.2 names. | **Exception, needs owner approval** |
| III.3 Token storage | Twitch token kept in memory only for the single read, then revoked and dropped. Never stored. | Pass |
| III.4 No secrets | Twitch client ID is public (`EXPO_PUBLIC_TWITCH_CLIENT_ID`). DCF needs no secret. | Pass |
| III.5 Network | New hosts listed: `id.twitch.tv`, `api.twitch.tv`, guide host. Guide request carries no user data or identifiers. | Pass |
| III.6 Data minimization | Export read on the phone; cached copy deleted after reading. Stored per item: handle, display name, follow time, state. Delete all clears guided tables. | Pass |
| III.7 Logging | No logging of export contents, handles, or tokens. | Pass |
| III.8 Untrusted input | Export files, Twitch responses, and fetched guides are validated before use. Profile links are built from a template and an encoded handle, never taken from the file. Zip reading limits entry size. | Pass |
| III.9 Permissions | Document picker and `Linking` need none. | Pass |
| III.10, III.12 | Unchanged. | Pass |
| III.11 Dependencies | Three Expo SDK modules plus `fflate` (maintained, widely used, no dependencies). Lockfile committed. | Pass |
| IV. Structure | New folder `src/guided/` because no existing folder owns guided-flow logic (parsers, guides, checklist rules). Store code in `src/store/`, Twitch in `src/auth/` and `src/api/`, screens in `src/ui/`. Platforms plug in through two lists, not `if` chains. | Pass |
| V. No UI automation | The app only opens a link. No taps, hidden browser, screen reading, or accessibility service (FR-012). | Pass |

**Gate result (pre-research)**: Pass with one exception. **Gate result (post-design)**: Pass with the same exception.

**Exception to approve (III.2, Twitch only)**: Twitch's docs list Device Code Grant Flow as the flow for public clients and do not offer PKCE; the code flow needs a client secret, which the app cannot hold. DCF keeps every other III.2 goal: sign-in happens in the system browser, the app never sees the password, and there is no secret. Owner options: approve the exception and amend III.2 to allow DCF where a platform offers no PKCE, or drop Twitch from the guided platforms. Twitch tasks stay blocked until one is chosen; other platforms are not affected.

## Project Structure

### Documentation (this feature)

```text
specs/005-guided-migration/
├── plan.md                  # This file
├── research.md              # Phase 0 decisions
├── data-model.md            # Phase 1: tables, states, guide shape
├── quickstart.md            # Phase 1: how to check the result
├── contracts/
│   ├── guided-platform.md   # Phase 1: how a platform plugs in, link rules
│   └── guide-content.md     # Phase 1: guides.json shape and checks
├── checklists/
│   └── requirements.md      # From the specify step
└── tasks.md                 # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
assets/guides/
├── <platform>.json               # bundled guide per platform (new)
└── <platform>/step-<n>.png       # bundled pictures (new)
src/
├── api/twitch.ts                 # followed channels, paged (new)
├── auth/twitch.ts                # DCF sign-in, revoke (new)
├── guided/
│   ├── guidedPlatforms.ts        # per-platform reader, link template, guide (new)
│   ├── followList.ts             # dedupe, sort newest first, search (new)
│   ├── exportFile.ts             # pick, read, unzip one entry, delete copy (new)
│   ├── guides.ts                 # bundled guide, fetch, validate, last good (new)
│   └── parsers/<platform>.ts     # one parser per platform (new)
├── platforms/platforms.ts        # Guided entries (edited, spec 004 file)
├── store/
│   ├── guidedStore.ts            # guided tables (new)
│   └── progressStore.ts          # deleteAll clears guided tables (edited)
├── strings.ts                    # guided text (edited)
└── ui/
    ├── GuidedFlow.tsx            # part switch, start again (new)
    ├── GuidedIntro.tsx           # (new)
    ├── GuidedData.tsx            # steps, Pick file or Sign in (new)
    ├── GuidedChecklist.tsx       # bar, search, rows (new)
    ├── FollowRow.tsx             # tick box, name link, skip (new)
    └── GuidedFinished.tsx        # totals, Keep list, Clear list (new)
tests/
├── fixtures/exports/<platform>/  # small made-up exports (new)
├── unit/                         # parsers, followList, guides, guidedStore, twitch (new)
└── components/guided*.test.tsx   # flow, checklist, finished (new)
```

**Structure Decision**: Keep the single Expo project. Add `src/guided/` (justified above) and `assets/guides/`. Schema for the new tables is added in `guidedStore.ts` with `CREATE TABLE IF NOT EXISTS` against the same database, so spec 001's store is unchanged except `deleteAll()`.

## Delivery order

1. Shared flow, store, checklist, finished, bundled guide loading, with one fixture platform used only in tests.
2. One task group per platform, each ending with `ready: true` only after its real export format is checked (spec assumption). Order is the owner's choice.
3. Twitch group, after the III.2 exception is decided.
4. Remote guide refresh (US4, P3), after the owner sets the guide host.

## Spec follow-ups (for `/speckit-analyze`)

- Spec Platform differences row "Open a profile in the other app" says apps must be declared in advance. With plain `https` links (R7) nothing is declared. Reword the row.
- 005 FR-019 says the Continue note shows "ticked and skipped count"; 004 FR-007 says "count left". This plan uses count left (open rows), matching 004. Align FR-019.
- 005 Assumptions say Twitch needs no review; DCF needs the Twitch app registered as a public client. Add that.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|-----------|------------|--------------------------------------|
| III.2: Twitch sign-in uses Device Code Grant Flow, not Authorization Code with PKCE | Twitch offers no PKCE; its code flow needs a client secret, which a public app cannot hold | Implicit grant returns the token in the redirect URL and Twitch's own docs conflict on whether public clients may use it; shipping a secret breaks III.4 |
