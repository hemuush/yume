/**
 * What the Categories page draws again for each thing done on it: a sheet opening or closing, a reload that found the
 * same categories, and a tile's panel opening draw what changed, not every tile.
 */
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import type { Category } from '@/types';

jest.setTimeout(60000);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/hooks/useCollapsingHeader', () => ({ useCollapsingHeader: () => ({ headerHeight: 0 }) }));
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: jest.fn() }) }));
jest.mock('@/features/home/SkyHeader', () => ({
  SkyHeader: ({ actions }: { actions: unknown }) => actions,
  HeaderSummary: () => null,
}));
jest.mock('@/features/home/HomeWallpaper', () => ({ HomeWallpaper: () => null }));
jest.mock('@/components/ActionSheet', () => ({ ActionSheet: () => null }));
const mockFocus = new Set<() => void | (() => void)>();
const mockUndo: (() => void)[] = [];
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => {
    mockFocus.add(cb);
    require('react').useEffect(cb, [cb]);
  },
}));
// Every tile draws its icon once each time it is drawn (nothing else on the page does).
const mockDrawn = { tiles: 0 };
jest.mock('@/components/CategoryIcon', () => ({
  CategoryIcon: () => {
    mockDrawn.tiles++;
    return null;
  },
}));
const mockSheet: { adding: boolean; closeAdd: (() => void) | null } = { adding: false, closeAdd: null };
jest.mock('@/features/categories/AddCategoryModal', () => ({
  AddCategoryModal: (props: { visible: boolean; initialKind?: string; onClose: () => void }) => {
    // The new-category form is the one that is given a starting type.
    if (props.initialKind) {
      mockSheet.adding = props.visible;
      mockSheet.closeAdd = props.onClose;
    }
    return null;
  },
}));
const mockList = jest.fn();
jest.mock('@/db/ledger', () => ({ listCategories: () => mockList() }));

import CategoriesScreen from '../../../app/categories';
import { AddButton } from '@/components/AddButton';

const category = (id: string, extra: Partial<Category> = {}): Category => ({
  id,
  name: id,
  kind: 'expense',
  icon: 'tag',
  color: '#8FCBFF',
  parentId: null,
  archived: false,
  isSystem: false,
  isSensitive: false,
  sortOrder: 0,
  ...extra,
});
const categories = [
  category('Food'),
  category('Coffee', { parentId: 'Food' }),
  category('Rent'),
  category('Travel'),
  category('Gifts'),
];
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

let mounted: ReactTestRenderer | null = null;
const settle = (ms = 0) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
async function render() {
  await act(async () => {
    mounted = create(<CategoriesScreen />);
  });
  await settle(20);
  return mounted!;
}
const showAgain = () =>
  act(async () => {
    mockFocus.forEach((cb) => {
      const undo = cb();
      if (typeof undo === 'function') mockUndo.push(undo);
    });
  });
const tapTile = (tree: ReactTestRenderer, label: string) =>
  act(() =>
    tree.root
      .find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')
      .props.onPress()
  );

beforeEach(() => {
  mockFocus.clear();
  mockDrawn.tiles = 0;
  Object.assign(mockSheet, { adding: false, closeAdd: null });
  mockList.mockImplementation(async () => copy(categories));
});
afterEach(() => {
  if (mounted) act(() => mounted!.unmount());
  mounted = null;
  mockUndo.splice(0).forEach((undo) => undo());
});

it('opens the new-category form from the header', async () => {
  const tree = await render();
  expect(mockDrawn.tiles).toBeGreaterThan(0);
  act(() => tree.root.findByType(AddButton).props.onPress());
  expect(mockSheet.adding).toBe(true);
  act(() => mockSheet.closeAdd!());
  expect(mockSheet.adding).toBe(false);
});

it('does not redraw a tile when a sheet opens or closes', async () => {
  const tree = await render();
  await settle(100);
  const drawn = mockDrawn.tiles;
  act(() => tree.root.findByType(AddButton).props.onPress());
  act(() => mockSheet.closeAdd!());
  expect(mockDrawn.tiles).toBe(drawn);
});

it('draws nothing again for a reload that found the same categories', async () => {
  await render();
  await settle(100);
  const drawn = mockDrawn.tiles;
  await showAgain();
  await settle(100);
  await settle(100);
  expect(mockDrawn.tiles).toBe(drawn);
});

it('draws the expanded parent without redrawing other categories', async () => {
  const tree = await render();
  await settle(100);
  const drawn = mockDrawn.tiles;
  tapTile(tree, 'Food, 1 subcategory');
  // The parent is drawn again (its chevron turns); its subcategory has no icon, so it is not counted here.
  expect(mockDrawn.tiles - drawn).toBe(1);
});

it('draws only the tile that changed when one category is renamed', async () => {
  await render();
  await settle(100);
  const drawn = mockDrawn.tiles;
  mockList.mockImplementation(async () =>
    copy(categories.map((c) => (c.id === 'Rent' ? { ...c, name: 'Home rent' } : c)))
  );
  await showAgain();
  await settle(100);
  await settle(100);
  expect(mockDrawn.tiles - drawn).toBe(1);
});
