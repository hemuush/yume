import { act } from 'react-test-renderer';
import { renderHook } from '@/test-support/renderHook';
import type { SubscriptionSuggestion } from '@/db/subscriptions';
import type { RecurringRule } from '@/types';

const mockAlert = jest.fn();
const mockSetActive = jest.fn(async (..._args: unknown[]) => undefined);
const mockHide = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('@/components/AppDialog', () => ({ showAlert: (...args: unknown[]) => mockAlert(...args) }));
jest.mock('@/db/recurring', () => ({
  setRecurringRuleActive: (...args: unknown[]) => mockSetActive(...args),
}));
jest.mock('@/db/settings', () => ({ hideSubscriptionSuggestion: (...args: unknown[]) => mockHide(...args) }));

import { useRuleActions } from './useRuleActions';

const rule = { id: 'r1', active: true } as RecurringRule;
const suggestion = { key: 's1' } as SubscriptionSuggestion;

function setup() {
  const reload = jest.fn(async () => {});
  const setRuleActive = jest.fn();
  const dropSuggestion = jest.fn();
  const hook = renderHook(() => useRuleActions({ reload, setRuleActive, dropSuggestion }));
  return { ...hook, reload, setRuleActive, dropSuggestion };
}

beforeEach(() => jest.clearAllMocks());

describe('useRuleActions', () => {
  it('pauses a rule: writes it, shows it paused at once, then reloads', async () => {
    const { result, reload, setRuleActive } = setup();
    await act(async () => result.current.togglePause(rule));
    expect(mockSetActive).toHaveBeenCalledWith('r1', false);
    expect(setRuleActive).toHaveBeenCalledWith('r1', false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.busyRuleIds.size).toBe(0);
  });

  it('resumes a paused rule', async () => {
    const { result, setRuleActive } = setup();
    await act(async () => result.current.togglePause({ ...rule, active: false }));
    expect(mockSetActive).toHaveBeenCalledWith('r1', true);
    expect(setRuleActive).toHaveBeenCalledWith('r1', true);
  });

  it('marks the rule busy while it is written, and ignores a second tap on it', async () => {
    let finish!: () => void;
    mockSetActive.mockImplementationOnce(() => new Promise((resolve) => (finish = () => resolve(undefined))));
    const { result } = setup();
    act(() => void result.current.togglePause(rule));
    expect([...result.current.busyRuleIds]).toEqual(['r1']);
    await act(async () => result.current.togglePause(rule));
    expect(mockSetActive).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(result.current.busyRuleIds.size).toBe(0);
  });

  it('says so when a rule could not be changed, and does not show it changed', async () => {
    mockSetActive.mockRejectedValueOnce(new Error('Disk full'));
    const { result, setRuleActive } = setup();
    await act(async () => result.current.togglePause(rule));
    expect(mockAlert).toHaveBeenCalledWith('Couldn’t update recurring entry', 'Disk full');
    expect(setRuleActive).not.toHaveBeenCalled();
    expect(result.current.busyRuleIds.size).toBe(0);
  });

  it('hides a suggestion at once and keeps it hidden', async () => {
    const { result, dropSuggestion, reload } = setup();
    await act(async () => result.current.hideSuggestion(suggestion));
    expect(dropSuggestion).toHaveBeenCalledWith('s1');
    expect(mockHide).toHaveBeenCalledWith('s1');
    expect(reload).not.toHaveBeenCalled();
  });

  it('shows a suggestion again, and says why, when hiding it was not saved', async () => {
    mockHide.mockRejectedValueOnce(new Error('Locked'));
    const { result, reload } = setup();
    await act(async () => result.current.hideSuggestion(suggestion));
    expect(mockAlert).toHaveBeenCalledWith('Couldn’t hide it', 'Locked');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('keeps its functions the same across redraws', () => {
    const { result, rerender } = setup();
    const before = { ...result.current };
    rerender(undefined);
    expect(result.current.togglePause).toBe(before.togglePause);
    expect(result.current.hideSuggestion).toBe(before.hideSuggestion);
  });
});
