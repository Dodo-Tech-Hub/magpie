import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AccountInfo } from '@/store/progressStore';
import { strings } from '@/strings';

type Props = {
  title: string;
  hint: string;
  account: AccountInfo | null;
  onSignIn: () => void;
  disabled?: boolean;
};

export function AccountCard({ title, hint, account, onSignIn, disabled }: Props) {
  if (account) {
    return (
      <View style={styles.card}>
        {account.photoUrl ? (
          <Image source={{ uri: account.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.fallback]}>
            <Text>{account.email[0].toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.flex}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{account.email}</Text>
        </View>
        <Pressable
          style={[styles.button, disabled && styles.off]}
          accessibilityRole="button"
          accessibilityLabel={`${strings.switchAccount} ${title}`}
          accessibilityState={{ disabled: !!disabled }}
          disabled={disabled}
          onPress={onSignIn}
        >
          <Ionicons name="swap-horizontal" size={18} />
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
          accessibilityLabel={`${strings.signIn}: ${title}`}
          disabled={disabled}
          onPress={onSignIn}
        >
          <Ionicons name="logo-google" size={18} color="#fff" />
          <Text style={styles.signInText}>{strings.signIn}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  flex: { flex: 1 },
  title: { fontSize: 15, fontWeight: '500' },
  hint: { fontSize: 13, color: '#555', marginTop: 2 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  fallback: { backgroundColor: '#e6f1fb', alignItems: 'center', justifyContent: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, borderWidth: 1, borderColor: '#bbb', borderRadius: 8 },
  buttonText: { fontSize: 13 },
  signIn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, height: 44, borderRadius: 8, backgroundColor: '#1a56db' },
  signInText: { color: '#fff', fontSize: 15 },
  off: { opacity: 0.4 },
});
