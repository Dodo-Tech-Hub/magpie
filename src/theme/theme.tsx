import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { getSetting, setSetting } from '@/store/progressStore';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type Look = 'light' | 'dark';

export type Colors = {
  background: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  success: string;
  danger: string;
  warning: string;
  disabled: string;
};

export const palettes: Record<Look, Colors> = {
  light: {
    background: '#ffffff',
    text: '#111111',
    muted: '#555555',
    border: '#cccccc',
    primary: '#1a56db',
    onPrimary: '#ffffff',
    primarySoft: '#e6f1fb',
    success: '#1b7f3b',
    danger: '#b3261e',
    warning: '#a35b00',
    disabled: '#aaaaaa',
  },
  dark: {
    background: '#121212',
    text: '#f2f2f2',
    muted: '#b0b0b0',
    border: '#333333',
    primary: '#6ea0ff',
    onPrimary: '#0b1220',
    primarySoft: '#1c2a44',
    success: '#5fd58a',
    danger: '#ff8a80',
    warning: '#ffb454',
    disabled: '#666666',
  },
};

const KEY = 'themeChoice';

// A saved value we do not know is treated as Auto (constitution III.8).
export function parseChoice(value: string | null): ThemeChoice {
  return value === 'light' || value === 'dark' ? value : 'system';
}

const schemeFor = (choice: ThemeChoice) => (choice === 'system' ? 'auto' : choice);

type Value = {
  colors: Colors;
  look: Look;
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => void;
  // Back to Auto in memory only. Delete all already removed the saved row.
  resetChoice: () => void;
};

const Ctx = createContext<Value | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>('system');
  const [loaded, setLoaded] = useState(false);
  const phone = useColorScheme();

  useEffect(() => {
    let live = true;
    getSetting(KEY)
      .then((v) => parseChoice(v))
      .catch(() => 'system' as const)
      .then((c) => {
        if (!live) return;
        setChoiceState(c);
        setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, []);

  // Forcing the scheme makes native pieces (dialogs, status bar) follow the choice too.
  useEffect(() => {
    if (loaded) Appearance.setColorScheme(schemeFor(choice));
  }, [choice, loaded]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    void setSetting(KEY, next);
  }, []);
  const resetChoice = useCallback(() => setChoiceState('system'), []);

  const look: Look = choice === 'system' ? (phone === 'dark' ? 'dark' : 'light') : choice;
  const value = useMemo(
    () => ({ colors: palettes[look], look, choice, setChoice, resetChoice }),
    [look, choice, setChoice, resetChoice],
  );
  // Draw nothing until the saved choice is known, so there is no flash of the wrong look.
  if (!loaded) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used inside ThemeProvider');
  return v;
}
