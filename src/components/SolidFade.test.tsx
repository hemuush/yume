/** A solid fade never rebuilds what is inside it when the caller's motion settings change later. */
import { useEffect } from 'react';
import { Text } from 'react-native';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => false }));

import { SolidFade } from './SolidFade';

let mounts = 0;
function Probe() {
  useEffect(() => {
    mounts += 1;
  }, []);
  return <Text>Month card</Text>;
}

it('keeps its children mounted when it stops asking to rise (Home after its opening)', () => {
  mounts = 0;
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <SolidFade rise={18} delay={60}>
        <Probe />
      </SolidFade>
    );
  });
  // Home's later redraws pass no rise: the card must stay as it is, not be built again.
  act(() =>
    tree.update(
      <SolidFade>
        <Probe />
      </SolidFade>
    )
  );
  expect(mounts).toBe(1);
  act(() => tree.unmount());
});
