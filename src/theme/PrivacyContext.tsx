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
import {
  getHideSensitiveAmounts,
  setHideSensitiveAmounts,
  getCachedHideSensitiveAmounts,
} from '@/db/settings';
import { onSettingsRestored } from '@/lib/dataEvents';

interface PrivacyContextValue {
  hideAmounts: boolean;
  toggleHideAmounts: () => void;
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

  const apply = useCallback((next: boolean) => {
    hideRef.current = next;
    setHideAmountsState(next);
  }, []);

  useEffect(() => {
    // Same reasoning as AccentContext: falls back to the cached default
    // already seeded above rather than leaving an unhandled rejection.
    const read = () =>
      getHideSensitiveAmounts()
        .then(apply)
        .catch(() => {});
    void read();
    // A restore brings back the backup's setting.
    return onSettingsRestored(() => void read());
  }, [apply]);

  const toggleHideAmounts = useCallback(() => {
    const next = !hideRef.current;
    apply(next);
    // A failed write only costs the preference on the next launch; the switch still works this session.
    Promise.resolve(setHideSensitiveAmounts(next)).catch(() => {});
  }, [apply]);

  const value = useMemo(() => ({ hideAmounts, toggleHideAmounts }), [hideAmounts, toggleHideAmounts]);

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy(): PrivacyContextValue {
  return useContext(PrivacyContext);
}
