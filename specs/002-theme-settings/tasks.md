---

description: "Task list for the theme and settings feature"
---

# Tasks: Theme and Settings

**Input**: Design documents from `specs/002-theme-settings/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution Principle II requires relevant tests for every feature. Within each story, write the tests first and confirm they fail before implementing.

**Organization**: Tasks are grouped by user story. No new dependencies and no setup phase are needed: the existing Expo project, Jest setup, and SQLite mock are reused.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story from spec.md (US1 to US3)
- All paths are relative to the repository root

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Texts, app state flag, and the theme module that every story uses.

- [x] T001 Add the new texts to `src/strings.ts`: `settings: 'Settings'`, `back: 'Back'`, `look: 'Look'`, `light: 'Light'`, `dark: 'Dark'`, `auto: 'Auto'` (simple words, no other new text)
- [x] T002 Add `settingsOpen: boolean` (initial `false`) to `State` in `src/state/AppState.tsx` with actions `openSettings` and `closeSettings`; make `setStep` also set `settingsOpen: false`, and `reset` return `settingsOpen: false` (data-model: App state addition)
- [x] T003 [P] Create `src/theme/theme.tsx`: `light` and `dark` color objects with the names from contracts/ui.md Colors (`background`, `text`, `muted`, `border`, `primary`, `primarySoft`, `success`, `danger`, `warning`, `disabled`, plus `onPrimary` for text on a filled primary button); type `ThemeChoice = 'light' | 'dark' | 'system'`; `ThemeProvider` that loads `themeChoice` with `getSetting`, treats a missing or unknown value as `system` (constitution III.8), renders nothing until loaded (research R4), calls `Appearance.setColorScheme('light' | 'dark' | null)` for the choice (research R1), and exposes `useTheme()` returning `{ colors, look, choice, setChoice, resetChoice }` where `look` comes from `useColorScheme() ?? 'light'`; `setChoice` saves with `setSetting('themeChoice', value)`; `resetChoice` sets the in-memory choice to `system` without writing
- [x] T004 [P] Write `tests/unit/theme.test.ts` first (must fail before T003 is done): unknown saved value resolves to `system`; each choice maps to the right `Appearance.setColorScheme` argument; `setChoice` saves the word; `resetChoice` goes back to `system`; every text color (`text`, `muted`, `primary`, `success`, `danger`, `warning`) has at least 4.5:1 contrast on `background` in both looks, and `onPrimary` has at least 4.5:1 on `primary` in both looks (FR-014, SC-004)

**Checkpoint**: theme module and state flag exist; their tests pass.

---

## Phase 2: User Story 1 - Choose a theme (Priority: P1) 🎯 MVP

**Goal**: The user opens Settings with the gear, picks Light, Dark, or Auto, and the whole app changes at once and stays that way after a restart.

**Independent Test**: Open Settings, tap Dark, see the app turn dark, restart, see it still dark.

### Tests for User Story 1

- [x] T005 [P] [US1] Write `tests/components/settings.test.tsx` first: the gear (label "Settings") is in the top bar on every step; tapping it shows Settings with the three choices and "Auto" marked on a fresh start; the gear becomes "Back"; tapping Dark marks Dark, saves `themeChoice`, and changes the background color shown by the root view; the choice is still Dark after unmounting and rendering `App` again; each choice has `accessibilityRole="radio"` and a checked state (FR-008, FR-010, FR-013, SC-001)
- [x] T006 [P] [US1] Update `tests/components/topBar.test.tsx`: the step tabs still work with the gear present, no tab is current while Settings is open, and tapping a tab while Settings is open closes Settings and shows that step (contracts/ui.md Top bar change)

### Implementation for User Story 1

- [x] T007 [US1] Create `src/ui/SettingsView.tsx`: heading "Settings", label "Look", and the inline 3-way choice (`sunny-outline` Light, `moon-outline` Dark, `phone-portrait-outline` Auto) as `Pressable` buttons with `accessibilityRole="radio"`, `accessibilityState={{ checked }}`, and labels; the chosen one filled with `primary` and text `onPrimary`; tapping calls `setChoice`; colors from `useTheme()`
- [x] T008 [US1] Update `src/ui/TopBar.tsx`: add the fixed-width slot at the right end with the gear (`settings-outline`, label "Settings") that dispatches `openSettings`, and the back arrow (`arrow-back`, label "Back") that dispatches `closeSettings` while `settingsOpen` is true; no step is `current` while Settings is open; move all colors to `useTheme()` with styles built in the component (research R2)
- [x] T009 [US1] Update `App.tsx`: wrap in `ThemeProvider` (inside `AppStateProvider`), show `SettingsView` instead of the step view when `settingsOpen` is true, set the root and `SafeAreaView` background from `colors.background`, and set `StatusBar` style from `look` (light icons on dark)
- [x] T010 [P] [US1] Move colors to `useTheme()` in `src/ui/AccountCard.tsx`
- [x] T011 [P] [US1] Move colors to `useTheme()` in `src/ui/ChannelRow.tsx`
- [x] T012 [P] [US1] Move colors to `useTheme()` in `src/ui/PickStep.tsx`
- [x] T013 [P] [US1] Move colors to `useTheme()` in `src/ui/ToStep.tsx`
- [x] T014 [P] [US1] Move colors to `useTheme()` in `src/ui/FromStep.tsx` (colors only; leave the Delete all button for T021)
- [x] T015 [US1] Check no hard-coded color is left: `grep -rnE "#[0-9a-fA-F]{3,6}" src App.tsx` shows matches only inside `src/theme/theme.tsx`

**Checkpoint**: US1 works alone: choice, save, restart, every screen in both looks.

---

## Phase 3: User Story 2 - Auto follows the phone (Priority: P2)

**Goal**: With Auto, the app matches the phone's light or dark mode, including live changes, and Auto is the default.

**Independent Test**: Pick Auto, switch the phone to dark, see the app turn dark; switch back, see it turn light.

### Tests for User Story 2

- [x] T016 [P] [US2] Add to `tests/components/settings.test.tsx` (or a new `tests/components/autoTheme.test.tsx`): with a fresh start and the mocked `useColorScheme` returning `dark`, the app is dark and "Auto" is marked; when the mock changes to `light` the app turns light without remount; with Light chosen and the phone dark, the app stays light; when the phone reports `null`, Auto shows Light; a saved garbage value shows Auto with no error (FR-004, FR-005, FR-006, edge cases)

### Implementation for User Story 2

- [x] T017 [US2] Fix `src/theme/theme.tsx` where T016 fails (expected to need little or nothing, since T003 already follows `useColorScheme`)
- [ ] T018 [US2] On the phone (Android first): force Dark while the phone is Light and check native pieces follow (Delete all dialog, status bar, keyboard, navigation bar); close and reopen with Dark saved and watch for a white flash. If the splash hides too early, add `expo-splash-screen` with `npx expo install expo-splash-screen` and hold it until the choice is loaded (research R1, R4). Record the result in `specs/002-theme-settings/research.md` under R1 and R4

**Checkpoint**: US1 and US2 both work.

---

## Phase 4: User Story 3 - Settings as the home for options (Priority: P2)

**Goal**: Settings also holds "Delete all my data" (moved from the From step), and opening and closing Settings never changes the user's place, picks, or a running move.

**Independent Test**: Pick channels, open Settings, go back, see the same picks; delete all from Settings and see data gone and the look back to Auto.

### Tests for User Story 3

- [x] T019 [P] [US3] Update `tests/components/progresses.test.tsx`: reach "Delete all my data" through the gear and Settings instead of the From step; cancel keeps all data; confirm removes data, signs out, closes Settings, shows From signed out, and Settings then marks "Auto" (FR-011, FR-015)
- [x] T020 [P] [US3] Add to `tests/components/settings.test.tsx`: the From step no longer shows "Delete all my data" (FR-011); picks and counter on Pick are unchanged after opening and closing Settings; during a mocked move, rows keep updating while Settings is open and show the final statuses after Back (SC-005)

### Implementation for User Story 3

- [x] T021 [US3] Move the "Delete all my data" button, its confirmation, and its steps (cancel reminders, `deleteAll()`, `signOut()`, reset app state) from `src/ui/FromStep.tsx` into `src/ui/SettingsView.tsx`; after it finishes, dispatch `closeSettings` and call `resetChoice()`; remove the button, handler, and now-unused imports and styles from `FromStep.tsx` (FR-011, FR-015, research R8)
- [x] T022 [US3] Make `SettingsView` easy to extend: a plain stacked list of blocks, one block per option, so a future option is one more block (FR-012); no extra abstraction

**Checkpoint**: all three stories work.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T023 Run `npm test`, `npx tsc --noEmit`, and `npx expo lint`; all MUST pass (constitution quality gates)
- [ ] T024 Run the manual scenarios in [quickstart.md](quickstart.md) on the Pixel 8 Pro (scenario 14 on iOS when a device or simulator is available); record anything that fails
- [x] T025 Confirm the security baseline for this change: no new permission, no network call, no new dependency (except `expo-splash-screen` if T018 needed it), nothing logged, saved value validated (plan Constitution Check)

---

## Dependencies & Execution Order

- Phase 1 blocks everything. T003 and T004 can run together; T004 is written first and fails until T003 is done.
- US1 needs Phase 1. T005 and T006 first; T007, T008, T009 in order; T010 to T014 in parallel after T003; T015 last.
- US2 needs US1 (T009 for the app wiring). T016 then T017, then T018 on the phone.
- US3 needs US1 (the Settings view exists). T019 and T020 first; T021 after T014 (same file `FromStep.tsx`); T022 after T021.
- Polish needs all stories.

## Parallel Example: User Story 1

```text
After T003: T010, T011, T012, T013, T014 (five different UI files)
Together at the start of US1: T005, T006 (two different test files)
```

## Implementation Strategy

- **MVP**: Phase 1 plus US1. The user can already choose Light, Dark, or Auto in Settings and keep it.
- Then US2 (verify and harden Auto, check on the phone), then US3 (move Delete all, protect state), then Polish.
- Commit and push only after the owner approves (AGENTS.md).
