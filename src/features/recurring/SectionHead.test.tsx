/** A heading on Recurring brings the screen gutter itself, so it lines up with the cards under it. */
import { StyleSheet } from 'react-native';
import { create, act } from 'react-test-renderer';
import { SCREEN } from '@/components/screenStyles';
import { SectionHead } from './SectionHead';

it('sits on the screen gutter, the same edge as the cards below it', () => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<SectionHead title="Running" note="Biggest first" />);
  });
  const head = tree.root.findAll((n) => typeof n.type === 'string' && n.props.style)[0];
  expect(StyleSheet.flatten(head.props.style).marginHorizontal).toBe(SCREEN.gutter);
  act(() => tree.unmount());
});
