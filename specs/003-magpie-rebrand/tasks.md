---

description: "Task list for the Magpie rebrand"
---

# Tasks: Magpie Rebrand

**Input**: Design documents from `specs/003-magpie-rebrand/` (plan.md, spec.md, research.md, data-model.md, contracts/app-identity.md, quickstart.md)

**Prerequisites**: plan.md and spec.md (both present). Constitution checked in the plan (all Pass).

**Tests**: Required by the constitution (principle II) and FR-015. Test tasks come before the code they check. Icons are binary files, so they are checked by hand (quickstart steps 3 and 4), not by Jest.

**Organization**: Grouped by user story. US1 (name, icon, opening screen, notification) and US2 (identifiers) both edit `app.config.ts`, so do them one after the other, not in parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1, US2, US3. Setup, Foundational, and Polish tasks have no label
- Paths are from the repository root

## Phase 1: Setup

**Purpose**: Tools and a clean start

- [x] T001 Check ImageMagick is installed (`magick -version`). If not, run `brew install imagemagick`. It is a dev tool only, not a project dependency.
- [x] T002 Install the splash module with `npx expo install expo-splash-screen`. Commit the changes to `package.json` and `package-lock.json`. Do not edit the `name` field in this task.
- [x] T003 Confirm `assets/magpie-icon-master.png` is 1024 x 1024 with background `#1F1F1F` (`magick identify assets/magpie-icon-master.png`). Leave `assets/magpie-icon-large.png` untracked and unused (research R2).

---

## Phase 2: Foundational (blocks US1)

**Purpose**: The icon build script. Every icon file in US1 comes from it.

**CRITICAL**: US1 icon and splash tasks need this script first.

- [x] T004 Create `scripts/make-icons.sh` (bash, `set -euo pipefail`, ImageMagick `magick`). Input `assets/magpie-icon-master.png`. One variable `DROP_BEAK_SPARK=0` at the top as the switch from research R2 (when `1`, paint the spark area with `#1F1F1F` before every output). Outputs listed in data-model.md "Icon Set":
  - `assets/icon.png`: master flattened onto `#1F1F1F`, 1024 x 1024, `-alpha off`, colorspace sRGB (RGB, no alpha, FR-005).
  - `assets/android-icon-background.png`: flat `#1F1F1F`, 432 x 432.
  - `assets/android-icon-foreground.png`: art only on transparent (turn `#1F1F1F` to transparent with fuzz, keep `#F3F3E7`), scaled to 72% (about 313 px), centered on a 432 x 432 transparent canvas so every art pixel is inside the 66 dp safe circle (FR-004, research R3).
  - `assets/android-icon-monochrome.png`: same shape as the foreground, art colored one flat color (white), transparent elsewhere.
  - `assets/splash-icon.png`: art only on transparent, 1024 x 1024, art fits in about 2/3 of the image (research R5).
  - `assets/notification-icon.png`: white mark on transparent, 96 x 96, mark filling about 80% (research R6).
  - `assets/favicon.png`: 48 x 48 downscale of `assets/icon.png`.
  Write comments on one line each, no hard wrap.
- [x] T005 Run `bash scripts/make-icons.sh`. Verify with `magick identify` that sizes match T004 and `magick identify -format '%[channels]' assets/icon.png` prints `srgb` (no alpha). Verify no art pixel of `android-icon-foreground.png` sits farther than 30.6% of 432 px (about 132 px) from the center, for example with `magick assets/android-icon-foreground.png -alpha extract -threshold 0 -trim -format '%wx%h' info:` (must be at most 264 x 264).

**Checkpoint**: Icon files exist and pass the numeric checks.

---

## Phase 3: User Story 1 - The app looks and reads like Magpie (Priority: P1) MVP

**Goal**: Display name, icons, opening screen, and reminder title all say Magpie.

**Independent Test**: Quickstart steps 4 and 5 on a real Android phone and an iPhone.

### Tests for User Story 1 (write first, they must fail)

- [x] T006 [P] [US1] In `tests/components/dailyLimit.test.tsx`, add a test: after the daily limit is hit and a reminder is scheduled, `scheduleNotificationAsync` (mock from `tests/mocks/expoNotifications.ts`) is called with `content.title` equal to `Magpie`. Reuse the existing `scheduled` mock and setup in that file. Fails now because the title is `Subs Migrator`.
- [x] T007 [P] [US1] Create `tests/unit/identity.test.ts` with a test that imports the default export of `app.config.ts` and asserts `name` is `Magpie`. (The identifier asserts are added in US2, T013.) Fails now.

### Implementation for User Story 1

