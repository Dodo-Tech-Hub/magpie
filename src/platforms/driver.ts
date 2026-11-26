import type { AccountInfo, NewItem, StoredItem } from '@/store/progressStore';

// What every Automatic platform provides. Contract: specs/008-github-platform/contracts/platform-driver.md

export type Role = 'old' | 'new';

export type Outcome =
  | { kind: 'moved'; reason?: string } // reason: a note for the row, e.g. how many a list left out
  | { kind: 'couldnt_move'; reason: string } // plain words, shown on the row
  | { kind: 'later'; resumeAt: number } // stop the move, remind at this time
  | { kind: 'wait'; ms: number } // short wait, then try the same item again
  | { kind: 'auth' } // sign-in ran out
  | { kind: 'retry' } // network problem
  | { kind: 'stop'; notice: string }; // the platform paused the account

// Asked before each add. wait: sleep this long first (0 = go now). later: stop, go on at this time.
// gapMs: least time between two adds. perHour and perDay: the most adds in that time (perDay is optional).
export type Pace = { gapMs: number; perHour: number; perDay?: number };
export type PaceAnswer = { wait: number } | { later: number };
export type Pacer = {
  beforeAdd(): Promise<PaceAnswer>;
  // When the pace allows the next add: 0 = now.
  nextAt?(): Promise<number>;
};

// Thrown by listOld and checkNew. retry: no network. later: a limit. auth: the sign-in ran out.
export class DriverError extends Error {
  constructor(public kind: 'retry' | 'later' | 'auth') {
    super(`Platform request failed: ${kind}`);
  }
}

export type SignInCode = { code: string; url: string };

export type SignInResult =
  | { ok: true; account: AccountInfo }
  // not_found: no such account. not_supported: the platform cannot serve this account (yet). unavailable: it cannot be read now.
  | { ok: false; reason: 'cancelled' | 'failed' | 'not_found' | 'not_supported' | 'unavailable' };

export type Words = {
  signIn: string; // sign-in button label
  signInIcon: string; // Ionicons name
  oldHint: string;
  newHint: string;
  searchPlaceholder: string;
  noItems: string;
  needPick: string;
  later: string; // row label for the later state
  limitReached: string;
  reminderBody: string;
  moveButton: (n: number) => string;
  notAffiliated: string;
  accessNote?: string;
  // The button under accessNote that opens the page where the user ends the access (needs removeAccessUrl).
  accessButton?: string;
  // For a platform with handleInput: the label and the placeholder of the handle box.
  handleLabel?: string;
  handlePlaceholder?: string;
  // The old account's button when the app holds no sign-in for it (nothing to sign out of). Default: Sign out or Switch.
  changeOld?: string;
};

// optional: never asked on the first new-account sign-in. needsOld: read only after an old-account sign-in ("Allow" on Pick).
export type Kind = { id: string; heading: string; optional?: boolean; needsOld?: boolean };

export type Driver = {
  id: string;
  words: Words;
  // In the order Pick shows them. One kind with an empty heading means a plain list.
  kinds: Kind[];
  // The order items move in, when it differs from the Pick order.
  moveOrder?: string[];
  // The order items of one kind move in, for example oldest first. Default: the stored order.
  itemOrder?: (a: StoredItem, b: StoredItem) => number;
  pace?: Pace & { adds(items: StoredItem[]): number };
  // Page where the user removes the app's access.
  removeAccessUrl?: string;
  // Page that explains this platform's limits. Missing = no info button and no "Learn more".
  limitsUrl?: string;
  // The Switch button becomes Sign out.
  switchSignsOut?: boolean;
  // From and To show a box where the user types the account's handle. signIn gets it as `handle`.
  handleInput?: boolean;
  // The new account's sign-in is kept for an unfinished move, so Continue needs no new sign-in.
  resumesNew?: boolean;

  // kinds: what the new account needs access for. Abort = the user tapped Cancel.
  // handle: with handleInput, the account the user typed. The old role with no kinds only looks the account up.
  // only: for "Allow" on the new account, its ID. A sign-in to another account must not replace the saved sign-in.
  signIn(
    role: Role,
    kinds: string[],
    onCode: (code: SignInCode | null) => void,
    signal?: AbortSignal,
    handle?: string,
    only?: string,
  ): Promise<SignInResult>;
  // false: the platform could not cancel the access. The phone's copy is gone anyway.
  signOut(role?: Role): Promise<void | false>;
  // Kinds the new account has access for.
  granted(): Promise<string[]>;
  // Is there a usable sign-in for this account?
  canAct(role: Role, accountId: string): Promise<boolean>;
  // missing: kinds that could not be read.
  listOld(): Promise<{ items: NewItem[]; missing: string[] }>;
  // Item IDs the new account already has.
  checkNew(items: StoredItem[], granted: string[]): Promise<string[]>;
  add(item: StoredItem, items: StoredItem[], pacer?: Pacer): Promise<Outcome>;
  // A move finished with nothing left to move.
  endMove?(): Promise<void | false>;
};
