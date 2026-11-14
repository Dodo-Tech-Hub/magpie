# Contract: GitHub Calls

Every call the GitHub driver makes. Hosts: `github.com` (sign-in), `api.github.com` (API), `avatars.githubusercontent.com` (pictures, loaded by `Image`). HTTPS only. Headers on every API call: `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`.

This contract assumes research R1 passes. If the owner picks a classic OAuth app instead, only the client ID and a `scope` field change; the calls stay.

## Sign-in

| Step | Call | Fields used | Checked before use |
| --- | --- | --- | --- |
| Get a code | `POST github.com/login/device/code` with `client_id` | `device_code`, `user_code`, `verification_uri`, `expires_in`, `interval` | See research R2. |
| Wait | `POST github.com/login/oauth/access_token` with `client_id`, `device_code`, `grant_type` | `access_token`, `expires_in`, or `error` | `access_token` is a string. `refresh_token` is ignored. |
| Who signed in | `GET /user` | `id`, `login`, `name`, `avatar_url` | `id` is a number, `login` a string. |

Client ID per role: `old` uses `EXPO_PUBLIC_GITHUB_READ_CLIENT_ID`, `new` uses `EXPO_PUBLIC_GITHUB_CLIENT_ID`, `extra` uses `EXPO_PUBLIC_GITHUB_GISTS_CLIENT_ID`.

| Poll answer | The app |
| --- | --- |
| `authorization_pending` | Waits `interval` seconds and asks again. |
| `slow_down` | Adds 5 seconds to `interval`, then asks again. |
| `expired_token`, or `expires_in` passed | Stops. "Sign-in didn't finish. Try again." |
| `access_denied` (user tapped Cancel) | Stops. The step stays signed out, no error line. |
| Anything else | Stops. "Sign-in didn't finish. Try again." |

## Read

| What | Call | Paging |
| --- | --- | --- |
| Starred repositories | `GET /user/starred?per_page=100&page=N` | Until a page has fewer than 100. |
| Followed people | `GET /user/following?per_page=100&page=N` | Same. |
| Starred gists | `GET /gists/starred?per_page=100&page=N` | Same. |
| Star lists and their repositories | `POST /graphql`, `viewer.lists` | By cursor, 50 lists and 100 repositories per page. |

## Add

| Kind | Call | Moved | Already there |
| --- | --- | --- | --- |
| `repo` | `PUT /user/starred/{owner}/{repo}` | 204 | 204 (starring twice is fine) |
| `person` | `PUT /user/following/{username}` | 204 | 204 |
| `gist` | `PUT /gists/{gist_id}/star` | 204 | 204 |
| `list` | `createUserList`, then `updateUserListsForItem` with the union of old and new list IDs per repository | No `errors` | A list with the same name is reused |

## Answer to outcome

| Answer | Outcome | Row or message |
| --- | --- | --- |
| 204, or GraphQL with no `errors` | `moved` | Moved |
| 401 | `auth` | "Your sign-in ran out. Sign in again to keep going." |
| 404 | `couldnt_move` | "It was deleted or is private." (person: "Account was deleted.") |
| 422 | `couldnt_move` | "GitHub didn't allow this one." |
| 403 or 429 with a wait of 60 seconds or less | `wait` | Row stays Moving |
| 403 or 429 with a longer wait, or a second one with no wait time | `later` | Later, "GitHub needs a break. We'll remind you when you can move the rest." |
| 403 that is not a rate limit | `couldnt_move` | "GitHub didn't allow this one." |
| Third such 403 in a row | `stop` | "GitHub paused your account's activity. Try again later." |
| 5xx or no network | `retry` | "No internet. Try again when you're online." after the existing retries |
| GraphQL `errors` for a list | `couldnt_move` | "GitHub couldn't make this list." |

A rate limit is a 403 or 429 with a `retry-after` header, or `x-ratelimit-remaining: 0`, or a message that contains "rate limit".
