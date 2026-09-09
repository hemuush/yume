import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Tracks the on-screen keyboard's height directly from native events instead
 * of leaning on `KeyboardAvoidingView`. That component's Android 'height'
 * behavior only shrinks the flex container it wraps, which is unreliable
 * inside a `Modal` — Android renders a Modal as its own Dialog window, and
 * that window doesn't reliably participate in the same resize/measurement
 * `KeyboardAvoidingView` expects, which is exactly how a modal's own inputs
 * ended up hidden behind the keyboard while typing. Reading the keyboard's
 * real height and applying it as padding/margin ourselves works regardless
 * of how that window behaves.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates?.height ?? 0));
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}
