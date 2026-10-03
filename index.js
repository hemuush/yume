// Yume's real entry point once home-screen widgets landed — plain
// `"expo-router/entry"` (the previous value of package.json's `main`) only
// registers the app's own root component, and `registerWidgetTaskHandler`
// needs to run before/alongside that so Android's headless widget task has
// something to call into. `expo-router/entry` itself still does all of its
// usual work; this file only adds the one extra registration on top of it.
import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widgets/widgetTaskHandler';

registerWidgetTaskHandler(widgetTaskHandler);
