import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { useStacked } from './useStacked';

const at = (width: number, fontScale: number) => {
  const spy = jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width, height: 800, fontScale, scale: 1 });
  let seen: boolean | undefined;
  const Probe = () => {
    seen = useStacked();
    return null;
  };
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(createElement(Probe));
  });
  act(() => tree.unmount());
  spy.mockRestore();
  return seen;
};

it.each([
  [390, 1, false],
  [360, 1.2, false],
  [359, 1, true],
  [390, 1.21, true],
  [320, 2, true],
])('at %i dp and text scale %s, stacked is %s', (width, fontScale, expected) => {
  expect(at(width, fontScale)).toBe(expected);
});
