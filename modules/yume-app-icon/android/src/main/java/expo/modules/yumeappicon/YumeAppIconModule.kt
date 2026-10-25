package expo.modules.yumeappicon

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Switches the launcher icon between the `Icon<Id>` activity-aliases that plugins/withThemeAppIcons.js adds.
 * Exactly one alias is enabled at a time. MainActivity stays enabled, so shortcuts, widgets,
 * notifications and yume:// links keep resolving to it whichever icon is showing.
 */
class YumeAppIconModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("YumeAppIcon")

    // The id of the enabled alias among `ids`, or null if none is.
    Function("getIcon") { ids: List<String> ->
      val context = context()
      ids.firstOrNull { isEnabled(context, it) }
    }

    // Enables `id`'s alias first, then disables the rest, so a launcher entry always exists. DONT_KILL_APP
    // keeps the process alive, though some launchers still restart the app while they refresh the icon.
    AsyncFunction("setIcon") { id: String, ids: List<String> ->
      if (id !in ids) throw CodedException("ERR_UNKNOWN_ICON", "No launcher icon named $id", null)
      val context = context()
      val pm = context.packageManager
      val theme = splashTheme(id)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val activity = appContext.currentActivity
          ?: throw CodedException("ERR_NO_ACTIVITY", "The launch theme cannot be updated without an Activity", null)
        // Persist before switching aliases: Android draws the next launch before JS or onCreate can run.
        activity.splashScreen.setSplashScreenTheme(theme)
      }
      pm.setComponentEnabledSetting(
        alias(context, id), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP
      )
      ids.filter { it != id }.forEach {
        pm.setComponentEnabledSetting(
          alias(context, it), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP
        )
      }
    }.runOnQueue(Queues.MAIN)
  }

  private fun context(): Context =
    appContext.reactContext ?: throw CodedException("ERR_NO_CONTEXT", "The app context is unavailable", null)

  companion object {
    private var splashThemes: Map<String, Int> = emptyMap()

    /** Select the same drawable for the pre-Android-12 compat splash, before Expo installs it. */
    fun applyLaunchTheme(activity: Activity, themes: Map<String, Int>) {
      splashThemes = themes
      val id = themes.keys.firstOrNull { isEnabled(activity, it) } ?: return
      val theme = splashTheme(id)
      activity.setTheme(theme)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        activity.splashScreen.setSplashScreenTheme(theme)
      }
    }

    private fun splashTheme(id: String): Int =
      splashThemes[id] ?: throw CodedException("ERR_UNKNOWN_SPLASH", "No launch theme for $id", null)

    private fun alias(context: Context, id: String) =
      ComponentName(context.packageName, "${context.packageName}.Icon${id.replaceFirstChar { it.uppercase() }}")

    private fun isEnabled(context: Context, id: String): Boolean {
      val pm = context.packageManager
      val component = alias(context, id)
      return try {
        when (pm.getComponentEnabledSetting(component)) {
          PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
          PackageManager.COMPONENT_ENABLED_STATE_DEFAULT ->
            pm.getActivityInfo(component, PackageManager.MATCH_DISABLED_COMPONENTS).enabled
          else -> false
        }
      } catch (e: PackageManager.NameNotFoundException) {
        false
      }
    }
  }
}
