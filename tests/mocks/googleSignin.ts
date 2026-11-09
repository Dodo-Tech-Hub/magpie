export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
};

export type MockUser = { id: string; email: string; name: string; photo: string | null };

export const mockUser = (id: string, email = `${id}@example.com`): MockUser => ({
  id,
  email,
  name: id,
  photo: null,
});

const successFor = (u: MockUser) => ({
  type: 'success' as const,
  data: {
    user: { ...u, familyName: null, givenName: null },
    scopes: [],
    idToken: null,
    serverAuthCode: null,
  },
});

type SignInRes = ReturnType<typeof successFor> | { type: 'cancelled'; data: null };

export const GoogleSignin = {
  configure: jest.fn(),
  signIn: jest.fn(async (): Promise<SignInRes> => successFor(mockUser('old-id', 'old@example.com'))),
  signOut: jest.fn(async () => null),
  revokeAccess: jest.fn(async () => null),
  clearCachedAccessToken: jest.fn(async () => null),
  getCurrentUser: jest.fn((): { user: { id: string } } | null => null),
  getTokens: jest.fn(async () => ({ idToken: 'id-token', accessToken: 'access-token' })),
};

export const signInAs = (u: MockUser) => GoogleSignin.signIn.mockResolvedValueOnce(successFor(u));
export const signInCancelled = () =>
  GoogleSignin.signIn.mockResolvedValueOnce({ type: 'cancelled' as const, data: null });
