/**
 * Web-compatible encrypted profile backup.
 * Format matches ui/live.js: ruletka-profile/2-enc (PBKDF2-SHA256 + AES-GCM).
 * Stars are never stored in the file.
 */

import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

export const PROFILE_FORMAT = "ruletka-profile/1";
export const PROFILE_FORMAT_ENC = "ruletka-profile/2-enc";
export const PROFILE_KDF_ITERS = 310000;

export type PlainProfile = {
  format: string;
  exported_at: string;
  software: string;
  note?: string;
  identity: {
    user_id: string;
    name: string;
    friend_code?: string;
  };
  prefs?: Record<string, unknown>;
  lang?: string;
};

export type EncryptedEnvelope = {
  format: string;
  v: number;
  software: string;
  exported_at: string;
  kdf: string;
  hash: string;
  iter: number;
  cipher: string;
  salt: string;
  iv: string;
  ciphertext: string;
  note?: string;
};

function b64FromBytes(u8: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  // btoa available in RN hermes
  return globalThis.btoa(s);
}

function bytesFromB64(b64: string): Uint8Array {
  const bin = globalThis.atob(String(b64 || ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function isEncryptedProfile(data: unknown): data is EncryptedEnvelope {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  const fmt = String(d.format || "");
  return (
    fmt === PROFILE_FORMAT_ENC ||
    !!(d.ciphertext && d.salt && d.iv && (d.cipher === "AES-GCM" || d.kdf))
  );
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const iters = Math.max(
    100000,
    Number.isFinite(iterations) && iterations > 0
      ? iterations
      : PROFILE_KDF_ITERS
  );
  return pbkdf2(sha256, enc.encode(password), salt, {
    c: iters,
    dkLen: 32,
  });
}

export async function encryptProfile(
  profile: PlainProfile,
  password: string
): Promise<EncryptedEnvelope> {
  const salt = await Crypto.getRandomBytesAsync(16);
  const iv = await Crypto.getRandomBytesAsync(12);
  const key = await deriveKey(password, salt, PROFILE_KDF_ITERS);
  const plain = new TextEncoder().encode(JSON.stringify(profile));
  const aes = gcm(key, iv);
  const ct = aes.encrypt(plain);
  return {
    format: PROFILE_FORMAT_ENC,
    v: 2,
    software: "ruletka.vip",
    exported_at: new Date().toISOString(),
    kdf: "PBKDF2",
    hash: "SHA-256",
    iter: PROFILE_KDF_ITERS,
    cipher: "AES-GCM",
    salt: b64FromBytes(salt),
    iv: b64FromBytes(iv),
    ciphertext: b64FromBytes(ct),
    note:
      "Encrypted profile backup. Import with the same password. Stars are hub-only.",
  };
}

export async function decryptProfile(
  envelope: EncryptedEnvelope,
  password: string
): Promise<PlainProfile> {
  const salt = bytesFromB64(envelope.salt);
  const iv = bytesFromB64(envelope.iv);
  const ct = bytesFromB64(envelope.ciphertext);
  if (!salt.length || !iv.length || !ct.length) throw new Error("bad envelope");
  const iters = Number(envelope.iter) || PROFILE_KDF_ITERS;
  const key = await deriveKey(password, salt, iters);
  const aes = gcm(key, iv);
  const plain = aes.decrypt(ct);
  const data = JSON.parse(new TextDecoder().decode(plain));
  if (!data?.identity?.user_id) throw new Error("bad payload");
  // Strip any star fields (defense in depth)
  delete data.stars;
  delete data.myStars;
  if (data.identity) {
    delete data.identity.stars;
    delete data.identity.star_count;
  }
  return data as PlainProfile;
}

export function buildPlainProfile(opts: {
  user_id: string;
  name: string;
  friend_code?: string;
  prefs?: Record<string, unknown>;
}): PlainProfile {
  return {
    format: PROFILE_FORMAT,
    exported_at: new Date().toISOString(),
    software: "ruletka.vip",
    note:
      "Import restores identity. Stars are NOT in this file — hub-only for user_id.",
    identity: {
      user_id: opts.user_id,
      name: (opts.name || "anon").slice(0, 32),
      friend_code: opts.friend_code || "",
    },
    prefs: opts.prefs || {},
  };
}

export async function shareProfileJson(
  obj: object,
  filename: string
): Promise<void> {
  const base = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
  if (!base) throw new Error("No file system directory available");
  const path = `${base}${filename}`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(obj, null, 2));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: "application/json",
      dialogTitle: "Share ruletka backup",
    });
  } else {
    throw new Error("Sharing not available on this device");
  }
}
