export const SchedulableTriggerInputTypes = { DATE: 'date' };
export const setNotificationHandler = jest.fn();
export const getPermissionsAsync = jest.fn(async () => ({ granted: false, canAskAgain: true }));
export const requestPermissionsAsync = jest.fn(async () => ({ granted: true }));
export const scheduleNotificationAsync = jest.fn(async () => 'notification-id');
export const cancelScheduledNotificationAsync = jest.fn(async () => undefined);
export const getAllScheduledNotificationsAsync = jest.fn(async () => []);
export const addNotificationResponseReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
export const getLastNotificationResponseAsync = jest.fn(async () => null);
