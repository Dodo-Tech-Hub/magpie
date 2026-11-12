# Implementation Plan: Platform Picker (Automatic First)

**Branch**: `feature/multi-platform-picker` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-multi-platform-picker/spec.md`

## Summary

Add a Home screen in front of the existing YouTube flow. Home is a grid of platform cards in two sections (Automatic, Guided), built from one list of platforms. At launch the list holds one ready platform, YouTube, so only the Automatic section shows. Tapping the YouTube card opens the existing flow unchanged. A card shows a Continue note when that platform has unfinished progress. The YouTube flow gets one new control: a Home button in its top bar.

Technical approach:

- **Platform list**: one typed array in `src/platforms/platforms.ts`. Each entry has id, name, logo, label, section, ready, and two functions: `open(dispatch)` and `unfinished()`. Home reads only this list (FR-003, SC-003). See [contracts/platform-list.md](contracts/platform-list.md).
- **Routing**: no navigation library. App state gets one new field, `platform: PlatformId | null`. `null` means Home. `App.tsx` shows Home, Settings, or the YouTube steps from that field (research R1).
- **Home**: `src/ui/HomeView.tsx` and `src/ui/PlatformCard.tsx`. A `FlatList` per section with a column count from the window width and font scale, so cards never get cut off (R3).
- **Continue note**: the YouTube entry's `unfinished()` sums `left` from the existing `listUnfinished()`. One progress: tap calls the existing `openProgress()`. Several: tap opens the YouTube flow on the From step, where the existing Unfinished list lives (R4).
- **Reminders**: `openProgress()` also sets `platform: 'youtube'`, so a reminder still skips Home (FR-009).
- **Logos**: official YouTube icon at `assets/platforms/youtube.png`, unmodified. Size rule is an open question for the owner (R5).

## Technical Context

**Language/Version**: TypeScript (strict), React Native 0.88 via Expo SDK 58 (unchanged)

**Primary Dependencies**: None added. `FlatList`, `useWindowDimensions`, and `PixelRatio.getFontScale()` come from React Native. Icons from `@expo/vector-icons` (already used).

**Storage**: No change. Home reads the existing `progress` tables through `listUnfinished()`. Delete all already removes every table the app has (FR-011); spec 005 extends `deleteAll()` for its own tables.

**Testing**: Jest with `jest-expo` and React Native Testing Library. New: platform list unit test (sections, ready filter, YouTube entry), Home component tests (sections hidden or shown, card labels, Continue note for 0, 1, and several progresses, tap routing, large font scale), TopBar Home button test, reminder still opens progress directly. All existing tests pass with no change to what they check (SC-002); `tests/components/helpers.tsx` starts tests inside the YouTube flow so existing tests keep their starting screen.

**Target Platform**: Android 8.0+ first, iOS 16+. No platform-specific behavior (FR-014).

**Project Type**: Mobile app (single Expo project, no backend)

**Performance Goals**: Home shows in the same frame as today's first screen. `listUnfinished()` is one SQLite query.

**Constraints**: No new network host, permission, stored data, or dependency. All text in `src/strings.ts`. Theme colors from `src/theme/`.

**Scale/Scope**: 1 new folder (`src/platforms/`), 3 new files, 5 edited files (`App.tsx`, `src/state/AppState.tsx`, `src/state/flows.ts`, `src/ui/TopBar.tsx`, `src/strings.ts`), 1 logo asset, about 4 test files new or extended.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.3.0.

| Principle / rule | How the plan complies | Status |
|------------------|-----------------------|--------|
| I. New screen justified | Home is the one new screen. It is the approved exception for the platform picker (grid of cards in two sections). Settings stays the existing view. | Pass |
| I. Card content | Logo, name, one-line label on each card (FR-002). | Pass |
| I. Icons and labels | Home button in the top bar uses `home-outline` with label "Home". Continue note uses `time-outline` and a text label. | Pass |
| I. Simple words | "We move them for you", "Step-by-step guide", "Continue: 12 left", "Home". | Pass |
| I. Accessibility labels | Card label reads name and line (FR-006). Continue note has its own label. | Pass |
| I. Confirmations | None added. | N/A |
| II. Tests | Unit and component tests listed above. Existing tests unchanged in what they check. | Pass |
| III.1 to III.4 | Sign-in, scopes, tokens, and secrets untouched. | Pass |
| III.5 Network | No new host. | Pass |
| III.6 Data | No new data. Delete all unchanged and still covers every table. | Pass |
| III.7 to III.12 | No logging, input, permission, backup, dependency, or OTA change. | Pass |
| IV. One home per thing | New folder `src/platforms/` because no existing folder owns "which platforms the app supports". Screens go in `src/ui/`. | Pass |
| IV. Extend, do not patch | YouTube steps are untouched. The new route is one state field and one switch in `App.tsx`. The Home button belongs to the top bar's navigation job. | Pass |
| IV. Flat logic | Card tap and section lookups use the platform list, not `if` chains. | Pass |
| V. Logos | Official, unmodified, used only to name the platform. Owner checks before release. | Pass |

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
│   └── requirements.md  # From the specify step
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
App.tsx                      # route: Home, Settings, or the YouTube steps
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
    ├── HomeView.tsx         # grid in two sections (new)
    ├── PlatformCard.tsx     # one card with optional Continue note (new)
    └── TopBar.tsx           # Home button
tests/
├── unit/platforms.test.ts            # (new)
└── components/
    ├── home.test.tsx                 # (new)
    ├── topBar.test.tsx               # Home button (extended)
    └── helpers.tsx                   # start inside the YouTube flow (extended)
```

**Structure Decision**: Keep the single Expo project. Add `src/platforms/` for the platform list (constitution IV, new folder justified above). No navigation library: one more state field covers two levels (Home and a flow), and the app already routes by state.

## Complexity Tracking

No violations. Nothing to justify.
