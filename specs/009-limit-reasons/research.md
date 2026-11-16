# Research: Limit Reasons

Decisions for [plan.md](plan.md). The codebase was read at `main` of 2026-11-15, after spec 008 was merged.

## R1. Where the reason sentence lives

- **Decision**: Reword the existing `limitReached` text of each platform in `src/strings.ts`. `askOnce` in `src/reminders/reminder.ts` takes the sentence as a parameter and shows it above the question in the same alert.
- **Rationale**: `limitReached` is already one text per platform, already shown on Pick, and already supplied by each driver (FR-004). A second field would give two texts for one fact, which the clarification of 2026-11-15 rejected.
- **Alternatives considered**: A new `limitReason` field beside `limitReached` (two texts to keep equal). The reason as the alert title (titles are cut short on Android).

## R2. Where the pages are served from

- **Decision**: GitHub Pages from this repository, "Deploy from a branch", branch `main`, folder `/docs`. Files `docs/limits/youtube.md` and `docs/limits/github.md`. No `_config.yml`, no front matter, no theme of ours.
- **Rationale**: The owner chose the project's repository (clarification 1). GitHub Pages renders plain Markdown files with its default theme, which fits a phone screen, so there is no build step to keep. `docs/` is one of the two folders Pages can serve, and the privacy policy on `feature/privacy-policy` is already in `docs/`.
- **Addresses**: `https://dodo-tech-hub.github.io/magpie/limits/youtube` and `https://dodo-tech-hub.github.io/magpie/limits/github`. GitHub Pages serves `youtube.html` at the address without `.html`.
- **Update time**: a push to `main` starts a build of about 1 minute. Pages are cached for 10 minutes. This meets SC-003.
- **Limits**: Pages on a private repository need a paid plan, so the pages are live only after the repository is public (spec, Assumptions). The addresses hold the organization and repository names; a rename breaks them until an app release. A custom domain would remove that and is not needed now.
- **To verify on first deploy** (quickstart step 1): a file without front matter is rendered, the address without `.html` works, and the page reads well on a phone. If one fails, add a two-line `docs/_config.yml` or front matter; the addresses stay the same.
- **Alternatives considered**: A separate public repository (rejected by the owner). Raw Markdown links to `github.com` (shows the GitHub interface, not a plain page, and is not reachable while private). The static guide host of the constitution (the app would fetch it; here the browser does, which needs no allowlist entry).

## R3. Opening the page

- **Decision**: `Linking.openURL(url)` from React Native, with the rejection caught and turned into the line "Couldn't open the page." No `canOpenURL`.
- **Rationale**: `Linking.openURL` is how spec 008 opens the browser, and it opens the system browser, not a view inside the app (FR-009). On Android 11 and later `canOpenURL` answers false unless the app declares which links it asks about; `openURL` needs no such setting and rejects when nothing can open the link.
- **Alternatives considered**: `expo-web-browser` (a browser tab inside the app, a new dependency, and against FR-009). An alert for the failure (the constitution keeps dialogs for destructive actions).

## R4. Where the address lives

- **Decision**: `limitsUrl?: string` on `Driver`, set in `youtubeDriver.ts` and `githubDriver.ts`.
- **Rationale**: Same pattern as `removeAccessUrl`. The driver is what Pick has in hand, and Home reaches it through `platform.driver`. Optional, so a platform without a page shows no button (FR-005).
- **Limit**: A Guided platform (spec 005) has no driver. When the first Guided platform needs a limits page, move the field to `Platform`. Not done now: no such platform exists.
- **Alternatives considered**: A field on `Platform` in `platforms.ts` (Pick would have to look the platform up for a value that sits beside `removeAccessUrl`). One base address plus the platform ID (hides the list of addresses that FR-010 wants explicit).

## R5. The info button on the card

- **Decision**: A third `Pressable` in `PlatformCard`, a sibling of the body and the Continue note, in the top right corner, 48 x 48 points, icon `information-circle-outline`, no text.
- **Rationale**: A sibling keeps taps apart: a button inside the body would also open the flow (FR-006). The corner is free: the logo is centered and the name is below it. The icon is the common "information" sign, and the spec asks for an icon button.
- **Alternatives considered**: A row under the name (taller cards, and it competes with the Continue note). A long press on the card (not discoverable, poor for screen readers).

## R6. The "couldn't open" line on Home

- **Decision**: `openLimits(url)` returns `true` or `false` and touches no state. Pick dispatches `setNotice` on `false` (it shows that field already). `HomeView` keeps its own line in local state.
- **Rationale**: One opener for both places, no reducer change. A move that runs in the background reports its notices through the shared `notice` field (`forProgress` in `flows.ts`), so a Home line built on it would show "No internet" or "Your sign-in ran out" there. A local line on Home cannot.
- **Alternatives considered**: Local state in `HomeView` plus a second failure path for Pick (two ways to do one job).
