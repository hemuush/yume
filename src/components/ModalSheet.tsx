import { View, Modal, Pressable, Animated, StyleSheet, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaProvider, useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { usePressScale } from '@/lib/usePressScale';
import { AmountPadHostProvider, useAmountPadHost } from '@/components/AmountField';

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
   * A pinned action bar. Switches the modal to three bands (grabber + title, scrolling content, `footer`
   * padded past the system nav bar) so the main action never scrolls away. Works for sheet and dialog.
   */
  footer?: React.ReactNode;
  /** A dialog's strip along its top edge, like a StripCard's: what it is about (coral for a delete). */
  strip?: string;
}

/**
 * Every modal goes through here: backdrop tap, ✕ or Android back closes it; the keyboard pushes the sheet
 * up; bottom padding clears the gesture/nav bar; one surface colour top to bottom, pinned footer included.
 */
export function ModalSheet(props: Props) {
  const { visible, onClose } = props;
  return (
    <Modal
      visible={visible}
      // Always 'fade', never 'slide': RN's <Modal> animates backdrop and sheet as one unit, so 'slide'
      // leaves the backdrop short of full-screen early on, so the real screen shows through at full brightness.
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
}: Props) {
  const insets = useSafeAreaInsets();
  const isSheet = variant === 'sheet';
  const { accent } = useAccent();
  // A sheet opens under a light wash of the theme's sky that fades into the cream page below the title.
  const sky = isSheet ? (
    <LinearGradient
      colors={[shade(accent, 93, 3), theme.colors.background]}
      style={styles.sky}
      pointerEvents="none"
    />
  ) : null;
  const stripView = !isSheet && strip ? <View style={[styles.strip, { backgroundColor: strip }]} /> : null;

  // The pad an AmountField docks under the sheet, in place of the phone keyboard.
  const { host, pad, scrollProps: scrollTracking } = useAmountPadHost();
  // A pinned footer means the three-band layout (fixed header / scrolling body / fixed footer). A scrolling
  // sheet always uses it: the single-column scroll can be taller than its content and strand the sheet.
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
      <AmountPadHostProvider value={host}>
        <View style={styles.flex}>
          <Pressable
            style={styles.backdrop}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View
            style={[styles.flex, styles.alignCenter, { paddingVertical: insets.top + 12 }]}
            pointerEvents="box-none"
          >
            <View style={[styles.dialog, styles.dialogFramed]}>
              {stripView}
              <View style={styles.framedPad}>{header}</View>
              <ScrollView
                {...scrollTracking}
                style={styles.framedBody}
                contentContainerStyle={styles.framedDialogContent}
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
              <View style={[styles.framedDialogFooter, { paddingBottom: pad ? 10 : 16 }]}>{footer}</View>
              {pad && <View style={styles.dialogDock}>{pad}</View>}
            </View>
          </View>
        </View>
      </AmountPadHostProvider>
    );
  }

  // Bottom sheet with a pinned footer: fixed grabber + header, scrolling
  // content, action bar pinned to the bottom above the nav bar.
  if (framed) {
    return (
      <AmountPadHostProvider value={host}>
        <View style={styles.flex}>
          <Pressable
            style={styles.backdrop}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View
            style={[styles.flex, styles.alignBottom, { paddingTop: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            <View style={styles.framedSheet}>
              {sky}
              <View style={styles.grabber} />
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
        { paddingBottom: (isSheet ? 24 : 20) + insets.bottom },
      ]}
    >
      {sky}
      {stripView}
      {isSheet && <View style={styles.grabber} />}
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
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
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
    </AmountPadHostProvider>
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
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    flexShrink: 1,
    ...SHEET_SHADOW,
  },
  framedSheetContent: { paddingHorizontal: 16, paddingBottom: 16 },
  framedSheetFooter: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: theme.colors.background },
  framedDialogContent: { paddingHorizontal: 16, paddingBottom: 4 },
  sheetDock: { paddingHorizontal: 16, paddingTop: 2, backgroundColor: theme.colors.background },
  dialogDock: { paddingHorizontal: 16, paddingBottom: 14, backgroundColor: theme.colors.surface },
  inlineDock: { marginTop: 12 },
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
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
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
  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: 96 },
  strip: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  // The strip is clipped to the dialog's corners; the space under it keeps the title off it.
  dialogStriped: { overflow: 'hidden', paddingTop: 22 },
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
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.link,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
