# Contract: Limits Pages

What the app opens and what each page must say. The app and the pages meet only at the addresses.

## Addresses (FR-010)

The app opens only these. Host: `dodo-tech-hub.github.io` (GitHub Pages of this repository). The browser loads them; the app sends nothing.

| Platform | File in the repository | Address the app opens |
| --- | --- | --- |
| YouTube | `docs/limits/youtube.md` | `https://dodo-tech-hub.github.io/magpie/limits/youtube` |
| GitHub | `docs/limits/github.md` | `https://dodo-tech-hub.github.io/magpie/limits/github` |

Rules:

- An address never changes once released. To move a page, keep the old file with a link to the new one.
- A new platform adds one row here, one file, and `limitsUrl` on its driver.
- No query string, no fragment, no user data in the address.

## Content of each page (FR-011)

Simple words, short sentences, English. No platform logo. No tracking, scripts, or forms. Each page has these parts, in this order:

| Part | YouTube | GitHub |
| --- | --- | --- |
| Title | "YouTube limits in Magpie" | "GitHub limits in Magpie" |
| Why a move can pause | YouTube gives each app a fixed amount of work per day. All people who use Magpie share it. | GitHub's rules do not allow starring or following a lot in a short time. Magpie goes slowly to keep the account safe. |
| How many items | About 200 channels per day, for everyone together. | At most 20 items per minute and 300 per hour. Magpie also waits when GitHub asks. |
| When the move can go on | The limit starts again once a day. The app shows "Tomorrow" on the rows and can send a reminder. | Usually within the hour. The app shows "Later" on the rows and can send a reminder. |
| What is safe | Items already moved stay moved. Tap Continue to move the rest. Nothing is lost. | Same. |
| Not affiliated | Magpie is not made by or linked with YouTube or Google. | Magpie is not made by or linked with GitHub. |

The numbers come from spec 001 (daily limit) and spec 008 (FR-GH-010, FR-GH-012). When a platform changes a limit, change the page; no app release is needed (User Story 3).
