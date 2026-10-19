import { showAlert } from '@/components/AppDialog';

/** The preference/category is already saved; this warning must never invite a duplicate save. */
export function showPrivacyReminderWarning(): void {
  showAlert(
    'Reminders need attention',
    'Your change was saved, but scheduled reminders could not be refreshed. Existing reminders may still show private details. Reopen Yume to retry.'
  );
}
