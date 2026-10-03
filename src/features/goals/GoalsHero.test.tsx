/** The Savings goals hero: saved, share saved, target, pace; and what is withheld with amounts hidden. All figures are made up. */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';

let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHide, toggleHideAmounts: jest.fn() }),
}));
jest.mock('@/components/GrowFill', () => ({ GrowFill: () => null }));
jest.mock('@/components/CountUpAmount', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  const { formatMoney } = jest.requireActual('@/lib/money');
  return { CountUpAmount: ({ minor }: { minor: number }) => <RNText>{formatMoney(minor)}</RNText> };
});

import { GoalsHero } from './GoalsHero';

const flat = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(flat).join('');
const texts = (tree: ReactTestRenderer) => tree.root.findAllByType(Text).map(flat);

function render(over: Partial<React.ComponentProps<typeof GoalsHero>['totals']> = {}) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <GoalsHero
        totals={{
          savedMinor: 5000000,
          targetMinor: 20000000,
          percent: 25,
          goalCount: 2,
          perMonthMinor: 300000,
          ...over,
        }}
      />
    );
  });
  return tree;
}

describe('GoalsHero', () => {
  beforeEach(() => {
    mockHide = false;
  });

  it('shows what is saved, the share saved, the target and the monthly pace', () => {
    const shown = texts(render());
    expect(shown).toEqual(expect.arrayContaining(['Saved toward goals', '₹50,000', 'Saved', '25%']));
    const sub = shown.find((t) => t.startsWith('of '));
    expect(sub).toContain('₹2,00,000');
    expect(sub).toContain('2 goals');
    expect(sub).toContain('₹3,000 a month to stay on pace');
  });

  it('leaves the pace out when no goal needs a monthly amount', () => {
    const sub = texts(render({ perMonthMinor: 0, goalCount: 1 })).find((t) => t.startsWith('of '));
    expect(sub).toContain('1 goal');
    expect(sub).not.toContain('a month');
  });

  it('withholds the figures, the share and the pace with amounts hidden', () => {
    mockHide = true;
    const shown = texts(render());
    expect(shown).toContain('Saved toward goals');
    expect(shown.some((t) => t.includes('••••'))).toBe(true);
    expect(shown).not.toContain('25%');
    expect(shown).not.toContain('₹50,000');
    expect(shown.find((t) => t.startsWith('of '))).not.toContain('a month');
  });
});
