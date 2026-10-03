import { create, act } from 'react-test-renderer';
import { View } from 'react-native';
import { growHref, isGrowRoute, subscribeCardGrow, useCardGrow } from './cardGrow';

describe('growHref and isGrowRoute', () => {
  it('marks a push, with or without an existing query', () => {
    expect(growHref('/budgets')).toBe('/budgets?grow=1');
    expect(growHref('/category/a?g=month&o=0')).toBe('/category/a?g=month&o=0&grow=1');
  });

  it('reads the mark back off route params', () => {
    expect(isGrowRoute({ grow: '1' })).toBe(true);
    expect(isGrowRoute({ g: 'month' })).toBe(false);
    expect(isGrowRoute(undefined)).toBe(false);
  });
});

describe('useCardGrow', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function Probe({ go, measure }: { go: () => void; measure?: jest.Mock }) {
    const { ref, growFrom } = useCardGrow();
    return (
      <View
        ref={(node) => {
          if (node && measure) node.measureInWindow = measure;
          (ref as { current: View | null }).current = node;
        }}
        testID="card"
        onTouchEnd={() => growFrom(go)}
      />
    );
  }
  const tap = (r: ReturnType<typeof create>) =>
    act(() => {
      r.root.findByProps({ testID: 'card' }).props.onTouchEnd();
    });

  it('hands the measured rect to the host, then navigates', () => {
    const seen = jest.fn();
    const off = subscribeCardGrow(seen);
    const go = jest.fn();
    const measure = jest.fn((cb: (x: number, y: number, w: number, h: number) => void) =>
      cb(10, 20, 300, 80)
    );
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Probe go={go} measure={measure} />);
    });
    tap(r);
    expect(seen).toHaveBeenCalledWith({ x: 10, y: 20, width: 300, height: 80 });
    expect(go).toHaveBeenCalledTimes(1);
    off();
  });

  it('still navigates, without a rect, when the card measures nothing', () => {
    const seen = jest.fn();
    const off = subscribeCardGrow(seen);
    const go = jest.fn();
    const measure = jest.fn((cb: (x: number, y: number, w: number, h: number) => void) => cb(0, 0, 0, 0));
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Probe go={go} measure={measure} />);
    });
    tap(r);
    expect(seen).not.toHaveBeenCalled();
    expect(go).toHaveBeenCalledTimes(1);
    off();
  });

  it('navigates anyway if the measure never reports back', () => {
    const go = jest.fn();
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Probe go={go} measure={jest.fn()} />);
    });
    tap(r);
    expect(go).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(go).toHaveBeenCalledTimes(1);
  });
});
