/**
 * Plan's progress bars are the shared GrowFill, as on Budgets, Goals and Loans: a bar shows its value at once, and
 * after something changes (an expense added, an EMI paid) it glides from what it showed to the new value.
 */
import { act, create } from 'react-test-renderer';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const mockTiming = jest.fn((target: number) => target);
jest.mock('react-native-reanimated', () => ({
  ...require('@/test-support/reanimatedMock').createReanimatedMock(),
  withTiming: (target: number) => mockTiming(target),
}));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('@expo/vector-icons/Feather', () => () => null);

import { PlanSummaryRow } from './PlanSummaryRow';

beforeEach(() => mockTiming.mockClear());

const row = (progress: number, animKey: string) => (
  <PlanSummaryRow
    name="Food"
    subtitle={`${progress}% used`}
    amount="₹100"
    icon="food"
    progress={progress}
    animKey={animKey}
    color="#123456"
    accessibilityLabel="Food"
    onPress={jest.fn()}
  />
);

it('shows a bar at its value on first showing, and glides to a new value after a real change', () => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(row(40, 'plan:test:glide'));
  });
  expect(mockTiming).not.toHaveBeenCalled();
  act(() => tree.update(row(40, 'plan:test:glide')));
  expect(mockTiming).not.toHaveBeenCalled();
  act(() => tree.update(row(65, 'plan:test:glide')));
  expect(mockTiming).toHaveBeenCalledTimes(1);
  expect(mockTiming).toHaveBeenCalledWith(65);
  act(() => tree.unmount());
});

it('keeps a bar from a screen visit ago: coming back to a changed value glides from what it showed', () => {
  let first!: ReturnType<typeof create>;
  act(() => {
    first = create(row(30, 'plan:test:revisit'));
  });
  act(() => first.unmount());
  let back!: ReturnType<typeof create>;
  act(() => {
    back = create(row(55, 'plan:test:revisit'));
  });
  expect(mockTiming).toHaveBeenCalledWith(55);
  act(() => back.unmount());
});

it('draws no progress bar on Plan as a plain view with a percent width', () => {
  const dir = __dirname;
  const plain = readdirSync(dir)
    .filter((f) => /\.tsx$/.test(f) && !/\.test\./.test(f))
    .filter((f) => /width:\s*`\$\{[^}]*\}%`/.test(readFileSync(join(dir, f), 'utf8')));
  expect(plain).toEqual([]);
});
