/** Home's Coming up on screen: one ranked list, filter chips, hidden amounts, and the way on to each page. */
import { Text, View, StyleSheet } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8FCBFF', secondary: '#8FE8C8', dot: '#F0876A' }),
}));

import { HomeComingUp } from './HomeComingUp';
import type { UpcomingItem } from './upcomingItems';
import type { BudgetProgress } from '@/db/budgets';
import type { SavingsGoal } from '@/types';
import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';

const today = toLocalIsoDate(new Date());
const inDays = (n: number) => addDaysToIsoDate(today, n);

const payment = (key: string, days: number): UpcomingItem => ({
  key,
  icon: 'calendar',
  iconBg: '#fff',
  title: key,
  subtitle: 'Due soon',
  amountMinor: 450000,
  sign: '-',
  sortDate: inDays(days),
  route: '/recurring',
  urgent: days <= 0,
  payable: false,
  pinned: days <= 3,
});
const budget = (id: string, percentUsed: number): BudgetProgress =>
  ({
    budget: {
      id,
      categoryId: id,
      periodMonth: today.slice(0, 7),
      limitAmountMinor: 1000000,
      rollover: false,
    },
    categoryName: `Cat ${id}`,
    categoryIcon: 'tag',
    categoryColor: '#8FCBFF',
    spentMinor: percentUsed * 10000,
    effectiveLimitMinor: 1000000,
    remainingMinor: 1000000 - percentUsed * 10000,
    percentUsed,
    overBudget: percentUsed > 100,
  }) as BudgetProgress;
const goal = (id: string, current: number): SavingsGoal =>
  ({
    id,
    name: `Goal ${id}`,
    targetAmountMinor: 10000000,
    currentAmountMinor: current,
    targetDate: inDays(90),
    linkedAccountId: null,
    tracksAccount: false,
    noteToSelf: null,
    letterRevealed: false,
    archived: false,
    createdAt: `${inDays(-30)} 10:00:00`,
  }) as SavingsGoal;

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) =>
    [t.props.children]
      .flat(Infinity)
      .filter((c) => typeof c === 'string')
      .join('')
  );
const press = (r: ReactTestRenderer, label: string) =>
  act(() => r.root.find((n) => n.props.onPress && n.props.accessibilityLabel === label).props.onPress());

const base = {
  upcoming: { items: [payment('Rent', 2)], next: null },
  budgets: [budget('b1', 130)],
  goals: [goal('g1', 1000000)],
  today,
  rowEntering: () => undefined,
  onSeeAll: jest.fn(),
};
function render(over: Partial<React.ComponentProps<typeof HomeComingUp>> = {}) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<HomeComingUp {...base} {...over} />);
  });
  return r;
}
afterEach(() => {
  mockHide = false;
  jest.clearAllMocks();
});

it('lists a budget over its limit ahead of a bill due in two days, then the goal', () => {
  const r = render();
  const rows = texts(r);
  expect(rows.indexOf('Cat b1 budget')).toBeGreaterThanOrEqual(0);
  expect(rows.indexOf('Cat b1 budget')).toBeLessThan(rows.indexOf('Rent'));
  expect(rows.indexOf('Rent')).toBeLessThan(rows.indexOf('Goal g1'));
  expect(rows).toContain('₹3,000 over its limit');
  act(() => r.unmount());
});

it('narrows to one kind from a chip and points the header link at that kind’s page', () => {
  const onSeeAll = jest.fn();
  const r = render({ onSeeAll });
  press(r, 'Budgets, needs a look');
  expect(texts(r)).toContain('Cat b1 budget');
  expect(texts(r)).not.toContain('Rent');
  expect(texts(r)).toContain('All budgets');
  press(r, 'All budgets — Coming up');
  expect(onSeeAll).toHaveBeenLastCalledWith('budget');
  press(r, 'Goals, needs a look');
  expect(texts(r)).toContain('All goals');
  press(r, 'All');
  expect(texts(r)).toContain('View plan');
  act(() => r.unmount());
});

it('shows no chips when there is only one kind, and falls back to everything if a filter empties', () => {
  const only = render({ budgets: [], goals: [] });
  expect(only.root.findAll((n) => n.props.accessibilityLabel === 'Filter coming up')).toHaveLength(0);
  act(() => only.unmount());

  const r = render();
  press(r, 'Budgets, needs a look');
  act(() => r.update(<HomeComingUp {...base} budgets={[]} />));
  expect(texts(r)).toContain('Rent');
  act(() => r.unmount());
});

it('hides goal amounts, and says so, while amounts are hidden', () => {
  mockHide = true;
  const r = render({ budgets: [], upcoming: { items: [], next: null } });
  expect(texts(r)).toContain('Amounts hidden');
  expect(texts(r).join(' ')).not.toMatch(/to go|\d{2,}/);
  act(() => r.unmount());
});

it('says when nothing is coming up and still opens Plan', () => {
  const onSeeAll = jest.fn();
  const r = render({ upcoming: { items: [], next: null }, budgets: [], goals: [], onSeeAll });
  expect(texts(r)).toContain('Nothing coming up');
  press(r, 'Nothing coming up. Open Plan');
  expect(onSeeAll).toHaveBeenCalledWith('all');
  act(() => r.unmount());
});

describe('filter chips do not change size when they are used', () => {
  const chip = (r: ReactTestRenderer, label: string) =>
    r.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
  const flat = (style: unknown) =>
    StyleSheet.flatten(
      typeof style === 'function' ? (style as (s: object) => never)({ pressed: false }) : (style as never)
    ) ?? {};

  it('gives each chip a 44 dp touch area though it is drawn 36 tall', () => {
    const r = render();
    const node = chip(r, 'All');
    const drawn = flat(node.props.style).minHeight as number;
    const slop = node.props.hitSlop as { top: number; bottom: number };
    expect(drawn + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
    act(() => r.unmount());
  });

  it('draws the needs-a-look dot as a corner badge that takes no room in the row', () => {
    const r = render();
    const dots = chip(r, 'Budgets, needs a look')
      .findAllByType(View)
      .filter((n) => n.props.style && flat(n.props.style).width === 7 && flat(n.props.style).height === 7)
      .map((n) => flat(n.props.style));
    expect(dots).toHaveLength(1);
    // In the row it would make this chip wider than the others and narrower again once picked, moving every
    // chip after it under the finger.
    expect(dots[0].position).toBe('absolute');
    act(() => r.unmount());
  });

  it('writes a picked chip and an unpicked one in the same weight, so picking one moves none of the others', () => {
    const r = render();
    const weight = (label: string) => flat(chip(r, label).findByType(Text).props.style).fontFamily;
    const sizeOf = (label: string) => {
      const style = flat(chip(r, label).props.style);
      return [style.paddingHorizontal, style.minHeight];
    };
    expect(weight('All')).toBe(weight('Budgets, needs a look'));
    expect(sizeOf('All')).toEqual(sizeOf('Budgets, needs a look'));
    press(r, 'Budgets, needs a look');
    expect(weight('Budgets, needs a look')).toBe(weight('All'));
    act(() => r.unmount());
  });
});
