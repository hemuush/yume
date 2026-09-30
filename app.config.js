// Static config lives in app.json; this only layers on what depends on the build.
// Yume has no network code, so EAS release builds drop INTERNET. Local debug
// builds keep it, because Metro reaches the phone over the network.
module.exports = ({ config }) => {
  if (!process.env.EAS_BUILD_PROFILE) return config;
  const android = config.android ?? {};
  return {
    ...config,
    android: {
      ...android,
      blockedPermissions: [...(android.blockedPermissions ?? []), 'android.permission.INTERNET'],
    },
  };
};
