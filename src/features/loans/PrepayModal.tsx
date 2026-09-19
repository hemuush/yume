import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { applyPrepayment, PrepaymentSummary } from '@/db/loans';
import { toMinor, formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { theme } from '@/constants/theme';
import { Loan, Account } from '@/types';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { ModalSheet } from '@/components/ModalSheet';
import { modalFooterStyles as f } from '@/constants/theme';
import { toLocalIsoDate, parseLocalIsoDate } from '@/lib/date';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { styles } from './loans.styles';

/**
 * Jurisdiction-specific tax-on-fee conventions that Yume can offer as a
 * one-tap fill-in, purely as a labeled convenience — never a silent
 * default. Nothing in the actual charge math assumes any of these; a user
 * whose account isn't in one of these currencies just sees a plain
 * percentage field with no quick-fill at all, which is the correct default
 * for a jurisdiction Yume knows nothing about.
 */
const TAX_ON_FEE_PRESETS: Record<string, { label: string; percent: number }> = {
  INR: { label: '18% GST', percent: 18 },
};

function monthLabel(iso: string): string {
  return parseLocalIsoDate(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

// A decorative tick row, not a literal one-tick-per-installment schedule — a
// 240-month home loan would overflow a row at that scale. Scaled down
// proportionally so the "the tail shrinks" read stays clear regardless of
// the loan's real remaining length.
const MAX_TICKS = 26;

function PrepaymentReveal({ summary, onDone }: { summary: PrepaymentSummary; onDone: () => void }) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay: 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 260, delay: 60, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 440, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  const scale = MAX_TICKS / Math.max(summary.oldRemainingCount, 1);
  const oldTicks = Math.max(1, Math.round(summary.oldRemainingCount * Math.min(1, scale)));
  const shavedTicks = Math.max(
    summary.monthsShaved > 0 ? 1 : 0,
    Math.round(summary.monthsShaved * Math.min(1, scale))
  );
  const keptTicks = Math.max(0, oldTicks - shavedTicks);
  const closedOutright = summary.newRemainingCount === 0;

  return (
    <View>
      <Animated.View pointerEvents="none" style={[revealStyles.glow, { opacity: glow }]} />
      <View style={revealStyles.ticks}>
        {Array.from({ length: keptTicks }, (_, i) => (
          <View key={`k${i}`} style={revealStyles.tick} />
        ))}
        {Array.from({ length: shavedTicks }, (_, i) => (
          <Animated.View
            key={`s${i}`}
            style={[
              revealStyles.tick,
              revealStyles.tickShaved,
              {
                opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [{ scaleY: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }) }],
              },
            ]}
          />
        ))}
      </View>

      <Animated.View
        style={{
          opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }),
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
        }}
      >
        <Text style={revealStyles.saved}>
          {summary.interestSavedMinor > 0
            ? `${formatMoney(summary.interestSavedMinor)} in interest saved`
            : closedOutright
              ? 'Loan closed'
              : 'Prepayment applied'}
        </Text>
        <Text style={revealStyles.sub}>
          {closedOutright
            ? `Fully paid off — no installments left.`
            : summary.monthsShaved > 0
              ? `${summary.monthsShaved} installment${summary.monthsShaved === 1 ? '' : 's'} shaved off — done in ${monthLabel(summary.newPayoffDate)} instead of ${monthLabel(summary.oldPayoffDate)}.`
              : `Payoff date unchanged, but you now owe less along the way.`}
        </Text>
      </Animated.View>

      <PrimaryButton title="Nice!" onPress={onDone} style={revealStyles.doneBtn} />
    </View>
  );
}

const revealStyles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: -10,
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.secondary,
  },
  ticks: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 20 },
  tick: { width: 6, height: 14, borderRadius: 2, backgroundColor: theme.colors.borderSoft },
  tickShaved: { backgroundColor: theme.colors.secondary },
  saved: { fontFamily: theme.font.monoBold, fontSize: 18, color: theme.colors.income, marginTop: 14 },
  sub: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  doneBtn: { marginTop: 20 },
});

