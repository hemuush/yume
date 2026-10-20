import { View, Modal, Pressable, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { LinearGradient } from 'expo-linear-gradient';
import { useAccent } from '@/theme/AccentContext';
import { shade } from '@/lib/color';
import { SheetSurfaceProvider } from './SheetSurface';
import Feather from '@expo/vector-icons/Feather';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaProvider, useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { AmountPadHostProvider, useAmountPadHost } from '@/components/AmountField';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** A quieter line under the title — a count, a date range, etc. */
  subtitle?: string;
  children: React.ReactNode;
  /** Bottom-anchored sheet or centred dialog, both with a stationary dimmed backdrop. */
  variant?: 'sheet' | 'center';
  size?: 'compact' | 'standard' | 'expanded';
  dismissible?: boolean;
  backLabel?: string;
  /** Set false for short dialogs whose content should not scroll. */
  scrollable?: boolean;
  /** The ✕ that closes it, top-right. On by default — it's what replaced every Cancel button. */
  showClose?: boolean;
  /**
   * A pinned action bar. Switches the modal to three bands (header, scrolling content, `footer`
   * padded past the system nav bar) so the main action never scrolls away. Works for sheet and dialog.
   */
  footer?: React.ReactNode;
  /** A dialog's strip along its top edge, like a StripCard's: what it is about (coral for a delete). */
  strip?: string;
}

/**
 * Every modal goes through here: backdrop tap, ✕ or Android back closes it; the keyboard pushes the sheet
 * up; bottom padding clears the gesture/nav bar. The themed header, neutral body and pinned action tray
 * share the main screens' palette.
 */
export function ModalSheet(props: Props) {
  const { visible, onClose, dismissible = true } = props;
  const close = () => {
    if (dismissible) onClose();
  };
  const reduceMotion = useReduceMotion();
  return (
    <Modal
      visible={visible}
      // Always 'fade', never 'slide': RN's <Modal> animates backdrop and sheet as one unit, so 'slide'
      // leaves the backdrop short of full-screen early on, so the real screen shows through at full brightness.
      animationType={reduceMotion ? 'none' : 'fade'}
      transparent
      onRequestClose={close}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* A fresh SafeAreaProvider: on Android a <Modal> is its own window,
          which the root provider in app/_layout.tsx doesn't measure — without
          this, useSafeAreaInsets() reads { bottom: 0 } inside here and every
          sheet's footer buttons end up clipped behind the system nav bar. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SheetSurfaceProvider value>
          <ModalSheetBody {...props} onClose={close} />
        </SheetSurfaceProvider>
      </SafeAreaProvider>
    </Modal>
  );
}

function SheetWash() {
  const { accent } = useAccent();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[shade(accent ?? theme.colors.primary, 94), theme.colors.surface]}
      style={styles.wash}
    />
  );
}

function ModalCloseButton({
  onClose,
  disabled,
  label = 'Close',
  back = false,
}: {
  onClose: () => void;
  disabled: boolean;
  label?: string;
  back?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={[styles.closeBtn, disabled && styles.disabled, animatedStyle]}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onClose}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={back ? 'arrow-left' : 'x'} size={20} color={theme.colors.textPrimary} />
    </AnimatedPressable>
  );
}

