import { View, Modal, Pressable, Animated, StyleSheet, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaProvider, useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  /** The ✕ that closes it, top-right. On by default — it's what replaced every Cancel button. */
  showClose?: boolean;
  /**
   * A pinned action bar. Passing this switches the modal to a three-band
   * layout — fixed grabber + title on top, scrolling content in the middle,
   * `footer` pinned to the bottom (padded past the system nav bar) — so the
   * main action is always visible and never scrolls away. Works for both
   * the bottom `sheet` and the centered dialog. See `SheetFooter`.
   */
  footer?: React.ReactNode;
}

/**
 * Every modal in the app goes through here so a few things that were
 * previously each modal's own problem are solved once:
 *  - tapping the dimmed backdrop, the ✕ or Android back closes it;
 *  - the keyboard pushes the sheet up instead of covering its inputs;
 *  - the sheet's bottom padding clears the device's gesture/nav bar, so
 *    action buttons are never sitting underneath it;
 *  - one surface colour top to bottom, the pinned footer included (the
 *    calm-sheets sign-off, Direction C), so nothing looks stuck on.
 */
export function ModalSheet(props: Props) {
  const { visible, onClose } = props;
  return (
    <Modal
      visible={visible}
      // Always 'fade', never 'slide': RN's <Modal> animates its whole
      // presented tree — backdrop included — as one unit. 'slide' translates
      // that whole unit up from off-screen, so the backdrop hasn't reached
      // full-screen coverage for the first stretch of the animation either —
      // a screenshot caught right as a sheet opens shows the real screen
      // behind it at full brightness through that gap. 'fade' only ramps
      // opacity; the backdrop's position never moves, so it covers the full
      // screen for the whole transition, never just partially.
      animationType="fade"
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

function ModalCloseButton({ onClose }: { onClose: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={[styles.closeBtn, animatedStyle]}
      onPress={onClose}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Close"
    >
      <Feather name="x" size={16} color={theme.colors.textSecondary} />
    </AnimatedPressable>
  );
}

/**
 * A sheet's pinned action bar: the main button(s), with an optional round
 * button in front — a red bin for Delete (never a full-width Delete as loud
 * as Save), or ⋯ for a menu of rarer actions.
 */
export function SheetFooter({
  children,
  onDelete,
  deleteLabel = 'Delete',
  onMore,
  moreLabel = 'More actions',
  disabled,
}: {
  children?: React.ReactNode;
  onDelete?: () => void;
  deleteLabel?: string;
  onMore?: () => void;
  moreLabel?: string;
  disabled?: boolean;
}) {
  return (
    <View style={styles.footerRow}>
      {onDelete && (
        <RoundFooterButton icon="trash-2" label={deleteLabel} onPress={onDelete} disabled={disabled} danger />
      )}
      {onMore && (
        <RoundFooterButton icon="more-horizontal" label={moreLabel} onPress={onMore} disabled={disabled} />
      )}
      {children}
    </View>
  );
}

/**
 * A quiet text action at the end of a sheet — "Delete recurring entry",
 * "Archive goal" — for the rarer, riskier things a form can do, so they
 * never sit in the footer beside Save.
 */
export function SheetLink({
  label,
  onPress,
  danger = true,
  disabled,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.link, (pressed || disabled) && styles.disabled]}
      accessibilityRole="button"
    >
      <Text style={[styles.linkText, danger && styles.linkDanger]}>{label}</Text>
    </Pressable>
  );
}

