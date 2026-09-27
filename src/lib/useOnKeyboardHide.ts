import { useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';

/**
 * Runs `onHide` whenever the phone's keyboard closes, after taking focus off
 * whichever text field had it.
 *
 * On Android, closing the keyboard with the back gesture or the keyboard's
 * own "down" key hides it but leaves the text field focused, so that field's
 * `onBlur` never fires. A screen that keys something off focus (the Add
 * screen hides its number pad while a text field is being typed in) would
 * otherwise stay stuck in "typing" with no keyboard showing.
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
