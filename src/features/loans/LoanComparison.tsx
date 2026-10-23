import { useEffect, useEffectEvent, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ModalSheet } from '@/components/ModalSheet';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AmountField } from '@/components/AmountField';
import { comparePrepayments, type PrepaymentSummary } from '@/db/loans';
import { inputMinor, formatMoney } from '@/lib/money';
import { toLocalIsoDate } from '@/lib/date';
import { dayMonthYear } from '@/lib/dateLabels';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';

interface Candidate {
  id: string;
  name: string;
  leftMinor: number;
  nextDueDate: string | null;
}
interface Result {
  id: string;
  summary?: PrepaymentSummary;
  error?: string;
}

export function LoanComparison({
  visible,
  loans,
  currency,
  hidden,
  onClose,
  onOpenLoan,
  refreshToken,
}: {
  visible: boolean;
  loans: Candidate[];
  currency: string;
  hidden: boolean;
  onClose: () => void;
  onOpenLoan: (id: string) => void;
  refreshToken?: object;
}) {
  const { accent } = useAccent();
  const [amount, setAmount] = useState('');
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; rows: Result[]; refreshToken?: object }>();
  const minor = inputMinor(amount);
  const candidatesKey = loans.map((loan) => `${loan.id}:${loan.leftMinor}:${loan.nextDueDate}`).join('|');
  const date = toLocalIsoDate(new Date());
  const key = `${minor}|${candidatesKey}|${currency}|${date}|${retry}`;
  // Candidate identity, balances and due dates are part of `key`, so the request reads the latest candidates
  // through Effect Events and the effect re-runs only when `key` (or visibility) changes.
  const compare = useEffectEvent(() =>
    comparePrepayments(
      loans.map((loan) => loan.id),
      minor,
      date
    )
  );
  const failedRows = useEffectEvent((): Result[] =>
    loans.map((loan) => ({
      id: loan.id,
      error: 'Could not load this loan. Retry the comparison.',
    }))
  );
  useEffect(() => {
    if (!visible || hidden || !Number.isSafeInteger(minor) || minor <= 0) return;
    let live = true;
    setResult(undefined);
    const timer = setTimeout(() => {
      void compare().then(
        (rows) => {
          if (live) setResult({ key, rows, refreshToken });
        },
        () => {
          if (live) setResult({ key, refreshToken, rows: failedRows() });
        }
      );
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [visible, hidden, minor, key, refreshToken]);
  const rows =
    result?.key === key && result.refreshToken === refreshToken
      ? [...result.rows].sort(
          (a, b) => (b.summary?.interestSavedMinor ?? -1) - (a.summary?.interestSavedMinor ?? -1)
        )
      : null;
  const max = Math.max(1, ...(rows ?? []).map((row) => row.summary?.interestSavedMinor ?? 0));
  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title="Compare an extra payment"
      subtitle="Same amount, different loans. No money is moved."
    >
      {hidden ? (
        <Text style={s.hint}>Reveal amounts to compare your loans.</Text>
      ) : (
        <>
          <AmountField label={`Extra payment (${currency})`} value={amount} onChangeText={setAmount} />
          <Text style={s.hint}>
            One payment today, keeping each loan’s EMI unchanged. Estimates assume unchanged rates and exclude
            lender charges. Compare affordability separately before paying.
          </Text>
          {loans.length < 2 && (
            <Text style={s.hint}>Add at least two active borrowed loans to compare alternatives.</Text>
          )}
          {minor > 0 && !rows && <Text style={s.hint}>Calculating comparisons…</Text>}
          {minor > 0 &&
            rows?.map((row) => (
              <View key={row.id} style={s.card}>
                <Text style={s.title}>{loans.find((loan) => loan.id === row.id)?.name}</Text>
                {row.summary ? (
                  <>
                    <Text style={[s.amount, { color: themeInk(accent) }]}>
                      {formatMoney(row.summary.interestSavedMinor, currency)} interest saved
                    </Text>
                    <View style={s.track}>
                      <View
                        style={[
                          s.fill,
                          {
                            backgroundColor: themeInk(accent),
                            width: `${(row.summary.interestSavedMinor / max) * 100}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={s.hint}>
                      {row.summary.monthsShaved} fewer instalments · payoff{' '}
                      {dayMonthYear(row.summary.newPayoffDate)}
                    </Text>
                  </>
                ) : (
                  <Text style={s.hint}>{row.error}</Text>
                )}
                <PrimaryButton
                  compact
                  variant="secondary"
                  title="Review loan"
                  onPress={() => onOpenLoan(row.id)}
                />
              </View>
            ))}
          {rows?.some((row) => row.error) && (
            <PrimaryButton
              compact
              variant="secondary"
              title="Retry comparisons"
              onPress={() => setRetry((n) => n + 1)}
            />
          )}
        </>
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
    gap: 10,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  title: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  amount: { fontFamily: theme.font.bodyBold, fontSize: 20 },
  track: { height: 5, backgroundColor: theme.colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
