import * as SecureStore from 'expo-secure-store';

// Where GitHub tokens live (specs/008-github-platform/data-model.md, "Tokens").
// Old account: memory only. New account: the phone's secure storage, under one key.
const KEY = 'github.new';

export type NewToken = { token: string; accountId: string; scopes: string[]; expiresAt: number };

let oldToken: string | null = null;
export const setOld = (token: string) => {
  oldToken = token;
};
export const getOld = () => oldToken;
export const dropOld = () => {
  oldToken = null;
};

// Saved on purpose field by field: a refresh token handed in by mistake is never stored.
export async function setNew({ token, accountId, scopes, expiresAt }: NewToken): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify({ token, accountId, scopes, expiresAt }));
}

export async function dropNew(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}

// Null when there is no token, it ran out, or the saved value is not what we wrote (Principle III.8).
export async function getNew(): Promise<NewToken | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    const r = v as Partial<NewToken> | null;
    if (
      !r ||
      typeof r.token !== 'string' ||
      typeof r.accountId !== 'string' ||
      typeof r.expiresAt !== 'number' ||
      !Array.isArray(r.scopes) ||
      !r.scopes.every((s) => typeof s === 'string')
    ) {
      return null;
    }
    if (r.expiresAt <= Date.now()) {
      await dropNew();
      return null;
    }
    return { token: r.token, accountId: r.accountId, scopes: r.scopes, expiresAt: r.expiresAt };
  } catch {
    return null;
  }
}
