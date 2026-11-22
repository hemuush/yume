import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { KeyboardEvents, useKeyboardState } from 'react-native-keyboard-controller';

/**
 * Whether the phone keyboard is up, for the sheet's `KeyboardAvoidingView`. That view moves with the keyboard only while
 * it is enabled, and switching it off leaves whatever padding it had at that moment: so this must not turn false when the
 * keyboard starts to close (the library's flag does), or the sheet is left lifted by a whole keyboard over an empty gap.
 * It turns false once the keyboard is really gone (a hide event from the library or React Native), or after a short while
 * if the library's flag has been false that long and no event came.
 */
const KEYBOARD_CLOSE_MS = 600;
export function useKeyboardOpen(): boolean {
  const reported = useKeyboardState((state) => state.isVisible);
  const [open, setOpen] = useState(reported);
  useEffect(() => {
    if (reported) {
      setOpen(true);
      return;
    }
    const timer = setTimeout(() => setOpen(false), KEYBOARD_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [reported]);
  useEffect(() => {
    const on = () => setOpen(true);
    const off = () => setOpen(false);
    // `?.`: a test double of the library has no event emitter.
    const subs = [
      Keyboard.addListener('keyboardDidShow', on),
      Keyboard.addListener('keyboardDidHide', off),
      KeyboardEvents?.addListener('keyboardDidShow', on),
      KeyboardEvents?.addListener('keyboardDidHide', off),
    ];
    return () => subs.forEach((sub) => sub?.remove());
  }, []);
  return open;
}
