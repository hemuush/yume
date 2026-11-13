/**
 * The Activity chart's week: the tapped day's amount shows in a bubble over its bar, today's label is an ink
 * pill, and days of the neighbouring month are named once above their dots. All figures are made up.
 */
import { Text, View, StyleSheet } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/money', () => ({
  ...jest.requireActual('@/lib/money'),
  formatMoney: (minor: number) => `₹${minor / 100}`,
}));

import { SpendBarChart } from './SpendBarChart';
import type { SpendBar } from './spendChart';
import { buildWeekSpendBars } from './spendChart';
import type { Transaction } from '@/types';

const expense = (date: string, amountMinor: number) =>
  ({ id: date, type: 'expense', date, amountMinor, categoryId: null, isRefund: false }) as Transaction;

// 1 Oct 2026 is a Thursday: the first week is Thu–Sat, with 27–30 Sep before it.
const bars = buildWeekSpendBars(
  [expense('2026-10-01', 13_484_00), expense('2026-10-02', 175_00)],
  [],
  { start: '2026-10-01', end: '2026-10-03' },
  '2026-10-02'
);

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));

function chart(selectedKey: string | null, onPressDay = jest.fn()) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<SpendBarChart bars={bars} onPressDay={onPressDay} selectedKey={selectedKey} inset={0} />);
  });
  return { r, onPressDay };
}

describe('SpendBarChart week', () => {
  it('fills a net-spending bar in one colour, whatever categories made it up', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <SpendBarChart
          bars={[
            {
              key: '2026-10-01',
              label: 'T',
              totalMinor: 8000,
              isCurrent: false,
              segments: [
                { categoryId: 'food', name: 'Food', color: '#123456', amountMinor: 6000 },
                { categoryId: 'travel', name: 'Travel', color: '#654321', amountMinor: 4000 },
              ],
            },
          ]}
          onPressDay={jest.fn()}
        />
      );
    });
    const colours = tree.root
      .findAllByType(View)
      .map((n) => StyleSheet.flatten(n.props.style))
      .map((s) => s?.backgroundColor);
    expect(colours).not.toContain('#123456');
    expect(colours).not.toContain('#654321');
    act(() => tree.unmount());
  });
  it('shows no amount until a day is tapped, then the tapped day’s amount', () => {
    expect(texts(chart(null).r)).not.toContain('₹13484');
    expect(texts(chart('2026-10-01').r)).toContain('₹13484');
  });

  it('shows the amount of one day only', () => {
    const all = texts(chart('2026-10-02').r);
    expect(all).toContain('₹175');
    expect(all).not.toContain('₹13484');
  });

  it('does not caption the dimmed days from the neighbouring month; the period row names the dates', () => {
    const note = texts(chart(null).r).filter((t) => t.startsWith('27–'));
    expect(note).toHaveLength(0);
  });

  it('reads a bar aloud with its amount formatted as money, not a raw number', () => {
    const { r } = chart(null);
    const labels = r.root
      .findAll((n) => n.props.accessibilityRole === 'button' && !!n.props.onPress)
      .map((n) => n.props.accessibilityLabel as string);
    expect(labels[0]).toMatch(/, spent ₹13484$/);
    expect(labels[1]).toMatch(/, spent ₹175$/);
  });

  it('still reports a tap on a real day, and ignores the placeholder days', () => {
    const { r, onPressDay } = chart(null);
    const buttons = r.root.findAll((n) => n.props.accessibilityRole === 'button' && !!n.props.onPress);
    expect(buttons).toHaveLength(2);
    act(() => buttons[0].props.onPress());
    expect(onPressDay).toHaveBeenCalledWith('2026-10-01');
  });
});

describe('large text', () => {
  const flat = (n: { props: { style?: unknown } }) =>
    StyleSheet.flatten(n.props.style as never) as Record<string, number>;
  const metrics = (fontScale: number) => {
    const spy = jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<SpendBarChart bars={bars} onPressDay={jest.fn()} />);
    });
    const row = tree.root.findAll((n) => n.props.style && flat(n).paddingHorizontal != null)[0];
    const label = tree.root.findAllByType(Text).find((t) => t.props.style && flat(t).minHeight != null)!;
    const out = { row: flat(row).height, line: flat(label).lineHeight };
    spy.mockRestore();
    return out;
  };

  it('grows the row and the day labels with the text size, so nothing is clipped', () => {
    const normal = metrics(1);
    const large = metrics(2);
    expect(large.row).toBeGreaterThan(normal.row);
    expect(large.line).toBeGreaterThan(normal.line);
  });

  it('stops growing at the supported text scale', () => {
    expect(metrics(4)).toEqual(metrics(2));
  });
});

