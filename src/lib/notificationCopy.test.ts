/** The words of each notification: the fact and its number lead, and nothing tells you to tap or review. */
jest.mock('./money', () => ({
  formatMoney: (minor: number) => `₹${(minor / 100).toLocaleString('en-IN')}`,
}));

import {
  billCopy,
  budgetAlertCopy,
  emiCopy,
  emiOverdueCopy,
  logCopy,
  refundCopy,
  spikeCopy,
} from './notificationCopy';

const all = [
  emiCopy([{ counterparty: 'HDFC', emiMinor: 1245000 }]),
  emiCopy([
    { counterparty: 'HDFC', emiMinor: 1245000 },
    { counterparty: 'Ravi', emiMinor: 500000 },
  ]),
  emiOverdueCopy(
    [{ counterparty: 'HDFC', emiMinor: 1245000, dueDate: '2026-10-03', daysLate: 2 }],
    () => '3 Oct'
  ),
  billCopy('Netflix', '₹649'),
  refundCopy('Amazon', '₹1,200', false),
  budgetAlertCopy('over', 'Food', '₹6,200', '₹5,000', '₹0', '₹1,200'),
  budgetAlertCopy('near', 'Food', '₹4,200', '₹5,000', '₹800', '₹0', 13),
  spikeCopy('Dining', '+40%'),
  ...[0, 1, 2, 3, 4, 5, 6].map(logCopy),
];

it('never tells the reader to tap or review', () => {
  for (const text of all) expect(`${text.title} ${text.body}`).not.toMatch(/\b(tap|review)\b/i);
});

it('puts the who, how much and how late in the title', () => {
  expect(all[0].title).toBe('HDFC EMI ₹12,450 is due today');
  expect(all[1].title).toBe('2 EMIs due today: ₹17,450');
  expect(all[2].title).toBe('HDFC EMI is 2 days late');
  expect(all[2].body).toBe('₹12,450, was due 3 Oct. Marking it paid stops these reminders.');
  expect(
    emiOverdueCopy([{ counterparty: 'HDFC', emiMinor: 100, dueDate: '2026-10-03', daysLate: 1 }], () => 'x')
      .title
  ).toBe('HDFC EMI is 1 day late');
});

it('names the bill, its amount and the day, or leaves the amount out when it is not known', () => {
  expect(billCopy('Netflix', '₹649').title).toBe('Netflix ₹649 goes out tomorrow');
  expect(billCopy('Rent', null).title).toBe('Rent goes out tomorrow');
});

it('says how far over, or how much is left and for how long', () => {
  expect(all[5].title).toBe('Food is ₹1,200 over budget');
  expect(all[6].title).toBe('Food: ₹800 left in your budget');
  expect(all[6].body).toBe('₹4,200 of ₹5,000 used, with 13 days to go.');
  expect(budgetAlertCopy('near', 'Food', '₹1', '₹2', '₹1', '₹0', 1).body).toBe(
    '₹1 of ₹2 used, with 1 day to go.'
  );
  expect(budgetAlertCopy('near', 'Food', '₹1', '₹2', '₹1', '₹0').body).toBe('₹1 of ₹2 used.');
});

it('rotates the evening line through the week, never twice the same', () => {
  expect(new Set(all.slice(-7).map((t) => t.title)).size).toBe(7);
  expect(logCopy(7)).toEqual(logCopy(0));
});
