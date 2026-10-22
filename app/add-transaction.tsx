import { emitTransactionsChanged } from '@/lib/dataEvents';
import { useEntryDraftRecovery } from '@/features/add/useEntryDraftRecovery';
import { draftReferencesAvailable } from '@/features/add/draftReferences';
import type { PaymentMode } from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, Keyboard } from 'react-native';
import { Text } from '@/components/Text';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import {
  listAccounts,
  listCategories,
  updateTransaction,
  getTransactionById,
  getTransactionLink,
  getLastAccountForCategory,
  findRecentRepeat,
} from '@/db/ledger';
import { getAddDefaults, setAddDefaults, AddDefaults } from '@/db/settings';
import { listPeople, PersonWithBalance } from '@/db/people';
import { Account, Category, Transaction } from '@/types';
import { theme } from '@/constants/theme';
import { toMinor, formatMoney } from '@/lib/money';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { useFadeIn } from '@/lib/useFadeIn';
import { markJustAdded } from '@/lib/justAdded';
import { haptics } from '@/lib/haptics';
import { SkyHeader } from '@/features/home/SkyHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { StripCard } from '@/components/StripCard';
import { styles } from '@/features/add/add.styles';
import {
  ADD_TYPES,
  EDIT_TYPES,
  EntryType,
  Staged,
  isTxType,
  dateChipLabel,
  repeatKey,
  formToStaged as formToStagedEntry,
  TYPE_WASH,
  typeWash,
} from '@/features/add/addEntry';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { Glass } from '@/components/Glass';
import { applyPadKey, evaluateAmount, exprFromMinor, hasOperator, PadKey } from '@/lib/padMath';
import { AmountPad } from '@/components/AmountPad';
import { FriendFields } from '@/features/add/AddFields';
import { AddDetailRow } from '@/features/add/AddDetailRow';
import { AddSheets } from '@/features/add/AddSheets';
import { AmountCard, TransferAccounts, UsualChips, StagedList } from '@/features/add/AddSections';
import { errorMessage } from '@/lib/errorMessage';
import { MAX_AMOUNT_MINOR } from '@/lib/amountLimits';
import { useOnKeyboardHide } from '@/lib/useOnKeyboardHide';
import { withPressed } from '@/lib/pressed';
import { getSplitParts, saveSplit } from '@/db/splits';
import {
  DraftPart,
  seedParts,
  draftFromSaved,
  splitProblem,
  splitProblemText,
  toSplitParts,
} from '@/features/add/splitDraft';
import { openSplitSession, takeSplitResult } from '@/features/add/splitSession';
import { SplitCard } from '@/features/add/SplitCard';
import { formatTyped, persistStaged, saveButtonTitle, stagedTotals } from '@/features/add/saveEntry';
import { confirmDeleteEntry } from '@/features/add/deleteEntry';
import { useAddSuggestions } from '@/features/add/useAddSuggestions';
import { useDiscardGuard } from '@/features/add/useDiscardGuard';
import { showAlert } from '@/components/AppDialog';
import { useUndoToast } from '@/components/UndoToast';
import { spendableAccountsOf, defaultCurrencyAccountsOf } from '@/lib/account';
import { useAccent } from '@/theme/AccentContext';
import { useReduceMotion } from '@/lib/useReduceMotion';

// Part keys belong to the split editor's UI, not to the saved entry.
const splitSignature = (parts: DraftPart[] | null) =>
  JSON.stringify(parts?.map((p) => [p.categoryId, p.amountText]) ?? null);

