/** Section: its title is a heading for screen readers, and "See all" names what it opens. */
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Section } from './Section';

it('marks the title as a heading so a screen reader can jump between sections', () => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <Section
        title="This week"
        subtitle="₹6,804 spent in 7 days"
        onSeeAll={jest.fn()}
        actionLabel="Insights"
      >
        <Text>body</Text>
      </Section>
    );
  });
  const heading = r.root.find((n) => n.props.accessibilityRole === 'header');
  expect([heading.props.children].flat().join('')).toBe('This week');
  const action = r.root.find((n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel);
  expect(action.props.accessibilityLabel).toBe('Insights — This week');
  act(() => r.unmount());
});
