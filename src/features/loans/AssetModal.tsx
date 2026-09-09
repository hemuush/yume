import { useState } from 'react';
import { View, Text } from 'react-native';
import { updateLoanAsset } from '@/db/loans';
import { toMinor, formatMoney } from '@/lib/money';
import { Loan } from '@/types';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ModalSheet } from '@/components/ModalSheet';
import { styles } from './loans.styles';

export function AssetModal({
  loan,
  onClose,
  onDone,
}: {
  loan: Loan;
  onClose: () => void;
  onDone: () => void;
}) {
  const [label, setLabel] = useState(loan.assetLabel ?? '');
  const [value, setValue] = useState(loan.assetValueMinor ? String(loan.assetValueMinor / 100) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    // The value is optional — someone may want to record "this loan financed
    // my Home" now and fill in a real estimate later, rather than being
    // blocked on having one on hand right away. Only validated when actually
    // provided; equity math (in Reports/Profile) simply treats "no value"
    // the same as "not tracked" until one is set.
    let valueMinor: number | null = null;
    if (value.trim()) {
      valueMinor = toMinor(parseFloat(value));
      if (!Number.isFinite(valueMinor) || valueMinor <= 0) {
        setError('Enter a valid current value, or leave it blank for now');
        return;
      }
    }
    setSaving(true);
    try {
      await updateLoanAsset(loan.id, { assetLabel: label.trim() || 'Asset', assetValueMinor: valueMinor });
      onDone();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const stopTracking = async () => {
    setSaving(true);
    try {
      await updateLoanAsset(loan.id, { assetLabel: null, assetValueMinor: null });
      onDone();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet visible onClose={onClose} variant="center" title="Loan asset">
      <FormInput label="What is it?" value={label} onChangeText={setLabel} placeholder="e.g. Home, Car" />
      <FormInput
        label="Current estimated value (optional)"
        value={value}
        onChangeText={setValue}
        keyboardType="numeric"
        placeholder="e.g. 3500000"
      />
      <Text style={styles.hintText}>
        Leave it blank if you don't have an estimate yet — you can add one later. Once set, value minus what's
        still owed ({formatMoney(loan.outstandingPrincipalMinor)}) counts toward Tracked Balance/Net Worth.
        Flynse doesn't estimate it for you, so update it whenever the real value changes.
      </Text>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <View style={styles.modalActions}>
        <PrimaryButton
          title="Cancel"
          variant="secondary"
          onPress={onClose}
          disabled={saving}
          style={{ flex: 1, marginRight: 8 }}
        />
        <PrimaryButton
          title={saving ? 'Saving...' : 'Save'}
          onPress={submit}
          disabled={saving}
          style={{ flex: 1 }}
        />
      </View>
      {!!loan.assetValueMinor && (
        <PrimaryButton
          title="Stop tracking this asset"
          variant="secondary"
          onPress={stopTracking}
          disabled={saving}
          style={{ marginTop: 8 }}
        />
      )}
    </ModalSheet>
  );
}
