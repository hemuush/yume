import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import ReanimatedAnimated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';
import { DURATIONS } from '@/lib/motionTimings';
import { useAccent } from '@/theme/AccentContext';
import { showAlert } from '@/components/AppDialog';
import { errorMessage } from '@/lib/errorMessage';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ToastState {
  key: number;
  message: string;
  onUndo: () => void | Promise<unknown>;
}

const UndoToastContext = createContext<{
  show: (message: string, onUndo: () => void | Promise<unknown>) => void;
} | null>(null);

// Long enough to read and react to, short enough not to overstay (about the Gmail/Apple Mail
// undo-send window).
const AUTO_DISMISS_MS = 4000;

/**
 * Mounted once at the root so any screen can call `useUndoToast().show(...)` after a delete. One toast at a
 * time: a delete landing while one shows is queued and gets its own full `AUTO_DISMISS_MS` (no undo dropped).
 */
export function UndoToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const queue = useRef<ToastState[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);

  // A ref, not a direct recursive reference — `showNext` scheduling its own
  // next call by name would read the binding before it's fully initialized.
  const showNextRef = useRef<() => void>(() => {});
  const showNext = useCallback(() => {
    timer.current = null;
    const next = queue.current.shift() ?? null;
    setToast(next);
    setQueuedCount(queue.current.length);
    if (next) timer.current = setTimeout(() => showNextRef.current(), AUTO_DISMISS_MS);
  }, []);
  // Refs are only safe to write outside render; `showNext` is stable (closes over refs and setState only),
  // so this keeps the write out of the render body.
  useEffect(() => {
    showNextRef.current = showNext;
  }, [showNext]);

  const show = useCallback(
    (message: string, onUndo: () => void | Promise<unknown>) => {
      keyRef.current += 1;
      queue.current.push({ key: keyRef.current, message, onUndo });
      if (!timer.current) {
        showNext();
      } else {
        setQueuedCount(queue.current.length);
      }
    },
    [showNext]
  );

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    showNext();
  }, [showNext]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <UndoToastContext.Provider value={value}>
      {children}
      {toast && <ToastView key={toast.key} toast={toast} onDismiss={dismiss} queued={queuedCount} />}
    </UndoToastContext.Provider>
  );
}

function ToastView({
  toast,
  onDismiss,
  queued,
}: {
  toast: ToastState;
  onDismiss: () => void;
  queued: number;
}) {
  const insets = useSafeAreaInsets();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.94);
  const { accent } = useAccent();

  // A toast is silent to TalkBack otherwise (it never takes focus); MilestoneNote announces the same way.
  // Each toast mounts its own ToastView (keyed), so this speaks once per toast.
  useEffect(() => {
    void AccessibilityInfo.announceForAccessibility(`${toast.message}. Undo available.`);
  }, [toast.message]);

  return (
    <ReanimatedAnimated.View
      entering={FadeInDown.duration(DURATIONS.slideIn).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutDown.duration(DURATIONS.rowExit).reduceMotion(ReduceMotion.System)}
      // Always clear of the tab bar, which most deletes happen above.
      style={[styles.wrap, { bottom: insets.bottom + theme.layout.tabBar.height + 12 }]}
      pointerEvents="box-none"
    >
      <View style={styles.pill}>
        <Text style={styles.message} numberOfLines={1}>
          {toast.message}
          {/* Another delete landed while this toast was still showing — say so,
              so the still-queued undo doesn't feel like it vanished. */}
          {queued > 0 ? ` · +${queued} more` : ''}
        </Text>
        <AnimatedPressable
          onPress={() => {
            haptics.tap();
            // A failed undo must say so: otherwise the entry stays gone while it looks put back.
            const fail = (e: unknown) => showAlert("Couldn't undo", errorMessage(e));
            try {
              void Promise.resolve(toast.onUndo()).catch(fail);
            } catch (e) {
              fail(e);
            }
            onDismiss();
          }}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          // The word is ~18dp tall; the slop reaches toward 48dp (the pill caps it).
          hitSlop={{ top: 15, bottom: 15, left: 8, right: 8 }}
          style={[styles.undoChip, { backgroundColor: shade(accent, 90) }, animatedStyle]}
          accessibilityRole="button"
          accessibilityLabel="Undo"
        >
          <Text style={styles.undo}>Undo</Text>
        </AnimatedPressable>
      </View>
    </ReanimatedAnimated.View>
  );
}

export function useUndoToast() {
  const ctx = useContext(UndoToastContext);
  if (!ctx) throw new Error('useUndoToast must be used within UndoToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  // A white pill lifted like the StripCards, with Undo on a chip in the theme's colour.
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    paddingVertical: 8,
    paddingLeft: 18,
    paddingRight: 8,
    maxWidth: 420,
    shadowColor: theme.colors.link,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  message: { flex: 1, fontFamily: theme.font.bodyMedium, fontSize: 13.5, color: theme.colors.textPrimary },
  undoChip: { borderRadius: theme.radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  undo: { fontFamily: theme.font.bodyBold, fontSize: 13.5, color: theme.colors.ink },
});
