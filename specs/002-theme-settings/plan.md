# Implementation Plan: Theme and Settings

**Branch**: `feature/app-and-theme-spec` (no separate feature branch yet; the owner decides) | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-theme-settings/spec.md`

## Summary

Add a Light/Dark look and a small Settings view to the existing single-screen app. A gear icon at the right end of the top bar opens Settings in place of the step view (no navigation library); the gear becomes a back arrow while Settings is open. Settings shows the theme as a 3-way inline choice (Light, Dark, Auto) and the existing "Delete all my data" action, which moves there from the From step. The choice is saved in the existing SQLite `setting` table under `themeChoice`, read before the first screen is drawn, and removed by Delete all. Auto follows the phone through React Native's color scheme. All hard-coded colors in the UI move to one small set of named colors per look.

## Technical Context

**Language/Version**: TypeScript (strict), React Native 0.88 via Expo SDK 58 (unchanged)

**Primary Dependencies**: None added. Uses React Native `Appearance` and `useColorScheme`, `expo-status-bar`, `expo-sqlite`, and `@expo/vector-icons`, all already in the project. See [research.md](research.md).

**Storage**: Existing SQLite `setting` table, one new key `themeChoice` (see [data-model.md](data-model.md)). No schema change.

**Testing**: Jest with `jest-expo` and React Native Testing Library, as in the migration feature. New tests: theme resolution and persistence (unit), top bar gear and Settings (component), Delete all from Settings (component, moved from the From step test).

**Target Platform**: Android 8.0+ first, iOS 16+ (same code; differences listed in research R5)

**Project Type**: Mobile app (single Expo project, no backend)

**Performance Goals**: Theme change visible within 1 s with no restart (SC-001); first screen already in the saved look (SC-002); phone mode change followed within 1 s (SC-003).

**Constraints**: No new permissions, network calls, or account data (FR-017). One extra view only. All text from `src/strings.ts`.

**Scale/Scope**: 1 new view (Settings), 1 new small module (theme), edits to the 6 UI files that hold color values, `App.tsx`, `AppState.tsx`, `TopBar.tsx`, `FromStep.tsx`, `strings.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / rule | How the plan complies | Status |
|------------------|-----------------------|--------|
| I. Inline choice for 5 or fewer options | Theme has 3 options, shown as an inline segmented choice, not a dropdown. | Pass |
| I. Every new screen justified | Settings is the one new view. Justification: the owner wants one home for app options now and later; it opens in one tap from the top bar, replaces the step view in place, and returns in one tap. It adds no step to the migration flow and leaves the user's state untouched. | Pass (justified) |
| I. Confirmation only for destructive actions | Changing theme asks nothing. Delete all keeps its existing confirmation. | Pass |
| I. Icons on buttons, short labels | Gear, back arrow, sun/moon/phone icons on the three choices, trash icon on Delete all. Each has a text label except the gear and back arrow, which are obvious and have accessibility labels. | Pass |
| I. Simple words | Strings: "Settings", "Look", "Light", "Dark", "Auto", "Back". | Pass |
| I. Accessibility labels | Gear/back button, each theme choice (`accessibilityRole="radio"` with checked state), Delete all. | Pass |
| II. Relevant tests | Unit: choice resolution and saved choice. Component: gear opens and closes Settings, step and picks unchanged, choice changes colors, Delete all moved and still works and resets theme. | Pass |
| III.1 to III.5 (scopes, sign-in, tokens, secrets, network) | Untouched. No new network call. | Pass |
| III.6 Data minimization | Stores one short word (`light`, `dark`, or `system`) on the device. Delete all removes it (already removed by the existing `DELETE FROM setting`). | Pass |
| III.7 Logging | Nothing logged. | Pass |
| III.8 Untrusted input | The saved value is validated: anything other than the three known words falls back to `system`. | Pass |
| III.9 Device permissions | None added. | Pass |
| III.10 to III.12 | Untouched. | Pass / N/A |

**Gate result (pre-research)**: Pass. **Gate result (post-design)**: Pass.

## Project Structure

### Documentation (this feature)

```text
specs/002-theme-settings/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities
├── quickstart.md        # Phase 1 validation guide
├── contracts/
│   └── ui.md            # Top bar change, Settings view, colors
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code (changes to the existing project)

```text
App.tsx                  # Wrap in ThemeProvider; show Settings or the step view; StatusBar follows look
src/
├── theme/
│   └── theme.tsx        # NEW: light and dark colors, ThemeProvider, useTheme(), choice save and load
├── state/
│   └── AppState.tsx     # CHANGED: add settingsOpen with open and close actions
├── ui/
│   ├── TopBar.tsx       # CHANGED: gear / back button at the right end; colors from theme
│   ├── SettingsView.tsx # NEW: theme choice and Delete all my data
│   ├── FromStep.tsx     # CHANGED: Delete all removed; colors from theme
│   ├── AccountCard.tsx  # CHANGED: colors from theme
│   ├── ChannelRow.tsx   # CHANGED: colors from theme
│   ├── PickStep.tsx     # CHANGED: colors from theme
│   └── ToStep.tsx       # CHANGED: colors from theme
└── strings.ts           # CHANGED: new texts

tests/
├── unit/theme.test.ts          # NEW
└── components/
    ├── settings.test.tsx       # NEW
    ├── topBar.test.tsx         # CHANGED: gear button
    └── progresses.test.tsx     # CHANGED: Delete all now reached through Settings
```

**Structure Decision**: Keep the single Expo project and the existing layout. One new folder, `src/theme/`, holds everything about looks. Settings is a view inside the same screen, chosen by a flag in the existing app state, so no navigation library is added.

## Complexity Tracking

No constitution violations to justify. The one new view is covered in the Constitution Check above.
