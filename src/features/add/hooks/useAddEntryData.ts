import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { getTransactionById, getTransactionLink, listAccounts, listCategories } from '@/db/ledger';
import { getAddDefaults } from '@/db/settings';
import { listPeople } from '@/db/people';
import { Account } from '@/types';
import { EntryType, isTxType } from '@/features/add/addEntry';
import { exprFromMinor } from '@/lib/padMath';
import { errorMessage } from '@/lib/errorMessage';
import { getSplitParts } from '@/db/splits';
import { draftFromSaved, DraftPart } from '@/features/add/splitDraft';
import { takeSplitResult } from '@/features/add/splitSession';
import { showAlert } from '@/components/AppDialog';
import { splitSignature } from '@/features/add/utils/addEntryIdentity';
import type { useAddEntryEnvironment } from '@/features/add/hooks/useAddEntryEnvironment';
import type { useAddEntryState } from '@/features/add/hooks/useAddEntryState';

type Input = {
  state: ReturnType<typeof useAddEntryState>;
  environment: ReturnType<typeof useAddEntryEnvironment>;
};
export function useAddEntryData(input: Input) {
  const {
    addDefaultsRef,
    setAccountId,
    setToAccountId,
    setCategoryId,
    loadRequestRef,
    mountedRef,
    seededRef,
    editingAccountIdsRef,
    setAccounts,
    setCategories,
    setPeople,
    setEditing,
    setIsLinked,
    setType,
    setRefund,
    setExpr,
    setSplitParts,
    setNote,
    setPaymentMode,
    setDate,
    setEditBaseline,
    accountPickedByHandRef,
    setError,
    setFormReady,
    setPadOpen,
  } = input.state;
  const {
    editingId,
    initialType,
    refundParam,
    categoryParam,
    noteParam,
    initialAccountId,
    initialToAccountId,
  } = input.environment;

  /**
   * Pre-selects the account this entry type was last saved with, skipping one that no longer fits (gone, or
   * savings for expense/income) for the first spendable one. The category always starts empty.
   */
  const applyDefaults = useCallback(
    (t: EntryType, accs: Account[]) => {
      if (t === 'friend') return;
      const d = addDefaultsRef.current;
      if (t === 'transfer') {
        const td = d.transfer;
        if (td && accs.some((a) => a.id === td.accountId)) setAccountId(td.accountId);
        if (td?.toAccountId && accs.some((a) => a.id === td.toAccountId)) setToAccountId(td.toAccountId);
        return;
      }
      const td = d[t];
      if (td && accs.some((a) => a.id === td.accountId && a.type !== 'savings')) setAccountId(td.accountId);
      setCategoryId(null);
    },
    [addDefaultsRef, setAccountId, setCategoryId, setToAccountId]
  );

  const load = useCallback(async () => {
    const request = ++loadRequestRef.current;
    const current = () => mountedRef.current && request === loadRequestRef.current;
    try {
      const [allAccs, cats, ppl] = await Promise.all([
        listAccounts(!!editingId),
        listCategories(),
        listPeople(),
      ]);
      if (!current()) return;
      const tx = editingId && !seededRef.current ? await getTransactionById(editingId) : null;
      if (!current()) return;
      if (editingId && !seededRef.current && !tx) {
        // Deleted elsewhere since this was opened: saving would quietly make a new entry instead.
        showAlert('This entry no longer exists', 'It may have been deleted.', [
          {
            text: 'OK',
            onPress: () => {
              if (mountedRef.current) router.back();
            },
          },
        ]);
        return;
      }
      if (tx)
        editingAccountIdsRef.current = [tx.accountId, tx.toAccountId].filter((id): id is string => !!id);
      // An edit keeps the entry's own account(s) on offer even if since archived, or saving would quietly
      // move the entry onto another account. Other archived accounts stay out of the pickers.
      const accs = allAccs.filter((a) => !a.archived || editingAccountIdsRef.current.includes(a.id));
      setAccounts(accs);
      setCategories(cats);
      setPeople(ppl);

      if (editingId && !seededRef.current) {
        const link = await getTransactionLink(editingId);
        if (!current()) return;
        if (tx) {
          // Editing any part of a split edits the whole payment.
          let loadedParts: DraftPart[] | null = null;
          let loadedExpr = exprFromMinor(tx.amountMinor);
          if (tx.splitId) {
            const parts = await getSplitParts(tx.splitId);
            if (!current()) return;
            loadedParts = draftFromSaved(
              parts.map((p) => ({ categoryId: p.categoryId, amountMinor: p.amountMinor }))
            );
            loadedExpr = exprFromMinor(parts.reduce((sum, p) => sum + p.amountMinor, 0));
          }
          // Publish the edit together, after linked/split reads succeed. A failed read must not
          // expose one split part as an ordinary editable entry.
          setEditing(tx);
          setIsLinked(link !== null);
          setType(tx.isRefund ? 'expense' : tx.type);
          setRefund(!!tx.isRefund);
          setExpr(loadedExpr);
          setSplitParts(loadedParts);
          setAccountId(tx.accountId);
          setToAccountId(tx.toAccountId);
          setCategoryId(tx.categoryId);
          setNote(tx.note);
          setPaymentMode(tx.paymentMode);
          setDate(tx.date);
          setEditBaseline({
            note: tx.note,
            date: tx.date,
            categoryId: tx.categoryId,
            accountId: tx.accountId,
            toAccountId: tx.toAccountId,
            type: tx.isRefund ? 'expense' : tx.type,
            refund: !!tx.isRefund,
            expr: loadedExpr,
            split: splitSignature(loadedParts),
          });
        }
      } else if (!editingId && !seededRef.current) {
        addDefaultsRef.current = await getAddDefaults().catch(() => ({}));
        if (!current()) return;
        const startType = isTxType(initialType) ? initialType : 'expense';
        applyDefaults(startType, accs);
        // Wins over the remembered default — but only if it can actually take
        // this entry (a savings account can only be a transfer's "from").
        if (refundParam === '1') {
          if (categoryParam && cats.some((c) => c.id === categoryParam && c.kind === 'expense')) {
            setCategoryId(categoryParam);
          }
        }
        // A refund's note, or one typed into the daily reminder's "Type it in".
        if (noteParam) setNote(noteParam);
        // A Quick Add widget shortcut opens with its category already picked.
        if (
          refundParam !== '1' &&
          categoryParam &&
          cats.some((c) => c.id === categoryParam && c.kind === startType && !c.archived)
        ) {
          setCategoryId(categoryParam);
        }
        const asked = initialAccountId ? accs.find((a) => a.id === initialAccountId) : undefined;
        if (asked && (startType === 'transfer' || asked.type !== 'savings')) {
          setAccountId(asked.id);
          accountPickedByHandRef.current = true;
        }
        const askedTo = initialToAccountId ? accs.find((a) => a.id === initialToAccountId) : undefined;
        if (askedTo && startType === 'transfer') {
          setToAccountId(askedTo.id);
          // Moving money into an account can't come from that same account.
          setAccountId((from) =>
            from && from !== askedTo.id
              ? from
              : (accs.find((a) => a.id !== askedTo.id && !a.archived && a.type !== 'savings')?.id ?? from)
          );
        }
      }
      seededRef.current = true;
      setError(null);
      setFormReady(true);
    } catch (e) {
      if (current()) throw e;
    }
  }, [
    loadRequestRef,
    mountedRef,
    editingId,
    seededRef,
    editingAccountIdsRef,
    setAccounts,
    setCategories,
    setPeople,
    setError,
    setFormReady,
    setEditing,
    setIsLinked,
    setType,
    setRefund,
    setExpr,
    setSplitParts,
    setAccountId,
    setToAccountId,
    setCategoryId,
    setNote,
    setPaymentMode,
    setDate,
    setEditBaseline,
    addDefaultsRef,
    initialType,
    applyDefaults,
    refundParam,
    noteParam,
    categoryParam,
    initialAccountId,
    initialToAccountId,
    accountPickedByHandRef,
  ]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => {
        if (mountedRef.current) setError(errorMessage(e));
      });
      // Back from the split page with Done: the entry is split that way now.
      const split = takeSplitResult();
      if (split) {
        setSplitParts(split);
        setError(null);
        // The total is set; the split card is what's worth seeing now.
        setPadOpen(false);
      }
      return () => {
        loadRequestRef.current += 1;
      };
    }, [load, loadRequestRef, mountedRef, setError, setPadOpen, setSplitParts])
  );
  const retryLoad = (): void => {
    setError(null);
    void load().catch((error) => {
      if (mountedRef.current) setError(errorMessage(error));
    });
  };
  return { applyDefaults, load, retryLoad };
}
