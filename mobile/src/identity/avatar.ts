import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

/** Max data-URL length (must match web + hub normalize_avatar). */
export const MAX_AVATAR_CHARS = 48000;
export const AVATAR_PX = 192;

const JPEG_QUALITIES = [0.78, 0.62, 0.48, 0.35];

export function isValidAvatarDataUrl(s: string): boolean {
  if (!s || typeof s !== "string") return false;
  if (s.length > MAX_AVATAR_CHARS) return false;
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(s);
}

/**
 * Crop to center square, resize to 192px, JPEG quality-loop until ≤48k chars.
 */
export async function resizeUriToAvatarDataUrl(uri: string): Promise<string> {
  const src = String(uri || "").trim();
  if (!src) throw new Error("not an image");

  const probe = await manipulateAsync(src, [], {});
  const w = Number(probe.width) || 0;
  const h = Number(probe.height) || 0;
  if (!w || !h) throw new Error("bad image");

  const side = Math.min(w, h);
  const originX = Math.max(0, Math.floor((w - side) / 2));
  const originY = Math.max(0, Math.floor((h - side) / 2));
  const cropW = Math.min(side, w - originX);
  const cropH = Math.min(side, h - originY);

  const actions: (
    | { crop: { originX: number; originY: number; width: number; height: number } }
    | { resize: { width: number; height: number } }
  )[] = [];
  if (w !== h || cropW !== w || cropH !== h) {
    actions.push({
      crop: { originX, originY, width: cropW, height: cropH },
    });
  }
  if (cropW !== AVATAR_PX || cropH !== AVATAR_PX) {
    actions.push({ resize: { width: AVATAR_PX, height: AVATAR_PX } });
  }

  for (const q of JPEG_QUALITIES) {
    const result = await manipulateAsync(src, actions, {
      compress: q,
      format: SaveFormat.JPEG,
      base64: true,
    });
    const data = result.base64
      ? `data:image/jpeg;base64,${result.base64}`
      : "";
    if (isValidAvatarDataUrl(data)) return data;
  }
  throw new Error("too big after compress");
}
