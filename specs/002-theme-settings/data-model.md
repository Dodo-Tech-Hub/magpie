# Data Model: Theme and Settings

Entities from [spec.md](spec.md). Storage follows the migration feature's [data model](../001-subscription-migration/data-model.md): no new table and no schema change.

## Theme choice (table `setting`, key `themeChoice`)

| Field | Type | Notes |
|-------|------|-------|
| key | text | Always `themeChoice`. |
| value | text | `light`, `dark`, or `system`. |

Rules:

- No row means `system` (the default, FR-004).
- A value that is not one of the three words is treated as `system` and is not shown as an error.
- Written each time the user taps a choice in Settings.
- Removed by "Delete all my data", because `deleteAll()` already runs `DELETE FROM setting` (FR-015). The in-memory choice is then set back to `system`.

## Look (resolved theme, in memory only)

| Field | Type | Notes |
|-------|------|-------|
| look | `light` or `dark` | From the choice. When the choice is `system`, from the phone's current mode; Light if the phone reports none. |
| colors | object | The named colors for that look (see [contracts/ui.md](contracts/ui.md)). |

Never saved. Recomputed whenever the choice or the phone's mode changes.

## App state addition (in memory only)

| Field | Type | Notes |
|-------|------|-------|
| settingsOpen | boolean | `false` at start. True shows Settings instead of the step view. Reset to `false` by `reset`. |

## State changes

```text
settingsOpen:  false ──tap gear──▶ true ──tap back / tap a step──▶ false
themeChoice:   system ──tap Light──▶ light ──tap Dark──▶ dark ──tap Auto──▶ system
any value ──Delete all my data──▶ no row (system)
```
