/** The month ring: one arc per share in the legend colours, nothing that leaks hidden savings. */
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Circle } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { heroSlices } from './heroSlices';
import { MonthRing } from './MonthRing';

const mount = (node: React.ReactElement) => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(node);
  });
  return r;
};
const strokes = (r: ReactTestRenderer) => r.root.findAllByType(Circle).map((c) => c.props.stroke);
const image = (r: ReactTestRenderer) => r.root.find((n) => n.props.accessibilityRole === 'image');

it('draws spent, saved, bills and free arcs in the legend colours', () => {
  const r = mount(
    <MonthRing slices={heroSlices(100_000, 40_000, 10_000, 20_000)} hideSavings={false} dayShare={0.4} />
  );
  expect(strokes(r).slice(-4)).toEqual([
    theme.colors.slice.spent,
    theme.colors.slice.saved,
    theme.colors.slice.due,
    theme.colors.slice.free,
  ]);
  expect(image(r).props.accessibilityLabel).toBe(
    'Where the month went: spent 40%, saved 10%, bills 20%, free 30%'
  );
  act(() => r.unmount());
});

it('draws the day ring only for the current month', () => {
  const past = mount(<MonthRing slices={heroSlices(100_000, 40_000, 0, 0)} hideSavings={false} />);
  const now = mount(
    <MonthRing slices={heroSlices(100_000, 40_000, 0, 0)} hideSavings={false} dayShare={0.4} />
  );
  expect(strokes(now).length - strokes(past).length).toBe(2);
  act(() => {
    past.unmount();
    now.unmount();
  });
});

it('does not say or draw savings while they are hidden', () => {
  const r = mount(<MonthRing slices={heroSlices(100_000, 40_000, 10_000, 0)} hideSavings />);
  expect(strokes(r)).not.toContain(theme.colors.slice.saved);
  expect(image(r).props.accessibilityLabel).not.toMatch(/saved/);
  act(() => r.unmount());
});

it('dims the slices that were not picked', () => {
  const r = mount(
    <MonthRing slices={heroSlices(100_000, 40_000, 10_000, 0)} hideSavings={false} focus="spent" />
  );
  const arcs = r.root.findAllByType(Circle).filter((c) => c.props.opacity != null);
  expect(arcs.map((c) => c.props.opacity)).toEqual([1, 0.35, 0.35]);
  act(() => r.unmount());
});
