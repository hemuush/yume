import type { AddDefaults } from '@/db/settings';
import type { AddForm } from '@/features/add/addEntry';
import { categoryPath, parentNameOf } from '@/lib/categoryLabel';
import { addDaysToIsoDate } from '@/lib/date';
import { weekdayDayMonthMaybeYear } from '@/lib/dateLabels';
import { formatMoneyExact } from '@/lib/money';
import type { Account, Category } from '@/types';

/**
 * The entry the chat builds, one answer at a time, and what it takes from the Add form: the same fields in the same
 * order (type, amount, category or person, account, date, note), the same starting points (the account and category
 * last used for that type), the same checks (`formToStaged`) and the same save. Pure: nothing is read or written here.
 */
export type EntryKind = 'expense' | 'income' | 'transfer' | 'friend';

export interface ChatEntry {
  type: EntryKind;
  amountMinor: number | null;
  /** YYYY-MM-DD. */
  date: string;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  note: string;
  personId: string | null;
  /** Friend entries: 1 = you gave them money, -1 = you got money from them. */
  friendSign: 1 | -1;
  /** Money back for a purchase. */
  refund: boolean;
}

export interface ChatLookups {
  accounts: Account[];
  categories: Category[];
  people: { id: string; name: string }[];
  /** The account (and category) last saved per type: the form's own starting point. */
  defaults: AddDefaults;
  /** YYYY-MM-DD, local. */
  today: string;
}

/** Accounts that can be picked: not archived. */
export const usableAccounts = (l: ChatLookups): Account[] => l.accounts.filter((a) => !a.archived);
/** Categories of one kind that can be picked: not archived, and not the built-in system ones. */
export const usableCategories = (l: ChatLookups, kind: 'income' | 'expense'): Category[] =>
  l.categories.filter((c) => !c.archived && !c.isSystem && c.kind === kind);

/** Every field the chat can ask about or change. */
export type Field =
  'amount' | 'category' | 'account' | 'toAccount' | 'person' | 'direction' | 'date' | 'note';

/** The fields of each type, in the order the form lists them (type and amount first). */
const FORM_ORDER: Record<EntryKind, Field[]> = {
  expense: ['amount', 'category', 'account', 'date', 'note'],
  income: ['amount', 'category', 'account', 'date', 'note'],
  transfer: ['amount', 'account', 'toAccount', 'date', 'note'],
  friend: ['amount', 'person', 'direction', 'account', 'date', 'note'],
};
export const fieldsOf = (type: EntryKind): Field[] => FORM_ORDER[type];

/**
 * The order the chat asks in. What it is for comes before how much, so the amount can offer the usual amounts for
 * that category; the summary still lists the fields as the form does.
 */
const STEP_ORDER: Record<EntryKind, Field[]> = {
  expense: ['category', 'amount', 'account', 'date', 'note'],
  income: ['category', 'amount', 'account', 'date', 'note'],
  transfer: ['account', 'toAccount', 'amount', 'date', 'note'],
  friend: ['person', 'direction', 'amount', 'account', 'date', 'note'],
};

/**
 * Fields asked once even when they already have a value: a category is shown for the person to see and choose (the one
 * last used is only highlighted), and the day and note are one tap each. An account that has a starting point is not
 * asked: it shows on the summary, where it can be changed.
 */
const ASK_ONCE: Field[] = ['category', 'person', 'direction', 'date', 'note'];

/** What a save would still need: derived from the entry itself, so it stays right after a field is changed. */
export function neededFields(e: ChatEntry): Field[] {
  const need: Field[] = [];
  if (e.amountMinor === null) need.push('amount');
  if (e.type === 'friend') {
    if (e.personId === null) need.push('person');
    return need;
  }
  if (e.type === 'transfer') {
    if (e.accountId === null) need.push('account');
    if (e.toAccountId === null || e.toAccountId === e.accountId) need.push('toAccount');
    return need;
  }
  if (e.categoryId === null) need.push('category');
  if (e.accountId === null) need.push('account');
  return need;
}

