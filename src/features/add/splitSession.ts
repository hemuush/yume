import { Category } from '@/types';
import { DraftPart } from './splitDraft';

/**
 * In-memory hand-off between Add and the split page (app/split.tsx): parts are too big for a URL. Done
 * leaves a result Add takes on refocus; leaving any other way (back) leaves none.
 */
interface SplitSession {
  totalMinor: number;
  /** The account's currency, for every amount on the page. */
  currency: string | undefined;
  /** "HDFC Bank · Today · Big Bazaar", under the payment's amount. */
  meta: string;
  /** Expense categories, as Add offers them. */
  categories: Category[];
  parts: DraftPart[];
}

let session: SplitSession | null = null;
let result: DraftPart[] | null = null;

export function openSplitSession(next: SplitSession): void {
  session = next;
  result = null;
}

export function getSplitSession(): SplitSession | null {
  return session;
}

/** Cancelling one editor cannot leave its payment available to a later direct route. */
export function cancelSplitSession(opened: SplitSession): void {
  if (session !== opened) return;
  session = null;
  result = null;
}

/** The page's Done: these parts go back to Add. */
export function finishSplitSession(parts: DraftPart[]): void {
  result = parts;
}

/** What Done left for Add, once; null when the page was left without it. */
export function takeSplitResult(): DraftPart[] | null {
  const taken = result;
  result = null;
  if (taken) session = null;
  return taken;
}
