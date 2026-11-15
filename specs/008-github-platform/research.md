# Research: GitHub Platform

GitHub's docs site was not reachable when the plan was first written; R1, R2, and R9 were re-checked against the docs on 2026-11-14. Other facts come from web search results and GitHub's changelog. Each decision says how sure it is. **R1 is an open gate**: it needs one 10-minute test with a real GitHub App, which only the project owner can run. See [verify-access.sh](verify-access.sh) and [quickstart.md](quickstart.md), step 0.

## R1. App type: classic OAuth app (DECIDED 2026-11-14)

- **Finding (docs checked 2026-11-14)**: Very likely no. GitHub's docs say:
  - "Star a repository for the authenticated user" works with GitHub App user access tokens that have **"Starring" user permissions (write) and "Metadata" repository permissions (read)** ([starring](https://docs.github.com/en/rest/activity/starring)). The permissions table marks it as needing an additional permission ([permissions for GitHub Apps](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps)).
  - Repository permissions "allow your app to access resources related to repositories that are owned by the account where the app is installed" ([choosing permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)), and acting for a user, "the app can only access resources in an account where it is installed" ([on behalf of a user](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-with-a-github-app-on-behalf-of-a-user)).
  - Together: a GitHub App can star only repositories owned by accounts where the app is installed. This matches the firsthand report ([builders PR 116](https://github.com/zikrulihsan/builders/pull/116)).
  - Follow (`PUT /user/following/{username}`) needs only "Followers" user permission (write). Star a gist (`PUT /gists/{gist_id}/star`) needs only "Gists" user permission (write); there is no smaller level. Neither needs a repository permission, so both should work with a GitHub App.
  - Star lists: `createUserList` and `updateUserListsForItem` exist in GraphQL; the docs name no permission for them. Third-party tools use the classic `user` scope. Adding a repository to a list most likely hits the same installation limit as starring.
  - Classic OAuth app scopes: `public_repo` is "required for starring public repositories" and also gives read and write access to code in public repositories. `user:follow` follows people. `gist` gives write access to gists. `user` gives read and write access to profile info and includes `user:follow` ([scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)).
- **Earlier finding**: one developer reported a 403 when a GitHub App token starred a repository where the app was not installed ([builders PR 116](https://github.com/zikrulihsan/builders/pull/116)). Third-party star-list tools all use the classic `user` scope.
- **Decision**: One classic OAuth app, approved by the owner on 2026-11-14. Each sign-in asks only for the scopes of the kinds the user picked (spec, GitHub section). The old account gets no scope. Gists are opt-in through "Allow". The app reads the granted scopes from the token response (`scope`) and greys out kinds without one, because GitHub lets users untick scopes ([scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)).
- **Rationale**: Only a classic OAuth app can star any public repository. One app with per-sign-in scopes gives the same "share only what you choose" result as several GitHub Apps, with less setup and code.
- **Cost, accepted by the owner**: `public_repo` also allows writing code in public repositories, `user` allows editing profile info, and `gist` allows changing the user's own gists (exception to Principle III, rule 1). Tokens cannot be cancelled without the secret (exception to rule 3); with "Expire user access tokens" on they run out after 8 hours. Safeguards: FR-GH-019.
- **Access check, run 1 (2026-11-14, no scope)**: reads of stars, follows, starred gists, and lists worked with no scope. Writes answered 404. `createUserList` answered `INSUFFICIENT_SCOPES` naming `user`. Token `expires_in` 28800 with a refresh token.
- **Access check, run 2 (2026-11-14, `public_repo user gist`)**: PASSED. Granted `gist,public_repo,user`. Star a repository 204, follow a person 204, star a gist 204, all reads 200, `createUserList` returned `data` with the new list. Token `expires_in` 28800. Run `verify-access.sh <client_id> "public_repo user gist"` with a test account before Part B. If lists fail, they leave the spec.
- **Alternatives considered**: GitHub Apps (cannot star most repositories). GitHub App for people and gists plus an OAuth app for stars and lists (two app types and two sign-in kinds; most users would take the broad scope anyway). People and gists only (main value lost). Guided stars (depends on spec 005, Draft). Cancel.

## R2. Sign-in flow

- **Decision**: OAuth 2.0 device code flow, as the spec says. `POST https://github.com/login/device/code` with `client_id` and `scope` (space-separated, empty for the old account), then poll `POST https://github.com/login/oauth/access_token` with `client_id`, `device_code`, and `grant_type=urn:ietf:params:oauth:grant-type:device_code`. No client secret.
- **Docs check (2026-11-14)**: codes last 900 seconds; poll errors are `authorization_pending`, `slow_down` (adds 5 seconds), `expired_token`, `unsupported_grant_type`, `incorrect_client_credentials`, `incorrect_device_code`, `access_denied`, and `device_flow_disabled`. ([generating a user access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)). With "Expire user access tokens" on, the token response has `expires_in` 28800 and a `refresh_token` (access check, 2026-11-14).
- **Rationale**: Search results confirm the device flow needs no secret ([Octokit auth-oauth-user](https://github.com/octokit/auth-oauth-user.js)). No source says GitHub made the secret optional for PKCE, so the spec's choice holds. No redirect means no deep link and no new URL scheme.
- **Poll rules** (from GitHub's documented error codes, to be re-checked by the test script): wait `interval` seconds between polls (5 by default). `authorization_pending`: keep polling. `slow_down`: add 5 seconds to the interval. `expired_token`, `access_denied`, or any other error: stop. Stop at `expires_in` (about 15 minutes) in any case.
- **Validation (Principle III, rules 2 and 8)**: before use, check that `verification_uri` starts with `https://github.com/`, `user_code` is 8 letters or digits with one dash, `interval` is 1 to 60, and `expires_in` is 60 to 1800. Check that the token response has a string `access_token`, `token_type` of `bearer`, and a string `scope`; the granted scopes come from `scope`, not from what was asked.
- **Alternatives considered**: PKCE in the system browser: needs the client secret at the token step. A small server to hold the secret: Principle III, rule 5 forbids an own backend.

## R3. Opening the browser and copying the code

- **Decision**: `Linking.openURL()` from React Native opens the sign-in page in the phone's default browser. `expo-clipboard` copies the code. The page is always `https://github.com/login/device`.
- **Rationale**: The device flow has no redirect, so no auth session is needed. `Linking` is built in. `expo-clipboard` is an Expo SDK module (Principle III, rule 11).
- **Alternatives considered**: `expo-web-browser`: an in-app browser tab keeps the user inside Magpie, which is nicer, but it adds a dependency and the tab shares cookies with the browser on Android only. Revisit if testing shows users get lost.

## R4. Second sign-in must not reuse the first account

- **Decision**: The device page uses the browser's signed-in GitHub account. The app cannot force an account chooser. It shows the hint from FR-GH-007 under the code when the other account is already signed in, reads `GET /user` after every sign-in, and refuses the token when the account ID is the same as the other step (or differs from the new account, for the gist sign-in).
- **Rationale**: This is the only control the device flow gives. SC-005 is met by the refusal, not by the browser.
- **Alternatives considered**: Opening `https://github.com/logout` first: it shows a confirm page and signs the user out of GitHub in their browser, which is not Magpie's job.

## R5. Tokens

- **Decision**: Old account token: kept in memory only, dropped as soon as the list is read. New account token: kept in `expo-secure-store` under one fixed key with the account ID and the granted scopes. An "Allow" sign-in replaces it with the new token, which holds the old scopes plus the new one. Deleted when the summary shows, on Sign out, and on Delete all.
- **Rationale**: FR-GH-019 and Principle III, rule 3. A paused move needs the token after an app restart, so memory alone is not enough. The token runs out after 8 hours, and the refresh token is never saved. The summary line and button to GitHub's remove-access page (`https://github.com/settings/applications`) let the user end access sooner.
- **When the token stops working** (the user removed access on GitHub): the next call answers 401, the To step shows signed out with "Your sign-in ran out. Sign in again to keep going." (existing text). The saved progress keeps the expected new account, as YouTube does.
- **Alternatives considered**: Keep the token after the summary for a later move: longer access on the phone for no user benefit.

## R6. Reading the old account

- **Decision**: REST with 100 items per page: `GET /user/starred`, `GET /user/following`, `GET /gists/starred`. Star lists through GraphQL on the same host: `viewer { lists { nodes { id name description isPrivate items { nodes { ... on Repository { id } } } } } }`, paged by cursor. The app shows a loading line while pages load.
- **Rationale**: These are the endpoints the spec names. GitHub's June 2026 change limits who can list a repository's stargazers and watchers ([changelog](https://github.blog/changelog/2026-06-30-upcoming-access-restrictions-to-public-api-endpoints-and-ui-views/)). It does not touch a user's own starred list.
- **Private repositories**: the old account token has no scope, so private stars and private lists are not in the list at all. So no "Not available" state is needed (FR-GH-016 removed on 2026-11-15).

## R7. "Already there"

- **Decision**: After the To sign-in, read the new account's stars, follows, lists, and starred gists, for the kinds it has a scope for, with the same calls as R6. An item in both lists is "Already there". A person who is the new account is "Already there" too. No extra request per item.
- **Rationale**: Public repositories are visible to every account, and deleted ones are not in the old list. One request per repository would spend the hourly limit on large lists for no gain. A repository whose owner blocked the new account fails at move time with its reason (FR-GH-017).
- **Spec note**: FR-GH-016 was removed on 2026-11-15, because the old list never holds a private repository.

## R8. Adding items

- **Decision**: One request per item, in this order of kinds: Stars, People, Gists, Lists.

| Kind | Call | Success | Token |
| --- | --- | --- | --- |
| Starred repository | `PUT /user/starred/{owner}/{repo}` | 204 | New account |
| Followed person | `PUT /user/following/{username}` | 204 | New account |
| Starred gist | `PUT /gists/{gist_id}/star` | 204 | Gist |
| Star list | GraphQL `createUserList`, then `updateUserListsForItem` per repository | No `errors` field | New account |

- **Lists replace, not add**: `updateUserListsForItem` sets the full set of lists for a repository. To obey FR-GH-009 (never remove anything on the new account), the app first reads which lists each repository is already in on the new account and sends the union. A list with the same name is reused (FR-GH-018).
- **Lists run last** so their repositories are already Moved or Already there. The list create and each `updateUserListsForItem` count as one add each for the pace in R9.
- **Pick order and move order differ**: Pick headings run Stars, Lists, Gists, People. Items move as Stars, People, Gists, Lists, because a list needs its repositories moved first.
- **Rationale**: REST status codes map cleanly to row states. Lists exist only in GraphQL.
- **Alternatives considered**: GraphQL `addStar` and `followUser` for everything: one endpoint, but errors come back as 200 with a list, which is harder to map to reasons.

## R9. Pace and waits

- **Decision**: A small pacer in `src/move/`. Before each add it checks the times of earlier adds for this new account (kept in the app's database, last hour only). Under 3 seconds since the last add: sleep the rest. 300 adds in the last hour: stop with "Later", resume time = oldest add in the window + 1 hour.
- **GitHub says wait** (403 or 429 with `retry-after`, or `x-ratelimit-remaining: 0` with `x-ratelimit-reset`): 60 seconds or less: sleep and retry once. Longer: stop with "Later" at that time. No header: GitHub asks for at least one minute, so sleep 60 seconds once, then stop with "Later" in 1 hour if it happens again.
- **Account flagged**: three 403 answers in a row that are not rate limits: stop, save, show "GitHub paused your account's activity. Try again later." No retry loop.
- **One owner for the count**: `pacer.beforeAdd()` records an add each time it lets one go, and nothing else records adds. The mover calls it once per item (the star, follow, gist star, or list create). For a list, the driver calls it again before each repository add. If it answers "Later" in the middle of a list, the driver returns `later`, and Continue runs the whole list again. This is safe because each repository add sends the union of lists.
- **Time left (FR-GH-011)**: the adds the picked items need (one per item, plus one per repository of each picked list) times 3 seconds. Over 300 adds: "More than one session".
- **Rationale**: FR-GH-010 and FR-GH-012. GitHub's secondary limits are about 80 content-creating requests per minute and 500 per hour, and they change without notice, so the app's own numbers are constants in one file.
- **Alternatives considered**: Derive the pace from row timestamps: list membership adds are not rows.

## R10. Making the Automatic flow platform-neutral (restructure)

- **Finding**: Today `src/state/flows.ts`, `src/move/mover.ts`, `src/ui/SettingsView.tsx`, and `App.tsx` import the Google and YouTube modules directly. The database has no platform column, the unique key is the account pair only, the row type is a channel with no kind, and the texts say "channels" and "Sign in with Google".
- **Decision**: A platform driver: one object per platform with the same functions (sign in, sign out, read the old list, check the new account, add one item, words). The flow, the mover, the store, and the screens talk only to the driver of the open platform. This is Part A of the plan. It ships as its own change, with YouTube as the only driver and every existing test passing, before any GitHub code (Principle IV, "Restructure instead of forcing it").
- **Rationale**: GitHub touches every one of those modules. `if (platform === 'github')` branches in each would break Principle IV. A driver is also what any later Automatic platform needs.
- **Alternatives considered**: A separate copy of the flow for GitHub: two flows to keep in step, and FR-GH-002 says the same flow. A navigation or state library: not needed, the reducer stays.

## R11. Logo

- **Decision**: GitHub's official Invertocat, unchanged, from GitHub's brand toolkit ([logo](https://brand.github.com/foundations/logo), file `GitHub_Logos.zip`, downloaded 2026-11-14). `assets/platforms/github.png` is `GitHub_Invertocat_Black.png` (light look) and `assets/platforms/github-white.png` is `GitHub_Invertocat_White.png` (dark look), both 294 by 288 pixels. Part B lets a platform entry name a dark-look logo; the card picks the one that matches the theme.
- **Rationale**: Principle V and FR-GH-015. GitHub's rules: the Invertocat appears only in white or black (rarely grey or green), with high contrast, with no effects, and never changed, stretched, or rearranged. The black mark on a dark card fails the contrast rule, so both colors ship.
- **Owner check**: before a store release, the owner confirms GitHub's brand rules allow this use (naming GitHub on a card in a third-party app), as for the YouTube logo.
