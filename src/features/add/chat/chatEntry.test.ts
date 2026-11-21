import type { Account, Category } from '@/types';
import {
  applyAnswer,
  blankEntry,
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
  usableCategories,
  type ChatEntry,
  type ChatLookups,
  type Field,
} from './chatEntry';
import { formToStaged } from '@/features/add/addEntry';

const account = (id: string, name: string, extra: Partial<Account> = {}) =>
  ({ id, name, type: 'bank', currency: 'INR', archived: false, ...extra }) as unknown as Account;
const category = (
  id: string,
  name: string,
  kind: 'expense' | 'income',
  extra: Partial<Category> = {}
): Category =>
  ({
    id,
    name,
    kind,
    parentId: null,
    icon: 'tag',
    color: '#000',
    archived: false,
    sortOrder: 0,
    isSystem: false,
    ...extra,
  }) as unknown as Category;

const lookups = (over: Partial<ChatLookups> = {}): ChatLookups => ({
  today: '2026-11-22',
  accounts: [account('sbi', 'SBI'), account('cash', 'Cash'), account('old', 'Old card', { archived: true })],
  categories: [
    category('food', 'Food & Dining', 'expense', { sortOrder: 1 }),
    category('rent', 'Rent', 'expense', { sortOrder: 2 }),
    category('salary', 'Salary', 'income'),
    category('loan', 'Loan EMI', 'expense', { isSystem: true }),
    category('old-cat', 'Old', 'expense', { archived: true }),
  ],
  people: [{ id: 'ravi', name: 'Ravi' }],
  defaults: {},
  ...over,
});
const lk = (l: ChatLookups) => ({ accounts: l.accounts, categories: l.categories, people: l.people });
/** An entry with some fields given, on top of a blank one. */
const entry = (type: ChatEntry['type'], patch: Partial<ChatEntry> = {}, l = lookups()): ChatEntry => ({
  ...blankEntry(type, l),
  ...patch,
});

describe('what can be picked', () => {
  it('leaves out archived accounts, and archived or built-in system categories', () => {
    const l = lookups();
    expect(usableAccounts(l).map((a) => a.id)).toEqual(['sbi', 'cash']);
    expect(usableCategories(l, 'expense').map((c) => c.id)).toEqual(['food', 'rent']);
    expect(usableCategories(l, 'income').map((c) => c.id)).toEqual(['salary']);
  });
});

describe('the form order', () => {
  it("lists each type's fields as the form does", () => {
    expect(fieldsOf('expense')).toEqual(['amount', 'category', 'account', 'date', 'note']);
    expect(fieldsOf('income')).toEqual(['amount', 'category', 'account', 'date', 'note']);
    expect(fieldsOf('transfer')).toEqual(['amount', 'account', 'toAccount', 'date', 'note']);
    expect(fieldsOf('friend')).toEqual(['amount', 'person', 'direction', 'account', 'date', 'note']);
  });
  it('labels the account as the form does for each type', () => {
    expect(fieldLabel('expense', 'account')).toBe('Pay from');
    expect(fieldLabel('income', 'account')).toBe('Received in');
    expect(fieldLabel('transfer', 'account')).toBe('From');
  });
});

describe('blankEntry: the form’s starting points', () => {
  it('has today’s date and nothing else, with no starting points saved', () => {
    expect(blankEntry('expense', lookups())).toMatchObject({
      type: 'expense',
      amountMinor: null,
      date: '2026-11-22',
      accountId: null,
      categoryId: null,
      note: '',
    });
  });
  it('starts from the account and category last used for the type', () => {
    const l = lookups({ defaults: { expense: { accountId: 'cash', categoryId: 'rent' } } });
    expect(blankEntry('expense', l)).toMatchObject({ accountId: 'cash', categoryId: 'rent' });
    expect(blankEntry('income', l)).toMatchObject({ accountId: null, categoryId: null });
  });
  it('starts a transfer from the accounts last used', () => {
    const l = lookups({ defaults: { transfer: { accountId: 'sbi', toAccountId: 'cash' } } });
    expect(blankEntry('transfer', l)).toMatchObject({ accountId: 'sbi', toAccountId: 'cash' });
  });
  it('ignores a remembered account that is archived or gone, and a category of the wrong kind or archived', () => {
    const l = lookups({
      defaults: {
        expense: { accountId: 'old', categoryId: 'salary' },
        income: { accountId: 'sbi', categoryId: 'old-cat' },
      },
    });
    expect(blankEntry('expense', l)).toMatchObject({ accountId: null, categoryId: null });
    expect(blankEntry('income', l)).toMatchObject({ accountId: 'sbi', categoryId: null });
  });
  it('takes the only account there is', () => {
    const l = lookups({ accounts: [account('sbi', 'SBI')] });
    expect(blankEntry('expense', l).accountId).toBe('sbi');
  });
  it('never fills in an account for a friend entry', () => {
    const l = lookups({
      accounts: [account('sbi', 'SBI')],
      defaults: { expense: { accountId: 'sbi', categoryId: null } },
    });
    expect(blankEntry('friend', l).accountId).toBeNull();
  });
});

