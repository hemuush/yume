/** The period pill under Activity's title: step, pick, switch Week | Month. */
import { create, act, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));

import { ActivityPeriodBar } from './ActivityPeriodBar';

const swipe = { panHandlers: {}, dragStyle: {} } as never;
function bar(over: Partial<React.ComponentProps<typeof ActivityPeriodBar>> = {}) {
  const handlers = {
    onStepBack: jest.fn(),
    onStepForward: jest.fn(),
    onPickMonth: jest.fn(),
    onScope: jest.fn(),
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ActivityPeriodBar
        heading={{ title: 'This week', sub: 'Sep 20 – Sep 26 · 3 entries' }}
        updating={false}
        scope="week"
        atCurrent={false}
        swipe={swipe}
        {...handlers}
        {...over}
      />
    );
  });
  return { tree, ...handlers };
}
const button = (tree: ReactTestRenderer, label: string) =>
  tree.root.find(
    (n) => typeof n.props.onPress === 'function' && String(n.props.accessibilityLabel ?? '').startsWith(label)
  );
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));

it('steps by the scope it shows, and picks a month from the pill', () => {
  const week = bar();
  act(() => button(week.tree, 'Previous week').props.onPress());
  act(() => button(week.tree, 'Next week').props.onPress());
  act(() => button(week.tree, 'This week').props.onPress());
  expect(week.onStepBack).toHaveBeenCalledTimes(1);
  expect(week.onStepForward).toHaveBeenCalledTimes(1);
  expect(week.onPickMonth).toHaveBeenCalledTimes(1);
  act(() => week.tree.unmount());

  const month = bar({ scope: 'month' });
  expect(() => button(month.tree, 'Previous month')).not.toThrow();
  expect(() => button(month.tree, 'Next month')).not.toThrow();
  act(() => month.tree.unmount());
});

it('cannot step past the period in progress', () => {
  const { tree } = bar({ atCurrent: true });
  expect(button(tree, 'Next week').props.disabled).toBe(true);
  expect(button(tree, 'Next week').props.accessibilityState).toEqual({ disabled: true });
  expect(button(tree, 'Previous week').props.disabled).toBeFalsy();
  act(() => tree.unmount());
});

it('names the period and the first part of its subtitle, or says it is updating', () => {
  const settled = bar();
  expect(texts(settled.tree)).toEqual(expect.arrayContaining(['This week', 'Sep 20 – Sep 26']));
  expect(texts(settled.tree)).not.toContain('Updating…');
  act(() => settled.tree.unmount());

  const loading = bar({ updating: true });
  expect(texts(loading.tree)).toContain('Updating…');
  expect(texts(loading.tree)).not.toContain('Sep 20 – Sep 26');
  act(() => loading.tree.unmount());
});

it('switches between Week and Month, with the shown one marked selected', () => {
  const { tree, onScope } = bar({ scope: 'month' });
  const radios = tree.root.findAll(
    (n) => n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function'
  );
  const named = (word: string) =>
    radios.find((r) => r.findAllByType(Text).some((t) => t.props.children === word))!;
  expect(named('Month').props.accessibilityState).toEqual({ selected: true });
  expect(named('Week').props.accessibilityState).toEqual({ selected: false });
  act(() => named('Week').props.onPress());
  expect(onScope).toHaveBeenCalledWith('week');
  act(() => tree.unmount());
});
