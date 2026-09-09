import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** 'sheet' slides up from the bottom edge; 'center' is a small centered dialog. */
  variant?: 'sheet' | 'center';
  /** Set false for short dialogs whose content should not scroll. */
  scrollable?: boolean;
}

/**
 * Every modal in the app goes through here so three things that were
 * previously each modal's own problem are solved once:
 *  - tapping the dimmed backdrop (or pressing Android back) closes it;
 *  - the keyboard pushes the sheet up instead of covering its inputs;
 *  - the sheet's bottom padding clears the device's gesture/nav bar, so
 *    action buttons are never sitting underneath it.
 */
export function ModalSheet({
  visible,
  onClose,
  title,
  children,
  variant = 'sheet',
  scrollable = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const isSheet = variant === 'sheet';

  const body = (
    <View
      style={[isSheet ? styles.sheet : styles.dialog, { paddingBottom: (isSheet ? 24 : 20) + insets.bottom }]}
    >
      {isSheet && <View style={styles.grabber} />}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType={isSheet ? 'slide' : 'fade'}
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.flex}>
        {/* The backdrop is its own sibling rather than a parent of the sheet:
            a parent Pressable would swallow every tap inside the sheet too. */}
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        {/* `paddingBottom: keyboardHeight` (read from real Keyboard events via
            useKeyboardHeight, not KeyboardAvoidingView) lifts the whole sheet
            clear of the keyboard. KeyboardAvoidingView's Android 'height'
            behavior was unreliable here because a Modal renders as its own
            Android Dialog window, which doesn't reliably participate in the
            resize/measurement that component expects — inputs could end up
            hidden behind the keyboard while typing. */}
        <View
          style={[
            styles.flex,
            isSheet ? styles.alignBottom : styles.alignCenter,
            { paddingBottom: keyboardHeight },
          ]}
          pointerEvents="box-none"
        >
          {scrollable ? (
            <ScrollView
              style={isSheet ? styles.scrollSheet : styles.scrollDialog}
              contentContainerStyle={isSheet ? undefined : styles.scrollDialogContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {body}
            </ScrollView>
          ) : (
            body
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  alignBottom: { justifyContent: 'flex-end' },
  alignCenter: { justifyContent: 'center' },
  scrollSheet: { flexGrow: 0, maxHeight: '88%' },
  scrollDialog: { flexGrow: 0, maxHeight: '85%' },
  scrollDialogContent: { justifyContent: 'center' },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: theme.border.thick,
    borderColor: theme.colors.ink,
    padding: 20,
  },
  dialog: {
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    borderWidth: theme.border.thick,
    borderColor: theme.colors.ink,
    padding: 20,
    marginHorizontal: 24,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.textMuted,
    opacity: 0.4,
    marginBottom: 14,
  },
  title: { fontFamily: theme.font.display, fontSize: 19, color: theme.colors.textPrimary, marginBottom: 16 },
});
