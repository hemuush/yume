import { router } from 'expo-router';
import { AccountSummarySheet } from '@/features/home/AccountSummarySheet';
import { AccountDetailModal } from '@/features/profile/AccountDetailModal';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { TransactionDetailModal } from '@/features/transactions/TransactionDetailModal';
import { investHref, withdrawHref } from '@/lib/investRoutes';
import { payCardRoute } from '@/lib/payCard';
import { periodRange, type PeriodCursor } from '@/lib/period';
import type { Account, Category } from '@/types';
import { useHomeSheets, type HomeSheets as HomeSheetsStore } from './homeSheetsStore';

/**
 * The sheets Home opens: an account's summary (and the edit form it hands over to), an entry's detail, and the new
 * account form. Which is open lives in `sheets`, so Home itself does not redraw when one opens or closes.
 */
export function HomeSheets({
  sheets,
  cursor,
  accounts,
  historyAccounts,
  categories,
  reload,
}: {
  sheets: HomeSheetsStore;
  /** The period Home is browsing: a summary's "See all" opens Activity on it. */
  cursor: PeriodCursor;
  accounts: Account[];
  /** Every account, archived ones too: an entry made on one still names it. */
  historyAccounts: Account[];
  categories: Category[];
  /** Reloads Home in place after something was saved or deleted in a sheet. */
  reload: () => Promise<unknown>;
}) {
  const open = useHomeSheets(sheets);
  return (
    <>
      <AccountSummarySheet
        account={open.account}
        cursor={cursor}
        accounts={accounts}
        categories={categories}
        onClose={sheets.closeAccount}
        onAdd={(acc) => {
          sheets.closeAccount();
          router.push(
            `/add-transaction?type=${acc.type === 'savings' ? 'transfer' : 'expense'}&accountId=${acc.id}`
          );
        }}
        onEdit={sheets.editAccount}
        onChanged={reload}
        onInvest={(acc) => {
          sheets.closeAccount();
          router.push(investHref(acc));
        }}
        onWithdraw={(acc) => {
          sheets.closeAccount();
          router.push(withdrawHref(acc));
        }}
        onPayBill={(acc, amountMinor) => {
          sheets.closeAccount();
          router.push(payCardRoute(acc.id, amountMinor));
        }}
        onAddCharge={(acc, categoryId) => {
          sheets.closeAccount();
          router.push(
            `/add-transaction?type=expense&accountId=${acc.id}${categoryId ? `&categoryId=${categoryId}` : ''}`
          );
        }}
        onSeeAll={(acc) => {
          sheets.closeAccount();
          const month =
            cursor.granularity === 'month' ? `&month=${periodRange(cursor).start.slice(0, 7)}` : '';
          router.navigate(`/transactions?account=${acc.id}${month}`);
        }}
      />

      {open.entry && (
        <TransactionDetailModal
          tx={open.entry}
          accounts={historyAccounts}
          categories={categories}
          onClose={sheets.closeEntry}
          onEdit={(tx) => {
            sheets.closeEntry();
            router.push({ pathname: '/add-transaction', params: { id: tx.id } });
          }}
          onChanged={() => {
            sheets.closeEntry();
            void reload();
          }}
        />
      )}
      <AccountDetailModal
        account={open.editing}
        onClose={sheets.closeEditing}
        onChanged={async () => {
          sheets.closeEditing();
          await reload();
        }}
      />

      <AddAccountModal
        visible={open.adding}
        onClose={sheets.closeAddAccount}
        onCreated={async () => {
          sheets.closeAddAccount();
          await reload();
        }}
      />
    </>
  );
}
