import { headerIsCollapsed } from './headerMotion';

it('only enables the compact control once visible, and holds it across small scroll reversals', () => {
  expect(headerIsCollapsed(0.89, false)).toBe(false);
  expect(headerIsCollapsed(0.9, false)).toBe(true);
  expect(headerIsCollapsed(0.89, true)).toBe(true);
  expect(headerIsCollapsed(0.76, true)).toBe(true);
  expect(headerIsCollapsed(0.75, true)).toBe(false);
  expect(headerIsCollapsed(0, true)).toBe(false);
});
