# Quickstart: Check the Magpie Rebrand

How to prove the feature works. Details of each value are in [data-model.md](data-model.md) and [contracts/app-identity.md](contracts/app-identity.md).

## Prerequisites

- Node and npm, `npm install` done.
- ImageMagick (`brew install imagemagick`), only to rebuild icons.
- A real Android phone and an iPhone with a development build (EAS Build).
- Two Google test accounts, both on the OAuth consent screen's test user list.
- Google Cloud OAuth clients for `com.dodotechhub.magpie` (owner action, see the contract). Their public IDs in `.env` as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

## 1. Automated checks

```bash
npm run typecheck && npm run lint && npm test
```

Expect: all pass, including the new identifier test, the reminder title test, and the Settings notice test (Light and Dark).

## 2. Identifier search (SC-004)

```bash
grep -rniE "youtube" app.config.ts package.json eas.json
```

Expect: no match in `name`, `slug`, `package`, or `bundleIdentifier`. Matches elsewhere are only service names (none expected in these three files).

## 3. Rebuild icons (only when the artwork changes)

```bash
bash scripts/make-icons.sh
```

Expect: the files in the icon table of [data-model.md](data-model.md) are rewritten. Check `icon.png` has no alpha: `magick identify -format '%[channels]' assets/icon.png` prints `srgb`.

## 4. Look at the icons (SC-002, SC-003) — manual

1. Open each generated PNG. No gray sparkle, only the logo.
2. Android launcher: switch the launcher icon shape to circle, squircle, square, rounded square. The ring and the handle stay whole.
3. Android 13+: turn on Themed icons. The icon is one flat color in the theme color.
4. View the icon at 48 px and 29 px. Can you tell it is a bird in a circle? If the beak spark turns to noise, drop it with the script switch and rebuild.

## 5. Install and look (US1)

1. Build and install on Android and iOS.
2. Home screen label reads `Magpie`, icon is the magpie.
3. Cold start: the opening screen is the mark on dark, no white flash, in Light and Dark phone modes.
4. Hit the daily limit (set `EXPO_PUBLIC_SIMULATE_QUOTA_AFTER`) and accept the reminder. The notification title reads `Magpie` and the small icon is the mark, not a blank square (Android).

## 6. Move a channel (US2, SC-005)

1. Sign in to the old account, pick one channel, move it, sign in to the new account.
2. The channel appears in the new account. Same result as before the rename, on both platforms.
3. With an older build on the phone, the new build installs as a separate app and the old one is untouched.

## 7. Notice (US3, SC-006)

1. Tap the gear. The notice sits at the bottom of Settings.
2. Switch Look to Light, then Dark. The text stays readable.
3. Turn on a screen reader. It reads both sentences in full.

## Done when

All of step 1 passes, step 2 shows no match, steps 4 to 7 are checked on a real Android phone and an iPhone, and the owner has reviewed the icon at small sizes.
