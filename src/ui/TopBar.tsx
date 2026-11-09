import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp, type State, type Step } from '@/state/AppState';
import { strings } from '@/strings';

type Icon = keyof typeof Ionicons.glyphMap;
type StepState = 'current' | 'done' | 'locked' | 'not started';

const STEPS: { step: Step; label: string; icon: Icon }[] = [
  { step: 'from', label: strings.stepFrom, icon: 'person-outline' },
  { step: 'pick', label: strings.stepPick, icon: 'list-outline' },
  { step: 'to', label: strings.stepTo, icon: 'person-add-outline' },
];

// Current wins over done and locked so the user always sees where they are.
function stateOf(step: Step, s: State): StepState {
  if (s.step === step) return 'current';
  if (step === 'from') return s.oldAccount ? 'done' : 'not started';
  if (step === 'to') return s.newAccount ? 'done' : 'not started';
  if (!s.oldAccount) return 'locked';
  return s.moveState === 'done' ? 'done' : 'not started';
}

export function TopBar() {
  const { state, dispatch } = useApp();
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {STEPS.map(({ step, label, icon }) => {
        const st = stateOf(step, state);
        const current = st === 'current';
        const locked = step === 'pick' && !state.oldAccount;
        const shown: Icon = locked ? 'lock-closed-outline' : st === 'done' ? 'checkmark-circle' : icon;
        const color = current ? '#1a56db' : st === 'done' ? '#1b7f3b' : '#555';
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
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ccc' },
  step: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderColor: 'transparent' },
  current: { borderColor: '#1a56db' },
  label: { fontSize: 12, marginTop: 2 },
  labelCurrent: { fontWeight: '500' },
});