export function PrepayModal({
  loan,
  account,
  categoryId,
  onClose,
  onDone,
}: {
  loan: Loan;
  account: Account;
  categoryId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  // No jurisdiction default is assumed here at all — whether a prepayment
  // charge applies, and how much, depends entirely on the individual loan
  // agreement and the laws where it was taken out, neither of which Yume
  // knows. Starts blank for every loan; the hint text below explains what
  // to go check rather than guessing a number.
  const [chargePercent, setChargePercent] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the prepayment actually succeeds — swaps the form for a reveal
  // of what it bought (interest saved, months shaved) instead of the modal
  // just closing silently, since `applyPrepayment` already computes that
  // comparison and previously threw it away.
  const [result, setResult] = useState<PrepaymentSummary | null>(null);

  const amountMinor = toMinor(parseFloat(amount || '0'));
  const chargeBaseMinor = Math.round(amountMinor * (parseFloat(chargePercent || '0') / 100));
  // Rounded to a whole rupee like every other stored amount, so the "Charge +
  // amount = total debited" line the user sees actually adds up.
  const chargeMinor = roundedMinor(
    Math.max(0, chargeBaseMinor + Math.round(chargeBaseMinor * (parseFloat(taxPercent || '0') / 100)))
  );
  const taxPreset = TAX_ON_FEE_PRESETS[account.currency];

  const submit = async () => {
    setError(null);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (amountMinor > loan.outstandingPrincipalMinor) {
      setError(
        `Amount can't exceed the outstanding balance of ${formatMoney(roundedMinor(loan.outstandingPrincipalMinor))}`
      );
      return;
    }
    setSaving(true);
    try {
      const summary = await applyPrepayment(loan.id, {
        amountMinor,
        accountId: account.id,
        categoryId,
        date: toLocalIsoDate(new Date()),
        chargeAmountMinor: chargeMinor > 0 ? chargeMinor : undefined,
      });
      setResult(summary);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <ModalSheet visible onClose={onDone} variant="center" showClose title="Prepayment applied">
        <PrepaymentReveal summary={result} onDone={onDone} />
      </ModalSheet>
    );
  }

  return (
    <ModalSheet
      visible
      onClose={onClose}
      variant="center"
      showClose
      title="Make a prepayment"
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={f.footerRow}>
            <PrimaryButton title="Cancel" variant="secondary" onPress={onClose} style={f.footerBtn} />
            <PrimaryButton
              title={saving ? 'Saving...' : 'Confirm'}
              onPress={submit}
              disabled={saving}
              style={f.footerBtn}
            />
          </View>
        </View>
      }
    >
      <Text style={styles.cardSub}>
        Outstanding: {formatMoney(roundedMinor(loan.outstandingPrincipalMinor))}
      </Text>
      <FormInput
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="0.00"
      />
      <Text style={styles.hintText}>EMI stays the same; the remaining tenure shortens.</Text>

      <FormInput
        label="Prepayment charge, if any (%)"
        value={chargePercent}
        onChangeText={setChargePercent}
        keyboardType="numeric"
        placeholder="0"
      />
      <Text style={styles.hintText}>
        Whether this applies — and how much — depends on your loan's own terms and local rules on variable- vs
        fixed-rate consumer loans; check your agreement or latest statement. Leave at 0% if none applies.
      </Text>
      {parseFloat(chargePercent || '0') > 0 && (
        <>
          <FormInput
            label="Tax on that charge, if any (%)"
            value={taxPercent}
            onChangeText={setTaxPercent}
            keyboardType="numeric"
            placeholder="0"
          />
          {taxPreset && (
            <View style={styles.chipRow}>
              <Chip
                label={taxPreset.label}
                active={taxPercent === String(taxPreset.percent)}
                onPress={() => setTaxPercent(String(taxPreset.percent))}
              />
            </View>
          )}
        </>
      )}
      {chargeMinor > 0 && (
        <Text style={styles.hintText}>
          Charge: {formatMoney(chargeMinor)} — recorded as its own expense, separate from the{' '}
          {formatMoney(amountMinor)} going toward the loan itself. Total debited from {account.name}:{' '}
          {formatMoney(amountMinor + chargeMinor)}.
        </Text>
      )}
    </ModalSheet>
  );
}
