import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  // Pages that have opened in this flow. A lone page is only as tall as its own content; the shared minimum
  // (which stops the sheet jumping between pages) applies once a second page has been shown.
  const seen = useRef(new Set<string>());
  const [pageCount, setPageCount] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [viewportHeight, setViewportHeight] = useState(0);
  const register = useCallback((id: string, close: () => void) => {
    handlers.current.set(id, close);
    if (!seen.current.has(id)) {
      seen.current.add(id);
      setPageCount(seen.current.size);
    }
    return () => {
      handlers.current.delete(id);
      // When the last page has closed the flow starts over, so a later lone page isn't sized by an old second one.
      queueMicrotask(() => {
        if (mounted.current && handlers.current.size === 0) {
          seen.current.clear();
          setPageCount(0);
          setMinimumHeight(0);
        }
      });
    };
  }, []);
  const measure = useCallback((height: number) => {
    if (height > 0) setMinimumHeight((previous) => Math.max(previous, Math.round(height)));
  }, []);
  const value = useMemo(
    () => ({ register, measure, minimumHeight: pageCount > 1 ? minimumHeight : 0, viewportHeight }),
    [register, measure, minimumHeight, pageCount, viewportHeight]
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
