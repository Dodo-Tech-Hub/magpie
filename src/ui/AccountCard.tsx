import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Words } from '@/platforms/driver';
import type { AccountInfo } from '@/store/progressStore';
import * as Clipboard from 'expo-clipboard';
import { codeLabel, strings } from '@/strings';
import { useTheme, type Colors } from '@/theme/theme';
import { TOUCH_TARGET } from '@/ui/layout';

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  title: string;
  words: Words;
  hint: string;
  account: AccountInfo | null;
  // handle: what the user typed, when the platform asks for a handle (handleInput).
  onSignIn: (handle?: string) => void;
  // The platform asks for the account's handle in a box above the sign-in button.
  handleInput?: boolean;
  // The box may be left empty.
  handleOptional?: boolean;
  // The signed-in button says this instead of Switch or Sign out (the old account holds no sign-in).
  changeLabel?: string;
  // The code a sign-in is waiting on. Shown in place of the Sign in button.
  code?: { code: string; hint: string | null } | null;
  onCancel?: () => void;
  // The Switch button signs out instead (the platform cannot switch in place).
  signsOut?: boolean;
  onSwitch?: () => void;
  disabled?: boolean;
};

export function AccountCard({ title, words, hint, account, onSignIn, handleInput, handleOptional, changeLabel, code, onCancel, signsOut, onSwitch, disabled }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Kept here, so the text survives a notice, a fold, or a rotation.
  const [handle, setHandle] = useState('');
  const empty = handleInput && !handleOptional && handle.trim() === '';
  const signIn = () => !empty && onSignIn(handleInput ? handle : undefined);
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
          accessibilityLabel={`${changeLabel ?? (signsOut ? strings.signOut : strings.switchAccount)} ${title}`}
          accessibilityState={{ disabled: !!disabled }}
          disabled={disabled}
          onPress={onSwitch ?? (() => onSignIn())}
        >
          <Ionicons name={changeLabel ? 'create-outline' : signsOut ? 'log-out-outline' : 'swap-horizontal'} size={18} color={colors.text} />
          <Text style={styles.buttonText}>{changeLabel ?? (signsOut ? strings.signOut : strings.switchAccount)}</Text>
        </Pressable>
      </View>
    );
  }
  if (code) {
    return (
      <View style={styles.card}>
        <View style={styles.flex}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.code} accessibilityLabel={codeLabel(code.code)}>
            {code.code}
          </Text>
          {code.hint && <Text style={styles.hint}>{code.hint}</Text>}
          <Text style={styles.hint}>{strings.waitingForYou}</Text>
          <View style={styles.codeButtons}>
            <Pressable
              style={styles.button}
              accessibilityRole="button"
              accessibilityLabel={strings.copyCode}
              onPress={() => void Clipboard.setStringAsync(code.code)}
            >
              <Ionicons name="copy-outline" size={18} color={colors.text} />
              <Text style={styles.buttonText}>{strings.copyCode}</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              accessibilityRole="button"
              accessibilityLabel={strings.cancel}
              onPress={onCancel}
            >
              <Ionicons name="close-outline" size={18} color={colors.text} />
              <Text style={styles.buttonText}>{strings.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <View style={styles.flex}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
        {handleInput && (
          <TextInput
            style={styles.input}
            value={handle}
            onChangeText={setHandle}
            onSubmitEditing={signIn}
            editable={!disabled}
            placeholder={words.handlePlaceholder}
            placeholderTextColor={colors.muted}
            accessibilityLabel={words.handleLabel}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
          />
        )}
        <Pressable
          style={[styles.signIn, (disabled || empty) && styles.off]}
          accessibilityRole="button"
          accessibilityLabel={`${words.signIn}: ${title}`}
          accessibilityState={{ disabled: !!(disabled || empty) }}
          disabled={disabled || empty}
          onPress={signIn}
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
    button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8, minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET, borderWidth: 1, borderColor: c.border, borderRadius: 8 },
    buttonText: { fontSize: 13, color: c.text },
    signIn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, minHeight: TOUCH_TARGET, paddingVertical: 8, borderRadius: 8, backgroundColor: c.primary },
    signInText: { color: c.onPrimary, fontSize: 15 },
    off: { opacity: 0.4 },
    input: { marginTop: 10, minHeight: TOUCH_TARGET, paddingHorizontal: 10, borderWidth: 1, borderColor: c.border, borderRadius: 8, fontSize: 15, color: c.text },
    code: { fontSize: 32, fontWeight: '600', letterSpacing: 2, color: c.text, marginTop: 8 },
    codeButtons: { flexDirection: 'row', gap: 8, marginTop: 10 },
  });
