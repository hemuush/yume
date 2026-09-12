import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
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
 * is already showing replaces it outright — undoing the first would silently
 * resurrect a row the user has already moved on from.
 */
export function UndoToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);

  const show = useCallback((message: string, onUndo: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    keyRef.current += 1;
    setToast({ key: keyRef.current, message, onUndo });
    timer.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
  }, []);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  return (
    <UndoToastContext.Provider value={{ show }}>
      {children}
      {toast && <ToastView key={toast.key} toast={toast} onDismiss={dismiss} />}
    </UndoToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
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
