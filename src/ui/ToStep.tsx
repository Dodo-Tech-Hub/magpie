import React from 'react';
import { Text, View } from 'react-native';
import { signInNew } from '@/state/flows';
import { useApp } from '@/state/AppState';
import { strings } from '@/strings';
import { AccountCard } from '@/ui/AccountCard';

export function ToStep() {
  const { state, dispatch } = useApp();
  return (
    <View>
      <AccountCard
        title={strings.newTitle}
        hint={strings.newHint}
        account={state.newAccount}
        disabled={state.moveState === 'moving'}
        onSignIn={() => void signInNew(state, dispatch)}
      />
      {state.notice && <Text style={{ color: '#b3261e', paddingHorizontal: 14 }}>{state.notice}</Text>}
    </View>
  );
}
