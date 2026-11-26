# Data Model: Bluesky Platform

Bluesky uses the version 2 store from spec 008 (`progress`, `progress_item`, `setting`, `add_log`). This feature adds one column to `add_log` (version 3) and defines what Bluesky puts in the shared fields. No new table.

## Store version 3

| Table | Change | Why |
| --- | --- | --- |
| `add_log` | New column `keep_until INTEGER NOT NULL DEFAULT 0`. The prune becomes `DELETE FROM add_log WHERE keep_until < now`. | GitHub keeps adds 1 hour (FR-GH-014), Bluesky 1 day (FR-BS-014, the daily pace). Research R10. |

Migration 2 to 3, in one transaction: `ALTER TABLE add_log ADD COLUMN keep_until ...`, then `UPDATE add_log SET keep_until = at + 3600000` (every existing row is GitHub's), then `PRAGMA user_version = 3`. A fresh install creates version 3. Versions 0 and 1 go through 2 first, as today.

`recordAdd(accountKey, at, keepMs)`: the pacer passes 1 day when its pace has a daily cap, else 1 hour.

## progress (Bluesky values)

| Field | Bluesky value |
| --- | --- |
| platform | `bluesky` |
| old_account_id, new_account_id | The DID, for example `did:plc:...`. Never the handle (FR-BS-007). |
| old_handle, new_handle | The handle without `@`, for example `alice.bsky.social`. Updated when the account is looked up again and its handle changed. |
| old_name, new_name | Display name, or the handle when it is empty. |
| old_photo_url, new_photo_url | Picture URL on `cdn.bsky.app`, else null. |

## progress_item (Bluesky values)

`item_id` is `<kind>:<id>`, so the same account can be both a follow and a block row.

| Kind | item_id | title | thumbnail_url | data (JSON, checked on read) |
| --- | --- | --- | --- | --- |
| person | `person:<did>` | Display name, or handle | Avatar on `cdn.bsky.app` | `{ "did": string, "handle": string, "seq": number }` |
| block | `block:<did>` | Display name, or handle | Avatar | `{ "did": string, "handle": string, "seq": number }` |
| list | `list:<at-uri>` | List name | List avatar | `{ "purpose": "curatelist" \| "modlist", "description": string, "members": string[] (DIDs), "gone"?: number (members already gone when read), "seq": number }` |
| mute | `mute:<did>` | Display name, or handle | Avatar | `{ "did": string, "handle": string, "seq": number }` |
| feed | `feed:<at-uri>` | Feed or list name | Feed avatar | `{ "type": "feed" \| "list", "value": string (at-uri), "pinned": boolean, "seq": number }` |

`seq` is the item's place in the old account, 0 for the oldest (research R7). The driver's `itemOrder` sorts by it, so the move adds oldest first (FR-BS-010). Pick keeps its order by title.

Rules:

- Every DID in `data` matches `^did:plc:[a-z2-7]{24}$`. Every at-uri starts with `at://did:plc:`. Rows that fail are dropped on read, never sent.
- A list's `members` holds at most what the list had when it was read. Members are not rows; the list row's `reason` says how many were left out (FR-BS-018).
- Muted people and saved feeds are private. They are kept like the other rows and deleted with the progress and by Delete all (III.6). They are never logged (III.7).

## Sessions (secure storage and memory)

Not in SQLite. Research R3.

| Key | Where | Value | Written | Deleted |
| --- | --- | --- | --- | --- |
| `bluesky.session.<did>` (and `.2`, `.3` when split; the DID has every character other than letters, digits, dots, dashes, and underscores changed to `_`) | `expo-secure-store` | The client's session JSON: DPoP private key, token set, granted scopes. | New account sign-in, each token refresh. | Sign out, Delete all, "Don't save". Revoked first (FR-BS-013). |
| old session | Memory | Same shape. | "Allow" sign-in (FR-BS-020). | Right after mutes and feeds are read. Revoked first. |
| sign-in state | Memory, 10 minutes | PKCE verifier, DPoP key, `state`. | Sign-in starts. | Sign-in ends or is cancelled. |

`granted()` reads the kinds from the saved session's scope string (research R6). `canAct('new', did)` is true when `bluesky.session.<did>` exists and its refresh token has not run out.

## App state (memory)

| Field | Meaning |
| --- | --- |
| `oldRead: string[]` | Kinds with `needsOld` that were read in this app run. A `needsOld` kind with no rows and not in `oldRead` shows greyed with "Allow". One that was read and had nothing shows nothing. |

`// ponytail: oldRead is not saved, so after a restart an empty Mutes or Feeds section asks for "Allow" again; save it on the progress if users notice.`

## Item states

Unchanged from spec 008. "Already there" also covers a follow or block of the new account itself (research R9).
