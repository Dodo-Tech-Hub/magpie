# Quickstart: Check the Apple Music Platform

How to prove the feature works. Calls and data are in [contracts/apple-music-api.md](contracts/apple-music-api.md), [contracts/sign-in-bridge.md](contracts/sign-in-bridge.md), and [data-model.md](data-model.md).

## Before you start (project owner)

1. Apple Developer Program membership.
2. In the Apple Developer account: Certificates, Identifiers & Profiles, Keys. Create a key with **Media Services (MusicKit)**. Download the `.p8` file once and keep it outside the repository. Note the Key ID and your Team ID.
3. Make the developer token on your machine:

   ```bash
   node scripts/apple-music-token.mjs ~/keys/AuthKey_XXXX.p8 <keyId> <teamId>
   ```

   Put the printed token in the local `.env` as `EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN=`. Never commit it. It runs out after 180 days.
4. Two test Apple Accounts with Apple Music (a family plan covers both) and Sync Library on. The old one has about 10 songs, 3 albums, 2 own playlists (one with 120 songs), and 1 Apple playlist added. The new one has 1 of the songs.
5. The Apple Music mark from the [Apple Music Identity Guidelines](https://marketing.services.apple/apple-music-identity-guidelines) in `assets/platforms/apple-music.png`.

## Step 0. Access check (after Part B step 1, before the rest of Part B)

About 15 minutes. Needs the bridge page published and the developer token.

1. On an iPhone, in a dev build, tap Sign in on the Apple Music From step. Sign in with the **old test account**. Expect the sheet to close and the step to show "Apple Music · <country>". This is check row 0: sign-in works in the auth browser.
2. On a computer, open `https://dodo-tech-hub.github.io/magpie/apple-music/sign-in.html#dt=<developer token>&check=1`, sign in with the **new test account**, and copy the token.
3. Run, with a song and an artist from music.apple.com links:

   ```bash
   DT=<developer token> UT=<copied token> SONG=<song id> ARTIST=<artist id> specs/019-apple-music-platform/verify-access.sh
   ```

4. Paste the output into the pull request. It holds no token.

| Row | Good | Bad |
| --- | --- | --- |
| 0. Sign-in in the app | Account shows | Stop and report: Apple Music cannot ship (research R1) |
| 1 to 3. Reads | `200` | Stop and report |
| 4. Add a song | `202` | Stop and report |
| 5, 5b. Playlist and its song | `201`, then `204` | Stop and report |
| 6a, 6b. Favorites | `200`, then `202` or `204` | Artists leave the scope |
| 7. Social profile | `200` | Keep the fingerprint (research R4) |

Then, with the same token, sign out once through the page (`#signout=1`) and run row 1 again. `401` means `unauthorize()` ends the token (research R5).

Clean up: remove the song, the playlist "magpie-test", and the favorite artist from the new test account in the Music app.

## Part B check (iPhone)

Setup: the test accounts from "Before you start", a dev build with the `.env`.

| # | Do | Expect | Covers |
| --- | --- | --- | --- |
| 1 | Open Home on Android. | No Apple Music card. | FR-AM-016, SC-007 |
| 2 | Open Home on iPhone. | Apple Music card in Automatic with the official mark. | US1.1 |
| 3 | Tap the card, read the intro line. | Subscription and Sync Library, no password, what does not move. | US1.2, FR-AM-004 |
| 4 | Sign in with the old account. | Pick shows Songs, Albums, Playlists (and Artists if confirmed) with counts. An uploaded song shows "Not from Apple Music" and is not picked. | US1.5, FR-AM-008 |
| 5 | On To, sign in with the **old** account again. | "This is the same account" and Sign in shows again. | US2.2, FR-AM-007 |
| 6 | Sign in with the new account. | The song it already has shows Already there. | US2.3 |
| 7 | Tap Move. | Rows turn Moved. The 120-song playlist is on the new account once, same name, same order. The Apple playlist is in its library. | US2.4, FR-AM-010 |
| 8 | Start a new move and close the app while the 120-song playlist is filling. Open it, tap Continue. | One playlist, 120 songs, no song twice. | US3.2, FR-AM-011, SC-003 |
| 9 | Turn off Wi-Fi and data during a move. | Shared "No internet" handling; nothing lost. | Edge cases |
| 10 | Turn off Sync Library on the new account, move one song. | "Turn on Sync Library and Apple Music for this account". | FR-AM-013 |
| 11 | Finish a move. Settings, Delete all. | No Apple Music progress, no token in the secure store. | FR-AM-014 |

## Tests

```bash
npm test && npm run typecheck && npm run lint
```
