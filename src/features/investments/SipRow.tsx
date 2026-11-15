import { memo } from 'react';
import { SettingsRow } from '@/components/SettingsRow';
import { theme } from '@/constants/theme';
import { joinSub } from '@/lib/categoryLabel';
import { weekdayDayMonth } from '@/lib/dateLabels';
import { gluePiece } from '@/lib/keepTogether';
import type { Sip } from '@/lib/portfolio';
import type { RecurringRule } from '@/types';
import { ruleCadenceLabel } from '@/features/recurring/recurring.helpers';

/** One monthly SIP: where it goes, from where, when next and how much. Opens it for editing. */
export const SipRow = memo(function SipRow({
  sip,
  value,
  divider,
  onOpen,
}: {
  sip: Sip;
  /** The amount, already worded (it may be hidden). */
  value: string;
  divider: boolean;
  /** One function for every row (it is handed the rule), so a row is drawn again only when its own SIP changes. */
  onOpen: (rule: RecurringRule) => void;
}) {
  return (
    <SettingsRow
      icon="repeat"
      round
      label={sip.holdingName}
      // Wraps between its pieces, never inside a date ("next Sun, Nov" over "22").
      sub={joinSub(
        [
          ruleCadenceLabel(sip.rule),
          `from ${sip.fromName}`,
          sip.active ? `next ${weekdayDayMonth(sip.rule.nextRunDate)}` : 'paused',
        ].map(gluePiece)
      )}
      subColor={sip.active ? undefined : theme.colors.warnInk}
      value={value}
      onPress={() => onOpen(sip.rule)}
      divider={divider}
    />
  );
});
