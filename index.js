// Yume's real entry point once home-screen widgets landed — plain
// `"expo-router/entry"` (the previous value of package.json's `main`) only
// registers the app's own root component, and `registerWidgetTaskHandler`
// needs to run before/alongside that so Android's headless widget task has
// something to call into. `expo-router/entry` itself still does all of its
// usual work; this file only adds the one extra registration on top of it.
//
// A diagnose-modules build (EXPO_PUBLIC_YUME_DIAG=modules) starts a plain checklist screen instead, to find which
// library closes a release APK. Both paths use require so the other path's modules are not loaded at start.
if (process.env.EXPO_PUBLIC_YUME_DIAG === 'modules') {
  require('./src/diagnostics/startDiagnostics');
} else {
  require('expo-router/entry');
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widgets/widgetTaskHandler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
