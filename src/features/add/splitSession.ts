import { Category } from '@/types';
import { DraftPart } from './splitDraft';

/**
 * Hands a split between Add and the split page (app/split.tsx), in memory:
 * the parts are too much for a URL, and nothing here needs to outlive the
 * two screens. Add opens a session and pushes the page; the page's Done
 * leaves a result that Add takes when it's back in focus. Leaving the page
 * any other way (back) leaves no result, so Add stays as it was.
 */
export interface SplitSession {
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
