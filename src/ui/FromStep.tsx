import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cancelReminder } from '@/reminders/reminder';
import { driverFor } from '@/platforms/platforms';
import { useApp } from '@/state/AppState';
import { cancelSignIn, switchAccount, openProgress, signInOld } from '@/state/flows';
import { deleteProgress, listUnfinished, type UnfinishedProgress } from '@/store/progressStore';
import { itemsLeft, strings } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';
import { AccountCard } from '@/ui/AccountCard';

export function FromStep() {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [items, setItems] = useState<UnfinishedProgress[]>([]);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let live = true;
    void listUnfinished(state.platform ?? undefined).then((list) => live && setItems(list));
    return () => {
      live = false;
    };
  }, [version, state.platform, state.step, state.progressId, state.moveState, state.oldAccount]);

  const remove = async (id: string) => {
    await deleteProgress(id);
    await cancelReminder(id);
    if (state.progressId === id) dispatch({ type: 'reset' });
    refresh();
  };

  const driver = driverFor(state.platform!);
  const busy = state.moveState === 'moving';
  return (
    <View style={styles.flex}>
      <AccountCard
        title={strings.oldTitle}
        words={driver.words}
        hint={driver.words.oldHint}
        account={state.oldAccount}
        disabled={busy}
        onSignIn={() => void signInOld(state, dispatch)}
        code={state.signInCode?.role === 'old' ? state.signInCode : null}
        onCancel={cancelSignIn}
        signsOut={driver.switchSignsOut}
        onSwitch={() => void switchAccount(state, dispatch, 'old')}
      />
      {state.loading && <Text style={styles.heading}>{strings.loading}</Text>}
      {state.notice && <Text style={styles.error}>{state.notice}</Text>}
      {items.length > 0 && (
        <View>
          <Text style={styles.heading}>{strings.unfinished}</Text>
          {items.map((p) => {
            const label = itemsLeft(p.oldAccount.handle, p.newAccount.handle, p.left);
            return (
              <View key={p.id} style={styles.row}>
                <Pressable
                  style={styles.open}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  disabled={busy}
                  onPress={() => void openProgress(dispatch, p.id)}
                >
                  <Ionicons name="time-outline" size={20} color={colors.muted} />
                  <Text style={styles.label}>{label}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${strings.deleteProgress} ${label}`}
                  disabled={busy}
                  onPress={() => void remove(p.id)}
                >
                  <Ionicons name="trash-outline" size={22} color={colors.danger} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    error: { color: c.danger, paddingHorizontal: 14 },
    heading: { fontSize: 13, color: c.muted, paddingHorizontal: 14, marginTop: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 48, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    label: { fontSize: 15, color: c.text },
  });
