import { useEffect, useRef, useState } from 'react';
import { Text } from '@/components/Text';
import { payInstallment, undoInstallmentPayment } from '@/db/loans';
import { LoanPayment } from '@/types';
import { formatMoney } from '@/lib/money';
import { toLocalIsoDate } from '@/lib/date';
import { haptics } from '@/lib/haptics';
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

/**
 * Confirms paying one EMI (from the loan's screen or Plan's Coming up). "Paid on" defaults to the due date
 * for an EMI already due (so catching up records the real day) but to today for one paid ahead, so an early
 * payment is never dated in the future. Paying ahead says so. Ends with undo.
 */
export function PayInstallmentSheet({
  installment,
  account,
  categoryId,
  linkedAccountMissing = false,
  balanceMinor,
  onClose,
  onPaid,
}: {
  installment: LoanPayment;
  account: { id: string; name: string } | null;
  categoryId: string | null;
  /** The loan's own account is archived or gone: say which account pays instead. */
  linkedAccountMissing?: boolean;
  /** What the paying account holds now, to show what it'll hold after (Plan knows it; omitted elsewhere). */
  balanceMinor?: number;
  onClose: () => void;
  /** After the payment (or its undo) is saved — refresh whatever shows it. */
  onPaid: () => void | Promise<void>;
}) {
  const { show: showUndo } = useUndoToast();
  const todayIso = toLocalIsoDate(new Date());
  const early = installment.dueDate > todayIso;
  const [paidDateIso, setPaidDateIso] = useState(early ? todayIso : installment.dueDate);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitting = useRef(false);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  const pay = async () => {
    if (!account || !categoryId || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await payInstallment(installment.id, { accountId: account.id, categoryId, paidDate: paidDateIso });
    } catch (e) {
      showAlert("Couldn't record payment", errorMessage(e));
      submitting.current = false;
      setBusy(false);
      onClose();
      return;
    }
    // The payment is saved from here on: nothing below may report it as failed (that invites paying twice).
    haptics.confirm();
    emitTransactionsChanged();
    try {
      await onPaid();
    } catch (e) {
      showAlert("Payment saved, couldn't refresh", `${errorMessage(e)} Reopen this screen to see it.`);
    }
    showUndo(`Marked EMI #${installment.installmentNumber} paid`, async () => {
      try {
        await undoInstallmentPayment(installment.id);
        emitTransactionsChanged();
        await onPaid();
      } catch (e) {
        showAlert("Couldn't undo", errorMessage(e));
      }
    });
    // A brief "done" tick before the sheet closes — the payment is already
    // saved; this is only the felt confirmation.
    setDone(true);
    closeTimer.current = setTimeout(onClose, 380);
  };

  return (
    <ModalSheet
      visible
      onClose={onClose}
      variant="center"
      scrollable={false}
      title={early ? 'Pay ahead of schedule?' : 'Confirm payment'}
      footer={
        <PrimaryButton
          title={busy ? 'Recording…' : early ? 'Pay early' : 'Confirm payment'}
          done={done}
          onPress={pay}
          disabled={busy || !account || !categoryId}
        />
      }
    >
      <SheetCard
        hue={theme.colors.idCoralDeep}
        icon="calendar-check"
        kicker={`EMI #${installment.installmentNumber}`}
        amount={formatMoney(installment.emiAmountMinor)}
        title={`From ${account?.name ?? '—'}`}
        meta={`Due ${weekdayDayMonth(installment.dueDate)}`}
      />
      {account && balanceMinor != null && (
        <Text style={styles.hintText}>
          {account.name} after paying: {formatMoney(balanceMinor - installment.emiAmountMinor)}
        </Text>
      )}
      {!account && (
        <Text style={styles.hintText}>Add an account first to record payments against this loan.</Text>
      )}
      {account && linkedAccountMissing && (
        <Text style={styles.hintText}>
          This loan's own account is archived or deleted, so this pays from {account.name}. Change the loan's
          account if that's not right.
        </Text>
      )}
      {early && (
        <Text style={styles.hintText}>
          This EMI isn't due until {dayMonthYear(installment.dueDate)}. Marking it paid now records it as
          complete ahead of schedule. To put extra money toward the loan instead, use Prepay on the loan.
        </Text>
      )}
      <DateField label="Actually paid on" value={paidDateIso} onChange={setPaidDateIso} pastFacing />
      <Text style={styles.hintText}>
        {early
          ? 'Defaults to today — change it if the payment actually happened on a different day.'
          : "Defaults to this EMI's due date — change it if you're catching up on a payment that actually happened on a different day."}
      </Text>
    </ModalSheet>
  );
}
