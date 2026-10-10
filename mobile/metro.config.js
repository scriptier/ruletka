// Default Expo Metro config (i18n packs live under mobile/src/i18n/packs).
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
// Face model is a .tflite asset. The native interpreter is not installed yet.
config.resolver.assetExts.push("tflite");

module.exports = config;
