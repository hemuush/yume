import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import type { Category } from '@/types';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/lib/useCollapsingHeader', () => ({ useCollapsingHeader: () => ({ headerHeight: 0 }) }));
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: jest.fn() }) }));
jest.mock('@/features/home/SkyHeader', () => ({
  SkyHeader: ({ actions }: { actions: unknown }) => actions,
  HeaderSummary: () => null,
}));
jest.mock('@/features/home/HomeWallpaper', () => ({ HomeWallpaper: () => null }));
jest.mock('@/components/ActionSheet', () => ({ ActionSheet: () => null }));
jest.mock('@/features/categories/AddCategoryModal', () => ({ AddCategoryModal: () => null }));
jest.mock('@/lib/useScreenLoad', () => ({
  useScreenLoad: (load: () => Promise<void>) => {
    require('react').useEffect(() => {
      void load();
    }, [load]);
    return { loaded: true, hasData: true, loadError: null, reload: load };
  },
}));

const category = (id: string, kind: 'expense' | 'income', extra: Partial<Category> = {}): Category => ({
  id,
  name: id,
  kind,
  icon: 'tag',
  color: '#8FCBFF',
  parentId: null,
  archived: false,
  isSystem: false,
  isSensitive: false,
  sortOrder: 0,
  ...extra,
});
const mockCategories = [
  category('Food', 'expense'),
  category('Coffee', 'expense', { parentId: 'Food' }),
  category('Salary', 'income'),
  category('Old category', 'expense', { archived: true }),
];
jest.mock('@/db/ledger', () => ({ listCategories: async () => mockCategories }));

import CategoriesScreen from '../../../app/categories';
import { CategorySection, CategoryTile } from './CategorySection';
import { AddCategoryModal } from './AddCategoryModal';
import { SheetTabs } from '@/components/SheetTabs';
import { AddButton } from '@/components/AddButton';
import { HeaderIconButton } from '@/components/AppHeader';

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CategoriesScreen />);
  });
  return tree;
}

it('switches category types, counts parents separately and creates in the selected type', async () => {
  const tree = await render();
  expect(tree.root.findByType(CategorySection).props.cats.map((cat: Category) => cat.id)).toEqual([
    'Food',
    'Coffee',
  ]);
  expect(tree.root.findByType(SheetTabs).props.options).toEqual([
    { label: 'Expense · 1', value: 'expense' },
    { label: 'Income · 1', value: 'income' },
  ]);
  act(() => tree.root.findByType(SheetTabs).props.onChange('income'));
  expect(tree.root.findByType(CategorySection).props.cats.map((cat: Category) => cat.id)).toEqual(['Salary']);
  act(() => tree.root.findByType(AddButton).props.onPress());
  const form = tree.root
    .findAllByType(AddCategoryModal)
    .find((n) => n.props.category === null && n.props.visible);
  expect(form?.props.initialKind).toBe('income');
});

it('keeps archived categories reachable alongside either type', async () => {
  const tree = await render();
  act(() => tree.root.findByType(SheetTabs).props.onChange('income'));
  act(() => tree.root.findByType(HeaderIconButton).props.onPress());
  expect(tree.root.findAllByType(CategoryTile).some((n) => n.props.category.id === 'Old category')).toBe(
    true
  );
  expect(tree.root.findAllByType(Text).some((n) => n.props.children === 'Archived')).toBe(true);
});
