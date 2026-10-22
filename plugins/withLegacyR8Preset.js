const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Expo SDK 58's Android template switched the release build from the `proguard-android.txt` preset (SDK 57) to
 * `proguard-android-optimize.txt`, which lets R8 inline, merge and devirtualise code instead of only shrinking it.
 * This restores the SDK 57 preset. It is only applied by the diagnostic EAS profile that sets YUME_R8_PRESET=legacy
 * (see app.config.js), to tell an optimisation-caused crash from a shrinking-caused one.
 */
function useLegacyPreset(buildGradle) {
  return buildGradle.replace(
    /getDefaultProguardFile\((["'])proguard-android-optimize\.txt\1\)/g,
    'getDefaultProguardFile("proguard-android.txt")'
  );
}

module.exports = function withLegacyR8Preset(config) {
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = useLegacyPreset(mod.modResults.contents);
    return mod;
  });
};
module.exports.useLegacyPreset = useLegacyPreset;
