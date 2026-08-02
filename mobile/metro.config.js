// Default Expo Metro config (i18n packs live under mobile/src/i18n/packs).
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;
