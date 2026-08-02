/**
 * Mobile i18n — reuses monorepo ui/i18n/{code}.json packs + mobile overlay.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MOBILE_BY_LANG, MOBILE_EN } from "./mobile-overlay";

const LANG_KEY = "ruletka-mobile-lang-v1";

export const SUPPORTED_LANGS = [
  "en",
  "ru",
  "de",
  "es",
  "fr",
  "pl",
  "pt",
  "tr",
  "uk",
  "zh",
] as const;

export type LangCode = (typeof SUPPORTED_LANGS)[number];

export const LANG_LABELS: Record<LangCode, string> = {
  en: "English",
  ru: "Русский",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
  pl: "Polski",
  pt: "Português",
  tr: "Türkçe",
  uk: "Українська",
  zh: "中文",
};

type Pack = Record<string, string>;

function loadWebPack(code: string): Pack {
  // Packs synced from ui/i18n via mobile/scripts/sync-i18n.sh
  try {
    switch (code) {
      case "en":
        return require("./packs/en.json") as Pack;
      case "ru":
        return require("./packs/ru.json") as Pack;
      case "de":
        return require("./packs/de.json") as Pack;
      case "es":
        return require("./packs/es.json") as Pack;
      case "fr":
        return require("./packs/fr.json") as Pack;
      case "pl":
        return require("./packs/pl.json") as Pack;
      case "pt":
        return require("./packs/pt.json") as Pack;
      case "tr":
        return require("./packs/tr.json") as Pack;
      case "uk":
        return require("./packs/uk.json") as Pack;
      case "zh":
        return require("./packs/zh.json") as Pack;
      default:
        return require("./packs/en.json") as Pack;
    }
  } catch {
    try {
      return require("./packs/en.json") as Pack;
    } catch {
      return {};
    }
  }
}

const enPack = loadWebPack("en");
const packCache = new Map<string, Pack>([["en", enPack]]);

function getPack(code: string): Pack {
  if (packCache.has(code)) return packCache.get(code)!;
  const p = loadWebPack(code);
  packCache.set(code, p);
  return p;
}

export function deviceLang(): LangCode {
  try {
    const loc =
      (typeof Intl !== "undefined" &&
        Intl.DateTimeFormat().resolvedOptions().locale) ||
      "en";
    const base = String(loc).toLowerCase().split(/[-_]/)[0];
    if ((SUPPORTED_LANGS as readonly string[]).includes(base)) {
      return base as LangCode;
    }
  } catch {
    /* ignore */
  }
  return "en";
}

function format(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;
  return String(template).replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] != null ? String(vars[k]) : ""
  );
}

export function translate(
  lang: LangCode,
  key: string,
  vars?: Record<string, string | number>
): string {
  const overlay = MOBILE_BY_LANG[lang] || {};
  const pack = getPack(lang);
  const enOverlay = MOBILE_EN;
  const raw =
    overlay[key] ??
    pack[key] ??
    enOverlay[key] ??
    enPack[key] ??
    key;
  return format(raw, vars);
}

type I18nCtx = {
  lang: LangCode;
  /** Saved preference: "" = follow device */
  pref: string;
  setPref: (code: string) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  ready: boolean;
};

const Ctx = createContext<I18nCtx | null>(null);

export function useI18n(): I18nCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n outside I18nProvider");
  return c;
}

/** Safe t() for components inside provider */
export function useT() {
  return useI18n().t;
}

export function I18nProvider(props: { children: ReactNode }) {
  const [pref, setPrefState] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = (await AsyncStorage.getItem(LANG_KEY)) || "";
        setPrefState(s);
      } catch {
        /* ignore */
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const lang: LangCode = useMemo(() => {
    if (pref && (SUPPORTED_LANGS as readonly string[]).includes(pref)) {
      return pref as LangCode;
    }
    return deviceLang();
  }, [pref]);

  const setPref = useCallback(async (code: string) => {
    const next =
      code && (SUPPORTED_LANGS as readonly string[]).includes(code) ? code : "";
    setPrefState(next);
    try {
      if (next) await AsyncStorage.setItem(LANG_KEY, next);
      else await AsyncStorage.removeItem(LANG_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(lang, key, vars),
    [lang]
  );

  const value = useMemo(
    () => ({ lang, pref, setPref, t, ready }),
    [lang, pref, setPref, t, ready]
  );

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}
