import React from 'react';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import App from '../../App';
import { GoogleSignin, mockUser, signInAs } from '../mocks/googleSignin';
import {
  getChannels,
  getOrCreateProgress,
  initStore,
  listUnfinished,
  saveChannels,
  setStatus,
} from '@/store/progressStore';
import { answerAlert, ch, listMock, NEW, nextSignIn, OLD, resetWorld, subMock } from './helpers';

jest.mock('@/api/youtube', () => ({
  ...jest.requireActual('@/api/youtube'),
  listMySubscriptions: jest.fn(),
  subscribe: jest.fn(),
}));

const acct = (u: { id: string; email: string; name: string; photo: string | null }) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  photoUrl: u.photo,
});

async function seed(old = OLD, nu = NEW, ids = ['a', 'b']) {
  await initStore();
  const pid = await getOrCreateProgress(acct(old), acct(nu));
  await saveChannels(pid, ids.map((id) => ({ channelId: id, title: id.toUpperCase(), thumbnailUrl: null })));
  return pid;
}

beforeEach(resetWorld);

describe('saved progresses', () => {
  it('lists unfinished progresses with how many channels are left', async () => {
    await seed();
    await render(<App />);
    expect(await screen.findByLabelText('old.me → new.me · 2 left')).toBeTruthy();
  });

  it('does not list a finished progress', async () => {
    const pid = await seed();
    await setStatus(pid, 'a', 'moved');
    await setStatus(pid, 'b', 'moved');
    await render(<App />);
    await screen.findByLabelText('Sign in with Google: Old account');
    expect(screen.queryByLabelText(/left$/)).toBeNull();
  });

  it('opens a saved progress with the old account from the phone and asks for the exact new account', async () => {
    await seed();
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('old.me → new.me · 2 left'));
    expect(await screen.findByText('Sign in to new.me@gmail.com to keep going.')).toBeTruthy();
    expect(listMock).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('tab', { name: 'From' }));
    expect(screen.getByText('old.me@gmail.com')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    signInAs(mockUser('other-id', 'other@gmail.com'));
    await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
    expect(await screen.findByText('This one needs new.me@gmail.com. Pick that account.')).toBeTruthy();
    listMock.mockResolvedValueOnce([]);
    nextSignIn('new');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
    expect(await screen.findByLabelText('Move 2 channels')).toBeTruthy();
  });

  it('opens the saved progress when the same pair signs in again', async () => {
    const pid = await seed(OLD, NEW, ['a', 'b', 'c']);
    await setStatus(pid, 'a', 'moved');
    listMock
      .mockResolvedValueOnce([ch('a', 'A'), ch('b', 'B'), ch('c', 'C')])
      .mockResolvedValueOnce([]);
    await render(<App />);
    nextSignIn('old');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
    await screen.findByLabelText('B');
    await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
    nextSignIn('new');
    await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
    expect(await screen.findByLabelText('Move 2 channels')).toBeTruthy();
    expect(screen.getByText('Moved')).toBeTruthy();
  });

  it('deletes a saved progress', async () => {
    await seed();
    await render(<App />);
    await fireEvent.press(await screen.findByLabelText('Delete old.me → new.me · 2 left'));
    await act(async () => undefined);
    expect(screen.queryByLabelText('old.me → new.me · 2 left')).toBeNull();
    expect(await listUnfinished()).toEqual([]);
  });

  it('opens the progress when a reminder is tapped and ignores unknown IDs', async () => {
    const pid = await seed();
    const listener = Notifications.addNotificationResponseReceivedListener as jest.Mock;
    await render(<App />);
    const tap = (id: string) =>
      act(async () => listener.mock.calls.at(-1)[0]({ notification: { request: { content: { data: { progressId: id } } } } }));
    await tap('nope');
    expect(screen.queryByText(/Sign in to new.me/)).toBeNull();
    await tap(pid);
    expect(await screen.findByText('Sign in to new.me@gmail.com to keep going.')).toBeTruthy();
  });

  it('delete all removes every progress, cancels reminders and signs out', async () => {
    await seed();
    await seed(mockUser('o2', 'o2@x.com'), mockUser('n2', 'n2@x.com'));
    answerAlert(jest.spyOn(Alert, 'alert'), 'Delete');
    await render(<App />);
    await screen.findByLabelText('old.me → new.me · 2 left');
    await fireEvent.press(screen.getByLabelText('Delete all my data'));
    await act(async () => undefined);
    expect(await listUnfinished()).toEqual([]);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(GoogleSignin.revokeAccess).toHaveBeenCalled();
    expect(subMock).not.toHaveBeenCalled();
    expect(await getChannels('x')).toEqual([]);
  });
});
