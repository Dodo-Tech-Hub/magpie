import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/state/AppState';
import { isMovable, startMove, togglePick } from '@/state/flows';
import { moveButton, pickedCounter, strings, summary } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';
import { ChannelRow, ROW_HEIGHT } from '@/ui/ChannelRow';

export function PickStep() {
  const { state, dispatch } = useApp();
  const { channels, moveState } = state;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState('');

  const onToggle = useCallback(
    (id: string, picked: boolean) => void togglePick(state, dispatch, [id], picked),
    [state, dispatch],
  );

  const movable = channels.filter(isMovable).length;
  const moving = moveState === 'moving';
  const resume = moveState === 'limit' || moveState === 'offline' || moveState === 'auth';
  const counts = {
    moved: channels.filter((c) => c.status === 'moved').length,
    alreadyThere: channels.filter((c) => c.status === 'already_there').length,
    couldntMove: channels.filter((c) => c.status === 'couldnt_move').length,
    waiting: channels.filter(isMovable).length,
  };
  const showSummary = moveState === 'done' || resume;
  const pickable = channels.filter((c) => c.status !== 'already_there');
  const shown = query
    ? channels.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
    : channels;
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
            placeholder={strings.searchPlaceholder}
            placeholderTextColor={colors.muted}
            accessibilityLabel={strings.searchPlaceholder}
          />
        </View>
        <View style={styles.allRow}>
          <Pressable
            style={styles.all}
            accessibilityRole="checkbox"
            accessibilityLabel={strings.all}
            accessibilityState={{ checked: allPicked }}
            onPress={() =>
              void togglePick(state, dispatch, shownPickable.map((c) => c.channelId), !allPicked)
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
        data={shown}
        keyExtractor={(c) => c.channelId}
        getItemLayout={(_, i) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * i, index: i })}
        renderItem={({ item }) => <ChannelRow channel={item} onToggle={onToggle} />}
        ListEmptyComponent={<Text style={styles.empty}>{strings.noChannels}</Text>}
      />
      <View style={styles.bar}>
        {showSummary && <Text style={styles.summary}>{summary(counts)}</Text>}
        {moveState === 'limit' && <Text style={styles.note}>{strings.limitReached}</Text>}
        {state.notice && <Text style={styles.error}>{state.notice}</Text>}
        {!(moveState === 'done' && movable === 0) && channels.length > 0 && (
          <Pressable
            style={[styles.move, moving && styles.off]}
            accessibilityRole="button"
            accessibilityLabel={moving ? strings.moving : resume ? strings.continueMove : moveButton(movable)}
            disabled={moving}
            onPress={() => void startMove(state, dispatch)}
          >
            <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
            <Text style={styles.moveText}>
              {moving ? strings.moving : resume ? strings.continueMove : moveButton(movable)}
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
    counter: { fontSize: 13, color: c.muted },
    locked: { alignItems: 'center', padding: 32, gap: 8 },
    empty: { padding: 24, textAlign: 'center', color: c.muted },
    bar: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    summary: { fontSize: 14, marginBottom: 8, color: c.success },
    note: { fontSize: 13, color: c.warning, marginBottom: 8 },
    error: { fontSize: 13, color: c.danger, marginBottom: 8 },
    move: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 8, backgroundColor: c.primary },
    moveText: { color: c.onPrimary, fontSize: 15 },
    off: { opacity: 0.5 },
  });
