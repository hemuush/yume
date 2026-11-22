import { savingAdvice, usualCash, type SavingAdviceInput } from './savingAdvice';

const money = (m: number) => `₹${Math.round(m / 100)}`;
const base: SavingAdviceInput = {
  incomeMinor: 100_000_00,
  spendMinor: 70_000_00,
  categories: [
    { name: 'Food & Dining', monthlyMinor: 20_000_00 },
    { name: 'Rent', monthlyMinor: 25_000_00 },
  ],
  openGoals: 1,
};
const keys = (i: SavingAdviceInput) => savingAdvice(i, money).map((a) => a.key);

describe('savingAdvice', () => {
  it('says nothing without data', () => {
    expect(savingAdvice({ ...base, incomeMinor: 0, spendMinor: 0 }, money)).toEqual([]);
  });

  it('warns when spending is above income, with the gap', () => {
    const [first] = savingAdvice({ ...base, spendMinor: 110_000_00 }, money);
    expect(first).toMatchObject({ key: 'rate', tone: 'bad' });
    expect(first.body).toContain('₹10000');
  });

  it('shows the rupee gap to a 20% rate and praises a higher one', () => {
    const good = savingAdvice(base, money)[0];
    expect(good).toMatchObject({ tone: 'good', title: 'You keep 30% of what you earn' });
    const tight = savingAdvice({ ...base, spendMinor: 90_000_00 }, money)[0];
    expect(tight.tone).toBe('warn');
    expect(tight.body).toContain('₹10000');
  });

  it('points at the biggest choice category and what a 15% trim frees', () => {
    const top = savingAdvice(base, money).find((a) => a.key === 'top');
    expect(top?.title).toBe('Food & Dining is your biggest choice');
    expect(top?.body).toContain('₹3000 a month, ₹36000 a year');
  });

  it('never suggests cutting rent or an EMI as the biggest choice', () => {
    const list = savingAdvice(
      { ...base, categories: [{ name: 'Loan EMI', monthlyMinor: 40_000_00 }] },
      money
    );
    expect(list.find((a) => a.key === 'top')).toBeUndefined();
  });

  it('flags a month that is mostly fixed and the yearly cost of subscriptions', () => {
    const list = savingAdvice(
      {
        ...base,
        categories: [
          { name: 'Rent', monthlyMinor: 40_000_00 },
          { name: 'Subscriptions', monthlyMinor: 1_000_00 },
          { name: 'Loan EMI', monthlyMinor: 15_000_00 },
        ],
      },
      money
    );
    expect(list.map((a) => a.key)).toEqual(expect.arrayContaining(['fixed', 'subs']));
    expect(list.find((a) => a.key === 'subs')?.title).toBe('Subscriptions: ₹12000 a year');
  });

  it('suggests a first goal only when none is open, and shows at most four', () => {
    expect(keys({ ...base, openGoals: 0 })).toContain('goal');
    expect(keys(base)).not.toContain('goal');
    const many = savingAdvice(
      {
        incomeMinor: 100_000_00,
        spendMinor: 95_000_00,
        openGoals: 0,
        categories: [
          { name: 'Food & Dining', monthlyMinor: 30_000_00 },
          { name: 'Rent', monthlyMinor: 55_000_00 },
          { name: 'Subscriptions', monthlyMinor: 2_000_00 },
        ],
      },
      money
    );
    expect(many).toHaveLength(4);
  });

  it('falls back to spending as the base when income is unknown', () => {
    const list = savingAdvice({ ...base, incomeMinor: 0 }, money);
    expect(list.find((a) => a.key === 'rate')).toBeUndefined();
    expect(list.find((a) => a.key === 'top')?.body).toContain('your spending');
  });
});

describe('usualCash', () => {
  const m = (income: number, expense: number, recorded = true) => ({
    incomeMinor: income,
    expenseMinor: expense,
    recorded,
  });
  it('averages the last three finished months and leaves out the running one', () => {
    expect(usualCash([m(1, 1), m(100, 60), m(200, 80), m(300, 100), m(9999, 9999)])).toEqual({
      incomeMinor: 200,
      spendMinor: 80,
    });
  });
  it('leaves out the first month of use, which is usually a part month', () => {
    expect(usualCash([m(0, 0, false), m(10, 5), m(100, 60), m(100, 80), m(100, 100), m(0, 0)])).toEqual({
      incomeMinor: 100,
      spendMinor: 80,
    });
  });
  it('keeps a single finished month when it is all there is', () => {
    expect(usualCash([m(0, 0, false), m(0, 0, false), m(0, 0, false), m(50, 20), m(7, 7)])).toEqual({
      incomeMinor: 50,
      spendMinor: 20,
    });
  });
  it('is zero with nothing recorded', () => {
    expect(usualCash([m(0, 0, false), m(0, 0, false)])).toEqual({ incomeMinor: 0, spendMinor: 0 });
  });
});
