import { useEffect, useRef, useState } from 'react';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { showAlert } from '@/components/AppDialog';

/**
 * Leaving a new entry that has something typed asks first. `leave(go)` lifts the guard for one render and then
 * runs `go` — Discard and "Log again" use it. A save lifts the guard by making `shouldAsk` false.
 */
export function useDiscardGuard(shouldAsk: boolean) {
  const navigation = useNavigation();
  const [leaving, setLeaving] = useState(false);
  const leaveWith = useRef<(() => void) | null>(null);
  const leave = (go: () => void) => {
    leaveWith.current = go;
    setLeaving(true);
  };
  usePreventRemove(shouldAsk && !leaving, ({ data }) => {
    showAlert('Discard this entry?', "What you've entered hasn't been saved.", [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => leave(() => navigation.dispatch(data.action)) },
    ]);
  });
  useEffect(() => {
    if (!leaving) return;
    leaveWith.current?.();
    leaveWith.current = null;
  }, [leaving]);
  return { leave };
}
