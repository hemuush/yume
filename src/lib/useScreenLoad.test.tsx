import { create, act } from 'react-test-renderer';

jest.mock('expo-router', () => ({ useFocusEffect: () => {} }));

import { useScreenLoad } from './useScreenLoad';

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
