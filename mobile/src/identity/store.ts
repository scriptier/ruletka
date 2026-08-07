import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const KEY_USER = "ruletka.user_id.v1";
const KEY_NAME = "ruletka.display_name.v1";
const KEY_RULES = "ruletka.rules_ok.v1";

export type LocalIdentity = {
  user_id: string;
  name: string;
};

async function randomUserId(): Promise<string> {
  // uuid-ish: web uses various formats; hub accepts stable string ≥8 chars
  const bytes = await Crypto.getRandomBytesAsync(16);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function loadOrCreateIdentity(): Promise<LocalIdentity> {
  try {
    let user_id = await SecureStore.getItemAsync(KEY_USER);
    if (!user_id || user_id.length < 8) {
      user_id = await randomUserId();
      await SecureStore.setItemAsync(KEY_USER, user_id);
    }
    let name = (await SecureStore.getItemAsync(KEY_NAME)) || "";
    if (!name) {
      name = "anon";
      await SecureStore.setItemAsync(KEY_NAME, name);
    }
    return { user_id, name };
  } catch {
    // SecureStore can throw on some devices / locked storage — still boot the app
    const user_id = await randomUserId().catch(
      () => `anon-${Date.now().toString(16)}`
    );
    return { user_id, name: "anon" };
  }
}

export async function setDisplayName(name: string): Promise<void> {
  const n = String(name || "anon").slice(0, 32);
  await SecureStore.setItemAsync(KEY_NAME, n);
}

/** Full identity swap (profile import). Caller must remount HubProvider. */
export async function replaceIdentity(
  user_id: string,
  name: string
): Promise<LocalIdentity> {
  const uid = String(user_id || "").trim();
  if (uid.length < 8) throw new Error("bad user_id");
  const n = String(name || "anon").slice(0, 32);
  await SecureStore.setItemAsync(KEY_USER, uid);
  await SecureStore.setItemAsync(KEY_NAME, n);
  return { user_id: uid, name: n };
}

export async function rulesAccepted(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY_RULES)) === "1";
}

export async function setRulesAccepted(): Promise<void> {
  await SecureStore.setItemAsync(KEY_RULES, "1");
}
