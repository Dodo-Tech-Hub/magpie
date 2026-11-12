# Contract: Adding a Guided Platform

A Guided platform needs two entries and some files. Shared screens never name a platform.

1. An entry in `src/platforms/platforms.ts` (spec 004 contract) with `section: 'guided'`, `label: strings.guidedLine`, and `ready: false` until step 4.
2. An entry in `src/guided/guidedPlatforms.ts`:

```ts
type GuidedPlatform = {
  id: PlatformId;
  source:
    | { kind: 'file'; entryPath: RegExp; parse: (entry: Uint8Array) => Promise<RawFollow[]> }
    | { kind: 'twitch' };
  handlePattern: RegExp;            // valid handle, rejects anything else
  profileUrl: (handle: string) => string; // https link, handle encoded
  guide: Guide;                     // bundled copy, see guide-content.md
  minutes: number;                  // rough time for the intro
};

type RawFollow = { handle: string; displayName: string; followedAt: number | null };
```

3. Files: `src/guided/parsers/<id>.ts`, `assets/guides/<id>.json`, `assets/guides/<id>/step-<n>.png`, a fixture export in `tests/fixtures/exports/<id>/`, and a parser test.
4. Check the parser against a real export from a test account, then set `ready: true`.

## Rules

| Rule | Source |
| --- | --- |
| Export bytes stay on the phone. The cached file is deleted after reading. | FR-006, III.6 |
| Only the entry matching `entryPath` is unzipped; entries over 50 MB are rejected. | III.8 |
| Handles failing `handlePattern` are dropped. Zero valid handles shows the empty-file message. | FR-007, III.8 |
| No entry matching `entryPath`, or JSON that does not parse, shows the wrong-file message. | US1-4 |
| Links are only ever `profileUrl(handle)`. A URL found in the export is never opened. | III.8 |
| Duplicates (same lowercase handle) appear once. | FR-007 |
| Rows sorted by follow time, newest first; rows with no time last, in export order. | Clarification 2026-11-12 |

## Profile link templates (to confirm per platform)

| Platform | Template |
| --- | --- |
| Instagram | `https://www.instagram.com/<handle>/` |
| Facebook | `https://www.facebook.com/<handle>` |
| Threads | `https://www.threads.com/@<handle>` |
| TikTok | `https://www.tiktok.com/@<handle>` |
| X | `https://x.com/<handle>`, or `https://x.com/i/user/<id>` when the export has ids only |
| Twitch | `https://www.twitch.tv/<login>` |

## Twitch source

| Step | Call | Host |
| --- | --- | --- |
| Start | `POST /oauth2/device` (`client_id`, `scopes=user:read:follows`) | `id.twitch.tv` |
| User approves | `verification_uri` opened in the system browser | `www.twitch.tv` (browser only) |
| Token | `POST /oauth2/token` (DCF grant), poll at `interval` | `id.twitch.tv` |
| Who am I | `GET /helix/users` | `api.twitch.tv` |
| Follows | `GET /helix/channels/followed?user_id&first=100&after` | `api.twitch.tv` |
| Revoke | `POST /oauth2/revoke` (`client_id`, `token`), always, then forget | `id.twitch.tv` |

Responses are checked for shape before use. Errors map to plain messages: cancelled or expired code, "Sign-in didn't finish. Try again."; no network, the existing offline message.

## Android and iOS

| Area | Android | iOS |
| --- | --- | --- |
| Open profile | `https` link; App Links open the app if installed, else the browser. Nothing declared. | `https` link; Universal Links open the app if installed, else Safari. Nothing declared. |
| Pick file | System picker (Downloads, Drive, others). | Files (iCloud Drive, On My iPhone, others). |
| Zip | Read directly; no unzip step for the user. | Same. |
| Twitch sign-in page | Custom Tab via `expo-web-browser`. | `SFSafariViewController`/auth session via `expo-web-browser`. |

## Strings (drafts)

| Key | Text |
| --- | --- |
| `guidedIntro(name, minutes)` | "Let's move who you follow on {name}. It takes about {minutes} minutes. We never sign in to your {name} account. We never tap for you." |
| `pickFile` | "Pick file" |
| `twitchSignIn` | "Sign in with Twitch" |
| `wrongFile` | "This is not the right file. It should look like this:" |
| `emptyFile` | "We found no one in this file. Pick another file." |
| `reading` | "Reading your file…" |
| `newAccountNote(name)` | "First, sign in to your new account in the {name} app." |
| `skip` | "Skip" |
| `searchPeople` | "Search names" |
| `progressCount(done, total)` | "{done} / {total}" |
| `finishedTitle` | "All done!" |
| `keepList` | "Keep list" |
| `clearList` | "Clear list" |
| `startAgain` | "Start again" |
| `startAgainAsk` | "This removes your list and ticks for {name}. It cannot be undone." |
| `cantSave` | "We couldn't save. Free up some space on your phone." |
