module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Must be listed last — required by expo-router / react-navigation
      "react-native-reanimated/plugin",
    ],
  };
};
