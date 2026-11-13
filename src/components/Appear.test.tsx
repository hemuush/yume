/** A block that comes and goes fades in, fades out and slides when its place moves, on the shared presets. */
import { View, Text } from 'react-native';
import { create, act } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { CONTENT_ENTER, ROW_EXIT, ROW_LAYOUT } from '@/lib/animation';
import { Appear } from './Appear';

it('enters on the content fade, leaves on the row exit and moves on the row layout transition', () => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <Appear style={{ marginBottom: 8 }} accessibilityLiveRegion="polite">
        <Text>Couldn’t load</Text>
      </Appear>
    );
  });
  const view = tree.root.findByType(View);
  expect(view.props.entering).toBe(CONTENT_ENTER);
  expect(view.props.exiting).toBe(ROW_EXIT);
  expect(view.props.layout).toBe(ROW_LAYOUT);
  expect(view.props.style).toEqual({ marginBottom: 8 });
  expect(view.props.accessibilityLiveRegion).toBe('polite');
  act(() => tree.unmount());
});
