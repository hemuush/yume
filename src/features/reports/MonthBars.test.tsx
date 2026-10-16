import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text, StyleSheet } from 'react-native';
import { MonthBars, compactMoney } from './MonthBars';
it('keeps each amount above its own bar rather than at the common chart top', () => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <MonthBars
        months={[
          { month: '2026-09', totalMinor: 10000 },
          { month: '2026-10', totalMinor: 40000 },
        ]}
        usualMinor={20000}
        color="#FFA8CE"
      />
    );
  });
  const value = (text: string) => tree.root.findAllByType(Text).find((n) => n.props.children === text)!;
  expect(StyleSheet.flatten(value('₹100').props.style).bottom).toBe(24);
  expect(StyleSheet.flatten(value('₹400').props.style).bottom).toBe(78);
  act(() => tree.unmount());
});
it('retains the sign on large net-refund totals', () => {
  expect(compactMoney(-2110000)).toBe('−₹21.1k');
  expect(compactMoney(2110000)).toBe('₹21.1k');
});
