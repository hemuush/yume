import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { getHideSensitiveAmounts, getCachedHideSensitiveAmounts } from '@/db/settings';
import { saveHideSensitiveAmounts } from '@/db/afterCommit';
import { onSettingsRestored } from '@/lib/dataEvents';
import { useAppLock } from '@/lib/AppLockContext';
import { authenticate } from '@/lib/appLock';
import { showAlert } from '@/components/AppDialog';
import { showPrivacyReminderWarning } from '@/lib/privacyReminderFeedback';

interface PrivacyContextValue {
  hideAmounts: boolean;
  toggleHideAmounts: () => void | Promise<void>;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  hideAmounts: getCachedHideSensitiveAmounts(),
  toggleHideAmounts: () => {},
});

/**
 * One global switch masking amounts tagged `isSensitive` (Savings Deposit/Investments by default, or any
 * category the user opts in), so the phone can be handed over unseen. Other amounts are never touched.
 */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hideAmounts, setHideAmountsState] = useState(getCachedHideSensitiveAmounts());
  // The latest value, readable synchronously: the toggle needs "what is it now" to compute the next value
  // and write it, which a setState updater must not do (updaters have to be pure; StrictMode runs them twice).
  const hideRef = useRef(hideAmounts);
  const generation = useRef(0);
  const authenticating = useRef(false);

  const apply = useCallback((next: boolean) => {
    hideRef.current = next;
    setHideAmountsState(next);
  }, []);

  useEffect(() => {
    // Same reasoning as AccentContext: falls back to the cached default
    // already seeded above rather than leaving an unhandled rejection.
    const read = () => {
      const call = ++generation.current;
      return getHideSensitiveAmounts()
        .then((next) => {
          if (call === generation.current) apply(next);
        })
        .catch(() => {});
    };
    void read();
    const unsubscribe = onSettingsRestored(() => void read());
    return () => {
      generation.current += 1;
      unsubscribe();
    };
  }, [apply]);

  const { lockEnabled } = useAppLock();
  const toggleHideAmounts = useCallback(async () => {
    if (authenticating.current) return;
    const next = !hideRef.current;
    const call = ++generation.current;
    // Showing hidden amounts again takes the phone's own unlock when the app lock is on: the point of hiding
    // them is handing the phone over, and whoever holds it shouldn't be one tap from seeing them.
    if (!next && lockEnabled) {
      authenticating.current = true;
      let ok = false;
      try {
        ok = await authenticate();
      } catch {
        // A failed or cancelled unlock keeps amounts hidden.
      } finally {
        authenticating.current = false;
      }
      if (!ok || call !== generation.current) return;
    }
    apply(next);
    try {
      if ((await saveHideSensitiveAmounts(next)) === false) showPrivacyReminderWarning();
    } catch {
      // Keep the switch usable this session, but don't imply persisted preferences or queued alerts changed.
      showAlert(
        'Privacy preference not saved',
        'The switch applies for this session. Saved preferences and scheduled reminders could not be updated.'
      );
    }
  }, [apply, lockEnabled]);

  const value = useMemo(() => ({ hideAmounts, toggleHideAmounts }), [hideAmounts, toggleHideAmounts]);

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy(): PrivacyContextValue {
  return useContext(PrivacyContext);
}
