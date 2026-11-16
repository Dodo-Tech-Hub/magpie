import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Platform } from '@/platforms/platforms';
import { aboutLimits, continueLabel, continueLeft } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';

type Props = {
  platform: Platform;
  // Total left across unfinished progresses. 0 or missing hides the note.
  left?: number;
  onOpen: () => void;
  onContinue: () => void;
  // Opens the platform's limits page. Missing hides the info button (spec 009, FR-005).
  onInfo?: () => void;
};

// The card body, the Continue note, and the info button are three separate tap targets (FR-016, spec 009 FR-007).
export function PlatformCard({ platform, left = 0, onOpen, onContinue, onInfo }: Props) {
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
      {onInfo && (
        <Pressable
          style={styles.info}
          accessibilityRole="button"
          accessibilityLabel={aboutLimits(platform.name)}
          onPress={onInfo}
        >
          <Ionicons name="information-circle-outline" size={22} color={colors.muted} />
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
    // Top right corner, beside the centered logo; the name sits below it (research R5).
    info: { position: 'absolute', top: 0, right: 0, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  });