- [x] T008 [US1] In `src/strings.ts` line 36, change `reminderTitle: 'Subs Migrator'` to `reminderTitle: 'Magpie'`. One string covers the notification and the permission question (research R6).
- [x] T009 [US1] In `app.config.ts`, change `name` to `'Magpie'` and `android.adaptiveIcon.backgroundColor` from `'#E6F4FE'` to `'#1F1F1F'`. Keep the `icon`, `foregroundImage`, `backgroundImage`, and `monochromeImage` paths (the files were replaced in T005).
- [x] T010 [US1] In `app.config.ts` `plugins`, add `['expo-splash-screen', { image: './assets/splash-icon.png', backgroundColor: '#1F1F1F', resizeMode: 'contain' }]` and change `'expo-notifications'` to `['expo-notifications', { icon: './assets/notification-icon.png' }]`. No `color` option (research R6). Then run `npx expo config --type introspect` and confirm the SDK 58 option names are accepted. If SDK 58 documents a different form for splash options, use it and note it in the commit message (research R5 open point).
- [x] T011 [US1] Run `npm run typecheck && npm run lint && npm test`. T006 and T007 pass, all older tests still pass.
- [x] T012 [US1] Checked on a Pixel 8 Pro (shapes, themed icon, splash, small size all pass); the reminder notification waits for T017. Manual check, quickstart steps 4 and 5: no stray mark on any icon, art whole in circle, squircle, square, and rounded-square launcher shapes, themed icon is one flat color, icon readable at 48 px and 29 px, opening screen has no white flash in Light and Dark, reminder notification title is `Magpie` with the mark as small icon. If the beak spark turns to noise, set `DROP_BEAK_SPARK=1` in `scripts/make-icons.sh`, rerun it, and commit the new files. Needs a development build on both phones. Owner reviews the icon at small sizes (SC-003).

**Checkpoint**: US1 works alone. The app reads Magpie everywhere.

---

## Phase 4: User Story 2 - No "YouTube" in the app's name or internal names (Priority: P1)

**Goal**: Project name, install link name, Android package, and iOS bundle are all `magpie`-based and contain no "youtube".

**Independent Test**: Quickstart steps 2 and 6.

### Tests for User Story 2 (write first, they must fail)

- [x] T013 [US2] Extend `tests/unit/identity.test.ts` (same file as T007, so after it): import `package.json` and the config, then assert (a) `slug` and package `name` equal `magpie`, (b) `ios.bundleIdentifier` and `android.package` equal `com.dodotechhub.magpie`, (c) none of those five values contain `youtube` (case-insensitive). Fails now.

### Implementation for User Story 2

- [x] T014 [US2] In `app.config.ts`, change `slug` to `'magpie'`, `ios.bundleIdentifier` and `android.package` to `'com.dodotechhub.magpie'`. Do not touch Google scope names or API code (FR-011).
- [x] T015 [US2] In `package.json`, change `"name"` to `"magpie"`. Run `npm install --package-lock-only` so `package-lock.json` `name` fields follow. Check the diff of the lockfile is only the name lines.
- [x] T016 [US2] Run `grep -rniE "youtube" app.config.ts package.json eas.json` and confirm no match in an identifier (SC-004). Run `npm run typecheck && npm run lint && npm test`. Everything passes (SC-007).
- [ ] T017 [US2] Owner action (cannot be done by an agent): in Google Cloud, create an Android OAuth client for `com.dodotechhub.magpie` with the signing SHA-1, create an iOS OAuth client for the same bundle, set the new iOS client ID in `.env` as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and rename the consent screen app to "Magpie" (research R11). Never commit `.env`.
- [ ] T018 [US2] Manual check, quickstart step 6 on Android and iOS: sign in with two test accounts, move one channel, same result as before. With an older build installed, the new build installs as a separate app. Needs T017 done.

**Checkpoint**: US1 and US2 both work. Identifiers are final for release.

---

## Phase 5: User Story 3 - Say clearly that Magpie is not YouTube (Priority: P2)

**Goal**: Settings shows the not-affiliated notice.

**Independent Test**: Quickstart step 7.

### Tests for User Story 3 (write first, it must fail)

- [x] T019 [US3] In `tests/components/settings.test.tsx`, add a test: open Settings, find the text `Magpie is not made by or linked with YouTube or Google. YouTube is a trademark of Google LLC.` (`getByText`). Repeat with the theme set to Light and to Dark using the helper this file already uses for theme. Fails now.

### Implementation for User Story 3

- [x] T020 [US3] In `src/strings.ts`, add `notAffiliated: 'Magpie is not made by or linked with YouTube or Google. YouTube is a trademark of Google LLC.'` next to the other Settings strings (constitution I: simple words, text in `strings.ts`).
- [x] T021 [US3] In `src/ui/SettingsView.tsx`, add one `<Text>` below the Delete all button showing `strings.notAffiliated`, size 13, color from the existing theme tokens (`colors.muted`, from `src/theme/`). Add a style entry in the file's existing `StyleSheet`. Not interactive, no new screen, no new dependency.
- [x] T022 [US3] Run `npm test`. T019 passes. Manual check, quickstart step 7: readable in Light and Dark, a screen reader reads both sentences.

**Checkpoint**: All three stories work.

---

## Phase 6: Polish & Documents

