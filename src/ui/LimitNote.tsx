import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Driver } from '@/platforms/driver';
import { learnMoreLabel, strings } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';

type Props = { driver: Driver; name: string; onLearnMore: (url: string) => void };

// Why the move stopped, on Pick: the platform's one reason sentence and, if it has one, a link to its limits page (spec 009, FR-004, FR-014).
export function LimitNote({ driver, name, onLearnMore }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const url = driver.limitsUrl;
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{driver.words.limitReached}</Text>
      {url && (
        <Pressable
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={learnMoreLabel(name)}
          onPress={() => onLearnMore(url)}
        >
          <Ionicons name="open-outline" size={18} color={colors.text} />
          <Text style={styles.buttonText}>{strings.learnMore}</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    box: { gap: 4, marginBottom: 8 },
    text: { fontSize: 13, color: c.warning },
    button: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 48, minWidth: 48 },
    buttonText: { fontSize: 13, color: c.text, textDecorationLine: 'underline' },
  });