function RoundFooterButton({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: 'trash-2' | 'more-horizontal';
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={[styles.roundBtn, danger && styles.roundBtnDanger, disabled && styles.disabled, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={icon} size={18} color={danger ? theme.colors.expense : theme.colors.ink} />
    </AnimatedPressable>
  );
}

function ModalSheetBody({
  onClose,
  title,
  subtitle,
  children,
  variant = 'sheet',
  scrollable = true,
  showClose = true,
  footer,
}: Props) {
  const insets = useSafeAreaInsets();
  const isSheet = variant === 'sheet';
  // A pinned footer means the three-band layout (fixed header / scrolling
  // body / fixed footer) instead of the single scrolling column. A scrolling
  // bottom sheet always uses it, footer or not: the single-column scroll
  // view could come out taller than its content, leaving the sheet
  // stranded mid-screen above an empty band.
  const framed = footer !== undefined || (isSheet && scrollable);

  // Title and subtitle on the left, the ✕ on the right — or just the ✕ for a
  // sheet that opens on its own card instead of a title.
  const header =
    title || subtitle || showClose ? (
      <View style={styles.header}>
        <View style={styles.headerText}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {showClose && <ModalCloseButton onClose={onClose} />}
      </View>
    ) : null;

  // Centered dialog with a pinned footer.
  if (framed && !isSheet) {
    return (
      <View style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[styles.flex, styles.alignCenter, { paddingVertical: insets.top + 12 }]}
          pointerEvents="box-none"
        >
          <View style={[styles.dialog, styles.dialogFramed]}>
            <View style={styles.framedPad}>{header}</View>
            <ScrollView
              style={styles.framedBody}
              contentContainerStyle={styles.framedDialogContent}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
            <View style={[styles.framedDialogFooter, { paddingBottom: 16 }]}>{footer}</View>
          </View>
        </View>
      </View>
    );
  }

  // Bottom sheet with a pinned footer: fixed grabber + header, scrolling
  // content, action bar pinned to the bottom above the nav bar.
  if (framed) {
    return (
      <View style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[styles.flex, styles.alignBottom, { paddingTop: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <View style={styles.framedSheet}>
            <View style={styles.grabber} />
            <View style={styles.framedPad}>{header}</View>
            <KeyboardAwareScrollView
              style={styles.framedBody}
              contentContainerStyle={styles.framedSheetContent}
              bottomOffset={24}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </KeyboardAwareScrollView>
            {footer !== undefined ? (
              <View style={[styles.framedSheetFooter, { paddingBottom: 12 + insets.bottom }]}>{footer}</View>
            ) : (
              <View style={{ height: insets.bottom }} />
            )}
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
      {header}
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

const SHEET_SHADOW = {
  shadowColor: theme.colors.ink,
  shadowOffset: { width: 0, height: -6 },
  shadowOpacity: 0.12,
  shadowRadius: 22,
  elevation: 14,
} as const;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.scrim,
  },
  alignBottom: { justifyContent: 'flex-end' },
  alignCenter: { justifyContent: 'center' },
  scrollSheet: { flexGrow: 0, maxHeight: '88%' },
  scrollDialog: { flexGrow: 0, maxHeight: '85%' },
  scrollDialogContent: { justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, minHeight: 32 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 19, color: theme.colors.textPrimary },
  subtitle: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  // --- pinned-footer layouts ---
  framedPad: { paddingHorizontal: 16 },
  framedBody: { flexGrow: 0, flexShrink: 1 },
  framedSheet: {
    backgroundColor: theme.colors.surfaceAlt,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    flexShrink: 1,
    ...SHEET_SHADOW,
  },
  framedSheetContent: { paddingHorizontal: 16, paddingBottom: 16 },
  framedSheetFooter: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: theme.colors.surfaceAlt },
  framedDialogContent: { paddingHorizontal: 16, paddingBottom: 4 },
  framedDialogFooter: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: theme.colors.surface },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roundBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnDanger: { backgroundColor: theme.colors.expenseTint, borderColor: theme.colors.expenseTint },
  disabled: { opacity: 0.5 },
  link: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  linkText: { fontFamily: theme.font.roundedBold, fontSize: 13.5, color: theme.colors.textPrimary },
  linkDanger: { color: theme.colors.expenseText },

  sheet: {
    backgroundColor: theme.colors.surfaceAlt,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    ...SHEET_SHADOW,
  },
  dialog: {
    backgroundColor: theme.colors.surface,
    borderRadius: 26,
    padding: 18,
    marginHorizontal: 24,
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 34,
    elevation: 16,
  },
  dialogFramed: {
    paddingHorizontal: 0,
    paddingBottom: 0,
    overflow: 'hidden',
    maxHeight: '78%',
    alignSelf: 'stretch',
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.inkHairline,
    marginTop: 10,
    marginBottom: 10,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
