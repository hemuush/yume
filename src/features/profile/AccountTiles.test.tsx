import { create, act } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('@/features/investments/GainPill', () => ({ GainPill: () => null }));
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: false }) }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));

import { AccountTiles } from './AccountTiles';
import type { Account } from '@/types';

const fund = {
  id: 'fund',
  name: 'Index fund',
  type: 'savings',
  currency: 'INR',
  currentBalanceMinor: 1_720_000,
  openingBalanceMinor: 1_500_000,
  creditLimitMinor: null,
  archived: false,
  investment: { kind: 'mutual_fund', investedMinor: 1_500_000, takenOutMinor: 0, gainMinor: 220_000 },
} as unknown as Account;

describe('AccountTiles', () => {
  it('captions an investment with its kind alone, which fits a tile 150 dp wide, and speaks it in full', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<AccountTiles accounts={[fund]} onPress={jest.fn()} />);
    });
    const shown = tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
    expect(shown).toContain('Mutual fund');
    // "Investment · Mutual fund" was cut to "Investment · Mutual f…" at 360 dp.
    expect(shown).not.toContain('Investment · Mutual fund');
    const tile = tree.root.find((n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel);
    expect(tile.props.accessibilityLabel).toBe('Index fund, Investment · Mutual fund, ₹17,200');
    act(() => tree.unmount());
  });
});
