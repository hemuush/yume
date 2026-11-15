import { ModalSheet } from '@/components/ModalSheet';
import { investRole } from '@/lib/investment';
import { parentNameOf } from '@/lib/categoryLabel';
import { weekdayDayMonth } from '@/lib/dateLabels';
import type { Account, Category, RecurringRule } from '@/types';
import { RuleRow } from './RuleRow';
import { runMarks } from './recurring.helpers';

/** The entries due on one day of the 30-day strip, each a row that opens its rule. */
export function RunDateSheet({
  date,
  activeRules,
  masked,
  accounts,
  categoriesById,
  investIds,
  accountName,
  todayIso,
  busyRuleIds,
  onClose,
  onTogglePause,
  onOpen,
}: {
  date: string | null;
  activeRules: RecurringRule[];
  masked: ReadonlySet<string>;
  accounts: Account[];
  categoriesById: Map<string, Category>;
  investIds: ReadonlySet<string>;
  accountName: (id: string) => string;
  todayIso: string;
  busyRuleIds: ReadonlySet<string>;
  onClose: () => void;
  onTogglePause: (rule: RecurringRule) => void;
  onOpen: (rule: RecurringRule) => void;
}) {
  return (
    <ModalSheet visible={!!date} onClose={onClose} title={date ? weekdayDayMonth(date) : 'Upcoming entries'}>
      {date &&
        activeRules
          .filter((rule) => !masked.has(rule.id))
          .flatMap((rule) =>
            runMarks([rule], todayIso)
              .filter((mark) => mark.date === date)
              .map((mark) => ({ rule, mark }))
          )
          .map(({ rule, mark }, index) => (
            <RuleRow
              key={mark.key}
              rule={{
                ...rule,
                nextRunDate: mark.key.slice(rule.id.length + 1),
                nextAmountMinor: mark.key === `${rule.id}-${rule.nextRunDate}` ? rule.nextAmountMinor : null,
              }}
              category={rule.categoryId ? categoriesById.get(rule.categoryId) : undefined}
              parentName={parentNameOf(rule.categoryId, categoriesById)}
              investRole={investRole(rule, investIds)}
              accountName={accountName}
              index={index}
              onTogglePause={() => onTogglePause(rule)}
              busy={busyRuleIds.has(rule.id)}
              currency={accounts.find((a) => a.id === rule.accountId)?.currency}
              onPress={() => onOpen(rule)}
            />
          ))}
    </ModalSheet>
  );
}
