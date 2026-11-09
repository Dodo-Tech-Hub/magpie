# Quickstart: Theme and Settings

How to run the app and prove the feature works. Details live in [data-model.md](data-model.md) and [contracts/ui.md](contracts/ui.md). Setup (Node, Android phone, development build) is the same as in the [migration quickstart](../001-subscription-migration/quickstart.md). This feature needs no Google account for most checks.

## Run

```bash
npx expo start --dev-client
```

Open the app on the phone from the development build.

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
| 1 | Fresh install, open the app, tap the gear | Settings opens. "Auto" is marked. The app matches the phone's look (US1, US2, FR-004) |
| 2 | Tap Dark, then tap back | Whole app is dark at once: top bar, From view, status bar. Same step as before (US1, US3) |
| 3 | Tap Light, then open Pick with a loaded list | Rows, status tags, search box, and Move bar are all readable in light (US1) |
| 4 | Pick Dark, close the app from recents, open it again | Opens dark with no white flash (FR-007, SC-002) |
| 5 | Pick Auto, switch the phone to dark in system settings, return to the app | App turns dark within 1 second. Switch the phone back: app turns light (US2, SC-003) |
| 6 | Pick Light while the phone is dark, change the phone mode | App stays light (US2, FR-006) |
| 7 | Pick channels on Pick, open Settings, go back | Same picks and counter. During a move, rows keep updating and the move is not stopped (SC-005) |
| 8 | Open Settings from To while an account card is showing, go back | Same card state (edge case) |
| 9 | Tap a step tab while Settings is open | Settings closes and that step shows |
| 10 | Check each state in both looks: picked, locked, done, "Already there", "Tomorrow", "Couldn't move", error message, delete icon | Text and icons are easy to read everywhere (FR-014, SC-004) |
| 11 | Settings, tap "Delete all my data", cancel | Nothing deleted |
| 12 | Same, then confirm | Data gone, signed out, From step shows. Open Settings: "Auto" is marked (FR-015) |
| 13 | Check the From view | No "Delete all my data" button there (FR-011) |
| 14 | Repeat 2, 4, and 5 on an iPhone or simulator when available | Same behavior (FR-016) |
| 15 | Turn on the phone's screen reader and walk through gear, back, the three choices, and Delete all | Each is announced by name, and the chosen look is announced as selected (FR-013) |
