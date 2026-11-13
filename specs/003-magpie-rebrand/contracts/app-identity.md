# Contract: App Identity

What a user, a store, and Google see. The app has no server, so this is the only external surface the rebrand changes.

## Names

| Surface | Android | iOS |
|---------|---------|-----|
| Home screen label | `Magpie` | `Magpie` |
| App switcher card | `Magpie` | `Magpie` |
| Store identifier | `io.github.dodotechhub.magpie` (`android.package`) | `io.github.dodotechhub.magpie` (`ios.bundleIdentifier`) |
| Install link name | `magpie` | `magpie` |
| Notification title | `Magpie` | `Magpie` |
| Permission question title | `Magpie` (same string) | `Magpie` (same string) |

No identifier contains "youtube". Names that stay unchanged because they name the service (FR-011): the `https://www.googleapis.com/auth/youtube` and `youtube.readonly` scopes, `src/api/youtube.ts`, YouTube Data API calls, and on-screen words like "YouTube" in the migration flow.

## Icons

| Surface | Android | iOS |
|---------|---------|-----|
| Launcher icon | Adaptive: flat `#1F1F1F` background plus art foreground inside the 66 dp safe circle | `icon.png`, full square, no alpha, system rounds corners |
| Round, square, squircle masks | Art uncut in all (SC-002) | System mask only |
| Themed icon | Android 13+: single-color monochrome layer tinted by the system | Not shipped now (dark and tinted variants are optional later) |
| Opening screen | `splash-icon.png` on `#1F1F1F` (Android 12+ shows it inside the system splash circle) | Same image and color, centered |
| Notification small icon | `notification-icon.png`, white on transparent | Not used, iOS shows the app icon |

## Settings notice

- Location: bottom of the existing Settings view, below Delete all. No new screen, no new tap.
- Text, exactly: `Magpie is not made by or linked with YouTube or Google. YouTube is a trademark of Google LLC.`
- Style: plain text, muted theme color, readable in Light and Dark. Not interactive, no accessibility role beyond text. Read in full by a screen reader.

## Google Cloud (owner action)

- Android OAuth client: package `io.github.dodotechhub.magpie`, signing SHA-1 of the build.
- iOS OAuth client: bundle `io.github.dodotechhub.magpie`.
- Consent screen: app name "Magpie", new icon, support email, link to the privacy policy (hosted from the separate privacy policy PR).
- Until these exist, sign-in on the new identifiers shows the app's existing friendly sign-in error.
