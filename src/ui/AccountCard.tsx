import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Words } from '@/platforms/driver';
import type { AccountInfo } from '@/store/progressStore';
import { strings } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  title: string;
  words: Words;
  hint: string;
  account: AccountInfo | null;
  onSignIn: () => void;
  disabled?: boolean;
};

export function AccountCard({ title, words, hint, account, onSignIn, disabled }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (account) {
    return (
      <View style={styles.card}>
        {account.photoUrl ? (
          <Image source={{ uri: account.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.fallback]}>
            <Text style={styles.text}>{account.handle[0].toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.flex}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{account.handle}</Text>
        </View>
        <Pressable
          style={[styles.button, disabled && styles.off]}
          accessibilityRole="button"
          accessibilityLabel={`${strings.switchAccount} ${title}`}
          accessibilityState={{ disabled: !!disabled }}
          disabled={disabled}
          onPress={onSignIn}
        >
          <Ionicons name="swap-horizontal" size={18} color={colors.text} />
          <Text style={styles.buttonText}>{strings.switchAccount}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <View style={styles.flex}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
        <Pressable
          style={[styles.signIn, disabled && styles.off]}
          accessibilityRole="button"
          accessibilityLabel={`${words.signIn}: ${title}`}
          disabled={disabled}
          onPress={onSignIn}
        >
          <Ionicons name={words.signInIcon as IconName} size={18} color={colors.onPrimary} />
          <Text style={styles.signInText}>{words.signIn}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
    flex: { flex: 1 },
    text: { color: c.text },
    title: { fontSize: 15, fontWeight: '500', color: c.text },
    hint: { fontSize: 13, color: c.muted, marginTop: 2 },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    fallback: { backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
    button: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, borderWidth: 1, borderColor: c.border, borderRadius: 8 },
    buttonText: { fontSize: 13, color: c.text },
    signIn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, height: 44, borderRadius: 8, backgroundColor: c.primary },
    signInText: { color: c.onPrimary, fontSize: 15 },
    off: { opacity: 0.4 },
  });
