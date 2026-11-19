import { planWorkspaceCard } from '@/features/plan/plan.styles';
import { ScreenLoadError } from '@/components/ScreenLoadError';
import { memo, useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { RecurringSheets } from '@/features/recurring/RecurringSheets';
import { RuleListItem } from '@/features/recurring/RuleListItem';
import { SuggestionsList } from '@/features/recurring/SuggestionsList';
import { SectionHead } from '@/features/recurring/SectionHead';
import { createRecurringSheets } from '@/features/recurring/recurringSheetsStore';
import { useRecurringData } from '@/features/recurring/useRecurringData';
import { useRecurringModel } from '@/features/recurring/useRecurringModel';
import { useRuleActions } from '@/features/recurring/useRuleActions';
import { ListCard } from '@/components/SummaryCard';
import { styles } from '@/features/recurring/recurring.styles';
import { usePrivacy } from '@/theme/PrivacyContext';
import { parentNameOf } from '@/lib/categoryLabel';

const Suggestions = memo(SuggestionsList);
const NO_SCHEDULED_RULES: ReadonlySet<string> = new Set();

/** Rules the dated agenda cannot show, plus optional setup suggestions. */
export default function RecurringWorkspace({
  scheduledRuleIds = NO_SCHEDULED_RULES,
  onChanged,
  refreshRef,
}: {
  scheduledRuleIds?: ReadonlySet<string>;
  onChanged?: () => Promise<void>;
  refreshRef?: RefObject<(() => Promise<void>) | null>;
}) {
  // Which sheet is open is kept outside React state, so opening or closing one does not redraw the page behind it.
  const [sheets] = useState(createRecurringSheets);
  const {
    rules,
    accounts,
    categories,
    suggestions,
    currency,
    today,
    loaded,
    loadError,
    reload: load,
    setRuleActive,
    dropSuggestion,
  } = useRecurringData();
  useEffect(() => {
    if (!refreshRef) return;
    refreshRef.current = load;
    return () => {
      refreshRef.current = null;
    };
  }, [load, refreshRef]);
  const reloadAfterChange = useCallback(async () => {
    await Promise.all([load(), onChanged?.()]);
  }, [load, onChanged]);
  const { hideAmounts } = usePrivacy();
  const model = useRecurringModel({ rules, accounts, categories, currency, today }, hideAmounts);
  const { busyRuleIds, togglePause, hideSuggestion } = useRuleActions({
    reload: reloadAfterChange,
    setRuleActive,
    dropSuggestion,
  });
  // A savings or investment charge (an SIP) shows its amount: left out while those are hidden.
  const shownSuggestions = useMemo(
    () => (hideAmounts ? suggestions.filter((s) => !s.isSensitive) : suggestions),
    [hideAmounts, suggestions]
  );
  const { activeRules, pausedRules, categoriesById, masked, investIds, accountName, accountCurrency } = model;

  const ruleRow = (rule: (typeof rules)[number], i: number, muted?: boolean) => (
    <RuleListItem
      key={rule.id}
      rule={rule}
      category={rule.categoryId ? categoriesById.get(rule.categoryId) : undefined}
      parentName={parentNameOf(rule.categoryId, categoriesById)}
      masked={masked.has(rule.id)}
      investIds={investIds}
      accountName={accountName}
      currency={accountCurrency(rule.accountId)}
      index={i}
      busy={busyRuleIds.has(rule.id)}
      muted={muted}
      onTogglePause={togglePause}
      onOpen={sheets.openRule}
    />
  );

  if (loadError)
    return (
      <ScreenLoadError
        title="Other recurring rules"
        message={loadError}
        onRetry={() => void load()}
        embedded
      />
    );
  if (!loaded) return null;

  const outsideSchedule = activeRules.filter((rule) => !scheduledRuleIds.has(rule.id));
  const paused = pausedRules.filter((rule) => !scheduledRuleIds.has(rule.id));
  if (outsideSchedule.length === 0 && paused.length === 0 && shownSuggestions.length === 0) return null;
  return (
    <>
      {outsideSchedule.length > 0 && (
        <>
          <SectionHead title="Outside this schedule" />
          <ListCard style={[styles.list, planWorkspaceCard]}>
            {outsideSchedule.map((rule, index) => ruleRow(rule, index))}
          </ListCard>
        </>
      )}
      {paused.length > 0 && (
        <>
          <SectionHead title="Paused rules" />
          <ListCard style={[styles.list, planWorkspaceCard]}>
            {paused.map((rule, index) => ruleRow(rule, index, true))}
          </ListCard>
        </>
      )}
      <Suggestions
        suggestions={shownSuggestions}
        onMakeRecurring={sheets.fromSuggestion}
        onHide={hideSuggestion}
      />
      <RecurringSheets
        sheets={sheets}
        accounts={accounts}
        categories={categories}
        categoriesById={categoriesById}
        activeRules={activeRules}
        masked={masked}
        investIds={investIds}
        accountName={accountName}
        todayIso={model.todayIso}
        busyRuleIds={busyRuleIds}
        onTogglePause={togglePause}
        reload={reloadAfterChange}
      />
    </>
  );
}
