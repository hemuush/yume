/**
 * Going to a screen without stacking a second copy: nothing when already
 * there, back when it's right below, back down to it when it's further down,
 * and a push otherwise.
 */
import { create, act } from 'react-test-renderer';

const mockStack = { routes: [] as { name: string; params?: object }[] };
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() },
  useNavigation: () => ({
    getState: () => ({ routes: mockStack.routes, index: mockStack.routes.length - 1 }),
  }),
}));

import { router } from 'expo-router';
import { useReturnOrPush } from './useReturnOrPush';

import { useEffect } from 'react';

let go!: ReturnType<typeof useReturnOrPush>;
function Probe({ onReady }: { onReady: (fn: ReturnType<typeof useReturnOrPush>) => void }) {
  const fn = useReturnOrPush();
  useEffect(() => onReady(fn));
  return null;
}
act(() => {
  create(
    <Probe
      onReady={(fn) => {
        go = fn;
      }}
    />
  );
});

const food = { name: 'category/[id]', params: { id: 'food' } };

beforeEach(() => jest.clearAllMocks());

describe('useReturnOrPush', () => {
  it('does nothing when that screen is the one showing', () => {
    mockStack.routes = [{ name: '(tabs)' }, { name: 'category/[id]', params: { id: 'food' } }];
    expect(go(food, '/category/food')).toBe('here');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('goes back when it is right below', () => {
    mockStack.routes = [{ name: 'budgets' }, { name: 'category/[id]', params: { id: 'food' } }];
    expect(go({ name: 'budgets' }, '/budgets')).toBe('back');
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('goes back down to it when it is further down', () => {
    mockStack.routes = [
      { name: 'budgets' },
      { name: 'category/[id]', params: { id: 'food' } },
      { name: 'whatif' },
    ];
    expect(go({ name: 'budgets' }, '/budgets')).toBe('back');
    expect(router.dismissTo).toHaveBeenCalledWith('/budgets');
  });

  it('pushes a different category, or a screen not open yet', () => {
    mockStack.routes = [{ name: 'budgets' }, { name: 'category/[id]', params: { id: 'food' } }];
    expect(go({ name: 'category/[id]', params: { id: 'rent' } }, '/category/rent')).toBe('push');
    mockStack.routes = [{ name: '(tabs)' }];
    expect(go({ name: 'budgets' }, '/budgets')).toBe('push');
    expect(router.push).toHaveBeenCalledTimes(2);
  });
});
