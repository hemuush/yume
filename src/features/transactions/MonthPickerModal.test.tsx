/** The month grid on Activity: the year stepper, no future months, and which date a month tap lands on. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(120000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children }: { children: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children),
}));

import { MonthPickerModal } from './MonthPickerModal';

const today = new Date(2026, 5, 15); // 15 June 2026
const anchor = new Date(2026, 2, 10);

const mounted: ReactTestRenderer[] = [];
const texts = (t: ReactTestRenderer) =>
  t.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const pressables = (t: ReactTestRenderer) => {
  const seen = new Set<string>();
  return t.root
    .findAll(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        typeof n.props.onPress === 'function' &&
        typeof n.props.accessibilityLabel === 'string'
    )
    .filter((n) => !seen.has(n.props.accessibilityLabel) && !!seen.add(n.props.accessibilityLabel));
};
const stepper = (t: ReactTestRenderer, label: string) =>
  pressables(t).find((p) => p.props.accessibilityLabel === label)!;
const cells = (t: ReactTestRenderer) =>
  pressables(t).filter(
    (p) => p.props.accessibilityLabel !== 'Previous year' && p.props.accessibilityLabel !== 'Next year'
  );

const element = (visible: boolean, onPick = jest.fn(), a = anchor) => (
  <MonthPickerModal visible={visible} anchor={a} todayDate={today} onClose={jest.fn()} onPick={onPick} />
);
function render(a = anchor) {
  const onPick = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(element(true, onPick, a));
  });
  mounted.push(tree);
  return { tree, onPick };
}

afterEach(() => act(() => mounted.splice(0).forEach((t) => t.unmount())));

describe('MonthPickerModal', () => {
  it('opens on the year being viewed, with a cell for each month', () => {
    const { tree } = render();
    expect(texts(tree)).toContain('2026');
    expect(cells(tree)).toHaveLength(12);
  });

  it('greys out the months still to come this year, and nothing else', () => {
    const { tree } = render();
    const disabled = cells(tree).map((c) => !!c.props.disabled);
    expect(disabled).toEqual([...Array(6).fill(false), ...Array(6).fill(true)]);
    expect(cells(tree)[5].props.accessibilityState.selected).toBe(true);
    expect(cells(tree)[2].props.accessibilityState.selected).toBe(false);
  });

  it('lands on the last day of a past month', () => {
    const { tree, onPick } = render();
    act(() => cells(tree)[2].props.onPress());
    expect(onPick).toHaveBeenCalledWith(new Date(2026, 2, 31));
  });

  it('lands on today for the month still in progress', () => {
    const { tree, onPick } = render();
    act(() => cells(tree)[5].props.onPress());
    expect(onPick).toHaveBeenCalledWith(today);
  });

  it('steps back a year, where every month is open, and lands on that month', () => {
    const { tree, onPick } = render();
    act(() => stepper(tree, 'Previous year').props.onPress());
    expect(texts(tree)).toContain('2025');
    expect(cells(tree).every((c) => !c.props.disabled)).toBe(true);
    act(() => cells(tree)[1].props.onPress());
    expect(onPick).toHaveBeenCalledWith(new Date(2025, 1, 28));
  });

  it('cannot step past the current year', () => {
    const { tree } = render();
    expect(stepper(tree, 'Next year').props.disabled).toBe(true);
    act(() => stepper(tree, 'Next year').props.onPress());
    expect(texts(tree)).toContain('2026');
    act(() => stepper(tree, 'Previous year').props.onPress());
    expect(stepper(tree, 'Next year').props.disabled).toBe(false);
    act(() => stepper(tree, 'Next year').props.onPress());
    expect(texts(tree)).toContain('2026');
  });

  it('renders nothing while closed, and reopens on the anchor year', () => {
    const { tree } = render();
    act(() => stepper(tree, 'Previous year').props.onPress());
    act(() => tree.update(element(false)));
    expect(tree.toJSON()).toBeNull();
    act(() => tree.update(element(true)));
    expect(texts(tree)).toContain('2026');
  });
});
