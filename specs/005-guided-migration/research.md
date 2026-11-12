# Research: Guided Migration

## R1. Where the guided flow lives

- **Decision**: A Guided platform's `open` (spec 004 list) dispatches `openPlatform`. `App.tsx` shows `GuidedFlow` for any platform whose section is `guided`. `GuidedFlow` keeps the current part (intro, data, checklist, finished) in local `useState`. On open, it starts on the checklist when `guided_progress` has a row for the platform, else on the intro.
- **Rationale**: One shared screen for all Guided platforms (FR-002). Parts are shown in place, not as routes (constitution I). The YouTube reducer does not grow guided fields (constitution IV).
- **Alternatives considered**: Adding guided steps to the global reducer: mixes two flows. A navigation library: same reason as spec 004 R1.

## R2. Twitch sign-in

- **Decision**: Device Code Grant Flow (DCF) as a public client.
  1. `POST https://id.twitch.tv/oauth2/device` with `client_id` and `scopes=user:read:follows`.
  2. Open the returned `verification_uri` (`https://www.twitch.tv/activate?...` with the code in the link) with `expo-web-browser` (system browser).
  3. Poll `POST https://id.twitch.tv/oauth2/token` with `client_id`, `scopes`, `device_code`, `grant_type=urn:ietf:params:oauth:grant-type:device_code` at the given `interval`, while the sign-in screen is open, until success, `expires_in`, or the user cancels. `authorization_pending` means keep waiting.
  4. Read the user id (`GET https://api.twitch.tv/helix/users`), then `GET https://api.twitch.tv/helix/channels/followed?user_id=...&first=100`, following `pagination.cursor` until empty. Fields used: `broadcaster_login`, `broadcaster_name`, `followed_at`.
  5. `POST https://id.twitch.tv/oauth2/revoke` with `client_id` and `token`, in a `finally`, then drop the token and refresh token from memory.
- **Rationale**: Twitch docs say DCF "allows for public and confidential client types". The code flow requires `client_secret` and there is no PKCE. Sign-in stays in the system browser and the app never sees the password. The token lives only for one read (clarification).
- **Alternatives considered**: Implicit grant: Twitch docs conflict on whether public clients may use it, and it puts the token in a redirect URL. Code flow with a shipped secret: breaks constitution III.4. A backend for the exchange: breaks the no-backend rule.
- **Constitution**: needs the III.2 exception in [plan.md](plan.md).
- **Owner to-do**: register the Twitch app as a public client and give the client ID.

## R3. Picking and reading the export

- **Decision**: `DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['application/zip', 'application/json', 'text/*', '*/*'] })`, read bytes with `expo-file-system`, then delete the cached copy whether reading worked or not.
- **Rationale**: Expo SDK modules; no permission needed on Android or iOS. Deleting the copy keeps only what the checklist needs (constitution III.6).
- **Alternatives considered**: Share-sheet import ("Open in Magpie"): extra native setup on both platforms; can come later.

## R4. Zip exports

- **Decision**: `fflate` `unzipSync` with a `filter` that keeps only the entry path the platform's parser asks for, and rejects entries larger than 50 MB uncompressed.
- **Rationale**: Exports from Meta platforms and X are zips holding many files, often with media. Filtering means only the small follow file is inflated, so memory stays low. `fflate` is pure TypeScript with no native code, so it works in Expo Go, dev builds, and tests.
- **Alternatives considered**: Asking the user to unzip first: an extra step that fails often (SC-006). `react-native-zip-archive`: native module, more setup, unzips everything to disk.

## R5. Parsers per platform

- **Decision**: One file per platform in `src/guided/parsers/`, each `(entry: Uint8Array) => RawFollow[]` where `RawFollow` is `{ handle, displayName, followedAt | null }`. Shared `followList.ts` validates handles, removes duplicates by lowercase handle (first wins), and sorts by `followedAt` newest first, then items without a time in export order.
- **Rationale**: Only the reading differs by platform (FR-002). Sorting and deduping once keeps parsers short and testable.
- **Formats to verify** with a real export before each platform ships (spec assumption). Candidate shapes, not yet checked:

