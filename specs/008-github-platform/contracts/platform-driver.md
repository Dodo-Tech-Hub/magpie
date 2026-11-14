# Contract: Platform Driver

One driver per Automatic platform, in `src/platforms/`. The flow, the mover, and the screens call only these functions for the open platform. Adding an Automatic platform is one driver plus one entry in the platform list. This is the shape the tasks build; names may change in code review, the jobs may not.

```ts
type Role = 'old' | 'new';

type Outcome =
  | { kind: 'moved' }
  | { kind: 'couldnt_move'; reason: string }   // plain words, shown on the row
  | { kind: 'later'; resumeAt: number }        // stop the move, remind at this time
  | { kind: 'wait'; ms: number }               // short wait, then try the same item again
  | { kind: 'auth' }                           // sign-in ran out
  | { kind: 'retry' }                          // network problem
  | { kind: 'stop'; notice: string };          // platform paused the account

type Driver = {
  id: PlatformId;
  words: Words;                                // item nouns, sign-in button, "later" label, limit notice, reminder text
  kinds: { id: string; heading: string; optional?: boolean }[];
  pace?: { perMinute: number; perHour: number };
  removeAccessUrl?: string;                    // page where the user removes the app's access
  switchSignsOut?: boolean;                    // Switch signs out and shows Sign in again, instead of opening a new sign-in at once

  signIn(role: Role, kinds: string[], onCode: (code: SignInCode | null) => void, signal?: AbortSignal): Promise<SignInResult>; // kinds: what the new account needs access for. Abort = the user tapped Cancel.
  signOut(role?: Role): Promise<void>;         // no role = all roles
  granted(): Promise<string[]>;                // kinds the new account has access for
  canAct(role: Role, accountId: string): Promise<boolean>; // is there a usable sign-in for this account
  listOld(): Promise<NewItem[]>;               // read the old account; the driver then drops old access if it must
  checkNew(items: StoredItem[], granted: string[]): Promise<{ there: string[]; unavailable: { itemId: string; reason: string }[] }>;
  add(item: StoredItem, items: StoredItem[]): Promise<Outcome>;
  endMove?(): Promise<void>;                   // called when a move finished with nothing left to move: drop the new account token
};
```

## Words

`words` holds every platform-specific text, kept in `src/strings.ts` (`youtubeWords`, `githubWords`): `signIn` (button label), `signInIcon`, `oldHint`, `newHint`, `searchPlaceholder`, `noItems`, `needPick`, `later` (row label for the `later` state), `limitReached`, `reminderBody`, `moveButton(n)`, `notAffiliated`, and for GitHub only `accessNote`.

## Rules

| Rule | Why |
| --- | --- |
| `signIn` never returns a token. Tokens stay inside the driver. | Principle III, rules 3 and 7. |
| `signIn` returns the account as `{ id, handle, name, photoUrl }`, read from the platform after sign-in. | Same-account check and the account card. |
| `onCode` is called with a code when the user must enter one, and with `null` when the wait ends. Drivers with a native sign-in never call it. | FR-GH-006 without a GitHub branch in the screens. |
| `listOld`, `checkNew`, and `add` check the shape of every platform answer before use. | Principle III, rule 8. |
| `checkNew` only reads. | FR-GH-016. |
| `add` only adds. It never removes or changes an existing thing on either account. | FR-GH-009. |
| `add` maps every failure to an `Outcome`. It never throws a raw error to the mover and never returns raw platform text as a `reason`. | FR-GH-017. |
| A driver logs nothing about accounts, codes, tokens, or items. | Principle III, rule 7. |

## Who calls what

| Caller | Uses |
| --- | --- |
| `src/state/flows.ts` | `signIn`, `signOut`, `canAct`, `listOld`, `checkNew`, `words` |
| `src/move/mover.ts` | `add`, `pace` (through the pacer) |
| `src/ui/*` | `words`, `kinds`, `removeAccessUrl` |
| `src/ui/SettingsView.tsx` | `signOut` of every driver, for Delete all |

## YouTube driver (Part A)

Wraps today's `src/auth/google.ts` and `src/api/youtube.ts` with no behavior change. One kind, `channel`, no heading. No `pace`, no `removeAccessUrl`. `signIn` ignores `kinds`, and `granted()` is always `['channel']`. `add` returns `later` with `resumeAt` from `nextQuotaReset()` where it returns `tomorrow` today.
