# Quickstart: Subscription Migration

How to run the app and prove the feature works. Details live in [data-model.md](data-model.md), [contracts/youtube-api.md](contracts/youtube-api.md), and [contracts/ui.md](contracts/ui.md).

## Prerequisites

- Node.js 20 or newer and npm.
- An Expo account and EAS CLI (`npm install -g eas-cli`).
- An Android phone or emulator (iOS later).
- A Google Cloud project owned by the project owner, with:
  - YouTube Data API v3 enabled.
  - OAuth consent screen in Testing mode, with the test Google accounts added as test users.
  - OAuth client IDs: Android (package name and signing SHA-1 from EAS), iOS (bundle ID), and Web (needed by the sign-in SDK as `webClientId`).
- Two test Google accounts: one following a few channels (old), one following none or a few of the same (new).

## Run

```bash
npm install
npx eas build --profile development --platform android
npx expo start --dev-client
```

Expo Go cannot be used because Google Sign-In is a native module.

## Automated checks

```bash
npm test
npx tsc --noEmit
npx expo lint
```

All MUST pass (constitution quality gates).

## Manual validation scenarios

| # | Steps | Expected |
|---|-------|----------|
| 1 | Open app fresh, tap Pick | Lock and "Sign in to your old account first" (US2) |
| 2 | Sign in to old account | From shows done; Pick shows all channels picked and the counter (US1, US4) |
| 3 | On To, sign in to the old account again | Refused with the same-account message (US3) |
| 4 | Sign in to the new account | Channels it already follows show "Already there"; Move count excludes them (US5) |
| 5 | Search a name, untick some, clear search | Picks kept; counter correct (US4) |
| 6 | Tap Move | Rows change in place to Moving… then Moved; summary stays (US1). New account follows exactly those channels in YouTube. |
| 7 | Turn on airplane mode during a move | Move stops with "No internet"; moved rows stay moved |
| 8 | Kill the app during a move, reopen | Statuses correct; no channel followed twice (SC-004, SC-005) |
| 9 | Simulate daily limit (test build flag that makes the mover treat the Nth request as `quotaExceeded`) | Rows show Tomorrow, message shown, permission asked, reminder scheduled (US6) |
| 10 | Sign out, reopen, tap the unfinished progress on From | Asks only for the new account; Continue moves only waiting channels (US7, R2) |
| 11 | Delete a progress, then Delete all data | Progress gone; then all data gone and signed out (FR-034, FR-012) |
