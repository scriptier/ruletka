/**
 * Autolinking: never ship expo-dev-client in store / release builds.
 * Enable only for local dev clients (EXPO_DEV_CLIENT=1 or EAS profile development).
 */
const wantDevClient =
  process.env.EXPO_DEV_CLIENT === "1" ||
  process.env.EAS_BUILD_PROFILE === "development";

module.exports = {
  dependencies: {
    ...(wantDevClient
      ? {}
      : {
          "expo-dev-client": {
            platforms: {
              android: null,
              ios: null,
            },
          },
        }),
  },
};
