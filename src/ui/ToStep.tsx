import React from 'react';
import { Text, View } from 'react-native';
import { signInNew } from '@/state/flows';
import { driverFor } from '@/platforms/platforms';
import { useApp } from '@/state/AppState';
import { strings } from '@/strings';
import { useTheme } from '@/theme/theme';
import { AccountCard } from '@/ui/AccountCard';

export function ToStep() {
  const { state, dispatch } = useApp();
  const { colors } = useTheme();
  const driver = driverFor(state.platform!);
  return (
    <View>
      <AccountCard
        title={strings.newTitle}
        words={driver.words}
        hint={driver.words.newHint}
        account={state.newAccount}
        disabled={state.moveState === 'moving'}
        onSignIn={() => void signInNew(state, dispatch)}
      />
      {state.notice && <Text style={{ color: colors.danger, paddingHorizontal: 14 }}>{state.notice}</Text>}
    </View>
  );
}
