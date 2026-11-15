# Quickstart: Check Limit Reasons

How to prove the feature works. Addresses and page content are in [contracts/limits-pages.md](contracts/limits-pages.md).

## Automatic checks

```bash
npm test && npm run typecheck && npm run lint
```

- New tests `limitReason` and `homeInfo` pass.
- Existing tests pass with only the limit sentence changed (SC-005).

## Step 1. Pages (needs the owner, once the repository is public)

1. Repository Settings, Pages: "Deploy from a branch", branch `main`, folder `/docs`.
2. Open both addresses of the contract on a phone.

| Check | Good | If not |
| --- | --- | --- |
| The address without `.html` shows the page | Page shows | Report it: the plan adds a small `docs/_config.yml` (research R2) |
| The page fits the phone screen, no sideways scroll | Fits | Same |
| The page has all parts of the contract | All there | Fix the Markdown file |

3. Change one sentence in `docs/limits/youtube.md` on `main`. Within 10 minutes the address shows the new sentence (SC-003, US3.1). The GitHub page is unchanged (US3.2).

Before the repository is public, both addresses show GitHub's "not found" page. That is expected for test builds.

## Step 2. On a phone

Build locally (`npx expo run:android`). Use test accounts.

| # | Do | Expect | Covers |
| --- | --- | --- | --- |
| 1 | On Home, look at the cards. | Each card has an info button in a corner. It does not cover the name or the Continue note. | US2.1 |
| 2 | Tap the info button on YouTube. | The browser opens the YouTube limits page. The YouTube flow does not open. | US2.2, SC-002 |
| 3 | Go back to the app. | Home, as before. | US2.3 |
| 4 | Turn on TalkBack or VoiceOver and focus the button. | "About YouTube limits, button". | US2.4 |
| 5 | Set the largest font size and a narrow screen. | The button stays inside the card and keeps its size. | Edge case |
| 6 | Turn off the internet and tap the button. | The browser shows its own "no internet" page. | Edge case |
| 7 | On a fresh install, start a YouTube move that hits the daily limit. | The popup says the YouTube sentence, then "Can we remind you when you can move the rest?". | US1.1 |
| 8 | Answer Yes or No. | Pick shows the paused rows, the same sentence, "Learn more", and Continue. No "We'll remind you". | US1.3 |
| 9 | Tap "Learn more". Go back. | The same page as in row 2. Pick is as before. | US1.5 |
| 10 | Hit a limit again. | No popup. The sentence is on Pick. | US1.4 |
| 11 | Start a GitHub move that stops at a limit (more than 300 items in an hour, or GitHub asks Magpie to wait). | The GitHub sentence, in the popup (fresh install) or on Pick. | US1.2 |
| 12 | Tap the info button on a card with a Continue note. | Only the page opens. | Edge case |

## Step 3. With testers (SC-001)

Show 5 people only the popup of row 7. Each one says in their own words why the move stopped. 5 of 5 must be right.