/** How far ahead a date can be before saving asks "are you sure?". */
const FUTURE_DATE_CHECK_DAYS = 7;
export default function AddTransactionScreen() {
  const insets = useSafeAreaInsets();
  const { show: showUndo } = useUndoToast();
  const { accent, secondary } = useAccent();
  const reduceMotion = useReduceMotion();
  // `accountId` pre-selects the account (the "from" side of a transfer) —
  // Home's account summary sheet opens Add this way.
  const params = useLocalSearchParams<{
    type?: string;
    id?: string;
    accountId?: string;
    toAccountId?: string;
    /** Prefills the amount, in minor units — a card's "Pay bill". */
    amount?: string;
    /** "Got money back" on an entry: opens as a refund for its category, with its note. */
    refund?: string;
    categoryId?: string;
    note?: string;
  }>();
  const editingId = params.id;
  const initialType = params.type;
  const initialAccountId = params.accountId;
  // A transfer's destination, e.g. "Move money here" on a goal that follows an account.
  const initialToAccountId = params.toAccountId;
  // "Got money back" on an entry: a refund for its category, with its note.
  const refundParam = params.refund;
  const categoryParam = params.categoryId;
  const noteParam = params.note;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<PersonWithBalance[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  // What an edit opened with, so leaving with real changes asks first.
  const [editBaseline, setEditBaseline] = useState<{
    note: string;
    date: string;
    categoryId: string | null;
    accountId: string;
    toAccountId: string | null;
    type: EntryType;
    refund: boolean;
    expr: string;
    split: string;
  } | null>(null);
  const [isLinked, setIsLinked] = useState(false);
  // Whether this screen has filled its form once; a ref so the focus reload keeps one identity.
  const seeded = useRef(false);
  const [formReady, setFormReady] = useState(false);

  const [type, setType] = useState<EntryType>(isTxType(params.type) ? params.type : 'expense');
  // What's been typed on the number pad — a number, or a sum like "120+45".
  const [expr, setExpr] = useState(() => {
    const minor = Number(params.amount);
    return Number.isInteger(minor) && minor > 0 && minor <= MAX_AMOUNT_MINOR ? exprFromMinor(minor) : '';
  });
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [date, setDate] = useState(() => toLocalIsoDate(new Date()));

  // Friend mode
  const [personId, setPersonId] = useState<string | null>(null);
  const [friendSign, setFriendSign] = useState<1 | -1>(1);
  const [friendAccountId, setFriendAccountId] = useState<string | null>(null);

  const [rows, setRows] = useState<Staged[]>([]);
  // "Money back" on the Expense tab: this entry is a refund.
  const [refund, setRefund] = useState(params.refund === '1');
  // Split mode: this payment spread across categories (null when it isn't split).
  // The parts are made on the split page (app/split.tsx) and come back here on Done.
  const [splitParts, setSplitParts] = useState<DraftPart[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingRow, setAddingRow] = useState(false);
  const [saveDone, setSaveDone] = useState(false);
  // Remains set after a commit until this route closes; queued taps must not replay a save.
  const committed = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);

  // The pad is up straight away for a new entry (amount comes first); an edit opens without it since often
  // only the category/date changes — tapping the amount raises it.
  const [padOpen, setPadOpen] = useState(!editingId);
  const [noteEditing, setNoteEditing] = useState(false);
  // Closing the keyboard (back gesture or down key) ends typing in category search/note, so the pad
  // returns; Android leaves the field focused otherwise and the pad stayed hidden.
  useOnKeyboardHide(() => {
    setSearchFocused(false);
    setNoteEditing(false);
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [addAccountVisible, setAddAccountVisible] = useState(false);
  const [addPersonVisible, setAddPersonVisible] = useState(false);
  const [repeatSheetVisible, setRepeatSheetVisible] = useState(false);
  // A repeat warning names the entry it's about; tapping Save again with
  // that same entry saves it anyway. Any change to the entry clears it.
  const [repeatWarning, setRepeatWarning] = useState<{ key: string; message: string } | null>(null);

  // What each entry type was last saved with (see AddDefaults) — loaded once
  // for a new entry, never for an edit, which always shows the entry's own values.
  const addDefaults = useRef<AddDefaults>({});
  // Once you pick an account yourself, picking a category stops choosing one for you.
  const accountPickedByHand = useRef(false);
  // The account(s) of the entry being edited, kept on offer even if archived (see load).
  const editingAccountIds = useRef<string[]>([]);

  const listFade = useFadeIn();
  // The pending "done → back"; cleared on unmount so a swipe-back in that window can't pop a second screen.
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const loadRequest = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (backTimer.current) clearTimeout(backTimer.current);
    };
  }, []);

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
    accountPickedByHand.current = true;
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

  const { frequentAmounts, usual } = useAddSuggestions({
    type,
    categoryId,
    editingId,
    accountCurrency: accounts.find((a) => a.id === accountId)?.currency,
  });

  // A new entry's account follows its category (the account that category was last used with) until you
  // pick an account yourself.
  useEffect(() => {
    if (editingId || accountPickedByHand.current || !categoryId) return;
    if (type !== 'expense' && type !== 'income') return;
    let cancelled = false;
    getLastAccountForCategory(categoryId)
      .then((id) => {
        if (cancelled || accountPickedByHand.current || !id) return;
        if (accounts.some((a) => a.id === id && a.type !== 'savings')) setAccountId(id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [categoryId, type, accounts, editingId]);

  /**
   * Pre-selects the account this entry type was last saved with, skipping one that no longer fits (gone, or
   * savings for expense/income) for the first spendable one. The category always starts empty.
   */
  const applyDefaults = useCallback((t: EntryType, accs: Account[]) => {
    if (t === 'friend') return;
    const d = addDefaults.current;
    if (t === 'transfer') {
      const td = d.transfer;
      if (td && accs.some((a) => a.id === td.accountId)) setAccountId(td.accountId);
      if (td?.toAccountId && accs.some((a) => a.id === td.toAccountId)) setToAccountId(td.toAccountId);
      return;
    }
    const td = d[t];
    if (td && accs.some((a) => a.id === td.accountId && a.type !== 'savings')) setAccountId(td.accountId);
    setCategoryId(null);
  }, []);

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    const current = () => mounted.current && request === loadRequest.current;
    try {
      const [allAccs, cats, ppl] = await Promise.all([
        listAccounts(!!editingId),
        listCategories(),
        listPeople(),
      ]);
      if (!current()) return;
      const tx = editingId && !seeded.current ? await getTransactionById(editingId) : null;
      if (!current()) return;
      if (editingId && !seeded.current && !tx) {
        // Deleted elsewhere since this was opened: saving would quietly make a new entry instead.
        showAlert('This entry no longer exists', 'It may have been deleted.', [
          {
            text: 'OK',
            onPress: () => {
              if (mounted.current) router.back();
            },
          },
        ]);
        return;
      }
      if (tx) editingAccountIds.current = [tx.accountId, tx.toAccountId].filter((id): id is string => !!id);
      // An edit keeps the entry's own account(s) on offer even if since archived, or saving would quietly
      // move the entry onto another account. Other archived accounts stay out of the pickers.
      const accs = allAccs.filter((a) => !a.archived || editingAccountIds.current.includes(a.id));
      setAccounts(accs);
      setCategories(cats);
      setPeople(ppl);

      if (editingId && !seeded.current) {
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
      } else if (!editingId && !seeded.current) {
        addDefaults.current = await getAddDefaults().catch(() => ({}));
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
          accountPickedByHand.current = true;
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
      seeded.current = true;
      setError(null);
      setFormReady(true);
    } catch (e) {
      if (current()) throw e;
    }
  }, [
    editingId,
    initialType,
    initialAccountId,
    initialToAccountId,
    refundParam,
    categoryParam,
    noteParam,
    applyDefaults,
  ]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => {
        if (mounted.current) setError(errorMessage(e));
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
        loadRequest.current += 1;
      };
    }, [load])
  );

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense')),
    [categories, type]
  );

  // Savings accounts aren't directly spendable: expense/income/friend entries offer only non-savings
  // accounts, transfers all. createTransaction (src/db/ledger.ts) enforces it too.
  const spendableAccounts = useMemo(() => spendableAccountsOf(accounts), [accounts]);
  const friendAccounts = defaultCurrencyAccountsOf(spendableAccounts);
  const pickableAccounts =
    type === 'transfer' ? accounts : type === 'friend' ? friendAccounts : spendableAccounts;
  const effectiveAccountId =
    accountId && pickableAccounts.some((a) => a.id === accountId)
      ? accountId
      : (pickableAccounts[0]?.id ?? null);
  const effectiveAccount = accounts.find((a) => a.id === effectiveAccountId);
  const today = toLocalIsoDate(new Date());
  const yesterday = addDaysToIsoDate(today, -1);
  // The amount's currency: the account it's going on (a friend entry's, if cash moved).
  const currency =
    (type === 'friend'
      ? accounts.find((a) => a.id === friendAccountId)?.currency
      : effectiveAccount?.currency) ?? undefined;

  // Any change to what's being entered clears a repeat warning about the old entry.
  useEffect(() => {
    setRepeatWarning(null);
  }, [expr, type, effectiveAccountId, toAccountId, categoryId, date]);

  const onTypeChange = (next: EntryType) => {
    if (committed.current || saveInFlight.current || saving || addingRow || saveDone) return;
    // A saved split is one expense across categories: switching it to income or a transfer would save only
    // the tapped part, as the whole payment. It stays an expense here.
    if (editing?.splitId && next !== 'expense') {
      showAlert(
        "A split can't change type",
        'A split payment is always an expense. To record it differently, delete the split and add it again.'
      );
      return;
    }
    setType(next);
    setCategoryId(null);
    // Only expenses split, or take money back.
    if (next !== 'expense') {
      setSplitParts(null);
      setRefund(false);
    }
    // A new entry switches to what this type was last saved with; an edit
    // keeps its own values, exactly as before.
    if (!editing) applyDefaults(next, accounts);
  };

  const pickAccount = (id: string) => {
    accountPickedByHand.current = true;
    setAccountId(id);
  };

  const onPadKey = (key: PadKey) => {
    if (saveInFlight.current || committed.current) return;
    setError(null);
    setExpr((prev) => applyPadKey(prev, key));
  };

  /** Remembers what was just saved, per type, for the next new entry. Best-effort. */
  const rememberDefaults = (saved: Staged[]) => {
    const next: AddDefaults = { ...addDefaults.current };
    for (const r of saved) {
      if (r.kind !== 'transaction') continue;
      if (r.type === 'transfer') next.transfer = { accountId: r.accountId, toAccountId: r.toAccountId };
      else next[r.type] = { accountId: r.accountId, categoryId: r.categoryId };
    }
    addDefaults.current = next;
    setAddDefaults(next).catch(() => {});
  };

  const clearForm = () => {
    setExpr('');
    setNote('');
    setNoteEditing(false);
  };

  /** Validate the current form into a staged row, or return an error string. */
  const formToStaged = () =>
    formToStagedEntry(
      {
        type,
        amountMinor,
        date,
        note,
        accountId: effectiveAccountId,
        toAccountId,
        categoryId,
        personId,
        friendSign,
        friendAccountId,
        refund,
        paymentMode,
      },
      { accounts, categories, people }
    );

  /**
   * True (with a note) when `row` looks like one saved in the last 30 minutes or already listed below; the
   * first Save only warns, a second goes ahead. Friend entries and edits aren't checked.
   */
  const warnIfRepeat = async (row: Staged): Promise<boolean> => {
    if (editing || row.kind !== 'transaction') return false;
    const key = repeatKey(row);
    if (repeatWarning?.key === key) return false;
    const what = `${formatMoney(row.amountMinor, currency)} · ${row.label}`;
    let message: string | null = null;
    if (rows.some((r) => r.kind === 'transaction' && repeatKey(r) === key)) {
      message = `${what} is already on your list below. Tap again to add it anyway.`;
    } else {
      const hit = await findRecentRepeat(row).catch(() => null);
      if (hit) {
        const at = new Date(hit.savedAt).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        });
        const from = accounts.find((a) => a.id === row.accountId)?.name;
        message = `You added ${what}${from ? ` from ${from}` : ''} at ${at}. Tap again to add it anyway.`;
      }
    }
    if (!mounted.current) return true;
    if (!message) return false;
    haptics.warn();
    setRepeatWarning({ key, message });
    return true;
  };

  const addRow = async () => {
    if (!mounted.current || !formReady || committed.current || saveInFlight.current || saving || saveDone)
      return;
    saveInFlight.current = true;
    setAddingRow(true);
    try {
      setError(null);
      const res = formToStaged();
      if ('error' in res) {
        setError(res.error);
        return;
      }
      if ((await warnIfRepeat(res.row)) || !mounted.current) return;
      setRows((prev) => [...prev, res.row]);
      clearForm();
    } finally {
      saveInFlight.current = false;
      setAddingRow(false);
    }
  };

  const removeRow = (id: string) => {
    if (saveInFlight.current || committed.current) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const totals = stagedTotals(rows);

  // A brief "done" checkmark (PrimaryButton `done`) before navigating back; the data is already saved, so
  // the delay is purely felt confirmation.
  const goBackAfterSave = () => {
    committed.current = true;
    emitTransactionsChanged();
    if (!editingId)
      void recovery.clear().catch(() => {
        if (mounted.current)
          showAlert(
            'Entry saved',
            'The entry was saved, but its recovery draft could not be removed. Discard that draft if it appears again.'
          );
      });
    if (!mounted.current) return;
    setSaveDone(true);
    backTimer.current = setTimeout(
      () => {
        if (mounted.current) router.back();
      },
      reduceMotion ? 0 : 320
    );
  };

  const onSaveSplit = async () => {
    if (!splitParts) return;
    setError(null);
    const problem = splitProblem(amountMinor, splitParts);
    if (problem) {
      const nameOf = (key: string) =>
        categories.find((c) => c.id === splitParts.find((p) => p.key === key)?.categoryId)?.name ??
        'this part';
      setError(splitProblemText(problem, splitParts, nameOf, (m) => formatMoney(m, currency)));
      return;
    }
    if (!effectiveAccountId) {
      setError('Pick an account');
      return;
    }
    setSaving(true);
    try {
      if (!editingId) await recovery.prepareSave();
      const splitId = await saveSplit({
        splitId: editing?.splitId ?? null,
        // Splitting an ordinary entry being edited: the parts take its place.
        replacesEntryId: editing && !editing.splitId ? editing.id : null,
        accountId: effectiveAccountId,
        date,
        note: note.trim(),
        parts: toSplitParts(amountMinor, splitParts),
        paymentMode,
      });
      // The lists you land back on glow the new parts, like any saved entry.
      try {
        markJustAdded((await getSplitParts(splitId)).map((p) => p.id));
      } catch {
        /* The split is saved; highlight lookup failure must never invite a second save. */
      }
      goBackAfterSave();
    } catch (e) {
      if (!editingId) recovery.resumeAfterFailedSave();
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  /** Opens the split page with this payment: its parts so far, or its category holding all of it. */
  const openSplit = () => {
    if (!formReady || saveInFlight.current || committed.current) return;
    setError(null);
    if (amountMinor <= 0) {
      setError('Enter the amount first');
      setPadOpen(true);
      return;
    }
    const dateLabel = date === today ? 'Today' : date === yesterday ? 'Yesterday' : dateChipLabel(date);
    openSplitSession({
      totalMinor: amountMinor,
      currency,
      meta: [effectiveAccount?.name, dateLabel, note.trim()].filter(Boolean).join(' · '),
      categories: filteredCategories,
      parts: splitParts ?? seedParts(categoryId),
    });
    router.push('/split');
  };

  const onSaveSingleEdit = async () => {
    setError(null);
    const res = formToStaged();
    if ('error' in res) {
      setError(res.error);
      return;
    }
    const r = res.row;
    if (r.kind !== 'transaction' || !editing) return;
    setSaving(true);
    try {
      await updateTransaction(editing.id, {
        type: r.type,
        accountId: r.accountId,
        toAccountId: r.toAccountId,
        categoryId: r.categoryId,
        amountMinor: r.amountMinor,
        date: r.date,
        note: r.note,
        // Turning Money back off makes it an expense again, and on makes it a refund.
        isRefund: !!r.isRefund,
        paymentMode: r.paymentMode,
      });
      markJustAdded([editing.id]);
      goBackAfterSave();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const onSaveAll = async () => {
    setError(null);
    const pending = [...rows];
    if (expr !== '') {
      const res = formToStaged();
      if ('error' in res) {
        setError(res.error);
        return;
      }
      if ((await warnIfRepeat(res.row)) || !mounted.current) return;
      pending.push(res.row);
    }
    if (pending.length === 0) {
      setError('Enter an amount');
      return;
    }

    setSaving(true);
    let saved = 0;
    const savedIds: string[] = [];
    let prepared = false;
    try {
      await recovery.prepareSave();
      prepared = true;
      for (const r of pending) {
        const id = await persistStaged(r, categories);
        if (id) savedIds.push(id);
        saved += 1;
      }
      // The lists you land back on glow these rows once (lib/justAdded).
      markJustAdded(savedIds);
      rememberDefaults(pending);
      goBackAfterSave();
    } catch (e) {
      recovery.resumeAfterFailedSave();
      if (!prepared) {
        setError(`Couldn’t prepare this save: ${errorMessage(e)}`);
        setSaving(false);
        return;
      }
      if (saved > 0) emitTransactionsChanged();
      // Keep only what didn't make it in, so a retry doesn't double up.
      setRows(pending.slice(saved));
      clearForm();
      setSaving(false);
      showAlert(
        saved > 0 ? 'Only some entries saved' : 'No entries saved',
        `${saved} of ${pending.length} saved before this went wrong: ${errorMessage(e)}`
      );
    }
  };

  // The synchronous lock covers queued taps before React publishes the busy state.
  const saveInFlight = useRef(false);
  const runSave = async (save: () => Promise<void>, dateChecked = false) => {
    if (!mounted.current || !formReady || isLinked || committed.current || saveInFlight.current) return;
    // A date well ahead is usually a typo (the wrong year), and it moves today's balances straight away.
    const pendingDates = !editing && !splitParts ? rows.map((row) => row.date) : [];
    if (editing || splitParts || expr !== '') pendingDates.push(date);
    const futureDate = pendingDates.find((d) => d > addDaysToIsoDate(today, FUTURE_DATE_CHECK_DAYS));
    if (!dateChecked && futureDate) {
      showAlert(`Save it for ${dateChipLabel(futureDate)}?`, "That's more than a week from today.", [
        { text: 'Change date', style: 'cancel' },
        { text: 'Save', onPress: () => void runSave(save, true) },
      ]);
      return;
    }
    saveInFlight.current = true;
    setSaving(true);
    try {
      await save();
    } finally {
      saveInFlight.current = false;
      if (mounted.current && !committed.current) setSaving(false);
    }
  };

  const onDelete = () => {
    if (!editing || saveInFlight.current || saving || addingRow || saveDone) return;
    confirmDeleteEntry({
      editing,
      splitParts: splitParts?.length ?? 2,
      showUndo,
      onStart: () => {
        if (!mounted.current || committed.current || saveInFlight.current) return false;
        saveInFlight.current = true;
        setSaving(true);
        setError(null);
        return true;
      },
      onDeleted: () => {
        committed.current = true;
        if (!mounted.current) return false;
        leave(() => router.back());
        return true;
      },
      onError: (message) => {
        saveInFlight.current = false;
        if (!mounted.current) return;
        setSaving(false);
        setError(message);
      },
    });
  };

  /** Picks the person just added in the new-person sheet. */
  const onPersonAdded = async () => {
    setAddPersonVisible(false);
    const before = new Set(people.map((p) => p.id));
    try {
      const ppl = await listPeople();
      setPeople(ppl);
      const added = ppl.find((p) => !before.has(p.id));
      if (added) setPersonId(added.id);
    } catch (e) {
      showAlert("Couldn't load people", errorMessage(e));
    }
  };

  const title = editingId ? 'Edit entry' : 'Add';
  const sum = hasOperator(expr);
  const shownAmount = sum
    ? amountValue === null
      ? '—'
      : formatTyped(String(amountValue))
    : expr !== '' && amountValue === null
      ? '—'
      : formatTyped(expr);
  const invalidAmount = expr !== '' && amountMinor <= 0;
  const roundingNote =
    !untouchedEdit && amountValue !== null && amountValue !== amountMinor / 100
      ? `Saved in whole units: ${formatMoney(amountMinor, currency)}`
      : undefined;
  const currentValidation = formToStaged();
  const currentProblem = 'error' in currentValidation ? currentValidation.error : undefined;
  const cannotSave = splitParts
    ? !!splitProblem(amountMinor, splitParts) || !effectiveAccountId
    : (expr !== '' || rows.length === 0) && !!currentProblem;
  // The Save button names the amount it saves; the category shows on the grid and the account on its chip.
  const saveSummary = amountMinor > 0 && !invalidAmount ? formatMoney(amountMinor, currency) : undefined;
  const saveTitle = saveButtonTitle({
    saving,
    editing: !!editing,
    split: !!splitParts,
    refund,
    repeatWarning: !!repeatWarning,
    rowCount: rows.length,
    hasCurrent: expr !== '',
    summary: saveSummary,
  });
  // The pad steps aside whenever the phone keyboard is up (a note, a category search).
  const padVisible = padOpen && !noteEditing && !searchFocused && !isLinked;
  const formBusy = saving || addingRow || saveDone;

  // The pad's sum keys wear the entry's colour (green for money back), like the amount above them.
  const wash = refund ? TYPE_WASH.income : typeWash(type, accent);
  const padTone = { bg: wash.bg, ink: wash.accent };

  const saveButton = (
    <PrimaryButton
      title={saveTitle}
      icon="check"
      done={saveDone}
      loading={saving && !saveDone}
      onPress={() => void runSave(splitParts ? onSaveSplit : editing ? onSaveSingleEdit : onSaveAll)}
      disabled={!formReady || saving || addingRow || saveDone || isLinked || cannotSave}
      style={styles.saveBtn}
    />
  );
  const addToListDisabled = !formReady || saving || addingRow || saveDone || !!currentProblem;
  const addToListButton = !editingId && !splitParts && (
    <Pressable
      onPress={addRow}
      disabled={addToListDisabled}
      style={withPressed([styles.addToList, addToListDisabled && styles.actionDisabled])}
      accessibilityRole="button"
      accessibilityState={{ disabled: addToListDisabled }}
      accessibilityHint="Keeps this entry on a list and starts the next one; Save saves them all"
    >
      <Feather name="plus" size={14} color={theme.colors.textPrimary} />
      <Text style={styles.addToListText}>{addingRow ? 'Adding…' : 'Add more'}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} />
      <SkyHeader
        title={title}
        showBack
        hideUser
        wallpaper
        closeIcon
        actions={
          editingId ? (
            editing && !isLinked ? (
              <Pressable
                onPress={onDelete}
                disabled={saving || addingRow || saveDone}
                accessibilityState={{ disabled: saving || addingRow || saveDone }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Delete entry"
                style={withPressed(styles.trashBtn)}
              >
                <Feather name="trash-2" size={16} color={theme.colors.expense} />
              </Pressable>
            ) : undefined
          ) : (
            <Pressable
              onPress={() => {
                if (
                  formReady &&
                  !committed.current &&
                  !saveInFlight.current &&
                  !saving &&
                  !addingRow &&
                  !saveDone
                )
                  setRepeatSheetVisible(true);
              }}
              disabled={!formReady || saving || addingRow || saveDone}
              accessibilityState={{ disabled: !formReady || saving || addingRow || saveDone }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Repeat a recent entry"
              style={withPressed(styles.repeatBtn)}
            >
              <Feather name="rotate-ccw" size={13} color={theme.colors.textPrimary} />
              <Text style={styles.repeatBtnText}>Repeat</Text>
            </Pressable>
          )
        }
      >
        <SegmentedControl
          options={editingId ? EDIT_TYPES : ADD_TYPES}
          value={type}
          onChange={onTypeChange}
          disabled={!formReady || formBusy}
          onBand
        />
      </SkyHeader>

      <KeyboardAwareScrollView
        pointerEvents={formBusy ? 'none' : 'auto'}
        accessibilityElementsHidden={formBusy}
        importantForAccessibility={formBusy ? 'no-hide-descendants' : 'auto'}
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
        // Clears the sticky footer that rides on the keyboard, not just the keyboard: a focused field (the
        // category search) would otherwise sit right behind Save.
        bottomOffset={footerHeight + 12}
      >
        {!formReady && (
          <View style={styles.section}>
            <Text style={styles.formHint}>{error ? 'The entry could not be loaded.' : 'Loading entry…'}</Text>
            {error && (
              <PrimaryButton
                compact
                variant="secondary"
                title="Retry loading"
                onPress={() => {
                  setError(null);
                  void load().catch((e) => {
                    if (mounted.current) setError(errorMessage(e));
                  });
                }}
              />
            )}
          </View>
        )}
        {isLinked && (
          <StripCard
            tone={theme.colors.slice.due}
            lifted={false}
            style={[styles.linkedNote, styles.noteCard]}
          >
            <Text style={styles.linkedText}>
              This entry is tied to a loan or a person&rsquo;s ledger — edit it from there.
            </Text>
          </StripCard>
        )}

        <AmountCard
          type={type}
          refund={refund}
          currency={currency}
          expr={expr}
          isSum={sum}
          shownAmount={shownAmount}
          padVisible={padVisible}
          isLinked={isLinked}
          onOpenPad={() => {
            Keyboard.dismiss();
            setSearchFocused(false);
            setNoteEditing(false);
            setPadOpen(true);
          }}
          onTogglePad={() => {
            Keyboard.dismiss();
            setSearchFocused(false);
            setNoteEditing(false);
            setPadOpen(!padVisible);
            setError(null);
          }}
          amountIssue={invalidAmount ? 'Enter a positive amount. Check the calculation.' : roundingNote}
          frequentAmounts={frequentAmounts}
          amountMinor={amountMinor}
          onPickAmount={(minor) => setExpr(exprFromMinor(minor))}
        />

        {recovery.candidate && (
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 12,
              padding: 14,
              gap: 8,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
            }}
          >
            <Text style={{ fontFamily: theme.font.bodyBold }}>Continue your unfinished entry?</Text>
            <Text style={{ color: theme.colors.textSecondary }}>
              Nothing in this draft has been recorded. Check its date and accounts before saving.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <PrimaryButton
                compact
                title="Resume draft"
                disabled={recovery.discarding}
                onPress={resumeDraft}
              />
              <PrimaryButton
                compact
                variant="secondary"
                title="Discard draft"
                loading={recovery.discarding}
                onPress={() =>
                  void recovery
                    .discardCandidate()
                    .catch(() => setError('Couldn’t remove the draft. Try again.'))
                }
              />
            </View>
          </View>
        )}
        {recovery.error && (
          <Text style={{ marginHorizontal: 16, color: theme.colors.textSecondary }}>{recovery.error}</Text>
        )}
        {repeatWarning && (
          <View style={styles.repeatNote} accessibilityLiveRegion="polite">
            <Feather name="alert-triangle" size={14} color={theme.colors.idGoldDeep} />
            <Text style={styles.repeatNoteText}>{repeatWarning.message}</Text>
          </View>
        )}

        {type === 'friend' ? (
          <Glass radius={24} style={styles.fieldCard}>
            <FriendFields
              people={people}
              accounts={friendAccounts}
              personId={personId}
              setPersonId={setPersonId}
              friendSign={friendSign}
              setFriendSign={setFriendSign}
              friendAccountId={friendAccountId}
              setFriendAccountId={setFriendAccountId}
              onAddPerson={() => setAddPersonVisible(true)}
            />
          </Glass>
        ) : (
          <>
            {pickableAccounts.length === 0 && (
              // Nothing to record this against yet (previously only a "Pick an account" error on Save):
              // opens the same Add Account form Profile uses, right here.
              <StripCard tone={accent} style={[styles.noAccountCard, styles.noteCard]}>
                <Text style={styles.noAccountTitle}>
                  {accounts.length === 0 ? 'Add your first account' : 'Add a spendable account'}
                </Text>
                <Text style={styles.noAccountText}>
                  {accounts.length === 0
                    ? 'A bank, cash or wallet account.'
                    : 'Savings only take transfers. Add a bank, cash or wallet account.'}
                </Text>
                <PrimaryButton
                  title="Add an account"
                  onPress={() => setAddAccountVisible(true)}
                  style={styles.noAccountBtn}
                />
              </StripCard>
            )}

            {type === 'transfer' ? (
              <Glass radius={24} style={styles.fieldCard}>
                <TransferAccounts
                  fromOptions={pickableAccounts}
                  accounts={accounts}
                  fromId={effectiveAccountId}
                  toId={toAccountId}
                  onPickFrom={pickAccount}
                  onPickTo={setToAccountId}
                />
              </Glass>
            ) : splitParts ? (
              <SplitCard
                parts={splitParts}
                totalMinor={amountMinor}
                categories={filteredCategories}
                currency={currency}
                onEdit={openSplit}
                onRemove={
                  editing
                    ? undefined
                    : () => {
                        setSplitParts(null);
                        setError(null);
                      }
                }
              />
            ) : (
              <View style={styles.section}>
                {usual.length > 0 && !isLinked && (
                  <UsualChips
                    usual={usual}
                    categoryId={categoryId}
                    amountMinor={amountMinor}
                    accountId={effectiveAccountId}
                    onPick={(u) => {
                      setCategoryId(u.categoryId);
                      setExpr(exprFromMinor(u.amountMinor));
                      pickAccount(u.accountId);
                    }}
                  />
                )}
                <Glass radius={24} style={styles.fieldCard}>
                  <CategoryPicker
                    categories={filteredCategories}
                    selectedId={categoryId}
                    onSelect={(id) => {
                      setCategoryId(id);
                      // Amount typed: the pad folds away so the grid and Save have the room.
                      if (expr !== '') setPadOpen(false);
                    }}
                    variant="medal"
                    searchable
                    minColumnWidth={80}
                    onSearchFocusChange={setSearchFocused}
                  />
                </Glass>
              </View>
            )}
          </>
        )}

        {rows.length > 0 && (
          <StagedList
            rows={rows}
            netMinor={totals.income - totals.expense}
            fadeStyle={listFade}
            onRemove={removeRow}
          />
        )}
      </KeyboardAwareScrollView>

      <KeyboardStickyView
        onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
        offset={{ opened: insets.bottom }}
        style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}
      >
        {!error && !repeatWarning && !splitParts && currentProblem && (
          <View style={styles.footerStatus}>
            <Text style={styles.formHint}>
              {invalidAmount ? 'Enter a positive amount. Check the calculation.' : currentProblem}
            </Text>
          </View>
        )}
        {rows.length > 0 && <Text style={styles.queueHint}>{rows.length} on your list</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        <View
          pointerEvents={formBusy || !formReady ? 'none' : 'auto'}
          accessibilityElementsHidden={formBusy || !formReady}
          importantForAccessibility={formBusy || !formReady ? 'no-hide-descendants' : 'auto'}
        >
          <AddDetailRow
            type={type}
            accountName={effectiveAccount?.name}
            date={date}
            today={today}
            yesterday={yesterday}
            note={note}
            noteEditing={noteEditing}
            isLinked={isLinked}
            refund={refund}
            splitCount={splitParts ? splitParts.length : null}
            hasList={rows.length > 0}
            onNoteChange={setNote}
            onNoteEditing={setNoteEditing}
            onPickAccount={() => setAccountSheetOpen(true)}
            onPickDate={() => setCalendarOpen(true)}
            onToggleRefund={() => {
              setRefund((r) => !r);
              setError(null);
            }}
            onSplit={openSplit}
            onHidePad={padVisible ? () => setPadOpen(false) : undefined}
          />
        </View>
        {padVisible ? (
          <AmountPad
            onKey={onPadKey}
            onClear={() => {
              if (!saveInFlight.current && !committed.current) setExpr('');
            }}
            tone={padTone}
          >
            {addToListButton}
            {saveButton}
          </AmountPad>
        ) : (
          <View style={styles.actionRow}>
            {addToListButton}
            {saveButton}
          </View>
        )}
      </KeyboardStickyView>

      <AddSheets
        accountSheet={{
          open: accountSheetOpen,
          title: type === 'income' ? 'Received in' : 'Pay from',
          accounts: pickableAccounts,
          activeId: effectiveAccountId,
          onClose: () => setAccountSheetOpen(false),
          onPick: (id) => {
            pickAccount(id);
            setAccountSheetOpen(false);
          },
        }}
        addAccount={{
          visible: addAccountVisible,
          onClose: () => setAddAccountVisible(false),
          onCreated: async () => {
            setAddAccountVisible(false);
            setError(null);
            await load();
          },
        }}
        addPerson={{
          visible: addPersonVisible,
          onClose: () => setAddPersonVisible(false),
          onCreated: () => void onPersonAdded(),
        }}
        calendar={{
          visible: calendarOpen,
          value: date,
          onClose: () => setCalendarOpen(false),
          onPick: setDate,
        }}
        repeat={{
          visible: repeatSheetVisible,
          onClose: () => setRepeatSheetVisible(false),
          onLogged: () => leave(() => router.back()),
        }}
      />
    </View>
  );
}
