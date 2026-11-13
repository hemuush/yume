/** Placeholders show as they are; the arrived content is a new view that fades in once. */
import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { create, act } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { CONTENT_ENTER } from '@/lib/animation';
import { LoadFade } from './LoadFade';

let mounts = 0;
function Probe({ label }: { label: string }) {
  useEffect(() => {
    mounts += 1;
  }, []);
  return <Text>{label}</Text>;
}

beforeEach(() => {
  mounts = 0;
});

it('does not animate the placeholders, and fades the content in with the shared content fade', () => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <LoadFade loaded={false}>
        <Probe label="bars" />
      </LoadFade>
    );
  });
  expect(tree.root.findByType(View).props.entering).toBeUndefined();
  act(() =>
    tree.update(
      <LoadFade loaded>
        <Probe label="cards" />
      </LoadFade>
    )
  );
  expect(tree.root.findByType(View).props.entering).toBe(CONTENT_ENTER);
  expect(tree.root.findByType(Text).props.children).toBe('cards');
  act(() => tree.unmount());
});

it('mounts the content as a new view when the data arrives, so the fade plays once and not on later updates', () => {
  let tree!: ReturnType<typeof create>;
  const render = (loaded: boolean, label: string) => (
    <LoadFade loaded={loaded}>
      <Probe label={label} />
    </LoadFade>
  );
  act(() => {
    tree = create(render(false, 'bars'));
  });
  expect(mounts).toBe(1);
  act(() => tree.update(render(true, 'cards')));
  // The placeholder view was replaced: its child mounted afresh inside the new, fading view.
  expect(mounts).toBe(2);
  act(() => tree.update(render(true, 'more cards')));
  // Further updates change nothing about the view, so nothing replays.
  expect(mounts).toBe(2);
  act(() => tree.unmount());
});
