import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { readEntryDraft, writeEntryDraft } from '@/db/entryDraft';
import { onSettingsRestored } from '@/lib/dataEvents';
import { serializeEntryDraft, type EntryDraft } from './entryDraft';

/** Autosave never posts money. A recovered draft requires an explicit Resume. */
export function useEntryDraftRecovery(draft: EntryDraft, enabled: boolean, meaningful: boolean) {
  const [candidate, setCandidate] = useState<EntryDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<EntryDraft | null>(null);
  const blocked = useRef(false);
  const hadWork = useRef(false);
  const pending = useRef(false);
  const unresolved = useRef(false);
  const readFailed = useRef(false);
  const prepared = useRef(false);
  const readRequest = useRef(0);
  const resolving = useRef(false);
  const [discarding, setDiscarding] = useState(false);
  const [retry, setRetry] = useState(0);
  const raw = serializeEntryDraft(draft);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const request = ++readRequest.current;
    void readEntryDraft().then(
      (d) => {
        if (live && request === readRequest.current && !blocked.current) {
          unresolved.current = !!d;
          setCandidate(d);
          setReady(true);
        }
      },
      () => {
        if (live && request === readRequest.current && !blocked.current) {
          readFailed.current = true;
          setError('Draft recovery unavailable. Keep this screen open until you save.');
          setReady(true);
        }
      }
    );
    return () => {
      live = false;
    };
  }, [enabled]);
  useEffect(() => {
    if (!enabled || !ready || blocked.current || readFailed.current) return;
    latest.current = meaningful ? (JSON.parse(raw).draft as EntryDraft) : null;
    if (candidate) return;
    unresolved.current = false;
    if (!meaningful && !hadWork.current) return;
    if (meaningful) hadWork.current = true;
    pending.current = true;
    const timer = setTimeout(() => {
      if (blocked.current || unresolved.current) return;
      const snapshot = latest.current;
      void writeEntryDraft(snapshot).then(
        () => {
          if (latest.current === snapshot) pending.current = false;
          setError(null);
        },
        () => setError('Couldn’t keep a draft. Your entry is still here.')
      );
    }, 650);
    return () => clearTimeout(timer);
  }, [raw, enabled, ready, candidate, meaningful, retry]);
  useEffect(() => {
    const save = () => {
      if (blocked.current || unresolved.current || !pending.current) return;
      const snapshot = latest.current;
      void writeEntryDraft(snapshot).then(
        () => {
          if (latest.current === snapshot) pending.current = false;
        },
        () => {}
      );
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') save();
    });
    const unsubscribe = onSettingsRestored(() => {
      readRequest.current++;
      blocked.current = true;
      latest.current = null;
      pending.current = false;
      setCandidate(null);
    });
    return () => {
      subscription.remove();
      unsubscribe();
      save();
    };
  }, []);
  const clear = () => {
    readRequest.current++;
    blocked.current = true;
    latest.current = null;
    pending.current = false;
    setCandidate(null);
    return prepared.current ? Promise.resolve() : writeEntryDraft(null);
  };
  return {
    candidate,
    error,
    discarding,
    resume: () => {
      if (resolving.current) return null;
      unresolved.current = false;
      setCandidate(null);
      return candidate;
    },
    discardCandidate: async () => {
      if (resolving.current) return;
      resolving.current = true;
      setDiscarding(true);
      try {
        await writeEntryDraft(null);
        unresolved.current = false;
        setCandidate(null);
      } finally {
        resolving.current = false;
        setDiscarding(false);
      }
    },
    // A failed discard leaves the form open, so allow later edits to autosave again.
    discardCurrent: async () => {
      const previous = { latest: latest.current, pending: pending.current, blocked: blocked.current };
      blocked.current = true;
      try {
        await writeEntryDraft(null);
        latest.current = null;
        pending.current = false;
      } catch (e) {
        latest.current = previous.latest;
        pending.current = previous.pending;
        blocked.current = previous.blocked;
        throw e;
      }
    },
    clear,
    // Remove the recovery copy before writes start, so a killed partial save cannot replay committed rows.
    prepareSave: async () => {
      await clear();
      prepared.current = true;
    },
    resumeAfterFailedSave: () => {
      prepared.current = false;
      blocked.current = false;
      readFailed.current = false;
      unresolved.current = false;
      setReady(true);
      setRetry((value) => value + 1);
    },
    keep: async () => {
      await writeEntryDraft(meaningful ? draft : candidate);
      blocked.current = true;
      pending.current = false;
    },
  };
}
