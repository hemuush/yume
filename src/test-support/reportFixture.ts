import type { Account, Category, Loan, Transaction } from '@/types';
import type { PersonWithBalance } from '@/db/people';
import type { ReportInput } from '@/lib/report/reportData';

/** A deterministic, believable ledger for report tests and layout previews (not shipped in the app). */
export function sampleLedger(entryCount = 170): Omit<ReportInput, 'period' | 'today'> {
  const accounts = [
    ['a1', 'HDFC Savings', 'bank', 84210_00],
    ['a2', 'Cash', 'cash', 3450_00],
    ['a3', 'Axis Card', 'credit_card', -12900_00],
    ['a4', 'Emergency fund', 'savings', 150000_00],
  ].map(
    ([id, name, type, bal]) =>
      ({
        id,
        name,
        type,
        currency: 'INR',
        openingBalanceMinor: 0,
        currentBalanceMinor: bal,
        creditLimitMinor: null,
        statementDay: null,
        dueDay: null,
        interestRateAnnualBp: null,
        archived: false,
        createdAt: '2025-01-01',
      }) as Account
  );
  const cat = (id: string, name: string, color: string, parentId: string | null = null, kind = 'expense') =>
    ({
      id,
      name,
      kind,
      parentId,
      icon: 'x',
      color,
      archived: false,
      sortOrder: 0,
      isSensitive: false,
      isSystem: false,
    }) as Category;
  const categories = [
    cat('food', 'Food & Dining', '#F97316'),
    cat('eat', 'Eating out', '#F97316', 'food'),
    cat('groc', 'Groceries', '#F97316', 'food'),
    cat('bills', 'Rent & Bills', '#5BA8E8'),
    cat('elec', 'Electricity', '#5BA8E8', 'bills'),
    cat('travel', 'Travel', '#3FBF8F'),
    cat('shop', 'Shopping', '#C77BC0'),
    cat('health', 'Health', '#E6C34A'),
    cat('fun', 'Fun', '#F0876A'),
    cat('salary', 'Salary', '#3FBF8F', null, 'income'),
    cat('side', 'Side income', '#8FCBFF', null, 'income'),
  ];
  const notes: Record<string, string[]> = {
    eat: ['Zomato', 'Lunch with Riya', 'Chai', 'Swiggy', 'Dinner out'],
    groc: ['Big Basket', 'Vegetables', 'Milk'],
    elec: ['Electricity'],
    bills: ['Rent', 'Wi-Fi'],
    travel: ['Cab to station', 'Metro top-up', 'Fuel'],
    shop: ['Headphones', 'T-shirt'],
    health: ['Pharmacy'],
    fun: ['Movie', 'Game'],
  };
  const spendCats = Object.keys(notes);
  const txs: Transaction[] = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < entryCount; i++) {
    const day = 1 + Math.floor(rnd() * 30);
    const month = rnd() < 0.82 ? '09' : '08';
    const c = spendCats[Math.floor(rnd() * spendCats.length)];
    const pool = notes[c];
    txs.push({
      id: `t${i}`,
      type: 'expense',
      accountId: ['a1', 'a2', 'a3'][Math.floor(rnd() * 3)],
      toAccountId: null,
      categoryId: c,
      amountMinor: Math.round((30 + rnd() * rnd() * 1800) * 100),
      date: `2026-${month}-${String(day).padStart(2, '0')}`,
      note: rnd() < 0.8 ? pool[Math.floor(rnd() * pool.length)] : '',
      paymentMode: null,
      loanPaymentId: null,
      splitId: null,
      isRefund: false,
      createdAt: '2026-09-01',
    });
  }
  const mk = (o: Partial<Transaction>): Transaction => ({ ...txs[0], ...o, id: `x${txs.length}` });
  txs.push(
    mk({
      type: 'income',
      categoryId: 'salary',
      accountId: 'a1',
      amountMinor: 72000_00,
      date: '2026-09-29',
      note: 'Salary',
    })
  );
  txs.push(
    mk({
      type: 'income',
      categoryId: 'side',
      accountId: 'a1',
      amountMinor: 4500_00,
      date: '2026-09-12',
      note: 'Freelance',
    })
  );
  txs.push(
    mk({
      type: 'income',
      categoryId: 'salary',
      accountId: 'a1',
      amountMinor: 70000_00,
      date: '2026-08-29',
      note: 'Salary',
    })
  );
  txs.push(
    mk({
      type: 'transfer',
      categoryId: null,
      accountId: 'a1',
      toAccountId: 'a2',
      amountMinor: 2000_00,
      date: '2026-09-28',
      note: 'To cash',
    })
  );
  txs.push(
    mk({
      type: 'income',
      categoryId: 'shop',
      accountId: 'a3',
      amountMinor: 900_00,
      date: '2026-09-15',
      note: 'Returned shirt',
      isRefund: true,
    })
  );
  const loans = [
    {
      id: 'l1',
      direction: 'borrowed',
      counterparty: 'HDFC Home Loan',
      principalMinor: 4000000_00,
      outstandingPrincipalMinor: 3520000_00,
      emiAmountMinor: 34500_00,
      interestRateAnnualBp: 850,
      status: 'active',
    },
    {
      id: 'l2',
      direction: 'lent',
      counterparty: 'Rohan',
      principalMinor: 20000_00,
      outstandingPrincipalMinor: 12000_00,
      emiAmountMinor: 0,
      interestRateAnnualBp: 0,
      status: 'active',
    },
  ] as unknown as Loan[];
  const people = [
    { id: 'p1', name: 'Riya', balanceMinor: 640_00, lastActivityDate: '2026-09-30' },
    { id: 'p2', name: 'Dad', balanceMinor: -1500_00, lastActivityDate: '2026-09-02' },
  ] as unknown as PersonWithBalance[];
  return { currency: 'INR', accounts, categories, transactions: txs, loans, people };
}
