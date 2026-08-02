/**
 * Multi-hub discovery + health check (mirrors ui/hubs.js intent).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREF_KEY = "ruletka-hub-base-v1";
const BUILTIN = ["https://ruletka.vip", "https://ruletka.me"];

export function normalizeBase(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.origin;
  } catch {
    return "";
  }
}

export async function getSavedHub(): Promise<string> {
  try {
    return normalizeBase((await AsyncStorage.getItem(PREF_KEY)) || "");
  } catch {
    return "";
  }
}

export async function setSavedHub(base: string): Promise<void> {
  const b = normalizeBase(base);
  try {
    if (b) await AsyncStorage.setItem(PREF_KEY, b);
    else await AsyncStorage.removeItem(PREF_KEY);
  } catch {
    /* ignore */
  }
}

export async function listCandidateHubs(
  seedBase?: string
): Promise<string[]> {
  const out: string[] = [];
  const add = (b: string) => {
    const n = normalizeBase(b);
    if (n && !out.includes(n)) out.push(n);
  };

  add(seedBase || "");
  add(await getSavedHub());
  for (const b of BUILTIN) add(b);

  // Pull directory from first reachable seed
  for (const seed of [...out]) {
    try {
      const r = await fetch(`${seed}/v1/directory`, {
        headers: { Accept: "application/json" },
      });
      if (!r.ok) continue;
      const j = (await r.json()) as {
        hubs?: { base?: string }[];
      };
      for (const h of j.hubs || []) add(String(h.base || ""));
      break;
    } catch {
      /* try next */
    }
    try {
      const r = await fetch(`${seed}/hubs.json`, {
        headers: { Accept: "application/json" },
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { hubs?: { base?: string }[] };
      for (const h of j.hubs || []) add(String(h.base || ""));
      break;
    } catch {
      /* ignore */
    }
  }
  return out;
}

/** Probe /health — returns true if ok. */
export async function probeHub(
  base: string,
  timeoutMs = 4000
): Promise<boolean> {
  const b = normalizeBase(base);
  if (!b) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${b}/health`, { signal: ctrl.signal });
    if (!r.ok) return false;
    const j = (await r.json()) as { ok?: boolean };
    return j.ok !== false;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** Pick first healthy hub from candidates (or fallback). */
export async function pickHealthyHub(
  preferred?: string
): Promise<string> {
  const list = await listCandidateHubs(preferred);
  for (const b of list) {
    if (await probeHub(b)) {
      await setSavedHub(b);
      return b;
    }
  }
  return preferred || BUILTIN[0];
}
