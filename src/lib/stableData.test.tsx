/**
 * Reloading Activity or Home changes the objects they hold even when nothing changed (accounts carry a balance that
 * moves with every entry, rows are fetched again). These keep what is the same the same object, so only what really
 * changed redraws: before, one deleted entry redrew all seven days on screen.
 */
import { Text } from 'react-native';
import { create, act } from 'react-test-renderer';
import {
  keepEntriesIfEqual,
  keepFieldsIfEqual,
  keepIfEqual,
  reuseUnchanged,
  reuseUnchangedBy,
  sameElements,
  useStableSet,
  useStableValue,
} from './stableData';

describe('keepIfEqual', () => {
  it('hands back the list already held when the new one holds the same things', () => {
    const prev = [{ id: 'a', name: 'Bank' }];
    expect(keepIfEqual(prev, [{ id: 'a', name: 'Bank' }])).toBe(prev);
  });

  it('takes the new list when anything in it differs', () => {
    const prev = [{ id: 'a', name: 'Bank' }];
    const next = [{ id: 'a', name: 'Bank account' }];
    expect(keepIfEqual(prev, next)).toBe(next);
    const longer = [...prev, { id: 'b', name: 'Cash' }];
    expect(keepIfEqual(prev, longer)).toBe(longer);
  });
});

describe('reuseUnchanged', () => {
  const row = (id: string, amountMinor: number) => ({ id, amountMinor, note: '' });

  it('keeps each row that is exactly as before, so a day made of them is made of the same objects', () => {
    const prev = [row('a', 100), row('b', 200), row('c', 300)];
    const next = [row('a', 100), row('b', 250), row('c', 300)];
    const out = reuseUnchanged(prev, next);
    expect(out[0]).toBe(prev[0]);
    expect(out[1]).toBe(next[1]);
    expect(out[1].amountMinor).toBe(250);
    expect(out[2]).toBe(prev[2]);
  });

  it('hands back the whole list when nothing changed, and the new list when something was added or removed', () => {
    const prev = [row('a', 100), row('b', 200)];
    expect(reuseUnchanged(prev, [row('a', 100), row('b', 200)])).toBe(prev);
    const added = reuseUnchanged(prev, [row('a', 100), row('b', 200), row('c', 1)]);
    expect(added).toHaveLength(3);
    expect(added[0]).toBe(prev[0]);
    expect(reuseUnchanged(prev, [row('b', 200)])).toHaveLength(1);
  });

  it('never keeps a row whose fields changed, however small the change', () => {
    const prev = [{ id: 'a', amountMinor: 100, note: 'tea' }];
    const out = reuseUnchanged(prev, [{ id: 'a', amountMinor: 100, note: 'chai' }]);
    expect(out[0].note).toBe('chai');
  });

  it('is the new list when there was nothing before', () => {
    const next = [row('a', 1)];
    expect(reuseUnchanged([], next)).toBe(next);
  });
});

describe('sameElements', () => {
  it('is true for the same objects in the same order, however the list around them was rebuilt', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    expect(sameElements([a, b], [a, b])).toBe(true);
    expect(sameElements([a, b], [b, a])).toBe(false);
    expect(sameElements([a], [a, b])).toBe(false);
    expect(sameElements([a], [{ id: 'a' }])).toBe(false);
    expect(sameElements(undefined, undefined)).toBe(true);
    expect(sameElements(undefined, [])).toBe(false);
  });
});

describe('useStableSet', () => {
  function Reads({ set, seen }: { set: ReadonlySet<string>; seen: ReadonlySet<string>[] }) {
    seen.push(useStableSet(set));
    return <Text>x</Text>;
  }

  it('is the same Set object for as long as it has the same members', () => {
    const seen: ReadonlySet<string>[] = [];
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Reads set={new Set(['a', 'b'])} seen={seen} />);
    });
    act(() => tree.update(<Reads set={new Set(['b', 'a'])} seen={seen} />));
    expect(seen[1]).toBe(seen[0]);
    act(() => tree.update(<Reads set={new Set(['a', 'b', 'c'])} seen={seen} />));
    expect(seen[2]).not.toBe(seen[0]);
    expect([...seen[2]].sort()).toEqual(['a', 'b', 'c']);
    act(() => tree.unmount());
  });
});

