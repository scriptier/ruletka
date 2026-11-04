/** Public IP geo when hub geo is empty (sslh/haproxy race or 127.0.0.1). */

export type PublicGeo = { flag: string; country: string; city: string };

export function normalizeGeoHit(raw: {
  flag?: string;
  country?: string;
  city?: string;
} | null): PublicGeo | null {
  if (!raw) return null;
  const flag = String(raw.flag || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  const country = String(raw.country || "").trim();
  const city = String(raw.city || "").trim();
  if (!flag && !country && !city) return null;
  return { flag, country, city };
}

export function parseIpwho(j: unknown): PublicGeo | null {
  const o = j as Record<string, unknown> | null;
  if (!o || o.success === false) return null;
  return normalizeGeoHit({
    flag: String(o.country_code || ""),
    country: String(o.country || ""),
    city: String(o.city || ""),
  });
}

export function parseIpapi(j: unknown): PublicGeo | null {
  const o = j as Record<string, unknown> | null;
  if (!o || o.error) return null;
  return normalizeGeoHit({
    flag: String(o.country_code || ""),
    country: String(o.country_name || o.country || ""),
    city: String(o.city || ""),
  });
}

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = ctrl ? setTimeout(() => ctrl.abort(), 2800) : 0;
  try {
    const r = await fetch(url, { signal: ctrl?.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    if (t) clearTimeout(t);
  }
}

export async function fillPublicGeo(): Promise<PublicGeo | null> {
  const a = parseIpwho(await fetchJson("https://ipwho.is/"));
  if (a) return a;
  return parseIpapi(await fetchJson("https://ipapi.co/json/"));
}
