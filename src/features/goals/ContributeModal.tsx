import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { contributeToGoal, markGoalLetterRevealed } from '@/db/savingsGoals';
import { toMinor, inputMinor } from '@/lib/money';
import { SavingsGoal } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { modalFooterStyles as f } from '@/constants/theme';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { GoalLetterReveal } from './GoalLetterReveal';
import { GoalSheetCard } from './GoalSheetCard';
import { haptics } from '@/lib/haptics';
import { styles } from './goals.styles';
import { errorMessage } from '@/lib/errorMessage';

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
  // Set only when this contribution is the one that first pushes the goal
  // to its target and there's a sealed note to hand back — see submit()
  // below. Holding this locally (rather than calling onContributed right
  // away) is what keeps the sheet open on the reveal instead of the host
  // screen closing it out from under this component.
  const [reveal, setReveal] = useState<{ note: string } | null>(null);

  useEffect(() => {
    if (!goal) return;
    setDirection('add');
    setAmount('');
    setError(null);
    setReveal(null);
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
      const deltaMinor = direction === 'add' ? amountMinor : -amountMinor;
      await contributeToGoal(goal.id, deltaMinor);
      haptics.tap();
      // The crossing check lives here, not in contributeToGoal — this is
      // the one place that already holds both the pre-contribution amount
      // and the note, with no extra read needed. `>=` on the *new* total
      // is deliberate: someone who adds more than needed in one go still
      // gets the reveal, same as landing exactly on the target.
      const justCompleted =
        direction === 'add' &&
        goal.currentAmountMinor < goal.targetAmountMinor &&
        goal.currentAmountMinor + deltaMinor >= goal.targetAmountMinor;
      if (justCompleted && goal.noteToSelf && !goal.letterRevealed) {
        await markGoalLetterRevealed(goal.id);
        setReveal({ note: goal.noteToSelf });
      } else {
        onContributed();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      visible
      onClose={reveal ? onContributed : onClose}
      footer={
        reveal ? (
          <PrimaryButton title="Nice, thanks Suu" onPress={onContributed} />
        ) : (
          <View style={f.footerCol}>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <PrimaryButton
              title={saving ? 'Saving…' : direction === 'add' ? 'Add money' : 'Withdraw'}
              onPress={submit}
              disabled={saving}
            />
          </View>
        )
      }
    >
      {reveal ? (
        <GoalLetterReveal
          goalName={goal.name}
          note={reveal.note}
          targetAmountMinor={goal.targetAmountMinor}
        />
      ) : (
        <>
          {/* The goal as it'll stand once this goes in (or comes out). */}
          <GoalSheetCard
            name={goal.name}
            savedMinor={Math.max(
              0,
              goal.currentAmountMinor + (direction === 'add' ? 1 : -1) * inputMinor(amount)
            )}
            targetMinor={goal.targetAmountMinor}
            targetDate={goal.targetDate}
            kicker={inputMinor(amount) > 0 ? 'After this' : undefined}
          />
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
        </>
      )}
    </ModalSheet>
  );
}
