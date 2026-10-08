import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';

export interface DialogButton {
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
  const [dialog, setDialog] = useState<Dialog | null>(null);
  useEffect(() => {
    show = setDialog;
    return () => {
      show = null;
    };
  }, []);
  if (!dialog) return null;

  const destructive = dialog.buttons.some((b) => b.style === 'destructive');
  // Cancel first, so the risky button sits on the right, under the thumb.
  const buttons = [...dialog.buttons].sort(
    (a, b) => Number(b.style === 'cancel') - Number(a.style === 'cancel')
  );
  const close = () => setDialog(null);
  const press = (b: DialogButton) => {
    close();
    b.onPress?.();
  };
  const cancel = dialog.buttons.find((b) => b.style === 'cancel');

  return (
    <ModalSheet
      visible
      onClose={() => (cancel ? press(cancel) : close())}
      variant="center"
      scrollable={false}
      showClose={false}
      strip={destructive ? theme.colors.slice.spent : theme.colors.slice.free}
    >
      <View style={styles.head}>
        {destructive && (
          <View style={styles.icon}>
            <Feather name="trash-2" size={20} color={theme.colors.expense} />
          </View>
        )}
        <View style={styles.headText}>
          <Text style={styles.title}>{dialog.title}</Text>
          {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
        </View>
      </View>
      <View style={[styles.buttons, buttons.length > 2 && styles.buttonsStacked]}>
        {buttons.map((b, i) => (
          <PrimaryButton
            key={i}
            title={b.text}
            variant={b.style === 'destructive' ? 'danger' : b.style === 'cancel' ? 'secondary' : 'primary'}
            onPress={() => press(b)}
            style={buttons.length > 2 ? undefined : styles.button}
          />
        ))}
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  // The bin sits beside the title, so a delete dialog is no taller than any other.
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headText: { flex: 1, minWidth: 0 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.expenseTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 19,
    color: theme.colors.textPrimary,
  },
  message: {
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 18 },
  buttonsStacked: { flexDirection: 'column-reverse' },
  button: { flex: 1 },
});
