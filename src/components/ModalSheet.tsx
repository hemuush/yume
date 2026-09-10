import { View, Text, Modal, Pressable, StyleSheet, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** A quieter line under the title — a count, a date range, etc. */
  subtitle?: string;
  children: React.ReactNode;
  /** 'sheet' slides up from the bottom edge; 'center' is a small centered dialog. */
  variant?: 'sheet' | 'center';
  /** Set false for short dialogs whose content should not scroll. */
  scrollable?: boolean;
  /** Show an ✕ button top-right that calls `onClose`. */
  showClose?: boolean;
  /**
   * A pinned footer for the centered variant — stays put while `children`
   * scroll between it and a pinned header. Passing this switches the centered
   * dialog to a fixed header / scrolling body / fixed footer layout.
   */
  footer?: React.ReactNode;
}

/**
 * Every modal in the app goes through here so a few things that were
 * previously each modal's own problem are solved once:
 *  - tapping the dimmed backdrop (or pressing Android back) closes it;
 *  - the keyboard pushes the sheet up instead of covering its inputs;
 *  - the sheet's bottom padding clears the device's gesture/nav bar, so
 *    action buttons are never sitting underneath it;
 *  - an optional ✕ and a pinned footer for list-style dialogs.
 */
export function ModalSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  variant = 'sheet',
  scrollable = true,
  showClose = false,
  footer,
}: Props) {
  const insets = useSafeAreaInsets();
  const isSheet = variant === 'sheet';
  // A footer only makes sense on the centered dialog, and it needs a
  // three-band layout (fixed header / scrolling body / fixed footer) rather
  // than the single scrolling column the other variants use.
  const framed = !isSheet && footer !== undefined;

  const closeBtn = showClose ? (
    <Pressable
      style={styles.closeBtn}
      onPress={onClose}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Close"
    >
      <Feather name="x" size={16} color={theme.colors.textSecondary} />
    </Pressable>
  ) : null;

  const heading =
    title || subtitle ? (
      <View
        style={[
          framed ? undefined : styles.headingBlock,
          showClose && !framed && styles.headingInsetForClose,
        ]}
      >
        {title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    ) : null;

  if (framed) {
    return (
      <Modal
        visible={visible}
        animationType="fade"
        transparent
        onRequestClose={onClose}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.flex}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
          <View
            style={[styles.flex, styles.alignCenter, { paddingTop: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            <View style={[styles.dialog, styles.dialogFramed, { marginBottom: insets.bottom }]}>
              <View style={styles.framedHeader}>{heading}</View>
              {closeBtn}
              <ScrollView
                style={styles.framedBody}
                contentContainerStyle={styles.framedBodyContent}
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
              {footer != null && <View style={styles.framedFooter}>{footer}</View>}
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  const body = (
    <View
      style={[isSheet ? styles.sheet : styles.dialog, { paddingBottom: (isSheet ? 24 : 20) + insets.bottom }]}
    >
      {isSheet && <View style={styles.grabber} />}
      {closeBtn}
      {heading}
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 14,
  },
  dialog: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    padding: 20,
    marginHorizontal: 24,
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 34,
    elevation: 16,
  },
  dialogFramed: {
    padding: 0,
    overflow: 'hidden',
    maxHeight: '78%',
    alignSelf: 'stretch',
  },
  framedHeader: {
    paddingLeft: 18,
    paddingRight: 46,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderSoft,
  },
  framedBody: { flexGrow: 0, flexShrink: 1 },
  framedBodyContent: { paddingVertical: 4 },
  framedFooter: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.primaryTint,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.borderSoft,
    marginBottom: 16,
  },
  headingBlock: { marginBottom: 16 },
  headingInsetForClose: { paddingRight: 34 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 18, color: theme.colors.textPrimary },
  subtitle: {
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 3,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(18,19,15,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
});
