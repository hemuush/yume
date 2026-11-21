import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));

import { AppearancePicker } from './AppearancePicker';

const radios = (tree: ReactTestRenderer) =>
  tree.root
    .findAll((n) => n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function')
    .filter((n, i, all) => all.findIndex((m) => m.props.onPress === n.props.onPress) === i);

function render(value: 'system' | 'light' | 'dark', onChange = jest.fn()) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<AppearancePicker value={value} onChange={onChange} />);
  });
  return { tree, onChange };
}

it('offers System, Light and Dark and marks the current one', () => {
  const { tree } = render('light');
  expect(radios(tree).map((r) => [r.props.accessibilityLabel, r.props.accessibilityState.selected])).toEqual([
    ['System', false],
    ['Light', true],
    ['Dark', false],
  ]);
  act(() => tree.unmount());
});

it('reports the tapped mode, and says nothing when the current one is tapped again', () => {
  const { tree, onChange } = render('system');
  act(() => radios(tree)[2].props.onPress());
  expect(onChange).toHaveBeenCalledWith('dark');
  act(() => radios(tree)[0].props.onPress());
  expect(onChange).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
