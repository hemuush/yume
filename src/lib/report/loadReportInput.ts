import { listAccounts, listCategories, listTransactions } from '@/db/ledger';
import { listLoans } from '@/db/loans';
import { listPeople } from '@/db/people';
import { getDefaultCurrency } from '@/db/settings';

/** The most entries one export holds; a ledger past it is refused rather than cut short. */
export const MAX_EXPORT_TRANSACTIONS = 200000;

/** Everything an export reads, archived accounts and categories included so history keeps its names. */
export async function loadReportInput() {
  const [currency, accounts, categories, transactions, loans, people] = await Promise.all([
    getDefaultCurrency(),
    listAccounts(true),
    listCategories(true),
    listTransactions({ limit: MAX_EXPORT_TRANSACTIONS + 1 }),
    listLoans(),
    listPeople(),
  ]);
  if (transactions.length > MAX_EXPORT_TRANSACTIONS) {
    throw new Error(
      `Your ledger has more than ${MAX_EXPORT_TRANSACTIONS.toLocaleString('en-US')} entries, too many for one export. Use Backup instead.`
    );
  }
  return { currency, accounts, categories, transactions, loans, people };
}
