import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { contributeToGoal, markGoalLetterRevealed } from '@/db/savingsGoals';
import { toMinor, inputMinor } from '@/lib/money';
import { SavingsGoal } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { modalFooterStyles as f } from '@/constants/theme';
import { AmountField } from '@/components/AmountField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { GoalLetterReveal } from './GoalLetterReveal';
import { GoalSheetCard } from './GoalSheetCard';
import { haptics } from '@/lib/haptics';
import { styles } from './goals.styles';
import { errorMessage } from '@/lib/errorMessage';
import { useMilestoneNote } from '@/components/MilestoneNote';
import { usePrivacy } from '@/theme/PrivacyContext';
import { getMilestonesSeen, markMilestonesSeen } from '@/db/settings';
import { goalMilestoneCopy, goalMilestoneKey, milestonesUpTo, milestoneReached } from '@/lib/milestones';

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
  // Set only when this contribution first pushes the goal to target and a sealed note exists (see submit()).
  // Held locally so the sheet stays open on the reveal instead of the host closing it.
  const [reveal, setReveal] = useState<{ note: string } | null>(null);
  const showNote = useMilestoneNote();
  const { hideAmounts } = usePrivacy();

  useEffect(() => {
    if (!goal) return;
    setDirection('add');
    setAmount('');
    setError(null);
    setReveal(null);
  }, [goal]);

  if (!goal) return null;

  // Once per line, ever: crossing 25 and 50 in one save marks both so neither fires later. The sealed-letter
  // reveal already marks a finished goal, so 100% is remembered but not announced a second time.
  const announceMilestone = async (deltaMinor: number, letterShown: boolean) => {
    if (!goal) return;
    try {
      const after = goal.currentAmountMinor + deltaMinor;
      const reached = milestoneReached(goal.currentAmountMinor, after, goal.targetAmountMinor);
      if (!reached) return;
      const seen = await getMilestonesSeen();
      const fresh = milestonesUpTo(reached).filter((m) => !seen.includes(goalMilestoneKey(goal.id, m)));
      if (fresh.length === 0) return;
      await markMilestonesSeen(fresh.map((m) => goalMilestoneKey(goal.id, m)));
      if (!fresh.includes(reached) || (reached === 100 && letterShown)) return;
      const toGo = Math.max(0, goal.targetAmountMinor - after);
      showNote(goalMilestoneCopy(reached, goal.name, toGo, hideAmounts));
    } catch {
      // A missed note is never worth failing a save that already went through.
    }
  };

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
      // Crossing check lives here, not in contributeToGoal: this place already holds the prior amount and
      // the note. `>=` on the new total is deliberate: overshooting in one go still gets the reveal.
      const justCompleted =
        direction === 'add' &&
        goal.currentAmountMinor < goal.targetAmountMinor &&
        goal.currentAmountMinor + deltaMinor >= goal.targetAmountMinor;
      const hasLetter = justCompleted && !!goal.noteToSelf && !goal.letterRevealed;
      if (hasLetter) {
        await markGoalLetterRevealed(goal.id);
        setReveal({ note: goal.noteToSelf as string });
      } else {
        onContributed();
      }
      if (direction === 'add') {
        await announceMilestone(deltaMinor, hasLetter);
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
          <AmountField
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 2000"
            autoFocus
          />
        </>
      )}
    </ModalSheet>
  );
}
