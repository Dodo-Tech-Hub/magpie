# Contract change: Platform Driver

The driver contract is in [008 platform-driver.md](../../008-github-platform/contracts/platform-driver.md). Apple Music changes it in two places. Both are optional for other drivers, so YouTube and GitHub code does not change.

## 1. `add` gets a `save` callback

```ts
add(item: StoredItem, items: StoredItem[], pacer?: Pacer, save?: (data: string) => Promise<void>): Promise<Outcome>;
```

- The mover passes `save`, which calls `setItemData(progressId, item.itemId, data)` ([data-model.md](../data-model.md)).
- A driver calls `save` with the item's new `data` after each step that must not be repeated (Apple Music: playlist created, each chunk of songs added).
- The next `add` call for the same item gets the saved `data` in `item.data`.

## 2. `pace` numbers are read by the pacer

`createPacer(accountKey, pace)` uses `pace.perMinute` and `pace.perHour` from the driver instead of fixed constants. The GitHub driver already declares 20 and 300, the numbers the pacer uses today, so GitHub does not change. `timeLeft(adds, pace)` uses the same numbers.

## Apple Music driver

| Field | Value |
| --- | --- |
| `id` | `apple-music` |
| `kinds` | `song` Songs, `album` Albums, `artist` Artists (only if confirmed), `playlist` Playlists |
| `moveOrder` | `song`, `album`, `artist`, `playlist` |
| `pace` | 60 per minute, 3,000 per hour. `adds`: 1 per song, album, artist, or shared playlist; 1 plus songs ÷ 100 (rounded up) per own playlist |
| `limitsUrl` | `https://dodo-tech-hub.github.io/magpie/limits/apple-music` |
| `removeAccessUrl` | Not set, unless the access check finds an Apple page that lists apps with Apple Music access |
| `switchSignsOut` | `true`: Switch signs out and shows Sign in again |
| `resumesNew` | `true`: the new account's token is kept for Continue (research R5) |
| `signIn` | Bridge page in the system auth browser ([sign-in-bridge.md](sign-in-bridge.md)). Ignores `kinds`. Never calls `onCode`. Abort closes the sheet with `WebBrowser.dismissAuthSession()`. |
| `granted` | All kinds. |
| `endMove` | Deletes the new account's token. |
