/**
 * The Theme page: every pack as a preview card with just its name, the one
 * in use ticked; tapping a card switches the app to it.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockSetTheme = jest.fn();
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({
    accent: '#A6B4F2',
    secondary: '#8FE8C8',
    themeId: 'hollowViolet',
    setTheme: mockSetTheme,
  }),
}));

import ThemesScreen from '../../../app/themes';
import { THEMES } from '@/theme/themes';

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ThemesScreen />);
  });
  return tree;
}

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

/** One entry per theme card: its label and whether it's selected. */
const cards = (tree: ReactTestRenderer) => {
  const seen = new Map<string, boolean>();
  tree.root
    .findAll((n) => typeof n.props.onPress === 'function' && / theme$/.test(n.props.accessibilityLabel ?? ''))
    .forEach((n) => seen.set(n.props.accessibilityLabel, !!n.props.accessibilityState?.selected));
  return [...seen].map(([label, selected]) => ({ label, selected }));
};

async function press(tree: ReactTestRenderer, label: string) {
  const node = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      (n.props.accessibilityLabel === label ||
        n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === label))
  );
  await act(async () => {
    await node.props.onPress();
  });
}

beforeEach(() => jest.clearAllMocks());

describe('Theme page', () => {
  it('shows every pack, with the one in use selected', async () => {
    const tree = await render();
    expect(cards(tree)).toHaveLength(THEMES.length);
    const selected = cards(tree).filter((c) => c.selected);
    expect(selected.map((c) => c.label)).toEqual(['Hollow Violet theme']);
  });

  it('shows each theme by its name alone', async () => {
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Scout Cloak', 'Vibranium']));
    expect(texts(tree)).not.toEqual(expect.arrayContaining(['Attack on Titan']));
    expect(texts(tree)).not.toContain('Anime');
  });

  it('switches the app to a pack with one tap', async () => {
    const tree = await render();
    await press(tree, 'Scout Cloak theme');
    expect(mockSetTheme).toHaveBeenCalledWith('scoutCloak');
  });
});
