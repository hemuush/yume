import type { WidgetTaskHandler } from 'react-native-android-widget';
import { isWidgetName, renderWidgetByName } from './registry';

/**
 * The one entry Android calls (add, resize, `updatePeriodMillis`, tap), headless with no React tree, hence no
 * hooks in `src/widgets/`. Clicks use built-in `OPEN_APP`/`OPEN_URI`, so there is no `WIDGET_CLICK` branch.
 */
export const widgetTaskHandler: WidgetTaskHandler = async (props) => {
  const { widgetName } = props.widgetInfo;
  if (!isWidgetName(widgetName)) return;
  if (props.widgetAction === 'WIDGET_DELETED') return;

  try {
    const element = await renderWidgetByName(widgetName);
    props.renderWidget(element);
  } catch (e) {
    // A DB hiccup (or first cold-start migrations still running) must not crash the headless task:
    // a stale widget for one cycle beats it disappearing.
    console.warn(`Widget render failed for "${widgetName}":`, e);
  }
};
