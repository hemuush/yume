import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { payInstallment, undoInstallmentPayment } from '@/db/loans';
import { LoanDirection, LoanPayment } from '@/types';
import { formatMoney } from '@/lib/money';
import { assertValidIsoDate, toLocalIsoDate } from '@/lib/date';
import { emitTransactionsChanged } from '@/lib/dataEvents';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { DateField } from '@/components/DateField';
import { useUndoToast } from '@/components/UndoToast';
import { theme } from '@/constants/theme';
import { SheetCard } from '@/components/SheetCard';
import { dayMonthYear, weekdayDayMonth } from '@/lib/dateLabels';
import { styles } from './loans.styles';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';
import { useReduceMotion } from '@/lib/useReduceMotion';

/**
 * Confirms one outgoing EMI or incoming repayment. The actual movement date defaults to today; the due
 * date stays in the summary. A failed save keeps the chosen date available for retry. Ends with undo.
 */
export function PayInstallmentSheet({
  installment,
  direction = 'borrowed',
  account,
  categoryId,
  linkedAccountMissing = false,
  balanceMinor,
  onClose,
  backLabel,
  onPaid,
}: {
  installment: LoanPayment;
  direction?: LoanDirection;
  account: { id: string; name: string } | null;
  categoryId: string | null;
  /** The loan's own account is archived or gone: say which account pays instead. */
  linkedAccountMissing?: boolean;
  /** What the paying account holds now, to show what it'll hold after (Plan knows it; omitted elsewhere). */
  balanceMinor?: number;
  onClose: () => void;
  backLabel?: string;
  /** After the payment (or its undo) is saved — refresh whatever shows it. */
  onPaid: () => void | Promise<void>;
}) {
  const { show: showUndo } = useUndoToast();
  const reduceMotion = useReduceMotion();
  const lent = direction === 'lent';
  const todayIso = toLocalIsoDate(new Date());
  const early = installment.dueDate > todayIso;
  const [paidDateIso, setPaidDateIso] = useState(todayIso);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Read once: Plan reloads (with the EMI already taken off) before the sheet closes.
  const [balanceBefore] = useState(balanceMinor);
  const [done, setDone] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitting = useRef(false);
  const [submittedDate, setSubmittedDate] = useState<string | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const pay = async () => {
    if (!account || !categoryId || submitting.current) return;
    setError(null);
    try {
      assertValidIsoDate(paidDateIso);
      if (paidDateIso > toLocalIsoDate(new Date())) throw new Error('Choose today or an earlier date.');
    } catch (e) {
      setError(errorMessage(e));
      return;
    }
    submitting.current = true;
    setSubmittedDate(paidDateIso);
    setBusy(true);
    try {
      await payInstallment(installment.id, { accountId: account.id, categoryId, paidDate: paidDateIso });
    } catch (e) {
      if (!mounted.current) return;
      setError(errorMessage(e));
      submitting.current = false;
      setBusy(false);
      return;
    }
    // The payment is saved from here on: nothing below may report it as failed (that invites paying twice).
    emitTransactionsChanged();
    if (!mounted.current) return;
    setDone(true);
    try {
      await onPaid();
    } catch (e) {
      if (mounted.current)
        showAlert("Payment saved, couldn't refresh", `${errorMessage(e)} Reopen this screen to see it.`);
    }
    if (!mounted.current) return;
    showUndo(
      lent
        ? `Recorded EMI #${installment.installmentNumber} received`
        : `Marked EMI #${installment.installmentNumber} paid`,
      async () => {
        try {
          await undoInstallmentPayment(installment.id);
        } catch (e) {
          showAlert("Couldn't undo", errorMessage(e));
          return;
        }
        emitTransactionsChanged();
        try {
          await onPaid();
        } catch (e) {
          showAlert("Payment undone, couldn't refresh", `${errorMessage(e)} Reopen this screen to see it.`);
        }
      }
    );
    // A brief "done" tick before the sheet closes — the payment is already
    // saved; this is only the felt confirmation.
    closeTimer.current = setTimeout(onClose, reduceMotion ? 0 : 380);
  };

  return (
    <ModalSheet
      backLabel={backLabel}
      dismissible={!busy}
      visible
      onClose={onClose}
      variant="center"
      title={
        lent
          ? early
            ? 'Record an early receipt'
            : 'Record repayment'
          : early
            ? 'Pay ahead of schedule?'
            : 'Confirm payment'
      }
      footer={
        <View>
          {error && (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
          <PrimaryButton
            title={busy ? 'Recording…' : lent ? 'Record receipt' : early ? 'Pay early' : 'Confirm payment'}
            loading={busy && !done}
            done={done}
            doneLabel="Recorded"
            onPress={pay}
            disabled={busy || !account || !categoryId}
          />
        </View>
      }
    >
      <SheetCard
        hue={lent ? theme.colors.secondary : theme.colors.idCoralDeep}
        icon="calendar-check"
        kicker={`EMI #${installment.installmentNumber}`}
        amount={formatMoney(installment.emiAmountMinor)}
        title={`${lent ? 'Into' : 'From'} ${account?.name ?? '—'}`}
        meta={`Due ${weekdayDayMonth(installment.dueDate)}`}
      />
      {account && balanceBefore != null && (
        <Text style={styles.hintText}>
          {account.name} after {lent ? 'receiving' : 'paying'}:{' '}
          {formatMoney(balanceBefore + (lent ? 1 : -1) * installment.emiAmountMinor)}
        </Text>
      )}
      {!account && (
        <Text style={styles.hintText}>Add an account first to record payments against this loan.</Text>
      )}
      {account && linkedAccountMissing && (
        <Text style={styles.hintText}>
          This loan's own account is unavailable, so this {lent ? 'receives into' : 'pays from'}{' '}
          {account.name}. Change the loan's account if that's not right.
        </Text>
      )}
      {early && (
        <Text style={styles.hintText}>
          This EMI isn't due until {dayMonthYear(installment.dueDate)}. Recording it now completes this
          installment early. Use Prepay on the loan for an extra principal payment instead.
        </Text>
      )}
      {busy ? (
        <Text style={styles.hintText}>
          {lent ? 'Received on' : 'Paid on'} {dayMonthYear(submittedDate ?? paidDateIso)}
        </Text>
      ) : (
        <DateField
          label={lent ? 'Actually received on' : 'Actually paid on'}
          value={paidDateIso}
          onChange={setPaidDateIso}
          maxDate={todayIso}
          pastFacing
        />
      )}
      <Text style={styles.hintText}>Choose when the money actually moved. The due date stays unchanged.</Text>
    </ModalSheet>
  );
}
