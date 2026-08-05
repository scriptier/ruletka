/**
 * Mobile-only strings. Loaded per language from ./overlay/*.json
 * Missing keys fall back to EN in i18n/index.tsx.
 */
export type Overlay = Record<string, string>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const MOBILE_EN: Overlay = require("./overlay/en.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const MOBILE_RU: Overlay = require("./overlay/ru.json");

export const MOBILE_BY_LANG: Record<string, Overlay> = {
  en: MOBILE_EN,
  ru: MOBILE_RU,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  de: require("./overlay/de.json"),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  es: require("./overlay/es.json"),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  fr: require("./overlay/fr.json"),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  pl: require("./overlay/pl.json"),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  pt: require("./overlay/pt.json"),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  tr: require("./overlay/tr.json"),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  uk: require("./overlay/uk.json"),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  zh: require("./overlay/zh.json"),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cs: require("./overlay/cs.json"),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  bg: require("./overlay/bg.json"),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sr: require("./overlay/sr.json"),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ar: require("./overlay/ar.json"),
};
