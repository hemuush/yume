import { requireOptionalNativeModule } from 'expo';

/** The native launcher-alias switcher (modules/yume-app-icon); absent in Jest and in builds without it. */
interface AppIconModule {
  getIcon(ids: string[]): string | null;
  setIcon(id: string, ids: string[]): Promise<void>;
}
const native = requireOptionalNativeModule<AppIconModule>('YumeAppIcon');

/**
 * The launcher aliases the build still carries (plugins/withThemeAppIcons.js reads the same list from app.json). The
 * app has one theme now and always shows Yume's own icon; the others stay in the build only so that a phone that had
 * picked one of them can be put back.
 */
export const APP_ICON_IDS = [
  'yume',
  'corpsGreen',
  'hollowViolet',
  'winterEmber',
  'katawareDusk',
  'crimsonNight',
];
export const DEFAULT_APP_ICON = 'yume';

/** The icon the launcher shows now, or null if unknown or unsupported. */
function currentAppIcon(): string | null {
  try {
    return native?.getIcon(APP_ICON_IDS) ?? null;
  } catch {
    return null;
  }
}

/**
 * Puts the launcher icon back to Yume's own if an earlier version had switched it to a theme's; never throws. Returns
 * whether it changed anything.
 */
export async function restoreDefaultAppIcon(): Promise<boolean> {
  if (!native) return false;
  try {
    const current = currentAppIcon();
    if (current == null || current === DEFAULT_APP_ICON) return false;
    await native.setIcon(DEFAULT_APP_ICON, APP_ICON_IDS);
    return true;
  } catch (err) {
    console.error('Could not update the app icon:', err);
    return false;
  }
}
