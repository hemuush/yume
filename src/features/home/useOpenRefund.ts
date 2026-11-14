import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { showAlert } from '@/components/AppDialog';
import { getTransactionById } from '@/db/transactions';
import { errorMessage } from '@/lib/errorMessage';
import type { HomeSheets } from './homeSheetsStore';

/**
 * Opening the purchase behind a pending refund (Coming up): one at a time, and only the newest request may open it.
 * `opening` is the id being fetched, for the row's spinner. Leaving Home, or opening anything else first, cancels it.
 */
export function useOpenRefund(sheets: HomeSheets) {
  const [opening, setOpening] = useState<string | null>(null);
  const request = useRef(0);
  const busy = useRef(false);
  const cancel = useCallback(() => {
    request.current++;
    busy.current = false;
    setOpening(null);
  }, []);
  // Leaving Home drops a request still in flight.
  useFocusEffect(useCallback(() => cancel, [cancel]));

  const open = useCallback(
    async (transactionId: string) => {
      if (busy.current) return;
      busy.current = true;
      const ticket = ++request.current;
      setOpening(transactionId);
      try {
        const tx = await getTransactionById(transactionId);
        if (ticket !== request.current) return;
        if (!tx) {
          showAlert(
            'Purchase unavailable',
            'This purchase may have been deleted. Refresh Home and try again.'
          );
          return;
        }
        sheets.openEntry(tx);
      } catch (e) {
        if (ticket === request.current) showAlert('Couldn’t open the refund', errorMessage(e));
      } finally {
        if (ticket === request.current) {
          busy.current = false;
          setOpening(null);
        }
      }
    },
    [sheets]
  );

  return { opening, open, cancel };
}