describe('neededFields and nextField', () => {
  it('needs what the form needs before it saves', () => {
    expect(neededFields(entry('expense'))).toEqual(['amount', 'category', 'account']);
    expect(
      neededFields(entry('expense', { amountMinor: 100, categoryId: 'food', accountId: 'sbi' }))
    ).toEqual([]);
    expect(neededFields(entry('transfer', { amountMinor: 100 }))).toEqual(['account', 'toAccount']);
    // A transfer to the same account is as incomplete as in the form.
    expect(
      neededFields(entry('transfer', { amountMinor: 100, accountId: 'sbi', toAccountId: 'sbi' }))
    ).toEqual(['toAccount']);
    expect(neededFields(entry('friend'))).toEqual(['amount', 'person']);
    expect(neededFields(entry('friend', { amountMinor: 100, personId: 'ravi' }))).toEqual([]);
  });

  /** Walks the conversation as the chat does: asks, answers with a value, remembers what was asked. */
  const walk = (start: ChatEntry, answers: Partial<Record<Field, string | number>>) => {
    const asked = new Set<Field>();
    const order: Field[] = [];
    let e = start;
    for (let i = 0; i < 12; i++) {
      const f = nextField(e, asked);
      if (!f) break;
      order.push(f);
      asked.add(f);
      e = applyAnswer(e, f, answers[f] ?? '');
    }
    return { order, e };
  };

  it('asks an expense in the chat order: what it is for, then how much, then the account, the day and the note', () => {
    const { order } = walk(entry('expense'), {
      amount: 100,
      category: 'food',
      account: 'sbi',
      date: '2026-11-22',
    });
    expect(order).toEqual(['category', 'amount', 'account', 'date', 'note']);
  });
  it('does not ask for an account that has a starting point, but still shows the category', () => {
    const l = lookups({ defaults: { expense: { accountId: 'cash', categoryId: 'rent' } } });
    const { order } = walk(blankEntry('expense', l), { amount: 100, date: '2026-11-22' });
    expect(order).toEqual(['category', 'amount', 'date', 'note']);
  });
  it('asks a transfer for both accounts, a friend entry for the person and the way the money went', () => {
    expect(
      walk(entry('transfer'), { amount: 5, account: 'sbi', toAccount: 'cash', date: 'x' }).order
    ).toEqual(['account', 'toAccount', 'amount', 'date', 'note']);
    expect(walk(entry('friend'), { amount: 5, person: 'ravi', direction: 1, date: 'x' }).order).toEqual([
      'person',
      'direction',
      'amount',
      'date',
      'note',
    ]);
  });
  it('has nothing more to ask once each was asked and nothing is missing: the summary is next', () => {
    const full = entry('expense', { amountMinor: 100, categoryId: 'food', accountId: 'sbi' });
    expect(nextField(full, new Set<Field>(['category', 'date', 'note']))).toBeNull();
  });
  it('comes back for a field that has become needed again after a change', () => {
    const asked = new Set<Field>(['category', 'date', 'note']);
    const e = entry('expense', { amountMinor: 100, categoryId: 'food', accountId: null });
    expect(nextField(e, asked)).toBe('account');
  });
});

describe('answers', () => {
  it('fill the field they answer and leave the rest', () => {
    let e = entry('expense');
    e = applyAnswer(e, 'amount', 20000);
    e = applyAnswer(e, 'category', 'food');
    e = applyAnswer(e, 'account', 'sbi');
    expect(e).toMatchObject({ amountMinor: 20000, categoryId: 'food', accountId: 'sbi' });
    expect(neededFields(e)).toEqual([]);
  });
  it('change the day, the note and the direction', () => {
    let e = entry('friend');
    e = applyAnswer(e, 'date', '2026-11-20');
    e = applyAnswer(e, 'note', '  with Ravi ');
    e = applyAnswer(e, 'direction', -1);
    expect(e).toMatchObject({ date: '2026-11-20', note: 'with Ravi', friendSign: -1 });
    expect(applyAnswer(e, 'direction', 1).friendSign).toBe(1);
  });
  it('can set an account to none (a friend entry not tied to one)', () => {
    const e = applyAnswer(entry('friend', { accountId: 'sbi' }), 'account', '');
    expect(e.accountId).toBeNull();
  });
});

