import { useState } from 'react';
import { View, Text } from 'react-native';
import { applyPrepayment } from '@/db/loans';
import { toMinor, formatMoney } from '@/lib/money';
import { Loan, Account } from '@/types';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { ModalSheet } from '@/components/ModalSheet';
import { toLocalIsoDate } from '@/lib/date';
import { styles } from './loans.styles';

/**
 * Jurisdiction-specific tax-on-fee conventions that Flynse can offer as a
 * one-tap fill-in, purely as a labeled convenience — never a silent
 * default. Nothing in the actual charge math assumes any of these; a user
 * whose account isn't in one of these currencies just sees a plain
 * percentage field with no quick-fill at all, which is the correct default
 * for a jurisdiction Flynse knows nothing about.
 */
const TAX_ON_FEE_PRESETS: Record<string, { label: string; percent: number }> = {
  INR: { label: '18% GST', percent: 18 },
};

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
  // agreement and the laws where it was taken out, neither of which Flynse
  // knows. Starts blank for every loan; the hint text below explains what
  // to go check rather than guessing a number.
  const [chargePercent, setChargePercent] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountMinor = toMinor(parseFloat(amount || '0'));
  const chargeBaseMinor = Math.round(amountMinor * (parseFloat(chargePercent || '0') / 100));
  const chargeMinor = Math.max(
    0,
    chargeBaseMinor + Math.round(chargeBaseMinor * (parseFloat(taxPercent || '0') / 100))
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
        `Amount can't exceed the outstanding balance of ${formatMoney(loan.outstandingPrincipalMinor)}`
      );
      return;
    }
    setSaving(true);
    try {
      await applyPrepayment(loan.id, {
        amountMinor,
        accountId: account.id,
        categoryId,
        date: toLocalIsoDate(new Date()),
        chargeAmountMinor: chargeMinor > 0 ? chargeMinor : undefined,
      });
      onDone();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet visible onClose={onClose} variant="center" title="Make a prepayment">
      <Text style={styles.cardSub}>Outstanding: {formatMoney(loan.outstandingPrincipalMinor)}</Text>
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

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.modalActions}>
        <PrimaryButton
          title="Cancel"
          variant="secondary"
          onPress={onClose}
          style={{ flex: 1, marginRight: 8 }}
        />
        <PrimaryButton
          title={saving ? 'Saving...' : 'Confirm'}
          onPress={submit}
          disabled={saving}
          style={{ flex: 1 }}
        />
      </View>
    </ModalSheet>
  );
}
