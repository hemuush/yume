import { useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';

/**
 * Runs `onHide` when the keyboard closes, after blurring the focused field: on Android the back gesture or
 * "down" key hides it but leaves focus, so `onBlur` never fires and Add's number pad stayed hidden.
 */
export function useOnKeyboardHide(onHide: () => void): void {
  const latest = useRef(onHide);
  useEffect(() => {
    latest.current = onHide;
  });
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      // Blurs whichever text field still has focus (the keyboard is already down).
      Keyboard.dismiss();
      latest.current();
    });
    return () => sub.remove();
  }, []);
}
