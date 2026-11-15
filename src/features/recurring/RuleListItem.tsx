import { memo } from 'react';
import { investRole } from '@/lib/investment';
import type { Category, RecurringRule } from '@/types';
import { RuleRow } from './RuleRow';

/** One rule in the Running or Paused card. It compares its props by identity, so a reload redraws only the rules that changed. */
export const RuleListItem = memo(function RuleListItem({
  rule,
  category,
  parentName,
  masked,
  investIds,
  accountName,
  currency,
  index,
  busy,
  muted,
  onTogglePause,
  onOpen,
}: {
  rule: RecurringRule;
  category: Category | undefined;
  parentName: string | undefined;
  masked: boolean;
  investIds: ReadonlySet<string>;
  accountName: (id: string) => string;
  /** The currency of the account the rule runs on. */
  currency: string | undefined;
  index: number;
  busy: boolean;
  muted?: boolean;
  onTogglePause: (rule: RecurringRule) => void;
  onOpen: (rule: RecurringRule) => void;
}) {
  return (
    <RuleRow
      rule={rule}
      category={category}
      parentName={parentName}
      masked={masked}
      investRole={investRole(rule, investIds)}
      accountName={accountName}
      index={index}
      onTogglePause={() => onTogglePause(rule)}
      busy={busy}
      currency={currency}
      onPress={() => onOpen(rule)}
      muted={muted}
    />
  );
});
