import { create, act } from 'react-test-renderer';
import { PanResponder } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));

import { useSwipeDrag } from './useSwipeDrag';
import { haptics } from '@/lib/haptics';

type Config = Parameters<typeof PanResponder.create>[0];
const g = (dx: number, dy = 0) => ({ dx, dy }) as never;
const e = {} as never;

function mount(onStep: jest.Mock, canStepForward: boolean) {
  let config!: Config;
  jest.spyOn(PanResponder, 'create').mockImplementation((c) => {
    config = c;
    return { panHandlers: {} };
  });
  function Probe() {
    useSwipeDrag(onStep, canStepForward);
    return null;
  }
  act(() => {
    create(<Probe />);
  });
  return config;
}

describe('useSwipeDrag', () => {
  beforeEach(() => jest.clearAllMocks());

  it('takes over mostly-horizontal drags and leaves vertical ones to the list', () => {
    const c = mount(jest.fn(), true);
    expect(c.onMoveShouldSetPanResponder?.(e, g(30, 4))).toBe(true);
    expect(c.onMoveShouldSetPanResponder?.(e, g(30, 28))).toBe(false);
    expect(c.onMoveShouldSetPanResponder?.(e, g(6, 0))).toBe(false);
  });

  it('steps back on a long drag right and forward on a long drag left', () => {
    const onStep = jest.fn();
    const c = mount(onStep, true);
    c.onPanResponderRelease?.(e, g(80));
    expect(onStep).toHaveBeenLastCalledWith(-1);
    c.onPanResponderRelease?.(e, g(-80));
    expect(onStep).toHaveBeenLastCalledWith(1);
    expect(onStep).toHaveBeenCalledTimes(2);
  });

  it('does not step on a short drag', () => {
    const onStep = jest.fn();
    mount(onStep, true).onPanResponderRelease?.(e, g(30));
    expect(onStep).not.toHaveBeenCalled();
  });

  it('bounces off the current period instead of stepping forward', () => {
    const onStep = jest.fn();
    const c = mount(onStep, false);
    c.onPanResponderRelease?.(e, g(-90));
    expect(onStep).not.toHaveBeenCalled();
    expect(haptics.tap).toHaveBeenCalledTimes(1);
    c.onPanResponderRelease?.(e, g(90));
    expect(onStep).toHaveBeenCalledWith(-1);
  });
});
