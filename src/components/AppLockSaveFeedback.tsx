import { useEffect } from 'react';
import { showAlert } from '@/components/AppDialog';
import { useAppLock } from '@/lib/AppLockContext';

/** Delivers each lock-save error once, after the protected financial tree's dialog host remounts. */
export function AppLockSaveFeedback(): null {
  const { lockSaveError, acknowledgeLockSaveError } = useAppLock();
  useEffect(() => {
    if (!lockSaveError) return;
    showAlert("Couldn't change the app lock", lockSaveError.message);
    acknowledgeLockSaveError(lockSaveError.attempt);
  }, [lockSaveError, acknowledgeLockSaveError]);
  return null;
}
