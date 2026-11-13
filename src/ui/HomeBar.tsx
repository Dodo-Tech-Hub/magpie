import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/state/AppState';
import { strings } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';

// Top bar for Home: the title, and the gear (or a back arrow while Settings is open).
export function HomeBar() {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.bar}>
      <Text style={styles.title} accessibilityRole="header">
        {strings.homeTitle}
      </Text>
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
    title: { flex: 1, color: c.text, fontSize: 20, fontWeight: '600', paddingHorizontal: 16, paddingVertical: 12 },
    gear: { width: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  });
