import type { WidgetTaskHandler } from 'react-native-android-widget';
import { isWidgetName, renderWidgetByName } from './registry';

/**
 * The one entry point Android calls into — added on the home screen,
 * resized, its own `updatePeriodMillis` interval firing, or tapped — routed
 * through a headless JS context with no screen and no React tree (hence no
 * hooks anywhere under `src/widgets/`). Registered in `index.js`, the app's
 * real entry point once this feature lands (`expo-router/entry` no longer
 * covers it alone — see that file's own comment).
 *
 * `WIDGET_CLICK` isn't handled here at all: every click in these five
 * widgets uses the library's own built-in `OPEN_APP`/`OPEN_URI` actions,
 * which Android executes before this handler is ever invoked for a click —
 * there's no custom click action anywhere in `src/widgets/` that would need
 * a branch here.
 */
export const widgetTaskHandler: WidgetTaskHandler = async (props) => {
  const { widgetName } = props.widgetInfo;
  if (!isWidgetName(widgetName)) return;
  if (props.widgetAction === 'WIDGET_DELETED') return;

  try {
    const element = await renderWidgetByName(widgetName);
    props.renderWidget(element);
  } catch (e) {
    // A DB hiccup (or, on a very first cold start, the app's own migrations
    // still running) must not crash the whole headless task — better a
    // stale widget for one refresh cycle than the widget disappearing.
    console.warn(`Widget render failed for "${widgetName}":`, e);
  }
};
