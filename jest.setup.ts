jest.mock('@react-native-google-signin/google-signin', () =>
  jest.requireActual('./tests/mocks/googleSignin'),
);
jest.mock('expo-sqlite', () => jest.requireActual('./tests/mocks/expoSqlite'));
jest.mock('expo-notifications', () => jest.requireActual('./tests/mocks/expoNotifications'));
