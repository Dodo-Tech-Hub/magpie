---

description: "Task list for the GitHub platform"
---

# Tasks: GitHub Platform

**Input**: Design documents from `specs/008-github-platform/` (plan.md, spec.md, research.md, data-model.md, contracts/platform-driver.md, contracts/github-api.md, quickstart.md)

**Prerequisites**: Constitution v1.5.1 merged (PR #29). The owner approved Part A (restructure) on 2026-11-14 and the access check passed (research R1). Part B needs the OAuth app client ID in `.env` as `EXPO_PUBLIC_GITHUB_CLIENT_ID`; Part A does not. The security checklist in `checklists/security.md` is reviewer-owned and does not block tasks.

**Tests**: Required by the constitution (Principle II). Test tasks come before the code they check and must fail first. Each test checks what the user sees or a business rule. A test asserts a mocked call only where that call is the behavior (the browser opens, a token is saved or deleted, no write call goes out with the old token). No test calls GitHub or Google.

**Organization**: Part A (Phase 2) reshapes the flow so any Automatic platform plugs in. It ships as its own pull request, with YouTube as the only driver, before Part B starts (Principle IV, "Restructure instead of forcing it"). Part B (Phases 3 to 8) adds GitHub. Within Part B, stories follow the spec's priorities, and US1 needs US2 (it cannot move anything without a sign-in).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US5. Setup, Foundational, and Polish tasks have no label
- Paths are from the repository root

## Phase 1: Setup

**Purpose**: Status, dependencies, config, test mocks, and a known-good start

- [X] T001 Set the `**Status**:` line in `specs/008-github-platform/spec.md` to `In progress` (AGENTS.md: implementation has started).
- [X] T002 Install the two Expo modules with `npx expo install expo-secure-store expo-clipboard`. Check each module's Expo docs and add a config plugin entry to `app.config.ts` only if the docs say one is needed on Android or iOS. Commit `package.json` and `package-lock.json`. Run `npm audit` and note any high or critical issue (constitution III.11).
- [X] T003 [P] Add `EXPO_PUBLIC_GITHUB_CLIENT_ID=` with a one-line comment ("Public client ID of the Magpie GitHub OAuth app. Not a secret. Never add a client secret.") to `.env.example`. Do not touch `.env`.
- [X] T004 [P] Create `tests/mocks/expoSecureStore.ts` (in-memory `getItemAsync`, `setItemAsync`, `deleteItemAsync`, and a `__reset()` and `__dump()` for tests) and `tests/mocks/expoClipboard.ts` (`setStringAsync` as `jest.fn`). Register both in `jest.setup.ts` with `jest.mock(..., () => jest.requireActual(...))`, the same way the other mocks are.
- [X] T005 Run `npm test`, `npm run typecheck`, and `npm run lint` before any code change. All pass. Write the test count in the commit message of T007.

---

## Phase 2: Part A - platform-neutral flow (Foundational, own pull request)

**Purpose**: Put YouTube behind a platform driver and make the store, state, mover, and screens platform-neutral, with no change to what a YouTube user sees. Done when every existing test passes with renames and setup changes only (SC-003), and `grep -rn "auth/google\|api/youtube" src` finds only `src/platforms/youtubeDriver.ts` and the two modules themselves.

**CRITICAL**: Open the Part A pull request after T027 and merge it before Phase 3.

- [ ] T006 [P] Write `tests/unit/migrate.test.ts` for `migrate(db)` in `src/store/migrate.ts`, using the `expoSqlite` mock database. Seed a version 0 database with a copy of today's schema (tables `progress`, `progress_channel`, `setting`): one progress with two accounts, 4 channels (statuses `waiting`, `moved`, `tomorrow`, `already_there`, with `picked` 1 and 0), `limit_hit_at` set, and one `setting` row. After `migrate`: `PRAGMA user_version` is 1; the progress row has `platform = 'youtube'`, `old_handle` and `new_handle` equal to the old emails, and `resume_at` null; every item has `kind = 'channel'`, `item_id` equal to the old `channel_id`, `data` null, `reason` null; `tomorrow` rows read `later`; `picked`, `title`, `thumbnail_url`, and the setting row are unchanged; running `migrate` twice changes nothing; an empty database goes straight to version 1; deleting a progress deletes its items; inserting a second progress with the same (`platform`, `old_account_id`, `new_account_id`) fails; the same account pair on a different platform is allowed.
- [ ] T007 Create `src/store/migrate.ts` per data-model.md Part A. Version: `PRAGMA user_version`, 0 is today's schema, 1 is the new one. "The step from 0 to 1 runs once, in one transaction: create the new tables, copy every row, drop the old tables." A fresh install creates version 1 directly (tell the two apart by whether `progress_channel` exists). Tables: `progress` (`id` text key, `platform` text "A platform ID from the platform list.", `old_account_id`, `old_handle`, `old_name`, `old_photo_url`, `new_account_id`, `new_handle`, `new_name`, `new_photo_url`, `created_at` integer, `updated_at` integer, `limit_hit_at` integer or null, `resume_at` integer or null, unique (`platform`, `old_account_id`, `new_account_id`)); `progress_item` (`progress_id` text referring to `progress` with `ON DELETE CASCADE`, `item_id` text "Unique inside a progress. The driver builds it. YouTube: the channel ID. GitHub: kind and ID, for example `repo:1296269`.", `kind` text, `title` text, `thumbnail_url` text, `data` text or null "JSON that only the driver reads, checked on read", `picked` integer, `status` text with no CHECK rule "Checked in TypeScript, not by a table rule, so a new state needs no table rebuild", `reason` text or null, `updated_at` integer, key (`progress_id`, `item_id`)); `setting` unchanged. Copy rules: `email` becomes `handle`, `channel_id` becomes `item_id`, `kind = 'channel'`, status `tomorrow` becomes `later`. Make T006 pass.
- [ ] T008 [P] Update `tests/unit/progressStore.test.ts` for the new names and signatures (rename and setup only; each existing assertion keeps its meaning): `getChannels` is `getItems`, `saveChannels` is `saveItems`, `channelId` is `itemId`, `email` is `handle`, `tomorrow` is `later`, `markWaitingAsTomorrow` is `markWaitingAsLater`, `releaseTomorrow` is `releaseLater`, `getOrCreateProgress` and `findProgressForPair` take the platform first, `listUnfinished(platform)` returns only that platform's progresses. Add: the same two accounts on two platforms give two separate progresses; `setStatus(progressId, itemId, status, reason?)` saves the reason; `setLimitHit(progressId, at, resumeAt)` saves both; a row with an unknown status reads as `waiting`; `getItems(progressId, kindOrder)` sorts by the position of the kind in `kindOrder`, then by title ignoring case.
- [ ] T009 Edit `src/store/progressStore.ts`: call `migrate(db)` from `initStore()` instead of running `SCHEMA`; rename and re-type per T008 and data-model.md "Types in code": `AccountInfo { id, handle, name, photoUrl }`, `NewItem { itemId, kind, title, thumbnailUrl, data: string | null }`, `StoredItem = NewItem & { picked, status, reason: string | null }`, `Status` with `later`, `UnfinishedProgress` with `platform` and `resumeAt`. The "left" count uses `waiting`, `later`, and `moving`. An unknown status reads as `waiting` (`// ponytail: a downgraded app cannot read newer states, waiting is the safe state`). Make T008 pass.
- [ ] T010 [P] Create `src/platforms/driver.ts` with the types of contracts/platform-driver.md: `Role`, `Outcome`, `Driver`, `Words`, `SignInCode`, `SignInResult`, and a `kinds` entry type. Types only, no code, no test.
- [ ] T011 [P] Write `tests/unit/youtubeDriver.test.ts` for `src/platforms/youtubeDriver.ts` with `@/api/youtube` and `@/auth/google` mocked: `add` maps `moved`, `couldnt_move` (reason is the empty string), `retry`, and `auth` (after one token refresh through `getAccessToken(staleToken)` and one more try); a `tomorrow` answer becomes `{ kind: 'later', resumeAt }` where `resumeAt` is `nextQuotaReset(new Date()).getTime()`; `listOld` returns `{ items, missing: [] }` with items of `kind: 'channel'`, `itemId` equal to the channel ID, and `data` null; `checkNew` returns the IDs of the channels the new account follows; `signIn` returns the account with `handle` equal to the email; `canAct('new', id)` is true only when the signed-in Google account has that ID; `granted()` is `['channel']`; `kinds` is one kind with an empty heading; `words` equals today's texts letter for letter.
- [ ] T012 Create `src/platforms/youtubeDriver.ts` and add `youtubeWords` to `src/strings.ts` (move the YouTube-specific texts there unchanged: sign-in label "Sign in with Google" with icon `logo-google`, old and new hints, "Search channels", "This account doesn't follow any channels yet", "Pick at least 1 channel", "Tomorrow", the daily limit message, the reminder body, `moveButton`, and `notAffiliated`). In `src/auth/google.ts` give `signIn` its own account type `{ id, email, name, photoUrl }` instead of importing `AccountInfo`. The driver wraps `src/auth/google.ts` and `src/api/youtube.ts` with no behavior change; the token refresh on 401 moves from the mover into `add`. Make T011 pass.
- [ ] T013 [P] Update `tests/unit/mover.test.ts`: the setup uses a fake `add` function (and the store names from T008) instead of mocking `@/api/youtube` and passing `getToken`; every existing assertion keeps its meaning (picked and waiting only, retry waits of 1 and 4 seconds, offline after retries, quota stop). Add: an outcome `later` with `resumeAt` marks that item and the rest `later`, saves `limit_hit_at` and `resume_at`, and returns `limit`; an outcome `wait` with `ms` sleeps that long and tries the same item again; a second `wait` for the same item stops as `later` with `resumeAt` one hour from now; an outcome `stop` with a notice puts the item back to `waiting`, returns `stopped`, and keeps the notice; an outcome `couldnt_move` saves its `reason` on the row; with an optional `pacer` whose `beforeAdd()` answers `{ wait: 3000 }` the mover sleeps before the add, and when it answers `{ later: time }` the mover stops as `later` at that time; when both a pacer time and an outcome time exist the later one is saved as `resume_at`; `add` gets the pacer as its third argument; a move of 1,000 items with a fake clock and 3 `later` stops, each followed by Continue, moves every item exactly once (SC-006).
- [ ] T014 Edit `src/move/mover.ts`: `runMove(progressId, { add, pacer?, onUpdate?, sleep?, simulateQuotaAfter? })` where `add(item, items, pacer)` returns a driver `Outcome` (contracts/platform-driver.md). Keep the sequential loop, the statuses saved before and after each request, the retry waits for `retry`, `recoverInterrupted`, and the development quota switch. Handle `later`, `wait`, and `stop` here once, so no driver repeats it. `MoveResult` gains `stopped`. Make T013 pass.
- [ ] T015 [P] Update `tests/unit/appState.test.ts` for the rename `channels` to `items` and the action payloads (`setOld`, `setProgress`, `setItems`), and add `stopped` to the move states. Same assertions.
- [ ] T016 Edit `src/state/AppState.tsx`: rename `channels` to `items`, the action `setChannels` to `setItems`, and add the move state `stopped`. No new fields (the sign-in code and granted kinds are added in Part B where they are first used).
- [ ] T017 [P] Update `tests/unit/platforms.test.ts`: each entry has a `driver`; `driverFor('youtube')` returns the YouTube driver; the YouTube entry's `unfinished()` counts only YouTube progresses; the readiness and section rules are unchanged.
- [ ] T018 Edit `src/platforms/platforms.ts`: each `Platform` entry gets `driver: Driver`, plus an optional `logoDark`; add `driverFor(id)`; the YouTube entry's `unfinished()` calls `listUnfinished('youtube')`. `PlatformId` stays `'youtube'` until Part B.
- [ ] T019 [P] Update the component tests and helpers for the renames and the driver, with no change to what they check: `tests/components/helpers.tsx` (the `ch()` helper returns `{ itemId, kind: 'channel', title, thumbnailUrl, data: null }`, and the mock of `@/api/youtube` is unchanged), `tests/mocks/googleSignin.ts` if it builds accounts, `tests/components/accounts.test.tsx`, `dailyLimit.test.tsx`, `home.test.tsx`, `homeNav.test.tsx`, and `progresses.test.tsx` (`email` is `handle`, `channelId` is `itemId`, `Tomorrow` text is unchanged).
- [ ] T020 Edit `src/state/flows.ts` to call the driver of the open platform, with no change in behavior: `driverFor(state.platform)` for `signIn`, `signOut`, `listOld`, `checkNew` (replaces `markFollowed`), `canAct` (replaces `signedInAccountId`), and the `add` passed to `runMove` (replaces `getAccessToken`); `isMovable` and `togglePick` use `StoredItem`; `startMove` handles the `stopped` result (set the move state `stopped` and show the driver's notice) and reads `resume_at` from `getProgress` to schedule the reminder instead of calling `nextQuotaReset`; `openProgress` reads the platform from the saved progress and dispatches `openPlatform` with it; the notices use `handle`.
- [ ] T021 Edit `src/reminders/reminder.ts`: `scheduleReminder(progressId, at, body)` takes the body text from the driver's words instead of `strings.reminderBody`. No other change.
- [ ] T022 [P] Edit `tests/components/settings.test.tsx` only if Delete all needs the new driver setup, then edit `src/ui/SettingsView.tsx`: Delete all calls `signOut()` of every platform's driver (loop over `PLATFORMS`), and the "not made by or linked with" line comes from the words of every ready platform. Same behavior for YouTube.
- [ ] T023 Rename `src/ui/ChannelRow.tsx` to `src/ui/ItemRow.tsx` with `git mv`; the prop `channel` becomes `item`; the tag for `later` takes its label from the platform words, and a row with a non-empty `reason` shows it under the name (empty for YouTube, so nothing changes). Edit `src/ui/PickStep.tsx`, `src/ui/FromStep.tsx`, `src/ui/ToStep.tsx`, `src/ui/AccountCard.tsx`, and `src/strings.ts` to use `items`, `handle`, and the driver's `words` (sign-in label and icon, hints, search placeholder, empty text, pick text, move button). Update the component tests that import `ChannelRow` or look up its text, keeping what they check.
- [ ] T024 Edit `App.tsx`: show the From, Pick, and To steps for any open platform (`state.platform !== null`) instead of only `'youtube'`. The Home, Settings, and back-button rules are unchanged.
- [ ] T025 Run `npm test`, `npm run typecheck`, and `npm run lint`. All pass, with the same number of existing tests as T005. Run `grep -rn "auth/google\|api/youtube" src` and confirm only the two modules and `src/platforms/youtubeDriver.ts` appear.
- [ ] T026 Manual Part A check from quickstart.md ("Part A check"): on a phone with a saved YouTube progress from the old build, update the app, open it, and confirm the Continue note, the list, and "Tomorrow" rows are as before. This proves the migration on real data.
- [ ] T027 Commit Part A on its own branch `feature/platform-driver`, started from `main` only, so the 008 spec, plan, and tasks stay out of the restructure (Principle IV). Open a pull request titled "refactor: put YouTube behind a platform driver" with the description "No change for users. Store gets a version number and a migration. Every existing test passes.", and wait for the owner to merge it.

**Checkpoint**: The flow, store, mover, and screens know no platform by name. YouTube works as before.

---

## Phase 3: Part B foundation - GitHub building blocks (blocks all user stories)

**Purpose**: The GitHub modules with their tests, the driver, and the entry on Home. No user story is complete yet, but every module is tested on its own.

- [ ] T028 [P] Create `tests/mocks/githubFetch.ts`: `mockGithub(routes)` replaces `global.fetch` with a router that matches method and URL and returns canned answers (status, headers, JSON), records every call as `{ method, url, auth }` for assertions, and fails a test on any URL outside `github.com`, `api.github.com`, and `avatars.githubusercontent.com`. Include ready-made answers for the device code, the token (with `scope`, `expires_in` 28800, and a `refresh_token`), `GET /user`, and 204 for every add call.
- [ ] T029 [P] Write `tests/unit/githubTokens.test.ts` for `src/auth/githubTokens.ts` with the mocked secure store: the old account token lives only in memory (`setOld`, `getOld`, `dropOld`) and never reaches the secure store; the new account token is saved under the key `github.new` with the value `{ token, accountId, scopes, expiresAt }`; `getNew()` returns `null` when `expiresAt` has passed; `dropNew()` deletes the key; a `refresh_token` passed in is never stored; `scopes` are the ones GitHub granted, not the ones asked for; saving a new token replaces the old value.
- [ ] T030 Create `src/auth/githubTokens.ts` per T029 and data-model.md "Tokens". Make T029 pass.
- [ ] T031 [P] Write `tests/unit/githubAuth.test.ts` for `src/auth/github.ts` with `mockGithub` and fake timers: `signIn` posts to `https://github.com/login/device/code` with `client_id` and `scope` (empty for the old account) and checks the answer before use: `verification_uri` starts with `https://github.com/`, `user_code` is 8 letters or digits with one dash, `interval` is 1 to 60, `expires_in` is 60 to 1800 (each failure is rejected); it polls `https://github.com/login/oauth/access_token` with `client_id`, `device_code`, and `grant_type=urn:ietf:params:oauth:grant-type:device_code` every `interval` seconds; `authorization_pending` keeps waiting; `slow_down` adds 5 seconds to the interval; `expired_token`, `incorrect_device_code`, `incorrect_client_credentials`, `unsupported_grant_type`, `device_flow_disabled`, and an unknown error stop with `failed`; `access_denied` stops with `cancelled`; polling stops when `expires_in` has passed and when the abort signal fires; the token answer needs a string `access_token`, `token_type` of `bearer`, and a string `scope`; the account comes from `GET https://api.github.com/user` (number `id`, string `login`, `name` or the login, `avatar_url`); `onCode` is called with the code and then with `null`; nothing is logged.
- [ ] T032 Create `src/auth/github.ts` per T031 and contracts/github-api.md "Sign-in", with `scopesFor(kinds, already?)` that returns the space-separated scopes: stars `public_repo`, people `user:follow`, lists `user`, gists `gist`, joined with any scopes already granted and without duplicates (when `user` is present `user:follow` is left out because `user` includes it). Add `tests/unit/githubScopes.test.ts` first for `scopesFor` (each kind alone, all four, `user` with `user:follow`, with and without earlier scopes, an empty list gives an empty string). Client ID from `process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID`. Make T031 pass.
- [ ] T033 [P] Write `tests/unit/githubApi.test.ts` for `src/api/github.ts` with `mockGithub`: paging for `GET /user/starred`, `GET /user/following`, and `GET /gists/starred` with `per_page=100` until a page has fewer than 100; star lists through `POST /graphql` by cursor, 50 lists and 100 repositories per page; every answer is shape-checked and a wrong shape is rejected (Principle III.8); items get the ids and `data` of data-model.md "Kinds and item data" (`repo:<id>` with `{ fullName, nodeId }`, `person:<id>` with `{ login }`, `gist:<id>` with `{ gistId }`, `list:<node id>` with `{ description, isPrivate, repoItemIds: string[] }`, titles `owner/name`, the username, the description or first file name, the list name); every row of the contracts/github-api.md "Answer to outcome" table (204 moved; 401 auth; 404 couldnt_move with "It was deleted or is private." and for a person "Account was deleted."; 422 couldnt_move; 403 or 429 with `retry-after` of 60 or less is `wait`; longer, or `x-ratelimit-remaining: 0` with `x-ratelimit-reset`, is `later` at that time; a rate limit with no time is `wait` of 60 seconds; a 403 that is not a rate limit is couldnt_move, and the third in a row is `stop` with "GitHub paused your account's activity. Try again later."; 5xx and network failure are `retry`; a GraphQL `errors` field for a list is couldnt_move "GitHub couldn't make this list."); a rate limit is "a 403 or 429 with a `retry-after` header, or `x-ratelimit-remaining: 0`, or a message that contains 'rate limit'"; adding to a list sends the union of the lists the repository is already in on the new account and the target list, so no list is dropped (FR-GH-009, research R8); a list with the same name (ignoring case) is reused; the headers `Authorization`, `Accept`, and `X-GitHub-Api-Version: 2022-11-28` are on every call; `PUT` calls send `Content-Length: 0`.
- [ ] T034 Create `src/api/github.ts` per T033 and contracts/github-api.md. Functions: `listStars`, `listPeople`, `listGists`, `listLists`, `starRepo`, `followPerson`, `starGist`, `addToList(newToken, list, repoNodeIds)`, and `mapAnswer(status, headers, body)`. Keep the consecutive-403 counter in the caller's hands (passed in), not in a module variable. Make T033 pass.
- [ ] T035 [P] Extend `tests/unit/progressStore.test.ts` for the pace log: `recordAdd(accountKey, at)` stores one row; `addsSince(accountKey, since)` returns the times at or after `since` in order; each write deletes rows older than 1 hour ("Rows older than 1 hour are deleted on each write."); `deleteAll()` empties the log; two account keys never see each other's rows.
- [ ] T036 Edit `src/store/progressStore.ts`: add the table `add_log` (`account_key` text "Platform and new account ID, for example `github:583231`.", `at` integer) with `CREATE TABLE IF NOT EXISTS` in `migrate.ts`'s version 1 schema (no version bump, the table is new and empty), `recordAdd`, `addsSince`, and the delete in `deleteAll()`. Make T035 pass.
- [ ] T037 [P] Write `tests/unit/pacer.test.ts` for `src/move/pacer.ts` with a fake clock and a fake log: `beforeAdd()` answers `{ wait: ms }` so that adds are at least 3 seconds apart (20 per minute, FR-GH-010); after 300 adds in the last hour it answers `{ later: oldestAddInWindow + 3_600_000 }`; `beforeAdd()` records the add each time it lets one go, and nothing else records adds (research R9); `nextAt()` is 0 when an add is allowed now and the time the hourly pace allows the next add otherwise; `timeLeft(adds)` returns seconds as `adds * 3`; the log is per account key, and works across an app restart because it reads the store.
- [ ] T038 Create `src/move/pacer.ts` per T037 and research R9, with the numbers as named constants in this file (`// ponytail: fixed numbers, tune them from real runs if GitHub's limits change`). Make T037 pass.
- [ ] T039 [P] Write `tests/unit/githubDriver.test.ts` for `src/platforms/githubDriver.ts` with `@/auth/github`, `@/auth/githubTokens`, and `@/api/github` mocked: `kinds` order and headings (`repo` "Stars", `list` "Lists", `gist` "Gists", `person` "People" as the Pick sections, and the move order Stars, People, Gists, Lists from research R8); `signIn('old', ...)` asks for no scope and keeps the token in memory only; `signIn('new', kinds, ...)` asks for `scopesFor(kinds)` and saves the token with the granted scopes; `granted()` turns the saved scopes into kinds (`public_repo` is `repo`, `user:follow` or `user` is `person`, `user` is `list`, `gist` is `gist`); `canAct('new', id)` is false when the token is missing, belongs to another account, or has run out; `checkNew` returns the items the new account already has, plus the person whose ID is the new account's (spec, Edge Cases), with no request per item; `listOld` leaves out a kind whose read fails, names it in `missing`, and still returns the other kinds; `add` uses the new account token; for a list, `add` calls `pacer.beforeAdd()` before each repository add (the mover already called it for the list create) and returns `later` with the pacer's time when it says so; `pace.adds(items)` counts 1 per item plus 1 per repository of each picked list; `endMove()` drops the new account token; `signOut('new')` drops the token; `switchSignsOut` is true; `removeAccessUrl` is `https://github.com/settings/applications`.
- [ ] T040 Create `src/platforms/githubDriver.ts` per T039 and contracts/platform-driver.md, and add `githubWords` to `src/strings.ts` (draft texts, simple words: sign-in label "Sign in with GitHub" with icon `logo-github`; old hint "Where your stars and follows are now"; new hint "Where your stars and follows should go"; search "Search"; empty "This account doesn't follow anything yet"; pick text "Pick at least 1 item"; `later` "Later"; limit message "GitHub needs a break. We'll remind you when you can move the rest."; reminder body "You can move the rest now."; `moveButton(n)` "Move {n} item(s)"; not-affiliated "Magpie is not made by or linked with GitHub. GitHub is a trademark of GitHub, Inc."; `accessNote` "Magpie's access ends on its own within 8 hours. To end it now, open GitHub settings."). Make T039 pass.
- [ ] T041 [P] Extend `tests/unit/appState.test.ts`: `setSignInCode({ role, code, hint } | null)` and `setGranted(kinds)` set their fields; `reset` clears both; `setOld` leaves `granted` alone (the new account owns it).
- [ ] T042 Edit `src/state/AppState.tsx`: add `signInCode: { role: 'old' | 'new'; code: string; hint: string | null } | null` and `granted: string[]` (kinds the new account has access for; the driver's `granted()` fills it) with their actions. Make T041 pass.
- [ ] T043 [P] Extend `tests/unit/platforms.test.ts` and `tests/components/home.test.tsx`: a GitHub entry is in the Automatic section after YouTube with the name "GitHub", the official logo hidden from screen readers, and the card still shows the name when the logo cannot load (the tests set the entry's `ready` to true); on the dark look the card uses the white logo; its `unfinished()` counts only GitHub progresses; Home needs no change beyond the entry (SC-004).
- [ ] T044 Edit `src/platforms/platforms.ts` and `src/ui/PlatformCard.tsx`: `PlatformId` gains `'github'`; add the GitHub entry (`logo: require('../../assets/platforms/github.png')`, `logoDark: require('../../assets/platforms/github-white.png')`, `section: 'automatic'`, `ready: true`, `driver: githubDriver`); the card picks `logoDark` on the dark look. Set `ready: false` (`// ponytail: hidden until US5 passes, flip at the Phase 8 checkpoint`), so Part B can merge in pieces. Make T043 pass.

**Checkpoint**: Every GitHub module is tested alone. The flow still cannot sign in to GitHub from a screen.

---

## Phase 4: User Story 2 - Sign in to two different GitHub accounts (Priority: P1)

**Goal**: A user signs in to the old and then the new account with a code, and the app refuses the same account twice.

**Independent Test**: Quickstart checks 2 to 4 and 9, with `mockGithub` in tests and a real pair of test accounts for the manual run.

### Tests for User Story 2 (write first, they must fail)

- [ ] T045 [P] [US2] Write `tests/components/githubSignIn.test.tsx` with `mockGithub`, a mocked `expo-clipboard`, and `Linking.openURL` mocked, rendering the app and opening the GitHub card: tapping Sign in on From shows the code in large text, copies it, and opens the verification page in the system browser (US2-1; the clipboard and the browser call are the behavior); the code's accessibility label reads it one character at a time; after the mock answers `authorization_pending` twice and then a token, the step shows the account's picture and username with no extra tap (US2-2); the old account's code panel has no switch hint; with the other step already signed in, the code panel of the second sign-in shows the hint "GitHub may show your old account. Tap your picture, then 'Switch account', to use your new one." (US2-3, FR-GH-007), in either order of From and To; the same account on From and To is refused with "This is your old account. Pick a different one." or "This is your new account. Pick a different one." (US2-4); an expired code leaves the step signed out with "Sign-in didn't finish. Try again." and no further polling (US2-5); `access_denied` leaves the step signed out with no error line; the in-app Cancel button stops polling and removes the code panel; the app keeps polling while it is in the background.

### Implementation for User Story 2

- [ ] T046 [US2] Edit `src/ui/AccountCard.tsx`: when `state.signInCode` has this card's role, show the code panel in place of the Sign in button: the code in large text with a label that reads each character, a Copy button (icon `copy-outline`, label "Copy code"), the hint when present, a waiting line, and a Cancel button (icon `close-outline`) that aborts the sign-in. Copy the code with `expo-clipboard` when the panel opens. Every button has an accessibility label. The card still looks and works the same for YouTube (no `signInCode`).
- [ ] T047 [US2] Edit `src/state/flows.ts` `signInOld` and `signInNew`: create an `AbortController` per sign-in and keep it in a module variable so Cancel can abort it; pass `onCode` that dispatches `setSignInCode` (with the hint text when the other step already has an account); pass the kinds (T051 supplies them for the new account; until then an empty list); open the verification URI with `Linking.openURL` when the code arrives; clear the code when the sign-in ends; a `cancelled` result shows no notice. The same-account refusal (`sameAsOld`, `sameAsNew`) already exists and now also signs out the refused token through `driver.signOut(role)`. Add the strings `signInCodeHint`, `copyCode`, and `waitingForYou` to `src/strings.ts`. Make T045 pass.

**Checkpoint**: Two GitHub accounts can sign in on From and To, in either order.

---

## Phase 5: User Story 1 - Move stars and follows to a new GitHub account (Priority: P1) MVP

**Goal**: The old account's stars, star lists, starred gists, and followed people show on Pick in sections, and Move adds the picked items to the new account at the allowed pace.

**Independent Test**: Quickstart checks 1, 5 to 7, and 13, with `mockGithub` in tests.

### Tests for User Story 1 (write first, they must fail)

- [ ] T048 [P] [US1] Write `tests/components/githubPick.test.tsx` with `mockGithub` and both accounts signed in: Pick shows sections under the headings "Stars", "Lists", "Gists", and "People", each row with a picture and a name, all picked (US1-2, FR-GH-003); a kind with no items has no section; with only one kind the list is plain with no heading; search, All, and the counter work across all sections; "Already there" rows after the To sign-in cannot be picked (US1-3); a person whose ID is the new account's shows "Already there" after the To sign-in; when the lists read fails, Pick shows the other kinds and "Some items couldn't load. The rest can still move."; an old account with nothing shows "This account doesn't follow anything yet" and no Move button; a list of 250 stars loads in pages with a loading line and is searchable when it ends; the Move button reads "Move N items" and "12 of 340 picked" uses "items" (FR-GH-004).
- [ ] T049 [P] [US1] Write `tests/components/githubMove.test.tsx` with `mockGithub`, fake timers, and the real store: tapping Move changes each row in place to Moving and then Moved, in the order Stars, People, Gists, Lists, and a summary shows (US1-4); no request goes out with the old account token after the list is read, and no `DELETE` request is made at all (US1-5, FR-GH-009); a 404 on a person shows "Couldn't move" with "Account was deleted." and the rest go on (FR-GH-017); moving a list creates it with the same name and description, or reuses a list with the same name, adds every repository of the list that is Moved or Already there, and the row says how many were left out; picking a list does not pick its repositories (FR-GH-018); a repository already in another list on the new account stays in that list; a list stopped by the hourly pace part way returns Later, and Continue runs the whole list again without dropping any list on the new account; each add waits at least 3 seconds after the last (FR-GH-010, the pace is wired here so no story can move faster); the move needs both accounts signed in.

### Implementation for User Story 1

- [ ] T050 [US1] Edit `src/ui/PickStep.tsx`: with more than one kind in `items`, build the list as section header rows and item rows in the existing `FlatList` (research: header rows keep the virtualized list and the fixed row height), ordered by the driver's `kinds`; headings from the driver; one kind means no heading; search and All work over all rows; the counters use "items" from `driver.words`; the empty text and the Move button from `words`. Make the Pick part of T048 pass.
- [ ] T051 [US1] Edit `src/state/flows.ts`: `signInOld` reads the list through `driver.listOld()` (GitHub drops the old token inside the driver); `signInNew` calls `driver.checkNew` and applies the returned IDs with `markAlreadyThere`; `signInOld` shows `strings.loadPartial` ("Some items couldn't load. The rest can still move.") when `listOld` returns a non-empty `missing`; the kinds passed to the new sign-in are the kinds of the picked items, or all kinds except `gist` when no list is read yet (never `gist`, FR-GH-020); `startMove` passes a pacer built from the driver's `pace` to `runMove` (only the pacer records adds, research R9), and the flow refreshes `granted` from `driver.granted()` after every sign-in; `isMovable` and the picked counters ignore rows whose kind is not in `state.granted`, so a gist is never moved without its access.
- [ ] T052 [US1] Edit `src/platforms/githubDriver.ts` `add`: dispatch by item kind (research R8, contracts/github-api.md "Add"), for lists create or reuse the list and add the repositories whose rows are Moved or Already there (read from the `items` argument), save the left-out count as the row's `reason` ("{n} left out"), and call `pacer.beforeAdd()` before each `updateUserListsForItem` (research R9); if it answers `later`, return `later`. Make T049 pass.

**Checkpoint**: A full GitHub move works end to end with the pace in force. This is the MVP.

---

## Phase 6: User Story 3 - Slow pace, wait, and continue later (Priority: P2)

**Goal**: The user sees the time left, short waits are silent, long waits stop the move with Later rows and a reminder, and Continue finishes the rest.

**Independent Test**: Quickstart check 10 with the development quota switch, and with `mockGithub` in tests.

### Tests for User Story 3 (write first, they must fail)

- [ ] T053 [P] [US3] Write `tests/components/githubPace.test.tsx` with `mockGithub`, fake timers, the `expoNotifications` mock, and the real store: Pick shows the time left for the picked items before Move ("About 4 minutes" for 80 items, "Less than a minute" for 10, "More than one session" for more than 300) (US3-1, FR-GH-011); a `retry-after` of 30 seconds makes the move wait and go on with the rows still Moving and no message (US3-2, FR-GH-012); a `retry-after` of 3,600 stops the move, marks the rest "Later", shows "GitHub needs a break. We'll remind you when you can move the rest.", and schedules one reminder at the later of GitHub's time and the pace time (US3-3, US3-4); a rate limit with no time waits 60 seconds once and then stops as Later one hour on; reaching 300 adds in an hour stops the same way; after the break the Home card shows "Continue: N left" and Continue moves only the rest, with no item moved twice (US3-5); three non-rate-limit 403 answers in a row stop with "GitHub paused your account's activity. Try again later." and no further add; losing the internet pauses with "No internet. Try again when you're online." and unfinished rows go back to waiting.

### Implementation for User Story 3

- [ ] T054 [US3] Edit `src/ui/PickStep.tsx` and `src/strings.ts`: add a time-left line above the Move button from `timeLeft(driver.pace.adds(pickedMovable))`: under 60 seconds "Less than a minute", over 300 adds "More than one session", otherwise "About {n} minute(s)". Only for platforms whose driver has a `pace` (YouTube shows nothing new).
- [ ] T055 [US3] Edit `src/state/flows.ts` `startMove`: on `limit` ask for reminders once with `askOnce()` and schedule the reminder at the progress's `resume_at` with the driver's reminder body; on `stopped` show the driver's notice and keep the move state `stopped` so the Continue button shows; make the Continue note on Home use `unfinished()` for GitHub. Make T053 pass.

**Checkpoint**: Pauses, reminders, and Continue work for GitHub.

---

## Phase 7: User Story 4 - Sign out and remove access (Priority: P2)

**Goal**: Tokens stay on the phone only as long as needed, Sign out works, and the user can open GitHub's page to remove Magpie's access.

**Independent Test**: Quickstart checks 11 and 12.

### Tests for User Story 4 (write first, they must fail)

- [ ] T056 [P] [US4] Write `tests/components/githubSignOut.test.tsx` with `mockGithub`, the mocked secure store, and the real store: after the old list is read the app holds no token for the old account (US4-4); the new account token is in the secure store while a move is unfinished and a paused move continues with it (US4-5); the token is deleted when the summary shows after a finished move (US4-5); the stored value never holds a refresh token (FR-GH-019, `__dump()` has no `refresh_token`); tapping Sign out deletes the token and the step shows signed out with a Sign in button (US4-1); the summary, the To step after Sign out, and Settings next to Delete all show the line "Magpie's access ends on its own within 8 hours. To end it now, open GitHub settings." with a button that opens `https://github.com/settings/applications` through `Linking.openURL` (US4-3, FR-GH-019); Delete all leaves no GitHub account, token, list, progress, or add log (US4-2, FR-GH-013); an expired token makes the next move show "Your sign-in ran out. Sign in again to keep going." and keep the progress.

### Implementation for User Story 4

- [ ] T057 [US4] Edit `src/state/flows.ts`: when a move ends as `done` (or finds nothing movable) call `driver.endMove?.()`; add `switchAccount(state, dispatch, role)` that, for a driver with `switchSignsOut`, calls `driver.signOut(role)` and clears that step (`setNew(null)` for the new account; `setOld(null, [])` for the old one) instead of starting a new sign-in. For those drivers the button reads "Sign out" (icon `log-out-outline`); the others keep "Switch". `src/ui/AccountCard.tsx` calls `switchAccount` for those drivers and `onSignIn` for the others (YouTube keeps today's behavior).
- [ ] T058 [US4] Edit `src/ui/PickStep.tsx`, `src/ui/ToStep.tsx`, `src/ui/SettingsView.tsx`, and `src/strings.ts`: a small `AccessNote` component in `src/ui/AccessNote.tsx` shows `words.accessNote` and a button (icon `open-outline`, label "Open GitHub settings") that opens `driver.removeAccessUrl`; it shows on the summary after a finished move, on the To step when no new account token is held and the platform has `removeAccessUrl`, and in Settings next to Delete all for every driver that has a `removeAccessUrl`. Make T056 pass.

**Checkpoint**: Sign-out, deletion, and the remove-access button work.

---

## Phase 8: User Story 5 - Choose what to share (Priority: P2)

**Goal**: The new account is asked for only the access of the picked kinds, never gists at first. A kind without access is greyed out with an Allow button.

**Independent Test**: Quickstart checks 5, 8, and 8b.

### Tests for User Story 5 (write first, they must fail)

- [ ] T059 [P] [US5] Write `tests/components/githubShare.test.tsx` with `mockGithub` (inspect the `scope` sent to the device code call): the To sign-in with all kinds picked asks for `public_repo user` and never `gist` (US5-1); with only People picked it asks for `user:follow` only; unpicking a kind before the To sign-in removes its scope; a kind without granted access shows its section greyed out with a line such as "Magpie needs extra access to move gists." and an Allow button, its rows not pickable (US5-2); tapping Allow signs in to the same new account again asking for the earlier scopes plus that kind's, and the rows become pickable and all picked, and Move then stars the gists with the `gist` token (US5-3); a different account on an Allow sign-in is refused with "Use your new account here too." (US5-4); when GitHub grants fewer scopes than asked (the answer's `scope` lacks `public_repo`) the Stars section stays greyed (US5-5); Move with a greyed kind runs the other kinds and the summary does not count that kind as failed (US5-6); gists are asked for only through Allow.

### Implementation for User Story 5

- [ ] T060 [US5] Edit `src/ui/PickStep.tsx`, `src/state/flows.ts`, and `src/strings.ts`: a section whose kind is not granted shows greyed out with the line and an Allow button (icon `key-outline`, label "Allow"); `allowKind(state, dispatch, kind)` runs `signInNew` with `scopesFor([kind], granted scopes)`, refuses a different account with `allowOtherAccount` ("Use your new account here too."), then refreshes `granted` and picks the new rows; the summary counts only moved, already there, couldn't move, and waiting rows of granted kinds. Make T059 pass.

**Checkpoint**: All five stories work. Flip the GitHub entry to `ready: true`.

---

## Phase 9: Polish and cross-cutting

**Purpose**: Spec follow-ups from the plan check, docs, and the last checks.

- [X] T061 [P] Edit `specs/008-github-platform/spec.md` (wording only, no behavior change): add "add times for the pace" to FR-GH-014's list of kept data; change FR-GH-007 to say the hint shows with the code when the other step is already signed in, in either order; add one line to FR-GH-006 that the code stays on the clipboard after sign-in and is useless once it is used or expired (accepted); add "Magpie is not made by or linked with GitHub" to FR-GH-015; change the owner step to the organisation link `https://github.com/organizations/Dodo-Tech-Hub/settings/applications/new` and add "Delete the empty Redirect URI row if GitHub accepts it". Add a Cancel button (stops the wait) to FR-GH-006.
- [X] T062 [P] Edit `specs/008-github-platform/research.md` R8: add one line that Pick headings run Stars, Lists, Gists, People while items move as Stars, People, Gists, Lists, because lists need their repositories moved first.
- [ ] T063 [P] Write `tests/components/settings.test.tsx` additions for the not-affiliated lines (YouTube and GitHub each show their own line) if T022 did not already cover them, and for Delete all signing out of both drivers.
- [ ] T064 Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm audit`; all pass with no high or critical issue (constitution III.11, Development Workflow). Run `grep -rn "console\.\|log(" src/auth/github.ts src/api/github.ts src/platforms/githubDriver.ts` and confirm nothing logs tokens, codes, usernames, or item lists (constitution III.7).
- [ ] T065 Run the full quickstart.md "Part B check" (checks 1 to 13) with the two test GitHub accounts and the client ID in `.env`, and note each result in the pull request. Set `EXPO_PUBLIC_GITHUB_CLIENT_ID` in the EAS environment variables.
- [ ] T066 Open the Part B pull request with the suggested description "Add GitHub as an Automatic platform: code sign-in, stars, lists, gists, people, pace limits, access per picked kind." After the owner merges it, set the `**Status**:` line in `specs/008-github-platform/spec.md` to `Implemented` (AGENTS.md).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependency.
- **Part A (Phase 2)**: needs T001 to T005. T027 (merge of the Part A pull request) blocks everything after it.
- **Part B foundation (Phase 3)**: needs Part A merged and T002 to T004. Blocks all stories.
- **US2 (Phase 4)** then **US1 (Phase 5)**: US1 needs sign-in. After Phase 5 the MVP works.
- **US3, US4, US5 (Phases 6 to 8)**: each needs US1 and US2, and can run in any order after them (US3 edits `PickStep.tsx` and `flows.ts` like US1, US4, and US5, so run them one at a time or merge carefully).
- **Polish (Phase 9)**: after the stories you want to ship.

### Order inside Part A (each test task before its code task)

T006, T007 (migration) before T008, T009 (store) before T011, T012 (driver) and T013, T014 (mover) before T020 (flows). T010 (types) before T011. T015, T016 (state) and T017, T018 (platform list) before T020. T019 (component test updates) before T023 and T024 (screens), and all of Part A is checked at T025.

### Parallel Opportunities

- Phase 1: T003 and T004.
- Part A: T006, T008, T010, T011, T013, T015, T017, T019 are all test or type files and can be written together; code tasks follow their test.
- Part B foundation: T028, T029, T031, T033, T035, T037, T039, T041, T043 (tests) can be written together; T030, T032, T034, T036, T038 touch different files and can run in parallel after their tests.
- Stories: the test tasks T045, T048, T049, T053, T056, T059 are separate files and can be written together.

## Parallel Example: Part B foundation

```bash
# Write these tests together (different files):
Task: "Write tests/unit/githubTokens.test.ts"        # T029
Task: "Write tests/unit/githubAuth.test.ts"          # T031
Task: "Write tests/unit/githubApi.test.ts"           # T033
Task: "Write tests/unit/pacer.test.ts"               # T037
```

## Implementation Strategy

### MVP First

1. Phase 1 and Part A (Phase 2). Merge Part A. YouTube is unchanged for users.
2. Phase 3 (foundation), Phase 4 (US2), Phase 5 (US1). Stop and run quickstart checks 1 to 7 and 13. A user can already move stars, lists, gists (only after US5), and people.
3. Add US3 (pace and pauses), US4 (sign-out and access note), and US5 (access per kind) one at a time, running its quickstart checks after each.

### Notes

- Never log or commit tokens, codes, usernames, or item lists. `.env` stays local.
- One logical change per commit, Conventional Commits, as AGENTS.md says. Commit after each task or small group.
- Gists cannot move until US5 (Allow) is done, because the first sign-in never asks for `gist`; until then `isMovable` (T051) skips them. The gist move itself is tested in US5 (T059).
