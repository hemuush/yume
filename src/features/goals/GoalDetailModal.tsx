import { useSheetMutation } from '@/lib/useSheetMutation';
import { SheetFlow } from '@/components/SheetFlow';
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import {
  updateSavingsGoal,
  archiveSavingsGoal,
  unarchiveSavingsGoal,
  deleteSavingsGoal,
  restoreSavingsGoal,
} from '@/db/savingsGoals';
import { toMinor, inputMinor } from '@/lib/money';
import { toLocalIsoDate, addMonthsToIsoDate } from '@/lib/date';
import { DateField } from '@/components/DateField';
import { Account, SavingsGoal } from '@/types';
import { ModalSheet, SheetLink } from '@/components/ModalSheet';
import { InsightDisclosure } from '@/components/InsightCard';
import { modalFooterStyles as f } from '@/constants/theme';
import { GoalDraftHero } from './GoalDraftHero';
import { FormInput } from '@/components/FormInput';
import { AmountField } from '@/components/AmountField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { ContributeModal } from './ContributeModal';
import { GoalAccountField } from './GoalAccountField';
import { useUndoToast } from '@/components/UndoToast';
import { haptics } from '@/lib/haptics';
import { styles } from './goals.styles';
import { showAlert } from '@/components/AppDialog';

/**
 * Edit/archive/delete a goal (from a GoalCard). Hand-added progress (`currentAmountMinor > 0`) means Archive
 * only (keeps the number); a never-funded or account-following goal can be deleted (account untouched).
 */
export function GoalDetailModal(props: GoalDetailProps) {
  return props.goal ? <GoalDetailForm key={props.goal.id} {...props} goal={props.goal} /> : null;
}

