import React from 'react';
import { Text, View } from 'react-native';
import { cancelSignIn, switchAccount, signInNew } from '@/state/flows';
import { driverFor } from '@/platforms/platforms';
import { useApp } from '@/state/AppState';
import { strings } from '@/strings';
import { useTheme } from '@/theme/theme';
import { AccessNote } from '@/ui/AccessNote';
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
        disabled={state.moveState === 'moving' || state.signingIn}
        onSignIn={(handle) => void signInNew(state, dispatch, handle)}
        handleInput={driver.handleInput}
        code={state.signInCode?.role === 'new' ? state.signInCode : null}
        onCancel={cancelSignIn}
        signsOut={driver.switchSignsOut}
        onSwitch={() => void switchAccount(state, dispatch, 'new')}
      />
      {state.signingIn && !state.signInCode && <Text style={{ color: colors.muted, paddingHorizontal: 14 }}>{strings.signingIn}</Text>}
      {state.accessEnded && !state.newAccount && <AccessNote driver={driver} />}
      {state.notice && state.step === 'to' && <Text style={{ color: colors.danger, paddingHorizontal: 14 }}>{state.notice}</Text>}
    </View>
  );
}
