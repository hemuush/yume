import type { EntryType, Staged } from './addEntry';
import type { DraftPart } from './splitDraft';
import type { PaymentMode } from '@/types';
import { isPaymentMode } from '@/lib/paymentMode';
import { assertValidIsoDate } from '@/lib/date';
import { MAX_AMOUNT_MINOR } from '@/lib/amountLimits';

export const ENTRY_DRAFT_KEY = 'entry_draft_v1';
export interface EntryDraft {
  type: EntryType;
  expr: string;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  note: string;
  paymentMode: PaymentMode | null;
  date: string;
  personId: string | null;
  friendSign: 1 | -1;
  friendAccountId: string | null;
  refund: boolean;
  rows: Staged[];
  splitParts: DraftPart[] | null;
}
const text = (v: unknown): v is string => typeof v === 'string' && v.length <= 10000;
const id = (v: unknown) => v === null || (typeof v === 'string' && v.length > 0 && v.length <= 500);
const date = (v: unknown) => {
  try {
    if (typeof v !== 'string') return false;
    assertValidIsoDate(v);
    return true;
  } catch {
    return false;
  }
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const mode = (v: unknown) => v === null || isPaymentMode(v);
const txType = (v: unknown) => v === 'expense' || v === 'income' || v === 'transfer';
/** Recovery is data only. No draft is ever posted without the normal save validation. */
export function parseEntryDraft(raw: string | null): EntryDraft | null {
  if (!raw || raw.length > 2000000) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!object(v) || v.version !== 1 || !object(v.draft)) return null;
    const d = v.draft;
    if (
      !(txType(d.type) || d.type === 'friend') ||
      !text(d.expr) ||
      !text(d.note) ||
      !date(d.date) ||
      !['accountId', 'toAccountId', 'categoryId', 'personId', 'friendAccountId'].every((k) => id(d[k])) ||
      !mode(d.paymentMode) ||
      (d.friendSign !== 1 && d.friendSign !== -1) ||
      typeof d.refund !== 'boolean' ||
      !Array.isArray(d.rows) ||
      d.rows.length > 1000
    )
      return null;
    if (new Set(d.rows.map((r) => (object(r) ? r.id : null))).size !== d.rows.length) return null;
    if (d.type !== 'expense' && (d.refund || d.splitParts !== null)) return null;
    for (const r of d.rows) {
      if (
        !object(r) ||
        !text(r.id) ||
        !date(r.date) ||
        !text(r.note) ||
        !Number.isSafeInteger(r.amountMinor) ||
        (r.amountMinor as number) <= 0 ||
        (r.amountMinor as number) > MAX_AMOUNT_MINOR ||
        !id(r.accountId)
      )
        return null;
      if (r.kind === 'transaction') {
        if (
          !txType(r.type) ||
          typeof r.accountId !== 'string' ||
          !id(r.toAccountId) ||
          !id(r.categoryId) ||
          !text(r.label) ||
          !text(r.categoryIcon) ||
          !text(r.categoryColor) ||
          (r.parentName !== undefined && !text(r.parentName)) ||
          (r.isRefund !== undefined && typeof r.isRefund !== 'boolean') ||
          (r.paymentMode !== undefined && !mode(r.paymentMode))
        )
          return null;
      } else if (r.kind === 'friend') {
        if (!text(r.personId) || !text(r.personName) || !id(r.accountName) || (r.sign !== 1 && r.sign !== -1))
          return null;
      } else return null;
    }
    if (
      d.splitParts !== null &&
      (!Array.isArray(d.splitParts) ||
        d.splitParts.length > 1000 ||
        !d.splitParts.every((p) => object(p) && text(p.key) && id(p.categoryId) && text(p.amountText)))
    )
      return null;
    return d as unknown as EntryDraft;
  } catch {
    return null;
  }
}
export function serializeEntryDraft(draft: EntryDraft): string {
  return JSON.stringify({ version: 1, draft });
}
