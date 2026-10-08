/**
 * The split page: opens with the payment's category holding all of it, new parts typed on Yume's pad, Done
 * lights up only once the split works (saying what to do until then) and hands parts to Add. Made-up figures.
 */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), confirm: jest.fn(), warn: jest.fn() } }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
// Sheets render their contents in place while open.
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}));
// One plain button per category, so a test can pick one by name.
jest.mock('@/components/CategoryPicker', () => ({
  CategoryPicker: ({
    categories,
    onSelect,
  }: {
    categories: { id: string; name: string }[];
    onSelect: (id: string) => void;
  }) =>
    categories.map((c) => {
      const { Pressable } = require('react-native');
      return <Pressable key={c.id} accessibilityLabel={`pick ${c.name}`} onPress={() => onSelect(c.id)} />;
    }),
}));

import { router } from 'expo-router';
import { SplitScreen } from './SplitScreen';
import { openSplitSession, takeSplitResult, finishSplitSession } from './splitSession';
import { Category } from '@/types';

const categories = [
  { id: 'groceries', name: 'Groceries', icon: 'cart', color: '#FFC24D', parentId: null, kind: 'expense' },
  { id: 'food', name: 'Food', icon: 'food', color: '#FF9E7D', parentId: null, kind: 'expense' },
  { id: 'shopping', name: 'Shopping', icon: 'bag', color: '#C9B8FF', parentId: null, kind: 'expense' },
] as Category[];

const textOf = (n: ReactTestInstance) => [].concat(n.props.children).join('');
const texts = (tree: ReactTestRenderer) => tree.root.findAllByType(Text).map(textOf);
const byLabel = (tree: ReactTestRenderer, label: string) =>
  tree.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
const press = async (tree: ReactTestRenderer, label: string) => {
  await act(async () => {
    byLabel(tree, label).props.onPress();
  });
};
/** Taps "Add a category", which opens the category sheet. */
const addCategory = async (tree: ReactTestRenderer) => {
  await act(async () => {
    tree.root
      .find(
        (n) =>
          typeof n.props.onPress === 'function' &&
          n.findAllByType(Text).some((t) => textOf(t) === 'Add a category')
      )
      .props.onPress();
  });
};
const doneButton = (tree: ReactTestRenderer) =>
  tree.root.find((n) => typeof n.props.title === 'string' && typeof n.props.disabled === 'boolean');

function open(parts = [{ key: 'first', categoryId: 'groceries', amountText: '' }]) {
  openSplitSession({ totalMinor: 240000, currency: 'INR', meta: 'Bank · Today', categories, parts });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<SplitScreen />);
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  takeSplitResult();
});

describe('split page', () => {
  it('opens with the payment in its first category, and asks for a second', () => {
    const tree = open();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Groceries', 'The rest', 'Add a category']));
    expect(doneButton(tree).props).toMatchObject({ title: 'Add a 2nd category', disabled: true });
  });

  it('types a new category on the pad while the first takes the rest, then hands both back', async () => {
    const tree = open();
    await addCategory(tree);
    await press(tree, 'pick Food');
    expect(doneButton(tree).props).toMatchObject({ title: 'Enter the amount for Food', disabled: true });
    for (const key of ['5', '0', '0']) await press(tree, key);
    expect(texts(tree).join(' ')).toMatch(/1,900/);
    expect(doneButton(tree).props).toMatchObject({ title: 'Done', disabled: false });
    await act(async () => {
      doneButton(tree).props.onPress();
    });
    expect(router.back).toHaveBeenCalled();
    expect(takeSplitResult()?.map((p) => [p.categoryId, p.amountText])).toEqual([
      ['groceries', ''],
      ['food', '500'],
    ]);
  });

  it("won't add a category twice", async () => {
    const tree = open();
    await addCategory(tree);
    await press(tree, 'pick Groceries');
    expect(texts(tree)).toContain('That category is already in this split.');
    expect(texts(tree).filter((t) => t === 'Groceries')).toHaveLength(1);
  });

  it('says by how much the parts are over, and keeps Done off', () => {
    const tree = open([
      { key: 'first', categoryId: 'groceries', amountText: '' },
      { key: 'second', categoryId: 'food', amountText: '2600' },
    ]);
    expect(texts(tree)).toContain('The other parts come to ₹200 more than the whole payment.');
    expect(doneButton(tree).props).toMatchObject({ title: '₹200 over the payment', disabled: true });
  });

  it('leaves Add as it was when left without Done', () => {
    const tree = open();
    tree.unmount();
    expect(takeSplitResult()).toBeNull();
  });
});

describe('reached without a split to show', () => {
  const noSession = () => {
    finishSplitSession([]);
    takeSplitResult(); // clears the session
  };

  it('goes back when there is something to go back to', () => {
    noSession();
    act(() => {
      create(<SplitScreen />);
    });
    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('lands on Home from a deep link with nothing below it', () => {
    noSession();
    (router.canGoBack as jest.Mock).mockReturnValueOnce(false);
    act(() => {
      create(<SplitScreen />);
    });
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('copes with a session that has no parts', () => {
    const tree = open([]);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Add a category']));
  });
});
