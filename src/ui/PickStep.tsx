import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { driverFor } from '@/platforms/platforms';
import { useApp } from '@/state/AppState';
import type { StoredItem } from '@/store/progressStore';
import { isMovable, startMove, togglePick } from '@/state/flows';
import { timeLeft } from '@/move/pacer';
import { pickedCounter, strings, summary, timeLeftText } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';
import { AccessNote } from '@/ui/AccessNote';
import { ItemRow, ROW_HEIGHT } from '@/ui/ItemRow';

type Row = { item: StoredItem } | { heading: string; key: string };

export function PickStep() {
  const { state, dispatch } = useApp();
  const { items, moveState } = state;
  const words = driverFor(state.platform!).words;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState('');

  const driver = driverFor(state.platform!);
  const onToggle = useCallback(
    (id: string, picked: boolean) => void togglePick(state, dispatch, [id], picked),
    [state, dispatch],
  );

  const movable = items.filter(isMovable).length;
  const adds = driver.pace?.adds(items.filter(isMovable)) ?? 0;
  const moving = moveState === 'moving';
  const resume = moveState === 'limit' || moveState === 'offline' || moveState === 'auth' || moveState === 'stopped';
  const counts = {
    moved: items.filter((c) => c.status === 'moved').length,
    alreadyThere: items.filter((c) => c.status === 'already_there').length,
    couldntMove: items.filter((c) => c.status === 'couldnt_move').length,
    waiting: items.filter(isMovable).length,
  };
  const showSummary = moveState === 'done' || resume;
  const pickable = items.filter((c) => c.status !== 'already_there');
  const shown = query
    ? items.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
    : items;
  // One section per kind when there is more than one kind. A kind with no items has none (FR-GH-003).
  const kinds = driver.kinds.filter((k) => shown.some((c) => c.kind === k.id));
  const rows: Row[] =
    kinds.length < 2
      ? shown.map((item) => ({ item }))
      : kinds.flatMap((k) => [
          { heading: k.heading, key: `h:${k.id}` },
          ...shown.filter((c) => c.kind === k.id).map((item) => ({ item })),
        ]);
  const shownPickable = shown.filter((c) => c.status !== 'already_there' && c.status !== 'moved');
  const allPicked = shownPickable.length > 0 && shownPickable.every((c) => c.picked);

  if (!state.oldAccount) {
    return (
      <View style={styles.locked}>
        <Ionicons name="lock-closed-outline" size={28} color={colors.muted} />
        <Text style={styles.empty}>{strings.pickLocked}</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.tools}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={words.searchPlaceholder}
            placeholderTextColor={colors.muted}
            accessibilityLabel={words.searchPlaceholder}
          />
        </View>
        <View style={styles.allRow}>
          <Pressable
            style={styles.all}
            accessibilityRole="checkbox"
            accessibilityLabel={strings.all}
            accessibilityState={{ checked: allPicked }}
            onPress={() =>
              void togglePick(state, dispatch, shownPickable.map((c) => c.itemId), !allPicked)
            }
          >
            <Ionicons name={allPicked ? 'checkbox' : 'square-outline'} size={24} color={colors.primary} />
            <Text style={styles.text}>{strings.all}</Text>
          </Pressable>
          <Text style={styles.counter}>
            {pickedCounter(pickable.filter((c) => c.picked).length, pickable.length)}
          </Text>
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => ('item' in r ? r.item.itemId : r.key)}
        getItemLayout={(_, i) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * i, index: i })}
        renderItem={({ item: r }) =>
          'item' in r ? (
            <ItemRow item={r.item} laterLabel={words.later} onToggle={onToggle} />
          ) : (
            <Text style={styles.section} accessibilityRole="header">
              {r.heading}
            </Text>
          )
        }
        ListEmptyComponent={<Text style={styles.empty}>{words.noItems}</Text>}
      />
      <View style={styles.bar}>
        {driver.pace && !moving && !showSummary && movable > 0 && (
          <Text style={styles.timeLeft}>{timeLeftText(timeLeft(adds), adds)}</Text>
        )}
        {showSummary && <Text style={styles.summary}>{summary(counts)}</Text>}
        {moveState === 'limit' && <Text style={styles.note}>{words.limitReached}</Text>}
        {moveState === 'done' && <AccessNote driver={driver} />}
        {state.notice && <Text style={styles.error}>{state.notice}</Text>}
        {!(moveState === 'done' && movable === 0) && items.length > 0 && (
          <Pressable
            style={[styles.move, moving && styles.off]}
            accessibilityRole="button"
            accessibilityLabel={moving ? strings.moving : resume ? strings.continueMove : words.moveButton(movable)}
            disabled={moving}
            onPress={() => void startMove(state, dispatch)}
          >
            <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
            <Text style={styles.moveText}>
              {moving ? strings.moving : resume ? strings.continueMove : words.moveButton(movable)}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    text: { color: c.text },
    tools: { padding: 12, gap: 8 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, height: 40, borderWidth: 1, borderColor: c.border, borderRadius: 8 },
    input: { flex: 1, fontSize: 15, color: c.text },
    allRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    all: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    section: { height: ROW_HEIGHT, textAlignVertical: 'center', paddingHorizontal: 14, fontSize: 13, color: c.muted },
    counter: { fontSize: 13, color: c.muted },
    locked: { alignItems: 'center', padding: 32, gap: 8 },
    empty: { padding: 24, textAlign: 'center', color: c.muted },
    bar: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    summary: { fontSize: 14, marginBottom: 8, color: c.success },
    timeLeft: { fontSize: 13, color: c.muted, marginBottom: 8 },
    note: { fontSize: 13, color: c.warning, marginBottom: 8 },
    error: { fontSize: 13, color: c.danger, marginBottom: 8 },
    move: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 8, backgroundColor: c.primary },
    moveText: { color: c.onPrimary, fontSize: 15 },
    off: { opacity: 0.5 },
  });
