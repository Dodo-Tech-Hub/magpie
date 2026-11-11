# Research: Magpie Rebrand

Decisions that the plan depends on. No `NEEDS CLARIFICATION` is left open.

## R1. Shared name

- **Decision**: `magpie` everywhere. Display name `Magpie`, slug and package name `magpie`, Android package and iOS bundle `com.dodotechhub.magpie`.
- **Rationale**: Matches the brand and the spec's suggestion. Replaces `com.dodotechhub.subsmigrator`.
- **Alternatives**: `transfersubs`, `transferfollow` (spec rejects: they describe a job, and "follow" is not YouTube's word). Keep `subsmigrator` (no "youtube" in it, but off-brand).
- **Note**: The GitHub repository rename to `magpie` is an owner action outside the app. `AGENTS.md` mentions the old repository name and is updated after the rename (R9).

## R2. Icon source and the sparkle

- **Decision**: Use `assets/magpie-icon-master.png` (1024 x 1024, background `#1F1F1F`, art `#F3F3E7`). Do not use `magpie-icon-large.png`.
- **Finding**: The spec says the supplied artwork has a gray sparkle in the bottom-right corner. The committed master has none: a 120 px crop of that corner is flat background. The only spark is the small burst by the beak, which is part of the drawing.
- **Rationale**: The master is already clean, so FR-006 is met by checking, not by editing. `magpie-icon-large.png` is a zoomed-in variant (art fills about 85% of the width), which would be cut off on Android masks and is not tracked in git.
- **Beak spark**: Kept in the first pass. The spec lets the owner drop it from every size if it turns to noise at 48 px and 29 px (spec edge cases). The script has one switch for that, so the decision is one rebuild, not a redraw.
- **Alternatives**: Redraw the logo (out of scope per spec).

## R3. Android adaptive icon (standard, round, themed)

- **Decision**: Three layers, all 432 x 432 (the spec's earlier files are 512 and 432; Android wants 108 dp, and 432 px is 4x).
  - Background: flat `#1F1F1F`.
  - Foreground: the art only (transparent around it), scaled so every art pixel sits inside the safe circle, 66 dp of the 108 dp canvas (diameter 61%).
  - Monochrome: same shape as foreground, one flat color on transparent. The system tints it.
- **Measured**: The art's farthest pixel is about 435 px from the center of the 1024 master (the ring's outer edge and the handle end). The safe circle radius is 30.6% of the canvas, so the art is scaled to about 72% of the master (shrink factor 0.72, about 313 px of a 432 px layer).
- **Rationale**: Launchers cut the 108 dp layers into a circle, squircle, square, or rounded square. Staying inside the 66 dp circle keeps all of them uncut (FR-004, SC-002).
- **Alternatives**: Use the master as the foreground at full size (the handle and ring are cut by circular masks, fails FR-004). Pad by a fixed 20% (works, but wastes size and was not measured).

## R4. iOS icon and the rest

- **Decision**: `assets/icon.png` is the master flattened onto `#1F1F1F`: 1024 x 1024, RGB, no alpha, square corners. Expo uses it for iOS and as the fallback. `favicon.png` (48 px) is a downscale. iOS dark and tinted variants are not shipped now: the artwork is already light-on-dark, and Expo's separate dark and tinted icon files are an optional later addition.
- **Rationale**: FR-005 needs a full square with no transparency. iOS rounds the corners itself.
- **Alternatives**: Ship dark and tinted iOS variants now. Skipped because it adds files the spec does not require, and the dark icon already reads well.

## R5. Opening screen

- **Decision**: Add `expo-splash-screen` (install with `npx expo install expo-splash-screen`) and configure it as a plugin in `app.config.ts`: image `./assets/splash-icon.png`, `backgroundColor: '#1F1F1F'`, `resizeMode: 'contain'`. `splash-icon.png` is the art on a transparent background at a size that is not cropped by the Android 12 splash circle (art fits in about 2/3 of the image).
- **Rationale**: The project has no splash setting today, so a white screen can show before the app draws. A fixed icon-matching color gives no white flash in Light or Dark (FR-007, spec edge case on theme before it is known).
- **Open point for implementation, not a blocker**: The exact plugin option names for SDK 58 are checked with `npx expo config --type introspect` after install. If SDK 58 moved splash options into `app.config.ts` instead of a plugin, use the SDK's documented form; the visible result is the same.
- **Alternatives**: Leave the default splash (white flash, fails FR-007). Build a native splash by hand (outside Expo's managed flow, more to maintain).

## R6. Notification small icon and title

- **Decision**: The `expo-notifications` plugin in `app.config.ts` gets `icon: './assets/notification-icon.png'`. No `color` option, so Android uses its default tint and the mark reads on both light and dark notification shades. The title comes from `strings.reminderTitle = 'Magpie'`, so one string change covers the notification and the permission question that reuses it.
- **Notification icon file**: Android draws only the alpha channel, so it must be a white mark on a transparent background (96 x 96 px, mark filling about 80%). The script generates it from the art.
- **Accent color**: Revisit only if the owner wants a brand color on the notification.
- **iOS**: Notifications use the app icon. No extra file.
- **Rationale**: FR-008 asks for a single-color mark where the platform needs one, which is Android only.
- **Alternatives**: Skip the icon (Android shows a blank square, fails the spec scenario 5).

## R7. Notice in Settings

- **Decision**: A plain `Text` at the bottom of `SettingsView`, below Delete all, in the muted theme color, size 13. Text in `strings.ts` as `notAffiliated`: "Magpie is not made by or linked with YouTube or Google. YouTube is a trademark of Google LLC."
- **Rationale**: In place, no new screen, 0 extra taps from Settings (the gear is one tap from any step, SC-006). Uses the existing `colors.muted`, which already passes contrast in both looks. No label needed: it is not interactive and reads in full as text.
- **Alternatives**: A footer on every screen (adds clutter, not asked). A separate "About" view (violates the no-new-screen rule).

## R8. Tests

- **Decision**:
  - `tests/unit/identity.test.ts`: imports the config from `app.config.ts` and `package.json`, asserts that `name`, `slug`, `ios.bundleIdentifier`, `android.package` and package `name` contain no "youtube" and are all `magpie`-based. The allowed YouTube mentions (scopes, API names) are not in those fields, so the check stays simple (FR-009, FR-015, SC-004).
  - Reminder title: assert the scheduled notification content title is `Magpie` (extends the existing reminder test setup using `tests/mocks/expoNotifications.ts`).
  - Notice: extend `tests/components/settings.test.tsx`: opens Settings, finds the notice text, checks it in Light and Dark.
- **Rationale**: Constitution II. Icons are binary files; a pixel test adds weight, so icon checks are a manual review in the quickstart.
- **Alternatives**: Snapshot-test config (brittle). Pixel-diff icons in Jest (heavy for a one-off).

## R9. Documents

- **Decision**: `AGENTS.md` title line and project paragraph say "Magpie". The repository-name sentence is updated only after the owner renames the repository. The spec's assumptions line about the privacy policy ("talks only to Google") is reworded to point at the separate policy PR and drop "only Google", since the app is expected to cover more platforms. Spec 001 and 002 names that describe the app (for example "YouTube Subscriptions Migrator" in titles) change to "Magpie" only where they name the product, not the service (FR-014).
- **Rationale**: Keeps governing text consistent without touching the constitution (spec defers it).
- **Alternatives**: Rewrite old specs in full (too much churn for a name).

## R10. Old build on a phone

- **Decision**: No migration. The new package name installs beside the old build, which is left as it is until the tester removes it.
- **Rationale**: Spec edge case: not released, no real users.

## R11. Google sign-in

- **Decision**: Code needs no change. Owner creates Android and iOS OAuth clients for `com.dodotechhub.magpie` (Android with the signing SHA-1) in the Google Cloud project and updates the consent screen app name to "Magpie". Steps in [quickstart.md](quickstart.md).
- **Rationale**: FR-010. Client IDs come from env vars already.
