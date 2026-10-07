import type { Account } from '@/types';
import { STACK, stackHeight, stackOrder } from './stackLayout';

const acc = (id: string, type: Account['type']) => ({ id, type }) as Account;

describe('stackHeight', () => {
  it('is the front card alone for one account, then one strip more for each other', () => {
    expect(stackHeight(0)).toBe(STACK.cardHeight);
    expect(stackHeight(1)).toBe(104);
    expect(stackHeight(2)).toBe(156);
    expect(stackHeight(10)).toBe(572);
  });
});

describe('stackOrder', () => {
  it('runs savings, bank, credit card, wallet, cash from back to front', () => {
    const out = stackOrder([
      acc('cash', 'cash'),
      acc('wallet', 'wallet'),
      acc('card', 'credit_card'),
      acc('bank', 'bank'),
      acc('sav', 'savings'),
    ]);
    expect(out.map((a) => a.id)).toEqual(['sav', 'bank', 'card', 'wallet', 'cash']);
  });

  it('is stable within a kind and does not change the list it is given', () => {
    const input = [acc('b2', 'bank'), acc('b1', 'bank'), acc('s', 'savings')];
    const out = stackOrder(input);
    expect(out.map((a) => a.id)).toEqual(['s', 'b2', 'b1']);
    expect(input.map((a) => a.id)).toEqual(['b2', 'b1', 's']);
  });
});
