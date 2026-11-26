import { useEffect, useState } from 'react';

import { openAdd } from '@/lib/openAdd';
import { ActionSheet, ActionSheetItem } from '@/components/ActionSheet';
import { getRepeatEntries, RepeatEntry } from '@/db/ledger';
import { usePrivacy } from '@/theme/PrivacyContext';
import { repeatEntryLabel, useLogAgain } from './useLogAgain';

export { repeatEntryLabel };

/**
 * + long-press: most repeated hand-logged entries (getRepeatEntries); one tap saves for today, then Undo.
 * Ends with "Open Add" unless opened from Add (`fromAdd`); there `onLogged` fires so Add can close.
 */
export function RepeatEntrySheet({
  visible,
  onClose,
  fromAdd,
  onLogged,
}: {
  visible: boolean;
  onClose: () => void;
  fromAdd?: boolean;
  onLogged?: () => void;
}) {
  const { hideAmounts } = usePrivacy();
  const [entries, setEntries] = useState<RepeatEntry[]>([]);
  const logAgain = useLogAgain(onLogged);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getRepeatEntries()
      .then((list) => {
        if (!cancelled) setEntries(list);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const items: ActionSheetItem[] = [
    ...entries
      .filter((entry) => !hideAmounts || !entry.isSensitive)
      .map((entry) => ({
        key: `${entry.type}:${entry.accountId}:${entry.categoryId}:${entry.amountMinor}`,
        label: repeatEntryLabel(entry),
        icon: (entry.type === 'income' ? 'arrow-down-right' : 'arrow-up-right') as ActionSheetItem['icon'],
        onPress: () => void logAgain(entry),
      })),
    ...(fromAdd
      ? []
      : [
          {
            key: 'open-add',
            label: 'Open Add screen',
            icon: 'plus' as const,
            onPress: () => void openAdd(),
          },
        ]),
  ];

  return (
    <ActionSheet
      ledgerStyle
      visible={visible}
      onClose={onClose}
      title="Log again"
      subtitle={
        entries.length > 0
          ? 'Saved for today with one tap. You can undo it straight after.'
          : 'Entries you log often will show up here.'
      }
      items={items}
    />
  );
}
