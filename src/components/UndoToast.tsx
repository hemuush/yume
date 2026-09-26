import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import ReanimatedAnimated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ToastState {
  key: number;
  message: string;
  onUndo: () => void;
}

const UndoToastContext = createContext<{ show: (message: string, onUndo: () => void) => void } | null>(null);

// Long enough to read and react to, short enough that it never feels like it
// overstayed — the same beat Gmail/Apple Mail's own undo-send window lands
// in.
const AUTO_DISMISS_MS = 4000;

/**
 * Mounted once near the root (`app/_layout.tsx`), so any screen can call
 * `useUndoToast().show(...)` after a delete without prop-drilling a toast
 * down through every modal that might trigger one. A second delete while one
 * is already showing used to just replace it outright — silently discarding
 * the still-live ability to undo the first delete, even though that row was
 * only ever removed moments ago. Instead, only one toast is ever on screen
 * at a time, but a delete that lands while another is still showing joins a
 * queue and gets its own full `AUTO_DISMISS_MS` window once its turn comes,
 * so no undo is ever dropped without the user having actually seen it.
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
  // A ref is only ever safe to write outside render (`showNext`'s identity
  // never actually changes — it closes over nothing but stable refs and
  // setState functions — but this keeps the write out of the render body).
  useEffect(() => {
    showNextRef.current = showNext;
  }, [showNext]);

  const show = useCallback(
    (message: string, onUndo: () => void) => {
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

  return (
    <UndoToastContext.Provider value={{ show }}>
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

  return (
    <ReanimatedAnimated.View
      entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutDown.duration(180).reduceMotion(ReduceMotion.System)}
      style={[styles.wrap, { bottom: insets.bottom + 16 }]}
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
            toast.onUndo();
            onDismiss();
          }}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          hitSlop={10}
          style={animatedStyle}
          accessibilityRole="button"
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 18,
    maxWidth: 420,
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  message: { flex: 1, fontFamily: theme.font.bodyMedium, fontSize: 13.5, color: theme.colors.surface },
  undo: { fontFamily: theme.font.bodyBold, fontSize: 13.5, color: theme.colors.primary },
});
