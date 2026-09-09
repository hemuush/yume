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
 * One global on/off switch for masking amounts tagged `isSensitive`
 * (Savings Deposit/Investments by default, or any category the user opts
 * in via its own edit screen) — a quick way to hand your phone to someone
 * without them seeing exactly how much you have in savings. Amounts
 * unrelated to a sensitive category are never touched by this.
 */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hideAmounts, setHideAmountsState] = useState(getCachedHideSensitiveAmounts());

  useEffect(() => {
    getHideSensitiveAmounts().then(setHideAmountsState);
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
