import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';

interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface Dialog {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

let show: ((d: Dialog) => void) | null = null;

/**
 * Yume's confirm/notice dialog replacing the system alert; same call as `Alert.alert(title, msg, buttons)`.
 * Shown by the one `AppDialogHost` at the app root; one at a time, a newer dialog replaces an open one.
 */
export function showAlert(title: string, message?: string, buttons?: DialogButton[]): void {
  if (!show) {
    // No AppDialogHost is mounted (a screen outside the root layout, or a call before it mounts): the
    // dialog would vanish without a trace, so say so in development.
    if (__DEV__)
      console.warn(`showAlert("${title}") was called with no AppDialogHost mounted; nothing was shown.`);
    return;
  }
  show({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] });
}

export function AppDialogHost() {
  const { width, fontScale } = useWindowDimensions();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const current = useRef<Dialog | null>(null);
  useEffect(() => {
    const present = (next: Dialog) => {
      current.current = next;
      setDialog(next);
    };
    show = present;
    return () => {
      if (show === present) show = null;
      current.current = null;
    };
  }, []);
  if (!dialog) return null;

  const stacked = dialog.buttons.length > 2 || fontScale > 1.3 || width < 340;
  const destructive = dialog.buttons.some((b) => b.style === 'destructive');
  // Cancel first, so the risky button sits on the right, under the thumb.
  const buttons = [...dialog.buttons].sort(
    (a, b) => Number(b.style === 'cancel') - Number(a.style === 'cancel')
  );
  const close = () => {
    // Consume synchronously: queued taps and callbacks from replaced dialogs must not act twice.
    if (current.current !== dialog) return false;
    current.current = null;
    setDialog(null);
    return true;
  };
  const press = (b: DialogButton) => {
    if (!close()) return;
    b.onPress?.();
  };
  const cancel = dialog.buttons.find((b) => b.style === 'cancel');

  return (
    <ModalSheet
      visible
      onClose={() => (cancel ? press(cancel) : close())}
      variant="center"
      scrollable
      showClose={false}
      footer={
        <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
          {buttons.map((b, i) => (
            <PrimaryButton
              key={i}
              title={b.text}
              variant={b.style === 'destructive' ? 'danger' : b.style === 'cancel' ? 'secondary' : 'primary'}
              onPress={() => press(b)}
              style={stacked ? undefined : styles.button}
            />
          ))}
        </View>
      }
    >
      <View style={styles.head}>
        {destructive && (
          <View style={styles.icon}>
            <Feather name="trash-2" size={18} color={theme.colors.expense} />
          </View>
        )}
        <View style={styles.headText}>
          <Text style={styles.title}>{dialog.title}</Text>
          {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
        </View>
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  // The bin sits beside the title, so a delete dialog is no taller than any other.
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headText: { flex: 1, minWidth: 0 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.expenseTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  message: {
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  buttons: { flexDirection: 'row', gap: 8 },
  buttonsStacked: { flexDirection: 'column-reverse' },
  button: { flex: 1 },
});
