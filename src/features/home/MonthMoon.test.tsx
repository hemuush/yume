import { Text } from 'react-native';
import { Circle, Path } from 'react-native-svg';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));

import { MonthMoon } from './MonthMoon';
import { heroSlices } from './heroSlices';

function render(slices: ReturnType<typeof heroSlices>, keptLabel?: string) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<MonthMoon slices={slices} keptLabel={keptLabel} />);
  });
  return r;
}
const caption = (r: ReactTestRenderer) => r.root.findByType(Text).props.children.join('');
const litPaths = (r: ReactTestRenderer) =>
  r.root.findAllByType(Path).filter((p) => p.props.fill === 'url(#moonLit)');

describe('month moon', () => {
  it('says how much of the income was kept, savings and what is free together', () => {
    const r = render(heroSlices(10_000, 4_000, 1_000));
    expect(caption(r)).toBe('60% kept');
    expect(r.root.find((n) => n.props.accessibilityLabel === '60% of income kept')).toBeTruthy();
    expect(litPaths(r)).toHaveLength(1);
  });

  it('calls it free while savings are hidden', () => {
    const r = render(heroSlices(10_000, 4_000, 1_000), 'free');
    expect(caption(r)).toBe('60% free');
  });

  it('is a new moon when everything went out: no lit side at all', () => {
    const r = render(heroSlices(10_000, 12_000, 0));
    expect(caption(r)).toBe('0% kept');
    expect(litPaths(r)).toHaveLength(0);
  });

  it('is a full moon when nothing was spent or saved away', () => {
    const r = render(heroSlices(10_000, 0, 0));
    expect(caption(r)).toBe('100% kept');
    expect(litPaths(r)[0].props.d).toContain('A45 45 0 1 1');
  });

  it('draws a ring slice for each of spent, saved, due and free, laid end to end', () => {
    const r = render(heroSlices(10_000, 2_000, 1_000, 500));
    const arcs = r.root.findAllByType(Circle).filter((c) => c.props.strokeDasharray != null);
    expect(arcs.map((c) => c.props.stroke)).toEqual(['#F6A88E', '#7FDDB9', '#F0BC4E', '#7DB9F2']);
    const starts = arcs.map((c) => Math.abs(c.props.strokeDashoffset));
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBeGreaterThan(starts[0]);
    expect(starts[3]).toBeGreaterThan(starts[2]);
  });
});
