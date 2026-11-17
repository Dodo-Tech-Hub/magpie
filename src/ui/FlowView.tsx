import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useApp, type Step } from '@/state/AppState';
import { useTheme } from '@/theme/theme';
import { FromStep } from '@/ui/FromStep';
import { layout, useTwoPane } from '@/ui/layout';
import { PickStep } from '@/ui/PickStep';
import { ToStep } from '@/ui/ToStep';

// The move flow. One step at a time in the column, or all three in two panes on a wide window: From and To on the left, Pick on the right (spec 010, FR-015 to FR-018).
export function FlowView() {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const two = useTwoPane();
  const show = (s: Step) => two || state.step === s;
  // Touching a pane makes its step the current one. In one pane the step on screen is already current, so this does nothing.
  const use = (s: Step) => () => {
    if (state.step !== s) dispatch({ type: 'setStep', step: s });
  };
  // PickStep must stay mounted when the side pane appears or goes away, so its search text, collapsed sections, and scroll position survive. The two keys make that hold even if this markup is reordered.
  return (
    <View style={two ? layout.panes : layout.column} testID={two ? 'panes' : 'body'}>
      {(show('from') || show('to')) && (
        <ScrollView
          key="side"
          style={two ? [layout.side, styles.line, { borderColor: colors.border }] : styles.flex}
          keyboardShouldPersistTaps="handled"
        >
          {show('from') && (
            <View testID="pane-from" onTouchStart={use('from')}>
              <FromStep />
            </View>
          )}
          {show('to') && (
            <View testID="pane-to" onTouchStart={use('to')}>
              <ToStep />
            </View>
          )}
        </ScrollView>
      )}
      {show('pick') && (
        <View key="pick" style={styles.flex} testID="pane-pick" onTouchStart={use('pick')}>
          <PickStep />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  line: { borderRightWidth: StyleSheet.hairlineWidth },
});
