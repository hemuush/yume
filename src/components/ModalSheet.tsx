import { DURATIONS } from '@/lib/motionTimings';
import { useCallback, useContext, useEffect, useId, useLayoutEffect, useState } from 'react';
import { SheetFlowContext } from './SheetFlow';
import {
  Dimensions,
  Keyboard,
  View,
  Modal,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Text } from '@/components/Text';
import { SheetSurfaceProvider } from './SheetSurface';
import Feather from '@expo/vector-icons/Feather';
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
  KeyboardEvents,
  useKeyboardState,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModalSafeArea } from './ModalSafeArea';
import { dialogWidth, sheetWidth } from './ColumnFrame';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/hooks/usePressScale';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useSwipeToClose } from '@/hooks/useSwipeToClose';
import { AmountPadHostProvider, useAmountPadHost } from '@/components/AmountField';
import { themedStyles, themedValue } from '@/theme/themedStyles';

/**
 * How much taller than its own content a page in a flow may be held, so it does not jump to the height of a taller
 * page. Beyond this the page shrinks to fit rather than sit mostly empty.
 */
const FLOW_STRETCH = 120;

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
  /** Compact styling shared by Home and Activity's linked sheets. */
  ledgerStyle?: boolean;
  dismissible?: boolean;
  /**
   * Take the swipe-down only from the header, not the whole sheet: for a sheet with its own tall vertical list inside
   * (`scrollable={false}` and a FlatList), whose upward scroll would otherwise close the sheet.
   */
  swipeFromHeader?: boolean;
  backLabel?: string;
  /** A root page in a SheetFlow; child tasks with backLabel join the flow automatically. */
  flowPage?: boolean;
  /**
   * Pages in a SheetFlow are held to the tallest page seen so the sheet does not jump between them. 'own' takes a
   * page out of that: it keeps its own height and does not lengthen the others. For a view that is far taller or
   * shorter than the rest of its page (a long schedule, a short list of actions).
   */
  flowHeight?: 'shared' | 'own';
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
 * Whether the phone keyboard is up, for the sheet's `KeyboardAvoidingView`. That view moves with the keyboard only while
 * it is enabled, and switching it off leaves whatever padding it had at that moment: so this must not turn false when the
 * keyboard starts to close (the library's flag does), or the sheet is left lifted by a whole keyboard over an empty gap.
 * It turns false once the keyboard is really gone (a hide event from the library or React Native), or after a short while
 * if the library's flag has been false that long and no event came.
 */
const KEYBOARD_CLOSE_MS = 600;
function useKeyboardOpen(): boolean {
  const reported = useKeyboardState((state) => state.isVisible);
  const [open, setOpen] = useState(reported);
  useEffect(() => {
    if (reported) {
      setOpen(true);
      return;
    }
    const timer = setTimeout(() => setOpen(false), KEYBOARD_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [reported]);
  useEffect(() => {
    const on = () => setOpen(true);
    const off = () => setOpen(false);
    // `?.`: a test double of the library has no event emitter.
    const subs = [
      Keyboard.addListener('keyboardDidShow', on),
      Keyboard.addListener('keyboardDidHide', off),
      KeyboardEvents?.addListener('keyboardDidShow', on),
      KeyboardEvents?.addListener('keyboardDidHide', off),
    ];
    return () => subs.forEach((sub) => sub?.remove());
  }, []);
  return open;
}

/**
 * Every modal goes through here: backdrop tap, ✕ or Android back closes it; the keyboard pushes the sheet
 * up; bottom padding clears the gesture/nav bar. The themed header, neutral body and pinned action tray
 * share the main screens' palette.
 */
export function ModalSheet(props: Props) {
  const flow = useContext(SheetFlowContext);
  return flow && (props.flowPage || props.backLabel) ? (
    <FlowPage {...props} />
  ) : (
    <StandaloneSheet {...props} />
  );
}

function FlowPage(props: Props) {
  const flow = useContext(SheetFlowContext)!;
  const { register } = flow;
  const id = useId();
  const { visible, dismissible = true, onClose } = props;
  const [visited, setVisited] = useState(visible);
  const close = useCallback(() => {
    if (dismissible) {
      Keyboard.dismiss();
      onClose();
    }
  }, [dismissible, onClose]);
  useLayoutEffect(() => {
    if (visible) {
      setVisited(true);
      return register(id, close);
    }
  }, [visible, id, register, close]);
  if (!visible && !visited) return null;
  return (
    <View
      style={[StyleSheet.absoluteFill, !visible && { display: 'none' }]}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <ModalSheetBody {...props} variant="sheet" size="expanded" onClose={close} />
    </View>
  );
}

function StandaloneSheet(props: Props) {
  const { visible, onClose, dismissible = true } = props;
  const close = () => {
    if (dismissible) {
      Keyboard.dismiss();
      onClose();
    }
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
          which the root provider in app/_layout.tsx doesn’t measure — without
          this, useSafeAreaInsets() reads { bottom: 0 } inside here and every
          sheet’s footer buttons end up clipped behind the system nav bar. */}
      {/* No KeyboardProvider here: the root one already follows a Modal’s window. A second provider shares the
          Activity’s window insets and, when it unmounts, leaves the screen underneath with a stale keyboard gap. */}
      <ModalSafeArea>
        <SheetSurfaceProvider value>
          <ModalSheetBody {...props} onClose={close} />
        </SheetSurfaceProvider>
      </ModalSafeArea>
    </Modal>
  );
}

/** The sheet has no coloured header wash any more: it is plain white. Kept so each sheet still marks where it was. */
function SheetWash() {
  return null;
}

function ModalCloseButton({
  onClose,
  disabled,
  label = 'Close',
  back = false,
  ledgerStyle = false,
}: {
  onClose: () => void;
  disabled: boolean;
  label?: string;
  back?: boolean;
  ledgerStyle?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={[styles.closeBtn, ledgerStyle && styles.ledgerClose, animatedStyle, disabled && styles.disabled]}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onClose}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather
        name={back ? 'arrow-left' : 'x'}
        size={ledgerStyle ? 17 : 20}
        color={theme.colors.textPrimary}
      />
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
      style={[styles.roundBtn, danger && styles.roundBtnDanger, animatedStyle, disabled && styles.disabled]}
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

/**
 * How a sheet arrives: it rises a short way into place while the Modal's own fade brings in the backdrop, so it settles
 * instead of appearing. A plain transform on the surface (native driver): it moves nothing in the layout, which is what
 * the Reanimated entering animation that was here once got wrong (see the note by SHEET_SHADOW). With reduce motion on it
 * is already in place.
 */
function useRise(distance: number, drag?: Animated.Value) {
  const reduceMotion = useReduceMotion();
  const [y] = useState(() => new Animated.Value(reduceMotion ? 0 : distance));
  useEffect(() => {
    if (reduceMotion) {
      y.setValue(0);
      return;
    }
    const run = Animated.timing(y, {
      toValue: 0,
      duration: DURATIONS.screen,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [reduceMotion, y]);
  return { transform: drag ? [{ translateY: y }, { translateY: drag }] : [{ translateY: y }] };
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
  ledgerStyle = false,
  dismissible = true,
  swipeFromHeader = false,
  backLabel,
  flowPage,
  flowHeight = 'shared',
  visible,
}: Props) {
  const flow = useContext(SheetFlowContext);
  const inFlow = !!flow && (!!backLabel || flowPage);
  const sharesHeight = inFlow && flowHeight === 'shared';
  const insets = useSafeAreaInsets();
  // With the keyboard up it already covers the nav bar, so the footer needs no extra bottom inset.
  const keyboardUp = useKeyboardOpen();
  const { height, fontScale } = useWindowDimensions();
  // The keyboard library places the sheet by the window's height. In a translucent-bar Modal that height leaves out the
  // status bar the window really covers, so the sheet stopped that much (about a status bar) short of the keyboard.
  const keyboardOffset = Math.min(0, height - Dimensions.get('screen').height);
  const maxHeight =
    height < 640 || fontScale > 1.2 || size === 'expanded' ? '94%' : size === 'compact' ? '78%' : '90%';
  const isSheet = variant === 'sheet';
  // A bottom sheet can be dragged down to close; a page inside a flow (it has a back arrow) is left for the arrow.
  const swipe = useSwipeToClose({
    enabled: isSheet && dismissible && !backLabel,
    onClose,
    resetKey: visible,
  });
  // The dim behind a sheet lightens as it is dragged down.
  const backdropFade = isSheet
    ? {
        opacity: swipe.drag.interpolate({
          inputRange: [0, 400],
          outputRange: [1, 0.15],
          extrapolate: 'clamp',
        }),
      }
    : undefined;
  const rise = useRise(isSheet ? 40 : 16, isSheet ? swipe.drag : undefined);
  const viewportHeight = flow?.viewportHeight ? Math.min(height, flow.viewportHeight) : height;
  // What this page needs on its own: header, content and footer as laid out. A page shared with a flow is held at
  // most FLOW_STRETCH above it, so a short page after a tall one is not left mostly empty.
  const [bands, setBands] = useState({ header: 0, content: 0, footer: 0 });
  const setBand = useCallback((band: 'header' | 'content' | 'footer', size: number) => {
    const rounded = Math.round(size);
    setBands((previous) => (previous[band] === rounded ? previous : { ...previous, [band]: rounded }));
  }, []);
  const footerHeight = footer !== undefined ? bands.footer : keyboardUp ? 0 : insets.bottom;
  const naturalHeight =
    bands.header > 0 && bands.content > 0 && (footer === undefined || bands.footer > 0)
      ? bands.header + bands.content + footerHeight
      : 0;
  const flowFrame = sharesHeight
    ? {
        minHeight: Math.min(
          flow.minimumHeight,
          Math.max(0, ((viewportHeight - insets.top - 8) * parseFloat(maxHeight)) / 100),
          naturalHeight > 0 ? naturalHeight + FLOW_STRETCH : Infinity
        ),
      }
    : undefined;
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
      <View style={[styles.header, ledgerStyle && styles.ledgerHeader]}>
        {backLabel && (
          <ModalCloseButton
            onClose={onClose}
            disabled={!dismissible}
            label={backLabel}
            back
            ledgerStyle={ledgerStyle}
          />
        )}
        <View style={styles.headerText}>
          {title ? (
            <Text accessibilityRole="header" style={[styles.title, ledgerStyle && styles.ledgerTitle]}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={[styles.subtitle, ledgerStyle && styles.ledgerSubtitle]}>{subtitle}</Text>
          ) : null}
        </View>
        {showClose && !backLabel && (
          <ModalCloseButton onClose={onClose} disabled={!dismissible} ledgerStyle={ledgerStyle} />
        )}
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
          <KeyboardAvoidingView
            behavior="padding"
            // Only while the keyboard is really up: the library starts from the last keyboard height it saw, and a
            // stale one (an earlier sheet closed while the keyboard was moving) lifted the sheet off the bottom.
            enabled={keyboardUp}
            keyboardVerticalOffset={keyboardOffset}
            style={[
              styles.flex,
              styles.alignCenter,
              {
                paddingTop: insets.top + 12,
                paddingBottom: (keyboardUp ? 0 : insets.bottom) + 12,
                paddingHorizontal: 24,
              },
            ]}
            pointerEvents="box-none"
          >
            <Animated.View
              testID="sheet-surface"
              style={[
                styles.dialog,
                styles.dialogFramed,
                dialogWidth,
                { maxHeight },
                ledgerStyle && styles.ledgerSurface,
                rise,
              ]}
            >
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
            </Animated.View>
          </KeyboardAvoidingView>
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
          <AnimatedPressable
            style={[styles.backdrop, backdropFade]}
            disabled={!dismissible}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <KeyboardAvoidingView
            behavior="padding"
            enabled={keyboardUp}
            keyboardVerticalOffset={keyboardOffset}
            style={[styles.flex, styles.alignBottom, { paddingTop: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            <Animated.View
              testID="sheet-surface"
              {...swipe.panHandlers}
              onLayout={
                sharesHeight && visible ? (event) => flow.measure(event.nativeEvent.layout.height) : undefined
              }
              style={[
                styles.framedSheet,
                sheetWidth,
                { maxHeight },
                flowFrame,
                ledgerStyle && styles.ledgerSurface,
                rise,
              ]}
            >
              <SheetWash />
              <View
                style={[styles.framedPad, ledgerStyle && styles.ledgerPad]}
                onLayout={
                  sharesHeight ? (event) => setBand('header', event.nativeEvent.layout.height) : undefined
                }
              >
                {isSheet && !backLabel && dismissible && <View pointerEvents="none" style={styles.grabber} />}
                {header}
              </View>
              <KeyboardAwareScrollView
                {...scrollTracking}
                onScroll={(e) => {
                  scrollTracking.onScroll(e);
                  swipe.onScroll(e);
                }}
                onContentSizeChange={
                  sharesHeight ? (_, contentHeight) => setBand('content', contentHeight) : undefined
                }
                style={[styles.framedBody, inFlow && styles.flowBody]}
                contentContainerStyle={styles.framedSheetContent}
                bottomOffset={24}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </KeyboardAwareScrollView>
              {footer !== undefined ? (
                <View
                  onLayout={
                    sharesHeight ? (event) => setBand('footer', event.nativeEvent.layout.height) : undefined
                  }
                  style={[
                    styles.framedSheetFooter,
                    ledgerStyle && styles.ledgerFooter,
                    { paddingBottom: pad ? 10 : 12 + (keyboardUp ? 0 : insets.bottom) },
                  ]}
                >
                  {footer}
                </View>
              ) : pad ? null : (
                <View style={{ height: keyboardUp ? 0 : insets.bottom }} />
              )}
              {pad && (
                <View
                  style={[
                    styles.sheetDock,
                    ledgerStyle && styles.ledgerSurface,
                    { paddingBottom: 12 + insets.bottom },
                  ]}
                >
                  {pad}
                </View>
              )}
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </AmountPadHostProvider>
    );
  }

  const body = (
    <Animated.View
      {...(isSheet && !swipeFromHeader ? swipe.panHandlers : {})}
      style={[
        isSheet ? [styles.sheet, sheetWidth] : [styles.dialog, dialogWidth],
        ledgerStyle && styles.ledgerSurface,
        ledgerStyle && isSheet && styles.ledgerPad,
        stripView && styles.dialogStriped,
        { paddingBottom: isSheet ? 24 + insets.bottom : 20 },
        rise,
      ]}
    >
      <SheetWash />
      {isSheet && !backLabel && dismissible && <View pointerEvents="none" style={styles.grabber} />}
      {stripView}
      {swipeFromHeader && isSheet ? <View {...swipe.panHandlers}>{header}</View> : header}
      {children}
      {pad && <View style={styles.inlineDock}>{pad}</View>}
    </Animated.View>
  );

  return (
    <AmountPadHostProvider value={host}>
      <View style={styles.flex}>
        {/* The backdrop is its own sibling rather than a parent of the sheet:
          a parent Pressable would swallow every tap inside the sheet too. */}
        <AnimatedPressable
          style={[styles.backdrop, backdropFade]}
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
              : { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingHorizontal: 24 },
          ]}
          pointerEvents="box-none"
        >
          {body}
        </View>
      </View>
    </AmountPadHostProvider>
  );
}

/*
 * The sheet surface is a plain View on purpose. A Modal is its own Android window, and its content is laid out
 * once at one size and again when the window reports its real one; a Reanimated entering animation on the surface
 * (the 16 pt rise that was here) can keep the first frame, which left a sheet standing about a status bar plus a
 * navigation bar above the bottom of the screen. The Modal's own fade brings backdrop and sheet in together.
 * src/__tests__/sheetSurface.test.ts keeps layout animations off it.
 */
const SHEET_SHADOW = themedValue(() => ({
  shadowColor: theme.colors.ink,
  shadowOffset: { width: 0, height: -6 },
  shadowOpacity: 0.08,
  shadowRadius: 22,
  elevation: 8,
}));

const styles = themedStyles(() =>
  StyleSheet.create({
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

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
      minHeight: 48,
    },
    headerText: { flex: 1, minWidth: 0 },
    ledgerHeader: { gap: 8, marginBottom: 8, minHeight: 44 },
    ledgerTitle: { fontFamily: theme.font.bodyBold, fontSize: 19 },
    ledgerSubtitle: { color: theme.colors.home.secondaryText, marginTop: 2 },
    ledgerSurface: { backgroundColor: theme.colors.home.background },
    ledgerPad: { paddingTop: 12 },
    ledgerFooter: { backgroundColor: theme.colors.home.background, borderColor: theme.colors.home.edge },
    ledgerClose: { backgroundColor: theme.colors.home.control, borderColor: theme.colors.home.edge },
    title: { fontFamily: theme.font.bodyBold, fontSize: 19, color: theme.colors.textPrimary },
    subtitle: {
      fontFamily: theme.font.body,
      fontSize: 12,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },

    // --- pinned-footer layouts ---
    framedPad: { paddingHorizontal: 20, paddingTop: 20 },
    // The small bar at the top of a sheet that says it can be dragged down.
    grabber: {
      position: 'absolute',
      top: 8,
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.borderSoft,
    },
    framedBody: { flexGrow: 0, flexShrink: 1 },
    flowBody: { flexGrow: 1 },
    framedSheet: {
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      flexShrink: 1,
      ...SHEET_SHADOW,
    },
    framedSheetContent: { paddingHorizontal: 20, paddingBottom: 20 },
    framedSheetFooter: {
      paddingHorizontal: 20,
      paddingTop: 12,
      backgroundColor: theme.colors.surfaceAlt,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.divider,
    },
    framedDialogContent: { paddingHorizontal: 20, paddingBottom: 8 },
    sheetDock: { paddingHorizontal: 16, paddingTop: 2, backgroundColor: theme.colors.surface },
    dialogDock: { paddingHorizontal: 16, paddingBottom: 14, backgroundColor: theme.colors.surface },
    inlineDock: { marginTop: 12 },
    framedDialogFooter: {
      paddingHorizontal: 20,
      paddingTop: 12,
      backgroundColor: theme.colors.surface,
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
    disabled: { opacity: theme.opacity.disabled },
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
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 20,
      ...SHEET_SHADOW,
    },
    dialog: {
      backgroundColor: theme.colors.surface,
      borderRadius: 28,
      padding: 20,
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
  })
);
