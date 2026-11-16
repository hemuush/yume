import { renderHook } from '@/test-support/renderHook';
import { useStableModel } from './useStableModel';

type Model = {
  count: number;
  frequentAmounts: number[];
  friendAccounts: { id: string }[];
  usual: { id: string }[];
  totals: { count: number };
  submit: () => string;
  setCount: (n: number) => void;
};

const model = (count: number, calls: string[] = []): Model => ({
  count,
  frequentAmounts: [100, 200],
  friendAccounts: [{ id: 'a' }],
  usual: [{ id: 'u' }],
  totals: { count: 0 },
  submit: () => {
    calls.push(`submit@${count}`);
    return `saved ${count}`;
  },
  setCount: () => calls.push(`set@${count}`),
});

describe('useStableModel', () => {
  it('hands out each command as one fixed function, however often the model is rebuilt', () => {
    const { result, rerender } = renderHook(useStableModel<Model>, { initialProps: model(1) });
    const first = result.current;
    rerender(model(2));
    expect(result.current.submit).toBe(first.submit);
    expect(result.current.setCount).toBe(first.setCount);
  });

  it('runs the latest command, so a tap acts on the state as it is now', () => {
    const calls: string[] = [];
    const { result, rerender } = renderHook(useStableModel<Model>, { initialProps: model(1, calls) });
    const submit = result.current.submit;
    rerender(model(2, calls));
    rerender(model(3, calls));
    expect(submit()).toBe('saved 3');
    expect(calls).toEqual(['submit@3']);
  });

  it('keeps what is the same content the same object, until its content changes', () => {
    const { result, rerender } = renderHook(useStableModel<Model>, { initialProps: model(1) });
    const first = result.current;
    rerender(model(2));
    expect(result.current.frequentAmounts).toBe(first.frequentAmounts);
    expect(result.current.friendAccounts).toBe(first.friendAccounts);
    expect(result.current.usual).toBe(first.usual);
    expect(result.current.totals).toBe(first.totals);
    const changed = { ...model(3), frequentAmounts: [100] };
    rerender(changed);
    expect(result.current.frequentAmounts).toEqual([100]);
  });

  it('passes every other field through as it is', () => {
    const { result, rerender } = renderHook(useStableModel<Model>, { initialProps: model(1) });
    rerender(model(7));
    expect(result.current.count).toBe(7);
  });
});