/** The next field to ask about, in the form's order, or null when the summary is next. */
export function nextField(e: ChatEntry, asked: ReadonlySet<Field>): Field | null {
  const need = neededFields(e);
  return STEP_ORDER[e.type].find((f) => need.includes(f) || (ASK_ONCE.includes(f) && !asked.has(f))) ?? null;
}

/**
 * Fills what is not known yet with the form's own starting point: the account and category last used for this type
 * (or the only account there is). The chat shows them and any can be changed, as in the form.
 */
function fillDefaults(e: ChatEntry, l: ChatLookups): ChatEntry {
  const active = usableAccounts(l);
  const validAccount = (id: string | null | undefined) => (id && active.some((a) => a.id === id) ? id : null);
  let next = e;
  if (e.type !== 'friend' && e.accountId === null) {
    const remembered = validAccount(l.defaults[e.type]?.accountId);
    const only = active.length === 1 ? active[0].id : null;
    const pick = remembered ?? only;
    if (pick) next = { ...next, accountId: pick };
  }
  if (e.type === 'transfer' && e.toAccountId === null) {
    const to = validAccount(l.defaults.transfer?.toAccountId);
    if (to && to !== next.accountId) next = { ...next, toAccountId: to };
  }
  if ((e.type === 'expense' || e.type === 'income') && e.categoryId === null) {
    const id = l.defaults[e.type]?.categoryId;
    if (id && usableCategories(l, e.type).some((c) => c.id === id)) next = { ...next, categoryId: id };
  }
  return next;
}

/** An empty entry of a type, with the form's starting points filled in. */
export function blankEntry(type: EntryKind, l: ChatLookups): ChatEntry {
  return fillDefaults(
    {
      type,
      amountMinor: null,
      date: l.today,
      accountId: null,
      toAccountId: null,
      categoryId: null,
      note: '',
      personId: null,
      friendSign: 1,
      refund: false,
    },
    l
  );
}

/** Records an answer. `value` is a minor-unit amount, an id, an ISO date, a note, or 1 / -1 for the direction. */
export function applyAnswer(e: ChatEntry, field: Field, value: string | number): ChatEntry {
  switch (field) {
    case 'amount':
      return { ...e, amountMinor: Number(value) };
    case 'account':
      return { ...e, accountId: value === '' ? null : String(value) };
    case 'toAccount':
      return { ...e, toAccountId: String(value) };
    case 'category':
      return { ...e, categoryId: String(value) };
    case 'person':
      return { ...e, personId: String(value) };
    case 'direction':
      return { ...e, friendSign: Number(value) === -1 ? -1 : 1 };
    case 'date':
      return { ...e, date: String(value) };
    case 'note':
      return { ...e, note: String(value).trim() };
  }
}

/**
 * Switches the entry's type, as the form's tabs do: what only belongs to the old type is dropped, the rest (amount,
 * date, note, account) stays, and the new type's starting points fill in.
 */
export function switchType(e: ChatEntry, type: EntryKind, l: ChatLookups): ChatEntry {
  if (type === e.type) return e;
  const kind = type === 'income' ? 'income' : 'expense';
  const keepCategory =
    (type === 'expense' || type === 'income') &&
    e.categoryId !== null &&
    l.categories.some((c) => c.id === e.categoryId && c.kind === kind);
  return fillDefaults(
    {
      ...e,
      type,
      categoryId: keepCategory ? e.categoryId : null,
      toAccountId: type === 'transfer' ? e.toAccountId : null,
      personId: type === 'friend' ? e.personId : null,
      refund: type === 'expense' ? e.refund : false,
    },
    l
  );
}

/** The form's own entry, so the save goes through `formToStaged` and `persistStaged` exactly as the form's does. */
export function toForm(e: ChatEntry): AddForm {
  return {
    type: e.type,
    amountMinor: e.amountMinor ?? 0,
    date: e.date,
    note: e.note,
    accountId: e.type === 'friend' ? null : e.accountId,
    toAccountId: e.toAccountId,
    categoryId: e.categoryId,
    personId: e.personId,
    friendSign: e.friendSign,
    friendAccountId: e.type === 'friend' ? e.accountId : null,
    refund: e.refund,
    paymentMode: null,
  };
}

