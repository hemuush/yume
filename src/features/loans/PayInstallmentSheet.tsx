import { useState } from 'react';
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
 * Confirms paying one EMI (from the loan's screen or Plan's Coming up). "Paid on" defaults to the due date,
 * not today, so catching up on an old EMI records the real day. Paying ahead says so. Ends with undo.
 */
export function PayInstallmentSheet({
  installment,
  account,
  categoryId,
  onClose,
  onPaid,
}: {
  installment: LoanPayment;
  account: { id: string; name: string } | null;
  categoryId: string | null;
  onClose: () => void;
  /** After the payment (or its undo) is saved — refresh whatever shows it. */
  onPaid: () => void | Promise<void>;
}) {
  const { show: showUndo } = useUndoToast();
  const [paidDateIso, setPaidDateIso] = useState(installment.dueDate);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const todayIso = toLocalIsoDate(new Date());
  const early = installment.dueDate > todayIso;

  const pay = async () => {
    if (!account || !categoryId) return;
    setBusy(true);
    try {
      await payInstallment(installment.id, { accountId: account.id, categoryId, paidDate: paidDateIso });
      haptics.confirm();
      emitTransactionsChanged();
      await onPaid();
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
      setTimeout(onClose, 380);
    } catch (e) {
      showAlert("Couldn't record payment", errorMessage(e));
      setBusy(false);
      onClose();
    }
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
      {!account && (
        <Text style={styles.hintText}>Add an account first to record payments against this loan.</Text>
      )}
      {early && (
        <Text style={styles.hintText}>
          This EMI isn't due until {dayMonthYear(installment.dueDate)}. Marking it paid now records it as
          complete ahead of schedule. To put extra money toward the loan instead, use Prepay on the loan.
        </Text>
      )}
      <DateField label="Actually paid on" value={paidDateIso} onChange={setPaidDateIso} pastFacing />
      <Text style={styles.hintText}>
        Defaults to this EMI's due date — change it if you're catching up on a payment that actually happened
        on a different day.
      </Text>
    </ModalSheet>
  );
}
