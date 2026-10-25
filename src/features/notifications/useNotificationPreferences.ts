import { useCallback, useEffect, useRef, useState } from 'react';
import { getNotificationPrefs, updateNotificationPrefs, type NotificationPrefs } from '@/db/settings';
import { rebuildNotifications } from '@/lib/notifications';
import { onSettingsRestored } from '@/lib/dataEvents';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';

/** Optimistic choices are ordered patches: a failed earlier save cannot roll back or leak into a later one. */
export function useNotificationPreferences(onScheduled: (success: boolean) => Promise<void>) {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const committed = useRef<NotificationPrefs | null>(null);
  const pending = useRef<{ patch: Partial<NotificationPrefs> }[]>([]);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const generation = useRef(0);
  const loadRequest = useRef(0);
  const mounted = useRef(true);

  const publish = useCallback(() => {
    if (mounted.current && committed.current)
      setPrefs(pending.current.reduce((base, change) => ({ ...base, ...change.patch }), committed.current));
  }, []);

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    try {
      await chain.current;
      const saved = await getNotificationPrefs();
      if (!mounted.current || request !== loadRequest.current) return;
      committed.current = saved;
      setLoadError(null);
      publish();
    } catch (e) {
      if (mounted.current && request === loadRequest.current) setLoadError(errorMessage(e));
    }
  }, [publish]);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = onSettingsRestored(() => {
      generation.current++;
      pending.current = [];
      void load();
    });
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [load]);

  const save = useCallback(
    (patch: Partial<NotificationPrefs>): Promise<void> => {
      if (!committed.current) return Promise.resolve();
      const change = { patch };
      const epoch = generation.current;
      ++loadRequest.current;
      pending.current.push(change);
      publish();
      const run = chain.current.then(async () => {
        if (epoch !== generation.current) return;
        let saved = false;
        try {
          const updated = await updateNotificationPrefs(patch);
          if (epoch !== generation.current) return;
          committed.current = updated;
          saved = true;
        } catch (e) {
          if (mounted.current && epoch === generation.current) showAlert("Couldn't save", errorMessage(e));
        } finally {
          pending.current = pending.current.filter((item) => item !== change);
          publish();
        }
        if (!saved) return;
        const rebuilt = await rebuildNotifications();
        if (!mounted.current || epoch !== generation.current) return;
        if (!rebuilt)
          showAlert(
            'Saved, but reminders may not fire',
            'Check phone permission and the Yume reminders category, then rebuild reminders.'
          );
        await onScheduled(rebuilt);
      });
      chain.current = run.catch(() => {});
      return chain.current;
    },
    [onScheduled, publish]
  );

  return { prefs, loadError, load, save };
}
