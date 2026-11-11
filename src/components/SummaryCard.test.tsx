/**
 * The flat summary card shared by Budgets, Recurring, Investments and Friends & family: its figure, side note,
 * split bar, facts and list card. Made-up figures.
 */
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';
import { theme } from '@/constants/theme';
import {
  ListCard,
  SummaryCard,
  SummaryFacts,
  SummarySide,
  SummarySplit,
  SummaryTop,
  summaryFigure,
} from './SummaryCard';

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));
const colorOf = (tree: ReactTestRenderer, text: string) => {
  const node = tree.root.findAllByType(Text).find((t) => [t.props.children].flat().join('') === text)!;
  return (StyleSheet.flatten(node.props.style) as { color?: string }).color;
};

function render(ui: React.ReactElement) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(ui);
  });
  return tree;
}

describe('SummaryCard pieces', () => {
  it('puts the label over the figure, with the side note beside them', () => {
    const tree = render(
      <SummaryCard>
        <SummaryTop
          label="Left this month"
          figure={<Text style={summaryFigure}>₹14,820</Text>}
          side={<SummarySide main="₹690 a day" note="13 days left" />}
        />
      </SummaryCard>
    );
    expect(texts(tree)).toEqual(['Left this month', '₹14,820', '₹690 a day', '13 days left']);
  });

  it('keeps the lead figure at 20 px', () => {
    expect(summaryFigure.fontSize).toBe(20);
  });

  it('colours a fact or the side line by tone, and leaves the rest neutral', () => {
    const tree = render(
      <>
        <SummaryFacts
          facts={[
            { label: 'Spent', value: '₹24,180' },
            { label: 'Gain', value: '+₹92,300', tone: 'good' },
            { label: 'Needs a look', value: '1 over', tone: 'bad' },
            { label: 'Pace', value: '1 ahead', tone: 'warn' },
          ]}
        />
        <SummarySide main="+12.4% return" tone="good" />
      </>
    );
    expect(colorOf(tree, '₹24,180')).toBe(theme.colors.textPrimary);
    expect(colorOf(tree, '+₹92,300')).toBe(theme.colors.incomeText);
    expect(colorOf(tree, '1 over')).toBe(theme.colors.expenseText);
    expect(colorOf(tree, '1 ahead')).toBe(theme.colors.warnInk);
    expect(colorOf(tree, '+12.4% return')).toBe(theme.colors.incomeText);
  });

  it('draws nothing for no facts and skips empty parts of a split', () => {
    expect(render(<SummaryFacts facts={[]} />).toJSON()).toBeNull();
    expect(render(<SummarySplit parts={[{ key: 'a', weight: 0, color: '#000' }]} />).toJSON()).toBeNull();
    const split = render(
      <SummarySplit
        parts={[
          { key: 'a', weight: 3, color: '#111' },
          { key: 'b', weight: 0, color: '#222' },
          { key: 'c', weight: 1, color: '#333' },
        ]}
      />
    );
    const bar = split.root.findAll((n) => n.props.accessibilityElementsHidden === true)[0];
    expect(bar.props.children).toHaveLength(2);
  });

  it('holds list rows in a flat card', () => {
    const tree = render(
      <ListCard>
        <Text>Row</Text>
      </ListCard>
    );
    expect(texts(tree)).toEqual(['Row']);
  });
});
