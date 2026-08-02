/** Runtime config for the mobile client. */

export function hubBase(): string {
  const fromEnv =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_HUB_BASE
      ? String(process.env.EXPO_PUBLIC_HUB_BASE).replace(/\/$/, "")
      : "";
  return fromEnv || "https://ruletka.vip";
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
