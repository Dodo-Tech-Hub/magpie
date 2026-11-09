import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from '@/auth/google';
import { cancelReminder } from '@/reminders/reminder';
import { useApp } from '@/state/AppState';
import { openProgress, signInOld } from '@/state/flows';
import {
  deleteAll,
  deleteProgress,
  listUnfinished,
  type UnfinishedProgress,
} from '@/store/progressStore';
import { channelsLeft, strings } from '@/strings';
import { AccountCard } from '@/ui/AccountCard';

export function FromStep() {
  const { state, dispatch } = useApp();
  const [items, setItems] = useState<UnfinishedProgress[]>([]);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let live = true;
    void listUnfinished().then((list) => live && setItems(list));
    return () => {
      live = false;
    };
  }, [version, state.step, state.progressId, state.moveState, state.oldAccount]);

  const remove = async (id: string) => {
    await deleteProgress(id);
    await cancelReminder(id);
    if (state.progressId === id) dispatch({ type: 'reset' });
    refresh();
  };

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
          dispatch({ type: 'reset' });
          refresh();
        },
      },
    ]);

  const busy = state.moveState === 'moving';
  return (
    <View style={styles.flex}>
      <AccountCard
        title={strings.oldTitle}
        hint={strings.oldHint}
        account={state.oldAccount}
        disabled={busy}
        onSignIn={() => void signInOld(state, dispatch)}
      />
      {state.notice && <Text style={styles.error}>{state.notice}</Text>}
      {items.length > 0 && (
        <View>
          <Text style={styles.heading}>{strings.unfinished}</Text>
          {items.map((p) => {
            const label = channelsLeft(p.oldAccount.email, p.newAccount.email, p.left);
            return (
              <View key={p.id} style={styles.row}>
                <Pressable
                  style={styles.open}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  disabled={busy}
                  onPress={() => void openProgress(dispatch, p.id)}
                >
                  <Ionicons name="time-outline" size={20} color="#555" />
                  <Text style={styles.label}>{label}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${strings.deleteProgress} ${label}`}
                  disabled={busy}
                  onPress={() => void remove(p.id)}
                >
                  <Ionicons name="trash-outline" size={22} color="#b3261e" />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
      <Pressable
        style={styles.deleteAll}
        accessibilityRole="button"
        accessibilityLabel={strings.deleteAll}
        onPress={removeAll}
      >
        <Ionicons name="trash-outline" size={18} color="#b3261e" />
        <Text style={styles.deleteText}>{strings.deleteAll}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  error: { color: '#b3261e', paddingHorizontal: 14 },
  heading: { fontSize: 13, color: '#555', paddingHorizontal: 14, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 48, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 15 },
  deleteAll: { flexDirection: 'row', alignItems: 'center', gap: 6, margin: 14, marginTop: 'auto' },
  deleteText: { color: '#b3261e', fontSize: 14 },
});
