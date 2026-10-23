import { requireOptionalNativeModule } from 'expo';
import { getThemeIconFollows, getThemeId } from '@/db/settings';
import { DEFAULT_THEME_ID, THEMES, themeById } from '@/theme/themes';

/** The native launcher-alias switcher (modules/yume-app-icon); absent in Jest and in builds without it. */
interface AppIconModule {
  getIcon(ids: string[]): string | null;
  setIcon(id: string, ids: string[]): Promise<void>;
}
const native = requireOptionalNativeModule<AppIconModule>('YumeAppIcon');

/** One launcher icon per pack, named by pack id (plugins/withThemeAppIcons.js reads the same list from app.json). */
export const APP_ICON_IDS = THEMES.map((t) => t.id);

export const appIconSupported = (): boolean => native != null;

/** The icon the launcher shows now, or null if unknown or unsupported. */
export function currentAppIcon(): string | null {
  try {
    return native?.getIcon(APP_ICON_IDS) ?? null;
  } catch {
    return null;
  }
}

/** The icon the settings call for: the pack's own when following the theme, otherwise Yume's. */
export function wantedAppIcon(follows: boolean, themeId: string | null): string {
  return follows && themeById(themeId) ? themeId! : DEFAULT_THEME_ID;
}

/** Brings the launcher icon in line with the setting; never throws. Returns whether it changed anything. */
export async function syncAppIcon(): Promise<boolean> {
  if (!native) return false;
  try {
    const [follows, themeId] = await Promise.all([getThemeIconFollows(), getThemeId()]);
    const wanted = wantedAppIcon(follows, themeId);
    const current = currentAppIcon();
    if (current == null || current === wanted) return false;
    await native.setIcon(wanted, APP_ICON_IDS);
    return true;
  } catch (err) {
    console.error('Could not update the app icon:', err);
    return false;
  }
}
