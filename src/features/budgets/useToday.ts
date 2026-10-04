import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { toLocalIsoDate } from '@/lib/date';

/**
 * Today's local date (YYYY-MM-DD), kept current: it turns over at midnight while the screen is open, and
 * re-reads when the app returns to the foreground (a timer can't be trusted across a suspended app).
 */
export function useToday(): string {
  const [today, setToday] = useState(() => toLocalIsoDate(new Date()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
      // A second past, so the clock has certainly crossed into the new day.
      timer = setTimeout(
        () => {
          setToday(toLocalIsoDate(new Date()));
          arm();
        },
        nextMidnight - now.getTime() + 1000
      );
    };
    arm();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(toLocalIsoDate(new Date()));
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
  return today;
}
