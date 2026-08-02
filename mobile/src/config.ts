/** Runtime config for the mobile client. */

let _overrideBase = "";

/** Prefer env, then runtime override (failover), then seed. */
export function hubBase(): string {
  if (_overrideBase) return _overrideBase.replace(/\/$/, "");
  const fromEnv =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_HUB_BASE
      ? String(process.env.EXPO_PUBLIC_HUB_BASE).replace(/\/$/, "")
      : "";
  return fromEnv || "https://ruletka.vip";
}

export function setHubBaseOverride(base: string) {
  _overrideBase = String(base || "").replace(/\/$/, "");
}

export function wsUrl(base = hubBase()): string {
  const u = new URL(base);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/ws";
  u.search = "";
  u.hash = "";
  return u.toString();
}

export function configUrl(base = hubBase()): string {
  return `${base.replace(/\/$/, "")}/config.json`;
}
