import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AmountField } from '@/components/AmountField';
import { monthlyCommitments, type MonthlyPlanInput } from './monthlyCommitments';
import { getMonthlyPlanIncome, setMonthlyPlanIncome } from '@/db/monthlyPlan';
import { formatMoney, toMinor } from '@/lib/money';
import { errorMessage } from '@/lib/errorMessage';
import { theme } from '@/constants/theme';
import { SCREEN } from '@/components/screenStyles';
import { useSaveOnce } from '@/lib/useSaveOnce';
import { themedStyles } from '@/theme/themedStyles';
import { longMonth } from '@/lib/dateLabels';
import { withPressed } from '@/lib/pressed';

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
  const { width, fontScale } = useWindowDimensions();
  const compactHeadline = width >= 360 && fontScale <= 1.2;
  const [override, setOverride] = useState<{
    currency: string;
    value: number | null;
    refreshToken?: object;
  }>();
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);
  const [showCalculation, setShowCalculation] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scope = useRef<{ currency: string; refreshToken?: object } | null>(null);
  useEffect(() => {
    scope.current = hidden ? null : { currency, refreshToken };
    if (hidden) {
      setOpen(false);
      setShowCalculation(false);
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
        <Text style={s.title}>Monthly plan</Text>
        <Text style={s.hint}>Reveal amounts to review spending and savings commitments together.</Text>
      </View>
    );
  let plan: ReturnType<typeof monthlyCommitments>;
  try {
    plan = monthlyCommitments(input);
  } catch {
    return (
      <View style={s.card}>
        <Text style={s.title}>Monthly plan</Text>
        <Text style={s.hint}>These commitments are too large to estimate safely.</Text>
      </View>
    );
  }
  const ready = override?.currency === currency && override.refreshToken === refreshToken;
  const income = ready ? (override.value ?? plan.incomeMinor) : 0;
  const remaining = income - plan.totalMinor;
  const knownIncome = ready && (override.value != null || income > 0);
  const allocation =
    knownIncome && income > 0 && remaining >= 0
      ? [
          { label: 'Spending', amount: plan.spendingMinor, color: theme.colors.link },
          { label: 'Savings', amount: plan.savingsMinor, color: theme.colors.incomeText },
          { label: 'Left to plan', amount: remaining, color: theme.colors.inkHairline },
        ].filter((item) => item.amount > 0)
      : [];
  const money = (value: number) => formatMoney(value, currency);
  const factBasis = Math.round(84 * Math.min(2, Math.max(1, fontScale)));
  const openEditor = () => {
    setAmount(String(income / 100));
    setError('');
    setOpen(true);
  };
  return (
    <View style={[s.card, ready && !loadError ? s.summary : s.pending]}>
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
          <View style={s.headline}>
            <View style={s.headlineCopy}>
              <View style={s.period}>
                <Feather name="calendar" size={12} color={theme.colors.home.secondaryText} />
                <Text style={s.month}>{longMonth(input.today)}</Text>
              </View>
              <Text style={s.label}>
                {!knownIncome
                  ? 'Planned commitments'
                  : remaining < 0
                    ? 'Over expected income'
                    : 'Left to plan this month'}
              </Text>
              {!compactHeadline && (
                <Text style={[s.figure, knownIncome && remaining < 0 && s.over]}>
                  {money(knownIncome ? Math.abs(remaining) : plan.totalMinor)}
                </Text>
              )}
            </View>
            {compactHeadline && (
              <Text style={[s.figure, s.trailingFigure, knownIncome && remaining < 0 && s.over]}>
                {money(knownIncome ? Math.abs(remaining) : plan.totalMinor)}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="How this is calculated"
              onPress={() => setShowCalculation(true)}
              style={withPressed(s.info)}
            >
              <Feather name="info" size={17} color={theme.colors.textPrimary} />
            </Pressable>
          </View>
          <View style={s.breakdown}>
            {allocation.length > 0 && (
              <View
                style={s.allocation}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {allocation.map((item) => (
                  <View
                    key={item.label}
                    style={{ flex: item.amount / income, backgroundColor: item.color }}
                  />
                ))}
              </View>
            )}
            <View style={s.facts}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit expected income"
                accessibilityHint={knownIncome ? money(income) : undefined}
                onPress={openEditor}
                style={withPressed([s.fact, s.income, { flexBasis: factBasis }])}
              >
                <View style={s.factLabelRow}>
                  <Text style={s.factLabel}>Expected income</Text>
                  <Feather name="edit-2" size={12} color={theme.colors.link} />
                </View>
                <Text style={[s.value, s.incomeValue]}>{knownIncome ? money(income) : 'Set income'}</Text>
              </Pressable>
              {[
                { label: 'Spending', value: money(plan.spendingMinor), color: theme.colors.link },
                { label: 'Savings', value: money(plan.savingsMinor), color: theme.colors.incomeText },
              ].map((fact) => (
                <View key={fact.label} style={[s.fact, { flexBasis: factBasis }]}>
                  <View style={s.factLabelRow}>
                    {allocation.length > 0 && <View style={[s.dot, { backgroundColor: fact.color }]} />}
                    <Text style={s.factLabel}>{fact.label}</Text>
                  </View>
                  <Text style={s.value}>{fact.value}</Text>
                </View>
              ))}
            </View>
          </View>
          {showCalculation && (
            <ModalSheet
              ledgerStyle
              visible
              title="How this is calculated"
              onClose={() => setShowCalculation(false)}
            >
              <Text style={s.hint}>
                Monthly estimate using {override.value != null ? 'your income estimate' : 'recurring income'}.
                Budget limits cover matching bills; savings transfers cover matching goal funding. Card
                repayments are not added again. Unbudgeted daily spending may be missing.
              </Text>
            </ModalSheet>
          )}
          {plan.incompleteLoans > 0 && (
            <Text style={s.note}>
              {plan.incompleteLoans} borrowed {plan.incompleteLoans === 1 ? 'loan has' : 'loans have'} no
              usable EMI schedule. Their payments are excluded; this estimate is incomplete.
            </Text>
          )}
          {plan.undatedGoals > 0 && (
            <Text style={s.note}>
              {plan.undatedGoals} unfinished or overdue {plan.undatedGoals === 1 ? 'goal has' : 'goals have'}{' '}
              no usable monthly target and {plan.undatedGoals === 1 ? 'is' : 'are'} excluded.
            </Text>
          )}
        </>
      )}
      <ModalSheet
        ledgerStyle
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
const s = themedStyles(() =>
  StyleSheet.create({
    card: {
      marginHorizontal: SCREEN.gutter,
      backgroundColor: theme.colors.home.surface,
      borderColor: theme.colors.home.edge,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 22,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 3,
      overflow: 'hidden',
    },
    summary: { padding: 12 },
    pending: { minHeight: 130, justifyContent: 'center' },
    info: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    period: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    month: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.home.secondaryText },
    title: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.textPrimary },
    headline: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: 4,
      rowGap: 2,
      paddingHorizontal: 2,
      paddingBottom: 4,
    },
    headlineCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 110, minWidth: 0, gap: 2 },
    trailingFigure: { fontFamily: theme.font.bodyBold, textAlign: 'right', fontSize: 27, lineHeight: 33 },
    label: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.home.secondaryText },
    figure: {
      fontFamily: theme.font.bodyBold,
      fontSize: 30,
      lineHeight: 37,
      flexShrink: 1,
      letterSpacing: -0.6,
      fontVariant: ['tabular-nums'],
      color: theme.colors.textPrimary,
    },
    over: { color: theme.colors.expenseText },
    income: { borderRadius: 8 },
    incomeValue: { color: theme.colors.link },
    factLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.home.secondaryText },
    hint: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
    note: {
      fontFamily: theme.font.body,
      fontSize: 12,
      lineHeight: 17,
      color: theme.colors.home.secondaryText,
      paddingTop: 4,
    },
    value: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      color: theme.colors.textPrimary,
    },
    allocation: {
      flexDirection: 'row',
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      gap: 2,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
    breakdown: {
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: theme.colors.home.control,
    },
    facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 4 },
    fact: { flexGrow: 1, flexShrink: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
    factLabelRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 4 },
    error: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.expenseText },
  })
);
