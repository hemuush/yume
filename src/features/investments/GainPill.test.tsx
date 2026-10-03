/**
 * A tracked account's gain pill: green/red, "Add value" before the first update, amber age pill when stale,
 * and money and percentage both masked while savings amounts are hidden. Made-up figures.
 */
import { Text } from 'react-native';
import { create, act } from 'react-test-renderer';

let mockHideAmounts = false;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHideAmounts, toggleHideAmounts: jest.fn() }),
}));

import { GainPill, StalePill } from './GainPill';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import type { Account, AccountInvestment } from '@/types';

const account = (investment?: Partial<AccountInvestment>): Account =>
  ({
    id: 'a1',
    name: 'Index fund',
    type: 'savings',
    currency: 'INR',
    archived: false,
    investment: investment && {
      investedMinor: 4_200_000,
      takenOutMinor: 0,
      gainMinor: 256_000,
      valuedAt: '2026-09-28',
      lastValueMinor: 4_306_000,
      ...investment,
    },
  }) as unknown as Account;

function shown(el: React.ReactElement): string {
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(el);
  });
  return r.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(''))
    .join(' | ');
}

beforeEach(() => {
  mockHideAmounts = false;
});

describe('GainPill', () => {
  it('shows a gain with its return', () => {
    expect(shown(<GainPill account={account({})} />)).toBe('+₹2,560 · +6.1%');
  });
  it('shows a loss', () => {
    expect(shown(<GainPill account={account({ gainMinor: -100_000 })} />)).toBe('−₹1,000 · −2.4%');
  });
  it('asks for a value before the first update', () => {
    expect(shown(<GainPill account={account({ gainMinor: null, valuedAt: null })} />)).toBe('Add value');
  });
  it('renders nothing for an untracked account', () => {
    expect(shown(<GainPill account={account()} />)).toBe('');
  });
  it('masks both figures while amounts are hidden', () => {
    mockHideAmounts = true;
    const text = shown(<GainPill account={account({})} />);
    expect(text).toBe('•••• · ••%');
    expect(text).not.toMatch(/[0-9]/);
  });
});

describe('StalePill', () => {
  it('shows the age once the value is stale', () => {
    const old = addDaysToIsoDate(toLocalIsoDate(new Date()), -60);
    expect(shown(<StalePill account={account({ valuedAt: old })} />)).toBe('60 days old');
  });
  it('is hidden while the value is recent', () => {
    expect(shown(<StalePill account={account({ valuedAt: toLocalIsoDate(new Date()) })} />)).toBe('');
  });
});
