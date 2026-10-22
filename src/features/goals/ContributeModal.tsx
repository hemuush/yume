import { useEffect, useRef, useState } from 'react';
import { View, Keyboard } from 'react-native';
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
export function ContributeModal(props: ContributeProps) {
  return props.goal ? <ContributionForm key={props.goal.id} {...props} goal={props.goal} /> : null;
}

interface ContributeProps {
  goal: SavingsGoal | null;
  onClose: () => void;
  backLabel?: string;
  onContributed: () => void | Promise<void>;
}

function ContributionForm({
  goal,
  onClose,
  backLabel,
  onContributed,
}: Omit<ContributeProps, 'goal'> & { goal: SavingsGoal }) {
  const [summary, setSummary] = useState<GoalReservationSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<SavingsGoal[]>([]);
  const [direction, setDirection] = useState<Direction>(
    goal.archived && goal.reservesAccount ? 'withdraw' : 'add'
  );
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reservationReleased, setReservationReleased] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown when this contribution first reaches the target, with the sealed note when one exists.
  // Held locally so the sheet stays open on the reveal instead of the host closing it.
  const [reveal, setReveal] = useState<{ note: string | null } | null>(null);
  // One save at a time: two taps can land before `saving` disables the button.
  const running = useRef(false);
  const committed = useRef(false);
  const released = useRef(false);
  const letterPending = useRef(false);
  const active = useRef(true);
  const [retry, setRetry] = useState(0);
  const showNote = useMilestoneNote();
  const { hideAmounts } = usePrivacy();

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

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
  }, [goal.id, goal.reservesAccount, goal.linkedAccountId, retry]);

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
      // Not guarded by `active`: the host often closes this sheet inside onContributed, and the note is root-level.
      showNote(goalMilestoneCopy(reached, goal.name, toGo, hideAmounts));
    } catch {
      // A missed note is never worth failing a save that already went through.
    }
  };

  const submit = async () => {
    if (!active.current || committed.current || running.current) return;
    setError(null);
    const amountMinor = toMinor(parseFloat(amount || '0'));
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError('Enter a valid amount');
      return;
    }
    // Reject an over-withdrawal before writing; the database also checks the live balance atomically.
    if (direction !== 'add' && amountMinor > goal.currentAmountMinor) {
      setError(
        `You can ${direction === 'move' ? 'move' : 'withdraw'} up to ${formatMaskableMoney(goal.currentAmountMinor, { masked: hideAmounts })} — that's what's saved so far`
      );
      return;
    }
    running.current = true;
    Keyboard.dismiss();
    setSaving(true);
    const deltaMinor = direction === 'add' ? amountMinor : -amountMinor;
    try {
      if (direction === 'move') {
        if (!moveTo) throw new Error('Choose a destination goal.');
        await moveGoalReservation(goal.id, moveTo, amountMinor);
      } else await contributeToGoal(goal.id, deltaMinor);
    } catch (e) {
      if (!active.current) return;
      setError(errorMessage(e));
      setSaving(false);
      running.current = false;
      return;
    }
    committed.current = true;
    if (!active.current) return;
    setSaved(true);
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
      if (justCompleted && !hideAmounts) {
        letterPending.current = hasLetter;
        if (active.current) setReveal({ note: hasLetter ? goal.noteToSelf : null });
      } else {
        await onContributed();
      }
      if (direction === 'add') {
        await announceMilestone(deltaMinor, justCompleted);
      }
    } catch {
      if (active.current)
        setError('Your progress was saved, but the screen could not refresh. Close and reopen to see it.');
    } finally {
      if (active.current) setSaving(false);
      running.current = false;
    }
  };

  const finish = async (allowCloseOnFailure = false) => {
    if (!active.current || running.current) return;
    running.current = true;
    setSaving(true);
    try {
      if (letterPending.current && !hideAmounts) {
        try {
          await markGoalLetterRevealed(goal.id);
          letterPending.current = false;
        } catch {
          if (!allowCloseOnFailure) {
            if (active.current)
              setError(
                'Your progress was saved. The letter could not be acknowledged; try Done again, or close and read it later.'
              );
            return;
          }
        }
      }
      await onContributed();
    } catch {
      if (active.current)
        setError('Your progress was saved, but the screen could not refresh. Close and reopen to see it.');
    } finally {
      running.current = false;
      if (active.current) setSaving(false);
    }
  };

  return (
    <ModalSheet
      backLabel={backLabel}
      dismissible={!saving}
      title={reveal ? 'Goal completed' : goal.reservesAccount ? 'Goal reservation' : 'Add to goal'}
      visible
      onClose={() => {
        if (!running.current) {
          if (reveal || committed.current) void finish(true);
          else onClose();
        }
      }}
      footer={
        reveal ? (
          <View style={f.footerCol}>
            {error && <Text style={styles.errorText}>{error}</Text>}
            {goal.reservesAccount && (
              <PrimaryButton
                loading={saving}
                variant="secondary"
                title={saving ? 'Releasing…' : 'Release reservation'}
                disabled={saving || reservationReleased}
                onPress={async () => {
                  if (!active.current || running.current || released.current) return;
                  running.current = true;
                  setSaving(true);
                  try {
                    await releaseGoalReservation(goal.id);
                    released.current = true;
                    if (active.current) {
                      setReservationReleased(true);
                      await onContributed();
                    }
                  } catch (e) {
                    if (active.current)
                      setError(
                        released.current
                          ? 'Reservation released, but the screen could not refresh. Close and reopen to see it.'
                          : errorMessage(e)
                      );
                  } finally {
                    running.current = false;
                    if (active.current) setSaving(false);
                  }
                }}
              />
            )}
            <PrimaryButton
              title={goal.reservesAccount ? 'Keep reserved' : 'Done'}
              onPress={() => void finish()}
              disabled={saving}
            />
          </View>
        ) : (
          <View style={f.footerCol}>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <PrimaryButton
              loading={saving}
              title={
                saving
                  ? 'Saving…'
                  : saved
                    ? 'Done'
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
              onPress={saved ? () => finish() : submit}
              disabled={
                saving ||
                (!saved &&
                  ((goal.reservesAccount && direction === 'add' && !summary) ||
                    (direction === 'move' && !moveTo)))
              }
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
        <View
          pointerEvents={saving || saved ? 'none' : 'auto'}
          accessibilityElementsHidden={saving || saved}
          importantForAccessibility={saving || saved ? 'no-hide-descendants' : 'auto'}
        >
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
                    ? 'Could not load available money. Retry to reserve; releases remain available.'
                    : 'Checking available money…'}
                </Text>
              )}
              {summaryFailed && (
                <PrimaryButton
                  title="Retry available money"
                  compact
                  variant="secondary"
                  onPress={() => setRetry((n) => n + 1)}
                />
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
            editable={!saving && !saved}
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 2000"
            autoFocus
          />
          <Text style={styles.modalHint}>
            {goal.reservesAccount
              ? 'Reservations stay in the linked account. Releasing or moving them does not create a transfer.'
              : 'This updates goal progress only. No money moves between your accounts.'}
          </Text>
        </View>
      )}
    </ModalSheet>
  );
}
