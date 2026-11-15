import React, { memo, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Status, StoredItem } from '@/store/progressStore';
import { strings } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';

export const ROW_HEIGHT = 56;

const TAGS: Partial<Record<Status, { text: string; icon: keyof typeof Ionicons.glyphMap; color: keyof Colors }>> = {
  moving: { text: strings.moving, icon: 'time-outline', color: 'muted' },
  moved: { text: strings.moved, icon: 'checkmark', color: 'success' },
  already_there: { text: strings.alreadyThere, icon: 'checkmark', color: 'success' },
  couldnt_move: { text: strings.couldntMove, icon: 'alert-circle-outline', color: 'danger' },
};

// The text of the later row comes from the platform: "Tomorrow" for YouTube.
type Props = { item: StoredItem; laterLabel: string; onToggle: (id: string, picked: boolean) => void };

function Row({ item, laterLabel, onToggle }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tag =
    item.status === 'later'
      ? { text: laterLabel, icon: 'pause-outline' as const, color: 'warning' as const }
      : TAGS[item.status];
  const locked = item.status === 'already_there' || item.status === 'moved';
  return (
    <Pressable
      style={styles.row}
      accessibilityRole="checkbox"
      accessibilityLabel={item.title}
      accessibilityState={{ checked: item.picked, disabled: locked }}
      disabled={locked}
      onPress={() => onToggle(item.itemId, !item.picked)}
    >
      <Ionicons
        name={item.picked ? 'checkbox' : 'square-outline'}
        size={24}
        color={locked ? colors.disabled : colors.primary}
      />
      {item.thumbnailUrl ? (
        <Image source={{ uri: item.thumbnailUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.fallback]}>
          <Text style={styles.name}>{item.title[0]?.toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={1}>
          {item.title}
        </Text>
        {!!item.reason && (
          <Text style={styles.reason} numberOfLines={1}>
            {item.reason}
          </Text>
        )}
      </View>
      {tag && (
        <View style={styles.tag}>
          <Ionicons name={tag.icon} size={14} color={colors[tag.color]} />
          <Text style={[styles.tagText, { color: colors[tag.color] }]}>{tag.text}</Text>
        </View>
      )}
    </Pressable>
  );
}

export const ItemRow = memo(Row);

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    avatar: { width: 30, height: 30, borderRadius: 15 },
    fallback: { backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1 },
    name: { fontSize: 15, color: c.text },
    reason: { fontSize: 12, color: c.muted },
    tag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    tagText: { fontSize: 12 },
  });
