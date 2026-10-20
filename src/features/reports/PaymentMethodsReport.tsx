import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Text } from '@/components/Text';
import { paymentMethodTotals, type PaymentMethodTotal } from '@/db/paymentMethods';
import { paymentMethodLabel } from '@/lib/paymentMode';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';
import { formatMoney } from '@/lib/money';
import { getCachedCurrency } from '@/db/settings';
import type { DateRange } from '@/types';
import { theme } from '@/constants/theme';

export function PaymentMethodsReport({
  visible,
  range,
  onClose,
}: {
  visible: boolean;
  range: DateRange;
  onClose: () => void;
}) {
  const { hideAmounts } = usePrivacy();
  const { accent } = useAccent();
  const [result, setResult] = useState<{ key: string; rows: PaymentMethodTotal[]; error?: boolean }>();
  const [retry, setRetry] = useState(0);
  const currency = getCachedCurrency();
  const key = `${range.start}|${range.end}|${hideAmounts}|${currency}|${retry}`;
  useEffect(() => {
    if (!visible) return;
    let live = true;
    setResult(undefined);
    paymentMethodTotals({ start: range.start, end: range.end }, hideAmounts).then(
      (rows) => {
        if (live) setResult({ key, rows });
      },
      () => {
        if (live) setResult({ key, rows: [], error: true });
      }
    );
    return () => {
      live = false;
    };
  }, [visible, key, range.start, range.end, hideAmounts]);
  const current = result?.key === key ? result : undefined;
  const max = Math.max(1, ...(current?.rows ?? []).map((row) => row.totalMinor));
  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title="Payment methods"
      subtitle={`${range.start} – ${range.end}`}
    >
      <Text style={s.hint}>
        Net spending by the method recorded on each entry. Refunds reduce their recorded method. Older entries
        stay “Not recorded”.
      </Text>
      {!current ? (
        <Text style={s.hint}>Loading methods…</Text>
      ) : current.error ? (
        <PrimaryButton title="Retry methods" variant="secondary" onPress={() => setRetry((n) => n + 1)} />
      ) : current.rows.length === 0 ? (
        <Text style={s.hint}>No spending in this period.</Text>
      ) : (
        current.rows.map((row) => (
          <View key={row.method ?? 'none'} style={s.card}>
            <View style={s.row}>
              <Text style={s.label}>{paymentMethodLabel(row.method)}</Text>
              <Text style={s.value}>{formatMoney(row.totalMinor, currency)}</Text>
            </View>
            <View style={s.track}>
              <View
                style={[
                  s.fill,
                  {
                    backgroundColor: themeInk(accent),
                    width: `${(Math.max(0, row.totalMinor) / max) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={s.hint}>
              {row.count} {row.count === 1 ? 'expense' : 'expenses'}
            </Text>
          </View>
        ))
      )}
    </ModalSheet>
  );
}
const s = StyleSheet.create({
  hint: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  card: {
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  row: { flexDirection: 'row', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 14, color: theme.colors.textPrimary },
  value: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  track: { height: 5, backgroundColor: theme.colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
