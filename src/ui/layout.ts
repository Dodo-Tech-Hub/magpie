import { StyleSheet, useWindowDimensions } from 'react-native';

export const MAX_CONTENT_WIDTH = 600;
export const TOUCH_TARGET = 48;
export const EXPANDED_WIDTH = 840;
export const SIDE_PANE_WIDTH = 360;

export const layout = StyleSheet.create({
  // The content column: fills the window under 600 points, centered above it (spec 010, FR-003).
  column: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  // The two panes of the move flow, side by side and centered (spec 010, FR-015).
  panes: { flex: 1, width: '100%', maxWidth: SIDE_PANE_WIDTH + MAX_CONTENT_WIDTH, alignSelf: 'center', flexDirection: 'row' },
  side: { width: SIDE_PANE_WIDTH, flexGrow: 0 },
});

// The only size class check: the move flow shows two panes from 840 points (spec 010, FR-015).
export const useTwoPane = () => useWindowDimensions().width >= EXPANDED_WIDTH;
