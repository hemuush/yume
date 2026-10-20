import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AmountField } from '@/components/AmountField';
import { monthlyCommitments, type MonthlyPlanInput } from './monthlyCommitments';
import { getMonthlyPlanIncome, setMonthlyPlanIncome } from '@/db/monthlyPlan';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';
import { formatMoney, toMinor } from '@/lib/money';
import { errorMessage } from '@/lib/errorMessage';
import { theme } from '@/constants/theme';
import { useSaveOnce } from '@/lib/useSaveOnce';

export function MonthlyPlanCheck({
  input,
  currency,
  hidden,
  refreshToken,
}: {
  input: MonthlyPlanInput;
  currency: string;
  hidden: boolean;
  refreshToken?: object;
}) {
  const { accent } = useAccent();
  const [override, setOverride] = useState<{
    currency: string;
    value: number | null;
    refreshToken?: object;
  }>();
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scope = useRef<{ currency: string; refreshToken?: object } | null>(null);
  useEffect(() => {
    scope.current = hidden ? null : { currency, refreshToken };
    if (hidden) {
      setOpen(false);
      return;
    }
    let live = true;
    setLoadError(false);
    setOverride(undefined);
    getMonthlyPlanIncome(currency).then(
      (value) => {
        if (live) setOverride({ currency, value, refreshToken });
      },
      () => {
        if (live) setLoadError(true);
      }
    );
    return () => {
      live = false;
      scope.current = null;
    };
  }, [currency, hidden, retry, refreshToken]);
  const save = useSaveOnce(async (reset = false) => {
    setBusy(true);
    setError('');
    try {
      const value = reset ? null : amount.trim() === '' ? NaN : toMinor(Number(amount));
      await setMonthlyPlanIncome(currency, value);
      if (scope.current?.currency === currency && scope.current?.refreshToken === refreshToken) {
        setOverride({ currency, value, refreshToken });
        setOpen(false);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  });
  if (hidden)
    return (
      <View style={s.card}>
        <Text style={s.title}>Monthly plan check</Text>
        <Text style={s.hint}>Reveal amounts to review spending and savings commitments together.</Text>
      </View>
    );
  let plan: ReturnType<typeof monthlyCommitments>;
  try {
    plan = monthlyCommitments(input);
  } catch {
    return (
      <View style={s.card}>
        <Text style={s.title}>Monthly plan check</Text>
        <Text style={s.hint}>These commitments are too large to estimate safely.</Text>
      </View>
    );
  }
  const ready = override?.currency === currency && override.refreshToken === refreshToken;
  const income = ready ? (override.value ?? plan.incomeMinor) : 0;
  const remaining = income - plan.totalMinor;
  const knownIncome = ready && (override.value != null || income > 0);
  const money = (value: number) => formatMoney(value, currency);
  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.title}>Does your monthly plan fit?</Text>
        <PrimaryButton
          compact
          variant="secondary"
          title="Income"
          disabled={!ready}
          onPress={() => {
            setAmount(String(income / 100));
            setError('');
            setOpen(true);
          }}
        />
      </View>
      {loadError ? (
        <PrimaryButton
          compact
          variant="secondary"
          title="Retry plan check"
          onPress={() => setRetry((n) => n + 1)}
        />
      ) : !ready ? (
        <Text style={s.hint}>Loading plan…</Text>
      ) : (
        <>
          <Text
            style={[
              s.big,
              { color: knownIncome && remaining < 0 ? theme.colors.expenseText : themeInk(accent) },
            ]}
          >
            {knownIncome
              ? `${money(Math.abs(remaining))} ${remaining < 0 ? 'over income' : 'unallocated'}`
              : 'Set expected income'}
          </Text>
          <View style={s.track}>
            {knownIncome && (
              <View
                style={[
                  s.fill,
                  {
                    backgroundColor: themeInk(accent),
                    width: `${Math.min(100, (plan.totalMinor / Math.max(1, income)) * 100)}%`,
                  },
                ]}
              />
            )}
          </View>
          <View style={s.row}>
            <Text style={s.hint}>Expected income</Text>
            <Text style={s.value}>{knownIncome ? money(income) : 'Not set'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.hint}>Spending, bills & EMIs</Text>
            <Text style={s.value}>{money(plan.spendingMinor)}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.hint}>Savings commitments</Text>
            <Text style={s.value}>{money(plan.savingsMinor)}</Text>
          </View>
          <Text style={s.hint}>
            Monthly estimate using {override.value != null ? 'your income estimate' : 'recurring income'}.
            Budget limits cover matching bills; savings transfers cover matching goal funding. Card repayments
            are not added again. Unbudgeted daily spending may be missing.
          </Text>
          {plan.incompleteLoans > 0 && (
            <Text style={s.hint}>
              {plan.incompleteLoans} borrowed loans have no usable EMI schedule. Their payments are excluded;
              this estimate is incomplete.
            </Text>
          )}
          {plan.undatedGoals > 0 && (
            <Text style={s.hint}>
              {plan.undatedGoals} unfinished or overdue goals have no usable monthly target and are excluded.
            </Text>
          )}
        </>
      )}
      <ModalSheet
        visible={open && !hidden}
        onClose={() => setOpen(false)}
        dismissible={!busy}
        title="Expected monthly income"
        footer={
          <View style={{ gap: 8 }}>
            <PrimaryButton
              title={busy ? 'Saving…' : 'Save estimate'}
              disabled={busy}
              onPress={() => void save(false)}
            />
            <PrimaryButton
              variant="secondary"
              title="Use recurring income"
              disabled={busy}
              onPress={() => void save(true)}
            />
          </View>
        }
      >
        <Text style={s.hint}>
          Use expected take-home income in {currency}. This changes the planning estimate only; it records no
          transaction.
        </Text>
        <AmountField label="Monthly income" value={amount} onChangeText={setAmount} />
        {error ? <Text style={s.error}>{error}</Text> : null}
      </ModalSheet>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    margin: 16,
    marginBottom: 0,
    padding: 16,
    gap: 10,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
  },
  title: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary, flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  big: { fontFamily: theme.font.bodyBold, fontSize: 24 },
  hint: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
  value: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  track: { height: 6, borderRadius: 4, overflow: 'hidden', backgroundColor: theme.colors.surfaceAlt },
  fill: { height: '100%', borderRadius: 4 },
  error: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.expenseText },
});
