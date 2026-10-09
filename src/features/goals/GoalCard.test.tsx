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
  it('shows what is left and the saved share', () => {
    const t = texts(render(goal())).join(' | ');
    expect(t).toContain('to go');
    // The share is a big figure with a smaller % beside it.
    expect(t).toMatch(/(^| )81[^0-9]/);
    expect(t).toContain(' % ');
    expect(t).toContain('Add money');
  });

  it('shows no month plan for a goal with no date', () => {
    const t = texts(render(goal({ targetDate: null }))).join(' | ');
    expect(t).toContain('No target date');
    expect(t).not.toContain('a month');
  });

  it('says a goal is past its date', () => {
    const t = texts(render(goal({ targetDate: '2026-01-31' }))).join(' | ');
    expect(t).toContain('Past its target date');
    expect(t).toContain('Behind');
  });

  it('fills the card to the saved share', () => {
    const fills = (tree: ReturnType<typeof render>) =>
      tree.root.findAll(
        (n) =>
          typeof n.type === 'string' &&
          [].concat(n.props.style ?? []).some((x: { height?: string }) => x?.height === '81%')
      );
    expect(fills(render(goal())).length).toBeGreaterThan(0);
  });

  it('offers no way to add money to an archived goal', () => {
    expect(texts(render(goal({ archived: true }))).join(' | ')).not.toContain('Add money');
  });

  it('calls the goal reached once the target is met', () => {
    const t = texts(render(goal({ currentAmountMinor: 20000000 }))).join(' | ');
    expect(t).toContain('Reached');
    expect(t).not.toContain('to go');
  });
});
