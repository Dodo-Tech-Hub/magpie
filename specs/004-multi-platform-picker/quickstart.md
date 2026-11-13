# Quickstart: Check the Platform Picker

## Prerequisites

- Project dependencies installed (`npm install`).
- A dev build on an Android phone or emulator, and on an iPhone or simulator (`npx expo run:android`, `npx expo run:ios`, or an EAS dev build).
- Two Google test accounts for the YouTube flow, as in spec 001.
- The official YouTube logo file at `assets/platforms/youtube.png`.

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

Expected: all pass, including every test that existed before this feature (SC-002).

## Manual checks

| # | Do | Expect | Spec |
| --- | --- | --- | --- |
| 1 | Open the app fresh. | Home shows the Automatic section with the YouTube card. No Guided section. | US1-1, FR-001 |
| 2 | Turn on TalkBack or VoiceOver and move to the card. | Reads "YouTube. We move them for you". | FR-006 |
| 3 | Tap the YouTube card. | Top bar with From, Pick, To and a Home button. Flow works as before. | US2-1, FR-008 |
| 4 | Pick channels, move until the daily limit, tap Home. | YouTube card shows "Continue: n left". | FR-007, FR-010 |
| 5 | Tap the Continue note. | Opens that progress at the saved place. | FR-007 |
| 6 | Start a second progress with another account pair, stop before it ends, go Home, tap the note. | Note shows the total left for both. Tap opens the From step with the Unfinished list. | FR-007 |
| 7 | Wait for the reminder, tap it while Home shows. | Opens the progress directly. | FR-009 |
| 8 | Set the largest text size, rotate the phone, switch theme. | Cards reflow, nothing cut off, grid scrolls. | US1-4, SC-004 |
| 9 | Settings from Home, Delete all. | Every progress gone. Card has no Continue note. | FR-011 |
| 10 | Android: in the YouTube flow, use the system back gesture. | Returns to Home, nothing lost. | FR-010 |

Test-only check for a ready Guided platform (US1-2) is covered by `tests/components/home.test.tsx` with a test list that marks one Guided entry ready.
