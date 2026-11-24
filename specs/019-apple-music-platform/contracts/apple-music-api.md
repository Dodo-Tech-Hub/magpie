# Contract: Apple Music Calls

Every call the Apple Music driver makes. Host: `api.music.apple.com`, HTTPS only. Artwork loads from Apple's artwork hosts (`*.mzstatic.com`) through `Image`. Headers on every call: `Authorization: Bearer <developer token>` and `Music-User-Token: <user token>`.

Developer token: `EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN` (research R3). Sign-in: [sign-in-bridge.md](sign-in-bridge.md).

## Who signed in

| Call | Fields used | Checked before use |
| --- | --- | --- |
| `GET /v1/me/storefront` | `data[0].id` (for example `vn`) | Two lowercase letters. |
| `GET /v1/me/library/playlists?limit=25` and `GET /v1/me/library/songs?limit=25` | `data[].id` | Strings. Used for the fingerprint (research R4). |
| `GET /v1/me/social-profile` (only if the access check finds it) | `data[0].id` | String. Replaces the fingerprint. |

## Read (old account)

All reads page with `limit=100` and follow `next` until it is missing.

| What | Call | Fields used |
| --- | --- | --- |
| Library songs | `GET /v1/me/library/songs?include=catalog` | `id`, `attributes.name`, `attributes.artistName`, `attributes.artwork.url`, `attributes.playParams.catalogId`, `relationships.catalog.data[0].id` |
| Library albums | `GET /v1/me/library/albums?include=catalog` | Same as songs. |
| Library playlists | `GET /v1/me/library/playlists` | `id`, `attributes.name`, `attributes.canEdit`, `attributes.artwork.url`, `attributes.playParams.globalId` |
| Songs of an own playlist | `GET /v1/me/library/playlists/{id}/tracks?include=catalog` | Catalog ID as for songs, in order |
| Favorite artists (only if the access check passes) | Endpoint from the access check | Catalog artist ID, name |

`{w}x{h}` in artwork URLs is replaced with `120x120`. Every field is shape-checked; an item that fails the check is skipped and counted in `missing`.

## Check (new account, reads only)

| What | Call | Used for |
| --- | --- | --- |
| Storefront | `GET /v1/me/storefront` | Region lookups |
| Region | `GET /v1/catalog/{storefront}/songs?ids=…` and `/albums?ids=…`, at most 300 IDs per call | IDs missing from the answer are not in the region |
| Already there | Library songs, albums, playlists of the new account, as in Read | Catalog IDs and global IDs the new account has |

## Add (new account)

| Item | Call | Body |
| --- | --- | --- |
| Song | `POST /v1/me/library?ids[songs]=<catalogId>` | none |
| Album | `POST /v1/me/library?ids[albums]=<catalogId>` | none |
| Shared playlist | `POST /v1/me/library?ids[playlists]=<globalId>` | none |
| Artist (only if confirmed) | Endpoint from the access check | From the access check |
| Own playlist, create | `POST /v1/me/library/playlists` | `{ "attributes": { "name": "<name>" } }`. Answer `data[0].id` is saved as `newId` at once. |
| Own playlist, songs | `POST /v1/me/library/playlists/{newId}/tracks` | `{ "data": [{ "id": "<catalogId>", "type": "songs" }, …] }`, at most 100 per call, in order |

The driver never calls `DELETE`, `PATCH`, or `PUT`.

## Answer to outcome

| Answer | Outcome | Row text |
| --- | --- | --- |
| 200, 201, 202, 204 | `moved` | Moved. Own playlists add "N songs not in your region" when some were skipped. |
| Catalog ID missing from the region lookup | `couldnt_move` | "Not available in your region" |
| No catalog ID | `couldnt_move` (set at read) | "Not from Apple Music" |
| 400 or 404 for one item | `couldnt_move` | "No longer on Apple Music" |
| 401, and the same token worked before | `auth` | Sign-in line on To |
| 401 on the first call of a session | `stop` | "Apple Music needs an app update" |
| 403 | `stop` | "Turn on Sync Library and Apple Music for this account" |
| 429 | `wait` | `Retry-After` seconds, else 60 |
| 500 to 504, network error | `retry` | Shared "No internet" handling |

Raw Apple text is never shown on a row (driver contract rule).
