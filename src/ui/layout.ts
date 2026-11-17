import { StyleSheet } from 'react-native';

export const MAX_CONTENT_WIDTH = 600;
export const TOUCH_TARGET = 48;

export const layout = StyleSheet.create({
  // The content column: fills the window under 600 points, centered above it (spec 010, FR-003).
  column: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
});
