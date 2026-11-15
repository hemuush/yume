import { memo } from 'react';
import { router } from 'expo-router';
import { AccountSummarySheet } from '@/features/home/AccountSummarySheet';
import { AccountDetailModal } from '@/features/profile/AccountDetailModal';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { RuleModal } from '@/features/recurring/RuleModal';
import { addMonthsToIsoDate } from '@/lib/date';
import { investHref, withdrawHref } from '@/lib/investRoutes';
import { CURRENT_PERIOD } from '@/lib/period';
import type { Holding } from '@/lib/portfolio';
import type { Account, Category } from '@/types';
import { HoldingPickerSheet } from './HoldingPickerSheet';
import { UpdateValuesSheet } from './UpdateValuesSheet';
import {
  useInvestmentsSheets,
  type InvestmentsSheets as InvestmentsSheetsStore,
} from './investmentsSheetsStore';

/**
 * The sheets the Investments page opens: a holding's summary and its editor, the new-investment form, the value update,
 * the holding picker and the SIP form. Which is open lives in `sheets`, so the page behind does not redraw when one opens
 * or closes.
 */
export const InvestmentsSheets = memo(function InvestmentsSheets({
  sheets,
  accounts,
  categories,
  holdings,
  today,
  reload,
}: {
  sheets: InvestmentsSheetsStore;
  accounts: Account[];
  categories: Category[];
  /** The investments in the default currency, the ones a new investment or SIP can go into. */
  holdings: Holding[];
  today: string;
  /** Reloads the page in place after something was saved. */
  reload: () => Promise<void>;
}) {
  const { summary, editing, adding, updating, picking, rule } = useInvestmentsSheets(sheets);
  const prefill = rule?.holding
    ? {
        type: 'transfer' as const,
        accountId: rule.holding.investment?.fundingAccountId ?? '',
        toAccountId: rule.holding.id,
        categoryId: null,
        amountMinor: 0,
        note: 'SIP',
        nextRunDate: addMonthsToIsoDate(today, 1),
      }
    : undefined;
  const pick = (holding: Holding) => {
    sheets.pick(null);
    if (picking === 'invest') router.push(investHref(holding.account));
    else if (picking === 'sip') sheets.startSip(holding.account);
  };
  return (
    <>
      <AccountSummarySheet
        account={summary}
        cursor={CURRENT_PERIOD}
        accounts={accounts}
        categories={categories}
        onClose={sheets.closeSummary}
        onAdd={(acc) => {
          sheets.closeSummary();
          router.push(`/add-transaction?type=transfer&accountId=${acc.id}`);
        }}
        onEdit={(acc) => {
          sheets.closeSummary();
          sheets.edit(acc);
        }}
        onSeeAll={(acc) => {
          sheets.closeSummary();
          router.navigate(`/transactions?account=${acc.id}`);
        }}
        onChanged={() => void reload()}
        onInvest={(acc) => {
          sheets.closeSummary();
          router.push(investHref(acc));
        }}
        onWithdraw={(acc) => {
          sheets.closeSummary();
          router.push(withdrawHref(acc));
        }}
        onAddSip={(acc) => {
          sheets.closeSummary();
          sheets.startSip(acc);
        }}
      />
      <AccountDetailModal
        account={editing}
        onClose={() => sheets.edit(null)}
        onChanged={() => {
          sheets.edit(null);
          void reload();
        }}
      />
      <AddAccountModal
        visible={adding}
        initialChoice="investment"
        onClose={sheets.closeAdd}
        onCreated={() => {
          sheets.closeAdd();
          void reload();
        }}
      />
      <UpdateValuesSheet
        visible={updating}
        holdings={holdings}
        onClose={sheets.closeUpdate}
        onChanged={() => void reload()}
      />
      <HoldingPickerSheet
        visible={picking !== null}
        title={picking === 'sip' ? 'A SIP into which investment?' : 'Invest in which one?'}
        holdings={holdings}
        onPick={pick}
        onClose={() => sheets.pick(null)}
      />
      <RuleModal
        visible={rule !== null}
        editing={rule?.editing ?? null}
        accounts={accounts}
        categories={categories}
        prefill={prefill}
        onClose={sheets.closeRule}
        onSaved={() => {
          sheets.closeRule();
          void reload();
        }}
        onDeleted={() => {
          sheets.closeRule();
          void reload();
        }}
      />
    </>
  );
});
