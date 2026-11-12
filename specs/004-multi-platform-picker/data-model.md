# Data Model: Platform Picker

No stored data is added. This feature adds one in-code list and one state field.

## Platform (in code, `src/platforms/platforms.ts`)

| Field | Type | Rule |
| --- | --- | --- |
| `id` | `PlatformId` (string union, for example `'youtube'`) | Unique. Used as the state value and the list key. |
| `name` | `string` from `strings` | Shown on the card. |
| `label` | `string` from `strings` | One short line, for example "We move them for you". |
| `logo` | image module (`require('../../assets/platforms/<id>.png')`) | Official, unmodified (FR-012). |
| `section` | `'automatic' \| 'guided'` | Which Home section holds the card. Moving a platform is a change to this field only. |
| `ready` | `boolean` | `false` hides the card. A section with no ready card is hidden (FR-001). |
| `open` | `(dispatch) => void` | Opens the platform's flow. |
| `unfinished` | `() => Promise<{ left: number; ids: string[] }>` | Feeds the Continue note. `left` is the total left across all unfinished progresses. |

Order of the array is the order on Home.

## App state change (`src/state/AppState.tsx`)

| Field | Type | Rule |
| --- | --- | --- |
| `platform` | `PlatformId \| null` | `null` shows Home. Initial value `null`. `reset` returns to `null`. |

New actions:

| Action | Effect |
| --- | --- |
| `openPlatform { platform }` | Sets `platform`, closes Settings. Keeps the rest of the state. |
| `goHome` | Sets `platform` to `null`, closes Settings. Keeps the rest of the state (FR-010). |

`openProgress()` in `src/state/flows.ts` dispatches `openPlatform { platform: 'youtube' }` first, so a reminder opens the progress directly (FR-009).

## Screen choice

| `settingsOpen` | `platform` | Screen |
| --- | --- | --- |
| true | any | Settings |
| false | `null` | Home |
| false | `'youtube'` | YouTube top bar and current step |

## Progress (existing, read only)

Defined in `specs/001-subscription-migration/data-model.md`. Home reads it only through `listUnfinished()`.
