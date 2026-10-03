/**
 * `loan_tx_kind` values and the backfill of legacy rows from their note prefixes ("Prepayment charge" is
 * matched before "Prepayment"; idempotent). Imports nothing, so db/client and lib/backup can both use it.
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
