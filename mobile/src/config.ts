/** Runtime config for the mobile client. */
import Constants from "expo-constants";

let _overrideBase = "";

function extra(): Record<string, unknown> {
  return (Constants.expoConfig?.extra || {}) as Record<string, unknown>;
}

/** Prefer env, then runtime override (failover), then seed. */
export function hubBase(): string {
  if (_overrideBase) return _overrideBase.replace(/\/$/, "");
  const fromEnv =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_HUB_BASE
      ? String(process.env.EXPO_PUBLIC_HUB_BASE).replace(/\/$/, "")
      : "";
  if (fromEnv) return fromEnv;
  const fromExtra = String(extra().hubBase || "").replace(/\/$/, "");
  return fromExtra || "https://ruletka.vip";
}

export function setHubBaseOverride(base: string) {
  _overrideBase = String(base || "").replace(/\/$/, "");
}

/**
 * Store contingency: hide stranger queue, keep Friends + Call.
 * Set EXPO_PUBLIC_FRIENDS_ONLY=1 or eas profile *-friends.
 */
export function isFriendsOnly(): boolean {
  if (
    typeof process !== "undefined" &&
    (process.env?.EXPO_PUBLIC_FRIENDS_ONLY === "1" ||
      process.env?.EXPO_PUBLIC_FRIENDS_ONLY === "true")
  ) {
    return true;
  }
  return !!extra().friendsOnly;
}

export function privacyPolicyUrl(): string {
  return (
    String(extra().privacyPolicyUrl || "") ||
    `${hubBase()}/legal/privacy.html`
  );
}

export function termsUrl(): string {
  return String(extra().termsUrl || "") || `${hubBase()}/legal/terms.html`;
}

export function deleteDataUrl(): string {
  return (
    String(extra().deleteDataUrl || "") || `${hubBase()}/legal/delete.html`
  );
}

/** In-product safety tools (block/report/blur). */
export function safetyToolsUrl(): string {
  return (
    String(extra().safetyToolsUrl || "") || `${hubBase()}/safety.html`
  );
}

/**
 * Published CSAE / child-safety standards (Play Console + in-app legal).
 * Must stay a stable public HTML URL (not a PDF).
 */
export function childSafetyUrl(): string {
  return (
    String(extra().childSafetyUrl || "") ||
    `${hubBase()}/legal/child-safety.html`
  );
}

export function communityUrl(): string {
  return (
    String(extra().communityUrl || "") ||
    `${hubBase()}/legal/community.html`
  );
}

export function supportEmail(): string {
  return String(extra().supportEmail || "") || "support@ruletka.me";
}

export function privacyEmail(): string {
  return String(extra().privacyEmail || "") || "privacy@ruletka.me";
}

/** mailto: for child-safety / CSAE reports (no CSAM attachments). */
export function childSafetyReportMailto(): string {
  const to = supportEmail();
  return `mailto:${to}?subject=${encodeURIComponent("Child safety report")}`;
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
