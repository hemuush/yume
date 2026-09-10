import { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { applyRateChange } from '@/db/loans';
import { calculateEmi } from '@/lib/loan';
import { formatMoney } from '@/lib/money';
import { Loan } from '@/types';
import { FormInput } from '@/components/FormInput';
import { SegmentedControl } from '@/components/SegmentedControl';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ModalSheet } from '@/components/ModalSheet';
import { partsToIsoDate } from '@/lib/date';
import { styles } from './loans.styles';

const RATE_CHANGE_MODES: { label: string; value: 'keepEmi' | 'keepTenure' }[] = [
  { label: 'Keep EMI, change tenure', value: 'keepEmi' },
  { label: 'Keep tenure, change EMI', value: 'keepTenure' },
];

export function RateChangeModal({
  loan,
  remainingMonths,
  onClose,
  onDone,
}: {
  loan: Loan;
  remainingMonths: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [newRate, setNewRate] = useState((loan.interestRateAnnualBp / 100).toString());
  // Real lenders always offer both — reduce/raise the EMI and keep the same
  // payoff date, or keep the EMI exactly as-is and let the remaining tenure
  // shrink/stretch instead. Previously this only ever did the second one.
  const [mode, setMode] = useState<'keepEmi' | 'keepTenure'>('keepEmi');
  // Previously always "today", with no way to say a rate change actually
  // took effect earlier — a floating rate reset the bank applied two
  // statements ago, only now being entered into Yume, had nowhere to
  // record when it really happened.
  const [effYear, setEffYear] = useState(String(today.getFullYear()));
  const [effMonth, setEffMonth] = useState(String(today.getMonth() + 1));
  const [effDay, setEffDay] = useState(String(today.getDate()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rateBp = Math.round(parseFloat(newRate || '0') * 100);
  const previewNewEmi =
    mode === 'keepTenure' && Number.isFinite(rateBp) && rateBp >= 0 && remainingMonths > 0
      ? calculateEmi(loan.outstandingPrincipalMinor, rateBp, remainingMonths)
      : null;

  const submit = async () => {
    setError(null);
    if (!Number.isFinite(rateBp) || rateBp < 0) {
      setError('Enter a valid interest rate');
      return;
    }
    const effectiveDate = partsToIsoDate(effYear, effMonth, effDay);
    if (!effectiveDate) {
      setError('Enter a valid effective date');
      return;
    }
    setSaving(true);
    try {
      await applyRateChange(loan.id, { newAnnualRateBp: rateBp, effectiveDate, mode });
      onDone();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet visible onClose={onClose} variant="center" showClose title="Update interest rate">
      <Text style={styles.cardSub}>Current rate: {(loan.interestRateAnnualBp / 100).toFixed(2)}%</Text>
      <FormInput
        label="New annual interest rate (%)"
        value={newRate}
        onChangeText={setNewRate}
        keyboardType="numeric"
        placeholder="e.g. 9.75"
      />
      <Text style={styles.fieldLabel}>Effective from</Text>
      <View style={styles.dateFieldsRow}>
        <View style={{ flex: 1 }}>
          <FormInput
            label="Day"
            value={effDay}
            onChangeText={setEffDay}
            keyboardType="numeric"
            placeholder="DD"
            style={styles.dateFieldInput}
          />
        </View>
        <View style={{ flex: 1 }}>
          <FormInput
            label="Month"
            value={effMonth}
            onChangeText={setEffMonth}
            keyboardType="numeric"
            placeholder="MM"
            style={styles.dateFieldInput}
          />
        </View>
        <View style={{ flex: 1.3 }}>
          <FormInput
            label="Year"
            value={effYear}
            onChangeText={setEffYear}
            keyboardType="numeric"
            placeholder="YYYY"
            style={styles.dateFieldInput}
          />
        </View>
      </View>
      <Text style={styles.hintText}>
        Defaults to today — change it if your bank actually applied this rate change earlier and you're only
        entering it now. This doesn't rewrite already-paid installments; it only affects which ones are still
        pending.
      </Text>
      <Text style={styles.fieldLabel}>When the rate changes, your bank lets you choose:</Text>
      <SegmentedControl options={RATE_CHANGE_MODES} value={mode} onChange={setMode} />
      {mode === 'keepEmi' ? (
        <Text style={styles.hintText}>
          EMI stays {formatMoney(loan.emiAmountMinor)}; the remaining schedule recalculates at the new rate
          from your next unpaid installment — tenure gets shorter or longer instead.
        </Text>
      ) : (
        <Text style={styles.hintText}>
          Tenure stays at {remainingMonths} more installment{remainingMonths === 1 ? '' : 's'}; the EMI
          recalculates to still pay off exactly on schedule
          {previewNewEmi != null ? ` — new EMI would be ${formatMoney(previewNewEmi)}` : ''}.
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
