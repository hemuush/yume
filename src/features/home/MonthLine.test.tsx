/** The month line: one segment per share, colours matching the legend, nothing that leaks hidden savings. */
import { StyleSheet } from 'react-native';
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { theme } from '@/constants/theme';
import { heroSlices } from './heroSlices';
import { MonthLine } from './MonthLine';

const mount = (node: React.ReactElement) => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(node);
  });
  return r;
};
const segments = (r: ReactTestRenderer) =>
  r.root
    .findAll(
      (n) => typeof n.type === 'string' && n.props.style && StyleSheet.flatten(n.props.style).flexBasis === 0
    )
    .map((n) => StyleSheet.flatten(n.props.style));
const line = (r: ReactTestRenderer) => r.root.find((n) => n.props.accessibilityRole === 'image');

it('draws spent, saved, bills and free in the legend colours, widest share growing most', () => {
  const r = mount(
    <MonthLine slices={heroSlices(100_000, 40_000, 10_000, 20_000)} hideSavings={false} periodKey="month:0" />
  );
  const parts = segments(r);
  expect(parts.map((p) => p.backgroundColor)).toEqual([
    theme.colors.slice.spent,
    theme.colors.slice.saved,
    theme.colors.slice.due,
    theme.colors.slice.free,
  ]);
  expect(parts.map((p) => Math.round((p.flexGrow as number) * 100))).toEqual([40, 10, 20, 30]);
  expect(line(r).props.accessibilityLabel).toBe(
    'Where the month went: spent 40%, saved 10%, bills 20%, free 30%'
  );
  act(() => r.unmount());
});

it('leaves out nothing but empty shares, and shows a month with no bills as three parts', () => {
  const r = mount(
    <MonthLine slices={heroSlices(100_000, 40_000, 0, 0)} hideSavings={false} periodKey="month:-1" />
  );
  expect(segments(r)).toHaveLength(2);
  act(() => r.unmount());
});

it('does not say or draw savings while they are hidden', () => {
  const r = mount(
    <MonthLine slices={heroSlices(100_000, 40_000, 10_000, 0)} hideSavings periodKey="month:-2" />
  );
  expect(segments(r).map((p) => p.backgroundColor)).toEqual([
    theme.colors.slice.spent,
    theme.colors.slice.free,
  ]);
  expect(line(r).props.accessibilityLabel).not.toMatch(/saved/);
  act(() => r.unmount());
});

it('is all spent when the month went over', () => {
  const r = mount(
    <MonthLine slices={heroSlices(100_000, 130_000, 0, 0)} hideSavings={false} periodKey="month:-3" />
  );
  expect(segments(r)).toHaveLength(1);
  act(() => r.unmount());
});

it('turns each slice into a button when it can be picked, and marks the picked one', () => {
  const onPick = jest.fn();
  const r = mount(
    <MonthLine
      slices={heroSlices(100_000, 40_000, 10_000, 20_000)}
      hideSavings={false}
      periodKey="month:0"
      focus="saved"
      onPick={onPick}
    />
  );
  const buttons = r.root.findAll((n) => n.props.accessibilityRole === 'button' && n.props.onPress);
  expect(buttons).toHaveLength(4);
  expect(buttons.map((b) => b.props.accessibilityState.selected)).toEqual([false, true, false, false]);
  expect(buttons[0].props.accessibilityLabel).toBe('Spent, 40% of the month. Show this');
  expect(buttons[1].props.accessibilityLabel).toBe('Saved, 10% of the month. Show free again');
  act(() => buttons[2].props.onPress());
  expect(onPick).toHaveBeenCalledWith('due');
  // The sentence for the whole line is only there while the slices are not buttons.
  expect(r.root.findAll((n) => n.props.accessibilityRole === 'image')).toHaveLength(0);
  act(() => r.unmount());
});
