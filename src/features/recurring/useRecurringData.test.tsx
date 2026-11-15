import { act } from 'react-test-renderer';
import { renderHook } from '@/test-support/renderHook';
import type { RecurringRule } from '@/types';

let mockRules: Partial<RecurringRule>[] = [];
let mockAccounts: { id: string; name: string; archived?: boolean; balanceMinor: number }[] = [];
let mockSuggestions: { key: string; amountMinor: number }[] = [];
let mockSuggestionsFail = false;
jest.mock('@/db/recurring', () => ({
  listRecurringRules: async () => JSON.parse(JSON.stringify(mockRules)),
}));
jest.mock('@/db/ledger', () => ({
  listAccounts: async () => JSON.parse(JSON.stringify(mockAccounts)),
  listCategories: async () => [{ id: 'rent', name: 'Rent' }],
}));
jest.mock('@/db/settings', () => ({
  getHiddenSubscriptionSuggestions: async () => [],
  getDefaultCurrency: async () => 'INR',
}));
jest.mock('@/db/subscriptions', () => ({
  getSubscriptionSuggestions: async () => {
    if (mockSuggestionsFail) throw new Error('nope');
    return JSON.parse(JSON.stringify(mockSuggestions));
  },
}));
jest.mock('@/lib/useScreenLoad', () => ({
  useScreenLoad: (load: () => Promise<void>) => {
    const React = require('react');
    const [loaded, setLoaded] = React.useState(false);
    React.useEffect(() => {
      void load().then(() => setLoaded(true));
    }, [load]);
    return { loaded, hasData: loaded, loadError: null, reload: load };
  },
}));

import { useRecurringData } from './useRecurringData';

const rule = (id: string, extra: Partial<RecurringRule> = {}) =>
  ({
    id,
    accountId: 'bank',
    toAccountId: null,
    active: true,
    amountMinor: 100,
    ...extra,
  }) as Partial<RecurringRule>;

beforeEach(() => {
  mockRules = [rule('a'), rule('b')];
  mockAccounts = [{ id: 'bank', name: 'Bank', balanceMinor: 1000 }];
  mockSuggestions = [{ key: 's1', amountMinor: 500 }];
  mockSuggestionsFail = false;
});

const settle = () => act(async () => {});

describe('useRecurringData', () => {
  it('reads everything as one update, so the page is drawn once for a load', async () => {
    const renders = jest.fn();
    const { result } = renderHook(useRecurringData, { onRender: renders });
    await settle();
    expect(result.current.rules.map((r) => r.id)).toEqual(['a', 'b']);
    expect(result.current.accounts.map((a) => a.id)).toEqual(['bank']);
    expect(result.current.suggestions.map((s) => s.key)).toEqual(['s1']);
    expect(result.current.currency).toBe('INR');
    // Mounting, the one update with the data, and the "loaded" flag.
    expect(renders.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('keeps the rules when the suggestions could not be read', async () => {
    mockSuggestionsFail = true;
    const { result } = renderHook(useRecurringData);
    await settle();
    expect(result.current.rules).toHaveLength(2);
    expect(result.current.suggestions).toEqual([]);
  });

  it('leaves out an archived account no rule uses, and keeps one a rule still runs on', async () => {
    mockAccounts = [
      { id: 'bank', name: 'Bank', balanceMinor: 1 },
      { id: 'old', name: 'Old', archived: true, balanceMinor: 1 },
      { id: 'used', name: 'Used', archived: true, balanceMinor: 1 },
    ];
    mockRules = [rule('a', { accountId: 'used' })];
    const { result } = renderHook(useRecurringData);
    await settle();
    expect(result.current.accounts.map((a) => a.id)).toEqual(['bank', 'used']);
  });

  it('draws nothing again when a reload finds the same things', async () => {
    const renders = jest.fn();
    const { result } = renderHook(useRecurringData, { onRender: renders });
    await settle();
    const before = { ...result.current };
    const drawn = renders.mock.calls.length;
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.rules).toBe(before.rules);
    expect(result.current.accounts).toBe(before.accounts);
    expect(renders.mock.calls.length).toBe(drawn);
  });

  it('keeps each rule that did not change, so only the one that did is drawn again', async () => {
    const { result } = renderHook(useRecurringData);
    await settle();
    const before = { ...result.current };
    mockRules[1] = rule('b', { amountMinor: 250 });
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.rules[0]).toBe(before.rules[0]);
    expect(result.current.rules[1]).not.toBe(before.rules[1]);
    expect(result.current.categories).toBe(before.categories);
  });

  it('shows a rule paused at once, changing only that rule', async () => {
    const { result } = renderHook(useRecurringData);
    await settle();
    const before = { ...result.current };
    act(() => result.current.setRuleActive('b', false));
    expect(result.current.rules[1]).toMatchObject({ id: 'b', active: false });
    expect(result.current.rules[0]).toBe(before.rules[0]);
  });

  it('takes a suggestion off the list at once', async () => {
    const { result } = renderHook(useRecurringData);
    await settle();
    act(() => result.current.dropSuggestion('s1'));
    expect(result.current.suggestions).toEqual([]);
  });
});
