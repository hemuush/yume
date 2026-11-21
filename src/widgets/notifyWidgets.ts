import Constants, { ExecutionEnvironment } from 'expo-constants';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { WIDGET_NAMES, renderWidgetByName } from './registry';

/**
 * Pushes fresh data to every placed Yume widget (they self-refresh every 30 min, Android's minimum). Called
 * once from `app/_layout.tsx` on backgrounding, not per mutation: edits happen while the app is open.
 */
export function refreshAllWidgets(): void {
  // Expo Go has no widget module (widgets need a real build), so there is nothing to refresh and each call would only warn.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
  for (const name of WIDGET_NAMES) {
    requestWidgetUpdate({
      widgetName: name,
      renderWidget: () => renderWidgetByName(name),
    }).catch((e) => {
      console.warn(`Widget refresh failed for "${name}":`, e);
    });
  }
}
