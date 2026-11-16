import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/state/AppState';
import { strings } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';

// Top bar for Home: the app icon, and the gear (or a back arrow while Settings is open).
export function HomeBar() {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.bar}>
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
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    bar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    title: { flex: 1, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'flex-start' },
    icon: { width: 36, height: 36, borderRadius: 8 },
    gear: { width: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  });
