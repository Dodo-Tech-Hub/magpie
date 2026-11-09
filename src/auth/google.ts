import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import type { AccountInfo } from '@/store/progressStore';

export type Role = 'old' | 'new';

// Least privilege (constitution III.1): read-only for the old account, subscribe for the new one.
const SCOPES: Record<Role, string[]> = {
  old: ['https://www.googleapis.com/auth/youtube.readonly'],
  new: ['https://www.googleapis.com/auth/youtube'],
};

export type SignInResult =
  | { ok: true; account: AccountInfo }
  | { ok: false; reason: 'cancelled' | 'failed' };

export async function signIn(role: Role): Promise<SignInResult> {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    scopes: SCOPES[role],
  });
  try {
    // The SDK holds one account. Sign out first so Google shows the account picker.
    await GoogleSignin.signOut();
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return { ok: false, reason: 'cancelled' };
    const u = res.data.user;
    return {
      ok: true,
      account: { id: u.id, email: u.email, name: u.name ?? u.email, photoUrl: u.photo },
    };
  } catch (e) {
    const code = (e as { code?: string }).code;
    return { ok: false, reason: code === statusCodes.SIGN_IN_CANCELLED ? 'cancelled' : 'failed' };
  }
}

// Tokens stay in memory only. Pass the old token after a 401 to force a fresh one.
export async function getAccessToken(staleToken?: string): Promise<string> {
  if (staleToken) await GoogleSignin.clearCachedAccessToken(staleToken);
  const { accessToken } = await GoogleSignin.getTokens();
  return accessToken;
}

// Revoke, then sign out (constitution III.3). Revoke fails if nobody is signed in.
export async function signOut(): Promise<void> {
  try {
    await GoogleSignin.revokeAccess();
  } catch {
    // nothing to revoke
  }
  try {
    await GoogleSignin.signOut();
  } catch {
    // already signed out
  }
}

// Which Google account the SDK holds right now. Used to make sure a move runs as the new account.
export function signedInAccountId(): string | null {
  return GoogleSignin.getCurrentUser()?.user.id ?? null;
}
