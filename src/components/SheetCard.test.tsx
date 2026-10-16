import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
import { SheetCard } from './SheetCard';
it.each([false, true])('keeps identity and useful context with compact=%s', (compact) => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SheetCard compact={compact} hue="#AABBCC" icon="bank" title="Bank" amount="₹1,234" meta="Monthly" />
    );
  });
  const text = tree.root.findAllByType(Text).map((n) => n.props.children);
  expect(text).toContain('Bank');
  expect(text).toContain('Monthly');
  expect(text.includes('₹1,234')).toBe(!compact);
  act(() => tree.unmount());
});
