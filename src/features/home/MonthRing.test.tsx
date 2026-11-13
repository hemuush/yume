/** The month ring: one arc per share in the legend colours, nothing that leaks hidden savings. */
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';
import { Circle, Stop } from 'react-native-svg';
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
/** Each slice is a circle painted by its own gradient; its own colour is the gradient's first stop (offset 0). */
const sliceColours = (r: ReactTestRenderer) =>
  r.root
    .findAllByType(Stop)
    .filter((s) => s.props.offset === '0')
    .map((s) => s.props.stopColor);
const arcsOf = (r: ReactTestRenderer) =>
  r.root.findAllByType(Circle).filter((c) => String(c.props.stroke).startsWith('url(#ring-'));
/** The views the slices sit in: the one that is dimmed, with the glide on it. */
const sliceViews = (r: ReactTestRenderer) =>
  r.root
    .findAllByType(View)
    .map((v) => StyleSheet.flatten(v.props.style))
    .filter((st) => st?.transitionProperty === 'opacity');
const image = (r: ReactTestRenderer) => r.root.find((n) => n.props.accessibilityRole === 'image');

it('draws spent, saved, bills and free arcs in the legend colours', () => {
  const r = mount(
    <MonthRing slices={heroSlices(100_000, 40_000, 10_000, 20_000)} hideSavings={false} dayShare={0.4} />
  );
  expect(sliceColours(r)).toEqual([
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
  expect(sliceColours(r)).not.toContain(theme.colors.slice.saved);
  expect(image(r).props.accessibilityLabel).not.toMatch(/saved/);
  act(() => r.unmount());
});

it('dims the slices that were not picked', () => {
  const r = mount(
    <MonthRing slices={heroSlices(100_000, 40_000, 10_000, 0)} hideSavings={false} focus="spent" />
  );
  expect(sliceViews(r).map((st) => st.opacity)).toEqual([1, 0.35, 0.35]);
  // Picking another slice glides: a CSS transition on each slice's view, not a hard switch.
  expect(sliceViews(r).every((st) => st.transitionDuration === '200ms')).toBe(true);
  act(() => r.unmount());
});

it('keeps round-capped arcs from running into each other, and draws one slice as a closed ring', () => {
  const r = mount(<MonthRing slices={heroSlices(100_000, 40_000, 0, 0)} hideSavings={false} />);
  const arcs = arcsOf(r);
  const circumference = 2 * Math.PI * ((112 - 10 - 5 - 2) / 2);
  const [spent, free] = arcs.map((c) => c.props);
  const len = (p: Record<string, unknown>) => parseFloat(String(p.strokeDasharray));
  // Each arc's visible length (dash plus its two round caps) leaves a gap before the next one starts.
  expect(len(spent) + 10).toBeLessThan(circumference * 0.4);
  expect(len(free) + 10).toBeLessThan(circumference * 0.6);
  act(() => r.unmount());
  const whole = mount(<MonthRing slices={heroSlices(100_000, 100_000, 0, 0)} hideSavings={false} />);
  const only = arcsOf(whole);
  expect(only).toHaveLength(1);
  expect(only[0].props.strokeDasharray).toBeUndefined();
  act(() => whole.unmount());
});

it('draws very small slices as thin flat bars in their own slots, so Free is always seen and none overlap', () => {
  // The screenshot month: spent 46,312, saved 35,000, bills 299, free 1,778 of 83,389.
  const r = mount(
    <MonthRing slices={heroSlices(83_389_00, 46_312_00, 35_000_00, 299_00)} hideSavings={false} />
  );
  const arcs = arcsOf(r);
  expect(arcs).toHaveLength(4);
  const circumference = 2 * Math.PI * ((112 - 10 - 5 - 2) / 2);
  const spans = arcs.map((c) => {
    const length = parseFloat(String(c.props.strokeDasharray));
    const start = -Number(c.props.strokeDashoffset);
    // What is drawn on the ring: round caps reach half a stroke past each end.
    const reach = c.props.strokeLinecap === 'round' ? 5 : 0;
    return { from: start - reach, to: start + length + reach, cap: c.props.strokeLinecap, length };
  });
  // Bills left (0.4%) and Free (2.1%) are too small for round caps: flat, at least 2 dp, visible.
  expect(spans[2].cap).toBe('butt');
  expect(spans[3].cap).toBe('butt');
  expect(spans[2].length).toBeGreaterThanOrEqual(2);
  expect(spans[3].length).toBeGreaterThanOrEqual(2);
  // Each arc ends before the next begins, and the last stays on the ring.
  for (let i = 1; i < spans.length; i++) expect(spans[i - 1].to).toBeLessThanOrEqual(spans[i].from + 0.01);
  expect(spans[3].to).toBeLessThanOrEqual(circumference + 0.01);
  act(() => r.unmount());
});

it('hides the picture from screen readers when there is no income', () => {
  const r = mount(<MonthRing slices={heroSlices(0, 0, 0, 0)} hideSavings={false} />);
  expect(image(r).props.accessibilityElementsHidden).toBe(true);
  expect(image(r).props.accessible).toBe(false);
  act(() => r.unmount());
});
