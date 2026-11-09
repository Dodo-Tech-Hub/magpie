---

description: "Task list for the subscription migration feature"
---

# Tasks: Subscription Migration

**Input**: Design documents from `specs/001-subscription-migration/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution Principle II requires relevant tests for every feature. Within each story, write the tests first and confirm they fail before implementing.

**Organization**: Tasks are grouped by user story so each story can be built and tested on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story from spec.md (US1 to US7)
- All paths are relative to the repository root (single Expo project, see plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the Expo project and tooling.

- [x] T001 Create the Expo SDK 58 project in the repository root with the blank TypeScript template (`npx create-expo-app@latest . --template blank-typescript`), keeping existing files (`AGENTS.md`, `specs/`, `.specify/`, agent folders) untouched; app files land in `App.tsx`, `index.ts`, `package.json`, `tsconfig.json`
- [x] T002 Set `"strict": true` and path alias `@/*` → `src/*` in `tsconfig.json`
- [x] T003 Install runtime dependencies with `npx expo install @react-native-google-signin/google-signin expo-sqlite expo-notifications expo-dev-client` and record them in `package.json`
- [x] T004 [P] Install test tooling (`jest-expo`, `jest`, `@testing-library/react-native`, `@types/jest`) and add `"test": "jest"` plus the `jest-expo` preset in `package.json`; create `jest.setup.ts`
- [x] T005 [P] Set up linting with `npx expo lint` (creates `eslint.config.js`) and add `"lint": "expo lint"` and `"typecheck": "tsc --noEmit"` scripts in `package.json`
- [x] T006 Replace `app.json` with `app.config.ts`: name "Subs Migrator", Android package and iOS bundle ID `com.dodotechhub.subsmigrator`, `android.allowBackup: false`, plugins `@react-native-google-signin/google-signin` (iOS URL scheme from the iOS client ID), `expo-sqlite`, `expo-notifications`; read OAuth client IDs from `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (public values, no secrets) in `app.config.ts`
- [x] T007 [P] Add `.env.example` with the two `EXPO_PUBLIC_GOOGLE_*` variable names and empty values, and make sure `.env` and `.env.*.local` are in `.gitignore`
- [x] T008 [P] Add `eas.json` with `development` (development client, internal distribution), `preview`, and `production` profiles
- [ ] T009 Owner task (manual, cannot be done by an agent): create the Google Cloud project, enable YouTube Data API v3, configure the OAuth consent screen in Testing mode with test users, and create Android, iOS, and Web OAuth client IDs as listed in `specs/001-subscription-migration/quickstart.md` Prerequisites; then fill a local `.env`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared building blocks every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T010 [P] Create `src/strings.ts` holding every user-facing text from `specs/001-subscription-migration/contracts/ui.md` as named constants and small functions (for example `moveButton(n)` → "Move 12 channels", `pickedCounter(n, total)` → "12 of 340 picked", `summary(...)` → "10 moved · 2 already there")
- [x] T011 [P] Create `src/log.ts` with a `log` helper that does nothing when `__DEV__` is false and never accepts tokens, emails, or channel lists (constitution III.7)
- [x] T012 [P] Write tests for the API client in `tests/unit/youtube.test.ts`: pagination of `subscriptions.list`, skipping invalid items, and every row of the error mapping table in `specs/001-subscription-migration/contracts/youtube-api.md`
- [x] T013 Implement `src/api/youtube.ts`: `listMySubscriptions(token)` (all pages, `part=snippet&mine=true&maxResults=50`), `subscribe(token, channelId)` (`POST subscriptions?part=snippet`), type guards for the list page and error body, and `mapError(httpStatus, body)` returning one of `moved | tomorrow | couldnt_move | auth | retry` per the contract's error table
- [x] T014 [P] Write tests for the store in `tests/unit/progressStore.test.ts` using an in-memory fake of `expo-sqlite` in `tests/mocks/expoSqlite.ts`: create progress, unique (`old_account_id`, `new_account_id`), status updates, cascade delete, delete all
- [x] T015 Implement `src/store/progressStore.ts`: create tables `progress` and `progress_channel` exactly as in `specs/001-subscription-migration/data-model.md` (primary key (`progress_id`, `channel_id`), `picked` default 1, `status` one of `waiting | moving | moved | already_there | tomorrow | couldnt_move`, unique (`old_account_id`, `new_account_id`), cascade delete) and functions `getOrCreateProgress`, `saveChannels`, `setPicked`, `setStatus`, `listUnfinished`, `deleteProgress`, `deleteAll`
- [x] T016 [P] Create `tests/mocks/googleSignin.ts` (fake `GoogleSignin` with `configure`, `signIn`, `signOut`, `revokeAccess`, `getTokens`, `getCurrentUser`) and register it with the other mocks in `jest.setup.ts`
- [x] T017 Implement `src/auth/google.ts`: `signIn(role)` configures the SDK with scope `https://www.googleapis.com/auth/youtube.readonly` for `old` and `https://www.googleapis.com/auth/youtube` for `new` (no other scopes), returns `{ id, email, name, photoUrl }`; `getAccessToken()` from `getTokens()` kept in memory only; `signOut()` calls `revokeAccess` then `signOut`; maps "cancelled" to a typed result
- [x] T018 Implement `src/state/AppState.tsx`: `useReducer` store and context with `currentStep` (`from | pick | to`), `oldAccount`, `newAccount`, `channels` (in memory before a progress exists), `activeProgressId`, `moveState` (`idle | moving | limit | done | offline`), plus actions to change them
- [x] T019 Implement `src/ui/TopBar.tsx` with three pressable steps (icon from `@expo/vector-icons` plus one word from `src/strings.ts`, `accessibilityRole="tab"`, `accessibilityLabel`) that set `currentStep`; state styling (current, done, locked) is added in US2
- [x] T020 Wire `App.tsx`: wrap in `AppStateProvider`, render `TopBar` and the view for `currentStep` (`FromStep`, `PickStep`, `ToStep` placeholders in `src/ui/`), open the database at start

**Checkpoint**: Foundation ready; user stories can start.

---

## Phase 3: User Story 1 - Move picked channels to a new account (Priority: P1) 🎯 MVP

**Goal**: Sign in to both accounts, see the old account's channels with checkboxes, tap Move, see each row update in place and a final summary.

**Independent Test**: Old account with a few channels, new account with none; pick some, tap Move; the new account follows exactly the picked channels (quickstart scenarios 2 and 6).

### Tests for User Story 1

- [x] T021 [P] [US1] Write mover tests in `tests/unit/mover.test.ts`: processes only picked `waiting` channels, writes `moving` before each request, `subscriptionDuplicate` becomes `moved`, 4xx becomes `couldnt_move` and continues, 401 refreshes once then stops with `auth`, network/429/5xx retries twice (1 s, 4 s) then stops and resets the channel to `waiting`
- [x] T022 [P] [US1] Write the move flow component test in `tests/components/moveFlow.test.tsx`: sign in old (mock), list shows all channels picked, sign in new, tap "Move 3 channels", rows show "Moving…" then "Moved", summary "3 moved" stays; one failing channel shows "Couldn't move"

### Implementation for User Story 1

- [x] T023 [P] [US1] Implement `src/ui/AccountCard.tsx`: signed-out state (title, hint, "Sign in with Google" button with icon) and signed-in state (photo, email, "Switch" button), all text from `src/strings.ts`
- [x] T024 [P] [US1] Implement `src/ui/ChannelRow.tsx`: memoized row with checkbox (`accessibilityRole="checkbox"` and checked state), photo, name, and status tag (Moving…, Moved, Couldn't move, Tomorrow, Already there) with icons; fixed height for `getItemLayout`
- [x] T025 [US1] Implement `src/move/mover.ts`: `runMove(progressId, getToken, onUpdate)` following research R5 and the contract error table, persisting every status change through `src/store/progressStore.ts`
- [x] T026 [US1] Implement `src/ui/FromStep.tsx`: `AccountCard` for the old account; on sign-in, load the list with `listMySubscriptions`, store it in app state with all channels picked (FR-017), go to Pick; show "This account doesn't follow any channels yet" when empty
- [x] T027 [US1] Implement `src/ui/ToStep.tsx`: `AccountCard` for the new account; on sign-in, create or load the progress for the pair with `getOrCreateProgress` and save channels, then go to Pick
- [x] T028 [US1] Implement `src/ui/PickStep.tsx` base: `FlatList` of `ChannelRow` with `getItemLayout`, tap to pick or unpick, sticky bottom bar "Move N channels"; tapping Move with something missing shows "Sign in to your new account first" or "Pick at least 1 channel" (FR-020); while moving, the bar reads "Moving…" and is not tappable
- [x] T029 [US1] Show the end summary in `src/ui/PickStep.tsx` using `summary(...)` from `src/strings.ts`, including "couldn't move" only when non-zero (FR-023)
- [x] T030 [US1] Add crash recovery in `src/move/mover.ts` and call it from `src/state/flows.ts` when the new account signs in (that is when its list can be read; there is no token at app start): any `moving` channel is checked against the new account's list and set to `moved` or `waiting` (research R5, SC-004)

**Checkpoint**: The core move works end to end.

---

## Phase 4: User Story 2 - Steps in any order with a clear top bar (Priority: P1)

**Goal**: The top bar always shows From, Pick, To with current, done, and locked states; any unlocked step can be opened in any order.

**Independent Test**: Fresh app, tap steps in different orders; correct view, highlight, and lock (quickstart scenario 1).

### Tests for User Story 2

- [x] T031 [P] [US2] Write `tests/components/topBar.test.tsx`: Pick locked with "Sign in to your old account first" before the old list is loaded; done marks after sign-ins; current step highlighted; signing in to the new account first, then the old one, still unlocks Pick

### Implementation for User Story 2

- [x] T032 [US2] Add state logic to `src/ui/TopBar.tsx`: derive current, done (From: old list loaded; Pick: no picked channel left waiting; To: new account signed in), and locked (Pick without an old list) from app state; lock icon and accessibility state
- [x] T033 [US2] Add the locked view to `src/ui/PickStep.tsx` (lock icon and "Sign in to your old account first")

**Checkpoint**: Navigation matches the chosen design.

---

## Phase 5: User Story 3 - See and switch the signed-in accounts (Priority: P2)

**Goal**: Each step shows who is signed in, Switch works, the same account cannot be used twice, and switching is blocked during a move.

**Independent Test**: Sign in both, switch one, try the same account twice (quickstart scenario 3).

### Tests for User Story 3

- [x] T034 [P] [US3] Write `tests/components/accounts.test.tsx`: same account on To is refused with "This is your old account. Pick a different one." and signed out; switching the old account reloads the list and keeps the previous pair's progress saved; Switch is disabled while moving

### Implementation for User Story 3

- [x] T035 [US3] Add the same-account check by Google account ID to `src/ui/FromStep.tsx` and `src/ui/ToStep.tsx` (research R3, FR-008)
- [x] T036 [US3] Implement Switch in `src/ui/FromStep.tsx` and `src/ui/ToStep.tsx`: sign out through `src/auth/google.ts`, start a new sign-in, reload the list for a new old account without deleting the previous progress (FR-010); disable Switch while `moveState` is `moving` (FR-011)

**Checkpoint**: Account mistakes are prevented.

---

## Phase 6: User Story 4 - Find and pick channels fast (Priority: P2)

**Goal**: Search, All checkbox, and the "12 of 340 picked" counter.

**Independent Test**: Many channels; search, use All, check the counter (quickstart scenario 5).

### Tests for User Story 4

- [x] T037 [P] [US4] Write `tests/components/pickList.test.tsx`: search filters by name while typing, All picks and unpicks only shown movable channels, counter updates, picks survive clearing the search

### Implementation for User Story 4

- [x] T038 [US4] Add the search box, All checkbox, and counter (`pickedCounter`) to `src/ui/PickStep.tsx`, filtering in memory on each keystroke (research R10, SC-006)

**Checkpoint**: Long lists are easy to handle.

---

## Phase 7: User Story 5 - Skip channels already followed (Priority: P2)

**Goal**: Channels the new account already follows show "Already there", cannot be picked, and are not counted or moved.

**Independent Test**: New account already follows 2 of the old account's channels (quickstart scenario 4).

### Tests for User Story 5

- [x] T039 [P] [US5] Write `tests/components/alreadyThere.test.tsx`: after new sign-in, matching rows show "Already there", their checkbox cannot be ticked, the Move count excludes them, and the mover skips them

### Implementation for User Story 5

- [x] T040 [US5] After the new account signs in (and when a progress is continued), read its list with `listMySubscriptions` and set matching channels to `already_there` in `src/ui/ToStep.tsx` through `src/store/progressStore.ts` (research R6, FR-018)
- [x] T041 [US5] Make `already_there` rows non-pickable in `src/ui/ChannelRow.tsx` and exclude them from the count and All in `src/ui/PickStep.tsx`

**Checkpoint**: No wasted follows.

---

## Phase 8: User Story 6 - Daily limit, reminder, and continue later (Priority: P3)

**Goal**: On the daily limit, rows show "Tomorrow", the user is asked once for reminders, a local reminder fires at the next reset, and Continue moves only the rest.

**Independent Test**: Simulated limit after 6 channels; reminder scheduled; Continue moves only waiting channels (quickstart scenario 9).

### Tests for User Story 6

- [x] T042 [P] [US6] Write `tests/unit/quotaReset.test.ts`: next midnight Pacific Time across standard time, daylight time, and both switch days (second Sunday of March, first Sunday of November)
- [x] T043 [P] [US6] Write `tests/components/dailyLimit.test.tsx`: `quotaExceeded` turns the current and remaining picked waiting rows into "Tomorrow", shows the limit message, asks for permission only the first time, schedules one reminder with only the progress ID, works when permission is denied, and Continue moves only waiting channels

### Implementation for User Story 6

- [x] T044 [P] [US6] Implement `src/move/quotaReset.ts`: pure `nextQuotaReset(now: Date): Date` using the US daylight saving rule (research R7)
- [x] T045 [P] [US6] Implement `src/reminders/reminder.ts`: `askOnce()` (permission request with the reason text, remembered so it is asked only once), `scheduleReminder(progressId, at)`, `cancelReminder(progressId)`, and a response listener that returns the progress ID from the payload
- [x] T046 [US6] Handle `tomorrow` in `src/move/mover.ts` (set current and remaining picked `waiting` channels to `tomorrow`, store `limit_hit_at`) and in `src/ui/PickStep.tsx` (message, `askOnce`, `scheduleReminder` at `nextQuotaReset`, bottom bar "Continue" that sets `tomorrow` back to `waiting` and runs the mover)
- [x] T047 [US6] Open the progress from a tapped reminder in `App.tsx`: look up the ID locally with `src/store/progressStore.ts`, ignore unknown IDs, go to Pick
- [x] T048 [US6] Add a development-only quota simulation in `src/move/mover.ts`: when `__DEV__` and `EXPO_PUBLIC_SIMULATE_QUOTA_AFTER` is set, treat the Nth request as `quotaExceeded`; never active in production builds

**Checkpoint**: Users with many channels can finish over several days.

---

## Phase 9: User Story 7 - Several saved progresses (Priority: P3)

**Goal**: Unfinished progresses are listed on From, can be opened (new account sign-in only), deleted, and drop off when finished.

**Independent Test**: Two pairs each stopped at the limit; both listed; each continues with its own channels (quickstart scenario 10).

### Tests for User Story 7

- [x] T049 [P] [US7] Write `tests/components/progresses.test.tsx`: list shows "old.me → new.me · 12 left" per unfinished progress; opening one with the new account signed out asks for that exact new account and refuses others; the old account shows from saved data; delete removes it; finished progresses are not listed; signing in to a pair with a saved progress opens it

### Implementation for User Story 7

- [x] T050 [US7] Add the unfinished progress list with delete icon buttons to `src/ui/FromStep.tsx` using `listUnfinished` and `deleteProgress` (FR-032, FR-034, FR-035)
- [x] T051 [US7] Implement opening a progress in `src/state/AppState.tsx` and `src/ui/ToStep.tsx`: load saved old account and channels, require sign-in to the exact saved new account ID if signed out (FR-033), re-run the "Already there" check, go to Pick
- [x] T052 [US7] Add "Delete all data" to `src/ui/FromStep.tsx`: confirm (destructive), call `deleteAll`, cancel reminders, `revokeAccess` and sign out (FR-012)

**Checkpoint**: All user stories work on their own.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [x] T053 [P] Review every string in `src/strings.ts` against constitution Principle I (simple words, no technical terms) and the CDS-style rules in `specs/001-subscription-migration/contracts/ui.md`
- [x] T054 [P] Audit accessibility labels and roles in `src/ui/*.tsx` (constitution I)
- [x] T055 [P] Audit logging and network use in `src/**/*.ts`: no `console.*` with tokens, emails, or lists; `fetch` only to `https://www.googleapis.com/youtube/v3/` (constitution III.5, III.7)
- [x] T056 Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm audit --audit-level=high` from `package.json` scripts; fix all failures
- [ ] T057 Build a development client with `npx eas build --profile development --platform android` (config in `eas.json`) and run all manual scenarios in `specs/001-subscription-migration/quickstart.md` on a real Android phone

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies. T009 (owner) is needed before any real sign-in on a device, not before writing code or tests.
- **Foundational (Phase 2)**: depends on Setup; blocks all stories.
- **US1 (Phase 3)**: depends on Foundational. MVP.
- **US2 (Phase 4)**: depends on Foundational; touches `TopBar.tsx` and `PickStep.tsx`, so do it after US1 to avoid edit conflicts.
- **US3, US4, US5 (Phases 5 to 7)**: depend on US1 (they extend its views). US4 and US5 both edit `PickStep.tsx`, so run them one after the other.
- **US6 (Phase 8)**: depends on US1 (mover and Pick view).
- **US7 (Phase 9)**: depends on US1; best after US6 because unfinished progresses mostly come from the daily limit.
- **Polish (Phase 10)**: after the stories you want to ship.

### Within each story

Tests first (they must fail), then components, then wiring. Tasks touching the same file run in order.

### Parallel opportunities

- Setup: T004, T005, T007, T008 together after T001 to T003.
- Foundational: T010, T011, T012, T014, T016 together; then T013, T015, T017 (each after its test or mock).
- US1: T021, T022, T023, T024 together; then T025 to T030 in order.
- US6: T042, T043, T044, T045 together.
- Polish: T053, T054, T055 together.

### Parallel example: User Story 1

```text
Task: "Write mover tests in tests/unit/mover.test.ts"
Task: "Write the move flow component test in tests/components/moveFlow.test.tsx"
Task: "Implement src/ui/AccountCard.tsx"
Task: "Implement src/ui/ChannelRow.tsx"
```

---

## Implementation Strategy

### MVP first

1. Phase 1 and Phase 2.
2. Phase 3 (US1).
3. Stop and validate: quickstart scenarios 2, 6, 7, 8 on a real phone.

### Incremental delivery

1. Add US2 (top bar states), then validate scenario 1.
2. Add US3, US4, US5, validating scenarios 3 to 5 after each.
3. Add US6 and US7, validating scenarios 9 to 11.
4. Polish and full quickstart run.

### Notes

- One logical change per commit, on `feature/subscription-migration` or a sub-branch, following the git rules in `AGENTS.md`.
- Commit only after the owner approves.
