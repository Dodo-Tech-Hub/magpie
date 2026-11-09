import React from 'react';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../../App';
import { answerAlert, ch, listMock, nextSignIn, resetWorld, subMock } from './helpers';

jest.mock('@/api/youtube', () => ({
  ...jest.requireActual('@/api/youtube'),
  listMySubscriptions: jest.fn(),
  subscribe: jest.fn(),
}));

const scheduled = Notifications.scheduleNotificationAsync as jest.Mock;
const permission = Notifications.getPermissionsAsync as jest.Mock;
const request = Notifications.requestPermissionsAsync as jest.Mock;

let alertSpy: jest.SpyInstance;
const answer = (text: 'Yes' | 'No') => answerAlert(alertSpy, text);

beforeEach(async () => {
  await resetWorld();
  alertSpy = jest.spyOn(Alert, 'alert');
  answer('Yes');
  permission.mockResolvedValue({ granted: false, canAskAgain: true });
  request.mockImplementation(async () => {
    permission.mockResolvedValue({ granted: true, canAskAgain: true });
    return { granted: true };
  });
});

async function hitLimitAfterOne() {
  subMock
    .mockResolvedValueOnce({ kind: 'moved' })
    .mockResolvedValueOnce({ kind: 'tomorrow' });
  listMock
    .mockResolvedValueOnce([ch('a', 'Alpha'), ch('b', 'Beta'), ch('c', 'Gamma')])
    .mockResolvedValueOnce([]);
  await render(<App />);
  nextSignIn('old');
  await fireEvent.press(screen.getByLabelText('Sign in with Google: Old account'));
  await screen.findByLabelText('Alpha');
  await fireEvent.press(screen.getByRole('tab', { name: 'To' }));
  nextSignIn('new');
  await fireEvent.press(screen.getByLabelText('Sign in with Google: New account'));
  await fireEvent.press(await screen.findByLabelText('Move 3 channels'));
  await screen.findByText(/Daily limit reached/);
}

describe('daily limit', () => {
  it('turns the rest into Tomorrow and shows the limit message and Continue', async () => {
    await hitLimitAfterOne();
    expect(screen.getByText("Daily limit reached. We'll remind you when you can move the rest.")).toBeTruthy();
    expect(screen.getAllByText('Tomorrow')).toHaveLength(2);
    expect(screen.getByText('1 moved · 2 waiting')).toBeTruthy();
    expect(screen.getByLabelText('Continue')).toBeTruthy();
  });

  it('asks about reminders and schedules one with only the progress ID', async () => {
    await hitLimitAfterOne();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect(scheduled).toHaveBeenCalledTimes(1);
    const arg = scheduled.mock.calls[0][0];
    expect(Object.keys(arg.content.data)).toEqual(['progressId']);
    expect(arg.trigger.date.getTime()).toBeGreaterThan(Date.now());
  });

  it('does not schedule a reminder when the user says no, and Continue still works', async () => {
    answer('No');
    await hitLimitAfterOne();
    expect(scheduled).not.toHaveBeenCalled();
    subMock.mockResolvedValue({ kind: 'moved' });
    await fireEvent.press(screen.getByLabelText('Continue'));
    expect(await screen.findByText('3 moved')).toBeTruthy();
  });

  it('Continue moves only the channels that are still waiting', async () => {
    await hitLimitAfterOne();
    subMock.mockClear();
    subMock.mockResolvedValue({ kind: 'moved' });
    await fireEvent.press(screen.getByLabelText('Continue'));
    expect(await screen.findByText('3 moved')).toBeTruthy();
    expect(subMock.mock.calls.map((c) => c[1]).sort()).toEqual(['b', 'c']);
  });

  it('asks only the first time the limit is hit', async () => {
    await hitLimitAfterOne();
    subMock.mockResolvedValueOnce({ kind: 'moved' }).mockResolvedValueOnce({ kind: 'tomorrow' });
    await fireEvent.press(screen.getByLabelText('Continue'));
    await screen.findByText('2 moved · 1 waiting');
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('cancels the reminder when the move finishes', async () => {
    await hitLimitAfterOne();
    subMock.mockResolvedValue({ kind: 'moved' });
    await fireEvent.press(screen.getByLabelText('Continue'));
    await screen.findByText('3 moved');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalled();
  });
});
