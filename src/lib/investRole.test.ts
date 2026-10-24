import { investLines, investRole, investmentIdsOf } from './investment';
import type { Account } from '@/types';

const ids = investmentIdsOf([
  { id: 'fund', investment: {} },
  { id: 'gold', investment: {} },
  { id: 'bank', investment: undefined },
] as Account[]);
const tx = (accountId: string, toAccountId: string | null, over = {}) => ({
  type: 'transfer' as const,
  accountId,
  toAccountId,
  note: '',
  ruleId: null,
  ...over,
});
const name = (id: string) => ({ fund: 'Nifty 50', gold: 'Digital gold', bank: 'HDFC' })[id] ?? id;

describe('investRole', () => {
  it('reads a transfer into an investment as invest, out of one as withdraw, between two as move', () => {
    expect(investRole(tx('bank', 'fund'), ids)).toBe('invest');
    expect(investRole(tx('fund', 'bank'), ids)).toBe('withdraw');
    expect(investRole(tx('fund', 'gold'), ids)).toBe('move');
  });
  it('leaves ordinary transfers and every other entry alone', () => {
    expect(investRole(tx('bank', 'cash'), ids)).toBeNull();
    expect(investRole({ ...tx('bank', 'fund'), type: 'expense' as never }, ids)).toBeNull();
    expect(investRole(tx('bank', null), ids)).toBeNull();
  });
});

describe('investLines', () => {
  it('says Invested in with where it came from, and SIP when a rule posted it', () => {
    expect(investLines(tx('bank', 'fund'), 'invest', name)).toEqual({
      title: 'Invested in Nifty 50',
      sub: 'from HDFC',
    });
    expect(investLines(tx('bank', 'fund', { ruleId: 'r1' }), 'invest', name).sub).toBe('SIP · from HDFC');
    expect(investLines(tx('bank', 'fund', { note: 'Top-up', ruleId: 'r1' }), 'invest', name).sub).toBe(
      'Top-up · SIP · from HDFC'
    );
  });
  it('words a withdrawal and a move', () => {
    expect(investLines(tx('gold', 'bank'), 'withdraw', name)).toEqual({
      title: 'Withdrawn from Digital gold',
      sub: 'to HDFC',
    });
    expect(investLines(tx('gold', 'fund'), 'move', name)).toEqual({
      title: 'Moved Digital gold → Nifty 50',
      sub: 'Between investments',
    });
  });
});
