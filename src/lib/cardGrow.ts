import { useCallback, useRef } from 'react';
import type { View } from 'react-native';

export interface GrowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Listener = (rect: GrowRect) => void;

let listener: Listener | null = null;

/** The host (CardGrowHost) registers here; there is only ever one. */
export function subscribeCardGrow(next: Listener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

export function startCardGrow(rect: GrowRect): void {
  listener?.(rect);
}

/**
 * Marks a push as one that grows out of the card that opened it. The Stack reads this param to pick a fade
 * instead of a slide, so the expanding card and the screen don't fight each other.
 */
export function growHref(href: string): string {
  return `${href}${href.includes('?') ? '&' : '?'}grow=1`;
}

export const isGrowRoute = (params: unknown): boolean =>
  !!params && typeof params === 'object' && (params as { grow?: unknown }).grow === '1';

// If the measure callback never comes back the card still has to open.
const MEASURE_FALLBACK_MS = 120;

/**
 * Attach `ref` to the tapped card and wrap its navigation in `growFrom(go)`: the card's on-screen rect is
 * handed to the host, which expands from it while `go` pushes the screen. With no native view to measure (a
 * test renderer) or a zero-size rect it just calls `go`.
 */
export function useCardGrow() {
  const ref = useRef<View>(null);
  const growFrom = useCallback((go: () => void) => {
    const node = ref.current;
    if (!node || typeof node.measureInWindow !== 'function') {
      go();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      go();
    };
    const fallback = setTimeout(finish, MEASURE_FALLBACK_MS);
    node.measureInWindow((x, y, width, height) => {
      clearTimeout(fallback);
      if (done) return;
      if (width > 0 && height > 0) startCardGrow({ x, y, width, height });
      finish();
    });
  }, []);
  return { ref, growFrom };
}
