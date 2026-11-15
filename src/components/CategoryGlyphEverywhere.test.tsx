/**
 * Every screen that draws a category's icon goes through the one glyph, so a person's own emoji shows wherever the
 * category does: the cards on top of sheets, chips, the budget rows, the category tiles. A built-in name still draws as an
 * icon in each of them.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { DraftCard } from './DraftCard';
import { Chip } from './Chip';
import { EntryHero } from '@/features/transactions/EntryHero';
import { PlanSummaryRow } from '@/features/plan/PlanSummaryRow';
import { BudgetHero } from '@/features/budgets/BudgetHero';
import { CategoryTile } from '@/features/categories/CategorySection';
import type { Category } from '@/types';

const COFFEE = '☕';

const category = (icon: string) =>
  ({
    id: 'c',
    name: 'Coffee runs',
    kind: 'expense',
    icon,
    color: '#FFC9A8',
    parentId: null,
    archived: false,
    isSystem: false,
    isSensitive: false,
    sortOrder: 0,
  }) as Category;

const noop = () => {};

const SURFACES: Record<string, (icon: string) => React.ReactElement> = {
  'the card on a sheet': (icon) => <DraftCard hue="#FFC9A8" icon={icon} title="T" kicker="K" />,
  'a filter chip': (icon) => <Chip label="Coffee" active={false} onPress={noop} icon={icon} />,
  'entry details': (icon) => (
    <EntryHero hue="#FFC9A8" icon={icon} title="T" kicker="K" amount="₹1" amountColor="#000" meta="M" />
  ),
  'a budget or goal row': (icon) => (
    <PlanSummaryRow
      name="N"
      subtitle="S"
      amount="₹1"
      icon={icon}
      animKey="k"
      color="#000"
      accessibilityLabel="L"
      onPress={noop}
    />
  ),
  'a budget overview': (icon) => (
    <BudgetHero
      hue="#FFC9A8"
      icon={icon}
      title="T"
      kicker="K"
      remaining="₹1"
      over={false}
      pct={50}
      tone="ok"
      animKey="k"
      spent="₹1"
      limit="₹2"
      status="S"
    />
  ),
  'a category tile': (icon) => <CategoryTile category={category(icon)} onPress={noop} onLongPress={noop} />,
};

const trees: ReactTestRenderer[] = [];
function render(node: React.ReactElement) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(node);
  });
  trees.push(tree);
  return tree;
}
afterEach(() => act(() => trees.splice(0).forEach((t) => t.unmount())));

const iconNames = (t: ReactTestRenderer) =>
  t.root.findAllByType(MaterialCommunityIcons).map((n) => n.props.name);
const textsOf = (t: ReactTestRenderer) =>
  t.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));

describe.each(Object.entries(SURFACES))('%s', (_surface, build) => {
  it('draws a person’s own emoji as text, not as an icon', () => {
    const tree = render(build(COFFEE));
    expect(textsOf(tree)).toContain(COFFEE);
    expect(iconNames(tree)).not.toContain(COFFEE);
  });

  it('still draws a built-in name as an icon', () => {
    const tree = render(build('airplane'));
    expect(iconNames(tree)).toContain('airplane');
    expect(textsOf(tree)).not.toContain('airplane');
  });
});
