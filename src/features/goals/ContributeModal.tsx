import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { contributeToGoal } from '@/db/savingsGoals';
import { toMinor, formatMoney } from '@/lib/money';
import { SavingsGoal } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { modalFooterStyles as f } from '@/constants/theme';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { haptics } from '@/lib/haptics';
import { styles } from './goals.styles';

type Direction = 'add' | 'withdraw';
const DIRECTIONS: { label: string; value: Direction }[] = [
  { label: 'Add money', value: 'add' },
  { label: 'Withdraw', value: 'withdraw' },
];

/** The quick "+ Add money" flow opened from a GoalCard — a single amount, in either direction. */
export function ContributeModal({
  goal,
  onClose,
  onContributed,
}: {
  goal: SavingsGoal | null;
  onClose: () => void;
  onContributed: () => void;
}) {
  const [direction, setDirection] = useState<Direction>('add');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!goal) return;
    setDirection('add');
    setAmount('');
    setError(null);
  }, [goal]);

  if (!goal) return null;

  const submit = async () => {
    setError(null);
    const amountMinor = toMinor(parseFloat(amount || '0'));
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await contributeToGoal(goal.id, direction === 'add' ? amountMinor : -amountMinor);
      haptics.tap();
      onContributed();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      visible
      onClose={onClose}
      title={goal.name}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={f.footerRow}>
            <PrimaryButton title="Cancel" variant="secondary" onPress={onClose} style={f.footerBtn} />
            <PrimaryButton
              title={saving ? 'Saving...' : direction === 'add' ? 'Add' : 'Withdraw'}
              onPress={submit}
              disabled={saving}
              style={f.footerBtn}
            />
          </View>
        </View>
      }
    >
      <Text style={styles.modalHint}>
        Currently {formatMoney(goal.currentAmountMinor)} of {formatMoney(goal.targetAmountMinor)} saved.
      </Text>
      <SegmentedControl options={DIRECTIONS} value={direction} onChange={setDirection} />
      <View style={{ height: 14 }} />
      <FormInput
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="e.g. 2000"
        autoFocus
      />
    </ModalSheet>
  );
}