interface GoalDetailProps {
  goal: SavingsGoal | null;
  accounts: Account[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
  backLabel?: string;
}

function GoalDetailForm({
  goal,
  accounts,
  onClose,
  onChanged,
  onRefresh,
  backLabel,
}: Omit<GoalDetailProps, 'goal'> & { goal: SavingsGoal }) {
  const { show: showUndo } = useUndoToast();
  const { run, pending: saving, saved, error, setError } = useSheetMutation();
  const busy = saving || saved;
  const [manageReservation, setManageReservation] = useState(false);
  const [name, setName] = useState(goal.name);
  const [target, setTarget] = useState(String(goal.targetAmountMinor / 100));
  const [hasTargetDate, setHasTargetDate] = useState(!!goal.targetDate);
  const [targetDateValue, setTargetDateValue] = useState(
    () => goal.targetDate ?? addMonthsToIsoDate(toLocalIsoDate(new Date()), 12)
  );
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(goal.linkedAccountId);
  const [tracksAccount, setTracksAccount] = useState(goal.tracksAccount);
  const [reservesAccount, setReservesAccount] = useState(!!goal.reservesAccount);

  // Same rule as AddGoalModal: picking a savings account starts on Follow, any other starts by hand.
  const pickAccount = (id: string | null) => {
    setLinkedAccountId(id);
    setReservesAccount(false);
    setTracksAccount(accounts.find((a) => a.id === id)?.type === 'savings');
  };

  const submit = () =>
    run(async () => {
      setError(null);
      if (!name.trim()) {
        throw new Error('Enter a name');
      }
      const targetAmountMinor = toMinor(parseFloat(target || '0'));
      if (!Number.isFinite(targetAmountMinor) || targetAmountMinor <= 0) {
        throw new Error('Enter a valid target amount');
      }
      const targetDate = hasTargetDate ? targetDateValue : null;
      await updateSavingsGoal(goal.id, {
        name: name.trim(),
        targetAmountMinor,
        targetDate,
        linkedAccountId,
        tracksAccount,
        reservesAccount,
      });
    }, onChanged);

  const confirmArchive = (release = false) => {
    showAlert(
      'Archive this goal?',
      goal.reservesAccount
        ? release
          ? 'Release its reserved money and archive this goal. The account balance stays unchanged.'
          : 'Archive this goal and keep its money reserved. It stays unavailable to other goals until released.'
        : 'It disappears from the active list, but its saved amount stays exactly as it is. You can unarchive it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => run(() => archiveSavingsGoal(goal.id, release), onChanged),
        },
      ]
    );
  };

  const onUnarchive = () => run(() => unarchiveSavingsGoal(goal.id), onChanged);

  const confirmDelete = () =>
    run(
      () => deleteSavingsGoal(goal.id),
      async (snapshot) => {
        haptics.warn();
        showUndo(`Deleted "${goal.name}"`, async () => {
          await restoreSavingsGoal(snapshot);
          await onChanged();
        });
        await onChanged();
      }
    );

  const draftSavedMinor = reservesAccount
    ? goal.reservesAccount && goal.linkedAccountId === linkedAccountId
      ? goal.currentAmountMinor
      : 0
    : tracksAccount
      ? Math.max(0, accounts.find((a) => a.id === linkedAccountId)?.currentBalanceMinor ?? 0)
      : (goal.manualAmountMinor ??
        (!goal.tracksAccount && !goal.reservesAccount ? goal.currentAmountMinor : 0));

  // Calm-sheets layout: a live card of the goal as typed, then the form. Archive/delete is a quiet link at
  // the end.

  return (
    <SheetFlow>
      <ModalSheet
        flowPage
        dismissible={!saving}
        title={backLabel ? 'Edit goal' : 'Goal details'}
        backLabel={backLabel}
        visible={!manageReservation}
        onClose={onClose}
        footer={
          <View style={f.footerCol}>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <PrimaryButton
              loading={saving}
              title={saving ? 'Saving…' : saved ? 'Goal saved' : 'Save changes'}
              onPress={submit}
              disabled={saving || busy}
            />
          </View>
        }
      >
        <View
          pointerEvents={busy ? 'none' : 'auto'}
          accessibilityElementsHidden={busy}
          importantForAccessibility={busy ? 'no-hide-descendants' : 'auto'}
        >
          <GoalDraftHero
            name={name.trim() || goal.name}
            savedMinor={draftSavedMinor}
            targetMinor={inputMinor(target) || goal.targetAmountMinor}
            targetDate={hasTargetDate ? targetDateValue : null}
          />
          <FormInput
            label="Goal name"
            editable={!busy}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Goa trip"
          />
          <AmountField
            label="Target amount"
            editable={!busy}
            value={target}
            onChangeText={setTarget}
            placeholder="e.g. 40000"
          />

          <View style={styles.toggleRow}>
            <Text style={styles.fieldLabel}>By a specific date</Text>
            <ToggleSwitch value={hasTargetDate} onChange={setHasTargetDate} />
          </View>
          {hasTargetDate && (
            <DateField label="Target date" value={targetDateValue} onChange={setTargetDateValue} />
          )}

          <GoalAccountField
            accounts={accounts}
            accountId={linkedAccountId}
            tracks={tracksAccount}
            reserves={reservesAccount}
            onChangeReserves={setReservesAccount}
            onChangeAccount={pickAccount}
            onChangeTracks={setTracksAccount}
            goalId={goal.id}
            manualAmountMinor={
              goal.manualAmountMinor ??
              (goal.tracksAccount || goal.reservesAccount ? 0 : goal.currentAmountMinor)
            }
          />

          {goal.reservesAccount && (
            <>
              <Text style={styles.modalHint}>
                Release this reservation before changing the account or tracking mode. Earlier manual progress
                is kept separately.
              </Text>
              <PrimaryButton
                variant="secondary"
                title="Manage reservation"
                onPress={() => setManageReservation(true)}
                disabled={busy || saving}
              />
            </>
          )}
          {goal.letterRevealed && goal.noteToSelf && (
            <>
              <Text style={styles.fieldLabel}>Why you started this</Text>
              <Text style={styles.letterNote}>&ldquo;{goal.noteToSelf}&rdquo;</Text>
            </>
          )}

          <InsightDisclosure title="More options">
            {goal.archived ? (
              <SheetLink
                label={busy ? 'Working…' : 'Unarchive goal'}
                onPress={onUnarchive}
                disabled={busy}
                danger={false}
              />
            ) : goal.hasHistory ||
              (!goal.tracksAccount && (goal.currentAmountMinor > 0 || goal.reservesAccount)) ? (
              <View>
                <SheetLink
                  label={
                    busy ? 'Working…' : goal.reservesAccount ? 'Archive and keep reserved' : 'Archive goal'
                  }
                  onPress={() => confirmArchive()}
                  disabled={busy}
                />
                {goal.reservesAccount && (
                  <SheetLink
                    label="Release reservation and archive"
                    onPress={() => confirmArchive(true)}
                    disabled={busy}
                  />
                )}
              </View>
            ) : (
              <SheetLink label={busy ? 'Working…' : 'Delete goal'} onPress={confirmDelete} disabled={busy} />
            )}
          </InsightDisclosure>
        </View>
      </ModalSheet>
      <ContributeModal
        backLabel="Back to goal"
        goal={manageReservation ? goal : null}
        onClose={() => setManageReservation(false)}
        onContributed={async () => {
          setManageReservation(false);
          try {
            await (onRefresh ?? onChanged)();
          } catch {
            setError(
              'Your reservation was saved, but the goal could not refresh. Reopen it to see the updated progress.'
            );
          }
        }}
      />
    </SheetFlow>
  );
}
