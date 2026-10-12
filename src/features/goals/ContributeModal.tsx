import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { contributeToGoal, markGoalLetterRevealed, listSavingsGoals } from '@/db/savingsGoals';
import { toMinor, inputMinor, formatMoney, formatMaskableMoney } from '@/lib/money';
import {
  getGoalReservationSummary,
  GoalReservationSummary,
  moveGoalReservation,
  releaseGoalReservation,
} from '@/db/goalReservations';
import { Chip } from '@/components/Chip';
import { SavingsGoal } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { modalFooterStyles as f } from '@/constants/theme';
import { AmountField } from '@/components/AmountField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { InsightRow } from '@/components/InsightCard';
import { SheetTabs } from '@/components/SheetTabs';
import { GoalLetterReveal } from './GoalLetterReveal';
import { GoalSheetCard } from './GoalSheetCard';
import { haptics } from '@/lib/haptics';
import { styles } from './goals.styles';
import { errorMessage } from '@/lib/errorMessage';
import { useMilestoneNote } from '@/components/MilestoneNote';
import { usePrivacy } from '@/theme/PrivacyContext';
import { getMilestonesSeen, markMilestonesSeen } from '@/db/settings';
import { goalMilestoneCopy, goalMilestoneKey, milestonesUpTo, milestoneReached } from '@/lib/milestones';

