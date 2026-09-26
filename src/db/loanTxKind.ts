/**
 * What a loan-linked transaction (`transactions.loan_id` set) actually is —
 * the disbursement, the processing fee, a prepayment of principal, or a
 * prepayment charge. Recorded in `transactions.loan_tx_kind` at write time
 * (see db/loans.ts). Before that column existed, the only way to tell these
 * apart was the note text each insert writes, and some code (net worth, the
 * delete-loan guard) needs to know which rows really reduced principal.
 *
 * Imported by both db/client.ts (migration) and lib/backup.ts (restore) —
 * this file imports nothing from either, so neither import is circular.
 *
 * Fills `loan_tx_kind` for loan-linked rows written before the column
 * existed (an upgrading install, or a restored older backup), from the
 * exact note prefixes db/loans.ts has always written. "Prepayment charge"
 * is matched before plain "Prepayment" since the latter is its prefix.
 * Idempotent — only touches rows still NULL.
 */
export const BACKFILL_LOAN_TX_KIND_SQL = `
UPDATE transactions SET loan_tx_kind = CASE
    WHEN note LIKE 'Loan disbursement —%' THEN 'disbursement'
    WHEN note LIKE 'Loan processing fee —%' THEN 'fee'
    WHEN note LIKE 'Prepayment charge —%' THEN 'prepayment_charge'
    WHEN note LIKE 'Prepayment —%' THEN 'prepayment'
  END
WHERE loan_id IS NOT NULL AND loan_tx_kind IS NULL
`;
