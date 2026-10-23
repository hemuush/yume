import { useEntryDraftRecovery } from '@/features/add/useEntryDraftRecovery';
import { draftReferencesAvailable } from '@/features/add/draftReferences';
import { useState } from 'react';
import { toMinor } from '@/lib/money';
import { evaluateAmount, exprFromMinor } from '@/lib/padMath';
import { useDiscardGuard } from '@/features/add/useDiscardGuard';
import { showAlert } from '@/components/AppDialog';
import { splitSignature } from '@/features/add/utils/addEntryIdentity';
import type { useAddEntryEnvironment } from '@/features/add/hooks/useAddEntryEnvironment';
import type { useAddEntryState } from '@/features/add/hooks/useAddEntryState';

type Input = {
  state: ReturnType<typeof useAddEntryState>;
  environment: ReturnType<typeof useAddEntryEnvironment>;
};
export function useAddDraftWorkflow(input: Input) {
  const {
    expr,
    editing,
    type,
    accountId,
    toAccountId,
    categoryId,
    note,
    paymentMode,
    date,
    personId,
    friendSign,
    friendAccountId,
    refund,
    rows,
    splitParts,
    formReady,
    accounts,
    categories,
    people,
    setType,
    setExpr,
    setAccountId,
    setToAccountId,
    setCategoryId,
    setNote,
    setPaymentMode,
    setDate,
    setPersonId,
    setFriendSign,
    setFriendAccountId,
    setRefund,
    setRows,
    setSplitParts,
    accountPickedByHandRef,
    editBaseline,
    saveDone,
    saving,
  } = input.state;
  const { editingId } = input.environment;

  const amountValue = evaluateAmount(expr);

  // Typed amounts are whole rupees, but an edit left untouched keeps its exact amount (paise and all).
  const untouchedEdit = editing !== null && !editing.splitId && expr === exprFromMinor(editing.amountMinor);

  const amountMinor = untouchedEdit ? editing.amountMinor : amountValue === null ? 0 : toMinor(amountValue);

  const recovery = useEntryDraftRecovery(
    {
      type,
      expr,
      accountId,
      toAccountId,
      categoryId,
      note,
      paymentMode,
      date,
      personId,
      friendSign,
      friendAccountId,
      refund,
      rows,
      splitParts,
    },
    !editingId && formReady,
    expr !== '' || note.trim() !== '' || rows.length > 0 || splitParts !== null
  );

  const resumeDraft = () => {
    const d = recovery.candidate;
    if (!d) return;
    if (!draftReferencesAvailable(d, { accounts, categories, people })) {
      showAlert(
        'Draft references unavailable data',
        'An account, category or person in this draft is no longer available. Restore that item first, or discard this draft and start a new entry.'
      );
      return;
    }
    if (!recovery.resume()) return;
    setType(d.type);
    setExpr(d.expr);
    setAccountId(d.accountId);
    setToAccountId(d.toAccountId);
    setCategoryId(d.categoryId);
    setNote(d.note);
    setPaymentMode(d.paymentMode);
    setDate(d.date);
    setPersonId(d.personId);
    setFriendSign(d.friendSign);
    setFriendAccountId(d.friendAccountId);
    setRefund(d.refund);
    setRows(d.rows);
    setSplitParts(d.splitParts?.map((p, i) => ({ ...p, key: `recovered-${i}` })) ?? null);
    accountPickedByHandRef.current = true;
  };

  const [initialExpr] = useState(expr);

  const editChanged =
    editing !== null &&
    editBaseline !== null &&
    (expr !== editBaseline.expr ||
      type !== editBaseline.type ||
      refund !== editBaseline.refund ||
      toAccountId !== editBaseline.toAccountId ||
      splitSignature(splitParts) !== editBaseline.split ||
      paymentMode !== editing.paymentMode ||
      note !== editBaseline.note ||
      date !== editBaseline.date ||
      categoryId !== editBaseline.categoryId ||
      accountId !== editBaseline.accountId);

  const { leave } = useDiscardGuard(
    !saveDone &&
      !saving &&
      (editingId
        ? editChanged
        : expr !== initialExpr || note.trim() !== '' || rows.length > 0 || splitParts !== null),
    !editingId ? { onDiscard: recovery.discardCurrent, onKeepDraft: recovery.keep } : undefined
  );
  return { amountValue, untouchedEdit, amountMinor, recovery, resumeDraft, leave };
}
