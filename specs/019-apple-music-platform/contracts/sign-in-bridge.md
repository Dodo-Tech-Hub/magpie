# Contract: Sign-in Bridge Page

A static page that lets the app sign in to any Apple Account with MusicKit JS, in the iOS system auth browser (research R2). Source: `docs/apple-music/sign-in.html`. Served at `https://dodo-tech-hub.github.io/magpie/apple-music/sign-in.html` by the existing GitHub Pages site. No server code.

## Open

The app calls `WebBrowser.openAuthSessionAsync(url, 'magpie://apple-music', { preferEphemeralSession: true })` with:

```text
https://dodo-tech-hub.github.io/magpie/apple-music/sign-in.html#dt=<developer token>&state=<random>
```

Everything is in the fragment, which the browser never sends to the server. `#signout=1&ut=<user token>` asks the page to call `unauthorize()` instead (only if the access check shows it ends the token).

## Page rules

| Rule | Why |
| --- | --- |
| Loads MusicKit JS from Apple's CDN (`js-cdn.music.apple.com`), unchanged, with a fixed version. | Apple terms 3.3.6(D): MusicKit JS only as a stand-alone library. |
| Reads `dt` and `state` from the fragment, then clears the fragment with `history.replaceState`. | Tokens do not stay in the address bar or history. |
| Shows one line, "Sign in to Apple Music", with the Apple Music mark, and a Sign in button that calls `authorize()`. A user tap starts the pop-up, so the browser does not block it. | Pop-ups need a user tap. |
| On success redirects to `magpie://apple-music?state=<state>&token=<music user token>`. | The auth session returns this URL to the app. |
| On cancel or error redirects to `magpie://apple-music?state=<state>&error=cancelled` or `error=failed`. | The app shows its usual sign-in lines. |
| Loads nothing else: no analytics, no fonts, no other scripts. Sets a Content-Security-Policy that allows only Apple's MusicKit hosts. | Principle III, rule 5. |
| Logs nothing to the console. | Principle III, rule 7. |

## App checks on the callback

| Check | On failure |
| --- | --- |
| Result type is `success` and the URL starts with `magpie://apple-music?` | `cancelled` if the user closed the sheet, else `failed` |
| `state` equals the one the app made | `failed` |
| `error` missing, `token` 1 to 4,096 characters with no spaces | `failed` |
| `GET /v1/me/storefront` with the token answers 200 | `failed`, or the subscription line if 403 |

## Check mode (access check only)

`#dt=<developer token>&check=1` shows the music user token on the page with a Copy button, instead of redirecting. Only the project owner uses it, on a test account, to run [verify-access.sh](../verify-access.sh). The page shows a warning that the token gives access to the library.
