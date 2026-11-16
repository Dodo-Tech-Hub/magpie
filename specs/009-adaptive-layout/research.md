# Research: Adaptive Layout

**Date**: 2026-11-16 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Each decision was checked against the code on `main` at 6ff079a. Items marked "Check on device" could not be proven from the code and are steps in [quickstart.md](quickstart.md).

## What the code does today

| Area | Today | Effect on this feature |
| --- | --- | --- |
| Orientation | `orientation: 'portrait'` in `app.config.ts`, which puts `android:screenOrientation="portrait"` in the generated manifest. | Must change (FR-008). |
| Window changes | The generated manifest lists `orientation`, `screenSize`, `smallestScreenSize`, and `screenLayout` in `android:configChanges`. Android does not restart the app on fold, unfold, rotate, or split-screen resize. | State is kept without new code (FR-005, FR-007). |
| State | Step, accounts, items, move state, notice, and the sign-in code live in one reducer (`src/state/AppState.tsx`). Search text and collapsed sections live in `PickStep` state. | Kept as long as no screen is unmounted on a width change. |
| Safe areas | One `SafeAreaView` (`react-native-safe-area-context`) wraps the whole app in `App.tsx`. | Already covers cutouts and system bars in both orientations (FR-009). |
| Width | Every screen fills the window. Only `HomeView` reads the window width, for the number of card columns. | Needs the centered column (FR-003). |
| Scrolling | `HomeView` and the Pick list scroll. `FromStep`, `ToStep`, and `SettingsView` do not. | Content can be cut off on short windows or with large text (FR-010). |
| Fixed heights | Rows are 56 points high, buttons 40 to 44, and the list uses these heights to place rows. | Large text is clipped (FR-010, FR-011). |
| Touch targets | Several controls are under 48 points: the Switch, Copy, and Cancel buttons, the delete icon on From, the list's All checkbox, the Move and sign-in buttons (44). | Must grow (FR-013). |

## R1. How to build the centered column

**Decision**: One shared style, `column`, in a new file `src/ui/layout.ts`: full width, at most `MAX_CONTENT_WIDTH` (600) wide, centered. `App.tsx` puts it on the one view that holds every screen. `TopBar` and `HomeBar` keep a full-width outer view (for the bottom line) and put their content in an inner view with the same style.

**Rationale**: The breakpoint between Compact and Medium (600) equals the maximum width (600). So a width limit alone gives the right layout in every size class: under 600 the column fills the window as today (FR-004), and from 600 up it is centered (FR-003). No screen has to read the window width or re-render on a change. Three files get the style; no screen file changes for the column.

**Alternatives considered**:

- A `useSizeClass()` hook that every screen calls to pick styles. Rejected: Medium and Expanded have the same layout in this release, so nothing would branch on it. More code and more re-renders for the same result.
- A wrapper component around each screen. Rejected: seven places to edit, and easy to forget on a new screen.
- A responsive layout library. Rejected: a new dependency for one style rule (Principle IV, simplest solution first).

**Known limit**: the space beside the column does not scroll the list when dragged. Accepted: users drag the content.

## R2. Do we need size class code?

**Decision**: `src/ui/layout.ts` holds the shared values only: `MAX_CONTENT_WIDTH = 600`, `TOUCH_TARGET = 48`, and the `column` style. It does not add a `sizeClassFor(width)` function in this release.

**Rationale**: No code in this feature would call it (see R1). The constitution (Principle VI) says a screen that needs a different layout per size class must say so in its spec; the first such screen adds the function and the 840 breakpoint next to these values, in the same file, with its own tests. `HomeView` keeps its own column count, but now counts from the column width, not the window width.

**Alternatives considered**: Add the function and the hook now so they are ready. Rejected: unused code with only test callers (Principle IV, "is it needed at all").

**Owner decision**: if you want `sizeClassFor` in place now, it is about 5 lines and one unit test. Say so before the tasks step.

## R3. Rotation and split-screen

**Decision**: Change `orientation` in `app.config.ts` from `'portrait'` to `'default'`. No other config. After the change, the owner regenerates the Android project locally (`npx expo prebuild --platform android`) and rebuilds.

**Rationale**: `'default'` removes the portrait lock on both platforms. iPhone gets portrait and both landscapes; iPad stays off (`supportsTablet: false`). Android apps can be resized in split-screen by default when nothing in the manifest forbids it.

**Check on device**: after prebuild, `android/app/src/main/AndroidManifest.xml` must have no `android:screenOrientation="portrait"` and no `android:resizeableActivity="false"`. If either is still there, the plan adds a small config plugin entry; that is a task change, not a design change.

**Alternatives considered**: `expo-screen-orientation` to unlock at run time. Rejected: a new dependency for a build-time setting.

## R4. Keeping the user's place

