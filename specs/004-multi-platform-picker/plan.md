# Implementation Plan: Platform Picker (Automatic First)

**Branch**: `feature/multi-platform-picker` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-multi-platform-picker/spec.md`

## Summary

Add a Home screen in front of the existing YouTube flow. Home is a grid of platform cards in two sections (Automatic, Guided), built from one list of platforms. At launch the list holds one ready platform, YouTube, so only the Automatic section shows. Tapping the YouTube card opens the existing flow unchanged. A card shows a Continue note when that platform has unfinished progress. Home has its own top bar with the gear for Settings. The YouTube flow gets one new control: a Home button in its top bar. On Android the system back action also goes Home.

Technical approach:

- **Platform list**: one typed array in `src/platforms/platforms.ts`. Each entry has id, name, logo, label, section, ready, and two functions: `open(dispatch)` and `unfinished()`. Home reads only this list (FR-003, SC-003). See [contracts/platform-list.md](contracts/platform-list.md).
- **Routing**: no navigation library. App state gets one new field, `platform: PlatformId | null`. `null` means Home. `App.tsx` shows Home, Settings, or the YouTube steps from that field (research R1). `reset` keeps `platform`, so Delete all and deleting the open progress do not throw the user out of the flow (data model).
- **Home**: `src/ui/HomeBar.tsx`, `src/ui/HomeView.tsx`, and `src/ui/PlatformCard.tsx`. A `FlatList` per section with a column count from `columnsFor()` in `src/ui/gridColumns.ts`, so cards never get cut off. Names wrap to 2 lines, labels to 3 (R3, FR-018). Section headers are headings; the card body and the Continue note are separate 48 x 48 point tap targets (FR-015, FR-016, R8).
- **Continue note**: the YouTube entry's `unfinished()` sums `left` from the existing `listUnfinished()`. One progress: tap calls the existing `openProgress()`. Several: tap opens the YouTube flow on the From step, where the existing Unfinished list lives (R4).
- **Reminders**: `openProgress()` also sets `platform: 'youtube'`, so a reminder still skips Home (FR-009).
- **Way back**: Home button in the YouTube top bar dispatches `goHome`. A `BackHandler` listener in `App.tsx` does the same on Android, closing Settings first (R6, FR-010).
- **Logos**: official YouTube icon at `assets/platforms/youtube.png`, unmodified, hidden from screen readers. If it cannot load, the card still shows name and label (FR-017, FR-020). Store release is blocked until the owner confirms brand use, including size (R5).

## Technical Context

**Language/Version**: TypeScript (strict), React Native 0.88 via Expo SDK 58 (unchanged)

**Primary Dependencies**: None added. `FlatList`, `useWindowDimensions`, and `PixelRatio.getFontScale()` come from React Native. Icons from `@expo/vector-icons` (already used).

**Storage**: No change. Home reads the existing `progress` tables through `listUnfinished()`. Delete all already removes every table the app has (FR-011); spec 005 extends `deleteAll()` for its own tables.

**Testing**: Jest with `jest-expo` and React Native Testing Library. New: reducer test (`platform`, `openPlatform`, `goHome`, `reset` keeps `platform`), platform list unit test (sections, ready filter, label length, YouTube entry), `columnsFor()` unit test, Home component tests (headers, card labels, logo hidden and logo failure, Continue note for 0, 1, and several progresses, separate tap targets, no loading indicator, live count), Home layout test (320 wide at font scale 2), Android back and Settings navigation test, TopBar Home button test, reminder still opens progress directly, contrast test for card text. All existing tests pass with no change to what they check (SC-002); a `renderApp()` helper in `tests/components/helpers.tsx` renders the app and presses the YouTube card, so existing tests keep their starting screen (R7).

**Target Platform**: Android 8.0+ first, iOS 16+. No platform-specific behavior (FR-014).

**Project Type**: Mobile app (single Expo project, no backend)

**Performance Goals**: Home shows in the same frame as today's first screen. The Continue note is added when `listUnfinished()` (one SQLite query) returns, with no loading indicator (FR-019).

**Constraints**: No new network host, permission, stored data, or dependency. All text in `src/strings.ts`. Theme colors from `src/theme/`.

**Scale/Scope**: 1 new folder (`src/platforms/`), 5 new files (`platforms.ts`, `HomeBar.tsx`, `HomeView.tsx`, `PlatformCard.tsx`, `gridColumns.ts`), 5 edited files (`App.tsx`, `src/state/AppState.tsx`, `src/state/flows.ts`, `src/ui/TopBar.tsx`, `src/strings.ts`), 1 logo asset, about 9 test files new or extended.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.4.0.

| Principle / rule | How the plan complies | Status |
|------------------|-----------------------|--------|
| I. New screen justified | Home is the one new screen. It is the approved exception for the platform picker (grid of cards in two sections). Settings stays the existing view. `HomeBar` is Home's top bar, not a screen. | Pass |
| I. Card content | Logo, name, one-line label on each card (FR-002). | Pass |
| I. Icons and labels | Home button in the top bar uses `home-outline` with label "Home". Gear on Home with label "Settings", same place as in the flow (FR-011). Continue note uses `time-outline` and a text label. | Pass |
| I. Simple words | "We move them for you", "Step-by-step guide", "Continue: 12 left", "Home". | Pass |
| I. Accessibility | Card label reads name and line (FR-006). Continue note reads "Continue YouTube, 12 left" (FR-017). Headers are headings (FR-015). Tap targets at least 48 x 48 points (FR-016). Text contrast at least 4.5 to 1, names and labels wrap, no cut-off at 320 points wide and largest text (FR-018, SC-004). | Pass |
| I. Confirmations | None added. | N/A |
| II. Tests | Unit and component tests listed above. Existing tests unchanged in what they check. | Pass |
| III.1 to III.4 | Sign-in, scopes, tokens, and secrets untouched. | Pass |
| III.5 Network | No new host. | Pass |
| III.6 Data | No new data. Delete all unchanged and still covers every table. | Pass |
| III.7 to III.12 | No logging, input, permission, backup, dependency, or OTA change. | Pass |
| IV. One home per thing | New folder `src/platforms/` because no existing folder owns "which platforms the app supports". Screens go in `src/ui/`. | Pass |
| IV. Extend, do not patch | YouTube steps are untouched. The new route is one state field and one switch in `App.tsx`. The Home button belongs to the top bar's navigation job. | Pass |
| IV. Flat logic | Card tap and section lookups use the platform list, not `if` chains. | Pass |
| V. Logos | Official, unmodified, used only to name the platform. Store release blocked until the owner confirms brand use (open item 7 in `specs/003-magpie-rebrand/tasks.md`). | Pass |

**Gate result (pre-research)**: Pass. **Gate result (post-design)**: Pass. No exception to record.

## Project Structure

### Documentation (this feature)

```text
specs/004-multi-platform-picker/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1: Platform entry, state change
├── quickstart.md        # Phase 1: how to check the result
├── contracts/
│   └── platform-list.md # Phase 1: the platform list shape and rules
├── checklists/
│   ├── requirements.md  # From the specify step
│   └── ux.md            # UX and accessibility checklist
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
App.tsx                      # route: Home, Settings, or the YouTube steps; Android back
assets/platforms/
└── youtube.png              # official logo, owner-supplied (new)
src/
├── platforms/
│   └── platforms.ts         # the list of platforms (new)
├── state/
│   ├── AppState.tsx         # platform field, openPlatform and goHome actions
│   └── flows.ts             # openProgress sets platform
├── strings.ts               # Home, section names, card lines, Continue note
└── ui/
    ├── HomeBar.tsx          # Home top bar: title and gear (new)
    ├── HomeView.tsx         # grid in two sections (new)
    ├── PlatformCard.tsx     # one card with optional Continue note (new)
    ├── gridColumns.ts       # columnsFor(width, fontScale) (new)
    └── TopBar.tsx           # Home button
tests/
├── unit/
│   ├── appState.test.ts              # platform field and actions (new)
│   ├── platforms.test.ts             # (new)
│   ├── gridColumns.test.ts           # (new)
│   └── theme.test.ts                 # card text contrast (extended)
└── components/
    ├── home.test.tsx                 # (new)
    ├── homeLayout.test.tsx           # 320 wide, large text (new)
    ├── homeNav.test.tsx              # Android back, Settings, Delete all (new)
    ├── progresses.test.tsx           # reminder from Home or Settings (extended)
    ├── topBar.test.tsx               # Home button (extended)
    └── helpers.tsx                   # renderApp() (extended)
```

**Structure Decision**: Keep the single Expo project. Add `src/platforms/` for the platform list (constitution IV, new folder justified above). `gridColumns.ts` is one pure, unit-tested function, kept out of `HomeView` so it can be tested without rendering. No navigation library: one more state field covers two levels (Home and a flow), and the app already routes by state.

## Complexity Tracking

No violations. Nothing to justify.
