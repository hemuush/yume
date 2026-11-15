import { memo } from 'react';
import { AccountDetailModal } from './AccountDetailModal';
import { AddAccountModal } from './AddAccountModal';
import { useYouSheets, type YouSheets as YouSheetsStore } from './youSheetsStore';

/**
 * The sheets the You page opens: the new-account form and an account's details. Which is open lives in `sheets`, so the
 * page behind does not redraw when one opens or closes.
 */
export const YouSheets = memo(function YouSheets({
  sheets,
  reload,
}: {
  sheets: YouSheetsStore;
  /** Reloads the page in place after something was saved. */
  reload: () => Promise<void>;
}) {
  const { adding, account } = useYouSheets(sheets);
  return (
    <>
      <AddAccountModal
        visible={adding}
        onClose={sheets.closeAdd}
        onCreated={async () => {
          sheets.closeAdd();
          await reload();
        }}
      />
      <AccountDetailModal
        account={account}
        onClose={sheets.closeAccount}
        onChanged={async () => {
          sheets.closeAccount();
          await reload();
        }}
      />
    </>
  );
});
