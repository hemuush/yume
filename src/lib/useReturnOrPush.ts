import { useNavigation, router, Href } from 'expo-router';

/** A screen in the stack: its route name (the file path, e.g. `category/[id]`) and, optionally, params that must match. */
export interface RouteMatch {
  name: string;
  params?: Record<string, string>;
}

interface NavRoute {
  name: string;
  params?: object;
}

/**
 * Goes to a screen without stacking a second copy of one already open (stops Budgets ⇄ category loops).
 * Already there → nothing (returns 'here'); right below → back; further down → back to it; else push.
 */
export function useReturnOrPush(): (target: RouteMatch, href: Href) => 'here' | 'back' | 'push' {
  const navigation = useNavigation();
  return (target, href) => {
    const state = navigation.getState() as { routes: NavRoute[]; index: number } | undefined;
    const routes = state?.routes ?? [];
    const index = state?.index ?? routes.length - 1;
    const matches = (r: NavRoute | undefined) => {
      if (!r || r.name !== target.name) return false;
      const params = (r.params ?? {}) as Record<string, unknown>;
      return Object.entries(target.params ?? {}).every(([k, v]) => params[k] === v);
    };
    if (matches(routes[index])) return 'here';
    if (index > 0 && matches(routes[index - 1])) {
      router.back();
      return 'back';
    }
    if (routes.slice(0, index).some(matches)) {
      router.dismissTo(href);
      return 'back';
    }
    router.push(href);
    return 'push';
  };
}
