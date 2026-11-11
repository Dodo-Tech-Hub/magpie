import React, { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from '@/auth/google';
import { cancelReminder } from '@/reminders/reminder';
import { useApp } from '@/state/AppState';
import { deleteAll, listUnfinished } from '@/store/progressStore';
import { strings } from '@/strings';
import { useTheme, type Colors, type ThemeChoice } from '@/theme/theme';

type Icon = keyof typeof Ionicons.glyphMap;

const CHOICES: { choice: ThemeChoice; label: string; icon: Icon }[] = [
  { choice: 'light', label: strings.light, icon: 'sunny-outline' },
  { choice: 'dark', label: strings.dark, icon: 'moon-outline' },
  { choice: 'system', label: strings.auto, icon: 'phone-portrait-outline' },
];

// Each option is one stacked block, so a future option is one more block.
export function SettingsView() {
  const { dispatch } = useApp();
  const { colors, choice, setChoice, resetChoice } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const removeAll = () =>
    Alert.alert(strings.deleteAll, strings.deleteAllAsk, [
      { text: strings.cancel, style: 'cancel' },
      {
        text: strings.deleteProgress,
        style: 'destructive',
        onPress: async () => {
          for (const p of await listUnfinished()) await cancelReminder(p.id);
          await deleteAll();
          await signOut();
          resetChoice();
          dispatch({ type: 'reset' });
        },
      },
    ]);

  return (
    <View style={styles.flex}>
      <Text style={styles.heading}>{strings.settings}</Text>
      <View style={styles.block}>
        <Text style={styles.label}>{strings.look}</Text>
        <View style={styles.choices} accessibilityRole="radiogroup">
          {CHOICES.map((c) => {
            const on = c.choice === choice;
            const color = on ? colors.onPrimary : colors.text;
            return (
              <Pressable
                key={c.choice}
                style={[styles.choice, on && styles.chosen]}
                accessibilityRole="radio"
                accessibilityLabel={c.label}
                accessibilityState={{ checked: on }}
                onPress={() => setChoice(c.choice)}
              >
                <Ionicons name={c.icon} size={18} color={color} />
                <Text style={[styles.choiceText, { color }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.block}>
        <Pressable
          style={styles.deleteAll}
          accessibilityRole="button"
          accessibilityLabel={strings.deleteAll}
          onPress={removeAll}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={styles.deleteText}>{strings.deleteAll}</Text>
        </Pressable>
      </View>
      <View style={styles.block}>
        <Text style={styles.notice}>{strings.notAffiliated}</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    heading: { fontSize: 18, fontWeight: '500', color: c.text, padding: 14 },
    block: { padding: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    label: { fontSize: 13, color: c.muted, marginBottom: 8 },
    choices: { flexDirection: 'row', gap: 8 },
    choice: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 8, borderWidth: 1, borderColor: c.border },
    chosen: { backgroundColor: c.primary, borderColor: c.primary },
    choiceText: { fontSize: 14 },
    deleteAll: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    notice: { fontSize: 13, color: c.muted },
    deleteText: { color: c.danger, fontSize: 14 },
  });
