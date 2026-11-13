import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initReminders, onReminderTapped } from '@/reminders/reminder';
import { AppStateProvider, useApp } from '@/state/AppState';
import { openProgress } from '@/state/flows';
import { initStore } from '@/store/progressStore';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { HomeBar } from '@/ui/HomeBar';
import { HomeView } from '@/ui/HomeView';
import { TopBar } from '@/ui/TopBar';
import { FromStep } from '@/ui/FromStep';
import { PickStep } from '@/ui/PickStep';
import { SettingsView } from '@/ui/SettingsView';
import { ToStep } from '@/ui/ToStep';

function Screen() {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  // Tapping a reminder opens that progress. Unknown IDs are ignored (constitution III.8).
  useEffect(() => onReminderTapped((id) => void openProgress(dispatch, id)), [dispatch]);
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]} testID="root">
      {state.platform === null ? <HomeBar /> : <TopBar />}
      <View style={styles.flex}>
        {state.settingsOpen && <SettingsView />}
        {!state.settingsOpen && state.platform === null && <HomeView />}
        {!state.settingsOpen && state.platform === 'youtube' && state.step === 'from' && <FromStep />}
        {!state.settingsOpen && state.platform === 'youtube' && state.step === 'pick' && <PickStep />}
        {!state.settingsOpen && state.platform === 'youtube' && state.step === 'to' && <ToStep />}
      </View>
    </View>
  );
}

function Shell() {
  const { colors, look } = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <StatusBar style={look === 'dark' ? 'light' : 'dark'} />
      <Screen />
    </SafeAreaView>
  );
}

export default function App() {
  useEffect(() => {
    void initStore();
    initReminders();
  }, []);
  return (
    <ThemeProvider>
      <AppStateProvider>
        <Shell />
      </AppStateProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
