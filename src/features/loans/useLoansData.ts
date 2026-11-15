import { useCallback, useEffect, useRef, useState } from 'react';
import { getLoanProgress, listLoans, type LoanProgress } from '@/db/loans';
import { toLocalIsoDate } from '@/lib/date';
import { keepEntriesIfEqual, reuseUnchanged } from '@/lib/stableData';
import { useScreenLoad } from '@/lib/useScreenLoad';
import type { Loan } from '@/types';

interface LoansData {
  loans: Loan[];
  /** Each loan's EMIs paid, next EMI and last EMI, by loan id. */
  progress: Record<string, LoanProgress>;
  /** The day the figures were read: the payoff timeline is measured from it. */
  today: string;
}

const NONE: LoansData = { loans: [], progress: {}, today: '' };

/**
 * What the Loans page reads: the loans and each one's progress, reloaded when the page is shown after a write or on a
 * new day. A loan whose row did not change stays the very same object, so a reload redraws only the cards that changed.
 */
export function useLoansData() {
  const [data, setData] = useState(NONE);
  // What is held, so a reload that found nothing new sets no state at all (React still draws a component once for a
  // state update that changes nothing).
  const held = useRef(NONE);
  // Only the newest load may land, and none after the page is gone: an older read that finishes late would put old
  // loans back over newer ones.
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current += 1;
    },
    []
  );
  const loadLoans = useCallback(async () => {
    const id = ++request.current;
    const [list, rows] = await Promise.all([listLoans(), getLoanProgress()]);
    if (id !== request.current) return;
    const progress = Object.fromEntries(rows.map((p) => [p.loanId, p]));
    const today = toLocalIsoDate(new Date());
    const prev = held.current;
    const loans = reuseUnchanged(prev.loans, list);
    const kept = keepEntriesIfEqual(prev.progress, progress);
    if (loans === prev.loans && kept === prev.progress && today === prev.today) return;
    held.current = { loans, progress: kept, today };
    setData(held.current);
  }, []);
  const { loaded, hasData, loadError, reload } = useScreenLoad(loadLoans);
  return { ...data, loaded, hasData, loadError, reload };
}
