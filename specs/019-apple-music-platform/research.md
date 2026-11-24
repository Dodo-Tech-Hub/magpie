# Research: Apple Music Platform

Facts come from Apple's developer documentation, the Apple Developer Program License Agreement, and Apple developer forums, checked on 2026-11-23 and 2026-11-24. Each decision says how sure it is. **R1 is an open gate**: Part B MUST NOT start until the access check in [quickstart.md](quickstart.md), step 0, passes. Only the project owner can run it, because it needs an Apple Developer account and two Apple Music subscriptions.

## R1. Access check before Part B (OPEN GATE)

- **What is not confirmed by docs**: (1) MusicKit JS sign-in works inside the iOS system auth browser (`ASWebAuthenticationSession`) and returns a music user token to the page; (2) the API reads library songs, albums, and playlists and adds them with only a developer token and a music user token; (3) favorite artists can be read and added; (4) MusicKit JS `unauthorize()` ends the token on Apple's side; (5) Apple's speed limits in practice; (6) whether an account identity endpoint exists (R4).
- **Decision**: Part A builds the sign-in bridge page, the developer token script, and the web sign-in. Then the owner runs the check in [quickstart.md](quickstart.md), step 0, with [verify-access.sh](verify-access.sh). Results are written here as "Access check, run N".
- **If it fails**: sign-in fails in the auth browser: stop and report to the owner (Apple Music cannot ship without a working sign-in, because the spec rules out the device account). Favorites fail: favorite artists leave the scope, as the spec allows. Anything else fails: stop and report.

## R2. Sign-in: MusicKit JS in the system auth browser

- **Context**: The spec (FR-AM-005, Clarifications 2026-11-23) chose Apple's web sign-in on iOS so the device's Media & Purchases account never changes. Apple offers no OAuth or PKCE for Apple Music. The only web sign-in is MusicKit JS `authorize()`, which runs in a web page and gives the page a music user token.
- **Decision**: A static sign-in page (the "bridge") on the project's existing GitHub Pages site, `https://dodo-tech-hub.github.io/magpie/apple-music/sign-in.html`, built from `docs/apple-music/sign-in.html`. The app opens it with `expo-web-browser` `openAuthSessionAsync` (iOS `ASWebAuthenticationSession`, a system browser, not a WebView) and `preferEphemeralSession: true`. The page loads MusicKit JS unchanged from Apple's CDN, configures it with the developer token, calls `authorize()`, and redirects to `magpie://apple-music?state=…&token=…`. The auth session hands that URL back to the app only.
- **Developer token to the page**: passed in the URL fragment (`#dt=…`), which browsers never send to the server. The page is static and has no server code, so the music user token and the developer token never reach GitHub's servers.
- **State check (Principle III, rule 2)**: the app makes a random `state` (from `expo-crypto`, already in the Expo SDK) and passes it in the fragment. The app accepts the callback only if the URL starts with `magpie://apple-music`, `state` matches, and `token` is a non-empty string of at most 4,096 characters with no spaces.
- **Switching accounts (FR-AM-006)**: `preferEphemeralSession: true` gives every sign-in a fresh browser with no Apple cookies, so the old account is never remembered. The To step needs no extra sign-out step. If the check shows Apple still remembers the account, the page calls `unauthorize()` first when opened with `#signout=1`.
- **Sureness**: medium. MusicKit JS opens Apple's sign-in in a pop-up window; whether a pop-up works inside `ASWebAuthenticationSession` is the first row of the access check.
- **Alternatives considered**: Native MusicKit (`MusicAuthorization`): signs in only the device's account; ruled out by the spec. MusicKit JS in an in-app WebView: Principle III, rule 2 forbids sign-in in an embedded WebView. A page on a new host: the GitHub Pages site already exists and is static.

## R3. Developer token

