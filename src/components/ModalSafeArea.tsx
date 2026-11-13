import { useState, type ReactNode } from 'react';
import { Dimensions } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

/** How far short of the screen a Modal's content area fell, when that is the size of the status and navigation bars. */
export function modalShortfall(screenHeight: number, measuredHeight: number, barsHeight: number): number {
  const missing = screenHeight - measuredHeight;
  // Only the one signature: short by the bars, and nothing else (a split-screen window is short by far more).
  return missing > 1 && barsHeight > 0 && Math.abs(missing - barsHeight) <= 3 ? missing : 0;
}

/**
 * The safe-area provider every Modal's content sits in. A Modal is its own Android window, edge to edge, but its
 * content area has been laid out at the screen height less the status and navigation bars (a sheet then stands that
 * far above the bottom, with the page showing under it, as seen on a Samsung phone with three-button navigation).
 * When the first layout is short by exactly the two bars, the provider is given the screen's height instead.
 * shortfall: the one signature is matched, so a window that really is smaller (split screen) is left alone; remove
 * this once a device shows sheets reaching the bottom without it.
 */
export function ModalSafeArea({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState<number | null>(null);
  const bars = (initialWindowMetrics?.insets.top ?? 0) + (initialWindowMetrics?.insets.bottom ?? 0);
  return (
    <SafeAreaProvider
      initialMetrics={initialWindowMetrics}
      style={height != null ? { flex: 0, height } : undefined}
      onLayout={(event) => {
        if (height != null) return;
        const screen = Dimensions.get('screen').height;
        if (modalShortfall(screen, event.nativeEvent.layout.height, bars) > 0) setHeight(screen);
      }}
    >
      {children}
    </SafeAreaProvider>
  );
}
