import React, { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Driver } from '@/platforms/driver';
import { useTheme, type Colors } from '@/theme/theme';
import { TOUCH_TARGET } from '@/ui/layout';

// The platform could not cancel the access, so it ends on its own. The line says so. With a page where the user
// can end it now, a button opens it (FR-GH-019, FR-BS-013).
export function AccessNote({ driver }: { driver: Driver }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { accessNote, accessButton } = driver.words;
  const url = driver.removeAccessUrl;
  if (!accessNote) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{accessNote}</Text>
      {url && accessButton && (
        <Pressable
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={accessButton}
          onPress={() => void Linking.openURL(url)}
        >
          <Ionicons name="open-outline" size={18} color={colors.text} />
          <Text style={styles.buttonText}>{accessButton}</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    box: { paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
    text: { fontSize: 13, color: c.muted },
    button: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', padding: 8, minHeight: TOUCH_TARGET, borderWidth: 1, borderColor: c.border, borderRadius: 8 },
    buttonText: { fontSize: 13, color: c.text },
  });
