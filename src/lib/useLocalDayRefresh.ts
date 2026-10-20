import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { toLocalIsoDate } from './date';

/** Next local midnight, including 23/25-hour daylight-saving days. */
export function millisecondsToNextDay(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 50;
}

/** One timer for the visible screen; backgrounding suspends it and resume checks the local day. */
export function useLocalDayRefresh(onChange: () => void, refreshOnForeground = false) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  }, [onChange]);
  useFocusEffect(
    useCallback(() => {
      let day = toLocalIsoDate(new Date());
      let timer: ReturnType<typeof setTimeout> | undefined;
      let active = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
      const schedule = () => {
        clearTimeout(timer);
        if (active) timer = setTimeout(check, millisecondsToNextDay());
      };
      const check = (force = false) => {
        const next = toLocalIsoDate(new Date());
        if (next !== day || force) {
          day = next;
          latest.current();
        }
        schedule();
      };
      schedule();
      const subscription = AppState.addEventListener('change', (state) => {
        active = state === 'active';
        if (active) check(refreshOnForeground);
        else clearTimeout(timer);
      });
      return () => {
        clearTimeout(timer);
        subscription.remove();
      };
    }, [refreshOnForeground])
  );
}
