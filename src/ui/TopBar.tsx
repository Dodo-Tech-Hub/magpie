import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp, type State, type Step } from '@/state/AppState';
import { strings } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';

type Icon = keyof typeof Ionicons.glyphMap;
type StepState = 'current' | 'done' | 'locked' | 'not started';

const STEPS: { step: Step; label: string; icon: Icon }[] = [
  { step: 'from', label: strings.stepFrom, icon: 'person-outline' },
  { step: 'pick', label: strings.stepPick, icon: 'list-outline' },
  { step: 'to', label: strings.stepTo, icon: 'person-add-outline' },
];

// Current wins over done and locked so the user always sees where they are.
// While Settings is open no step is current.
function stateOf(step: Step, s: State): StepState {
  if (s.step === step && !s.settingsOpen) return 'current';
  if (step === 'from') return s.oldAccount ? 'done' : 'not started';
  if (step === 'to') return s.newAccount ? 'done' : 'not started';
  if (!s.oldAccount) return 'locked';
  return s.moveState === 'done' ? 'done' : 'not started';
}

export function TopBar() {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.bar}>
      <Pressable
        style={styles.gear}
        accessibilityRole="button"
        accessibilityLabel={strings.home}
        onPress={() => dispatch({ type: 'goHome' })}
      >
        <Ionicons name="home-outline" size={24} color={colors.text} />
      </Pressable>
      <View style={styles.tabs} accessibilityRole="tablist">
        {STEPS.map(({ step, label, icon }) => {
          const st = stateOf(step, state);
          const current = st === 'current';
          const locked = step === 'pick' && !state.oldAccount;
          const shown: Icon = locked ? 'lock-closed-outline' : st === 'done' ? 'checkmark-circle' : icon;
          const color = current ? colors.primary : st === 'done' ? colors.success : colors.muted;
          return (
            <Pressable
              key={step}
              style={[styles.step, current && styles.current]}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityValue={{ text: st }}
              accessibilityState={{ selected: current }}
              onPress={() => dispatch({ type: 'setStep', step })}
            >
              <Ionicons name={shown} size={22} color={color} />
              <Text style={[styles.label, { color }, current && styles.labelCurrent]}>{label}</Text>
            </Pressable>
          );
        })}
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
    bar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    tabs: { flex: 1, flexDirection: 'row' },
    step: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderColor: 'transparent' },
    current: { borderColor: c.primary },
    label: { fontSize: 12, marginTop: 2 },
    labelCurrent: { fontWeight: '500' },
    gear: { width: 52, alignItems: 'center', justifyContent: 'center' },
  });