export interface EntryPreview {
  /** "Expense", "Income", "Transfer", "Gave to", "Got from", "Refund". */
  kind: string;
  /** Signed as the entry reads: "−₹850", "+₹50,000", "₹5,000". */
  amount: string;
  /** What it is for: the category, "Transfer", or the person. */
  title: string;
  /** "Today", "Yesterday" or the date. */
  when: string;
}

export const dayLabel = (iso: string, today: string): string =>
  iso === today ? 'Today' : iso === addDaysToIsoDate(today, -1) ? 'Yesterday' : weekdayDayMonthMaybeYear(iso);

/** How an entry reads on its summary card. */
export function previewEntry(e: ChatEntry, l: ChatLookups): EntryPreview {
  const currency = l.accounts.find((a) => a.id === e.accountId)?.currency;
  const money = e.amountMinor === null ? '—' : formatMoneyExact(e.amountMinor, currency);
  const byId = new Map(l.categories.map((c) => [c.id, c]));
  const category = e.categoryId ? byId.get(e.categoryId) : undefined;
  let kind = 'Expense';
  let amount = `−${money}`;
  let title = category ? categoryPath(category.name, parentNameOf(category.id, byId)) : 'Pick a category';
  if (e.type === 'income') {
    kind = 'Income';
    amount = `+${money}`;
  } else if (e.refund) {
    kind = 'Refund';
    amount = `+${money}`;
  } else if (e.type === 'transfer') {
    kind = 'Transfer';
    amount = money;
    title = 'Transfer';
  } else if (e.type === 'friend') {
    kind = e.friendSign === -1 ? 'Got from' : 'Gave to';
    amount = e.friendSign === -1 ? `+${money}` : `−${money}`;
    title = l.people.find((p) => p.id === e.personId)?.name ?? 'Pick a person';
  }
  return { kind, amount, title, when: dayLabel(e.date, l.today) };
}

/** The row's label, as the form words it ("Pay from" on an expense, "Received in" on income). */
export function fieldLabel(type: EntryKind, field: Field): string {
  switch (field) {
    case 'amount':
      return 'Amount';
    case 'category':
      return 'Category';
    case 'account':
      return type === 'expense'
        ? 'Pay from'
        : type === 'income'
          ? 'Received in'
          : type === 'transfer'
            ? 'From'
            : 'Account';
    case 'toAccount':
      return 'To';
    case 'person':
      return 'With';
    case 'direction':
      return 'Money';
    case 'date':
      return 'Date';
    case 'note':
      return 'Note';
  }
}

/** The row's value, or a prompt to fill it ("Choose"), as the form's fields read. */
export function fieldValue(e: ChatEntry, field: Field, l: ChatLookups): string {
  const preview = previewEntry(e, l);
  const account = (id: string | null) => l.accounts.find((a) => a.id === id)?.name;
  switch (field) {
    case 'amount':
      return preview.amount;
    case 'category':
      return e.categoryId ? preview.title : 'Choose';
    case 'account':
      return account(e.accountId) ?? (e.type === 'friend' ? 'Not tied to an account' : 'Choose');
    case 'toAccount':
      return account(e.toAccountId) ?? 'Choose';
    case 'person':
      return e.personId ? preview.title : 'Choose';
    case 'direction':
      return e.friendSign === -1 ? 'I got money' : 'I gave money';
    case 'date':
      return preview.when;
    case 'note':
      return e.note || 'Add a note';
  }
}

/** What Suu says to ask for a field. */
export function promptFor(type: EntryKind, field: Field): string {
  switch (field) {
    case 'amount':
      return 'How much?';
    case 'category':
      return type === 'income' ? 'What kind of income is it?' : 'Which category?';
    case 'account':
      return type === 'income'
        ? 'Which account did it come into?'
        : type === 'transfer'
          ? 'Move it from which account?'
          : type === 'friend'
            ? 'Which account? (or none)'
            : 'Which account did you pay from?';
    case 'toAccount':
      return 'Move it to which account?';
    case 'person':
      return 'Who is it with?';
    case 'direction':
      return 'Which way did the money go?';
    case 'date':
      return 'When was it?';
    case 'note':
      return 'Add a note? You can skip this.';
  }
}
