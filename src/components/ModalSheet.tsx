import { View, Text, Modal, Pressable, StyleSheet, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaProvider, useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
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
   * A pinned action bar. Passing this switches the modal to a three-band
   * layout — fixed grabber + title on top, scrolling content in the middle,
   * `footer` pinned to the bottom (padded past the system nav bar) — so the
   * Cancel / Save / Close row is always visible and never scrolls away.
   * Works for both the bottom `sheet` and the centered dialog.
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
export function ModalSheet(props: Props) {
  const { visible, onClose, variant = 'sheet' } = props;
  return (
    <Modal
      visible={visible}
      animationType={variant === 'sheet' ? 'slide' : 'fade'}
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* A fresh SafeAreaProvider: on Android a <Modal> is its own window,
          which the root provider in app/_layout.tsx doesn't measure — without
          this, useSafeAreaInsets() reads { bottom: 0 } inside here and every
          sheet's footer buttons end up clipped behind the system nav bar. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ModalSheetBody {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

function ModalSheetBody({
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
  // A pinned footer means the three-band layout (fixed header / scrolling
  // body / fixed footer) instead of the single scrolling column.
  const framed = footer !== undefined;
  const framedCenter = framed && !isSheet;
  const framedSheet = framed && isSheet;

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

  const headingTexts =
    title || subtitle ? (
      <>
        {title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </>
    ) : null;

  const heading = headingTexts ? (
    <View style={[styles.headingBlock, showClose && styles.headingInsetForClose]}>{headingTexts}</View>
  ) : null;

  // Centered dialog with a pinned footer.
  if (framedCenter) {
    return (
      <View style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[styles.flex, styles.alignCenter, { paddingVertical: insets.top + 12 }]}
          pointerEvents="box-none"
        >
          <View style={[styles.dialog, styles.dialogFramed]}>
            {headingTexts ? <View style={styles.framedHeader}>{headingTexts}</View> : null}
            {closeBtn}
            <ScrollView
              style={styles.framedBody}
              contentContainerStyle={styles.framedBodyContent}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
            <View style={[styles.framedFooter, { paddingBottom: 12 + insets.bottom }]}>{footer}</View>
          </View>
        </View>
      </View>
    );
  }

  // Bottom sheet with a pinned footer: fixed grabber + title, scrolling
  // content, action bar pinned to the bottom above the nav bar.
  if (framedSheet) {
    return (
      <View style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[styles.flex, styles.alignBottom, { paddingTop: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <View style={styles.framedSheet}>
            <View style={styles.grabber} />
            {headingTexts ? (
              <View style={styles.framedSheetHeader}>
                {headingTexts}
                {closeBtn}
              </View>
            ) : (
              closeBtn
            )}
            <KeyboardAwareScrollView
              style={styles.framedSheetBody}
              contentContainerStyle={styles.framedSheetBodyContent}
              bottomOffset={24}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </KeyboardAwareScrollView>
            <View style={[styles.framedSheetFooter, { paddingBottom: 14 + insets.bottom }]}>{footer}</View>
          </View>
        </View>
      </View>
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
          isSheet ? { paddingTop: insets.top + 8 } : { paddingVertical: insets.top + 12 },
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
    // Opaque enough that the bright floating tab bar behind doesn't ghost
    // through as a muddy band under the sheet.
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  alignBottom: { justifyContent: 'flex-end' },
  alignCenter: { justifyContent: 'center' },
  scrollSheet: { flexGrow: 0, maxHeight: '88%' },
  scrollDialog: { flexGrow: 0, maxHeight: '85%' },
  scrollDialogContent: { justifyContent: 'center' },

  // --- pinned-footer bottom sheet ---
  framedSheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    maxHeight: '92%',
    flexShrink: 1,
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 14,
  },
  framedSheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 12,
  },
  framedSheetBody: { flexGrow: 0, flexShrink: 1 },
  framedSheetBodyContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  framedSheetFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
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
    backgroundColor: theme.colors.surface,
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
