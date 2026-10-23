import { useEffect } from 'react';
import { showAlert } from '@/components/AppDialog';
import { useAccent } from './AccentContext';

/** Mounted once beside the unlocked dialog host, so an off-screen picker failure is still visible. */
export function ThemeSaveFeedback() {
  const { themeSaveError } = useAccent();
  useEffect(() => {
    if (themeSaveError) showAlert('Theme not saved', themeSaveError.message);
  }, [themeSaveError]);
  return null;
}
