import { memo } from 'react';
import { AddLoanModal } from './AddLoanModal';
import { LoanDetailModal } from './LoanDetailModal';
import { useLoansSheets, type LoansSheets as LoansSheetsStore } from './loansSheetsStore';

/**
 * The sheets the Loans page opens: the new-loan form and a loan's detail. Which is open lives in `sheets`, so the page
 * behind does not redraw when one opens or closes.
 */
export const LoansSheets = memo(function LoansSheets({
  sheets,
  hues,
  reload,
}: {
  sheets: LoansSheetsStore;
  /** Each loan's identity colour. */
  hues: Record<string, string>;
  /** Reloads the page in place after something was saved. */
  reload: () => Promise<void>;
}) {
  const { adding, loan, payOnOpen } = useLoansSheets(sheets);
  return (
    <>
      <AddLoanModal
        visible={adding}
        onClose={sheets.closeAdd}
        onCreated={async () => {
          sheets.closeAdd();
          await reload();
        }}
      />
      {loan && (
        <LoanDetailModal
          loan={loan}
          hue={hues[loan.id]}
          startWithPay={payOnOpen}
          onClose={sheets.closeLoan}
          onChanged={reload}
        />
      )}
    </>
  );
});
