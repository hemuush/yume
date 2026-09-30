/**
 * Home's goal chip while "hide savings & investment amounts" is on: the saved
 * amount and the progress ring are withheld (the ring would give the amount
 * away as a percentage), and only the target stays readable. Made-up figures.
 */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

let mockHideAmounts = false;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHideAmounts, toggleHideAmounts: jest.fn() }),
}));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.useFakeTimers();

import { GoalChip } from './GoalChip';
import { GoalRing } from './GoalRing';
import type { SavingsGoal } from '@/types';

const goal: SavingsGoal = {
  id: 'g1',
  name: 'Goa Trip',
  targetAmountMinor: 4_000_000,
  currentAmountMinor: 2_500_000,
  targetDate: null,
  linkedAccountId: null,
  tracksAccount: false,
  noteToSelf: null,
  letterRevealed: false,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const text = (r: ReactTestRenderer) =>
  r.root
    .findAllByType(Text)
    .map((t) =>
      [t.props.children]
        .flat(Infinity)
        .filter((c) => typeof c === 'string' || typeof c === 'number')
        .join('')
    )
    .join(' ');

function render() {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<GoalChip goal={goal} onPress={() => {}} />);
  });
  return r;
}

describe('GoalChip privacy', () => {
  afterEach(() => {
    mockHideAmounts = false;
  });

  it('shows the saved amount and the progress ring normally', () => {
    const r = render();
    expect(text(r)).toContain('25,000');
    expect(r.root.findAllByType(GoalRing)).toHaveLength(1);
  });

  it('masks the saved amount, drops the ring and keeps the target while hidden', () => {
    mockHideAmounts = true;
    const r = render();
    const shown = text(r);
    expect(shown).toContain('••••');
    expect(shown).toContain('40,000');
    expect(shown).not.toContain('25,000');
    expect(r.root.findAllByType(GoalRing)).toHaveLength(0);
    const label = r.root.find((n) => typeof n.props.accessibilityLabel === 'string').props
      .accessibilityLabel as string;
    expect(label).not.toContain('25,000');
    expect(label).not.toMatch(/\d+ percent/);
  });
});
