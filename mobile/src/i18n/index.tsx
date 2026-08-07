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
  "uk",
  "pl",
  "cs",
  "bg",
  "sr",
  "de",
  "es",
  "fr",
  "pt",
  "tr",
  "ar",
  "zh",
] as const;

export type LangCode = (typeof SUPPORTED_LANGS)[number];

// Non-ASCII labels use \\u escapes so the source file is pure ASCII —
// avoids the UTF-8-as-Latin-1 mojibake bug some older Android bundles hit.
export const LANG_LABELS: Record<LangCode, string> = {
  en: "English",
  ru: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439",
  uk: "\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430",
  pl: "Polski",
  cs: "\u010ce\u0161tina",
  bg: "\u0411\u044a\u043b\u0433\u0430\u0440\u0441\u043a\u0438",
  sr: "\u0421\u0440\u043f\u0441\u043a\u0438",
  de: "Deutsch",
  es: "Espa\u00f1ol",
  fr: "Fran\u00e7ais",
  pt: "Portugu\u00eas",
  tr: "T\u00fcrk\u00e7e",
  ar: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629",
  zh: "\u4e2d\u6587",
};

type Pack = Record<string, string>;

/**
 * Mobile ships only the compact overlay packs (~few KB each), not the full
 * web i18n JSON (~2.5MB). That keeps cold start light and avoids OOM on low-end
 * devices when Hermes parses giant tables at boot.
 */
function getOverlay(code: string): Pack {
  return (MOBILE_BY_LANG[code] || {}) as Pack;
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

/**
 * Repair classic UTF-8-as-Latin-1 mojibake (e.g. "ÐŸÑ€Ð¸Ð½ÑÑ‚ÑŒ" → "Принять").
 * Older APKs shipped a few RU strings double-encoded; this is a runtime safety net.
 */
function fixMojibake(s: string): string {
  if (!s || s.length < 2) return s;
  // Already proper Cyrillic / CJK / Arabic — leave alone
  if (/[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]/.test(s)) return s;
  // UTF-8 Cyrillic misread as Latin-1 almost always yields Ð (0xD0) / Ñ (0xD1)
  if (!/[ÐÑÃÂ]/.test(s)) return s;
  try {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c > 255) return s;
      bytes[i] = c;
    }
    const decoded = new TextDecoder("utf-8").decode(bytes);
    if (/[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]/.test(decoded)) {
      return decoded;
    }
  } catch {
    /* ignore */
  }
  return s;
}

export function translate(
  lang: LangCode,
  key: string,
  vars?: Record<string, string | number>
): string {
  const overlay = getOverlay(lang);
  const enOverlay = MOBILE_EN;
  const raw = fixMojibake(overlay[key] ?? enOverlay[key] ?? key);
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
