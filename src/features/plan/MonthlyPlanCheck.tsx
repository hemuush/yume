import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { InsightDisclosure } from '@/components/InsightCard';
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
import { SCREEN } from '@/components/screenStyles';
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
  const { fontScale } = useWindowDimensions();
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
  const money = (value: number) => formatMoney(value, currency);
  const spendShare = knownIncome ? Math.min(100, (plan.spendingMinor / Math.max(1, income)) * 100) : 0;
  const saveShare = knownIncome
    ? Math.min(100 - spendShare, (plan.savingsMinor / Math.max(1, income)) * 100)
    : 0;
  const factBasis = Math.round(84 * Math.min(2, Math.max(1, fontScale)));
  const openEditor = () => {
    setAmount(String(income / 100));
    setError('');
    setOpen(true);
  };
  return (
    <View style={s.card}>
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
          <View style={s.top}>
            <View style={s.topMain}>
              <Text style={s.label}>
                {!knownIncome
                  ? 'Monthly plan'
                  : remaining < 0
                    ? 'Over expected income'
                    : 'Left to plan this month'}
              </Text>
              <Text
                style={[s.figure, knownIncome && remaining < 0 && { color: theme.colors.expenseText }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {knownIncome ? money(Math.abs(remaining)) : 'Set expected income'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit expected income"
              onPress={openEditor}
              style={s.income}
            >
              <Text style={[s.incomeText, { color: themeInk(accent) }]}>
                {knownIncome ? `Income ${money(income)}` : 'Set income'}
              </Text>
              <Feather name="edit-2" size={13} color={themeInk(accent)} />
            </Pressable>
          </View>
          {knownIncome && (
            <View style={s.track}>
              <View
                style={[s.segment, { flexGrow: spendShare, backgroundColor: theme.colors.slice.spent }]}
              />
              <View style={[s.segment, { flexGrow: saveShare, backgroundColor: theme.colors.slice.saved }]} />
              <View style={{ flexGrow: Math.max(0, 100 - spendShare - saveShare), flexBasis: 0 }} />
            </View>
          )}
          <View style={s.facts}>
            {[
              { label: 'Spending', value: money(plan.spendingMinor), dot: theme.colors.slice.spent },
              { label: 'Savings', value: money(plan.savingsMinor), dot: theme.colors.slice.saved },
            ].map((fact) => (
              <View key={fact.label} style={[s.fact, { flexBasis: factBasis }]}>
                <View style={s.factLabelRow}>
                  <View style={[s.dot, { backgroundColor: fact.dot }]} />
                  <Text style={s.hint}>{fact.label}</Text>
                </View>
                <Text style={s.value}>{fact.value}</Text>
              </View>
            ))}
          </View>
          <View style={s.disclosure}>
            <InsightDisclosure title="How this is calculated">
              <Text style={s.hint}>
                Monthly estimate using {override.value != null ? 'your income estimate' : 'recurring income'}.
                Budget limits cover matching bills; savings transfers cover matching goal funding. Card
                repayments are not added again. Unbudgeted daily spending may be missing.
              </Text>
            </InsightDisclosure>
          </View>
          {plan.incompleteLoans > 0 && (
            <Text style={s.note}>
              {plan.incompleteLoans} borrowed {plan.incompleteLoans === 1 ? 'loan has' : 'loans have'} no
              usable EMI schedule. Their payments are excluded; this estimate is incomplete.
            </Text>
          )}
          {plan.undatedGoals > 0 && (
            <Text style={s.note}>
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
  // The flat summary card the other screens lead with.
  card: {
    marginHorizontal: SCREEN.gutter,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    boxShadow: '0px 1px 2px rgba(18,19,15,0.04), 0px 8px 24px rgba(18,19,15,0.05)',
  },
  title: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 2,
  },
  topMain: { flexShrink: 1, minWidth: 0 },
  label: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  figure: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  income: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  incomeText: { fontFamily: theme.font.bodyBold, fontSize: 12 },
  hint: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
  note: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    paddingBottom: 8,
  },
  value: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  track: {
    flexDirection: 'row',
    gap: 2,
    height: 8,
    marginTop: -6,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: theme.colors.trayTrack,
  },
  segment: { flexBasis: 0, height: 8 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8, paddingHorizontal: 2 },
  fact: { flexGrow: 1, minWidth: 0 },
  factLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  disclosure: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
  error: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.expenseText },
});