describe('useStableValue', () => {
  it('hands back the very same value while what it holds is the same, however often it is rebuilt', () => {
    const seen: unknown[] = [];
    function Probe({ value }: { value: unknown }) {
      seen.push(useStableValue(value));
      return null;
    }
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Probe value={[{ id: 'a', name: 'Bank' }]} />);
    });
    act(() => tree.update(<Probe value={[{ id: 'a', name: 'Bank' }]} />));
    expect(seen[1]).toBe(seen[0]);
    act(() => tree.update(<Probe value={[{ id: 'a', name: 'Bank of India' }]} />));
    expect(seen[2]).not.toBe(seen[0]);
    expect(seen[2]).toEqual([{ id: 'a', name: 'Bank of India' }]);
    act(() => tree.unmount());
  });
});

describe('keepFieldsIfEqual', () => {
  it('hands back the very same object when every field holds what it did', () => {
    const prev = { a: [1, 2], b: { n: 1 }, c: 'x' };
    expect(keepFieldsIfEqual(prev, { a: [1, 2], b: { n: 1 }, c: 'x' })).toBe(prev);
  });

  it('is a new object when a field changed, whose other fields are still the very same objects', () => {
    const prev = { a: [1, 2], b: { n: 1 }, c: 'x' };
    const next = { a: [1, 2], b: { n: 2 }, c: 'x' };
    const out = keepFieldsIfEqual(prev, next);
    expect(out).not.toBe(prev);
    expect(out.a).toBe(prev.a);
    expect(out.b).toBe(next.b);
  });

  it('takes the new object when there is nothing held, or the set of fields changed', () => {
    const next = { a: 1 };
    expect(keepFieldsIfEqual(null, next)).toBe(next);
    expect(keepFieldsIfEqual({ a: 1 } as { a: number; b?: number }, { a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
  });
});

describe('keepEntriesIfEqual', () => {
  const entry = (loanId: string, paid: number) => ({ loanId, paid, next: null });

  it('hands back the map already held when every entry is the same', () => {
    const prev = { a: entry('a', 1), b: entry('b', 2) };
    expect(keepEntriesIfEqual(prev, { a: entry('a', 1), b: entry('b', 2) })).toBe(prev);
  });

  it('keeps each entry that did not change, so a row made of it does not redraw', () => {
    const prev = { a: entry('a', 1), b: entry('b', 2) };
    const next = { a: entry('a', 1), b: entry('b', 3) };
    const out = keepEntriesIfEqual(prev, next);
    expect(out).not.toBe(prev);
    expect(out.a).toBe(prev.a);
    expect(out.b).toBe(next.b);
  });

  it('notices an entry that came or went', () => {
    const prev = { a: entry('a', 1) };
    expect(keepEntriesIfEqual(prev, { a: entry('a', 1), b: entry('b', 1) })).not.toBe(prev);
    expect(keepEntriesIfEqual({ a: entry('a', 1), b: entry('b', 1) }, { a: entry('a', 1) })).not.toBe(prev);
  });

  it('takes the first map as it is', () => {
    const first = { a: entry('a', 1) };
    expect(keepEntriesIfEqual(undefined, first)).toBe(first);
  });
});

describe('reuseUnchangedBy', () => {
  const budget = (id: string, spentMinor: number) => ({ budget: { id }, spentMinor });

  it('matches rows by the key it is given, keeping those that are exactly as before', () => {
    const prev = [budget('a', 100), budget('b', 200)];
    const next = [budget('a', 100), budget('b', 250)];
    const out = reuseUnchangedBy(prev, next, (row) => row.budget.id);
    expect(out[0]).toBe(prev[0]);
    expect(out[1]).toBe(next[1]);
  });

  it('hands back the list already held when nothing changed', () => {
    const prev = [budget('a', 100)];
    expect(reuseUnchangedBy(prev, [budget('a', 100)], (row) => row.budget.id)).toBe(prev);
  });
});