**Decision**: No new code to save or restore state. The plan adds tests that change the window size in the middle of a flow and check that nothing is lost and nothing runs twice.

**Rationale**: Android does not restart the app on a window change (see the table above), iOS never does, and every piece of state in FR-005 lives in React state that survives a re-layout. A running move is a promise chain in `src/move/mover.ts` that does not read the window. The device-code sign-in polls from the same kind of chain. The native Google sign-in screen sits on top of the app and returns to the same running app.

The risk is future code that unmounts a screen when the width changes (for example a `key` that depends on the width on a screen's root). The tests guard that. `HomeView` already uses `key={columns}` on its card grid only, which holds no user input.

**Scroll position (FR-006)**: the Pick list is not unmounted, and row heights do not depend on the window width, so the scroll offset points at the same rows after a change. No code needed.

**Alternatives considered**: Save UI state to the store on every change and restore it. Rejected: there is no restart to restore from, except the system closing the app in the background, which feature 001 already covers.

## R5. Large text and fixed heights

**Decision**:

- List rows keep a known height so the list can place rows without measuring, but the height grows with the system font scale: `ROW_HEIGHT` and `LOCKED_HEIGHT` are multiplied by the font scale (never below 1). The font scale comes from `useWindowDimensions().fontScale`, so the list updates when the user changes the setting.
- Buttons and inputs change `height` to `minHeight`, so they grow with their text.
- In a Pick row, the name takes the free space and ends with an ellipsis (as today). The status tag may take at most 40% of the row and also ends with an ellipsis. The checkbox never shrinks.
- `FromStep`, `ToStep`, and `SettingsView` become scroll views.
- The three step labels in `TopBar` get one line with an ellipsis.

**Rationale**: Keeping a known row height keeps the long list fast and keeps the scroll position exact (R4). Scaling it is one multiplication. `minHeight` is the smallest change that lets text grow.

**Alternatives considered**:

- Limit text growth with `maxFontSizeMultiplier`. Rejected: the spec requires the largest system font size to work (FR-010).
- Let rows measure themselves (drop `getItemLayout`). Rejected: slower on lists of 1,000 items and the scroll position can jump after a window change.

## R6. Touch targets

**Decision**: One value for both platforms, `TOUCH_TARGET = 48`, in `src/ui/layout.ts`. Every control gets `minHeight: TOUCH_TARGET` (and `minWidth` for icon-only controls). Icon-only controls inside a fixed-height row use `hitSlop` when growing them would change the row.

**Rationale**: 48 meets the Android rule (48) and the iOS rule (44). One number is simpler than a per-platform value, and 4 extra points on iOS are not visible in this design.

**Alternatives considered**: `Platform.select({ ios: 44, android: 48 })`. Rejected: two layouts to test for no user benefit.

## R7. Hinges that hide content

**Decision**: Not built in this feature. The app reads the window size only.

**Rationale**: Reading the hinge position needs Android's Jetpack WindowManager, which Expo SDK does not expose. It would take a new native dependency or custom native code. Current book-style and flip-style foldables have one continuous screen with no hidden area, and the centered column keeps content away from the screen edges, not the middle. Devices with a real gap between two screens are rare and not in the test matrix.

**Conflict with the spec**: the edge case "Half-folded" says that on a device with a hinge that blocks content, the column must not cross it. This plan does not meet that sentence. It is listed in the plan as an exception that needs the owner's approval, with a proposed spec edit.

**Alternatives considered**: Add a fold-aware library now. Rejected: a native dependency (Principle III.11, Principle IV) for devices outside the test matrix.

## R8. How to test layout in Jest

**Decision**: Three kinds of automated tests, and a device checklist for the rest.

| Kind | What it checks | How |
| --- | --- | --- |
| Keep my place | Picks, search text, collapsed sections, the step, Settings, a waiting sign-in code, and a running move survive a window change, and no add call is repeated. | Render the app, act, change the mocked window size (Compact to Medium and back), check the screen. Same mock style as `tests/components/homeLayout.test.tsx`. |
| Size rules | Home shows the right number of card columns at Compact and Medium widths, counted from the column width. Row height grows with the font scale. | Existing `homeLayout` and `gridColumns` tests extended; one unit test for the row height. |
| Reachability | From, To, and Settings content sits in a scroll view; names and tags are limited to one line. | Component tests on the rendered tree. |

Jest does not compute real layout, so "nothing overlaps" and "nothing under the cutout" are checked on devices ([quickstart.md](quickstart.md)).

**Rationale**: Principle II asks for tests of behavior the user sees. The keep-my-place tests are that. Principle VI asks for at least one Compact and one Medium or wider window per changed screen; the window-change tests cover both for every screen they visit.

**Alternatives considered**: Screenshot tests on emulators. Rejected for now: a new tool and a new CI need for a one-column layout. Can be its own feature if layouts grow.
