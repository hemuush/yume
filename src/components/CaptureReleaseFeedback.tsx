import { useEffect } from 'react';
import { showAlert } from '@/components/AppDialog';
import type { ScreenCaptureProtection } from '@/lib/useScreenCaptureProtection';

/** Reports release failures only beside the unlocked dialog host, without claiming screenshots are enabled. */
export function CaptureReleaseFeedback({ protection }: { protection: ScreenCaptureProtection }): null {
  const { isRequired, errorAttempt, retry } = protection;
  useEffect(() => {
    if (!isRequired && errorAttempt !== null) {
      showAlert(
        'Screenshot setting not updated',
        'Android couldn’t update screenshot settings. Try again to apply your choice.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Try again', onPress: retry },
        ]
      );
    }
  }, [isRequired, errorAttempt, retry]);
  return null;
}
