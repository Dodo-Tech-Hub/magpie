import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initReminders, onReminderTapped } from '@/reminders/reminder';
import { AppStateProvider, useApp } from '@/state/AppState';
import { openProgress } from '@/state/flows';
import { initStore } from '@/store/progressStore';
import { TopBar } from '@/ui/TopBar';
import { FromStep } from '@/ui/FromStep';
import { PickStep } from '@/ui/PickStep';
import { ToStep } from '@/ui/ToStep';

function Screen() {
  const { state, dispatch } = useApp();
  // Tapping a reminder opens that progress. Unknown IDs are ignored (constitution III.8).
  useEffect(() => onReminderTapped((id) => void openProgress(dispatch, id)), [dispatch]);
  return (
    <View style={styles.flex}>
      <TopBar />
      <View style={styles.flex}>
        {state.step === 'from' && <FromStep />}
        {state.step === 'pick' && <PickStep />}
        {state.step === 'to' && <ToStep />}
      </View>
    </View>
  );
}

export default function App() {
  useEffect(() => {
    void initStore();
    initReminders();
  }, []);
  return (
    <AppStateProvider>
      <SafeAreaView style={styles.flex}>
        <StatusBar style="auto" />
        <Screen />
      </SafeAreaView>
    </AppStateProvider>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1, backgroundColor: '#fff' } });
