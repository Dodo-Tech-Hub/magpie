jest.mock('@react-native-google-signin/google-signin', () =>
  jest.requireActual('./tests/mocks/googleSignin'),
);
jest.mock('expo-sqlite', () => jest.requireActual('./tests/mocks/expoSqlite'));
jest.mock('expo-notifications', () => jest.requireActual('./tests/mocks/expoNotifications'));
jest.mock('expo-secure-store', () => jest.requireActual('./tests/mocks/expoSecureStore'));
jest.mock('expo-clipboard', () => jest.requireActual('./tests/mocks/expoClipboard'));
jest.mock('expo-web-browser', () => jest.requireActual('./tests/mocks/expoWebBrowser'));
jest.mock('expo-crypto', () => jest.requireActual('./tests/mocks/expoCrypto'));
