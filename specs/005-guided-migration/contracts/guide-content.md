# Contract: Guide Content

## Shape

Bundled file `assets/guides/<platformId>.json` holds one `Guide`. The remote file `https://<guide host>/guides.json` holds `{ "version": 1, "guides": { "<platformId>": Guide } }`.

```ts
type Guide = {
  revision: number;            // higher wins over the bundled copy
  steps: { text: string; image: string }[]; // 1 to 12 steps
  exportHint: string;          // which format to ask for (zip, JSON)
  sampleImage: string;         // "what the right file looks like"
};
```

- Bundled `image` values are file names in `assets/guides/<platformId>/`.
- Remote `image` values are `https://<guide host>/...` paths on the same host only.

## Checks before use (FR-022)

| Check | Fails when |
| --- | --- |
| Top level | Not an object, `version` is not 1, or `guides` is missing. |
| Per guide | `revision` not a positive integer; `steps` empty or more than 12; any `text` empty or over 300 characters; `exportHint` or `sampleImage` missing. |
| Images | Remote image URL not `https`, or not on the guide host. |
| Platform | Unknown platform ids are ignored, not an error. |

A guide that fails is ignored; the last good copy (or the bundled one) stays. A fetched guide is used only when its `revision` is higher than the bundled one.

## Request

- `GET https://<guide host>/guides.json`, once per app start, in the background.
- No query string, cookies, custom headers, account data, list data, or device id (FR-023).
- Timeout 10 s. Any failure keeps the current guide and shows nothing to the user.

## Host

Set by the owner as `EXPO_PUBLIC_GUIDE_HOST`. Not set means bundled guides only. The host is static, read-only, and holds no user data (constitution III.5).
