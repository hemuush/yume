import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';

export type ScreenCaptureStatus = 'checking' | 'ready' | 'failed';

interface CaptureResult {
  isRequired: boolean;
  attempt: number;
  status: ScreenCaptureStatus;
}

export interface ScreenCaptureProtection {
  isRequired: boolean;
  isBlocked: boolean;
  status: ScreenCaptureStatus;
  errorAttempt: number | null;
  retry: () => void;
}

const CAPTURE_KEY = 'app-lock';
let keySequence = 0;
const heldKeys = new Set<string>();
// Survives guard remounts: a late allow must never undo a newer successful prevent.
let captureQueue: Promise<void> = Promise.resolve();

async function applyProtection(isRequired: boolean): Promise<void> {
  if (isRequired) {
    // Expo caches keys in JS. A fresh key ensures this request actually reaches Android.
    const key = `${CAPTURE_KEY}:${++keySequence}`;
    await preventScreenCaptureAsync(key);
    heldKeys.add(key);
    for (const previous of heldKeys) {
      if (previous === key) continue;
      // The new key still holds protection, so retiring an old key cannot clear FLAG_SECURE.
      await allowScreenCaptureAsync(previous);
      heldKeys.delete(previous);
    }
    return;
  }
  const keys = heldKeys.size > 0 ? [...heldKeys] : [CAPTURE_KEY];
  for (const key of keys) {
    await allowScreenCaptureAsync(key);
    // Keep a rejected release retryable even though Expo already removed its JS key.
    heldKeys.delete(key);
  }
}

/** Confirms capture protection before financial UI mounts; serializes native changes and ignores stale results. */
export function useScreenCaptureProtection(isRequired: boolean): ScreenCaptureProtection {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<CaptureResult>({ isRequired, attempt, status: 'checking' });
  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);
  const status = result.isRequired === isRequired && result.attempt === attempt ? result.status : 'checking';

  useEffect(() => {
    let isCurrent = true;
    setResult({ isRequired, attempt, status: 'checking' });
    captureQueue = captureQueue.then(async () => {
      if (!isCurrent) return;
      try {
        await applyProtection(isRequired);
        if (isCurrent) setResult({ isRequired, attempt, status: 'ready' });
      } catch (error) {
        console.error('Screen capture settings could not be applied:', error);
        if (isCurrent) setResult({ isRequired, attempt, status: 'failed' });
      }
    });
    return () => {
      isCurrent = false;
      // Do not release protection when the guard unmounts; the next lock preference owns that change.
    };
  }, [isRequired, attempt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      // A successful FLAG_SECURE stays on the Activity. Avoid discarding unsaved forms on normal resume.
      if (next === 'active' && status === 'failed') retry();
    });
    return () => subscription.remove();
  }, [status, retry]);

  return {
    isRequired,
    isBlocked: isRequired && status !== 'ready',
    status,
    errorAttempt: status === 'failed' ? attempt : null,
    retry,
  };
}
