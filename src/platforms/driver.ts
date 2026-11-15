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
export type PaceAnswer = { wait: number } | { later: number };
export type Pacer = {
  beforeAdd(): Promise<PaceAnswer>;
  // When the pace allows the next add: 0 = now.
  nextAt?(): Promise<number>;
};

export type SignInCode = { code: string; url: string };

export type SignInResult =
  | { ok: true; account: AccountInfo }
  | { ok: false; reason: 'cancelled' | 'failed' };

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
};

export type Kind = { id: string; heading: string; optional?: boolean };

export type Driver = {
  id: string;
  words: Words;
  // In the order Pick shows them. One kind with an empty heading means a plain list.
  kinds: Kind[];
  // The order items move in, when it differs from the Pick order.
  moveOrder?: string[];
  pace?: { perMinute: number; perHour: number; adds(items: StoredItem[]): number };
  // Page where the user removes the app's access.
  removeAccessUrl?: string;
  // The Switch button becomes Sign out.
  switchSignsOut?: boolean;

  // kinds: what the new account needs access for. Abort = the user tapped Cancel.
  signIn(
    role: Role,
    kinds: string[],
    onCode: (code: SignInCode | null) => void,
    signal?: AbortSignal,
  ): Promise<SignInResult>;
  signOut(role?: Role): Promise<void>;
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
  endMove?(): Promise<void>;
};
