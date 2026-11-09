import type { ExpoConfig } from 'expo/config';

// Public OAuth client IDs only. No client secrets exist for native apps.
// iOS URL scheme is the iOS client ID reversed, e.g. com.googleusercontent.apps.<id>
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const iosUrlScheme = iosClientId
  ? `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`
  : undefined;

const config: ExpoConfig = {
  name: 'Subs Migrator',
  slug: 'youtube-subs-migrator',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.dodotechhub.subsmigrator',
  },
  android: {
    package: 'com.dodotechhub.subsmigrator',
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  plugins: [
    iosUrlScheme
      ? ['@react-native-google-signin/google-signin', { iosUrlScheme }]
      : '@react-native-google-signin/google-signin',
    'expo-sqlite',
    'expo-notifications',
  ],
};

export default config;
