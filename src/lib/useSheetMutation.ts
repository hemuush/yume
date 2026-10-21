import { useEffect, useRef, useState } from 'react';
import { errorMessage } from './errorMessage';
import { Keyboard } from 'react-native';

/** One keyed sheet session: write once, distinguish refresh errors, ignore late UI callbacks. */
export function useSheetMutation() {
  const active = useRef(true);
  const running = useRef(false);
  const committed = useRef(false);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const run = async <T>(write: () => Promise<T>, refresh: (result: T) => void | Promise<void>) => {
    if (!active.current || running.current || committed.current) return;
    running.current = true;
    Keyboard.dismiss();
    setPending(true);
    setError(null);
    let result: T;
    try {
      result = await write();
    } catch (e) {
      running.current = false;
      if (active.current) {
        setPending(false);
        setError(errorMessage(e));
      }
      return;
    }
    committed.current = true;
    if (!active.current) return;
    setSaved(true);
    try {
      await refresh(result);
    } catch {
      if (active.current)
        setError('Your change was saved, but the screen could not refresh. Close and reopen to see it.');
    } finally {
      running.current = false;
      if (active.current) setPending(false);
    }
  };
  return { run, pending, saved, error, setError };
}
