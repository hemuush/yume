import { useSaveOnce } from '@/lib/useSaveOnce';
import { useEffect, useState } from 'react';
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
import { GoalSheetCard } from './GoalSheetCard';
import { FormInput } from '@/components/FormInput';
import { AmountField } from '@/components/AmountField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { ContributeModal } from './ContributeModal';
import { GoalAccountField } from './GoalAccountField';
import { useUndoToast } from '@/components/UndoToast';
import { haptics } from '@/lib/haptics';
import { styles } from './goals.styles';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';

/**
 * Edit/archive/delete a goal (from a GoalCard). Hand-added progress (`currentAmountMinor > 0`) means Archive
 * only (keeps the number); a never-funded or account-following goal can be deleted (account untouched).
 */
export function GoalDetailModal({
  goal,
  accounts,
  onClose,
  onChanged,
}: {
  goal: SavingsGoal | null;
  accounts: Account[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { show: showUndo } = useUndoToast();
  const runAction = useSaveOnce(async (action: () => Promise<void>) => {
    await action();
  });
  const [manageReservation, setManageReservation] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [hasTargetDate, setHasTargetDate] = useState(false);
  const [targetDateValue, setTargetDateValue] = useState(() =>
    addMonthsToIsoDate(toLocalIsoDate(new Date()), 12)
  );
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);
  const [tracksAccount, setTracksAccount] = useState(false);
  const [reservesAccount, setReservesAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!goal) return;
    setManageReservation(false);
    setName(goal.name);
    setTarget((goal.targetAmountMinor / 100).toString());
    setLinkedAccountId(goal.linkedAccountId);
    setTracksAccount(goal.tracksAccount);
    setReservesAccount(!!goal.reservesAccount);
    setHasTargetDate(!!goal.targetDate);
    setTargetDateValue(goal.targetDate ?? addMonthsToIsoDate(toLocalIsoDate(new Date()), 12));
    setError(null);
  }, [goal]);

  if (!goal) return null;

  // Same rule as AddGoalModal: picking a savings account starts on Follow, any other starts by hand.
  const pickAccount = (id: string | null) => {
    setLinkedAccountId(id);
    setReservesAccount(false);
    setTracksAccount(accounts.find((a) => a.id === id)?.type === 'savings');
  };

  const submit = () =>
    runAction(async () => {
      setError(null);
      if (!name.trim()) {
        setError('Enter a name');
        return;
      }
      const targetAmountMinor = toMinor(parseFloat(target || '0'));
      if (!Number.isFinite(targetAmountMinor) || targetAmountMinor <= 0) {
        setError('Enter a valid target amount');
        return;
      }
      const targetDate = hasTargetDate ? targetDateValue : null;
      setSaving(true);
      try {
        await updateSavingsGoal(goal.id, {
          name: name.trim(),
          targetAmountMinor,
          targetDate,
          linkedAccountId,
          tracksAccount,
          reservesAccount,
        });
        onChanged();
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setSaving(false);
      }
    });

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
          onPress: () =>
            runAction(async () => {
              setBusy(true);
              try {
                await archiveSavingsGoal(goal.id, release);
                onChanged();
              } catch (e) {
                showAlert("Couldn't archive", errorMessage(e));
              } finally {
                setBusy(false);
              }
            }),
        },
      ]
    );
  };

  const onUnarchive = () =>
    runAction(async () => {
      setBusy(true);
      try {
        await unarchiveSavingsGoal(goal.id);
        onChanged();
      } catch (e) {
        showAlert("Couldn't unarchive", errorMessage(e));
      } finally {
        setBusy(false);
      }
    });

  const confirmDelete = () =>
    runAction(async () => {
      setBusy(true);
      try {
        const snapshot = await deleteSavingsGoal(goal.id);
        haptics.warn();
        onChanged();
        showUndo(`Deleted "${goal.name}"`, async () => {
          await restoreSavingsGoal(snapshot);
          onChanged();
        });
      } catch (e) {
        showAlert("Couldn't delete", errorMessage(e));
      } finally {
        setBusy(false);
      }
    });

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
    <ModalSheet
      title="Goal details"
      visible
      onClose={onClose}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton
            title={saving ? 'Saving…' : 'Save changes'}
            onPress={submit}
            disabled={saving || busy}
          />
        </View>
      }
    >
      <GoalSheetCard
        name={name.trim() || goal.name}
        savedMinor={draftSavedMinor}
        targetMinor={inputMinor(target) || goal.targetAmountMinor}
        targetDate={hasTargetDate ? targetDateValue : null}
      />
      <FormInput label="Goal name" value={name} onChangeText={setName} placeholder="e.g. Goa trip" />
      <AmountField label="Target amount" value={target} onChangeText={setTarget} placeholder="e.g. 40000" />

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
          goal.manualAmountMinor ?? (goal.tracksAccount || goal.reservesAccount ? 0 : goal.currentAmountMinor)
        }
      />

      {goal.reservesAccount && (
        <>
          <Text style={styles.modalHint}>
            Changing account or tracking mode requires releasing this reservation first. Manual progress from
            before reservation mode is kept separately.
          </Text>
          <PrimaryButton
            variant="secondary"
            title="Manage reservation"
            onPress={() => setManageReservation(true)}
            disabled={busy || saving}
          />
          <ContributeModal
            goal={manageReservation ? goal : null}
            onClose={() => setManageReservation(false)}
            onContributed={() => {
              setManageReservation(false);
              onChanged();
            }}
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
        ) : !goal.tracksAccount && (goal.currentAmountMinor > 0 || goal.reservesAccount) ? (
          <View>
            <SheetLink
              label={busy ? 'Working…' : goal.reservesAccount ? 'Archive and keep reserved' : 'Archive goal'}
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
    </ModalSheet>
  );
}
