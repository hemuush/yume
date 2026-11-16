import { useLayoutEffect, useMemo, useRef } from 'react';
import { useStableValue } from '@/lib/stableData';

type AnyFn = (...args: never[]) => unknown;

/**
 * The Add model with what its parts hold kept the same while it is the same.
 *
 * The model is rebuilt on every render, and so is every command in it (they close over the state), so a part that held
 * one would be drawn again for every keypress. Each function in it is therefore handed out as one fixed function that
 * calls the latest one (so a tap always runs against the state as it is now), and the few lists and objects that are
 * rebuilt with the same content (the pad's colours, the account and amount lists) keep their identity until their content
 * changes.
 */
export function useStableModel<T extends object>(model: T): T {
  const latest = useRef(model);
  useLayoutEffect(() => {
    latest.current = model;
  });
  // The shape of the model never changes, so which members are commands is known from the first render.
  const commands = useMemo(
    () => {
      const fixed: Record<string, AnyFn> = {};
      for (const [key, value] of Object.entries(model)) {
        if (typeof value !== 'function') continue;
        fixed[key] = (...args: never[]) => ((latest.current as Record<string, AnyFn>)[key] as AnyFn)(...args);
      }
      return fixed;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the names of the commands are read, once
    []
  );
  const data = model as Record<string, unknown>;
  const frequentAmounts = useStableValue(data.frequentAmounts);
  const friendAccounts = useStableValue(data.friendAccounts);
  const usual = useStableValue(data.usual);
  const totals = useStableValue(data.totals);
  return { ...model, ...commands, frequentAmounts, friendAccounts, usual, totals };
}
