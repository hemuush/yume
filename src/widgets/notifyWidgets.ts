import { requestWidgetUpdate } from 'react-native-android-widget';
import { WIDGET_NAMES, renderWidgetByName } from './registry';

/**
 * Pushes fresh data to every Yume widget actually placed on the home
 * screen. Widgets also refresh on their own every 30 minutes (Android's own
 * minimum interval, set per-widget in app.json), but that's too slow right
 * after, say, logging a big expense.
 *
 * Rather than wiring an explicit call into every individual mutation
 * function across the app (transactions, loans, recurring rules, accounts —
 * a lot of call sites for a lot of risk), this is called once from
 * `app/_layout.tsx` whenever the app is backgrounded: every real edit
 * happens while the app is open, so the moment the user actually leaves to
 * go look at their home screen, all five widgets catch up at once.
 * `requestWidgetUpdate` itself is cheap to call for a widget with no
 * instances on the home screen — the library only invokes `renderWidget`
 * (and so only runs the underlying DB query) for widgets actually placed.
 */
export function refreshAllWidgets(): void {
  for (const name of WIDGET_NAMES) {
    requestWidgetUpdate({
      widgetName: name,
      renderWidget: () => renderWidgetByName(name),
    }).catch((e) => {
      console.warn(`Widget refresh failed for "${name}":`, e);
    });
  }
}
