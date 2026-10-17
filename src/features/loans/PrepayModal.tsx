import { useSaveOnce } from '@/lib/useSaveOnce';
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { applyPrepayment, previewPrepayment, PrepaymentSummary } from '@/db/loans';
import { toMinor, formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { theme, modalFooterStyles as f } from '@/constants/theme';
import { Loan, Account } from '@/types';
import { AmountField } from '@/components/AmountField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { ModalSheet } from '@/components/ModalSheet';
import { toLocalIsoDate } from '@/lib/date';
import { styles } from './loans.styles';
import { shortMonthYear } from '@/lib/dateLabels';
import { errorMessage } from '@/lib/errorMessage';
import { CompletionCard } from '@/components/CompletionCard';

/**
 * Jurisdiction-specific tax-on-fee conventions offered as a labelled one-tap fill, never a silent default.
 * Nothing in the charge math assumes them; other currencies get a plain percentage field, no quick-fill.
 */
const TAX_ON_FEE_PRESETS: Record<string, { label: string; percent: number }> = {
  INR: { label: '18% GST', percent: 18 },
};

/** The before-you-confirm version of PrepaymentReveal: the same three numbers, as plain rows. */
function PrepaymentPreview({
  preview,
  lent,
}: {
  preview: PrepaymentSummary & { neverPaysOff: boolean };
  /** A loan you gave: the borrower prepays, and the interest is yours to stop receiving. */
  lent: boolean;
}) {
  if (preview.neverPaysOff) {
    return (
      <Text style={styles.errorText}>
        At this amount the current EMI wouldn&rsquo;t cover the interest on what&rsquo;s left. Try a larger
        prepayment.
      </Text>
    );
  }
  const closes = preview.newRemainingCount === 0;
  return (
    <View style={previewStyles.card} accessibilityLabel="Prepayment preview">
      <Text style={previewStyles.head}>
        {lent ? 'If they prepay this today' : 'If you prepay this today'}
      </Text>
      <PreviewRow
        label={lent ? "Interest you won't receive" : 'Interest saved'}
        value={formatMoney(preview.interestSavedMinor)}
        strong={!lent}
      />
      <PreviewRow
        label="Loan ends"
        value={closes ? 'Closed today' : shortMonthYear(preview.newPayoffDate)}
        was={closes || preview.monthsShaved > 0 ? shortMonthYear(preview.oldPayoffDate) : undefined}
      />
      <PreviewRow label="EMIs saved" value={String(preview.monthsShaved)} />
    </View>
  );
}

function PreviewRow({
  label,
  value,
  was,
  strong,
}: {
  label: string;
  value: string;
  was?: string;
  strong?: boolean;
}) {
  return (
    <View style={previewStyles.row}>
      <Text style={previewStyles.label}>{label}</Text>
      <Text style={[previewStyles.value, strong && previewStyles.valueStrong]}>
        {was && <Text style={previewStyles.was}>{was} </Text>}
        {value}
      </Text>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  card: {
    marginTop: 10,
    marginBottom: 6,
    padding: 12,
    gap: 6,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.incomeTint,
  },
  head: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  label: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textPrimary },
  value: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
  valueStrong: { color: theme.colors.incomeText },
  was: { fontFamily: theme.font.mono, color: theme.colors.textMuted, textDecorationLine: 'line-through' },
});

function PrepaymentReveal({ summary, lent }: { summary: PrepaymentSummary; lent: boolean }) {
  const closed = summary.newRemainingCount === 0;
  const detail = closed
    ? lent
      ? 'Fully repaid. No installments remain.'
      : 'Fully paid off. No installments remain.'
    : summary.monthsShaved > 0
      ? `${summary.monthsShaved} fewer installment${summary.monthsShaved === 1 ? '' : 's'}. Your new payoff date is ${shortMonthYear(summary.newPayoffDate)}.`
      : 'Your balance is lower. The payoff date stays the same.';
  return (
    <CompletionCard title={closed ? 'Loan closed' : 'Prepayment saved'} detail={detail}>
      {summary.interestSavedMinor > 0 && (
        <View style={revealStyles.result}>
          <Text style={revealStyles.label}>{lent ? 'Less interest to receive' : 'Interest saved'}</Text>
          <Text style={revealStyles.value}>{formatMoney(summary.interestSavedMinor)}</Text>
        </View>
      )}
      {!closed && summary.monthsShaved > 0 && (
        <Text style={revealStyles.previous}>Previously ending {shortMonthYear(summary.oldPayoffDate)}</Text>
      )}
    </CompletionCard>
  );
}
const revealStyles = StyleSheet.create({
  result: { backgroundColor: theme.colors.incomeTint, borderRadius: 14, padding: 14, gap: 6 },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  value: { fontFamily: theme.font.monoBold, fontSize: 22, color: theme.colors.incomeText },
  previous: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
});

