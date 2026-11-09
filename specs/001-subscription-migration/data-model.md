# Data Model: Subscription Migration

Entities from [spec.md](spec.md), stored on the device as described in [research.md](research.md) (R4).

## Account (in memory and inside Progress)

| Field | Type | Notes |
|-------|------|-------|
| id | string | Google account ID. Used for the same-account check (FR-008). |
| email | string | Shown on the step card. |
| name | string | Shown on the step card. |
| photoUrl | string or null | Shown on the step card. |
| role | `old` or `new` | Old gets `youtube.readonly`, new gets `youtube` (FR-009). |

Validation: `old.id` MUST NOT equal `new.id`.

## Progress (table `progress`)

| Column | Type | Notes |
|--------|------|-------|
| id | text, primary key | Random ID. |
| old_account_id | text | |
| old_email, old_name, old_photo_url | text | Saved so the old account can be shown without signing in again (R2). |
| new_account_id | text | |
| new_email, new_name, new_photo_url | text | |
| created_at, updated_at | integer | Unix ms. |
| limit_hit_at | integer or null | Set when the daily limit stops this progress. |

Constraints: unique (`old_account_id`, `new_account_id`) — one progress per pair (FR-031).

Derived: **unfinished** when any of its channels is `waiting` or `tomorrow` and picked (FR-032, FR-035). **Channels left** = count of picked channels in `waiting` or `tomorrow`.

A progress row is created when the user first signs in to a new account with an old account list loaded. Until then, the loaded old list lives in memory only.

## ProgressChannel (table `progress_channel`)

| Column | Type | Notes |
|--------|------|-------|
| progress_id | text | References `progress.id`, cascade delete. |
| channel_id | text | YouTube channel ID. |
| title | text | |
| thumbnail_url | text or null | |
| picked | integer (0/1) | Default 1 (FR-017). |
| status | text | See states below. |
| updated_at | integer | |

Primary key: (`progress_id`, `channel_id`).

## Setting (table `setting`)

| Column | Type | Notes |
|--------|------|-------|
| key | text, primary key | Only `reminderAsked` for now: set once the app has asked about reminders (FR-028). |
| value | text | |

## Channel status states

```text
waiting ──Move──▶ moving ──success / duplicate──▶ moved
   ▲                 │──quota hit──▶ tomorrow ──Continue──▶ waiting
   │                 │──4xx (not 401/429)──▶ couldnt_move
   └──network fail / crash recovery (not on target)──┘

any ──new account already follows it──▶ already_there
```

Rules:

- Only `picked = 1` channels in `waiting` are processed by Move or Continue (FR-027).
- `already_there` channels cannot be picked (FR-018) and are never processed.
- `moving` is written before each request and resolved after it; a `moving` row found at app start is resolved by checking the new account's list (R5).
- `moved` and `already_there` are final; nothing moves a channel out of them (SC-004).
- When the daily limit is hit, every picked `waiting` channel becomes `tomorrow`; Continue turns them back into `waiting`.

## Deletion

- Deleting a progress removes its row and all its channels (FR-034).
- Delete all data drops every progress and channel, signs out, and revokes access (FR-012).
- Signing out keeps progresses (spec edge case).
