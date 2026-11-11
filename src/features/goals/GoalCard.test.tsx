/** What a goal card says about the money left and the pace to finish. All figures are made up. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: false, toggleHideAmounts: jest.fn() }),
}));

import { GoalCard } from './GoalCard';
import { SavingsGoal } from '@/types';

afterAll(() => new Promise((resolve) => setTimeout(resolve, 800)));

const goal = (over: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: 'g1',
  name: 'Rainy day',
  targetAmountMinor: 20000000,
  currentAmountMinor: 16200000,
  targetDate: '2999-12-31',
  linkedAccountId: null,
  tracksAccount: false,
  noteToSelf: null,
  letterRevealed: false,
  archived: false,
  createdAt: '2026-01-01 00:00:00',
  ...over,
});

function render(g: SavingsGoal): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<GoalCard goal={g} onPress={jest.fn()} onContribute={jest.fn()} />);
  });
  return r;
}

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));

describe('GoalCard', () => {
  it('shows what is saved of the target, the share and the pace', () => {
    const t = texts(render(goal())).join(' | ');
    expect(t).toContain('/ ₹2,00,000');
    expect(t).toContain('81% · By 31 Dec 2999');
    expect(t).toContain('/mo');
    expect(t).not.toContain('to go');
  });

  it('shows no month plan for a goal with no date', () => {
    const t = texts(render(goal({ targetDate: null }))).join(' | ');
    expect(t).toContain('No target date');
    expect(t).not.toContain('/mo');
  });

  it('says a goal is past its date', () => {
    const t = texts(render(goal({ targetDate: '2026-01-31' }))).join(' | ');
    expect(t).toContain('Past its target date');
    expect(t).toContain('Behind');
  });

  it('fills the compact progress bar to the saved share', () => {
    const fills = (tree: ReturnType<typeof render>) =>
      tree.root.findAll(
        (n) =>
          typeof n.type === 'string' &&
          [].concat(n.props.style ?? []).some((x: { width?: string }) => x?.width === '81%')
      );
    expect(fills(render(goal())).length).toBeGreaterThan(0);
  });

  it('has a button to add money, and none on an archived goal', () => {
    const labels = (r: ReactTestRenderer) =>
      r.root.findAll((n) => n.props.accessibilityLabel === 'Add money to Rainy day');
    expect(labels(render(goal())).length).toBeGreaterThan(0);
    expect(labels(render(goal({ archived: true }))).length).toBe(0);
  });

  it('calls the goal reached once the target is met', () => {
    const t = texts(render(goal({ currentAmountMinor: 20000000 }))).join(' | ');
    expect(t).toContain('Reached');
    expect(t).not.toContain('to go');
  });
});
