import type { AppDb } from './client';

/** Repair only receipts this app created with the exact old generated label. Linked/manual labels stay intact. */
export async function repairTrackedRefundLabels(db: AppDb): Promise<void> {
  await db.runAsync(`UPDATE transactions AS receipt SET note = (
    SELECT purchase.note FROM refund_receipts rr
    JOIN refund_expectations expected ON expected.id = rr.expectation_id
    JOIN transactions purchase ON purchase.id = expected.transaction_id
    WHERE rr.transaction_id = receipt.id AND rr.created_transaction = 1
  ) WHERE receipt.type = 'income' AND receipt.is_refund = 1 AND EXISTS (
    SELECT 1 FROM refund_receipts rr
    JOIN refund_expectations expected ON expected.id = rr.expectation_id
    JOIN transactions purchase ON purchase.id = expected.transaction_id
    JOIN categories c ON c.id = purchase.category_id
    WHERE rr.transaction_id = receipt.id AND rr.created_transaction = 1
      AND receipt.note = 'Refund: ' || CASE WHEN purchase.note != '' THEN purchase.note ELSE c.name END
  )`);
}
