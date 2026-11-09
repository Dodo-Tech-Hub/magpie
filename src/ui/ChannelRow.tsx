import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Status, StoredChannel } from '@/store/progressStore';
import { strings } from '@/strings';

export const ROW_HEIGHT = 56;

const TAGS: Partial<Record<Status, { text: string; icon: keyof typeof Ionicons.glyphMap; color: string }>> = {
  moving: { text: strings.moving, icon: 'time-outline', color: '#555' },
  moved: { text: strings.moved, icon: 'checkmark', color: '#1b7f3b' },
  already_there: { text: strings.alreadyThere, icon: 'checkmark', color: '#1b7f3b' },
  tomorrow: { text: strings.tomorrow, icon: 'pause-outline', color: '#a35b00' },
  couldnt_move: { text: strings.couldntMove, icon: 'alert-circle-outline', color: '#b3261e' },
};

type Props = { channel: StoredChannel; onToggle: (id: string, picked: boolean) => void };

function Row({ channel, onToggle }: Props) {
  const tag = TAGS[channel.status];
  const locked = channel.status === 'already_there' || channel.status === 'moved';
  return (
    <Pressable
      style={styles.row}
      accessibilityRole="checkbox"
      accessibilityLabel={channel.title}
      accessibilityState={{ checked: channel.picked, disabled: locked }}
      disabled={locked}
      onPress={() => onToggle(channel.channelId, !channel.picked)}
    >
      <Ionicons
        name={channel.picked ? 'checkbox' : 'square-outline'}
        size={24}
        color={locked ? '#aaa' : '#1a56db'}
      />
      {channel.thumbnailUrl ? (
        <Image source={{ uri: channel.thumbnailUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.fallback]}>
          <Text>{channel.title[0]?.toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {channel.title}
      </Text>
      {tag && (
        <View style={styles.tag}>
          <Ionicons name={tag.icon} size={14} color={tag.color} />
          <Text style={[styles.tagText, { color: tag.color }]}>{tag.text}</Text>
        </View>
      )}
    </Pressable>
  );
}

export const ChannelRow = memo(Row);

const styles = StyleSheet.create({
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  fallback: { backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 15 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tagText: { fontSize: 12 },
});
