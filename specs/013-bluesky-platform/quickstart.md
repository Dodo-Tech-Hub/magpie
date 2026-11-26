# Quickstart: Bluesky Platform

How to check that the feature works. Data shapes are in [data-model.md](data-model.md), calls in [contracts/bluesky-api.md](contracts/bluesky-api.md).

## Before you start

- Two Bluesky-hosted test accounts. Old: follows 10 people, blocks 2, mutes 3, saves 2 feeds (1 pinned), has 1 people list with 3 members. New: follows 2 of the same 10 people.
- One self-hosted handle (any account not on `*.host.bsky.network`) to check the refusal.
- The client metadata file is live: `curl -s https://dodo-tech-hub.github.io/magpie/oauth/bluesky-client-metadata.json` prints the JSON from research R12.
- A local build: `npx expo run:android` (or `ios`). No `.env` value is needed for Bluesky.

## Automated

```bash
npm test
npm run typecheck
npm run lint
```

All pass. The Bluesky tests use mocked `fetch`, a mocked OAuth client, and the secure-store mock. No test calls Bluesky.

## The Check (before Part B, research R11)

```bash
node specs/013-bluesky-platform/check-access.mjs
```

The script opens the browser for each sign-in and prints one line per question with PASS or FAIL. Record the answers in research R11. Questions 1 and 2 must PASS before Part B starts.

## On a phone

| # | Do | Expect |
| --- | --- | --- |
| 1 | Home | Bluesky card in Automatic, after GitHub, with the official butterfly. |
| 2 | Tap Bluesky, type the old handle as `@Old.bsky.social ` | From shows the old account's picture and name. No browser opened. Pick shows People, Blocked, Lists, all picked, and greyed Mutes and Feeds with "Allow". |
| 3 | Type a self-hosted handle on From | "Magpie works only with accounts hosted by Bluesky for now." |
| 4 | Type a handle that does not exist | "We can't find that account. Check the name." |
| 5 | On To, type the new handle, Sign in | Browser opens Bluesky's page for that handle, listing only follow, block, and list access. Accept: To shows the account. 2 People rows show "Already there". |
| 6 | On To, sign in with the old account instead | "Use a different account here." |
| 7 | Tap "Allow" on Mutes | Browser asks for the old account, read-only access. Mutes and Feeds fill in and are picked. They are greyed again, now with "Allow" for the new account. |
| 8 | Tap "Allow" on Mutes again (new account) | Browser asks for the new account with mute access added. Mutes become pickable. Repeat for Feeds. |
| 9 | Tap Move | Rows change one at a time, quickly (up to 500 per minute). Summary at the end. |
| 10 | Check the new account in the Bluesky app | Follows (oldest first in the new account's list), blocks, the list with 3 members, 3 mutes, 2 saved feeds with the same one pinned. Other settings unchanged. The old account unchanged. |
| 11 | After the summary | To shows signed out. The session key is gone from secure storage. The line "Magpie's access ends on its own within an hour." shows. The old refresh token is refused; the access token works until it runs out (research R11). |
| 12 | Start a move of 30, turn on flight mode after 5 | "No internet. Try again when you're online." Continue moves only the rest. |
| 13 | Settings, Delete all | No Bluesky progress or session left. |
| 14 | Rotate and use split screen on From and To | The handle box keeps its text. |
