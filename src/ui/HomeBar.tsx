import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/state/AppState';
import { strings } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';
import { layout } from '@/ui/layout';

// Top bar for Home: the app icon, and the gear (or a back arrow while Settings is open).
export function HomeBar() {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.bar}>
      <View style={[layout.column, styles.row]} testID="bar-content">
        <View style={styles.title} accessible accessibilityRole="header" accessibilityLabel={strings.homeTitle}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.icon}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>
        <Pressable
          style={styles.gear}
          accessibilityRole="button"
          accessibilityLabel={state.settingsOpen ? strings.back : strings.settings}
          onPress={() => dispatch({ type: state.settingsOpen ? 'closeSettings' : 'openSettings' })}
        >
          <Ionicons name={state.settingsOpen ? 'arrow-back' : 'settings-outline'} size={24} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    bar: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    // flex 0 cancels the column's flex 1, so the bar keeps its own height.
    row: { flex: 0, flexDirection: 'row', alignItems: 'center' },
    title: { flex: 1, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'flex-start' },
    icon: { width: 36, height: 36, borderRadius: 8 },
    gear: { width: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  });