| Platform | Export | Candidate entry | Follow time |
| --- | --- | --- | --- |
| Instagram | zip, JSON format | `connections/followers_and_following/following.json` | likely yes |
| Facebook | zip, JSON format | a `following` JSON under `connections/` | likely yes |
| Threads | zip, JSON format (from Instagram's export tool) | a `following` JSON under `threads/` | to check |
| TikTok | JSON or TXT | following list inside the main JSON | likely yes |
| X | zip archive | `data/following.js` (JavaScript wrapper around JSON) | likely no; account id only |

- **X note**: if the archive gives only numeric ids, the profile link is `https://x.com/i/user/<id>` and the row shows the id until opened. Check during the X task group.

## R6. Large exports and long lists

- **Decision**: Show a working indicator while reading. Parsers yield to the UI every 500 items (`await` a zero-delay timer). The checklist is a `FlatList` with fixed row height (`getItemLayout`) and memoized rows.
- **Rationale**: Meets US1-5 and SC-004 without a worker thread.
- **Note**: `// ponytail: single JS thread with yields; move parsing to a worklet only if real exports freeze the UI.`

## R7. Opening a profile

- **Decision**: `Linking.openURL('https://<host>/<encoded handle>')`. The OS opens the platform's app when installed (Android App Links, iOS Universal Links), else the browser.
- **Rationale**: No `canOpenURL`, so no `<queries>` on Android and no `LSApplicationQueriesSchemes` on iOS. Simplest path that meets FR-010 on both platforms.
- **Alternatives considered**: Custom schemes (`instagram://user?username=`): need declared app lists on both platforms and break when apps change schemes.
- **Return to the app**: an `AppState` listener notes when the app becomes active; the list keeps its scroll place and highlights the last opened row (US2-2).

## R8. Saved progress

- **Decision**: Two tables in `progress.db`, created by `guidedStore.ts` with `CREATE TABLE IF NOT EXISTS`. Each tick, untick, or skip is one `UPDATE`. `deleteAll()` in `progressStore.ts` also deletes from `guided_progress` (cascade clears items). A failed write shows "We couldn't save. Free up some space on your phone." and leaves the on-screen state as is.
- **Rationale**: Same database and pattern as spec 001. One write per tap is fast enough for 0.5 s (SC-004).

## R9. Guides

- **Decision**: Bundled guide per platform in `assets/guides/<id>.json` with pictures in `assets/guides/<id>/`. When the owner sets `EXPO_PUBLIC_GUIDE_HOST`, the app fetches `https://<host>/guides.json` once per app start in the background, with no query string and no custom headers. A copy that passes the validator ([contracts/guide-content.md](contracts/guide-content.md)) is saved in `setting` as the last good guide and used next time a guide opens. Remote pictures fall back to the bundled picture of the same step when they fail to load.
- **Rationale**: Offline-first (FR-020, SC-003). Fetch once per start is enough for content that changes over weeks. Validation protects against a broken file (FR-022).
- **Owner to-do**: choose and set up the guide host. Until then, only bundled guides are used, which the spec allows for a first release (US4 priority P3).

## R10. Finished, Keep list, Clear list

- **Decision**: `guided_progress.kept` flag. Finished screen: Clear list deletes the row (items cascade). Keep list, or leaving, sets `kept = 1`. A kept list has no Continue note; the card opens the checklist.
- **Rationale**: Clarification 2026-11-12. One flag covers the lifecycle.

## R11. Continue note count

- **Decision**: The guided entry's `unfinished()` returns the number of open rows as `left` and the platform id in `ids` when not kept. Home shows "Continue: n left" as for YouTube.
- **Rationale**: Same note and contract as spec 004 FR-007. 005 FR-019 wording to be aligned (plan follow-ups).
