/**
 * Reloading Activity changes the objects it holds even when nothing changed (accounts carry a balance that moves with
 * every entry, rows are fetched again). These keep what is the same the same object, so only a day that really
 * changed redraws: before, one deleted entry redrew all seven days on screen.
 */
import { Text } from 'react-native';
import { create, act } from 'react-test-renderer';
import { keepIfEqual, reuseUnchanged, sameElements, useStableSet } from './transactions.helpers';

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
