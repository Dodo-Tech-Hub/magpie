# Quickstart: Check the Guided Migration

## Prerequisites

- Spec 004 merged (Home and the platform list exist).
- `npm install` after the new Expo modules and `fflate` are added.
- Dev builds on Android and iOS.
- For each platform being checked: a real export from a test account, kept outside the repo. Never commit real exports; tests use made-up fixtures.
- For Twitch: the III.2 exception approved, `EXPO_PUBLIC_TWITCH_CLIENT_ID` set to a public-client app id, and a test Twitch account that follows a few channels.
- Optional: `EXPO_PUBLIC_GUIDE_HOST` set, for remote guide checks.

## Automated checks

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

## Manual checks

| # | Do | Expect | Spec |
| --- | --- | --- | --- |
| 1 | Home, tap a ready Guided card. | Intro with task, rough time, never-sign-in and never-tap promise. | US1-1, FR-003 |
| 2 | Continue to the data steps with the network off. | Numbered steps with pictures from the bundled guide. | US1-7, SC-003 |
| 3 | Pick a real export. | "Reading your file…", then the checklist with one row per account, newest follows first. | US1-3, US1-5 |
| 4 | Pick a photo or an unrelated JSON. | Wrong-file message with the sample picture; Pick file again. | US1-4 |
| 5 | Tap a name. | Profile opens in the other app, or the browser if it is not installed. | US2-1, FR-010 |
| 6 | Come back, tap the tick box. | Same scroll place; last opened row highlighted; count goes up; no profile opens. | US2-2, US2-3 |
| 7 | Tap the box again; Skip another row; search for a name. | Untick lowers the count; skipped row looks different; search filters rows in place. | US2-4, US2-5, FR-009 |
| 8 | Close the app fully, reopen. | Card shows "Continue: n left"; checklist has every tick and skip. | US3-1, SC-002 |
| 9 | Finish every row. | Totals with Keep list and Clear list. Keep: card has no note, opens the list. Clear: list gone. | US2-6, US2-9 |
| 10 | Start again; then Delete all in Settings. | Confirmation first; list removed. Delete all removes every guided list. | US3-2, US3-3 |
| 11 | Twitch: Sign in with Twitch, approve in the browser. | Checklist lists followed channels. Network log shows a revoke call; nothing Twitch-related stored. | US1-6, FR-008 |
| 12 | Watch network traffic through the whole flow (proxy on a dev build). | Only Twitch hosts and the guide host; the guide request has no query, cookie, or id; no export data sent. | FR-023, SC-005 |
| 13 | With a guide host: publish a higher revision, restart online. | New steps show. Publish a broken file: last good guide stays. | US4-2, US4-3 |
