/** The colour dot and the title of a group on Friends & family read as one label. */
import { StyleSheet, ViewStyle } from 'react-native';
import { styles } from './people.styles';

it('keeps the dot and the group title together at the start of the heading, not at opposite edges', () => {
  const head = StyleSheet.flatten(styles.groupHead) as ViewStyle;
  // space-between with two children put the dot at the left edge and "Owes you" at the right one.
  expect(head.justifyContent).not.toBe('space-between');
  expect(head.justifyContent).toBe('flex-start');
  expect(head.alignItems).toBe('center');
});
