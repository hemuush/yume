import type { PaymentMode } from '@/types';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { AddDefaults } from '@/db/settings';
import { PersonWithBalance } from '@/db/people';
import { Account, Category, Transaction } from '@/types';
import { toLocalIsoDate } from '@/lib/date';
import { useFadeIn } from '@/lib/useFadeIn';
import { EntryType, isTxType, Staged } from '@/features/add/addEntry';
import { exprFromMinor } from '@/lib/padMath';
import { MAX_AMOUNT_MINOR } from '@/lib/amountLimits';
import { useOnKeyboardHide } from '@/lib/useOnKeyboardHide';
import { DraftPart } from '@/features/add/splitDraft';
import type { useAddEntryEnvironment } from '@/features/add/hooks/useAddEntryEnvironment';

type Input = {
  environment: ReturnType<typeof useAddEntryEnvironment>;
};

function clearPendingBack(timerRef: RefObject<ReturnType<typeof setTimeout> | null>): void {
  const timer = timerRef.current;
  if (timer !== null) {
    clearTimeout(timer);
    timerRef.current = null;
  }
}
export function useAddEntryState(input: Input) {
  const { params, editingId } = input.environment;

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
  const seededRef = useRef(false);

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
  const committedRef = useRef(false);

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
  const addDefaultsRef = useRef<AddDefaults>({});

  // Once you pick an account yourself, picking a category stops choosing one for you.
  const accountPickedByHandRef = useRef(false);

  // The account(s) of the entry being edited, kept on offer even if archived (see load).
  const editingAccountIdsRef = useRef<string[]>([]);

  const listFade = useFadeIn();

  // The pending "done → back"; cleared on unmount so a swipe-back in that window can't pop a second screen.
  const backTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mountedRef = useRef(true);

  const loadRequestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearPendingBack(backTimerRef);
    };
  }, []);

  // The synchronous lock covers queued taps before React publishes the busy state.
  const saveInFlightRef = useRef(false);
  return {
    accounts,
    setAccounts,
    categories,
    setCategories,
    people,
    setPeople,
    editing,
    setEditing,
    editBaseline,
    setEditBaseline,
    isLinked,
    setIsLinked,
    seededRef,
    formReady,
    setFormReady,
    type,
    setType,
    expr,
    setExpr,
    accountId,
    setAccountId,
    toAccountId,
    setToAccountId,
    categoryId,
    setCategoryId,
    note,
    setNote,
    paymentMode,
    setPaymentMode,
    date,
    setDate,
    personId,
    setPersonId,
    friendSign,
    setFriendSign,
    friendAccountId,
    setFriendAccountId,
    rows,
    setRows,
    refund,
    setRefund,
    splitParts,
    setSplitParts,
    saving,
    setSaving,
    addingRow,
    setAddingRow,
    saveDone,
    setSaveDone,
    committedRef,
    error,
    setError,
    searchFocused,
    setSearchFocused,
    footerHeight,
    setFooterHeight,
    padOpen,
    setPadOpen,
    noteEditing,
    setNoteEditing,
    calendarOpen,
    setCalendarOpen,
    accountSheetOpen,
    setAccountSheetOpen,
    addAccountVisible,
    setAddAccountVisible,
    addPersonVisible,
    setAddPersonVisible,
    repeatSheetVisible,
    setRepeatSheetVisible,
    repeatWarning,
    setRepeatWarning,
    addDefaultsRef,
    accountPickedByHandRef,
    editingAccountIdsRef,
    listFade,
    backTimerRef,
    mountedRef,
    loadRequestRef,
    saveInFlightRef,
  };
}
