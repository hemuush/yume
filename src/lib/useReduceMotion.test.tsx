import { act, create } from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

it('shares one native subscription and does not replace a live preference with an older initial read', async () => {
  let resolve!: (value: boolean) => void;
  let changed!: (value: boolean) => void;
  const read = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(
    () =>
      new Promise<boolean>((done) => {
        resolve = done;
      })
  );
  const listen = jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, callback) => {
    changed = callback as unknown as (value: boolean) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;
  });
  const values: boolean[] = [];
  function Probe({ index }: { index: number }) {
    values[index] = useReduceMotion();
    return null;
  }
  try {
    act(() => {
      create(
        <>
          <Probe index={0} />
          <Probe index={1} />
        </>
      );
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledTimes(1);
    act(() => changed(true));
    expect(values).toEqual([true, true]);
    await act(async () => {
      resolve(false);
    });
    expect(values).toEqual([true, true]);
    act(() => changed(false));
    expect(values).toEqual([false, false]);
  } finally {
    read.mockRestore();
    listen.mockRestore();
  }
});
