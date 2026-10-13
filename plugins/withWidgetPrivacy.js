const fs = require('node:fs');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const LIBRARY_PROVIDER = 'com.reactnativeandroidwidget.RNWidgetImageProvider';

/** Keep widget rendering available to the selected launcher, not every installed app. */
function hardenManifest(manifest, packageName) {
  manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  const application = manifest.application[0];
  application.provider ??= [];
  application.provider = application.provider.filter(
    (p) => ![LIBRARY_PROVIDER, `${packageName}.PrivateWidgetImageProvider`].includes(p.$['android:name'])
  );
  application.provider.push(
    { $: { 'android:name': LIBRARY_PROVIDER, 'tools:node': 'remove' } },
    {
      $: {
        'android:name': `${packageName}.PrivateWidgetImageProvider`,
        'android:authorities': `${packageName}.rnwidget.imageprovider`,
        // The provider checks Binder UID before opening any file. A private provider alone would
        // break RemoteViews on older launchers, which do not grant content URI permissions.
        'android:exported': 'true',
      },
    }
  );
  manifest.queries ??= [{}];
  const queries = manifest.queries[0];
  queries.intent ??= [];
  if (
    !queries.intent.some((i) =>
      i.category?.some((c) => c.$['android:name'] === 'android.intent.category.HOME')
    )
  ) {
    queries.intent.push({
      action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
      category: [{ $: { 'android:name': 'android.intent.category.HOME' } }],
    });
  }
  return manifest;
}

function providerSource(packageName) {
  return `package ${packageName};

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Binder;
import android.os.ParcelFileDescriptor;
import android.os.Process;
import com.reactnativeandroidwidget.RNWidgetImageProvider;
import java.io.FileNotFoundException;

/** Financial widget images are readable only by this app, Android or the current home launcher. */
public class PrivateWidgetImageProvider extends RNWidgetImageProvider {
  @Override
  public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
    int caller = Binder.getCallingUid();
    if (caller != Process.myUid() && caller != Process.SYSTEM_UID) {
      Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
      ResolveInfo launcher = getContext().getPackageManager().resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY);
      if (launcher == null || launcher.activityInfo == null || launcher.activityInfo.applicationInfo.uid != caller) {
        throw new FileNotFoundException("Widget image access denied");
      }
    }
    String name = uri.getLastPathSegment();
    if (name == null || !name.replaceAll("\\\\?.*", "").matches("widget_[0-9]+_mode_(light|dark)(_collection_[0-9]+_[0-9]+)?\\\\.png")) {
      throw new FileNotFoundException("Invalid widget image");
    }
    return super.openFile(uri, mode);
  }
}
`;
}

module.exports = function withWidgetPrivacy(config) {
  const packageName = config.android?.package;
  if (!packageName || !/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageName)) {
    throw new Error('Widget privacy requires a valid Android package');
  }
  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults.manifest = hardenManifest(cfg.modResults.manifest, packageName);
    return cfg;
  });
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const directory = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        ...packageName.split('.')
      );
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'PrivateWidgetImageProvider.java'), providerSource(packageName));
      return cfg;
    },
  ]);
};
module.exports.hardenManifest = hardenManifest;
module.exports.providerSource = providerSource;
