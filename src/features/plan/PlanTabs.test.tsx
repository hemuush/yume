/** The pieces the Plan tabs add: stat tiles, the loans list and the exact three-tile rows. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text, View } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: false }) }));
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);

import { PlanStats } from './PlanStats';
import { DebtLoans } from './DebtLoans';
import { TileGrid } from './PlanGrid';
import { buildLoansSummary } from './planOverview';

function render(el: React.ReactElement) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(el);
  });
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

beforeEach(() => {
  jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width: 390, height: 800, fontScale: 1, scale: 1 });
});
afterEach(() => jest.restoreAllMocks());

describe('PlanStats', () => {
  it('draws nothing when nothing is due', () => {
    const tree = render(<PlanStats count={0} days={30} next={null} onOpen={jest.fn()} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('opens Upcoming from the combined count and next-payment summary', () => {
    const onOpen = jest.fn();
    const tree = render(
      <PlanStats count={3} days={30} next={{ date: '2026-11-01', title: 'Parents' }} onOpen={onOpen} />
    );
    const shown = texts(tree);
    expect(shown).toContain('3 payments in the next 30 days');
    expect(shown.some((value) => value.includes('Parents') && value.startsWith('Next ·'))).toBe(true);
    const button = tree.root.findAll((n) => n.props.accessibilityRole === 'button' && n.props.onPress);
    expect(button).toHaveLength(1);
    act(() => button[0].props.onPress());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('uses singular payment for one', () => {
    const tree = render(<PlanStats count={1} days={30} next={null} onOpen={jest.fn()} />);
    expect(texts(tree)).toContain('1 payment in the next 30 days');
  });
});

describe('DebtLoans', () => {
  const loans = buildLoansSummary(
    [
      {
        id: 'h',
        counterparty: 'HDFC House',
        direction: 'borrowed',
        status: 'active',
        principalMinor: 220000000,
        outstandingPrincipalMinor: 214895900,
      },
      {
        id: 'a',
        counterparty: 'Asha',
        direction: 'lent',
        status: 'active',
        principalMinor: 500000,
        outstandingPrincipalMinor: 200000,
      },
    ],
    [
      {
        loanId: 'h',
        nextDueDate: '2026-11-03',
        nextEmiMinor: 20000,
        paidCount: 12,
        totalCount: 240,
        lastDueDate: '2045-01-03',
      },
    ]
  );

  it('lists each open loan with what is left, and opens the one tapped', () => {
    const onLoan = jest.fn();
    const tree = render(<DebtLoans loans={loans} onLoan={onLoan} />);
    const shown = texts(tree);
    expect(shown).toContain('HDFC House');
    expect(shown.some((t) => t.startsWith('12 of 240 paid · ends'))).toBe(true);
    expect(shown).toContain('₹21,48,959');
    // Money you lent shows as owed to you.
    expect(shown).toContain('+₹2,000');
    act(() =>
      tree.root
        .find((n) => String(n.props.accessibilityLabel).startsWith('HDFC House,') && n.props.onPress)
        .props.onPress()
    );
    expect(onLoan).toHaveBeenCalledWith('h');
  });

  it('draws nothing without loans', () => {
    const tree = render(<DebtLoans loans={buildLoansSummary([], [])} onLoan={jest.fn()} />);
    expect(tree.toJSON()).toBeNull();
  });
});

describe('TileGrid', () => {
  const tile = (n: number) => <View key={n} testID={`t${n}`} />;
  const rowCount = (tree: ReactTestRenderer, count: number) => {
    const ids = Array.from({ length: count }, (_, i) => `t${i}`);
    // Each tile's parent is one row; count the distinct parents.
    const parents = new Set(ids.map((id) => tree.root.findByProps({ testID: id }).parent));
    return parents.size;
  };
  const add = jest.fn();
  const grid = (n: number, limit?: number) =>
    render(
      <TileGrid
        tiles={Array.from({ length: n }, (_, i) => tile(i))}
        label="Add"
        accessibilityLabel="Add one"
        onAdd={add}
        limit={limit}
      />
    );
  const hasAdd = (tree: ReactTestRenderer) =>
    tree.root.findAll((n) => n.props.accessibilityLabel === 'Add one' && n.props.onPress).length > 0;

  it('puts the add button in the free slot of the row, or on a row of its own when the row is full', () => {
    expect(rowCount(grid(2), 2)).toBe(1);
    expect(hasAdd(grid(2))).toBe(true);
    const full = grid(3);
    expect(rowCount(full, 3)).toBe(1);
    expect(hasAdd(full)).toBe(true);
  });

  it('starts a second row after three tiles and stops at the limit', () => {
    expect(rowCount(grid(4), 4)).toBe(2);
    expect(hasAdd(grid(6))).toBe(false);
    // Overview's one row: three tiles and no add button.
    const overview = grid(5, 3);
    expect(rowCount(overview, 3)).toBe(1);
    expect(hasAdd(overview)).toBe(false);
    expect(overview.root.findAllByProps({ testID: 't3' })).toHaveLength(0);
  });

  it('keeps short rows as wide as full ones by padding with empty slots', () => {
    const tree = grid(1);
    const row = tree.root.findByProps({ testID: 't0' }).parent!;
    // One tile, the add button and one empty slot.
    expect(row.children).toHaveLength(3);
  });
});
