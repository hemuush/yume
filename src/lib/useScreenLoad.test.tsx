import { create, act } from 'react-test-renderer';

let mockFocus: () => void;
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    mockFocus = callback;
  },
}));

import { useScreenLoad } from './useScreenLoad';
import { bumpDataVersion, trackDataVersion } from '@/db/dataVersion';

function setup(loadFn: () => Promise<void>) {
  let latest!: ReturnType<typeof useScreenLoad>;
  function Probe() {
    latest = useScreenLoad(loadFn);
    return null;
  }
  act(() => {
    create(<Probe />);
  });
  return () => latest;
}

describe('useScreenLoad', () => {
  it('skips unchanged focus reads, invalidates after writes, and records manual reloads', async () => {
    trackDataVersion();
    const load = jest.fn().mockResolvedValue(undefined);
    const get = setup(load);
    await act(async () => {
      mockFocus();
    });
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => {
      mockFocus();
    });
    expect(load).toHaveBeenCalledTimes(1);
    bumpDataVersion();
    await act(async () => {
      mockFocus();
    });
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => {
      await get().reload();
    });
    expect(load).toHaveBeenCalledTimes(3);
    await act(async () => {
      mockFocus();
    });
    expect(load).toHaveBeenCalledTimes(3);
  });
  it('distinguishes an initial failure from usable data and retains data after a refresh fails', async () => {
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('refresh failed'));
    const get = setup(load);
    await act(async () => {
      await get().reload();
    });
    expect(get().loaded).toBe(true);
    expect(get().hasData).toBe(false);
    await act(async () => {
      await get().reload();
    });
    expect(get().hasData).toBe(true);
    await act(async () => {
      await get().reload();
    });
    expect(get().hasData).toBe(true);
    expect(get().loadError).toBe('refresh failed');
  });
  it('lets a newer load win over a slower, older one that fails', async () => {
    let rejectFirst!: (e: Error) => void;
    const calls = [() => new Promise<void>((_, reject) => (rejectFirst = reject)), () => Promise.resolve()];
    let n = 0;
    const get = setup(() => calls[n++]());

    let first!: Promise<void>;
    act(() => {
      first = get().reload();
    });
    await act(async () => {
      await get().reload();
    });
    expect(get().loadError).toBeNull();
    expect(get().loaded).toBe(true);

    await act(async () => {
      rejectFirst(new Error('old failure'));
      await first;
    });
    expect(get().loadError).toBeNull();
  });

  it('reports the error from the latest load', async () => {
    const get = setup(() => Promise.reject(new Error('boom')));
    await act(async () => {
      await get().reload();
    });
    expect(get().loadError).toBe('boom');
    expect(get().loaded).toBe(true);
  });
});
