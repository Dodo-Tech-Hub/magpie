# Contract: Shared Layout

What `src/ui/layout.ts` provides and what every screen must do. New screens follow this file and constitution Principle VI; they do not define their own values.

## Shared values

| Name | Value | Use |
| --- | --- | --- |
| `MAX_CONTENT_WIDTH` | 600 | The widest the content column can be, in points. |
| `TOUCH_TARGET` | 48 | The smallest width and height of anything the user can tap, on both platforms. |
| `column` | Style: full width, at most `MAX_CONTENT_WIDTH`, centered | Put on a view to make it the content column. |
| `EXPANDED_WIDTH` | 840 | The window width from which the move flow shows two panes. |
| `SIDE_PANE_WIDTH` | 360 | The width of the left pane (From and To). |
| `panes` | Style: a row, at most `SIDE_PANE_WIDTH + MAX_CONTENT_WIDTH` wide, centered | Used by `FlowView` and `TopBar` when two panes show. |
| `useTwoPane()` | True when the window is `EXPANDED_WIDTH` wide or wider | The only width check for the size class. Used by `FlowView` and `TopBar`. |

Size classes are Compact below 600, Medium 600 to 839, Expanded 840 and above. Compact and Medium need no code, because the column limit equals the Compact boundary. Expanded has one check, `useTwoPane()`. A screen that needs another layout per size class says so in its spec and adds its check to `layout.ts`.

## Where the column is applied

| Place | Rule |
| --- | --- |
| `App.tsx` | The view that holds Home or Settings has the `column` style. Screens inside it do nothing for width. The move flow is `FlowView`. |
| `FlowView` | One pane: the `column` style around the current step. Two panes: the `panes` style, the left pane `SIDE_PANE_WIDTH` wide in a scroll view, the right pane fills the rest. |
| `TopBar`, `HomeBar` | The outer view spans the window and draws the bottom line. The content sits in an inner view with the `column` style. `TopBar` uses the `panes` width when two panes show (flow open, Settings closed, `useTwoPane()` true). |
| Root background | The root view fills the window with the screen background color, so the space beside the column has that color. |

## Rules for every screen

1. Do not read the device model or type. Do not set a width from the window; fill the column.
2. Do not put a `key` that depends on the window size on a screen's root or on anything that holds user input. A window change must not unmount it.
3. The screen's content must scroll when it does not fit, except a bar that must stay visible (for example the Pick action bar).
4. Use `minHeight`, not `height`, on anything that contains text. A list that needs known row heights multiplies them by the system font scale.
5. A one-line label that can be long ends with an ellipsis and must not push a control out of its row.
6. Every tappable control is at least `TOUCH_TARGET` in width and height, by size or by `hitSlop`.
7. Do not add safe-area padding in a screen. The app shell does it once.
8. If a number of columns or items per row depends on width, count it from the column width (the smaller of the window width and `MAX_CONTENT_WIDTH`).

## Rules for the two-pane flow

1. Only `FlowView` decides between one and two panes. From, To, and Pick do not read the window width or know which layout shows.
2. `PickStep` keeps the same parent and `key` in both layouts. A change between one and two panes must not unmount it while Pick is on screen before and after.
3. The current step is `state.step`. A pane sets it with the existing `setStep` action on touch. No second value for "where the user is".
4. A step shows `state.notice` only when it is the current step.
5. Home and Settings never show two panes.

## Tests a changed screen needs

- One test that renders it in a Compact window and one in a Medium or wider window (constitution Principle VI).
- If it is part of the move flow: one test in an Expanded window.
- If it holds user input or shows running work: one test that changes the window size and checks that nothing is lost and nothing runs twice.
