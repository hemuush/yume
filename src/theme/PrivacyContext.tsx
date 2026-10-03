import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  getHideSensitiveAmounts,
  setHideSensitiveAmounts,
  getCachedHideSensitiveAmounts,
} from '@/db/settings';

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

  useEffect(() => {
    // Same reasoning as AccentContext: falls back to the cached default
    // already seeded above rather than leaving an unhandled rejection.
    getHideSensitiveAmounts()
      .then(setHideAmountsState)
      .catch(() => {});
  }, []);

  const toggleHideAmounts = () => {
    setHideAmountsState((prev) => {
      const next = !prev;
      void setHideSensitiveAmounts(next);
      return next;
    });
  };

  return (
    <PrivacyContext.Provider value={{ hideAmounts, toggleHideAmounts }}>{children}</PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextValue {
  return useContext(PrivacyContext);
}
