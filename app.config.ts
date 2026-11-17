import type { ExpoConfig } from 'expo/config';

// Public OAuth client IDs only. No client secrets exist for native apps.
// iOS URL scheme is the iOS client ID reversed, e.g. com.googleusercontent.apps.<id>
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const iosUrlScheme = iosClientId
  ? `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`
  : undefined;

const config: ExpoConfig = {
  name: 'Magpie',
  slug: 'magpie',
  version: '0.1.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'io.github.dodotechhub.magpie',
  },
  android: {
    package: 'io.github.dodotechhub.magpie',
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: '#1F1F1F',
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
    ['expo-splash-screen', { image: './assets/splash-icon.png', backgroundColor: '#1F1F1F', resizeMode: 'contain' }],
    ['expo-notifications', { icon: './assets/notification-icon.png' }],
  ],
};

export default config;
