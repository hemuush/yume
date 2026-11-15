import { memo } from 'react';
import { SettingsRow } from '@/components/SettingsRow';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';

/** The on/off notification settings listed as rows. */
export type AlertKey =
  'billAlerts' | 'overspendAlerts' | 'recurringAlerts' | 'refundAlerts' | 'weeklySummary' | 'suuCheckins';

const ROWS: Record<
  AlertKey,
  { icon: string; tone: 'idGold' | 'idCoral' | 'accentTint' | 'goldTint' | 'suu'; label: string; sub: string }
> = {
  billAlerts: {
    icon: 'credit-card-outline',
    tone: 'idGold',
    label: 'Loan EMIs due',
    sub: 'Due day, then daily for a week',
  },
  overspendAlerts: {
    icon: 'alert-outline',
    tone: 'idCoral',
    label: 'Spending alerts',
    sub: 'Budget limits, big jumps',
  },
  recurringAlerts: {
    icon: 'repeat',
    tone: 'accentTint',
    label: 'Recurring expense heads-up',
    sub: 'Day before a recurring expense',
  },
  refundAlerts: {
    icon: 'cash-refund',
    tone: 'goldTint',
    label: 'Refund follow-ups',
    sub: 'Expected date, then 3 days later',
  },
  weeklySummary: { icon: 'chart-bar', tone: 'accentTint', label: 'Weekly wrap', sub: 'Mondays' },
  suuCheckins: { icon: 'sprout', tone: 'suu', label: 'Suu’s check-ins', sub: 'Two lines on the bell screen' },
};

/**
 * One notification switch as a settings row. It is drawn again only when its own value (or whether the times are off,
 * which dims it) changes, not for every other switch on the page. `onToggle` is one function for every row.
 */
export const AlertRow = memo(function AlertRow({
  rowKey,
  value,
  dimmed = false,
  divider = false,
  onToggle,
}: {
  rowKey: AlertKey;
  value: boolean;
  /** No time is on, so nothing below will arrive. */
  dimmed?: boolean;
  divider?: boolean;
  onToggle: (key: AlertKey, enabled: boolean) => void;
}) {
  // Read here, not at import: the colours follow the theme, and this row must follow with them.
  const { secondary } = useAccent();
  const row = ROWS[rowKey];
  const iconBg = row.tone === 'suu' ? shade(secondary, 94) : theme.colors[row.tone];
  return (
    <SettingsRow
      icon={row.icon}
      iconBg={iconBg}
      label={row.label}
      sub={row.sub}
      divider={divider}
      dimmed={dimmed}
      right={
        <ToggleSwitch
          accessibilityLabel={row.label}
          value={value}
          onChange={(enabled) => onToggle(rowKey, enabled)}
        />
      }
    />
  );
});
