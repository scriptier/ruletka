package me.ruletka.app

import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * Pin a launcher shortcut to the home screen (user must confirm on Android 8+).
 * Silent pin is not allowed by the OS — requestPinShortcut always shows a dialog.
 */
@ReactModule(name = RuletkaShortcutsModule.NAME)
class RuletkaShortcutsModule(
  private val ctx: ReactApplicationContext
) : ReactContextBaseJavaModule(ctx) {

  override fun getName(): String = NAME

  @ReactMethod
  fun isPinSupported(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        promise.resolve(false)
        return
      }
      val sm = ctx.getSystemService(ShortcutManager::class.java)
      promise.resolve(sm?.isRequestPinShortcutSupported == true)
    } catch (_: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun requestPinHomeShortcut(shortLabel: String, longLabel: String, promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        promise.resolve(false)
        return
      }
      val sm = ctx.getSystemService(ShortcutManager::class.java)
      if (sm == null || !sm.isRequestPinShortcutSupported) {
        promise.resolve(false)
        return
      }
      val launch = Intent(ctx, MainActivity::class.java).apply {
        action = Intent.ACTION_MAIN
        addCategory(Intent.CATEGORY_LAUNCHER)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      val info = ShortcutInfo.Builder(ctx, "ruletka_home")
        .setShortLabel(shortLabel.ifBlank { "ruletka" })
        .setLongLabel(longLabel.ifBlank { "ruletka" })
        .setIcon(Icon.createWithResource(ctx, R.mipmap.ic_launcher))
        .setIntent(launch)
        .build()
      val ok = sm.requestPinShortcut(info, null)
      promise.resolve(ok)
    } catch (e: Exception) {
      promise.reject("PIN_FAILED", e.message, e)
    }
  }

  companion object {
    const val NAME = "RuletkaShortcuts"
  }
}
