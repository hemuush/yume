import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import type { ExpectedRefund } from '@/db/refundTracking';
import { usePrivacy } from '@/theme/PrivacyContext';
import { theme } from '@/constants/theme';
import { formatMaskableMoney, formatMoney } from '@/lib/money';
import { dayMonth } from '@/lib/dateLabels';
import { toLocalIsoDate } from '@/lib/date';
import { withPressed } from '@/lib/pressed';
import { SCREEN } from '@/components/screenStyles';

export function HomeRefunds({
  refunds,
  failed,
  openingId,
  onOpen,
  onRetry,
  compact = false,
}: {
  refunds: ExpectedRefund[];
  failed: boolean;
  openingId?: string | null;
  onOpen?: (transactionId: string) => void;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const { hideAmounts } = usePrivacy();
  const [expanded, setExpanded] = useState(false);
  const today = toLocalIsoDate(new Date());
  const ordered = [...refunds].sort(
    (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.id.localeCompare(b.id)
  );
  const describe = (r: ExpectedRefund) => {
    const overdue = r.dueDate != null && r.dueDate < today;
    const date =
      r.dueDate == null
        ? 'No expected date'
        : r.dueDate === today
          ? 'Expected today'
          : `${overdue ? 'Overdue' : 'Expected'} · ${dayMonth(r.dueDate)}`;
    const amount = formatMaskableMoney(r.remainingMinor, {
      currency: r.currency,
      masked: hideAmounts && !!r.isSensitive,
    });
    return { overdue, date, amount };
  };
  if (failed)
    return (
      <View style={styles.body}>
        <Text style={styles.title}>Couldn’t load refunds</Text>
        <Text style={styles.hint}>Try again to check what’s still expected.</Text>
        <PrimaryButton title="Retry refunds" variant="secondary" compact onPress={() => onRetry?.()} />
      </View>
    );
  // Several pending refunds in Home's compact view read as one total that opens into the list. Amounts in a
  // sensitive category stay out of the total while amounts are hidden, and a masked figure stands in for them.
  if (compact && ordered.length > 1) {
    const totals = new Map<string, number>();
    let hiddenSome = false;
    for (const r of ordered) {
      if (hideAmounts && r.isSensitive) hiddenSome = true;
      else totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.remainingMinor);
    }
    const parts = [...totals].map(([currency, minor]) => formatMoney(minor, currency));
    if (hiddenSome) parts.push(formatMaskableMoney(0, { masked: true }));
    const total = parts.join(' + ');
    return (
      <View>
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${total} refunds pending across ${ordered.length} purchases`}
          style={withPressed([styles.row, styles.compactRow])}
        >
          <View style={[styles.icon, { backgroundColor: 'transparent' }]}>
            <Feather name="corner-down-left" size={18} color={theme.colors.ink} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{`${total} refunds pending`}</Text>
            <Text style={styles.hint}>{`${ordered.length} purchases · excluded from balance`}</Text>
          </View>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textMuted} />
        </Pressable>
        {expanded &&
          ordered.map((r) => {
            const { overdue, date, amount } = describe(r);
            return (
              <Pressable
                key={r.id}
                onPress={() => onOpen?.(r.transactionId)}
                disabled={!!openingId || !onOpen}
                accessibilityRole="button"
                accessibilityLabel={`${r.label}, ${amount} remaining, ${date}`}
                accessibilityState={{ disabled: !!openingId || !onOpen, busy: openingId === r.transactionId }}
                style={withPressed([styles.row, styles.compactRow])}
              >
                <View style={styles.copy}>
                  <Text style={styles.title}>{r.label}</Text>
                  <Text style={[styles.hint, overdue && styles.overdue]}>
                    {openingId === r.transactionId ? 'Opening…' : date}
                  </Text>
                </View>
                <Text style={styles.amount}>{amount}</Text>
                <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
              </Pressable>
            );
          })}
      </View>
    );
  }
  return (
    <View>
      {!compact && (
        <View style={styles.body}>
          <Text style={styles.title}>Awaiting payment</Text>
          <Text style={styles.hint}>Expected money · not included in your balance</Text>
        </View>
      )}
      {ordered.slice(0, expanded ? ordered.length : 3).map((r) => {
        const { overdue, date, amount } = describe(r);
        return (
          <Pressable
            key={r.id}
            onPress={() => onOpen?.(r.transactionId)}
            disabled={!!openingId || !onOpen}
            accessibilityRole="button"
            accessibilityLabel={`${r.label}, ${amount} remaining, ${date}`}
            accessibilityState={{ disabled: !!openingId || !onOpen, busy: openingId === r.transactionId }}
            style={withPressed([styles.row, compact && styles.compactRow])}
          >
            <View style={[styles.icon, compact && { backgroundColor: 'transparent' }]}>
              <Feather name="corner-down-left" size={18} color={theme.colors.ink} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>{compact ? `${amount} refund pending` : r.label}</Text>
              <Text style={[styles.hint, overdue && styles.overdue]}>
                {openingId === r.transactionId
                  ? 'Opening…'
                  : compact
                    ? `${r.label} · ${r.dueDate ? date + ' · ' : ''}excluded from balance`
                    : date}
              </Text>
            </View>
            {!compact && <Text style={styles.amount}>{amount}</Text>}
            <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
          </Pressable>
        );
      })}
      {ordered.length > 3 && (
        <PrimaryButton
          title={expanded ? 'Show fewer refunds' : `View all ${ordered.length} refunds`}
          compact
          variant="secondary"
          onPress={() => setExpanded((v) => !v)}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  // Inside Home's Coming up card (whose rows sit 26 in from its edge): the mark and text line up with theirs.
  compactRow: { borderTopWidth: 0, paddingBottom: 6, paddingHorizontal: 26, gap: 12 },
  body: { padding: 14, gap: 4 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    minHeight: 64,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
  icon: {
    width: SCREEN.lead,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondaryTint,
  },
  copy: { flex: 1, minWidth: 100, gap: 3 },
  title: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  hint: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  overdue: { color: theme.colors.expenseText },
  amount: {
    fontFamily: theme.font.bodyBold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
});
