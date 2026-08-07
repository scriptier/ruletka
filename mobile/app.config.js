/**
 * Dynamic Expo config.
 * - Reads app.json base
 * - Applies env for hub + friends-only store contingency
 * - Wires WebRTC / build-properties plugins for prebuild
 */
const base = require("./app.json");

const hubBase =
  process.env.EXPO_PUBLIC_HUB_BASE?.replace(/\/$/, "") ||
  base.expo?.extra?.hubBase ||
  "https://ruletka.vip";

const friendsOnly =
  process.env.EXPO_PUBLIC_FRIENDS_ONLY === "1" ||
  process.env.EXPO_PUBLIC_FRIENDS_ONLY === "true";

// Store / Play AABs must NOT ship expo-dev-client (crashes / DevLauncher on open).
// Only wire it for explicit development builds.
const easProfile = process.env.EAS_BUILD_PROFILE || "";
const wantDevClient =
  easProfile === "development" || process.env.EXPO_DEV_CLIENT === "1";

/** @type {import('expo/config').ExpoConfig} */
const expo = {
  ...base.expo,
  name: friendsOnly ? "ruletka Friends" : base.expo.name,
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-asset",
    "expo-font",
    // expo-dev-client deliberately omitted from store builds (see package.json autolinking.exclude)
    ...(wantDevClient ? ["expo-dev-client"] : []),
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 24,
          // Play Console requires target API 35+ (Aug 2025+)
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          // Extract .so at install — more reliable on Android 15 (16KB pages)
          // when some prebuilt RN/Expo libs are still 4KB-aligned.
          useLegacyPackaging: true,
          // Real phones: arm64 only (smaller + fewer bad ABI combos)
          // (x86 still available via emulator local builds if needed)
          // RN WebRTC + modern AGP: keep packaging predictable on EAS
          packagingOptions: {
            pickFirst: [
              "**/libc++_shared.so",
              "**/libjingle_peerconnection_so.so",
            ],
          },
        },
        ios: {
          deploymentTarget: "15.1",
        },
      },
    ],
    [
      "@config-plugins/react-native-webrtc",
      {
        cameraPermission:
          "ruletka needs the camera for peer-to-peer video chat. Video goes device-to-device and is not uploaded to our servers.",
        microphonePermission:
          "ruletka needs the microphone for peer-to-peer video chat.",
      },
    ],
  ],
  ios: {
    ...base.expo.ios,
    // Universal Links (hub must serve AASA with ROULETTE_IOS_TEAM_ID)
    associatedDomains: ["applinks:ruletka.vip", "applinks:ruletka.me"],
    infoPlist: {
      ...(base.expo.ios?.infoPlist || {}),
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: [],
    },
    config: {
      usesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType:
            "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
      ],
    },
  },
  android: {
    ...base.expo.android,
    permissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.MODIFY_AUDIO_SETTINGS",
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE",
      "android.permission.BLUETOOTH",
      "android.permission.BLUETOOTH_CONNECT",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: false,
        data: [{ scheme: "ruletka" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
      // App Links (assetlinks.json + ROULETTE_ANDROID_SHA256 on hub)
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "ruletka.vip",
            pathPrefix: "/live.html",
          },
          {
            scheme: "https",
            host: "ruletka.me",
            pathPrefix: "/live.html",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  extra: {
    ...(base.expo.extra || {}),
    hubBase,
    friendsOnly,
    privacyPolicyUrl: `${hubBase}/legal/privacy.html`,
    termsUrl: `${hubBase}/legal/terms.html`,
    eulaUrl: `${hubBase}/legal/eula.html`,
    deleteDataUrl: `${hubBase}/legal/delete.html`,
    supportUrl: `${hubBase}/safety.html`,
    supportEmail: "support@ruletka.me",
    privacyEmail: "privacy@ruletka.me",
    eas: {
      ...(base.expo.extra?.eas || {}),
      // Expo project (eas init --id …)
      projectId:
        process.env.EAS_PROJECT_ID ||
        base.expo.extra?.eas?.projectId ||
        "1e9b8ca4-2dfc-4923-84d1-138222be372f",
    },
  },
};

module.exports = { expo };
