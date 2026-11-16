import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getSetting, setSetting } from '@/store/progressStore';
import { strings } from '@/strings';

const idFor = (progressId: string) => `progress-${progressId}`;

export function initReminders(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// Asked only once, the first time a limit is hit (FR-028).
// The platform's reason comes first, so the user knows why the move stopped (spec 009, FR-001).
// Our own question comes before the phone's permission box so that box makes sense.
export async function askOnce(reason: string): Promise<boolean> {
  if (await getSetting('reminderAsked')) return (await Notifications.getPermissionsAsync()).granted;
  await setSetting('reminderAsked', '1');
  const wants = await new Promise<boolean>((resolve) =>
    Alert.alert(
      strings.reminderTitle,
      `${reason}\n\n${strings.reminderAsk}`,
      [
        { text: strings.no, style: 'cancel', onPress: () => resolve(false) },
        { text: strings.yes, onPress: () => resolve(true) },
      ],
      { onDismiss: () => resolve(false) },
    ),
  );
  if (!wants) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

// The reminder carries only the progress ID; everything else is looked up on the phone.
export async function scheduleReminder(progressId: string, at: Date, body: string): Promise<void> {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: idFor(progressId),
    content: { title: strings.reminderTitle, body, data: { progressId } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

export async function cancelReminder(progressId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(idFor(progressId));
}

const idFrom = (data: unknown): string | null => {
  const v = (data as { progressId?: unknown } | null)?.progressId;
  return typeof v === 'string' ? v : null;
};

// Calls back with the progress ID when the user taps a reminder (app open or closed).
export function onReminderTapped(cb: (progressId: string) => void): () => void {
  void Notifications.getLastNotificationResponseAsync().then((r) => {
    const id = idFrom(r?.notification.request.content.data);
    if (id) cb(id);
  });
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const id = idFrom(r.notification.request.content.data);
    if (id) cb(id);
  });
  return () => sub.remove();
}
