// Static config lives in app.json; this only layers on what depends on the build.
// Yume has no network code, so EAS release builds drop INTERNET. Local debug
// builds keep it, because Metro reaches the phone over the network.
//
// Diagnostic switches, set only by the diagnose-* profiles in eas.json, for finding which release-build setting
// breaks a build (change one thing at a time):
//   YUME_R8_PRESET=legacy  use SDK 57's non-optimising R8 preset instead of SDK 58's optimising one
//   YUME_MINIFY=off        build the release variant without R8 shrinking, minification or resource shrinking
module.exports = ({ config }) => {
  let next = config;

  if (process.env.EAS_BUILD_PROFILE) {
    const android = next.android ?? {};
    next = {
      ...next,
      android: {
        ...android,
        blockedPermissions: [...(android.blockedPermissions ?? []), 'android.permission.INTERNET'],
      },
    };
  }

  if (process.env.YUME_R8_PRESET === 'legacy') {
    next = { ...next, plugins: [...(next.plugins ?? []), './plugins/withLegacyR8Preset'] };
  }

  if (process.env.YUME_MINIFY === 'off') {
    next = {
      ...next,
      plugins: (next.plugins ?? []).map((plugin) =>
        Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
          ? [
              plugin[0],
              {
                ...plugin[1],
                android: {
                  ...plugin[1]?.android,
                  enableProguardInReleaseBuilds: false,
                  enableShrinkResourcesInReleaseBuilds: false,
                  enableMinifyInReleaseBuilds: false,
                },
              },
            ]
          : plugin
      ),
    };
  }

  return next;
};
