import { Animated, Text } from 'react-native';
import { act, create } from 'react-test-renderer';
let mockReduce = false;
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => mockReduce }));
jest.mock('@expo/vector-icons/Feather', () => () => null);
import { CompletionCard } from './CompletionCard';
import { GoalLetterReveal } from '@/features/goals/GoalLetterReveal';

afterEach(() => {
  jest.restoreAllMocks();
  mockReduce = false;
});
it('uses one native fade and cancels it when reduced motion is enabled', () => {
  const stop = jest.fn();
  const timing = jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<CompletionCard title="Loan closed" detail="No installments remain." />);
  });
  expect(timing).toHaveBeenCalledTimes(1);
  expect(timing).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ duration: 180, useNativeDriver: true })
  );
  mockReduce = true;
  act(() => {
    tree.update(<CompletionCard title="Loan closed" detail="No installments remain." />);
  });
  expect(stop).toHaveBeenCalled();
  expect(timing).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
it('keeps the goal name, funded target and the full sealed note readable without animation', () => {
  mockReduce = true;
  const timing = jest.spyOn(Animated, 'timing');
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<GoalLetterReveal goalName="Trip" targetAmountMinor={100000} note="You kept going." />);
  });
  const copy = tree.root
    .findAllByType(Text)
    .map((n) => n.props.children)
    .flat(Infinity)
    .join(' ');
  expect(copy).toContain('Goal reached');
  expect(copy).toContain('Trip reached its ₹1,000 target.');
  expect(copy).toContain('You kept going.');
  expect(timing).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