- **Context**: Every API request needs a developer token: a JWT signed (ES256) with the MusicKit private key from the Apple Developer account, valid for at most 6 months. The private key is a secret (Principle III, rule 4). Apple's MusicKit JS design puts the signed developer token in web pages, so the token itself is public by design, like a client ID.
- **Decision**: The owner keeps the `.p8` key outside the repository and runs `node scripts/apple-music-token.mjs <key.p8> <keyId> <teamId>` locally. The script prints a token valid for 180 days. The owner puts it in the local `.env` as `EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN`. The app sends it as `Authorization: Bearer` and passes it to the bridge page in the fragment. It is never committed.
- **Expiry**: an API answer of 401 with a valid user token means the developer token expired. The driver returns `stop` with a plain notice ("Apple Music needs an app update"). `// ponytail: one 180-day token baked into each build, a new build every 6 months; a token server breaks Principle III, rule 5`.
- **Alternatives considered**: shipping the key and signing in the app (breaks rule 4). A token server (breaks rule 5). Native MusicKit automatic token generation (needs native MusicKit, ruled out by the spec).

## R4. Account identity and the same-account check

- **Context**: The driver contract needs an account `{ id, handle, name, photoUrl }` and FR-AM-007 refuses the same account on From and To. The Apple Music API documents no endpoint that returns the user's Apple Account ID, name, or email. Library item IDs (`i.…`, `l.…`, `p.…`) are unique per user library.
- **Decision**: The account ID is a fingerprint: the SHA-256 (`expo-crypto`) of the sorted IDs of the user's first 25 library playlists and first 25 library songs, read right after sign-in, plus the storefront. The handle shown on the card is "Apple Music · <country>" with the library counts ("1,234 songs, 12 playlists"); the name is the account role ("Old account" or "New account"); no photo. Same-account check: the new account is refused if any library ID read for the fingerprint is also in the old account's fingerprint set. An empty library fingerprints as `empty:<storefront>`, and two empty libraries are not refused.
- **Resume**: the driver keeps the new account's token (`resumesNew: true`), so Continue normally needs no sign-in. If the token is gone and the user signs in again, the new account is accepted for the saved progress when its library holds any item the progress already moved; otherwise it is refused as a different account. `// ponytail: fingerprint, not a real account ID; switch to Apple's identity endpoint if the access check finds one`.
- **Sureness**: medium. The access check tries `GET /v1/me/social-profile` (row 7). If it returns a stable ID, it replaces the fingerprint.
- **Alternatives considered**: ask the user to name each account (more taps, no real check). Use the user token as ID (it changes each sign-in).

## R5. Tokens, storage, and sign-out

- **Decision**: Old account token in memory only, dropped after `listOld` (as GitHub). New account token in `expo-secure-store` under one key, deleted at the summary when nothing is left, on Sign out, on Start again, and on Delete all (FR-AM-014). Apple has no token revoke API for music user tokens. On sign-out the app deletes the token; if the access check confirms `unauthorize()` ends it on Apple's side, the app also opens the bridge with `#signout=1` and the token in the fragment, in an ephemeral session, without asking the user to act.
- **Cost (Principle III, rule 3)**: if `unauthorize()` does not end the token, the token stays valid on Apple's side until it runs out (about 6 months), even though the app deleted it. Needs owner approval as an exception, like GitHub's (Complexity Tracking).

## R6. Access (Principle III, rule 1)