export function PrepayModal({
  loan,
  account,
  categoryId,
  onClose,
  backLabel,
  onDone,
}: {
  loan: Loan;
  account: Account;
  categoryId: string;
  onClose: () => void;
  backLabel?: string;
  onDone: () => void;
}) {
  const lent = loan.direction === 'lent';
  const runAction = useSaveOnce(async (action: () => Promise<void>) => {
    await action();
  });
  const [amount, setAmount] = useState('');
  // No jurisdiction default is assumed: whether a prepayment charge applies, and how much, depends on the
  // loan agreement and local law, which Yume can't know. Starts blank; the hint below says what to check.
  const [chargePercent, setChargePercent] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the prepayment succeeds: swaps the form for a reveal of what it bought (interest saved, months
  // shaved) instead of silently closing, using the comparison `applyPrepayment` already computes.
  const [result, setResult] = useState<PrepaymentSummary | null>(null);

  const amountMinor = toMinor(parseFloat(amount || '0'));
  const chargeBaseMinor = Math.round(amountMinor * (parseFloat(chargePercent || '0') / 100));
  // Rounded to a whole rupee like every other stored amount, so the "Charge +
  // amount = total debited" line the user sees actually adds up.
  const chargeMinor = roundedMinor(
    // Tax on the charge is for a lender's fee you pay; a charge paid to you has no field for it.
    Math.max(
      0,
      chargeBaseMinor + (lent ? 0 : Math.round(chargeBaseMinor * (parseFloat(taxPercent || '0') / 100)))
    )
  );
  const taxPreset = TAX_ON_FEE_PRESETS[account.currency];
  // The balance is shown rounded to a whole rupee, so typing exactly what's shown may sit a few paise above
  // the exact balance. That means "pay it all off": send the exact balance so the DB's cap isn't tripped.
  const payMinor = Math.min(amountMinor, loan.outstandingPrincipalMinor);

  // What this amount would save, shown before Confirm; same calculation Confirm records (previewPrepayment/
  // planPrepayment) so the reveal can't disagree. Debounced after typing; a slower earlier result is dropped.
  const [preview, setPreview] = useState<(PrepaymentSummary & { neverPaysOff: boolean }) | null>(null);
  useEffect(() => {
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      previewPrepayment(loan.id, payMinor, toLocalIsoDate(new Date()))
        .then((p) => {
          if (!cancelled) setPreview(p);
        })
        .catch(() => {
          if (!cancelled) setPreview(null);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [amountMinor, payMinor, loan.id]);

  const submit = () =>
    runAction(async () => {
      setError(null);
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
        setError('Enter a valid amount');
        return;
      }
      if (amountMinor > roundedMinor(loan.outstandingPrincipalMinor)) {
        setError(
          `Amount can't exceed the outstanding balance of ${formatMoney(roundedMinor(loan.outstandingPrincipalMinor))}`
        );
        return;
      }
      if (
        ![chargePercent, ...(lent ? [] : [taxPercent])].every(
          (value) => !value.trim() || (Number.isFinite(Number(value)) && Number(value) >= 0)
        )
      ) {
        setError('Enter a valid non-negative charge and tax percentage');
        return;
      }
      setSaving(true);
      try {
        const summary = await applyPrepayment(loan.id, {
          amountMinor: payMinor,
          accountId: account.id,
          categoryId,
          date: toLocalIsoDate(new Date()),
          chargeAmountMinor: chargeMinor > 0 ? chargeMinor : undefined,
        });
        setResult(summary);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setSaving(false);
      }
    });

  if (result) {
    return (
      <ModalSheet
        backLabel={backLabel}
        dismissible={!saving}
        visible
        onClose={onDone}
        title="Payment saved"
        footer={<PrimaryButton title="Done" onPress={onDone} />}
      >
        <PrepaymentReveal summary={result} lent={lent} />
      </ModalSheet>
    );
  }

  return (
    <ModalSheet
      backLabel={backLabel}
      dismissible={!saving}
      visible
      onClose={onClose}
      variant="center"
      title={lent ? 'Record a prepayment' : 'Make a prepayment'}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton
            title={saving ? 'Saving…' : lent ? 'Record prepayment' : 'Apply prepayment'}
            onPress={submit}
            disabled={saving}
          />
        </View>
      }
    >
      <Text style={styles.cardSub}>
        Outstanding: {formatMoney(roundedMinor(loan.outstandingPrincipalMinor))}
      </Text>
      <AmountField
        label={lent ? 'Amount they paid' : 'Amount'}
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
      />
      <Text style={styles.hintText}>EMI stays the same; the remaining tenure shortens.</Text>
      {preview && <PrepaymentPreview preview={preview} lent={lent} />}

      <AmountField
        label={lent ? 'Charge they paid you, if any (%)' : 'Prepayment charge, if any (%)'}
        value={chargePercent}
        onChangeText={setChargePercent}
        placeholder="0"
      />
      <Text style={styles.hintText}>
        {lent
          ? 'Only if your agreement with them asks for one. Leave at 0% if none applies.'
          : "Whether this applies — and how much — depends on your loan's own terms and local rules on variable- vs fixed-rate consumer loans; check your agreement or latest statement. Leave at 0% if none applies."}
      </Text>
      {!lent && parseFloat(chargePercent || '0') > 0 && (
        <>
          <AmountField
            label="Tax on that charge, if any (%)"
            value={taxPercent}
            onChangeText={setTaxPercent}
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
          {lent
            ? `Charge: ${formatMoney(chargeMinor)} — recorded as income, separate from the ${formatMoney(amountMinor)} coming back toward the loan itself. Total received in ${account.name}: `
            : `Charge: ${formatMoney(chargeMinor)} — recorded as its own expense, separate from the ${formatMoney(amountMinor)} going toward the loan itself. Total debited from ${account.name}: `}
          {formatMoney(amountMinor + chargeMinor)}.
        </Text>
      )}
    </ModalSheet>
  );
}
