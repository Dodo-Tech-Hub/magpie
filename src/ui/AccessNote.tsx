import React, { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Driver } from '@/platforms/driver';
import { strings } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';
import { TOUCH_TARGET } from '@/ui/layout';

// The token is deleted on the phone but runs out on its own. This points to the page that ends it now (FR-GH-019).
export function AccessNote({ driver }: { driver: Driver }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const url = driver.removeAccessUrl;
  if (!url || !driver.words.accessNote) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{driver.words.accessNote}</Text>
      <Pressable
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel={strings.openAccessPage}
        onPress={() => void Linking.openURL(url)}
      >
        <Ionicons name="open-outline" size={18} color={colors.text} />
        <Text style={styles.buttonText}>{strings.openAccessPage}</Text>
      </Pressable>
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
