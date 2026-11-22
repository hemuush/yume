import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { getAddDefaults, setAddDefaults, type AddDefaults } from '@/db/settings';
import {
  findRecentRepeat,
  getFrequentAmountsForCategory,
  getLastAccountForCategory,
  getRepeatEntries,
  listAccounts,
  listCategories,
  type RepeatEntry,
} from '@/db/ledger';
import { listPeople } from '@/db/people';
import { persistStaged } from '@/features/add/saveEntry';
import { formToStaged } from '@/features/add/addEntry';
import { getSplitParts, saveSplit } from '@/db/splits';
import {
  canAddPart,
  newPartKey,
  partAmounts,
  restMinor,
  seedParts,
  splitProblem,
  splitProblemText,
  toSplitParts,
  type DraftPart,
} from '@/features/add/splitDraft';
import { showAlert } from '@/components/AppDialog';
import { errorMessage } from '@/lib/errorMessage';
import { haptics } from '@/lib/haptics';
import { addDaysToIsoDate, daysUntilIsoDate, toLocalIsoDate } from '@/lib/date';
import { weekdayDayMonthMaybeYear } from '@/lib/dateLabels';
import { formatMaskableMoney, formatMoneyExact, toMinor } from '@/lib/money';
import { markJustAdded } from '@/lib/justAdded';
import { applyPadKey, evaluateAmount, exprFromMinor, type PadKey } from '@/lib/padMath';
import { usePrivacy } from '@/theme/PrivacyContext';
import type { Account, Category } from '@/types';
import {
  applyAnswer,
  blankEntry,
  dayLabel,
  fieldLabel,
  fieldsOf,
  fieldValue,
  neededFields,
  nextField,
  previewEntry,
  promptFor,
  switchType,
  toForm,
  usableAccounts,
  type ChatEntry,
  type ChatLookups,
  type EntryKind,
  type EntryPreview,
  type Field,
} from './chatEntry';

export interface ChatMessage {
  id: number;
  from: 'you' | 'suu';
  text: string;
}

/** Where the conversation is: choosing a type, picking a usual entry, answering one field, or the summary. */
export type Step = 'type' | 'usual' | Field | 'splitCategory' | 'splitAmount' | 'splitMore' | 'summary';

/** One line of the summary card: a field of the form, what it holds, and whether a save still needs it. */
export interface SummaryRow {
  field: Field;
  label: string;
  value: string;
  needed: boolean;
}

const TYPE_LABEL: Record<EntryKind, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
  friend: 'Friend',
};

/** A date further ahead than this many days is confirmed before saving, as in the form. */
const FUTURE_DATE_CHECK_DAYS = 7;

/** How many "Your usual" entries are offered, as in the form. */
const USUAL_COUNT = 4;

/**
 * The chat's state: it asks for one field at a time, and the person answers by tapping (the amount on the form's own
 * number pad, with this category's usual amounts above it). The form's shortcuts are here too: "Your usual" entries
 * in one tap, the account that goes with a category, Money back. Saving is the form's own: `formToStaged` checks it,
 * `persistStaged` writes it.
 */
