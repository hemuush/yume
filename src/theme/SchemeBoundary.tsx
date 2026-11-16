import { Fragment, useSyncExternalStore, type ReactNode } from 'react';
import { getSchemeVersion, subscribeScheme } from './scheme';

/**
 * Re-renders the component when the colour mode changes. A screen is redrawn by `SchemeBoundary`; anything that
 * sits outside the screens (a dialog host, a toast, the status bar) calls this instead.
 */
export function useSchemeVersion(): number {
  return useSyncExternalStore(subscribeScheme, getSchemeVersion, getSchemeVersion);
}

/**
 * Draws its children again, from scratch, whenever the colour mode changes, so every colour and every style sheet
 * is read in the new mode. Put around each screen (via the navigators' `screenLayout`), not around a navigator,
 * so where the person is in the app is kept.
 */
export function SchemeBoundary({ children }: { children: ReactNode }) {
  const version = useSchemeVersion();
  return <Fragment key={version}>{children}</Fragment>;
}

/** For a navigator's `screenLayout`: every screen of it is wrapped in a `SchemeBoundary`. */
export function schemeScreenLayout({ children }: { children: ReactNode }) {
  return <SchemeBoundary>{children}</SchemeBoundary>;
}

/**
 * For the root stack's `screenLayout`: every pushed screen is wrapped in a `SchemeBoundary`, except the one that
 * holds the tabs. That one keeps its navigator (and so the tab the person is on) mounted; the tabs wrap their own
 * screens with `schemeScreenLayout` and the tab bar subscribes by itself.
 */
export function stackScreenLayout({ route, children }: { route: { name: string }; children: ReactNode }) {
  return route.name === '(tabs)' ? <>{children}</> : <SchemeBoundary>{children}</SchemeBoundary>;
}
