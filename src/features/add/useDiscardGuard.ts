import { useEffect, useRef, useState } from 'react';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { showAlert } from '@/components/AppDialog';

/**
 * Leaving a new entry that has something typed asks first. `leave(go)` lifts the guard for one render and then
 * runs `go` — Discard and "Log again" use it. A save lifts the guard by making `shouldAsk` false.
 */
export function useDiscardGuard(
  shouldAsk: boolean,
  draft?: { onDiscard: () => Promise<void>; onKeepDraft: () => Promise<void> }
) {
  const navigation = useNavigation();
  const [leaving, setLeaving] = useState(false);
  const leaveWith = useRef<(() => void) | null>(null);
  const leave = (go: () => void) => {
    leaveWith.current = go;
    setLeaving(true);
  };
  usePreventRemove(shouldAsk && !leaving, ({ data }) => {
    showAlert(draft ? 'Leave this entry?' : 'Discard this entry?', "What you've entered hasn't been saved.", [
      { text: 'Keep editing', style: 'cancel' },
      ...(draft
        ? [
            {
              text: 'Keep draft',
              onPress: () => {
                void draft.onKeepDraft().then(
                  () => leave(() => navigation.dispatch(data.action)),
                  () =>
                    showAlert('Couldn’t keep draft', 'Your entry is still open. Try again before leaving.')
                );
              },
            },
          ]
        : []),
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          if (draft)
            void draft.onDiscard().then(
              () => leave(() => navigation.dispatch(data.action)),
              () => showAlert('Couldn’t discard draft', 'Your entry is still open. Try again.')
            );
          else leave(() => navigation.dispatch(data.action));
        },
      },
    ]);
  });
  useEffect(() => {
    if (!leaving) return;
    leaveWith.current?.();
    leaveWith.current = null;
  }, [leaving]);
  return { leave };
}
