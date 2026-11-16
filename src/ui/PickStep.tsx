import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { driverFor, PLATFORMS } from '@/platforms/platforms';
import { useApp } from '@/state/AppState';
import type { StoredItem } from '@/store/progressStore';
import { allowKind, isMovable, openLimits, startMove, togglePick } from '@/state/flows';
import { timeLeft } from '@/move/pacer';
import { needAccess, pickedCounter, strings, summary, timeLeftText } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';
import { AccessNote } from '@/ui/AccessNote';
import { ItemRow, ROW_HEIGHT } from '@/ui/ItemRow';
import { LimitNote } from '@/ui/LimitNote';

type Row =
  | { item: StoredItem }
  | { heading: string; key: string; kind: string; locked: boolean; count: number; pickable: string[]; allPicked: boolean };

const LOCKED_HEIGHT = 130;
const heightOf = (r: Row) => ('item' in r ? ROW_HEIGHT : r.locked ? LOCKED_HEIGHT : ROW_HEIGHT);

export function PickStep() {
  const { state, dispatch } = useApp();
  const { items, moveState } = state;
  const words = driverFor(state.platform!).words;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  // Collapsed kinds. Not saved: every section is open each time Pick opens (FR-GH-023).
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggleKind = (kind: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(kind)) next.add(kind);
      return next;
    });

  const driver = driverFor(state.platform!);
  const platformName = PLATFORMS.find((p) => p.id === state.platform)?.name ?? '';
  const learnMore = (url: string) =>
    void openLimits(url).then((ok) => {
      if (!ok) dispatch({ type: 'setNotice', notice: strings.couldntOpenPage });
    });
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
  // A kind the new account has no access for is greyed out with an Allow button (FR-GH-020).
  const noAccess = (kind: string) => !!state.newAccount && !state.granted.includes(kind);
  const kinds = driver.kinds.filter((k) => shown.some((c) => c.kind === k.id));
  const rows: Row[] =
    kinds.length < 2 && !kinds.some((k) => noAccess(k.id))
      ? shown.map((item) => ({ item }))
      : kinds.flatMap((k) => {
          const inKind = shown.filter((c) => c.kind === k.id);
          // A search shows every section that has a match (FR-GH-023).
          const hidden = !query && collapsed.has(k.id);
          // The section's own All covers the same rows as the list's All, for this kind only (FR-GH-024).
          const canPick = inKind.filter((c) => c.status !== 'already_there' && c.status !== 'moved');
          return [
            {
              heading: k.heading,
              key: `h:${k.id}`,
              kind: k.id,
              locked: noAccess(k.id),
              count: inKind.length,
              pickable: canPick.map((c) => c.itemId),
              allPicked: canPick.length > 0 && canPick.every((c) => c.picked),
            },
            ...(hidden ? [] : inKind.map((item) => ({ item }))),
          ];
        });
  const isOpen = (kind: string) => !!query || !collapsed.has(kind);
  const offsets = rows.reduce<number[]>((acc, r, i) => [...acc, (acc[i] ?? 0) + heightOf(r)], [0]);
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
        getItemLayout={(_, i) => ({ length: rows[i] ? heightOf(rows[i]) : ROW_HEIGHT, offset: offsets[i] ?? 0, index: i })}
        renderItem={({ item: r }) =>
          'item' in r ? (
            <ItemRow item={r.item} laterLabel={words.later} greyed={noAccess(r.item.kind)} onToggle={onToggle} />
          ) : (
            <View style={r.locked ? styles.lockedSection : styles.sectionBox}>
              <View style={styles.sectionLine}>
                <Pressable
                  style={styles.sectionRow}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.heading}, ${r.count}`}
                  accessibilityState={{ expanded: isOpen(r.kind) }}
                  onPress={() => toggleKind(r.kind)}
                >
                  <Ionicons name={isOpen(r.kind) ? 'chevron-down' : 'chevron-forward'} size={20} color={colors.text} />
                  <Text style={styles.section}>{r.heading}</Text>
                  <Text style={styles.sectionCount}>{r.count}</Text>
                </Pressable>
                {!r.locked && r.pickable.length > 0 && (
                  <Pressable
                    style={styles.sectionAll}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${strings.all} ${r.heading}`}
                    accessibilityState={{ checked: r.allPicked }}
                    onPress={() => void togglePick(state, dispatch, r.pickable, !r.allPicked)}
                  >
                    <Text style={styles.sectionCount}>{strings.all}</Text>
                    <Ionicons name={r.allPicked ? 'checkbox' : 'square-outline'} size={24} color={colors.primary} />
                  </Pressable>
                )}
              </View>
              {r.locked && (
                <>
                  <Text style={styles.lockedText}>{needAccess(r.heading)}</Text>
                  <Pressable
                    style={styles.allow}
                    accessibilityRole="button"
                    accessibilityLabel={`${strings.allow} ${r.heading}`}
                    onPress={() => void allowKind(state, dispatch, r.kind)}
                  >
                    <Ionicons name="key-outline" size={18} color={colors.text} />
                    <Text style={styles.allowText}>{strings.allow}</Text>
                  </Pressable>
                </>
              )}
            </View>
          )
        }
        ListEmptyComponent={<Text style={styles.empty}>{words.noItems}</Text>}
      />
      <View style={styles.bar}>
        {driver.pace && !moving && !showSummary && movable > 0 && (
          <Text style={styles.timeLeft}>{timeLeftText(timeLeft(adds), adds)}</Text>
        )}
        {showSummary && <Text style={styles.summary}>{summary(counts)}</Text>}
        {moveState === 'limit' && <LimitNote driver={driver} name={platformName} onLearnMore={learnMore} />}
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
    sectionBox: { height: ROW_HEIGHT, justifyContent: 'center' },
    lockedSection: { height: LOCKED_HEIGHT, justifyContent: 'center', gap: 6, opacity: 1 },
    sectionLine: { flexDirection: 'row', alignItems: 'center' },
    sectionRow: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 },
    sectionAll: { minHeight: 48, minWidth: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 12 },
    // The same text style as the section headings on Home.
    section: { color: c.text, fontSize: 18, fontWeight: '600' },
    sectionCount: { fontSize: 13, color: c.muted },
    lockedText: { paddingHorizontal: 14, fontSize: 13, color: c.text },
    allow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginHorizontal: 14, padding: 8, borderWidth: 1, borderColor: c.border, borderRadius: 8 },
    allowText: { fontSize: 13, color: c.text },
    counter: { fontSize: 13, color: c.muted },
    locked: { alignItems: 'center', padding: 32, gap: 8 },
    empty: { padding: 24, textAlign: 'center', color: c.muted },
    bar: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    summary: { fontSize: 14, marginBottom: 8, color: c.success },
    timeLeft: { fontSize: 13, color: c.muted, marginBottom: 8 },
    error: { fontSize: 13, color: c.danger, marginBottom: 8 },
    move: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 8, backgroundColor: c.primary },
    moveText: { color: c.onPrimary, fontSize: 15 },
    off: { opacity: 0.5 },
  });
