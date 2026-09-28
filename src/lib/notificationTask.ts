import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { runQuietAction } from './notificationActions';

/**
 * Runs a notification's quiet button ("In 1 hour", "Tomorrow", "Quiet this
 * month") while Yume is closed or in the background — Android starts this
 * task for a button that doesn't open the app. Defined at module scope from
 * index.js, so it exists before Android calls into it; `registerNotificationTask`
 * then ties it to expo-notifications on start-up. A plain tap, or a button
 * that opens the app, never reaches here.
 */
export const NOTIFICATION_TASK = 'yume-notification-actions';

TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data, error }) => {
  if (error || !data || !('actionIdentifier' in data)) return;
  try {
    await runQuietAction(data);
  } catch (e) {
    console.warn('Notification action failed:', e);
  }
});

export function registerNotificationTask(): Promise<void> {
  return Notifications.registerTaskAsync(NOTIFICATION_TASK).then(() => undefined);
}
