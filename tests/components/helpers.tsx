import React from 'react';
import type { AlertButton } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../../App';
import { GoogleSignin, mockUser, signInAs } from '../mocks/googleSignin';
import { listMySubscriptions, subscribe } from '@/api/youtube';
import { closeStore } from '@/store/progressStore';

export const listMock = listMySubscriptions as jest.Mock;
export const subMock = subscribe as jest.Mock;
export const ch = (id: string, title = id) => ({ channelId: id, title, thumbnailUrl: null });

export const OLD = mockUser('old-id', 'old.me@gmail.com');
export const NEW = mockUser('new-id', 'new.me@gmail.com');

export async function resetWorld() {
  jest.clearAllMocks();
  listMock.mockReset();
  subMock.mockReset();
  subMock.mockResolvedValue({ kind: 'moved' });
  GoogleSignin.getCurrentUser.mockReturnValue({ user: { id: NEW.id } });
  await closeStore();
}

// Queue the next Google sign-in result for the old or the new account.
export const nextSignIn = (who: 'old' | 'new') => signInAs(who === 'old' ? OLD : NEW);

// Make Alert.alert press the button with this text right away.
export const answerAlert = (spy: jest.SpyInstance, text: string) =>
  spy.mockImplementation((_t: unknown, _m: unknown, buttons?: unknown) =>
    (buttons as AlertButton[] | undefined)?.find((b) => b.text === text)?.onPress?.(),
  );

// Render the app and open the YouTube flow, so tests start where they did before Home existed.
export async function renderApp() {
  const view = await render(<App />);
  await fireEvent.press(await screen.findByLabelText('YouTube. We move them for you'));
  return view;
}
