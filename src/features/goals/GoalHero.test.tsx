import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));

import { GoalHero } from './GoalHero';

it('keeps the target date whole when the line under the bar wraps', () => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <GoalHero
        hue="#8FCBFF"
        icon="piggy-bank"
        name="Goa trip"
        kicker="Savings goal"
        saved="₹45,000"
        fraction={0.9}
        toGo={{ figure: '₹5,000' }}
        date="Mar 13, 2027"
      />
    );
  });
  const line = tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat(Infinity).join(''))
    .find((t) => t.includes('Mar'))!;
  // No ordinary space inside "by Mar 13, 2027": a wrap can fall before "by", never inside the date.
  expect(line).toContain('by Mar 13, 2027');
  act(() => tree.unmount());
});
