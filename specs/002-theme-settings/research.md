# Research: Theme and Settings

Phase 0 decisions for [plan.md](plan.md). Each entry lists the decision, why, and what else was considered.

## R1. How the app knows the phone's look, and how to force Light or Dark

- **Decision**: Keep the saved choice in a small theme provider. When the choice is Light or Dark, call React Native's `Appearance.setColorScheme('light' | 'dark')`. When it is Auto, call `Appearance.setColorScheme('auto')`. The provider then reads the resulting look from `useColorScheme()` in every case (falling back to Light if the phone reports nothing).
- **Rationale**: One source of truth. `useColorScheme()` already re-renders the app when the phone changes mode (FR-005), and forcing the scheme also makes native pieces follow the choice: the Delete all dialog, the status bar with `style="auto"`, and keyboard. No custom listener code.
- **Requirement**: `userInterfaceStyle` in `app.config.ts` is already `automatic`, which both platforms need for this to work.
- **Alternatives considered**: read the phone's look once and pass the chosen look by hand; rejected because native dialogs and the status bar would not follow a forced choice. A theme library; rejected as too much for two palettes (constitution III.11).
- **Verify on device**: forcing Dark while the phone is Light, on Android first. If a native piece does not follow, set that piece's style by hand from the resolved look.

## R2. Color handling

- **Decision**: One object per look in `src/theme/theme.tsx` with named colors: `background`, `text`, `muted`, `border`, `primary`, `primarySoft` (the picked-row tint), `success`, `danger`, `warning`, `disabled`. `useTheme()` returns the current object. Each UI file builds its styles from it with `useMemo`. The 15 hard-coded colors found in the 6 UI files and `App.tsx` become named colors.
- **Rationale**: Today colors are literals inside `StyleSheet.create` at module level, which cannot react to a theme change. Building styles inside the component from the theme object is the smallest change that works.
- **Contrast**: The dark palette is chosen so normal text meets WCAG AA (4.5:1) on its background; the unit test checks this for every text color against `background` in both looks (FR-014, SC-004).
- **Alternatives considered**: a styled-components or Tamagui style system; rejected as new dependencies. Inline conditionals in every file; rejected as scattered and easy to miss.

## R3. Where the choice is saved and when it is read

- **Decision**: Reuse the existing `getSetting` and `setSetting` in `progressStore.ts` with key `themeChoice` and values `light`, `dark`, `system`. `deleteAll()` already runs `DELETE FROM setting`, so Delete all removes the choice with no store change. After Delete all, the provider sets its in-memory choice back to `system`.
- **Rationale**: No schema change, no new storage, no new dependency. Matches data-model R4 of the migration feature.
- **Validation**: a read value that is not one of the three words is treated as `system` (constitution III.8).
- **Alternatives considered**: AsyncStorage; rejected as a new dependency for one value.

## R4. No flash of the wrong look on open

- **Decision**: The theme provider renders nothing (the native splash screen stays up) until the saved choice has been read, then renders the app already in the right look. Reading one row from SQLite takes a few milliseconds.
- **Rationale**: FR-007 and SC-002 ask for the saved look on the first drawn screen.
- **Verify on device**: close and reopen with a forced Dark choice while the phone is Light and watch for a white flash. If the splash hides too early, add `expo-splash-screen` (an Expo SDK module, allowed by constitution III.11) and hold the splash until the choice is read.
- **Alternatives considered**: draw first in the phone's look and switch when the choice loads; rejected because it flashes whenever the choice differs from the phone.

## R5. Android and iOS differences

- **Decision**: Same code for both. Known differences, to check in the quickstart:
  - Android: the system navigation bar color follows the app's look through `Appearance`; the status bar icon color follows `StatusBar style="auto"`.
  - iOS: the status bar and keyboard follow the forced scheme.
  - The OS has no per-app theme menu on either platform, so there is no conflict with the in-app choice.
- **Alternatives considered**: separate code per platform; not needed.

## R6. Settings view and the gear button

- **Decision**: Add `settingsOpen: boolean` to the existing app state, with `openSettings` and `closeSettings` actions. When true, the screen shows `SettingsView` under the top bar instead of the step view. The step and everything else in state are not touched, so closing Settings shows the same step, picks, and running move (FR-009, SC-005). The gear sits in a fixed-width slot at the right end of the top bar and becomes a back arrow while Settings is open. Tapping a step tab while Settings is open also closes Settings and shows that step.
- **Rationale**: The existing app already switches views with state (migration research R8). A flag adds one view with no router.
- **A running move keeps going**: the move loop lives in the mover, not in a view, so hiding the step view does not stop it. The step views are removed from the screen while Settings is open and drawn again when it closes. Their data (picks, statuses, progress) lives in app state and SQLite, so nothing is lost; the task list must include a component test that proves picks and a running move survive this. If the mover is found to depend on a mounted view, keep the step view mounted and hide it instead.
- **Alternatives considered**: a new step in the top bar; rejected because Settings is not part of the migration. A floating button; rejected because it covers list rows and the Move bar. `expo-router`; rejected as in migration R8.

## R7. Theme choice control

- **Decision**: A 3-way segmented choice built from three `Pressable` buttons with `accessibilityRole="radio"` and a checked state. Each button has an icon (`sunny-outline`, `moon-outline`, `phone-portrait-outline`) and a label ("Light", "Dark", "Auto"). The chosen one is filled with the primary color.
- **Rationale**: Constitution Principle I: 5 or fewer options are shown inline.
- **Alternatives considered**: a dropdown; rejected by the constitution. A switch (on/off); rejected because there are three choices.

## R8. Moving Delete all

- **Decision**: Move the Delete all button and its confirmation from `FromStep` into `SettingsView`. It keeps the same wording, the same confirmation, and the same steps: cancel reminders, `deleteAll()`, `signOut()`, reset app state. After it finishes, close Settings and reset the theme choice to Auto. The test that covers it moves with it.
- **Rationale**: One place for it (FR-011). `FromStep` gets smaller.
- **Alternatives considered**: keep it in both places; rejected by FR-011.

## R9. Testing approach

- **Decision**: Same setup as the migration feature (`jest-expo`, RNTL, mocked SQLite). Mock `Appearance` and `useColorScheme` to test "Auto" for both phone looks. No snapshot tests; tests check the colors the user sees through the theme object and what is on screen.
- **Rationale**: Constitution Principle II.
