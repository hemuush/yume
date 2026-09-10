import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

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
      navigationBarTranslucent
    >
      <View style={styles.flex}>
        {/* The backdrop is its own sibling rather than a parent of the sheet:
            a parent Pressable would swallow every tap inside the sheet too. */}
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        {/* KeyboardAwareScrollView (react-native-keyboard-controller) scrolls the
            focused input clear of the keyboard and animates in sync with it,
            inside the Modal's own Android Dialog window where the built-in
            KeyboardAvoidingView / manual keyboard-height padding both fell
            short. `bottomOffset` keeps a small gap between the field and the
            keyboard's top edge. */}
        {/* paddingTop keeps the sheet (grabber + title) clear of the
            translucent status bar even when its content is tall enough to
            fill the screen or the keyboard has pushed it up. */}
        <View
          style={[
            styles.flex,
            isSheet ? styles.alignBottom : styles.alignCenter,
            { paddingTop: insets.top + 8 },
          ]}
          pointerEvents="box-none"
        >
          {scrollable ? (
            <KeyboardAwareScrollView
              style={isSheet ? styles.scrollSheet : styles.scrollDialog}
              contentContainerStyle={isSheet ? undefined : styles.scrollDialogContent}
              bottomOffset={24}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {body}
            </KeyboardAwareScrollView>
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
