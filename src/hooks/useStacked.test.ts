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
  ['early', 379, 1, true],
  ['early', 380, 1, false],
  ['early', 380, 1.15, false],
  ['early', 390, 1.16, true],
  ['early', 400, 1, false],
  ['late', 340, 1.3, false],
  ['late', 339, 1, true],
  ['late', 360, 1.31, true],
  ['late', 360, 1.25, false],
] as const)('the %s cut-offs at %i dp and text scale %s: stacked is %s', (at, width, fontScale, expected) => {
  const spy = jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width, height: 800, fontScale, scale: 1 });
  let seen: boolean | undefined;
  const Probe = () => {
    seen = useStacked(at);
    return null;
  };
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(createElement(Probe));
  });
  act(() => tree.unmount());
  spy.mockRestore();
  expect(seen).toBe(expected);
});

it.each([
  [390, 1, false],
  [360, 1.2, false],
  [359, 1, true],
  [390, 1.21, true],
  [320, 2, true],
])('at %i dp and text scale %s, stacked is %s', (width, fontScale, expected) => {
  expect(at(width, fontScale)).toBe(expected);
});
