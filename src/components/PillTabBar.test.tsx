import { StyleSheet } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { PillTabBar } from './PillTabBar';
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/uiScale', () => ({ useUiScale: () => 1 }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('./icons/TabIcons', () => ({
  HomeIcon: () => null,
  ActivityIcon: () => null,
  PlanIcon: () => null,
  ReportsIcon: () => null,
}));
function render(index: number) {
  const emitter = { emit: jest.fn((_event: unknown) => ({ defaultPrevented: false })) };
  const navigateToTab = jest.fn();
  const add = jest.fn(),
    repeat = jest.fn();
  const routes = ['index', 'transactions', 'add', 'plan', 'reports'].map((name) => ({ key: name, name }));
  const descriptors = Object.fromEntries(
    routes.map((r) => [
      r.key,
      {
        options: {
          title: { index: 'Home', transactions: 'Activity', add: 'Add', plan: 'Plan', reports: 'Reports' }[
            r.name
          ],
        },
      },
    ])
  );
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <PillTabBar
        {...({
          state: { index, routes },
          emitter,
          navigateToTab,
          descriptors,
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
          onAdd: add,
          onAddLongPress: repeat,
        } as unknown as React.ComponentProps<typeof PillTabBar>)}
      />
    );
  });
  return { tree, emitter, navigateToTab, add, repeat };
}
it('shows Home Add and preserves repeat entry on long press', () => {
  const { tree, repeat, emitter, navigateToTab, add } = render(0);
  const addButton = tree.root.findAll(
    (n) => n.props.accessibilityLabel === 'Add a transaction' && n.props.onPress
  )[0];
  expect(addButton).toBeDefined();
  act(() => addButton.props.onPress());
  expect(add).toHaveBeenCalledTimes(1);
  const home = tree.root.findAll((n) => n.props.accessibilityLabel === 'Home' && n.props.onLongPress)[0];
  act(() => home.props.onLongPress());
  expect(repeat).toHaveBeenCalledTimes(1);
  const plan = tree.root.findAll((n) => n.props.accessibilityLabel === 'Plan' && n.props.onPress)[0];
  act(() => plan.props.onPress());
  expect(emitter.emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'plan', canPreventDefault: true });
  expect(navigateToTab).toHaveBeenCalledWith('plan');
  act(() => tree.unmount());
});
it('does not navigate when a tab press is prevented or the tab is already focused', () => {
  const { tree, emitter, navigateToTab } = render(0);
  emitter.emit.mockReturnValueOnce({ defaultPrevented: true });
  const pressOf = (label: string) =>
    tree.root.findAll((n) => n.props.accessibilityLabel === label && n.props.onPress)[0];
  act(() => pressOf('Plan').props.onPress());
  expect(navigateToTab).not.toHaveBeenCalled();
  act(() => pressOf('Home').props.onPress());
  expect(navigateToTab).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
it('forwards a long press on another tab to the navigator', () => {
  const { tree, emitter } = render(0);
  const plan = tree.root.findAll((n) => n.props.accessibilityLabel === 'Plan' && n.props.onLongPress)[0];
  act(() => plan.props.onLongPress());
  expect(emitter.emit).toHaveBeenCalledWith({ type: 'tabLongPress', target: 'plan' });
  act(() => tree.unmount());
});
it('retains Add on other screens', () => {
  const { tree, add } = render(3);
  act(() =>
    tree.root
      .findAll((n) => n.props.accessibilityLabel === 'Add a transaction' && n.props.onPress)[0]
      .props.onPress()
  );
  expect(add).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
it("shows the chosen tab's fill and hides the others", () => {
  const { tree } = render(1);
  const opacityOf = (label: string) =>
    StyleSheet.flatten(tree.root.findByProps({ testID: `tab-fill-${label}` }).props.style).opacity;
  expect(opacityOf('Activity')).toBe(1);
  expect(opacityOf('Home')).toBe(0);
  expect(opacityOf('Plan')).toBe(0);
  expect(opacityOf('Reports')).toBe(0);
  act(() => tree.unmount());
});
