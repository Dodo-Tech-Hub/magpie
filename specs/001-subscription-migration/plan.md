# Implementation Plan: Subscription Migration

**Branch**: `feature/subscription-migration` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-subscription-migration/spec.md`

## Summary

A single-screen Expo app with a top bar (From, Pick, To) that switches between three step views without a navigation library. The user signs in to the old account with read-only access, the app reads and saves its full subscription list on the device, then the user signs in to the new account with subscription access. The app marks channels the new account already follows, and moves picked channels one at a time, saving each channel's status before and after every request so a crash or the daily limit never causes a double follow. When the daily limit is hit, the app schedules a local reminder for the next quota reset (midnight Pacific Time). Saved progresses live in an on-device SQLite database, one per old and new account pair.

## Technical Context

**Language/Version**: TypeScript (strict mode), React Native via Expo SDK 58

**Primary Dependencies**: `expo` 58, `@react-native-google-signin/google-signin` 17 (sign-in and access tokens), `expo-sqlite` (saved progresses), `expo-notifications` (local reminders), `@expo/vector-icons` (icons, bundled with Expo). No navigation, state, HTTP, or validation libraries. See [research.md](research.md).

**Storage**: On-device SQLite (`expo-sqlite`). No tokens stored by the app; the Google Sign-In SDK keeps credentials in the OS secure store.

**Testing**: Jest with `jest-expo` preset, React Native Testing Library. Network (`fetch`), Google Sign-In, SQLite, and notifications are mocked at the module boundary.

**Target Platform**: Android 8.0+ (API 26) first, iOS 16+. Development builds via EAS Build (Expo Go cannot run the native Google Sign-In module).

**Project Type**: Mobile app (single Expo project, no backend)

**Performance Goals**: Search filters 2,000 channels while typing with no visible delay (SC-006); list scrolls at 60 fps.

**Constraints**: YouTube Data API daily quota of 10,000 units per Google Cloud project, shared by all users (about 200 follows per day); no backend; HTTPS to Google endpoints only; works without notification permission.

**Scale/Scope**: 3 step views, up to 2,000 channels per account, a handful of saved progresses per device.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / rule | How the plan complies | Status |
|------------------|-----------------------|--------|
| I. Inline choices for 5 or fewer options, combo box above 5 | No option sets in this feature beyond the step bar (3, inline) and the unfinished progress list (a list of records, not a choice set). | Pass |
| I. Minimize screens | One screen with 3 step views under a fixed top bar; progress, results, and reminders open in place. | Pass |
| I. Icons and simple words | All steps and buttons use `@expo/vector-icons`; all text lives in one strings file reviewed for plain words. | Pass |
| I. Accessibility labels | Every pressable has `accessibilityLabel`; checkboxes use `accessibilityRole="checkbox"` and state. | Pass |
| II. Relevant tests | Unit tests for mover, quota reset, API error mapping, store; component tests for top bar, pick list, move flow. Regression test per bug fix. | Pass |
| III.1 Least privilege scopes | Old account: `youtube.readonly`. New account: `youtube`. Nothing else. | Pass |
| III.2 Secure sign-in | Native Google Sign-In SDK; no WebView, no passwords. | Pass |
| III.3 Token storage | App never persists tokens; access tokens kept in memory only, fetched from the SDK on demand; `revokeAccess` on sign-out. | Pass |
| III.4 No secrets in app | Only public OAuth client IDs in `app.config.ts`; no client secret exists for native clients. | Pass |
| III.5 Network | `fetch` to `www.googleapis.com` only (sign-in endpoints are used by the SDK); ATS and Android cleartext defaults left on. No backend, analytics, or crash SDK. | Pass |
| III.6 Data minimization | Stores channel ID, title, thumbnail URL, status, and account ID, email, name, photo URL. Delete-all in app. | Pass |
| III.7 Logging | No logging of tokens, emails, or lists; a `log` helper that is a no-op in production. | Pass |
| III.8 Untrusted input | Type guards validate every API response before use; notification payload only carries a progress ID that is looked up locally. No deep link routes. | Pass |
| III.9 Device permissions | Only notifications, requested on first daily-limit hit, as justified in the spec (FR-028). | Pass |
| III.10 Backups | `android.allowBackup: false` in app config. | Pass |
| III.11 Dependencies | Expo SDK modules plus one widely used sign-in library; lockfile committed; `npm audit` gate before release. | Pass (see risk R1 in research) |
| III.12 Signed OTA updates | EAS Update not used in this feature. | N/A |

**Gate result (pre-research)**: Pass. **Gate result (post-design)**: Pass. The dependency risk in research R1 (Android sign-in library uses a deprecated Google API) was accepted by the owner on 2026-11-09.

## Project Structure

### Documentation (this feature)

```text
specs/001-subscription-migration/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities and states
├── quickstart.md        # Phase 1 validation guide
├── contracts/
│   ├── youtube-api.md   # YouTube Data API calls, costs, error mapping
│   └── ui.md            # Step bar, step views, and their states
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
app.config.ts            # Expo config: ids, allowBackup false, plugins
App.tsx                  # Root: provider + TopBar + current step view
src/
├── api/
│   └── youtube.ts       # listMySubscriptions, subscribe, error mapping, type guards
├── auth/
│   └── google.ts        # signIn(role), signOut(role), getAccessToken(); wraps the SDK
├── store/
│   └── progressStore.ts # SQLite schema and queries for progresses and channels
├── move/
│   ├── mover.ts         # Sequential move loop and status transitions
│   └── quotaReset.ts    # Next midnight Pacific Time
├── reminders/
│   └── reminder.ts      # Permission request and local scheduled reminder
├── state/
│   └── AppState.tsx     # useReducer + context: accounts, current step, active progress
├── ui/
│   ├── TopBar.tsx
│   ├── FromStep.tsx     # Old account card + unfinished progress list
│   ├── PickStep.tsx     # Search, All, counter, channel list, Move/Continue bar
│   ├── ToStep.tsx       # New account card
│   ├── AccountCard.tsx
│   └── ChannelRow.tsx
└── strings.ts           # Every user-facing text in one place

tests/
├── unit/                # mover, quotaReset, youtube error mapping, progressStore
└── components/          # TopBar, PickStep, move flow end to end with mocks
```

**Structure Decision**: Single Expo project with the blank TypeScript template (no `expo-router`), because the app has one screen and switches step views with state. Code is grouped by concern under `src/`; tests live in `tests/` split into unit and component tests.

## Complexity Tracking

No constitution violations to justify.
