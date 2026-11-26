import type { Words } from '@/platforms/driver';

// Every user-facing text lives here. Simple words, like talking to a kid.
export const strings = {
  stepFrom: 'From',
  stepPick: 'Pick',
  stepTo: 'To',
  oldTitle: 'Old account',
  newTitle: 'New account',
  switchAccount: 'Switch',
  signOut: 'Sign out',
  allow: 'Allow',
  allowOtherAccount: 'Use your new account here too.',
  loading: 'Loading your list…',
  loadPartial: "Some items couldn't load. The rest can still move.",
  copyCode: 'Copy code',
  waitingForYou: 'Waiting for you to allow it in the browser…',
  signInFailed: "Sign-in didn't finish. Try again.",
  needsOldLine: 'Sign in to your old account to move these.',
  allowOldOther: 'Use your old account here.',
  notFound: "We can't find that account. Check the name.",
  notEmail: 'Type your handle, not your email.',
  notSupported: 'Magpie works only with accounts hosted by Bluesky for now.',
  unavailable: "This account can't be read right now.",
  sameAsOld: 'This is your old account. Pick a different one.',
  sameAsNew: 'This is your new account. Pick a different one.',
  pickLocked: 'Sign in to your old account first',
  all: 'All',
  needNewAccount: 'Sign in to your new account first',
  signingIn: 'Signing in…',
  moving: 'Moving…',
  moved: 'Moved',
  couldntMove: "Couldn't move",
  alreadyThere: 'Already there',
  offline: "No internet. Try again when you're online.",
  signInAgain: 'Your sign-in ran out. Sign in again to keep going.',
  continueMove: 'Continue',
  unfinished: 'Unfinished',
  deleteProgress: 'Delete',
  deleteAll: 'Delete all my data',
  deleteAllAsk: 'This removes everything the app saved on this phone. It cannot be undone.',
  cancel: 'Cancel',
  save: 'Save',
  saveProgressTitle: (platform: string) => `Save your ${platform} progress?`,
  notChosenYet: 'New account not chosen yet',
  reminderAsk: 'Can we remind you when you can move the rest?',
  reminderTitle: 'Magpie',
  yes: 'Yes',
  no: 'No',
  settings: 'Settings',
  back: 'Back',
  home: 'Home',
  homeTitle: 'Magpie',
  sectionAutomatic: 'Automatic',
  sectionGuided: 'Guided',
  platformYoutube: 'YouTube',
  platformGithub: 'GitHub',
  platformBluesky: 'Bluesky',
  look: 'Look',
  light: 'Light',
  dark: 'Dark',
  auto: 'Auto',
  learnMore: 'Learn more',
  couldntOpenPage: "Couldn't open the page.",
} as const;

export const continueLeft = (n: number) => `Continue: ${n} left`;
export const continueLabel = (name: string, n: number) => `Continue ${name}, ${n} left`;
export const aboutLimits = (name: string) => `About ${name} limits`;
export const learnMoreLabel = (name: string) => `Learn more about ${name} limits`;
export const signInTo = (handle: string) => `Sign in to ${handle} to keep going.`;
export const wrongAccount = (handle: string) => `This one needs ${handle}. Pick that account.`;
// How long the picked adds take at the pace of the platform (FR-GH-011).
// perHour: the most adds a platform allows in an hour. More than that takes more than one session.
export const timeLeftText = (seconds: number, adds: number, perHour: number) => {
  if (adds > perHour) return 'More than one session';
  const minutes = Math.ceil(seconds / 60);
  return seconds < 60 ? 'Less than a minute' : `About ${minutes} minute${minutes === 1 ? '' : 's'}`;
};
export const needAccess = (heading: string) => `Magpie needs extra access to move ${heading.toLowerCase()}.`;
export const pickedCounter = (picked: number, total: number) => `${picked} of ${total} picked`;
export const dontSave = "Don't save";
export const itemsLeft = (oldHandle: string, newHandle: string | null, left: number) =>
  `${oldHandle.split('@')[0]} → ${newHandle ? newHandle.split('@')[0] : strings.notChosenYet} · ${left} left`;

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

// Words of the platforms. YouTube's are the texts the app always had.
export const youtubeWords: Words = {
  signIn: 'Sign in with Google',
  signInIcon: 'logo-google',
  oldHint: 'Where your channels are now',
  newHint: 'Where your channels should go',
  searchPlaceholder: 'Search channels',
  noItems: "This account doesn't follow any channels yet",
  needPick: 'Pick at least 1 channel',
  later: 'Tomorrow',
  limitReached: "YouTube lets Magpie move only some channels each day. Today's limit is reached.",
  reminderBody: 'You can move the rest of your channels now.',
  moveButton: (n) => `Move ${n} channel${n === 1 ? '' : 's'}`,
  notAffiliated: 'Magpie is not made by or linked with YouTube or Google. YouTube is a trademark of Google LLC.',
};

export const githubWords: Words = {
  signIn: 'Sign in with GitHub',
  signInIcon: 'logo-github',
  oldHint: 'Where your stars and follows are now',
  newHint: 'Where your stars and follows should go',
  searchPlaceholder: 'Search',
  noItems: "This account doesn't follow anything yet",
  needPick: 'Pick at least 1 item',
  later: 'Later',
  limitReached: 'GitHub lets Magpie move only some items each hour. Magpie must wait a little.',
  reminderBody: 'You can move the rest now.',
  moveButton: (n) => `Move ${n} item${n === 1 ? '' : 's'}`,
  notAffiliated: 'Magpie is not made by or linked with GitHub. GitHub is a trademark of GitHub, Inc.',
  accessNote: "Magpie's access ends on its own within 8 hours. To end it now, open GitHub settings.",
  accessButton: 'Open GitHub settings',
};

export const blueskyWords: Words = {
  signIn: 'Sign in with Bluesky',
  signInIcon: 'log-in-outline',
  oldHint: 'Where your follows are now',
  newHint: 'Where your follows should go',
  searchPlaceholder: 'Search',
  noItems: "This account doesn't follow anything yet",
  needPick: 'Pick at least 1 item',
  later: 'Later',
  limitReached: 'Bluesky lets Magpie move only some items each hour and each day. Magpie must wait a little.',
  reminderBody: 'You can move the rest now.',
  moveButton: (n) => `Move ${n} item${n === 1 ? '' : 's'}`,
  notAffiliated: 'Magpie is not made by or linked with Bluesky. Bluesky and the butterfly logo belong to Bluesky Social PBC.',
  accessNote: "Magpie's access ends on its own within an hour.",
  handleLabel: 'Bluesky handle',
  handlePlaceholder: 'name.bsky.social',
  newHandleLabel: 'Username or email',
  newHandlePlaceholder: 'Username or email (optional)',
  changeOld: 'Change',
};

// The sign-in code panel. The hint is for the second sign-in, when the browser may remember the first account.
export const signInCodeHint = (role: 'old' | 'new') =>
  role === 'new'
    ? "GitHub may show your old account. Tap your picture, then 'Switch account', to use your new one."
    : "GitHub may show your new account. Tap your picture, then 'Switch account', to use your old one.";
export const codeLabel = (code: string) =>
  `Code ${code.split('').map((c) => (c === '-' ? 'dash' : c)).join(' ')}`;
