import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initReminders, onReminderTapped } from '@/reminders/reminder';
import { AppStateProvider, useApp } from '@/state/AppState';
import { openProgress } from '@/state/flows';
import { initStore } from '@/store/progressStore';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { HomeBar } from '@/ui/HomeBar';
import { HomeView } from '@/ui/HomeView';
import { layout } from '@/ui/layout';
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
  // Android back: close Settings, else go Home, else let the system handle it (FR-010).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (state.settingsOpen) dispatch({ type: 'closeSettings' });
      else if (state.platform !== null) dispatch({ type: 'goHome' });
      else return false;
      return true;
    });
    return () => sub.remove();
  }, [state.settingsOpen, state.platform, dispatch]);
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]} testID="root">
      {state.platform === null ? <HomeBar /> : <TopBar />}
      <View style={layout.column} testID="body">
        {state.settingsOpen && <SettingsView />}
        {!state.settingsOpen && state.platform === null && <HomeView />}
        {!state.settingsOpen && state.platform !== null && state.step === 'from' && <FromStep />}
        {!state.settingsOpen && state.platform !== null && state.step === 'pick' && <PickStep />}
        {!state.settingsOpen && state.platform !== null && state.step === 'to' && <ToStep />}
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
