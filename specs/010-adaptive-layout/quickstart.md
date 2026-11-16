# Quickstart: Check Adaptive Layout

How to prove the feature works. Rules are in [contracts/layout.md](contracts/layout.md); decisions are in [research.md](research.md).

## Automated checks

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

All three must pass. The new tests are `tests/components/windowChange.test.tsx`, `tests/components/twoPane.test.tsx`, `tests/components/largeText.test.tsx`, and `tests/unit/itemRow.test.ts`.

## Build (local only)

The orientation change is a build-time setting, so the Android project must be regenerated once.

```bash
npx expo prebuild --platform android
```

```bash
npx expo run:android
```

Then open `android/app/src/main/AndroidManifest.xml` and confirm the main activity has no `android:screenOrientation="portrait"` and no `android:resizeableActivity="false"` (research R3). If either is there, stop and report it.

## Devices

The owner has no foldable phone. Foldable checks run on an Android Studio emulator (a "Pixel Fold" or "Resizable" virtual device) or on a real foldable in a device cloud such as BitBar. Emulators with a resizable window are fine where a real device is not available.

| Device | Used for |
| --- | --- |
| Small phone, 320 to 360 points wide | Story 3 |
| Standard phone | Stories 2 and 4 (rotation, split-screen) |
| Book-style foldable, closed and open | Stories 1 and 2 |
| Flip-style foldable | Story 2 |
| Resizable emulator | Any size in between |
| A window 840 points wide or wider: an open foldable in landscape, a tablet emulator, or a large phone in landscape | Story 5 |

Without a wide device, a phone can report a wider window for a check: `adb shell wm density 300` makes most phones wider than 840 points in landscape. `adb shell wm density reset` puts it back.

## Checks

### 1. Open foldable (Story 1, SC-001, SC-005)

In a window 600 to 839 points wide, visit Home, From, Pick, To, and Settings. In a window 840 points wide or wider, visit Home and Settings (the flow is check 5).

- Content is in a centered column. Rows, section headings, the search box, the All row, and the Move button have the same left and right edges.
- The line under the top bar spans the window. The bar's icons line up with the column.
- The space beside the column has the screen background color, in the light and dark look.
- Nothing is under the camera cutout, rounded corners, or system bars, in portrait and landscape.

### 2. Keep my place (Story 2, SC-002, SC-004)

On a foldable or resizable emulator, with a GitHub account that has more than one kind of item:

1. Sign in to the old account. Fold and unfold while the sign-in code shows: the same code stays and sign-in still finishes.
2. On Pick: pick some items, collapse one section, type a search, scroll down. Fold, unfold, and rotate. The picks, the collapsed section, the search text, and at least one visible row are the same.
3. Open Settings, fold and unfold: Settings stays open.
4. Start a move of at least 20 items. Fold and unfold 20 times while it runs. The move finishes, and the totals match the number picked, with no item added twice.
5. Fold and unfold quickly several times: no error, no blank screen, layout settles within half a second.

Repeat steps 2 and 4 with YouTube.

### 3. Small phone and large text (Story 3, SC-003)

On a 320-point-wide window, then with the system font size and display size at their largest:

- Do the full flow: sign in to both accounts, pick, move. No control is cut off or out of reach.
- Long item names end with an ellipsis. The checkbox and the status of each row are visible.
- From, To, and Settings scroll when their content does not fit.
- The Move button is visible while the list scrolls, also when the summary and a notice show above it.
- Every control is easy to tap. With "Show layout bounds" (Android developer options), no tappable area is under 48 points.

### 4. Landscape and split-screen (Story 4)

- Rotate the phone: the app turns with it on every screen.
- Open the app in split-screen at the smallest and the largest split. On Pick, the action bar stays visible and the list scrolls in the space left.
- With the keyboard open in the search box, change the split: the typed text stays and the box is usable.

### 5. Two panes (Story 5, SC-006)

In a window 840 points wide or wider, open a platform:

1. From and To are on the left, Pick is on the right, the pair is centered. Pick shows "Sign in to your old account first".
2. Sign in to the old account on the left: the list loads on the right. The left pane does not change place.
3. Pick items, then press Move with no new account: the To part on the left asks for the new account, and the list stays.
4. Sign in to the new account and press Move. The move runs and finishes. No step in the top bar was tapped.
5. Touch a pane: its step is marked in the top bar. A notice shows in one place only.
6. Open Settings, then go Home: both use the centered column.
7. With picks, a collapsed section, and search text on Pick, make the window narrower than 840 (fold, rotate, or drag the split): Pick shows alone with all of these kept. Make it wide again: two panes, all kept.
8. Touch the left pane, then make the window narrow: From or To shows, and the picks are kept.
9. During a running move, change between one and two panes 20 times: the move finishes with the right totals.
10. On a large phone in landscape: the Move button is visible, the list scrolls, the left pane scrolls.

### 6. Nothing else changed (FR-014)

In a normal portrait phone window, every screen looks as it did before this feature, apart from larger touch targets.

## Not covered

- Devices whose hinge hides part of the screen (spec, edge case "Half-folded").
- iPad: support stays off.