describe('SpendBarChart calm chart', () => {
  const render = (selectedKey: string | null, averageMinor: number | null = null) => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <SpendBarChart
          bars={bars}
          onPressDay={jest.fn()}
          selectedKey={selectedKey}
          inset={0}
          dates
          averageMinor={averageMinor}
        />
      );
    });
    return r;
  };

  it('puts the date under the weekday and an amount only over the picked day', () => {
    const none = texts(render(null));
    expect(none).toEqual(expect.arrayContaining(['1', '2', '3']));
    expect(none).not.toContain('₹13484');
    expect(none).not.toContain('₹13k');
    expect(texts(render('2026-10-01'))).toContain('₹13484');
  });

  it('draws the average as a dashed line named at its end, and nothing without one', () => {
    expect(texts(render(null, 5000))).toContain('avg ₹50 a day');
    expect(texts(render(null, null)).some((t) => t.startsWith('avg'))).toBe(false);
  });

  it('says a week, not a day, when the bars are weeks', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<SpendBarChart bars={bars} onPressDay={jest.fn()} inset={0} averageMinor={5000} />);
    });
    expect(texts(r)).toContain('avg ₹50 a week');
  });

  it('draws the average’s name after the capsules, so none of them paints over it', () => {
    const r = render(null, 5000);
    type Json = { type: string; props: Record<string, unknown>; children: (Json | string)[] | null };
    const row = (function find(node: Json | string): Json | null {
      if (typeof node === 'string') return null;
      if (node.children?.some((c) => typeof c !== 'string' && c.props.pointerEvents === 'none')) return node;
      for (const child of node.children ?? []) {
        const hit = find(child);
        if (hit) return hit;
      }
      return null;
    })(r.toJSON() as Json)!;
    const kids = row.children as Json[];
    const overlays = kids.filter((c) => c.props.pointerEvents === 'none');
    expect(overlays).toHaveLength(2);
    // The dashed line first, behind the capsules; its name last, over them.
    expect(kids[0]).toBe(overlays[0]);
    expect(kids[kids.length - 1]).toBe(overlays[1]);
    expect(JSON.stringify(overlays[0])).not.toContain('avg');
    expect(JSON.stringify(overlays[1])).toContain('avg');
    act(() => r.unmount());
  });
  it('draws the picked amount outside the capsule, which clips what is inside it to its own width and height', () => {
    const r = render('2026-10-01');
    const amount = r.root.findAllByType(Text).find((t) => [t.props.children].flat().join('') === '₹13484')!;
    for (let node = amount.parent; node; node = node.parent) {
      expect(StyleSheet.flatten(node.props.style)?.overflow).not.toBe('hidden');
    }
    act(() => r.unmount());
  });

  it('lets the average’s name step aside only where the picked amount would be drawn over it', () => {
    const days = ['01', '02', '03', '04', '05'].map((d): SpendBar => ({
      key: `2026-10-${d}`,
      label: 'T',
      totalMinor: 100_000,
      isCurrent: false,
      segments: [],
    }));
    const named = (key: string) => {
      let r!: ReactTestRenderer;
      act(() => {
        r = create(
          <SpendBarChart
            bars={days}
            onPressDay={jest.fn()}
            selectedKey={key}
            inset={0}
            averageMinor={100_000}
          />
        );
      });
      return texts(r).some((t) => t.startsWith('avg'));
    };
    // The average is as tall as every bar: its name is where a bubble over one of the last three bars would be.
    expect(named('2026-10-01')).toBe(true);
    expect(named('2026-10-02')).toBe(true);
    expect(named('2026-10-03')).toBe(false);
    expect(named('2026-10-05')).toBe(false);
    // Picked days far from the name's height leave it (a short Friday, over the name's row, with the average low).
    expect(texts(render('2026-10-01', 5000))).toContain('avg ₹50 a day');
    expect(texts(render('2026-10-02', 5000)).some((t) => t.startsWith('avg'))).toBe(false);
    expect(texts(render(null, 5000))).toContain('avg ₹50 a day');
  });
});
