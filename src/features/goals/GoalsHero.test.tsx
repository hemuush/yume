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
    expect(shown).toEqual(expect.arrayContaining(['Saved toward goals', '₹50,000']));
    expect(shown.find((t) => t.startsWith('25%'))).toBe('25% of ₹2,00,000');
    const note = shown.find((t) => t.includes('goals') && !t.startsWith('Saved'));
    expect(note).toContain('₹3,000 a month to stay on pace');
    expect(note).toContain('2 goals');
  });

  it('leaves the pace out when no goal needs a monthly amount', () => {
    const note = texts(render({ perMonthMinor: 0, goalCount: 1 })).find(
      (t) => t.includes('goal') && !t.startsWith('Saved')
    );
    expect(note).toBe('1 goal');
  });

  it('withholds the figures, the share and the pace with amounts hidden', () => {
    mockHide = true;
    const shown = texts(render());
    expect(shown).toContain('Saved toward goals');
    expect(shown.some((t) => t.includes('••••'))).toBe(true);
    expect(shown.some((t) => t.includes('25%'))).toBe(false);
    expect(shown).not.toContain('₹50,000');
    expect(shown.some((t) => t.includes('a month'))).toBe(false);
  });
});