export function useChatAdd() {
  const { hideAmounts } = usePrivacy();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [defaults, setDefaults] = useState<AddDefaults>({});
  const [ready, setReady] = useState(false);
  const [transcript, setTranscript] = useState<ChatMessage[]>([
    { id: 0, from: 'suu', text: 'What would you like to add?' },
  ]);
  const [entry, setEntry] = useState<ChatEntry | null>(null);
  const [step, setStep] = useState<Step>('type');
  const [saving, setSaving] = useState(false);
  const [usual, setUsual] = useState<RepeatEntry[]>([]);
  // What is typed on the number pad (a number or a sum), and this category's usual amounts above it.
  const [padExpr, setPadExpr] = useState('');
  const [amountChips, setAmountChips] = useState<number[]>([]);
  // A split between categories: the first part is the rest (what the others leave), as in the form.
  const [split, setSplit] = useState<DraftPart[] | null>(null);
  const [splitCategory, setSplitCategory] = useState<string | null>(null);
  // The fields already asked for this entry: a category, day or note is asked once, then lives on the summary.
  const asked = useRef<Set<Field>>(new Set());
  // Set while a type card is loading its usual entries, so a second tap does nothing.
  const starting = useRef(false);
  const nextId = useRef(1);
  const mounted = useRef(true);
  // Once the person picks an account themselves, the category stops choosing one for them.
  const accountPickedByHand = useRef(false);
  // The entry the person was told looks like a recent one: a second Save goes ahead.
  const repeatAcknowledged = useRef<string | null>(null);

  const say = useCallback((from: ChatMessage['from'], text: string) => {
    setTranscript((t) => [...t, { id: nextId.current++, from, text }]);
  }, []);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  /** Reads accounts, categories, people and the form's starting points (again after one is added). */
  const refreshLists = useCallback(() => {
    return Promise.all([listAccounts(), listCategories(), listPeople(), getAddDefaults()])
      .then(([a, c, p, d]) => {
        if (!mounted.current) return;
        setAccounts(a);
        setCategories(c);
        setPeople(p.map(({ id, name }) => ({ id, name })));
        setDefaults(d);
        setReady(true);
      })
      .catch((e) => {
        if (mounted.current) showAlert('Couldn’t load your accounts', errorMessage(e));
      });
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refreshLists();
    }, [refreshLists])
  );

  const lookups: ChatLookups = useMemo(
    () => ({ accounts, categories, people, defaults, today: toLocalIsoDate(new Date()) }),
    [accounts, categories, people, defaults]
  );

  // This category's usual amounts, for the amount step (an expense or income only, as in the form).
  const amountCurrency = accounts.find((a) => a.id === entry?.accountId)?.currency;
  const chipsFor =
    step === 'amount' && entry && (entry.type === 'expense' || entry.type === 'income')
      ? entry.categoryId
      : null;
  const chipsType = entry?.type;
  useEffect(() => {
    if (!chipsFor) {
      setAmountChips([]);
      return;
    }
    let live = true;
    getFrequentAmountsForCategory(chipsFor, 4, toLocalIsoDate(new Date()), hideAmounts, amountCurrency)
      .then((a) => live && setAmountChips(a))
      .catch(() => live && setAmountChips([]));
    return () => {
      live = false;
    };
  }, [chipsFor, chipsType, hideAmounts, amountCurrency]);

  /** Moves to what comes next for this entry, and has Suu ask for it. */
  const advance = useCallback(
    (e: ChatEntry) => {
      const field = nextField(e, asked.current);
      if (field) {
        setStep(field);
        if (field === 'amount') setPadExpr(e.amountMinor ? exprFromMinor(e.amountMinor) : '');
        say('suu', promptFor(e.type, field));
      } else {
        setStep('summary');
        say('suu', 'Here it is. Tap anything to change it, then save.');
      }
    },
    [say]
  );

  const start = useCallback(
    async (type: EntryKind) => {
      // A second tap on a type card while the first is still loading its usual entries does nothing.
      if (!ready || step !== 'type' || starting.current) return;
      starting.current = true;
      haptics.tap();
      const e = blankEntry(type, lookups);
      asked.current = new Set();
      accountPickedByHand.current = false;
      repeatAcknowledged.current = null;
      say('you', TYPE_LABEL[type]);
      setEntry(e);
      try {
        // "Your usual": entries of this type logged most lately, one tap each (an expense or income only).
        if (type === 'expense' || type === 'income') {
          const list = await getRepeatEntries(USUAL_COUNT, lookups.today, type).catch(
            () => [] as RepeatEntry[]
          );
          if (!mounted.current) return;
          if (list.length > 0) {
            setUsual(list);
            setStep('usual');
            say('suu', 'One of your usual, or something else?');
            return;
          }
        }
        advance(e);
      } finally {
        starting.current = false;
      }
    },
    [advance, lookups, ready, say, step]
  );

  /** One tap on a usual entry fills the category, amount and account (and its note): straight to the summary. */
  const pickUsual = useCallback(
    (u: RepeatEntry) => {
      if (!entry) return;
      haptics.tap();
      const accountOk = usableAccounts(lookups).some((a) => a.id === u.accountId);
      const next: ChatEntry = {
        ...entry,
        categoryId: u.categoryId,
        amountMinor: u.amountMinor,
        accountId: accountOk ? u.accountId : entry.accountId,
        note: u.note,
      };
      for (const f of ['category', 'amount', 'date', 'note'] as const) asked.current.add(f);
      accountPickedByHand.current = true;
      const shown = formatMaskableMoney(u.amountMinor, {
        currency: u.accountCurrency,
        masked: hideAmounts && !!u.isSensitive,
      });
      say('you', `${u.categoryName} · ${shown}`);
      setEntry(next);
      advance(next);
    },
    [advance, entry, hideAmounts, lookups, say]
  );

  const skipUsual = useCallback(() => {
    if (!entry) return;
    say('you', 'Something else');
    advance(entry);
  }, [advance, entry, say]);

  /** The currency of the account an entry is on, so its amounts carry the right symbol. */
  const currencyOf = useCallback(
    (e: ChatEntry) => accounts.find((a) => a.id === e.accountId)?.currency,
    [accounts]
  );

  /** The words that show an answer in the chat ("Food & Dining", "SBI", "Yesterday"). */
  const labelOf = useCallback(
    (e: ChatEntry, field: Field): string => {
      if (field === 'amount') return formatMoneyExact(e.amountMinor ?? 0, currencyOf(e));
      if (field === 'direction') return e.friendSign === -1 ? 'I got it' : 'I gave it';
      if (field === 'note') return e.note || 'No note';
      return fieldValue(e, field, lookups);
    },
    [currencyOf, lookups]
  );

  const answer = useCallback(
    (field: Field, value: string | number) => {
      if (!entry) return;
      haptics.tap();
      const next = applyAnswer(entry, field, value);
      asked.current.add(field);
      if (field === 'account') accountPickedByHand.current = true;
      // The first part of a split is the category picked here.
      if (field === 'category') {
        setSplit((parts) =>
          parts ? parts.map((x, i) => (i === 0 ? { ...x, categoryId: String(value) } : x)) : parts
        );
      }
      say('you', labelOf(next, field));
      setEntry(next);
      advance(next);
      // The account a category was last used with goes with it, until one is picked by hand (as in the form).
      if (field === 'category' && (entry.type === 'expense' || entry.type === 'income')) {
        const categoryId = String(value);
        getLastAccountForCategory(categoryId)
          .then((id) => {
            if (!mounted.current || accountPickedByHand.current || !id) return;
            if (!usableAccounts(lookups).some((a) => a.id === id && a.type !== 'savings')) return;
            setEntry((cur) => (cur && cur.categoryId === categoryId ? { ...cur, accountId: id } : cur));
          })
          .catch(() => {});
      }
    },
    [advance, entry, labelOf, lookups, say]
  );

  /** Opens one field again, from the summary. */
  const goTo = useCallback(
    (field: Field) => {
      if (!entry) return;
      haptics.tap();
      setStep(field);
      if (field === 'amount') setPadExpr(entry.amountMinor ? exprFromMinor(entry.amountMinor) : '');
      say('suu', promptFor(entry.type, field));
    },
    [entry, say]
  );

  /** Changes the type of the entry in hand, as the form's tabs do. What belongs only to the old type is asked again. */
  const changeType = useCallback(
    (type: EntryKind) => {
      if (!entry || type === entry.type) return;
      haptics.tap();
      const next = switchType(entry, type, lookups);
      for (const f of ['category', 'person', 'direction'] as const) asked.current.delete(f);
      say('you', TYPE_LABEL[type]);
      setEntry(next);
      // Only an expense is split.
      setSplit(null);
      advance(next);
    },
    [advance, entry, lookups, say]
  );

  /** A key of the number pad. */
  const padKey = useCallback((key: PadKey) => setPadExpr((expr) => applyPadKey(expr, key)), []);
  const clearPad = useCallback(() => setPadExpr(''), []);
  /** The amount on the pad, in minor units, or null while it is empty or not a positive amount. */
  const padMinor = useMemo(() => {
    const major = evaluateAmount(padExpr);
    if (major === null) return null;
    // Typed amounts keep their paise (toMinor), as in the form: 850.50 stays 850.50.
    const minor = toMinor(major);
    return Number.isFinite(minor) && minor > 0 ? minor : null;
  }, [padExpr]);
  const finishAmount = useCallback(() => {
    if (padMinor !== null) answer('amount', padMinor);
  }, [answer, padMinor]);

  /** A note typed, the one thing that is typed: the day and everything else are taps. */
  const submitNote = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (text && step === 'note') answer('note', text);
    },
    [answer, step]
  );

  /** "Today" or "No note": the one-tap answer for the day and the note. */
  const skip = useCallback(() => {
    if (step === 'date') answer('date', entry?.date ?? lookups.today);
    else if (step === 'note') answer('note', '');
  }, [answer, entry, lookups.today, step]);

  const nameOfCategory = useCallback(
    (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'this part',
    [categories]
  );

  /** Splits the payment between categories: the one already picked holds the rest, others are added with amounts. */
  const startSplit = useCallback(() => {
    if (!entry) return;
    if (entry.type !== 'expense' || entry.refund || entry.amountMinor === null) return;
    haptics.tap();
    setSplit(seedParts(entry.categoryId));
    setStep('splitCategory');
    say('suu', 'Which category is the next part for?');
  }, [entry, say]);

  const pickSplitCategory = useCallback(
    (id: string) => {
      haptics.tap();
      setSplitCategory(id);
      setStep('splitAmount');
      setPadExpr('');
      say('you', nameOfCategory(id));
      say('suu', `How much for ${nameOfCategory(id)}?`);
    },
    [nameOfCategory, say]
  );

  /** The amount on the pad becomes the next part, unless the parts would leave nothing for the first one. */
  const finishSplitAmount = useCallback(() => {
    if (!entry || entry.amountMinor === null || !split || !splitCategory || padMinor === null) return;
    const next = [...split, { key: newPartKey(), categoryId: splitCategory, amountText: padExpr }];
    const rest = restMinor(entry.amountMinor, next);
    if (rest <= 0) {
      const problem = splitProblem(entry.amountMinor, next);
      say(
        'suu',
        problem
          ? splitProblemText(
              problem,
              next,
              (key) => nameOfCategory(next.find((p) => p.key === key)?.categoryId ?? null),
              formatMoneyExact
            )
          : 'That leaves nothing for the first part.'
      );
      return;
    }
    haptics.tap();
    setSplit(next);
    setSplitCategory(null);
    setStep('splitMore');
    say('you', formatMoneyExact(padMinor));
    say(
      'suu',
      `${nameOfCategory(next[0].categoryId)} keeps ${formatMoneyExact(rest)}. ${canAddPart(next) ? 'Add another part?' : 'That is the most parts.'}`
    );
  }, [entry, nameOfCategory, padExpr, padMinor, say, split, splitCategory]);

  const addSplitPart = useCallback(() => {
    if (!split || !canAddPart(split)) return;
    haptics.tap();
    setStep('splitCategory');
    say('suu', 'Which category is the next part for?');
  }, [say, split]);

  const finishSplit = useCallback(() => {
    haptics.tap();
    setStep('summary');
    say('suu', 'Here it is. Tap anything to change it, then save.');
  }, [say]);

  const clearSplit = useCallback(() => {
    haptics.tap();
    setSplit(null);
  }, []);

  /** Money back: this expense is a refund, as the form's toggle. */
  const toggleRefund = useCallback(() => {
    haptics.tap();
    setEntry((e) => (e && e.type === 'expense' ? { ...e, refund: !e.refund } : e));
    // A refund is not split.
    setSplit(null);
  }, []);

  const reset = useCallback(
    (message?: string) => {
      setEntry(null);
      setStep('type');
      setUsual([]);
      setSplit(null);
      setSplitCategory(null);
      asked.current = new Set();
      accountPickedByHand.current = false;
      repeatAcknowledged.current = null;
      if (message) say('suu', message);
    },
    [say]
  );

  /** The same entry in the form, to change what the chat cannot (it opens filled in; this one leaves the chat). */
  const editInForm = useCallback(() => {
    if (!entry) return;
    const params: Record<string, string> = { type: entry.type };
    if (entry.amountMinor !== null) params.amount = String(entry.amountMinor);
    if (entry.accountId) params.accountId = entry.accountId;
    if (entry.toAccountId) params.toAccountId = entry.toAccountId;
    if (entry.categoryId) params.categoryId = entry.categoryId;
    if (entry.note) params.note = entry.note;
    if (entry.refund) params.refund = '1';
    reset();
    router.push({ pathname: '/add-transaction', params });
  }, [entry, reset]);

  const summary: {
    preview: EntryPreview;
    rows: SummaryRow[];
    complete: boolean;
    /** The parts of a split, the first holding the rest; null when it is not split. */
    parts: { label: string; value: string }[] | null;
  } | null = useMemo(() => {
    if (!entry) return null;
    const need = neededFields(entry);
    const amounts = split && entry.amountMinor !== null ? partAmounts(entry.amountMinor, split) : null;
    return {
      preview: previewEntry(entry, lookups),
      complete: need.length === 0,
      parts:
        split && amounts
          ? split.map((part, i) => ({
              label: categories.find((c) => c.id === part.categoryId)?.name ?? 'Choose a category',
              value: formatMoneyExact(amounts[i], currencyOf(entry)),
            }))
          : null,
      rows: fieldsOf(entry.type).map((field) => ({
        field,
        label: fieldLabel(entry.type, field),
        value: fieldValue(entry, field, lookups),
        needed: need.includes(field),
      })),
    };
  }, [categories, currencyOf, entry, lookups, split]);

  /** Saves a split: one entry per part on the same account and day, as the form's split does. */
  const saveSplitEntry = useCallback(async () => {
    if (!entry || !split || entry.amountMinor === null || !entry.accountId) return;
    const problem = splitProblem(entry.amountMinor, split);
    if (problem) {
      say(
        'suu',
        splitProblemText(
          problem,
          split,
          (key) => nameOfCategory(split.find((p) => p.key === key)?.categoryId ?? null),
          formatMoneyExact
        )
      );
      return;
    }
    setSaving(true);
    try {
      const splitId = await saveSplit({
        splitId: null,
        replacesEntryId: null,
        accountId: entry.accountId,
        date: entry.date,
        note: entry.note,
        parts: toSplitParts(entry.amountMinor, split),
        paymentMode: null,
      });
      try {
        markJustAdded((await getSplitParts(splitId)).map((p) => p.id));
      } catch {
        /* The split is saved; a highlight lookup failing must never invite a second save. */
      }
      haptics.confirm();
      if (mounted.current) {
        say('you', 'Save');
        reset(`Saved ✓ ${dayLabel(entry.date, lookups.today)}. Add another?`);
      }
    } catch (e) {
      if (mounted.current) say('suu', errorMessage(e));
    } finally {
      if (mounted.current) setSaving(false);
    }
  }, [entry, lookups.today, nameOfCategory, reset, say, split]);

  const saveOnce = useCallback(async () => {
    if (saving || !entry || !summary?.complete) return;
    if (split) {
      await saveSplitEntry();
      return;
    }
    const res = formToStaged(toForm(entry), { accounts, categories, people });
    if ('error' in res) {
      say('suu', res.error);
      return;
    }
    const row = res.row;
    // Looks like one saved a moment ago: say so once; a second Save goes ahead (as the form does).
    if (row.kind === 'transaction') {
      const key = `${row.type}|${row.accountId}|${row.categoryId}|${row.amountMinor}|${row.date}`;
      if (repeatAcknowledged.current !== key) {
        const hit = await findRecentRepeat(row).catch(() => null);
        if (hit) {
          repeatAcknowledged.current = key;
          haptics.warn();
          say(
            'suu',
            `You added ${formatMoneyExact(row.amountMinor, currencyOf(entry))} · ${row.label} a moment ago. Tap Save again to add it anyway.`
          );
          return;
        }
      }
    }
    setSaving(true);
    try {
      const id = await persistStaged(row, categories);
      markJustAdded(id ? [id] : []);
      haptics.confirm();
      if (row.kind === 'transaction') {
        const next: AddDefaults = { ...defaults };
        if (row.type === 'transfer')
          next.transfer = { accountId: row.accountId, toAccountId: row.toAccountId };
        else next[row.type] = { accountId: row.accountId, categoryId: row.categoryId };
        setDefaults(next);
        setAddDefaults(next).catch(() => {});
      }
      if (mounted.current) {
        say('you', 'Save');
        reset(`Saved ✓ ${dayLabel(entry.date, lookups.today)}. Add another?`);
      }
    } catch (e) {
      if (mounted.current) say('suu', errorMessage(e));
    } finally {
      if (mounted.current) setSaving(false);
    }
  }, [
    accounts,
    categories,
    currencyOf,
    defaults,
    entry,
    lookups.today,
    people,
    reset,
    saveSplitEntry,
    saving,
    say,
    split,
    summary,
  ]);

  // A synchronous lock: two quick taps both pass `saving` while the repeat check is awaited.
  const saveLock = useRef(false);
  const saveNow = useCallback(async () => {
    if (saveLock.current) return;
    saveLock.current = true;
    try {
      await saveOnce();
    } finally {
      saveLock.current = false;
    }
  }, [saveOnce]);

  /** Saves, but first asks about a date more than a week ahead: a wrong year is what that check is for (as in the form). */
  const save = useCallback(async () => {
    if (saving || !entry || !summary?.complete) return;
    if (entry.date > addDaysToIsoDate(lookups.today, FUTURE_DATE_CHECK_DAYS)) {
      const ahead = daysUntilIsoDate(entry.date);
      showAlert(
        `Save it for ${weekdayDayMonthMaybeYear(entry.date)}?`,
        `That’s ${ahead} ${ahead === 1 ? 'day' : 'days'} from today.`,
        [
          { text: 'Change date', style: 'cancel', onPress: () => goTo('date') },
          { text: 'Save', onPress: () => void saveNow() },
        ]
      );
      return;
    }
    await saveNow();
  }, [entry, goTo, lookups.today, saveNow, saving, summary]);

  return {
    ready,
    transcript,
    lookups,
    entry,
    step,
    summary,
    saving,
    usual,
    padExpr,
    padMinor,
    amountChips,
    split,
    canAddPart: split ? canAddPart(split) : false,
    startSplit,
    pickSplitCategory,
    finishSplitAmount,
    addSplitPart,
    finishSplit,
    clearSplit,
    start,
    pickUsual,
    skipUsual,
    answer,
    goTo,
    changeType,
    padKey,
    clearPad,
    finishAmount,
    submitNote,
    skip,
    toggleRefund,
    save,
    reset,
    editInForm,
    refreshLists,
  };
}
