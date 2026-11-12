# Research: Platform Picker

## R1. Routing between Home and a flow

- **Decision**: Add `platform: PlatformId | null` to app state. `null` shows Home. `App.tsx` picks the screen from `settingsOpen`, then `platform`, then the existing `step`.
- **Rationale**: The app already routes by reducer state with no navigation library. Two levels (Home, flow) need one field. Back from a flow sets `platform` to `null` and keeps every other field, so no data is lost (FR-010).
- **Alternatives considered**: React Navigation or Expo Router: a new architecture for one extra level, and constitution IV asks for a restructure proposal first. Rejected for now. Spec 005 adds a second flow; revisit only if a third level appears.

## R2. The list of platforms

- **Decision**: One exported array of `Platform` entries in `src/platforms/platforms.ts`. Home filters by `ready` and groups by `section`. Each entry carries its own `open` and `unfinished` functions.
- **Rationale**: FR-003 and SC-003: adding or moving a platform is one entry. Functions on the entry avoid an `if (platform === ...)` chain in Home (constitution IV, flat logic).
- **Alternatives considered**: A JSON file: cannot hold functions, and Home would need a lookup table anyway. A class per platform: more code for the same result.

## R3. Grid that never cuts off cards

- **Decision**: `FlatList` per section with `numColumns = clamp(floor(width / (160 * fontScale)), 1, 3)` from `useWindowDimensions()`. The key includes the column count so the list re-lays when it changes. Card height grows with its text; no fixed height.
- **Rationale**: Covers small phones, large text, rotation, and theme changes (spec US1 scenario 4, edge cases, SC-004) with React Native only. Also gives wide screens more columns, which spec 007 (adaptive layout) can build on.
- **Alternatives considered**: Fixed two columns: breaks at large font sizes. A grid library: a new dependency for one formula.
- **Note**: Home is a scroll view holding two short `FlatList`s with `scrollEnabled={false}`. The platform count is small, so no virtualization is needed.

## R4. Continue note for YouTube

- **Decision**: The YouTube entry's `unfinished()` calls `listUnfinished()` and returns `{ left: sum of left, ids }`. Home shows the note when `left > 0`. Tap with one id calls `openProgress(dispatch, id)`. Tap with several ids opens the YouTube flow on the From step, which already lists unfinished progresses.
- **Rationale**: Matches the clarified FR-007 and reuses the existing list and open logic. Home re-reads `unfinished()` each time it shows, so counts stay current after a move.
- **Alternatives considered**: A new list screen on Home: a second copy of the From step list.

## R5. Logos

- **Decision**: Ship the official YouTube logo as `assets/platforms/youtube.png`, taken unchanged from YouTube's brand resources by the project owner. `Image` with `accessibilityElementsHidden` because the card label already names the platform.
- **Rationale**: Constitution V and FR-012 require official, unmodified logos. The Ionicons `logo-youtube` glyph is a redrawn icon, not the official asset.
- **Alternatives considered**: Ionicons brand glyphs: not official. Rejected.
- **Asset**: `assets/platforms/youtube.png` is `yt_icon_red_digital.png` (full-color, 1255 x 1075) from YouTube's icon download at brand.youtube, unmodified.
- **Brand rules from the icon page** (checked 2026-11-12): keep clear space around the icon (measured by the triangle); no outline, stroke, drop shadow, custom colors, rotating, skewing, or stretching; use the black or white version when the red one is hard to see; the page states a digital minimum height of 100px.
- **Open question**: the 100px minimum may apply to the full logo only. At the planned card size (about 40px high) the icon would break it. The owner confirms with the Brand Guidelines page or YouTube before release. If it applies, the card logo is drawn at 100px high.
- **Owner to-do**: read the Brand Guidelines page for rules on use by other apps and on implying endorsement.

## R6. Home button in the flow

- **Decision**: The YouTube top bar gets a `home-outline` button on the left with label "Home". It dispatches `goHome`, which sets `platform: null` and closes Settings. The gear stays on the right.
- **Rationale**: FR-010 needs a way back from the flow. Android's back gesture also maps to `goHome` through `BackHandler` when a flow is open, so both platforms behave the same.
- **Alternatives considered**: Back only through the system gesture: iOS has no system back gesture for a non-stack screen.

## R7. Existing tests

- **Decision**: `tests/components/helpers.tsx` renders the app with `platform: 'youtube'` in the initial state, so existing component tests start where they did before.
- **Rationale**: SC-002 says existing tests pass with no change to what they check. Only the starting state helper changes.
