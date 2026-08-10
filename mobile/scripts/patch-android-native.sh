#!/usr/bin/env bash
# Re-apply native patches after `expo prebuild` (signing + shortcuts module).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_JAVA="$ROOT/android/app/src/main/java/me/ruletka/app"
PATCHES="$ROOT/android-patches"

if [[ ! -d "$ROOT/android" ]]; then
  echo "No android/ — run expo prebuild first" >&2
  exit 1
fi

mkdir -p "$APP_JAVA"
cp -a "$PATCHES/RuletkaShortcutsModule.kt" "$APP_JAVA/"
cp -a "$PATCHES/RuletkaShortcutsPackage.kt" "$APP_JAVA/"
echo "copied RuletkaShortcuts Module+Package"

# Register package in MainApplication.kt if missing
MAIN="$APP_JAVA/MainApplication.kt"
if [[ -f "$MAIN" ]] && ! grep -q 'RuletkaShortcutsPackage' "$MAIN"; then
  python3 - "$MAIN" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
t = p.read_text()
needle = "val packages = PackageList(this).packages"
if needle in t and "RuletkaShortcutsPackage" not in t:
    t = t.replace(
        needle,
        needle + "\n            packages.add(RuletkaShortcutsPackage())",
    )
    p.write_text(t)
    print("MainApplication: registered RuletkaShortcutsPackage")
else:
    print(
        "MainApplication: skip register",
        "already" if "RuletkaShortcutsPackage" in t else "no needle",
    )
PY
elif [[ -f "$MAIN" ]]; then
  echo "MainApplication: RuletkaShortcutsPackage already registered"
else
  echo "WARN: MainApplication.kt missing" >&2
fi

# Signing (release keystore)
python3 - "$ROOT" <<'PY'
from pathlib import Path
import re
import sys
root = Path(sys.argv[1])
g = root / "android/app/build.gradle"
t = g.read_text()
if "keystore.properties" in t:
    print("signing already patched")
else:
    t2 = re.sub(
        r"signingConfigs \{.*?buildTypes \{\s*debug \{.*?release \{\s*// Caution!.*?signingConfig signingConfigs\.debug",
        """signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            def ksPropsFile = rootProject.file("../secrets/keystore.properties")
            if (ksPropsFile.exists()) {
                def ks = new Properties()
                ksPropsFile.withInputStream { ks.load(it) }
                storeFile rootProject.file("../secrets/${ks['storeFile']}")
                storePassword ks['storePassword']
                keyAlias ks['keyAlias']
                keyPassword ks['keyPassword']
            }
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            def hasReleaseKs = rootProject.file("../secrets/keystore.properties").exists()
            signingConfig hasReleaseKs ? signingConfigs.release : signingConfigs.debug""",
        t,
        count=1,
        flags=re.S,
    )
    if t2 != t:
        g.write_text(t2)
        print("signing patched")
    else:
        print("WARN: could not patch signing")
PY

# extractNativeLibs
MAN="$ROOT/android/app/src/main/AndroidManifest.xml"
if [[ -f "$MAN" ]] && ! grep -q 'extractNativeLibs' "$MAN"; then
  sed -i 's/<application /<application android:extractNativeLibs="true" /' "$MAN"
  echo "manifest extractNativeLibs=true"
fi

# Dark theme (Expo prebuild defaults to Theme.AppCompat.Light → white Friends UI)
STYLES="$ROOT/android/app/src/main/res/values/styles.xml"
if [[ -f "$STYLES" ]] && grep -q 'Theme.AppCompat.Light' "$STYLES"; then
  cat >"$STYLES" <<'XML'
<resources xmlns:tools="http://schemas.android.com/tools">
  <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="android:forceDarkAllowed" tools:targetApi="q">false</item>
    <item name="android:windowBackground">@color/splashscreen_background</item>
    <item name="android:colorBackground">@color/splashscreen_background</item>
    <item name="android:textColor">#e8eef7</item>
    <item name="android:textColorPrimary">#e8eef7</item>
    <item name="android:textColorSecondary">#9aa8bc</item>
    <item name="android:textColorHint">#6b7a90</item>
    <item name="android:editTextStyle">@style/ResetEditText</item>
    <item name="android:editTextBackground">@drawable/rn_edit_text_material</item>
    <item name="colorPrimary">@color/colorPrimary</item>
    <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
    <item name="colorAccent">@color/colorPrimary</item>
    <item name="android:statusBarColor">#07080c</item>
    <item name="android:navigationBarColor">#07080c</item>
    <item name="android:windowLightStatusBar">false</item>
    <item name="android:windowLightNavigationBar" tools:targetApi="o_mr1">false</item>
  </style>
  <style name="ResetEditText" parent="@android:style/Widget.EditText">
    <item name="android:padding">0dp</item>
    <item name="android:textColorHint">#6b7a90</item>
    <item name="android:textColor">#e8eef7</item>
    <item name="android:background">@android:color/transparent</item>
  </style>
  <style name="Theme.App.SplashScreen" parent="AppTheme">
    <item name="android:windowBackground">@drawable/ic_launcher_background</item>
  </style>
</resources>
XML
  echo "styles.xml: dark AppTheme"
fi
NIGHT_STYLES="$ROOT/android/app/src/main/res/values-night/styles.xml"
mkdir -p "$(dirname "$NIGHT_STYLES")"
if [[ ! -f "$NIGHT_STYLES" ]] || grep -q 'Theme.AppCompat.Light' "$NIGHT_STYLES" 2>/dev/null; then
  cp -a "$STYLES" "$NIGHT_STYLES" 2>/dev/null || true
  # night styles file should not re-define Splash if duplicated — keep full copy ok
  echo "values-night/styles.xml: dark AppTheme"
fi

echo "patch-android-native done"
