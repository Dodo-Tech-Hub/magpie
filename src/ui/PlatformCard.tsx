import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Platform } from '@/platforms/platforms';
import { continueLabel, continueLeft } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';

type Props = {
  platform: Platform;
  // Total left across unfinished progresses. 0 or missing hides the note.
  left?: number;
  onOpen: () => void;
  onContinue: () => void;
};

// The card body and the Continue note are two separate tap targets (FR-016).
export function PlatformCard({ platform, left = 0, onOpen, onContinue }: Props) {
  const { colors, look } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <View style={styles.card}>
      <Pressable
        style={styles.body}
        accessibilityRole="button"
        accessibilityLabel={platform.name}
        onPress={onOpen}
      >
        {!logoFailed && (
          <Image
            source={look === 'dark' && platform.logoDark ? platform.logoDark : platform.logo}
            testID={`logo-${platform.id}`}
            style={styles.logo}
            resizeMode="contain"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onError={() => setLogoFailed(true)}
          />
        )}
        <Text style={styles.name} numberOfLines={2}>
          {platform.name}
        </Text>
      </Pressable>
      {left > 0 && (
        <Pressable
          style={styles.note}
          accessibilityRole="button"
          accessibilityLabel={continueLabel(platform.name, left)}
          onPress={onContinue}
        >
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={styles.noteText}>{continueLeft(left)}</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 12, overflow: 'hidden' },
    body: { padding: 12, minHeight: 48, alignItems: 'center' },
    logo: { width: 48, height: 41, marginBottom: 8 },
    name: { color: c.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
    note: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 48,
      paddingHorizontal: 12,
      backgroundColor: c.primarySoft,
    },
    noteText: { color: c.text, fontSize: 13, flexShrink: 1 },
  });
