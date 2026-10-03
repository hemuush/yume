/**
 * With "hide savings & investment amounts" on, a goal shows neither saved amount nor progress: masked
 * amount, empty bar, no percent, pace, monthly figure or "Reached". The target stays readable.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
let mockHideAmounts = true;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHideAmounts, toggleHideAmounts: jest.fn() }),
}));

import { GoalCard } from './GoalCard';
import { SavingsGoal } from '@/types';

afterAll(() => new Promise((resolve) => setTimeout(resolve, 800)));

const goal: SavingsGoal = {
  id: 'g1',
  name: 'Rainy day',
  targetAmountMinor: 15000000,
  currentAmountMinor: 15000000,
  targetDate: null,
  linkedAccountId: null,
  tracksAccount: false,
  noteToSelf: null,
  letterRevealed: false,
  archived: false,
  createdAt: '2026-09-01 00:00:00',
};

function render(): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<GoalCard goal={goal} onPress={jest.fn()} onContribute={jest.fn()} />);
  });
  return r;
}

const texts = (r: ReactTestRenderer) => [JSON.stringify(r.toJSON())];

describe('GoalCard while savings amounts are hidden', () => {
  it('masks the saved amount, keeps the target, and does not say the goal is reached', () => {
    mockHideAmounts = true;
    const r = render();
    const all = texts(r).join(' | ');
    expect(all).toContain('••••');
    expect(all).toContain('₹1,50,000');
    expect(all).not.toContain('Reached');
    const shown = r.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));
    expect(shown.join(' | ')).not.toMatch(/[0-9]+%/);
    expect(all).not.toContain('to go');
  });

  it('shows the real figures again once they are not hidden', () => {
    mockHideAmounts = false;
    const r = render();
    const all = texts(r).join(' | ');
    expect(all).toContain('Reached');
    expect(all).toContain('100%');
  });
});
