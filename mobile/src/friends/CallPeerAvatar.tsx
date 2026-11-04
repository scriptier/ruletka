/**
 * Friend photo (or letter tile) for incoming / outgoing call cards.
 * Same URI rules as the Friends list: data: / http(s) / file://.
 */
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

const AVATAR_COLORS = [
  "#6B7CFF",
  "#C45CFF",
  "#E85D75",
  "#F0A202",
  "#2BB673",
  "#3D9EED",
  "#FF6B4A",
  "#9B6DFF",
];

export function isAvatarUri(uri: string | undefined | null): boolean {
  if (!uri || typeof uri !== "string") return false;
  const s = uri.trim();
  if (!s) return false;
  return (
    s.startsWith("data:image/") ||
    s.startsWith("https://") ||
    s.startsWith("http://") ||
    s.startsWith("file://")
  );
}

export function avatarColor(seed: string): string {
  let h = 0;
  const s = seed || "?";
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function resolveFriendAvatar(
  friends: { user_id: string; avatar?: string }[],
  userId: string,
  hint?: string
): string {
  if (isAvatarUri(hint)) return String(hint).trim();
  const f = friends.find((x) => x.user_id === userId);
  return isAvatarUri(f?.avatar) ? String(f!.avatar).trim() : "";
}

export function CallPeerAvatar(props: {
  name: string;
  userId?: string;
  avatar?: string;
  size?: number;
}) {
  const size = props.size ?? 72;
  const uri = isAvatarUri(props.avatar) ? String(props.avatar).trim() : "";
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [uri]);
  const letter = (props.name || "?").trim().slice(0, 1).toUpperCase() || "?";
  const bg = avatarColor(props.userId || props.name || letter);
  const show = !!uri && !failed;
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: show ? "#0c121c" : bg,
        },
      ]}
      importantForAccessibility="no"
      testID="call-peer-avatar"
    >
      {show ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.letter, { fontSize: Math.round(size * 0.38) }]}>
          {letter}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.22)",
  },
  letter: {
    color: "#e8eef7",
    fontWeight: "800",
  },
});
