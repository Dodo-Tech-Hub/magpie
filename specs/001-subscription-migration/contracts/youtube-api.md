# Contract: YouTube Data API v3 usage

All calls go to `https://www.googleapis.com/youtube/v3/` with header `Authorization: Bearer <access token>`. Access tokens come from `src/auth/google.ts` and are never stored. Quota: 10,000 units per day per Google Cloud project, reset at midnight Pacific Time.

## 1. List my subscriptions

Used for the old account's list (scope `youtube.readonly`) and the new account's "Already there" check (scope `youtube`).

- `GET subscriptions?part=snippet&mine=true&maxResults=50&pageToken=<token>`
- Cost: 1 unit per page of up to 50.
- Fields used per item: `snippet.resourceId.channelId`, `snippet.title`, `snippet.thumbnails.default.url` (optional). `nextPageToken` for the next page.
- Validation: response MUST have an `items` array; each kept item MUST have a string `channelId` and `title`. Items failing validation are skipped.

## 2. Subscribe the new account to a channel

- `POST subscriptions?part=snippet`
- Body: `{"snippet":{"resourceId":{"kind":"youtube#channel","channelId":"<id>"}}}`
- Cost: 50 units.

## Error mapping

Errors are read from `error.errors[0].reason` (falling back to `error.status` and the HTTP code).

| HTTP / reason | Channel status | App action |
|---------------|----------------|------------|
| 200 | `moved` | Next channel |
| 400 `subscriptionDuplicate` | `moved` | Next channel |
| 403 `quotaExceeded`, `dailyLimitExceeded` | `tomorrow` (this and remaining picked waiting) | Stop, show daily limit message, schedule reminder |
| 403 `subscriptionForbidden` | `couldnt_move` | Next channel |
| 404 `publisherNotFound`, `channelNotFound`, `subscriberNotFound` | `couldnt_move` | Next channel |
| 401 | unchanged (`waiting`) | Refresh token once and retry; if it fails, stop and ask to sign in again |
| 429, 5xx, network error | unchanged after retries (`waiting`) | Retry twice (1 s, 4 s), then stop with "No internet" message |
| Any other 4xx | `couldnt_move` | Next channel |

## Not used

No other endpoints, no API key, no part beyond `snippet`. Unsubscribe (`DELETE subscriptions`) is never called (FR-024).
