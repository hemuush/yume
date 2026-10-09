import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.useFakeTimers();

import { ReportsHero } from './ReportsHero';

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

function render(props: Partial<React.ComponentProps<typeof ReportsHero>> = {}) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ReportsHero
        periodLabel="October"
        spentMinor={5342000}
        incomeMinor={9500000}
        baselineMinor={5377000}
        vsUsual={{ pct: 12, soFar: true }}
        previousMinor={5763000}
        previousLabel="September"
        monthProgress={0.3}
        {...props}
      />
    );
  });
  return tree;
}

describe('ReportsHero', () => {
  it('shows what went out, the usual month, both comparisons and money in · spent · kept', () => {
    const shown = texts(render());
    expect(shown).toEqual(
      expect.arrayContaining([
        'Spent in October',
        '₹53,420',
        'Usual month',
        '₹53,770',
        '12% above usual so far',
        '₹4,210 less than September',
        'Money in',
        '₹95,000',
        'Kept',
        '₹41,580',
      ])
    );
    expect(shown).toContain('The tick is where a usual month would be by today');
  });

  it('calls a small difference "about usual", and shows a negative kept in red with a minus', () => {
    const tree = render({ vsUsual: { pct: -3, soFar: false }, incomeMinor: 5000000 });
    const shown = texts(tree);
    expect(shown).toContain('About usual');
    expect(shown).toContain('−₹3,420');
  });

  it('leaves out the usual figure, pace bar and comparisons when there is nothing to compare', () => {
    const shown = texts(
      render({
        baselineMinor: null,
        vsUsual: null,
        previousMinor: null,
        monthProgress: null,
        periodLabel: '2026',
      })
    );
    expect(shown).toContain('Spent in 2026');
    expect(shown).not.toContain('Usual month');
    expect(shown.some((t) => t.includes('than'))).toBe(false);
    expect(shown).not.toContain('The tick is where a usual month would be by today');
  });
});