- **Finding**: Apple Music has no scopes. A music user token reads and adds to the whole library of the account.
- **Decision**: Least access the platform offers: the old account's token is used only to read and is never saved; the new account's token is used only to add. No call removes or changes anything on either account (FR-AM-010; Apple's API has no delete for library items or playlists anyway).
- **Cost**: the old account's token could add to its library. Needs owner approval as an exception (Complexity Tracking).

## R7. Reading the old library

- **Decision**: `GET /v1/me/library/songs`, `/albums`, `/playlists` with `limit=100`, following `next` until it is missing. Songs and albums use `include=catalog`; the catalog ID comes from the `catalog` relationship, else `attributes.playParams.catalogId`. An item with no catalog ID is uploaded or matched: listed as not movable with the reason "Not from Apple Music" (FR-AM-008).
- **Playlists**: `attributes.canEdit` true = made by the user; its songs come from `GET /v1/me/library/playlists/{id}/tracks` (paged), kept in order as catalog IDs. `canEdit` false with `attributes.playParams.globalId` = added from Apple or another user; moved by its global ID. Folders are skipped.
- **Storefront**: `GET /v1/me/storefront` for each account.
- **Large libraries**: 5,000 songs = 50 reads. Reads are not paced, but a 429 waits for `Retry-After` (R9). `listOld` reports progress through the existing loading state; Cancel uses the existing abort signal.

## R8. Adding to the new library

- **Songs and albums**: `POST /v1/me/library?ids[songs]=<catalogId>` (or `ids[albums]`). 202 = moved.
- **Shared playlists**: `POST /v1/me/library?ids[playlists]=<globalId>`.
- **Own playlists (FR-AM-010, FR-AM-011)**: `POST /v1/me/library/playlists` with the name and no tracks; the new playlist ID is saved at once in the item's `data`. Then `POST /v1/me/library/playlists/{newId}/tracks` with up to 100 catalog songs per request, in order, each request asked of the pacer first; `added` is saved after each request. After a stop, the add starts from `added` in the same playlist. Songs not in the new storefront are skipped and counted in the row note.
- **Region**: `checkNew` loads the new storefront once and looks up all picked catalog IDs in batches of 300 (`GET /v1/catalog/{storefront}/songs?ids=…`, same for albums). Missing IDs are kept in memory; `add` returns `couldnt_move` "Not available in your region" for them without a request.
- **Already there**: `checkNew` reads the new library's songs, albums, and playlists (catalog IDs and global IDs) once. Own playlists are never "already there": Apple allows repeated names (spec edge cases).
- **Favorite artists**: only if the access check passes row 6. Otherwise the kind is not in the driver.

## R9. Answers and pace

| Answer | Outcome |
| --- | --- |
| 200, 201, 202, 204 | `moved` |
| 401 with a user token that worked before | `auth` (sign-in ran out) |
| 401 on every call | `stop` "Apple Music needs an app update" (developer token expired, R3) |
| 403 | `stop` "Turn on Sync Library and an Apple Music subscription for this account" |
| 404 or 400 for one item | `couldnt_move` "No longer on Apple Music" |
| 429 | `wait` for `Retry-After` seconds, else 60 seconds |
| 500 to 504, network error | `retry` |

- **Pace**: Apple publishes no numbers. The driver sets `pace: { perMinute: 60, perHour: 3000 }`. `createPacer` reads these numbers from the driver instead of its GitHub constants (the GitHub driver passes 20 and 300, so GitHub does not change). `// ponytail: guessed numbers, tune from the access check and real runs`.
- **Batching**: one request per song or album. `// ponytail: one add per item; add up to 100 per request if large libraries feel slow`.

## R10. iOS only

- **Decision**: The platform entry sets `ready: Platform.OS === 'ios'`. Home already shows only ready platforms, so Android shows no card and never loads the sign-in (FR-AM-016, SC-007). No other code checks the OS.

## R11. URL scheme

- **Decision**: `app.config.ts` gets `scheme: 'magpie'`. The callback reaches the app through the auth session's return value, not through `Linking`, so the app adds no deep link listener and handles no route (Principle III, rule 8). A `magpie://` link opened from elsewhere only opens the app.

## R12. Logo and limits page

- **Logo**: the owner exports the Apple Music icon from the [Apple Music Identity Guidelines](https://marketing.services.apple/apple-music-identity-guidelines) into `assets/platforms/apple-music.png`, unmodified (FR-AM-015).
- **Limits page**: `docs/limits/apple-music.md` on the same site, linked from `limitsUrl`, says why both accounts need a subscription, why only iOS, and what cannot move.
