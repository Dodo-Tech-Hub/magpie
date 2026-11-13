// Every user-facing text lives here. Simple words, like talking to a kid.
export const strings = {
  stepFrom: 'From',
  stepPick: 'Pick',
  stepTo: 'To',
  oldTitle: 'Old account',
  oldHint: 'Where your channels are now',
  newTitle: 'New account',
  newHint: 'Where your channels should go',
  signIn: 'Sign in with Google',
  switchAccount: 'Switch',
  signInFailed: "Sign-in didn't finish. Try again.",
  sameAsOld: 'This is your old account. Pick a different one.',
  sameAsNew: 'This is your new account. Pick a different one.',
  pickLocked: 'Sign in to your old account first',
  noChannels: "This account doesn't follow any channels yet",
  searchPlaceholder: 'Search channels',
  all: 'All',
  needNewAccount: 'Sign in to your new account first',
  needPick: 'Pick at least 1 channel',
  moving: 'Moving…',
  moved: 'Moved',
  couldntMove: "Couldn't move",
  tomorrow: 'Tomorrow',
  alreadyThere: 'Already there',
  limitReached: "Daily limit reached. We'll remind you when you can move the rest.",
  offline: "No internet. Try again when you're online.",
  signInAgain: 'Your sign-in ran out. Sign in again to keep going.',
  continueMove: 'Continue',
  unfinished: 'Unfinished',
  deleteProgress: 'Delete',
  deleteAll: 'Delete all my data',
  deleteAllAsk: 'This removes everything the app saved on this phone. It cannot be undone.',
  cancel: 'Cancel',
  reminderAsk: 'Can we remind you when you can move the rest?',
  reminderTitle: 'Magpie',
  reminderBody: 'You can move the rest of your channels now.',
  yes: 'Yes',
  no: 'No',
  settings: 'Settings',
  back: 'Back',
  home: 'Home',
  homeTitle: 'Magpie',
  sectionAutomatic: 'Automatic',
  sectionGuided: 'Guided',
  platformYoutube: 'YouTube',
  look: 'Look',
  light: 'Light',
  dark: 'Dark',
  auto: 'Auto',
  notAffiliated: 'Magpie is not made by or linked with YouTube or Google. YouTube is a trademark of Google LLC.',
} as const;

export const continueLeft = (n: number) => `Continue: ${n} left`;
export const continueLabel = (name: string, n: number) => `Continue ${name}, ${n} left`;
export const signInTo = (email: string) => `Sign in to ${email} to keep going.`;
export const wrongAccount = (email: string) => `This one needs ${email}. Pick that account.`;
export const moveButton = (n: number) => `Move ${n} channel${n === 1 ? '' : 's'}`;
export const pickedCounter = (picked: number, total: number) => `${picked} of ${total} picked`;
export const channelsLeft = (oldEmail: string, newEmail: string, left: number) =>
  `${oldEmail.split('@')[0]} → ${newEmail.split('@')[0]} · ${left} left`;

export function summary(s: {
  moved: number;
  alreadyThere: number;
  couldntMove: number;
  waiting: number;
}): string {
  const parts = [`${s.moved} moved`];
  if (s.alreadyThere) parts.push(`${s.alreadyThere} already there`);
  if (s.couldntMove) parts.push(`${s.couldntMove} couldn't move`);
  if (s.waiting) parts.push(`${s.waiting} waiting`);
  return parts.join(' · ');
}
