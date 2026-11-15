import { useCallback, useRef, useState } from 'react';
import { showAlert } from '@/components/AppDialog';
import { setRecurringRuleActive } from '@/db/recurring';
import { hideSubscriptionSuggestion } from '@/db/settings';
import type { SubscriptionSuggestion } from '@/db/subscriptions';
import { errorMessage } from '@/lib/errorMessage';
import type { RecurringRule } from '@/types';

/**
 * What the Recurring page does to a rule or a suggestion from the list: pause or resume a rule, and hide a suggestion.
 * A rule is busy from the tap until its write and the reload after it are done, and a second tap on it meanwhile is
 * ignored. The functions keep their identity, so the rows holding them are not drawn again for them.
 */
export function useRuleActions({
  reload,
  setRuleActive,
  dropSuggestion,
}: {
  reload: () => Promise<void>;
  /** Shows a rule paused or resumed at once, ahead of the reload. */
  setRuleActive: (id: string, active: boolean) => void;
  /** Takes a suggestion off the list at once. */
  dropSuggestion: (key: string) => void;
}) {
  const pending = useRef(new Set<string>());
  const [busyRuleIds, setBusyRuleIds] = useState<ReadonlySet<string>>(new Set());

  const togglePause = useCallback(
    async (rule: RecurringRule) => {
      if (pending.current.has(rule.id)) return;
      pending.current.add(rule.id);
      setBusyRuleIds(new Set(pending.current));
      try {
        await setRecurringRuleActive(rule.id, !rule.active);
        setRuleActive(rule.id, !rule.active);
        await reload();
      } catch (e) {
        showAlert('Couldn’t update recurring entry', errorMessage(e));
      } finally {
        pending.current.delete(rule.id);
        setBusyRuleIds(new Set(pending.current));
      }
    },
    [reload, setRuleActive]
  );

  const hideSuggestion = useCallback(
    async (suggestion: SubscriptionSuggestion) => {
      dropSuggestion(suggestion.key);
      try {
        await hideSubscriptionSuggestion(suggestion.key);
      } catch (e) {
        // It was not saved, so it would be back on the next visit with no word why: say so, and show it again now.
        showAlert('Couldn’t hide it', errorMessage(e));
        void reload();
      }
    },
    [dropSuggestion, reload]
  );

  return { busyRuleIds, togglePause, hideSuggestion };
}
