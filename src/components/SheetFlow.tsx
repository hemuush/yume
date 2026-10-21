import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { SheetSurfaceProvider } from './SheetSurface';

type SheetFlowContextValue = {
  register: (id: string, close: () => void) => () => void;
  measure: (height: number) => void;
  minimumHeight: number;
  viewportHeight: number;
};

export const SheetFlowContext = createContext<SheetFlowContextValue | null>(null);

/** Related tasks share one native window; nested flows reuse their owner's window. */
export function SheetFlow({ children, visible = true }: { children: React.ReactNode; visible?: boolean }) {
  const parent = useContext(SheetFlowContext);
  return parent ? children : <SheetFlowHost visible={visible}>{children}</SheetFlowHost>;
}

function SheetFlowHost({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  const reduceMotion = useReduceMotion();
  const handlers = useRef(new Map<string, () => void>());
  const [minimumHeight, setMinimumHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const register = useCallback((id: string, close: () => void) => {
    handlers.current.set(id, close);
    return () => {
      handlers.current.delete(id);
    };
  }, []);
  const measure = useCallback((height: number) => {
    if (height > 0) setMinimumHeight((previous) => Math.max(previous, Math.round(height)));
  }, []);
  const value = useMemo(
    () => ({ register, measure, minimumHeight, viewportHeight }),
    [register, measure, minimumHeight, viewportHeight]
  );
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => Array.from(handlers.current.values()).at(-1)?.()}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SheetSurfaceProvider value>
          <SheetFlowContext.Provider value={value}>
            <View
              testID="sheet-flow-viewport"
              style={{ flex: 1 }}
              onLayout={(event) => setViewportHeight(Math.round(event.nativeEvent.layout.height))}
            >
              {children}
            </View>
          </SheetFlowContext.Provider>
        </SheetSurfaceProvider>
      </SafeAreaProvider>
    </Modal>
  );
}