/**
 * A sheet's pinned action bar: the main button(s), with an optional round button in front, a red bin for
 * Delete (never a full-width Delete as loud as Save) or ⋯ for a menu of rarer actions.
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
 * A quiet text action at the end of a sheet ("Delete recurring entry", "Archive goal") for rarer, riskier
 * things, so they never sit in the footer beside Save.
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
      hitSlop={{ top: 6, bottom: 6 }}
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
      hitSlop={2}
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
  strip,
  size = 'standard',
  dismissible = true,
  backLabel,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  const maxHeight =
    height < 640 || fontScale > 1.2 || size === 'expanded' ? '94%' : size === 'compact' ? '78%' : '90%';
  const isSheet = variant === 'sheet';
  const stripView = !isSheet && strip ? <View style={[styles.strip, { backgroundColor: strip }]} /> : null;

  // The pad an AmountField docks under the sheet, in place of the phone keyboard.
  const { host, pad, scrollProps: scrollTracking } = useAmountPadHost();
  // A pinned footer means the three-band layout (fixed header / scrolling body / fixed footer). A scrolling
  // sheet always uses it: the single-column scroll can be taller than its content and strand the sheet.
  const framed = footer !== undefined || scrollable;

  // Title and subtitle on the left, the ✕ on the right — or just the ✕ for a
  // sheet that opens on its own card instead of a title.
  const header =
    title || subtitle || showClose || backLabel ? (
      <View style={styles.header}>
        {backLabel && <ModalCloseButton onClose={onClose} disabled={!dismissible} label={backLabel} back />}
        <View style={styles.headerText}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {showClose && !backLabel && <ModalCloseButton onClose={onClose} disabled={!dismissible} />}
      </View>
    ) : null;

  // Centered dialog with a pinned footer.
  if (framed && !isSheet) {
    return (
      <AmountPadHostProvider value={host}>
        <View style={styles.flex}>
          <Pressable
            style={styles.backdrop}
            disabled={!dismissible}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View
            style={[
              styles.flex,
              styles.alignCenter,
              { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
            ]}
            pointerEvents="box-none"
          >
            <View testID="sheet-surface" style={[styles.dialog, styles.dialogFramed, { maxHeight }]}>
              <SheetWash />
              {stripView}
              <View style={styles.framedPad}>{header}</View>
              <KeyboardAwareScrollView
                {...scrollTracking}
                style={styles.framedBody}
                contentContainerStyle={styles.framedDialogContent}
                bottomOffset={24}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </KeyboardAwareScrollView>
              <View style={[styles.framedDialogFooter, { paddingBottom: pad ? 10 : 16 }]}>{footer}</View>
              {pad && <View style={styles.dialogDock}>{pad}</View>}
            </View>
          </View>
        </View>
      </AmountPadHostProvider>
    );
  }

  // Bottom sheet with a pinned footer: fixed header, scrolling
  // content, action bar pinned to the bottom above the nav bar.
  if (framed) {
    return (
      <AmountPadHostProvider value={host}>
        <View style={styles.flex}>
          <Pressable
            style={styles.backdrop}
            disabled={!dismissible}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View
            style={[styles.flex, styles.alignBottom, { paddingTop: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            <View testID="sheet-surface" style={[styles.framedSheet, { maxHeight }]}>
              <SheetWash />
              <View style={styles.framedPad}>{header}</View>
              <KeyboardAwareScrollView
                {...scrollTracking}
                style={styles.framedBody}
                contentContainerStyle={styles.framedSheetContent}
                bottomOffset={24}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </KeyboardAwareScrollView>
              {footer !== undefined ? (
                <View style={[styles.framedSheetFooter, { paddingBottom: pad ? 10 : 12 + insets.bottom }]}>
                  {footer}
                </View>
              ) : pad ? null : (
                <View style={{ height: insets.bottom }} />
              )}
              {pad && <View style={[styles.sheetDock, { paddingBottom: 12 + insets.bottom }]}>{pad}</View>}
            </View>
          </View>
        </View>
      </AmountPadHostProvider>
    );
  }

  const body = (
    <View
      style={[
        isSheet ? styles.sheet : styles.dialog,
        stripView && styles.dialogStriped,
        { paddingBottom: isSheet ? 24 + insets.bottom : 20 },
      ]}
    >
      <SheetWash />
      {stripView}
      {header}
      {children}
      {pad && <View style={styles.inlineDock}>{pad}</View>}
    </View>
  );

  return (
    <AmountPadHostProvider value={host}>
      <View style={styles.flex}>
        {/* The backdrop is its own sibling rather than a parent of the sheet:
          a parent Pressable would swallow every tap inside the sheet too. */}
        <Pressable
          style={styles.backdrop}
          disabled={!dismissible}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          style={[
            styles.flex,
            isSheet ? styles.alignBottom : styles.alignCenter,
            isSheet
              ? { paddingTop: insets.top + 8 }
              : { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
          ]}
          pointerEvents="box-none"
        >
          {body}
        </View>
      </View>
    </AmountPadHostProvider>
  );
}

const SHEET_SHADOW = {
  shadowColor: theme.colors.ink,
  shadowOffset: { width: 0, height: -6 },
  shadowOpacity: 0.08,
  shadowRadius: 22,
  elevation: 8,
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
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 112 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    minHeight: 48,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 20, color: theme.colors.textPrimary },
  subtitle: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },

  // --- pinned-footer layouts ---
  framedPad: { paddingHorizontal: 20, paddingTop: 20 },
  framedBody: { flexGrow: 0, flexShrink: 1 },
  framedSheet: {
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flexShrink: 1,
    ...SHEET_SHADOW,
  },
  framedSheetContent: { paddingHorizontal: 20, paddingBottom: 20 },
  framedSheetFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: theme.colors.surfaceAlt,
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  framedDialogContent: { paddingHorizontal: 20, paddingBottom: 8 },
  sheetDock: { paddingHorizontal: 16, paddingTop: 2, backgroundColor: theme.colors.surface },
  dialogDock: { paddingHorizontal: 16, paddingBottom: 14, backgroundColor: theme.colors.surface },
  inlineDock: { marginTop: 12 },
  framedDialogFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: theme.colors.surfaceAlt,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  roundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnDanger: { backgroundColor: theme.colors.expenseTint, borderColor: theme.colors.expenseTint },
  disabled: { opacity: 0.5 },
  link: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  linkText: { fontFamily: theme.font.roundedBold, fontSize: 13, color: theme.colors.textPrimary },
  linkDanger: { color: theme.colors.expenseText },

  sheet: {
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 20,
    ...SHEET_SHADOW,
  },
  dialog: {
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    padding: 20,
    marginHorizontal: 24,
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 34,
    elevation: 16,
  },
  dialogFramed: {
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  strip: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  // The strip is clipped to the dialog's corners; the space under it keeps the title off it.
  dialogStriped: { overflow: 'hidden', paddingTop: 22 },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
