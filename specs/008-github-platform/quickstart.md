# Quickstart: Check the GitHub Platform

How to prove the feature works. Details of calls and data are in [contracts/github-api.md](contracts/github-api.md) and [data-model.md](data-model.md).

## Step 0. Before any code: the access test (research R1)

Needs the project owner. About 10 minutes.

1. Create one test GitHub App as the spec's owner steps say ("Magpie" with Starring and Followers: read and write; add Gists: read and write for this test only). Tick **Enable Device Flow**. Do not generate a secret.
2. Sign in to GitHub in your browser with a **test** account.
3. Run `specs/008-github-platform/verify-access.sh <client_id>` and enter the code it shows.
4. Paste the output into the chat or the pull request. It holds no token.

| Line in the output | Good | Bad |
| --- | --- | --- |
| 2. Star a public repo | `204` | `403` or `404`: see the options in research R1 |
| 4. Follow a person | `204` | `403` or `404` |
| 6. Star a gist | `204` | `403` or `404`: gists go out of scope, or need another access |
| 8 and 9. Star lists | JSON with `"data"` and no `"errors"` | `"errors"`: star lists go out of scope |

Clean up after the test: unstar `octocat/Hello-World`, unfollow `octocat`, unstar the gist, and delete the list "magpie-test".

## Part A check (restructure, YouTube only)

```bash
npm test && npm run typecheck && npm run lint
```

- Every existing test passes with no change to what it checks (SC-003).
- New store test: a version 0 database with one YouTube progress opens as version 1 with the same accounts, picks, and states, and `tomorrow` rows read as `later`.
- On a phone with a saved YouTube progress from the old build: update the app, open it, and confirm the Continue note, the list, and "Tomorrow" rows are as before.

## Part B check (GitHub)

Setup: two test GitHub accounts. The old one stars 5 repositories, follows 3 people, stars 2 gists, and has 1 star list with 2 of those repositories. The new one stars 1 of the 5. Three client IDs in `.env`.

| # | Do | Expect | Covers |
| --- | --- | --- | --- |
| 1 | Tap the GitHub card. | From, Pick, To in the top bar. | US1.1 |
| 2 | On From, tap Sign in. Enter the code in the browser with the old account. Return. | The code shows large and is on the clipboard. The step shows the old account with no extra tap. Pick shows Stars, Lists, Gists, People, all picked. | US2.1, US2.2, US1.2 |
| 3 | On To, tap Sign in. | The hint on how to switch account shows with the code. | US2.3 |
| 4 | Enter the code while still on the old account. | "This is your old account. Pick a different one." | US2.4 |
| 5 | Sign in again with the new account. | The shared repository shows "Already there". Gists are greyed out with "Allow gists". Pick shows the time left. | US1.3, US5.1, FR-GH-011 |
| 6 | Tap Move. | Rows change one at a time, about 3 seconds apart. Summary at the end. Gists are not counted as failed. | US1.4, US3.1, US5.4 |
| 7 | Check both accounts on github.com. | New account has the stars, follows, and the list with its repositories. Old account is unchanged. | US1.5, SC-002 |
| 8 | Start again, tap "Allow gists", sign in with the new account, Move. | Gists become pickable and move. | US5.2 |
| 9 | Let a code run out (wait 15 minutes, or use the dev switch). | "Sign-in didn't finish. Try again." | US2.5 |
| 10 | Set `EXPO_PUBLIC_SIMULATE_QUOTA_AFTER=6` and move 10 items. | After 6: rest say "Later", the break message shows, the app asks about a reminder. Close the app, tap the reminder, Continue moves only the rest. | US3.3, US3.4 |
| 11 | After a summary, and after Switch. | The line and button to remove Magpie's access on GitHub show. The button opens GitHub's settings page. | US4.3 |
| 12 | Delete all. | No GitHub account, progress, or token is left. A new sign-in is needed. | US4.2 |
| 13 | Run the YouTube flow once. | Works as before. | SC-003 |

Automated: the same cases as component and unit tests with a mocked `fetch` and a mocked secure store. No test calls GitHub (Principle II).