type Direction = 'add' | 'withdraw' | 'move';
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
  const [summary, setSummary] = useState<GoalReservationSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<SavingsGoal[]>([]);
  const [direction, setDirection] = useState<Direction>('add');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown when this contribution first reaches the target, with the sealed note when one exists.
  // Held locally so the sheet stays open on the reveal instead of the host closing it.
  const [reveal, setReveal] = useState<{ note: string | null } | null>(null);
  // One save at a time: two taps can land before `saving` disables the button.
  const running = useRef(false);
  const showNote = useMilestoneNote();
  const { hideAmounts } = usePrivacy();

  useEffect(() => {
    if (!goal) return;
    setDirection(goal.archived && goal.reservesAccount ? 'withdraw' : 'add');
    setAmount('');
    setError(null);
    setReveal(null);
  }, [goal]);

  useEffect(() => {
    let live = true;
    setSummary(null);
    setSummaryFailed(false);
    setMoveTo(null);
    setDestinations([]);
    if (!goal?.reservesAccount || !goal.linkedAccountId) return;
    Promise.all([getGoalReservationSummary(goal.linkedAccountId), listSavingsGoals()])
      .then(([s, goals]) => {
        if (!live) return;
        setSummary(s);
        setDestinations(
          goals.filter(
            (g) => g.id !== goal.id && g.reservesAccount && g.linkedAccountId === goal.linkedAccountId
          )
        );
      })
      .catch(() => {
        if (live) setSummaryFailed(true);
      });
    return () => {
      live = false;
    };
  }, [goal]);

  if (!goal) return null;

  // Once per line, ever: crossing 25 and 50 in one save marks both so neither fires later. The completion
  // card already confirms a finished goal, so 100% is remembered but not announced a second time.
  const announceMilestone = async (deltaMinor: number, completionShown: boolean) => {
    if (!goal) return;
    try {
      const after = goal.currentAmountMinor + deltaMinor;
      const reached = milestoneReached(goal.currentAmountMinor, after, goal.targetAmountMinor);
      if (!reached) return;
      const seen = await getMilestonesSeen();
      const fresh = milestonesUpTo(reached).filter((m) => !seen.includes(goalMilestoneKey(goal.id, m)));
      if (fresh.length === 0) return;
      await markMilestonesSeen(fresh.map((m) => goalMilestoneKey(goal.id, m)));
      if (!fresh.includes(reached) || (reached === 100 && completionShown)) return;
      const toGo = Math.max(0, goal.targetAmountMinor - after);
      showNote(goalMilestoneCopy(reached, goal.name, toGo, hideAmounts));
    } catch {
      // A missed note is never worth failing a save that already went through.
    }
  };

  const submit = async () => {
    if (running.current) return;
    setError(null);
    const amountMinor = toMinor(parseFloat(amount || '0'));
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError('Enter a valid amount');
      return;
    }
    // Reject an over-withdrawal before writing; the database also checks the live balance atomically.
    if (direction !== 'add' && amountMinor > goal.currentAmountMinor) {
      setError(
        `You can withdraw up to ${formatMaskableMoney(goal.currentAmountMinor, { masked: hideAmounts })} — that's what's saved so far`
      );
      return;
    }
    running.current = true;
    setSaving(true);
    const deltaMinor = direction === 'add' ? amountMinor : -amountMinor;
    try {
      if (direction === 'move') {
        if (!moveTo) throw new Error('Choose a destination goal.');
        await moveGoalReservation(goal.id, moveTo, amountMinor);
      } else await contributeToGoal(goal.id, deltaMinor);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
      running.current = false;
      return;
    }
    // The money is in from here on: a later hiccup must not read as "couldn't save" and invite a second tap.
    try {
      haptics.tap();
      // Crossing check lives here, not in contributeToGoal: this place already holds the prior amount and
      // the note. `>=` on the new total is deliberate: overshooting in one go still gets the reveal.
      const justCompleted =
        direction === 'add' &&
        goal.currentAmountMinor < goal.targetAmountMinor &&
        goal.currentAmountMinor + deltaMinor >= goal.targetAmountMinor;
      const hasLetter = justCompleted && !!goal.noteToSelf && !goal.letterRevealed;
      if (justCompleted) {
        if (hasLetter) await markGoalLetterRevealed(goal.id);
        setReveal({ note: hasLetter ? goal.noteToSelf : null });
      } else {
        onContributed();
      }
      if (direction === 'add') {
        await announceMilestone(deltaMinor, justCompleted);
      }
    } catch {
      onContributed();
    } finally {
      setSaving(false);
      running.current = false;
    }
  };

  return (
    <ModalSheet
      title={reveal ? 'Goal completed' : goal.reservesAccount ? 'Goal reservation' : 'Add to goal'}
      visible
      onClose={() => {
        if (!running.current) (reveal ? onContributed : onClose)();
      }}
      footer={
        reveal ? (
          <View style={f.footerCol}>
            {error && <Text style={styles.errorText}>{error}</Text>}
            {goal.reservesAccount && (
              <PrimaryButton
                variant="secondary"
                title={saving ? 'Releasing…' : 'Release reservation'}
                disabled={saving}
                onPress={async () => {
                  if (running.current) return;
                  running.current = true;
                  setSaving(true);
                  try {
                    await releaseGoalReservation(goal.id);
                    onContributed();
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    running.current = false;
                    setSaving(false);
                  }
                }}
              />
            )}
            <PrimaryButton
              title={goal.reservesAccount ? 'Keep reserved' : 'Done'}
              onPress={onContributed}
              disabled={saving}
            />
          </View>
        ) : (
          <View style={f.footerCol}>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <PrimaryButton
              title={
                saving
                  ? 'Saving…'
                  : direction === 'move'
                    ? 'Move reservation'
                    : goal.reservesAccount
                      ? direction === 'add'
                        ? 'Reserve money'
                        : 'Release money'
                      : direction === 'add'
                        ? 'Add money'
                        : 'Withdraw'
              }
              onPress={submit}
              disabled={saving || (goal.reservesAccount && direction === 'add' && !summary)}
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
          {goal.reservesAccount && (
            <>
              <InsightRow
                label="Available to reserve"
                detail="Money stays in this account"
                value={summary ? (hideAmounts ? '••••' : formatMoney(summary.availableMinor)) : undefined}
              />
              {!summary && (
                <Text style={styles.modalHint}>
                  {summaryFailed
                    ? 'Could not load available money. Reopen to retry; releases remain available.'
                    : 'Checking available money…'}
                </Text>
              )}
              {summary && summary.shortfallMinor > 0 && (
                <Text style={styles.errorText}>
                  Reservations exceed the balance by{' '}
                  {hideAmounts ? '••••' : formatMoney(summary.shortfallMinor)}. Release money or move it
                  between goals to review your plan.
                </Text>
              )}
            </>
          )}
          <SheetTabs
            options={
              goal.reservesAccount
                ? [
                    ...(!goal.archived ? [{ label: 'Reserve', value: 'add' as const }] : []),
                    { label: 'Release', value: 'withdraw' as const },
                    { label: 'Move', value: 'move' as const },
                  ]
                : DIRECTIONS
            }
            value={direction}
            onChange={setDirection}
          />
          {direction === 'move' && (
            <View style={styles.chipRow}>
              {destinations.length === 0 ? (
                <Text style={styles.modalHint}>Create another reservation goal in this account first.</Text>
              ) : (
                destinations.map((g) => (
                  <Chip key={g.id} label={g.name} active={moveTo === g.id} onPress={() => setMoveTo(g.id)} />
                ))
              )}
            </View>
          )}
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
