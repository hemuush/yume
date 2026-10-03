/**
 * The app's date picker (CalendarSheet) and its form field (DateField): days outside min/max can't be picked,
 * the month title jumps to any month/year, Today/Yesterday are one tap, weeks run Sunday to Saturday.
 */
import { create, act, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
// Sheets render their contents in place while open.
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}));

import { CalendarSheet } from './CalendarSheet';
import { DateField } from './DateField';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';

const textOf = (n: ReactTestInstance) => [].concat(n.props.children).join('');
const byLabel = (tree: ReactTestRenderer, label: string) =>
  tree.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');

async function renderCalendar(props: Partial<React.ComponentProps<typeof CalendarSheet>> = {}) {
  const onPick = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CalendarSheet visible value="2026-10-05" onClose={() => {}} onPick={onPick} {...props} />);
  });
  return { tree, onPick };
}

beforeAll(async () => {
  await renderCalendar();
}, 180000);

describe('CalendarSheet', () => {
  it('lays October 2026 out Sunday to Saturday, with the 1st on a Thursday', async () => {
    const { tree } = await renderCalendar();
    const weeks = tree.root.findAll(
      (n) =>
        n.props.style &&
        [].concat(n.props.style).some((s: any) => s?.flexDirection === 'row') &&
        n.children.length === 7
    );
    // The weekday header row, then five weeks.
    const firstWeek = weeks[1].children as ReactTestInstance[];
    expect(
      firstWeek.map((slot) => (slot.findAllByType(Text)[0] ? textOf(slot.findAllByType(Text)[0]) : ''))
    ).toEqual(['', '', '', '', '1', '2', '3']);
  });

  it('picks a day, and disables days outside the allowed range', async () => {
    const { tree, onPick } = await renderCalendar({ minDate: '2026-10-03', maxDate: '2026-10-20' });
    const day = (d: number) =>
      tree.root.find(
        (n) =>
          n.props.accessibilityLabel ===
            new Date(2026, 9, d).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }) && n.props.onPress
      );
    expect(day(2).props.disabled).toBe(true);
    expect(day(21).props.disabled).toBe(true);
    act(() => day(12).props.onPress());
    expect(onPick).toHaveBeenCalledWith('2026-10-12');
  });

  it('jumps to another month and year from the month title', async () => {
    const { tree } = await renderCalendar();
    await act(async () => byLabel(tree, 'October 2026. Pick a month and year').props.onPress());
    await act(async () => byLabel(tree, 'Previous year').props.onPress());
    await act(async () => byLabel(tree, 'March 2025').props.onPress());
    expect(tree.root.findAllByType(Text).map(textOf)).toContain('March 2025');
  });

  it('offers Today and Yesterday as one tap when asked', async () => {
    const { tree, onPick } = await renderCalendar({ quickPicks: true });
    const yesterday = tree.root.find(
      (n) =>
        typeof n.props.onPress === 'function' && n.findAllByType(Text).some((t) => textOf(t) === 'Yesterday')
    );
    act(() => yesterday.props.onPress());
    expect(onPick).toHaveBeenCalledWith(addDaysToIsoDate(toLocalIsoDate(new Date()), -1));
  });
});

describe('DateField', () => {
  it('shows the full date and opens the calendar', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<DateField label="First EMI due date" value="2026-10-05" onChange={() => {}} />);
    });
    const chip = tree.root.find(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.startsWith('First EMI due date:') &&
        n.props.onPress
    );
    expect(tree.root.findAllByType(Text).map(textOf)).not.toContain('Today');
    await act(async () => chip.props.onPress());
    expect(tree.root.findAllByType(Text).map(textOf)).toContain('October 2026');
  });

  it('gives past-facing dates Today and Yesterday chips', async () => {
    const onChange = jest.fn();
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<DateField label="Paid on" value="2026-01-10" onChange={onChange} pastFacing />);
    });
    act(() => byLabel(tree, 'Paid on: Today').props.onPress());
    expect(onChange).toHaveBeenCalledWith(toLocalIsoDate(new Date()));
  });
});
