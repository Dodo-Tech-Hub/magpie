# Contract: Platform Driver, Bluesky additions

This extends [008's platform driver contract](../../008-github-platform/contracts/platform-driver.md). Everything there still holds. The additions are optional, so YouTube and GitHub need no change beyond the pacer numbers moving into `pace`. Research R13.

```ts
type Kind = {
  id: string;
  heading: string;
  optional?: boolean;   // 008: never asked on the first new-account sign-in
  needsOld?: boolean;   // new: read only after an old-account sign-in ("Allow" on Pick)
};

type Driver = {
  // ...everything in 008...

  // new: From and To show a handle box. signIn gets the typed handle.
  handleInput?: boolean;

  // changed: handle is passed when handleInput is set.
  // Old role with no kinds: look the account up only, no sign-in, no browser.
  // Old role with needsOld kinds: sign in to the old account for those kinds.
  signIn(role: Role, kinds: string[], onCode: (c: SignInCode | null) => void, signal?: AbortSignal, handle?: string): Promise<SignInResult>;

  // changed: false = the platform could not cancel the access; the phone copy is gone anyway.
  signOut(role?: Role): Promise<void | false>;
  endMove?(): Promise<void | false>;

  // new: the order items of one kind move in. Default: the stored order.
  itemOrder?(a: StoredItem, b: StoredItem): number;

  // changed: gapMs and perDay added. The shared pacer reads these instead of its own constants.
  pace?: { gapMs: number; perHour: number; perDay?: number; adds(items: StoredItem[]): number };
};

type SignInResult =
  | { ok: true; account: AccountInfo }
  | { ok: false; reason: 'cancelled' | 'failed' | 'not_found' | 'not_supported' | 'unavailable' };
```

`perMinute` in 008's contract becomes `gapMs` (60,000 / per minute), because the pacer works in gaps. GitHub: `gapMs: 3000, perHour: 300`. Bluesky: `gapMs: 120, perHour: 1500, perDay: 10000`.

## New rules

| Rule | Why |
| --- | --- |
| With `handleInput`, `signIn('old', [])` never opens a browser and never stores a token. `listOld()` then reads public data only. | FR-BS-005: no old sign-in. |
| `signIn('old', kinds)` with `needsOld` kinds keeps the old session in memory only. The next `listOld()` reads those kinds too, then revokes and drops the session. | FR-BS-020, III.3. |
| `listOld()` returns public kinds every time and `needsOld` kinds only when an old session exists, so the flow can call it again after "Allow" and save the result over the same progress. | FR-GH-021 keeps picks; new rows come in picked. |
| The new reasons map to plain texts in `src/strings.ts`: `not_found` "We can't find that account. Check the name.", `not_supported` "Magpie works only with accounts hosted by Bluesky for now.", `unavailable` "This account can't be read right now." | FR-BS-005, FR-BS-022, spec edge cases. |
| `itemOrder` sorts only within a kind. The mover keeps `moveOrder` for kinds. | FR-BS-010. |

## Who calls the new parts

| Caller | Uses |
| --- | --- |
| `src/ui/AccountCard.tsx` | `handleInput`: a text box and a Next or Sign in button in place of the plain button |
| `src/state/flows.ts` | `signIn(..., handle)`; `allowOld(kind)` calls `signIn('old', [kind], ..., oldHandle)`, refuses another account, then `listOld()` and `saveItems()`; reads the `false` from `signOut` and `endMove` |
| `src/ui/PickStep.tsx` | `needsOld`: shows an empty greyed section with "Allow" when the kind has no rows and is not in `oldRead` |
| `src/move/mover.ts` | `itemOrder` |
| `src/move/pacer.ts`, `src/ui/PickStep.tsx` | `pace.gapMs`, `pace.perHour`, `pace.perDay` |
