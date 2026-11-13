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
| 2 | Turn on TalkBack or VoiceOver and move through Home. | Reads "Automatic" as a heading, then "YouTube. We move them for you". The logo is skipped. | FR-006, FR-015, FR-017 |
| 3 | Tap the YouTube card. | Top bar with From, Pick, To and a Home button. Flow works as before. | US2-1, FR-008 |
| 4 | Pick channels, move until the daily limit, tap Home. | YouTube card shows "Continue: n left". | FR-007, FR-010 |
| 5 | With the screen reader on, move to the Continue note, then tap it. | Reads "Continue YouTube, n left" as its own stop. Tap opens that progress at the saved place. | FR-007, FR-016, FR-017 |
| 6 | Start a second progress with another account pair, stop before it ends, go Home, tap the note. | Note shows the total left for both. Tap opens the From step with the Unfinished list. | FR-007 |
| 7 | Wait for the reminder, tap it while Home shows. | Opens the progress directly. | FR-009 |
| 8 | Set the largest text size, rotate the phone, switch theme. Repeat on a 320-point-wide screen (small emulator profile). | Cards reflow, names wrap to at most 2 lines and labels to 3, nothing cut off, grid scrolls. Text is easy to read in Light and Dark. | US1-4, FR-018, SC-004 |
| 9 | Tap the gear on Home, then Delete all. | Gear is in the same place as in the flow. Every progress gone. Card has no Continue note. | FR-011 |
| 10 | Android: in the YouTube flow, use the system back action. Then open Settings and use back again. Then use back on Home. | Flow returns to Home, nothing lost. Settings closes. On Home the app goes to the background as usual. | FR-010 |

Test-only check for a ready Guided platform (US1-2) is covered by `tests/components/home.test.tsx` with a test list that marks one Guided entry ready.
