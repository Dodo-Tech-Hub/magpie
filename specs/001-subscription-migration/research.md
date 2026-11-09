# Research: Subscription Migration

Phase 0 decisions for [plan.md](plan.md). Each entry lists the decision, why, and what else was considered.

## R1. Google sign-in and access tokens

- **Decision**: `@react-native-google-signin/google-signin` v17 (free "Original" API), configured per role right before each sign-in with that role's scope. Access tokens come from `getTokens()` when needed and are kept only in memory.
- **Rationale**: It is the sign-in library Expo's docs point to, works with EAS development builds through its config plugin, gives an access token for YouTube API calls without a backend, and stores credentials in the OS secure store itself. The app never handles refresh tokens.
- **Risk (accepted by owner 2026-11-09)**: on Android, the free version uses Google's legacy Sign-In API, which Google has deprecated in favor of Credential Manager plus the Authorization API. It still works today, but Google could turn it off later. The maintainer sells a paid "Universal Sign In" package built on the modern APIs. Mitigation: all sign-in calls go through `src/auth/google.ts`, so switching to the paid package or a small custom native module later only touches that file.
- **Alternatives considered**:
  - `expo-auth-session` with the system browser and PKCE: Expo has deprecated its Google provider, and Google blocks custom URI scheme redirects for Android OAuth clients by default.
  - Universal Sign In (paid): modern APIs, but costs money before the app has proven itself.
  - Custom Expo native module wrapping Android's Authorization API: most future-proof, but native Kotlin and Swift work that is out of proportion for v1.

## R2. Two accounts with an SDK that holds one session

- **Decision**: Only one Google account is signed in to the SDK at a time. The old account is used once to read the full subscription list, which is saved with the account's ID, email, name, and photo. Then the user signs in to the new account, which stays the active session for checking "Already there" and for moving.
- **Rationale**: Moving needs only the new account's token. The saved list covers everything the Pick screen needs from the old account. This avoids juggling two live sessions, which the free SDK cannot do.
- **Effect on the spec (accepted by owner 2026-11-09, FR-033 updated)**: "Old account signed in" in the UI means "old account verified and its list loaded". Continuing a saved progress asks the user to sign in to the new account only; the old account is shown from the saved info. Reloading the old account's list (for example after it followed new channels) asks the user to sign in to it again.
- **Alternatives considered**: keep both accounts signed in by storing two token sets ourselves; rejected because it needs refresh tokens, which require a backend or a client secret.

## R3. Same-account check

- **Decision**: Compare the Google account ID (`user.id`) of the new sign-in against the saved old account ID, and the other way round. Refuse with the FR-008 message and sign the refused account out.
- **Alternatives considered**: comparing emails; rejected because IDs are stable and emails can change.

## R4. Saved progress storage

- **Decision**: `expo-sqlite` with two tables, `progress` and `progress_channel` (see [data-model.md](data-model.md)). Each status change is a single-row update.
- **Rationale**: SC-004 (never follow twice) needs the status written before and after each request, and those writes must survive a crash. Row updates are atomic and cheap, and a unique key on (old account, new account) enforces one progress per pair (FR-031).
- **Alternatives considered**: one JSON blob per progress in AsyncStorage or a file; rejected because every status change rewrites the whole blob, and a crash mid-write can lose the list.

## R5. Moving loop and failure handling

- **Decision**: Move channels one at a time. Before each request, set the channel to `moving` and persist it. Map the result:
  - success, or `subscriptionDuplicate`: `moved`
  - `quotaExceeded` or `dailyLimitExceeded`: stop; this and all remaining picked `waiting` channels become `tomorrow`; schedule a reminder
  - `subscriptionForbidden`, `publisherNotFound`, `channelNotFound`, or other 4xx: `couldnt_move`, continue
  - 401: refresh the token through the SDK once and retry; if that fails, stop and ask the user to sign in again
  - network error, 429, or 5xx: retry twice with backoff (1 s, 4 s); then stop, set the channel back to `waiting`, and show the "No internet" message
- On app start, any channel left in `moving` (crash mid-request) is checked against the new account's subscription list and becomes `moved` if it is there, else `waiting`.
- **Rationale**: Sequential calls make status tracking simple and stay far below per-minute limits. The crash check is what makes SC-004 hold.
- **Alternatives considered**: parallel requests; rejected because they burn quota faster on errors and complicate recovery, for no real gain at about 200 follows per day.

## R6. "Already there" check

- **Decision**: After the new account signs in, read its full subscription list (1 unit per 50 channels) and mark matching channel IDs `already_there`. Re-run when the new account changes or a progress is continued.
- **Alternatives considered**: `subscriptions.list` with `forChannelId` in groups of 50; same cost, more code.

## R7. Daily limit reset time and reminders

- **Decision**: Compute the next quota reset as the next midnight in Pacific Time with a small pure function that applies the US daylight saving rule (second Sunday of March to first Sunday of November). Schedule one local notification per waiting progress at that time with `expo-notifications`, carrying only the progress ID. Ask for notification permission the first time the limit is hit (FR-028). No push tokens, no server.
- **Rationale**: A pure function is easy to unit test and does not depend on time-zone support in the JavaScript engine. Local scheduling needs no backend.
- **Alternatives considered**: `Intl.DateTimeFormat` with `timeZone: 'America/Los_Angeles'`; works on most devices but is harder to test and engine support has varied. Background tasks to continue automatically; rejected in the spec (Q1 answer C).

## R8. Navigation and state

- **Decision**: No navigation library. `App.tsx` renders the top bar and one of three step views based on `currentStep` in a `useReducer` store shared through React context.
- **Rationale**: The design is one screen with three views; a router would add routes, deep links, and dependencies with no benefit.
- **Alternatives considered**: `expo-router` (Expo's default template); Zustand or Redux for state.

## R9. API response validation

- **Decision**: Hand-written type guards in `src/api/youtube.ts` for the two response shapes used (subscription list page and error body).
- **Rationale**: Two small shapes do not justify a validation dependency (constitution rule III.11).
- **Alternatives considered**: `zod`.

## R10. List performance

- **Decision**: React Native `FlatList` with fixed row height (`getItemLayout`), memoized rows, and in-memory filtering of names on each keystroke.
- **Rationale**: Filtering 2,000 short strings is well under a frame; fixed row height keeps scrolling smooth.
- **Alternatives considered**: `@shopify/flash-list`; add only if profiling on a low-end Android phone shows a problem.

## R11. Testing approach

- **Decision**: `jest-expo` preset, React Native Testing Library, and module mocks for `@react-native-google-signin/google-signin`, `expo-sqlite` (in-memory fake with the same query functions), `expo-notifications`, and global `fetch`.
- **Rationale**: Constitution Principle II: no real Google calls in tests; logic and flows are tested through their public functions and what the user sees.
