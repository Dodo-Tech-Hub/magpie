# Contract: UI changes for Theme and Settings

Builds on the [migration UI contract](../../001-subscription-migration/contracts/ui.md). All text comes from `src/strings.ts`; wording below is the intended text.

## Top bar change

- The bar keeps From, Pick, and To, sharing the width left over after a fixed-width slot at the right end.
- The slot holds one button:

| Settings state | Icon | Accessibility label |
|----------------|------|---------------------|
| Closed | gear (`settings-outline`) | "Settings" |
| Open | back arrow (`arrow-back`) | "Back" |

- The button has no text label (the icons are obvious and labeled for screen readers).
- Tapping the gear opens Settings. Tapping the back arrow closes it and shows the step the user was on.
- Tapping a step tab while Settings is open closes Settings and shows that step.
- While Settings is open, no step tab is shown as current.
- The button is enabled during a move.

## Settings view

Shown under the top bar in place of the step view.

| Part | What shows |
|------|-----------|
| Heading | "Settings" |
| Look | Label "Look", then an inline 3-way choice |
| Danger | Button with trash icon: "Delete all my data" |

Look choice (inline, one row of three buttons, role radio, the chosen one filled with the primary color and marked checked):

| Choice | Icon | Label |
|--------|------|-------|
| Light | `sunny-outline` | "Light" |
| Dark | `moon-outline` | "Dark" |
| Phone | `phone-portrait-outline` | "Auto" |

Rules:

- Tapping a choice changes the whole app at once and saves it. No confirmation.
- First open of the app: "Auto" is marked.
- "Delete all my data" keeps its current wording and confirmation: "This removes everything the app saved on this phone. It cannot be undone." with "Cancel" and "Delete". After Delete, Settings closes, the app shows the From step signed out, and the look goes back to "Auto".
- Rows are plain stacked blocks so a future option is one more block.

## From view change

- The "Delete all my data" button is removed from the From view. Everything else is unchanged.

## Colors

Two sets with the same names. Exact values are chosen in implementation; the unit test enforces contrast.

| Name | Used for | Light (today's value) | Dark (rule) |
|------|----------|-----------------------|-------------|
| `background` | Screens, top bar, rows | `#fff` | Near-black, not pure black |
| `text` | Main text | Near-black | Near-white |
| `muted` | Hints, labels, inactive icons | `#555` | Light gray, at least 4.5:1 on `background` |
| `border` | Lines between rows and bars | `#ccc` / `#ddd` | Dark gray |
| `primary` | Current step, filled choice, checkmarks | `#1a56db` | Lighter blue, at least 4.5:1 on `background` |
| `primarySoft` | Tint behind picked rows | `#e6f1fb` | Dark blue tint |
| `success` | Done, Moved | `#1b7f3b` | Lighter green, at least 4.5:1 |
| `danger` | Errors, delete | `#b3261e` | Lighter red, at least 4.5:1 |
| `warning` | Tomorrow | `#a35b00` | Lighter amber, at least 4.5:1 |
| `disabled` | Disabled buttons and text | `#aaa` / `#bbb` | Mid gray |

Text on a filled `primary` button uses a color with at least 4.5:1 on `primary` in both looks.

## Status bar

The status bar icons follow the resolved look (light icons on Dark, dark icons on Light).