describe('switchType, as the form tabs do', () => {
  const l = lookups({ defaults: { income: { accountId: 'cash', categoryId: 'salary' } } });
  const spent = entry(
    'expense',
    { amountMinor: 85000, categoryId: 'food', accountId: 'sbi', date: '2026-11-21', note: 'dinner' },
    l
  );
  it('keeps the amount, date, note and account, and drops what belongs to the old type', () => {
    const income = switchType(spent, 'income', l);
    expect(income).toMatchObject({
      type: 'income',
      amountMinor: 85000,
      date: '2026-11-21',
      accountId: 'sbi',
      note: 'dinner',
    });
    // Food is an expense category: it does not carry over, and the income starting point fills in.
    expect(income.categoryId).toBe('salary');
  });
  it('turns into a transfer that still needs its other account', () => {
    const t = switchType(spent, 'transfer', l);
    expect(t).toMatchObject({ type: 'transfer', accountId: 'sbi', categoryId: null, toAccountId: null });
    expect(neededFields(t)).toEqual(['toAccount']);
  });
  it('turns into a friend entry that needs a person, and back to an expense', () => {
    const f = switchType(spent, 'friend', l);
    expect(f).toMatchObject({ type: 'friend', friendSign: 1, personId: null });
    expect(neededFields(f)).toEqual(['person']);
    expect(switchType(f, 'expense', l)).toMatchObject({ type: 'expense', personId: null });
  });
  it('does nothing when the type is the same', () => {
    expect(switchType(spent, 'expense', l)).toBe(spent);
  });
});

describe('the form’s own check and save', () => {
  const l = lookups();
  it('what the chat holds is accepted by formToStaged as the form would', () => {
    const e = entry(
      'expense',
      { amountMinor: 85000, categoryId: 'food', accountId: 'sbi', date: '2026-11-21' },
      l
    );
    expect(formToStaged(toForm(e), lk(l))).toMatchObject({
      row: {
        kind: 'transaction',
        type: 'expense',
        amountMinor: 85000,
        accountId: 'sbi',
        categoryId: 'food',
        date: '2026-11-21',
      },
    });
  });
  it('is refused by the same check when something is missing', () => {
    expect(formToStaged(toForm(entry('expense')), lk(l))).toEqual({ error: 'Enter a valid amount' });
    expect(formToStaged(toForm(entry('expense', { amountMinor: 5, accountId: 'sbi' })), lk(l))).toEqual({
      error: 'Pick a category',
    });
  });
  it('makes a friend entry with the person, the way the money went and the account', () => {
    const e = entry('friend', { amountMinor: 50000, personId: 'ravi', friendSign: -1, accountId: 'cash' }, l);
    expect(formToStaged(toForm(e), lk(l))).toMatchObject({
      row: { kind: 'friend', personId: 'ravi', sign: -1, accountId: 'cash', amountMinor: 50000 },
    });
  });
  it('makes a transfer between two accounts', () => {
    const e = entry('transfer', { amountMinor: 500000, accountId: 'sbi', toAccountId: 'cash' }, l);
    expect(formToStaged(toForm(e), lk(l))).toMatchObject({
      row: { type: 'transfer', accountId: 'sbi', toAccountId: 'cash' },
    });
  });
});

describe('how an entry reads', () => {
  const l = lookups();
  const e = entry(
    'expense',
    { amountMinor: 85000, categoryId: 'food', accountId: 'sbi', date: '2026-11-21' },
    l
  );
  it('shows an expense, an income, a transfer, and money given and got', () => {
    expect(previewEntry(e, l)).toMatchObject({
      kind: 'Expense',
      amount: '−₹850',
      title: 'Food & Dining',
      when: 'Yesterday',
    });
    expect(previewEntry({ ...e, type: 'income' }, l)).toMatchObject({ kind: 'Income', amount: '+₹850' });
    expect(previewEntry({ ...e, type: 'transfer' }, l)).toMatchObject({
      kind: 'Transfer',
      amount: '₹850',
      title: 'Transfer',
    });
    const friend = entry('friend', { amountMinor: 50000, personId: 'ravi' }, l);
    expect(previewEntry(friend, l)).toMatchObject({ kind: 'Gave to', amount: '−₹500', title: 'Ravi' });
    expect(previewEntry({ ...friend, friendSign: -1 }, l)).toMatchObject({
      kind: 'Got from',
      amount: '+₹500',
    });
  });
  it('shows each field as the form reads it, and "Choose" for one still to fill', () => {
    expect(fieldValue(e, 'category', l)).toBe('Food & Dining');
    expect(fieldValue(e, 'account', l)).toBe('SBI');
    expect(fieldValue(e, 'date', l)).toBe('Yesterday');
    expect(fieldValue(e, 'note', l)).toBe('Add a note');
    expect(fieldValue(entry('expense'), 'category', l)).toBe('Choose');
    expect(fieldValue(entry('friend'), 'account', l)).toBe('Not tied to an account');
  });
  it('asks in words that fit the type', () => {
    expect(promptFor('expense', 'category')).toBe('Which category?');
    expect(promptFor('income', 'category')).toBe('What kind of income is it?');
    expect(promptFor('transfer', 'account')).toBe('Move it from which account?');
    expect(promptFor('transfer', 'toAccount')).toBe('Move it to which account?');
  });
});
