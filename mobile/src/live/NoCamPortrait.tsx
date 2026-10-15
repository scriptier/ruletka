import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

const PORTRAIT = require("../../assets/brand/no-cam-portrait.jpg");

type Props = {
  label?: string;
  title?: string;
  caption?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Brand cylinder fill when a conversationalist has no camera.
 * Related art (same logo-hero as idle/search), not a black void.
 */
export function NoCamPortrait({
  label,
  title = "No camera",
  caption = "Talking with microphone",
  style,
}: Props) {
  return (
    <View style={[styles.wrap, style]} pointerEvents="none">
      <Image source={PORTRAIT} style={styles.img} resizeMode="cover" />
      <View style={styles.scrim} />
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.sub} numberOfLines={2}>
          {label ? `${caption} · ${label}` : caption}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    overflow: "hidden",
    backgroundColor: "#07080c",
  },
  img: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    // bottom-heavy so copy reads
  },
  copy: {
    paddingHorizontal: 16,
    paddingBottom: 22,
    backgroundColor: "rgba(6,7,10,0.55)",
  },
  title: {
    color: "#f3e6c8",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  sub: {
    color: "rgba(243,230,200,0.88)",
    fontSize: 13,
    marginTop: 3,
  },
});
