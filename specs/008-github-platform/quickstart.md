# Quickstart: Check the GitHub Platform

How to prove the feature works. Details of calls and data are in [contracts/github-api.md](contracts/github-api.md) and [data-model.md](data-model.md).

## Step 0. Before GitHub code: the access test

Needs the project owner. About 10 minutes. Not needed for Part A.

1. Create the OAuth app as the spec's owner steps say. Tick **Enable Device Flow**. Do not generate a secret.
2. Sign in to GitHub in your browser with a **test** account.
3. Run `specs/008-github-platform/verify-access.sh <client_id> "public_repo user gist"` and enter the code it shows.
4. Paste the output into the chat or the pull request. It holds no token.

| Line in the output | Good | Bad |
| --- | --- | --- |
| 2. Star a public repo | `204` | Anything else: stop and report |
| 4. Follow a person | `204` | Anything else: stop and report |
| 6. Star a gist | `204` | `404`: run again with `GIST_ID` set to any public gist |
| 8 and 9. Star lists | JSON with `"data"` and no `"errors"` | `"errors"`: star lists leave the spec |

Clean up after the test: unstar `octocat/Hello-World`, unfollow `octocat`, unstar the gist, delete the list "magpie-test", and remove the app in GitHub Settings, Applications, Authorized OAuth Apps.

## Part A check (restructure, YouTube only)

```bash
npm test && npm run typecheck && npm run lint
```

- Every existing test passes with no change to what it checks (SC-003).
- New store test: a version 0 database with one YouTube progress opens as version 1 with the same accounts, picks, and states, and `tomorrow` rows read as `later`.
- On a phone with a saved YouTube progress from the old build: update the app, open it, and confirm the Continue note, the list, and "Tomorrow" rows are as before.

## Part B check (GitHub)

Setup: two test GitHub accounts. The old one stars 5 repositories, follows 3 people, stars 2 gists, and has 1 star list with 2 of those repositories. The new one stars 1 of the 5. The client ID in `.env`.

| # | Do | Expect | Covers |
| --- | --- | --- | --- |
| 1 | Tap the GitHub card. | From, Pick, To in the top bar. | US1.1 |
| 2 | On From, tap Sign in. Enter the code in the browser with the old account. Return. | The code shows large and is on the clipboard. The step shows the old account with no extra tap. Pick shows Stars, Lists, Gists, People, all picked. | US2.1, US2.2, US1.2 |
| 3 | On To, tap Sign in. | The hint on how to switch account shows with the code. | US2.3 |
| 4 | Enter the code while still on the old account. | "This is your old account. Pick a different one." | US2.4 |
| 5 | Sign in again with the new account. | GitHub's page asks only for star, follow, and list access. The shared repository shows "Already there". Gists are greyed out with "Allow". Pick shows the time left. | US1.3, US5.1, US5.2, FR-GH-011 |
| 6 | Tap Move. | Rows change one at a time, about 3 seconds apart. Summary at the end. Gists are not counted as failed. | US1.4, US3.1, US5.4 |
| 7 | Check both accounts on github.com. | New account has the stars, follows, and the list with its repositories. Old account is unchanged. | US1.5, SC-002 |
| 8 | Start again, tap "Allow" on Gists, sign in with the new account, Move. | Gists become pickable and move. Stars stay allowed. | US5.3 |
| 8b | Start again with only People picked, then sign in on To and untick nothing. | GitHub asks only for follow access. Stars, Lists, Gists are greyed. | US5.1, US5.5 |
| 9 | Let a code run out (wait 15 minutes, or use the dev switch). | "Sign-in didn't finish. Try again." | US2.5 |
| 10 | Set `EXPO_PUBLIC_SIMULATE_QUOTA_AFTER=6` and move 10 items. | After 6: rest say "Later", the break message shows, the app asks about a reminder. Close the app, tap the reminder, Continue moves only the rest. | US3.3, US3.4 |
| 11 | At the summary, after Sign out, and in Settings. | The line saying Magpie can still use the account, and the button to remove access, show. The button opens GitHub's settings page. | US4.3, FR-GH-019 |
| 12 | Delete all. | No GitHub account, progress, or token is left. A new sign-in is needed. | US4.2 |
| 13 | Run the YouTube flow once. | Works as before. | SC-003 |

Automated: the same cases as component and unit tests with a mocked `fetch` and a mocked secure store. No test calls GitHub (Principle II).

## Part C check (2026-11-15 changes)

Same setup as Part B.

| # | Do | Expect | Covers |
| --- | --- | --- | --- |
| 14 | On GitHub, sign in on From only. Untick 2 items. Tap Home, then the GitHub card. | Pick shows the same list with the same 2 unticked. The GitHub card showed a Continue note while on Home. | FR-GH-021, FR-GH-022 |
| 15 | Close the app fully and reopen it. Tap the Continue note on the GitHub card. | Pick shows the same list and picks. From's progress list says "New account not chosen yet". | FR-GH-021 |
| 16 | From GitHub Pick, tap Home, then the YouTube card. Try each choice. | "Save your GitHub progress?" shows. Cancel stays on Home. Save opens YouTube at the start, and the GitHub card keeps its Continue note. Don't save opens YouTube at the start, and the GitHub card has no Continue note. | FR-GH-022 |
| 17 | With a GitHub progress that has both accounts, sign in to the same new account on To. Then sign in on From with an old account that has an earlier progress with no new account, and sign in on To with the pair's new account. | Only one progress for the pair is left, with its earlier row states. | FR-GH-021 |
| 18 | On Pick with several kinds, tap the "Stars" heading, then search for a starred repository's name, then clear the search. | Headings are as large as "Automatic" on Home and show a count. Stars collapse, open while the search matches, and collapse again after clearing. The counter and "Move N items" still include the collapsed stars. | FR-GH-003, FR-GH-023 |
| 19 | On Pick with several kinds, tap "All" on the Stars heading twice. Collapse Stars and tap it again. | Only the stars are unpicked, then picked. The counter and Move follow. The section does not collapse or open from that tap, and it works while collapsed. | FR-GH-024 |
