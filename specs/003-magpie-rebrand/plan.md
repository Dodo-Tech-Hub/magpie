# Implementation Plan: Magpie Rebrand

**Branch**: `feature/magpie-rebrand` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-magpie-rebrand/spec.md`

## Summary

Rename the app to "Magpie", ship the supplied magpie artwork as every icon, rename every project and store identifier to `magpie` / `com.dodotechhub.magpie`, and add a not-affiliated notice to the existing Settings view. All of it is configuration, generated image files, one string change, and one new line of Settings text. No new screen, no new dependency except `expo-splash-screen` (an Expo SDK module), no network or data change.

Technical approach:

- **Names**: one edit in `app.config.ts` (`name`, `slug`, `ios.bundleIdentifier`, `android.package`), `package.json` and `package-lock.json` (`name`), `src/strings.ts` (`reminderTitle`). Names that point at the YouTube service stay.
- **Icons**: one repeatable script, `scripts/make-icons.sh` (ImageMagick), turns `assets/magpie-icon-master.png` into every shipped image. Output is committed, so a build never needs ImageMagick. See [research.md](research.md) R2 to R4.
- **Opening screen**: `expo-splash-screen` config plugin with the Magpie mark on `#1F1F1F`, the icon's own background (R5).
- **Notification mark**: `expo-notifications` plugin options `icon` and `color` (R6).
- **Notice**: one `Text` block at the bottom of `SettingsView`, using the existing theme colors (R7).
- **Docs**: product name in `AGENTS.md` and the spec text (R9). The constitution title is left for the constitution step (spec, out of scope).

**Scope change from the previous plan**: the privacy policy no longer lives on this branch. It moved to `feature/privacy-policy` (platform-neutral, grows one platform at a time). This plan creates no policy file and makes no policy change. The spec still lists the policy as an owner to-do; the line "talks only to Google" in the spec's assumptions is stale now that more platforms are expected, and is reworded in task T-docs (R9).

## Technical Context

**Language/Version**: TypeScript (strict), React Native 0.88 via Expo SDK 58 (unchanged)

**Primary Dependencies**: One addition, `expo-splash-screen` (Expo SDK module, installed with `npx expo install`). Everything else already in the project. See [research.md](research.md) R5.

**Storage**: N/A. No data change. The old `youtube-subs-migrator` app data is not migrated (spec edge case).

**Testing**: Jest with `jest-expo` and React Native Testing Library. New tests: reminder title reads "Magpie" (component or unit), Settings shows the notice and its accessibility text (component), a config test that fails if `youtube` appears in any project or store identifier (unit). Icon quality is a manual review, see [quickstart.md](quickstart.md).

**Target Platform**: Android 8.0+ first, iOS 16+. Platform differences are in [contracts/app-identity.md](contracts/app-identity.md).

**Project Type**: Mobile app (single Expo project, no backend)

**Performance Goals**: None. Splash shows the same time as before.

**Constraints**: No new permissions, network calls, or stored data. All user-visible text from `src/strings.ts`. Nothing in the repo may hold a client secret. Android `allowBackup` stays `false`.

**Scale/Scope**: 5 existing files edited (`app.config.ts`, `package.json`, `package-lock.json`, `src/strings.ts`, `src/ui/SettingsView.tsx`), 1 script added, about 8 generated PNGs replaced or added in `assets/`, 2 docs edited, 3 test files added or extended.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` as it is on this branch (v1.0.0).

| Principle / rule | How the plan complies | Status |
|------------------|-----------------------|--------|
| I. No new screen | The notice goes in the existing Settings view. No navigation added. | Pass |
| I. Simple words | Notice: "Magpie is not made by or linked with YouTube or Google. YouTube is a trademark of Google LLC." Two short sentences, one idea each. | Pass |
| I. Accessibility labels | The notice is plain text, read in full by a screen reader. It is not interactive, so it needs no label. Test checks it is reachable by its text. | Pass |
| I. Icons on buttons | No button added. | N/A |
| II. Relevant tests | Reminder title test, notice test (Light and Dark), identifier test. Existing tests unchanged and must pass. | Pass |
| II. No real Google calls | New tests touch no network or auth. | Pass |
| III.1 to III.3 (scopes, sign-in, tokens) | Untouched. Scope names stay `youtube` and `youtube.readonly` (FR-011). | Pass |
| III.4 No secrets | Client IDs stay in `EXPO_PUBLIC_*` env vars, still public values only. The new package name and signing fingerprint go in Google Cloud, not the repo. | Pass |
| III.5 Network | No new endpoint. | Pass |
| III.6 Data minimization | No data added. The new app id is a separate install with its own empty storage. | Pass |
| III.7 Logging | Nothing logged. | Pass |
| III.9 Device permissions | None added. `expo-splash-screen` and the notification icon need none. | Pass |
| III.10 Backups | `allowBackup: false` kept. | Pass |
| III.11 Dependencies | `expo-splash-screen` is an Expo SDK module, lockfile committed. `npm audit` must show no high or critical issue before release (unchanged gate). ImageMagick is a dev tool, not a dependency. | Pass |
| III.12 OTA updates | Not used. | N/A |
| Stack / platform | Both platforms covered; Android-only and iOS-only behavior is flagged in the contract. | Pass |

**Gate result (pre-research)**: Pass. **Gate result (post-design)**: Pass. No exception to record.

Noted, not changed here: the constitution title and Platform section still say "YouTube Subscriptions Migrator". The spec defers this to the constitution step, and the constitution on `main` has since moved to v1.1.0 (code structure principle). Rebase or merge `main` before the constitution step to avoid a conflict.

## Project Structure

### Documentation (this feature)

```text
specs/003-magpie-rebrand/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1: identity values and asset set
├── quickstart.md        # Phase 1: how to check the result
├── contracts/
│   └── app-identity.md  # Phase 1: names, ids, icons, notice text per platform
├── checklists/
│   └── requirements.md  # From the specify step
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
app.config.ts            # name, slug, bundle id, package, splash + notification plugins, icons
package.json             # name, expo-splash-screen
package-lock.json        # name (regenerated by npm)
AGENTS.md                # product name
scripts/
└── make-icons.sh        # master PNG -> every shipped icon (new)
assets/
├── magpie-icon-master.png        # source, exists (sparkle already gone)
├── magpie-icon-large.png         # untracked variant, not used (see R2)
├── icon.png                      # iOS and fallback, replaced
├── android-icon-foreground.png   # replaced
├── android-icon-background.png   # replaced (flat #1F1F1F)
├── android-icon-monochrome.png   # replaced
├── splash-icon.png               # replaced
├── notification-icon.png         # new, white mark on transparent
└── favicon.png                   # replaced
src/
├── strings.ts           # reminderTitle, notice text
└── ui/SettingsView.tsx  # notice block
tests/
├── unit/identity.test.ts         # no "youtube" in identifiers (new)
└── components/settings.test.tsx  # notice test, reminder title test (extended)
```

**Structure Decision**: Keep the existing single Expo project. No new source folder. The only new directory is `scripts/`, for the icon script, because the icons must be rebuilt the same way each time the artwork changes.

## Complexity Tracking

No violations. Nothing to justify.