- [x] T023 [P] In `AGENTS.md` line 7, change "YouTube Subscriptions Migrator:" to "Magpie:" and keep the rest of the sentence. Leave line 9 (repository name `youtube-subs-migrator-android`) until the owner renames the GitHub repository (research R9).
- [x] T024 [P] In `specs/003-magpie-rebrand/spec.md` assumptions, reword the privacy policy bullet: drop "talks only to Google" and point to the separate privacy policy PR (`feature/privacy-policy`). Keep the rest.
- [x] T025 [P] In `specs/001-subscription-migration/` and `specs/002-theme-settings/`, change the product name "YouTube Subscriptions Migrator" or "Subs Migrator" to "Magpie" only where it names the product, not the YouTube service (FR-014). Do not rewrite task history lines that quote old config values such as `specs/001-subscription-migration/tasks.md` T006. Report any line you are unsure about.
- [ ] T026 Run the full quickstart (`specs/003-magpie-rebrand/quickstart.md` steps 1 to 7) and tick "Done when".
- [ ] T027 Owner actions outside the repo, listed for tracking (spec Assumptions, out of scope): rename the GitHub repository to `magpie` and then update `AGENTS.md` line 9, check "Magpie" for store-name and trademark conflicts, fill in the consent screen (logo, support email, privacy policy link), update the constitution title with the constitution step.

---

## Dependencies & Execution Order

- Phase 1 first. T002 touches `package.json`, so finish it before T015.
- Phase 2 (T004, T005) blocks T009 and T012. T008 and the test tasks T006, T007 do not need it.
- US1 (Phase 3) before US2 (Phase 4): both edit `app.config.ts` and `tests/unit/identity.test.ts`.
- US3 (Phase 5) touches `src/strings.ts`, `src/ui/SettingsView.tsx`, `tests/components/settings.test.tsx`. It can run in parallel with US1 and US2 except for `src/strings.ts` (T008 and T020 edit the same file, so do them one after the other).
- Polish after all stories. T023, T024, T025 touch different files and can run in parallel.

## Parallel Example

```text
After T005:
  T006 [US1] tests/components/dailyLimit.test.tsx
  T007 [US1] tests/unit/identity.test.ts
  T019 [US3] tests/components/settings.test.tsx

Polish:
  T023 AGENTS.md
  T024 specs/003-magpie-rebrand/spec.md
  T025 specs/001-subscription-migration/ and specs/002-theme-settings/
```

## Implementation Strategy

### MVP first (US1)

1. Phase 1 and 2: setup, icon script, generated icons.
2. Phase 3: name, icons, opening screen, reminder title.
3. Stop and check on a real device (T012).

### Incremental delivery

1. US1 then US2: one branch is fine, but make one commit per logical change (name and icons, then identifiers, then Settings notice, then docs), per `AGENTS.md`.
2. US3 is small and can ship with US1 or after.
3. Do not release to a store before T017, T018, and T027 are done. The identifiers cannot change after release.

## Open Items (handover)

Status on 2026-11-11: everything an agent can do is done and checked on a Pixel 8 (icon shapes, themed icon, splash, Dark notice, small-size icon). 124 tests, typecheck, and lint pass. What is left:

1. **T017 (owner):** Google Cloud OAuth clients for `com.dodotechhub.magpie`, consent screen renamed "Magpie", new iOS client ID in `.env`. Blocks the sign-in check and the daily-limit reminder notification check (T012 is only partly done until then).
2. **T018:** two-account move test on real devices. Needs T017.
3. **iOS device check (not done):** local build is blocked. Xcode 15.4 on macOS Sonoma 14.5 cannot target an iOS 26 device, and React Native 0.88's Podfile rejects it ("Please upgrade XCode"). Xcode 26 needs macOS Sequoia 15.6 or later. Options, pick one:
   - Update macOS and Xcode, then build locally. A free Apple ID gives personal-team signing that expires after 7 days.
   - Paid Apple Developer account ($99/year) with EAS Build. This gives a device or IPA build for TestFlight or a device farm (BitBar). EAS removes only the Mac problem, not the account requirement. Needs an `eas.json` profile.
   - EAS simulator build: free, no account, but runs on simulators only and is not an IPA.
4. **T026:** run the full quickstart (steps 1 to 7) once items 1 to 3 are done.
5. **T027 (owner):** rename the GitHub repository to `magpie`, then update `AGENTS.md` line 9. Check "Magpie" for store-name and trademark conflicts. Fill in the consent screen (logo, support email, privacy policy link). Update the constitution title.
6. **Housekeeping:** `assets/magpie-icon-large.png` is untracked and unused. Delete it or commit it as a source image.

Do not release to a store before items 1, 2, and 5 are done.

## Notes

- Total: 27 tasks. Setup 3, Foundational 2, US1 7, US2 6, US3 4, Polish 5.
- Commit rules, branch names, and identity are in `AGENTS.md`. Never commit `.env` or any client secret.
- If a Jest test needs a mock for `app.config.ts` environment variables, set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` to an empty string, as the config already handles that case.
