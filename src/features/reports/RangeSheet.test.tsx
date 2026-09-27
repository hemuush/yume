/**
 * Reports' range sheet: the first tap is the start and the second the end
 * (swapping if tapped backwards), a quick pick fills both, a finished range
 * restarts on the next tap, and days after today can't be picked.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ visible, children, footer }: { visible: boolean; children: any; footer?: any }) =>
    visible ? (
      <>
        {children}
        {footer}
      </>
    ) : null,
}));

import { RangeSheet, rangeQuickPicks } from './RangeSheet';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';

const today = toLocalIsoDate(new Date());
const month = today.slice(0, 7);

async function render(onApply = jest.fn()) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <RangeSheet
        visible
        initial={{ start: `${month}-01`, end: today }}
        onClose={jest.fn()}
        onApply={onApply}
      />
    );
  });
  return tree;
}
const day = (tree: ReactTestRenderer, iso: string) =>
  tree.root.find((n) => n.props.testID === `range-day-${iso}` && typeof n.props.onPress === 'function');
const show = (tree: ReactTestRenderer) =>
  tree.root.find((n) => typeof n.props.title === 'string' && n.props.onPress);
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));

describe('RangeSheet', () => {
  it('builds a range from two taps, swapping a backwards pair', async () => {
    const onApply = jest.fn();
    const tree = await render(onApply);
    const first = `${month}-01`;
    // The range shown is finished, so this tap starts a new one…
    act(() => day(tree, today).props.onPress());
    expect(show(tree).props.disabled).toBe(true);
    // …and this earlier one becomes the start.
    act(() => day(tree, first).props.onPress());
    act(() => show(tree).props.onPress());
    expect(onApply).toHaveBeenCalledWith(
      today === first ? { start: first, end: first } : { start: first, end: today }
    );
  });

  it('fills both ends from a quick pick', async () => {
    const onApply = jest.fn();
    const tree = await render(onApply);
    const pick = tree.root
      .findAll(
        (n) =>
          typeof n.props.onPress === 'function' &&
          n.findAllByType(Text).some((t) => t.props.children === 'Last 30 days')
      )
      .at(-1)!;
    act(() => pick.props.onPress());
    act(() => show(tree).props.onPress());
    expect(onApply).toHaveBeenCalledWith({ start: addDaysToIsoDate(today, -29), end: today });
  });

  it("doesn't let a day after today be picked", async () => {
    const tree = await render();
    const tomorrow = addDaysToIsoDate(today, 1);
    // Tomorrow may fall in next month, which the sheet doesn't show yet.
    const cells = tree.root.findAll(
      (n) => n.props.testID === `range-day-${tomorrow}` && typeof n.props.onPress === 'function'
    );
    if (tomorrow.startsWith(month)) expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) expect(c.props.disabled).toBe(true);
    expect(texts(tree).some((t) => t.startsWith('From '))).toBe(true);
  });
});

describe('rangeQuickPicks', () => {
  it('offers the last 30 days, the last 3 full months, and this and last financial year', () => {
    expect(rangeQuickPicks('2026-09-26')).toEqual([
      { label: 'Last 30 days', range: { start: '2026-08-28', end: '2026-09-26' } },
      { label: 'Last 3 months', range: { start: '2026-06-01', end: '2026-08-31' } },
      { label: 'FY 2026–27', range: { start: '2026-04-01', end: '2027-03-31' } },
      { label: 'FY 2025–26', range: { start: '2025-04-01', end: '2026-03-31' } },
    ]);
    expect(rangeQuickPicks('2026-02-10')[2].label).toBe('FY 2025–26');
  });
});
