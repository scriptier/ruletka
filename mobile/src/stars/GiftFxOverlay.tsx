/**
 * Gift FX overlays for Live — animated bars / balloons / confetti
 * (RN Animated only, no extra deps).
 */
import { memo, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { GIFTS, type GiftKind } from "./gifts";

/** Hold times aligned with web STAR_GIFT_SECS (ms). */
export const GIFT_FX_HOLD_MS: Record<string, number> = {
  heart: 2200,
  // Hub bars duration 15s — keep full jail visual for sender + target
  bars: 15500,
  flowers: 2800,
  balloons: 3600,
  confetti: 3400,
  // Matches hub 5s duration (keep UI a beat longer for the handoff)
  pass_mic: 5200,
  fireworks: 4000,
  please_stay: 3500,
};

export function giftFxHoldMs(effect: string | null | undefined): number {
  if (!effect) return 1800;
  return GIFT_FX_HOLD_MS[effect] ?? 2000;
}

const BALLOON_COLORS = [
  "#ff5a7a",
  "#ff8a3d",
  "#ffd14a",
  "#5ad48a",
  "#4db7ff",
  "#a78bfa",
  "#ff6bcb",
  "#f472b6",
  "#34d399",
  "#60a5fa",
  "#fb7185",
  "#fbbf24",
];

const CONFETTI_COLORS = [
  "#ff5a7a",
  "#ffd14a",
  "#5ad48a",
  "#4db7ff",
  "#a78bfa",
  "#ff8a3d",
  "#f472b6",
  "#ffffff",
  "#34d399",
  "#fbbf24",
];

type BalloonSpec = {
  key: string;
  left: number;
  size: number;
  color: string;
  delay: number;
  dur: number;
  drift: number;
};

type ConfettiSpec = {
  key: string;
  left: number;
  size: number;
  color: string;
  delay: number;
  dur: number;
  shape: "rect" | "circle" | "ribbon";
  rot: number;
};

type Bit = {
  key: string;
  emoji: string;
  left: number;
  top: number;
  size: number;
};

function seedN(seed: number, i: number): number {
  return ((seed * 17 + i * 31) % 1000) / 10;
}

function staticBits(effect: string, seed: number): Bit[] {
  const scatter = (emoji: string, count: number, sizeBase: number): Bit[] =>
    Array.from({ length: count }, (_, i) => ({
      key: `${effect}-${emoji}-${i}`,
      emoji,
      left: 4 + (seedN(seed, i) % 90),
      top: 6 + ((seedN(seed, i + 3) * 1.3) % 82),
      size: sizeBase + (i % 5) * 3,
    }));
  switch (effect) {
    case "heart":
      return scatter("💖", 14, 18).concat(scatter("💗", 8, 14));
    case "flowers":
      return scatter("🌸", 12, 16)
        .concat(scatter("🌺", 8, 14))
        .concat(scatter("🌼", 6, 12));
    case "fireworks":
      return scatter("🎆", 8, 22)
        .concat(scatter("🎇", 8, 18))
        .concat(scatter("✨", 12, 12));
    case "please_stay":
      return scatter("🙏", 8, 18).concat(scatter("💛", 10, 14));
    default:
      return scatter("★", 10, 14);
  }
}

/** Pass the mic — handoff motion (mic flies out, hand catches, label holds). */
function PassMicLayer(props: { caption?: string }) {
  const micX = useRef(new Animated.Value(0)).current;
  const micY = useRef(new Animated.Value(0)).current;
  const micScale = useRef(new Animated.Value(0.4)).current;
  const micOp = useRef(new Animated.Value(0)).current;
  const handOp = useRef(new Animated.Value(0)).current;
  const handScale = useRef(new Animated.Value(0.6)).current;
  const labelOp = useRef(new Animated.Value(0)).current;
  const bubbleOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    micX.setValue(0);
    micY.setValue(0);
    micScale.setValue(0.4);
    micOp.setValue(0);
    handOp.setValue(0);
    handScale.setValue(0.6);
    labelOp.setValue(0);
    bubbleOp.setValue(0);

    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(micOp, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(micScale, {
          toValue: 1.12,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.timing(labelOp, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(bubbleOp, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(280),
      Animated.parallel([
        Animated.timing(micX, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(micY, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(micScale, {
          toValue: 0.7,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(700),
          Animated.parallel([
            Animated.timing(handOp, {
              toValue: 1,
              duration: 280,
              useNativeDriver: true,
            }),
            Animated.spring(handScale, {
              toValue: 1.15,
              friction: 5,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(handScale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(bubbleOp, {
          toValue: 0,
          duration: 900,
          delay: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(micOp, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(handOp, {
          toValue: 0,
          duration: 500,
          delay: 120,
          useNativeDriver: true,
        }),
        Animated.timing(labelOp, {
          toValue: 0,
          duration: 600,
          delay: 800,
          useNativeDriver: true,
        }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [micX, micY, micScale, micOp, handOp, handScale, labelOp, bubbleOp]);

  const micTx = micX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 110],
  });
  const micTy = micY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -130],
  });

  return (
    <View style={styles.passMicRoot} pointerEvents="none">
      <Animated.Text
        style={[styles.passMicBubble, { opacity: bubbleOp, left: "16%", top: "26%" }]}
      >
        …
      </Animated.Text>
      <Animated.Text
        style={[styles.passMicBubble, { opacity: bubbleOp, left: "28%", top: "38%" }]}
      >
        💬
      </Animated.Text>
      <Animated.Text
        style={[
          styles.passMicMic,
          {
            opacity: micOp,
            transform: [
              { translateX: micTx },
              { translateY: micTy },
              { scale: micScale },
            ],
          },
        ]}
      >
        🎤
      </Animated.Text>
      <Animated.Text
        style={[
          styles.passMicHand,
          {
            opacity: handOp,
            transform: [{ scale: handScale }],
          },
        ]}
      >
        ✋
      </Animated.Text>
      <Animated.View style={[styles.passMicLabelWrap, { opacity: labelOp }]}>
        <Text style={styles.passMicLabel}>Pass the mic</Text>
        <Text style={styles.passMicSub}>
          {props.caption || "Give them a chance"}
        </Text>
      </Animated.View>
    </View>
  );
}

function balloonSpecs(seed: number): BalloonSpec[] {
  const n = 16;
  return Array.from({ length: n }, (_, i) => ({
    key: `b-${i}`,
    left: 3 + ((seedN(seed, i) * 1.1) % 92),
    size: 22 + (i % 6) * 4,
    color: BALLOON_COLORS[i % BALLOON_COLORS.length],
    delay: (i % 8) * 180,
    dur: 2800 + (i % 5) * 400,
    drift: ((i * 17) % 40) - 20,
  }));
}

function confettiSpecs(seed: number): ConfettiSpec[] {
  const shapes: ConfettiSpec["shape"][] = [
    "rect",
    "rect",
    "circle",
    "ribbon",
    "rect",
  ];
  const n = 42;
  return Array.from({ length: n }, (_, i) => ({
    key: `c-${i}`,
    left: 2 + ((seedN(seed, i + 1) * 1.2) % 94),
    size: 6 + (i % 7) * 1.8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: (i % 12) * 90,
    dur: 2200 + (i % 6) * 280,
    shape: shapes[i % shapes.length],
    rot: (i * 47) % 360,
  }));
}

function RisingBalloon(props: { spec: BalloonSpec }) {
  const { spec } = props;
  const y = useRef(new Animated.Value(0)).current;
  const x = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    y.setValue(0);
    x.setValue(0);
    opacity.setValue(0);
    const rise = Animated.loop(
      Animated.sequence([
        Animated.delay(spec.delay),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(y, {
            toValue: 1,
            duration: spec.dur,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(x, {
              toValue: 1,
              duration: spec.dur * 0.45,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(x, {
              toValue: 0,
              duration: spec.dur * 0.55,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1,
          useNativeDriver: true,
        }),
      ])
    );
    rise.start();
    return () => rise.stop();
  }, [spec.delay, spec.dur, spec.key, opacity, x, y]);

  const translateY = y.interpolate({
    inputRange: [0, 1],
    outputRange: [40, -420],
  });
  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [0, spec.drift],
  });

  const bodyH = spec.size * 1.15;
  const bodyW = spec.size;

  return (
    <Animated.View
      style={[
        styles.balloonWrap,
        {
          left: `${spec.left}%`,
          opacity,
          transform: [{ translateY }, { translateX }],
        },
      ]}
    >
      <View
        style={[
          styles.balloonBody,
          {
            width: bodyW,
            height: bodyH,
            backgroundColor: spec.color,
            borderColor: "rgba(255,255,255,0.35)",
          },
        ]}
      >
        <View style={styles.balloonShine} />
      </View>
      <View
        style={[styles.balloonKnot, { backgroundColor: spec.color }]}
      />
      <View style={styles.balloonString} />
    </Animated.View>
  );
}

function FallingConfetti(props: { spec: ConfettiSpec }) {
  const { spec } = props;
  const t = useRef(new Animated.Value(0)).current;
  const rot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    t.setValue(0);
    rot.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(spec.delay),
        Animated.parallel([
          Animated.timing(t, {
            toValue: 1,
            duration: spec.dur,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(rot, {
            toValue: 1,
            duration: spec.dur,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [spec.delay, spec.dur, spec.key, rot, t]);

  const translateY = t.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 480],
  });
  const translateX = t.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, (spec.left % 2 === 0 ? 14 : -12), (spec.left % 2 === 0 ? 22 : -18)],
  });
  const rotate = rot.interpolate({
    inputRange: [0, 1],
    outputRange: [`${spec.rot}deg`, `${spec.rot + 420}deg`],
  });
  const opacity = t.interpolate({
    inputRange: [0, 0.08, 0.85, 1],
    outputRange: [0, 1, 0.95, 0],
  });

  const shapeStyle: ViewStyle =
    spec.shape === "circle"
      ? {
          width: spec.size,
          height: spec.size,
          borderRadius: 999,
        }
      : spec.shape === "ribbon"
        ? {
            width: spec.size * 1.4,
            height: Math.max(3, spec.size * 0.28),
            borderRadius: 2,
          }
        : {
            width: spec.size,
            height: Math.max(4, spec.size * 0.55),
            borderRadius: 1.5,
          };

  return (
    <Animated.View
      style={[
        styles.confettiBit,
        shapeStyle,
        {
          left: `${spec.left}%`,
          backgroundColor: spec.color,
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }],
        },
      ]}
    />
  );
}

/** Exported so LiveStageVideo can paint bars over partner SurfaceView (zOrder 0). */
export function BarsOverlay() {
  const slam = useRef(new Animated.Value(0.92)).current;
  const sheen = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slam, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sheen, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheen, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sheen, slam]);

  const sheenX = sheen.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 80],
  });

  const barCount = 9;
  return (
    <Animated.View
      style={[styles.barsRoot, { transform: [{ scale: slam }] }]}
    >
      <View style={styles.barsShade} />
      {/* Vertical steel bars */}
      <View style={styles.barsRow}>
        {Array.from({ length: barCount }).map((_, i) => (
          <View key={`v-${i}`} style={styles.barsCol}>
            <View style={styles.barMetalV} />
            <View style={styles.barHighlightV} />
          </View>
        ))}
      </View>
      {/* Horizontal rails */}
      <View style={[styles.barMetalH, { top: "18%" }]} />
      <View style={[styles.barMetalH, { top: "52%" }]} />
      <View style={[styles.barMetalH, { top: "82%" }]} />
      <Animated.View
        style={[styles.barsSheen, { transform: [{ translateX: sheenX }] }]}
      />
      <View style={styles.barsFrame} />
      <View style={styles.lockBadge}>
        <Text style={styles.lockEmoji}>🔒</Text>
      </View>
    </Animated.View>
  );
}

function BalloonsLayer({ seed }: { seed: number }) {
  const specs = useMemo(() => balloonSpecs(seed), [seed]);
  return (
    <View style={styles.layer} pointerEvents="none">
      {specs.map((s) => (
        <RisingBalloon key={s.key} spec={s} />
      ))}
      <View style={styles.partyEdge} />
    </View>
  );
}

function ConfettiLayer({ seed }: { seed: number }) {
  const specs = useMemo(() => confettiSpecs(seed), [seed]);
  return (
    <View style={styles.layer} pointerEvents="none">
      {specs.map((s) => (
        <FallingConfetti key={s.key} spec={s} />
      ))}
      {["🎊", "🎉", "✨", "★", "💫", "💖"].map((em, i) => (
        <ConfettiEmoji
          key={em + i}
          emoji={em}
          left={8 + i * 15}
          delay={i * 140}
        />
      ))}
      <View style={styles.confettiEdge} />
    </View>
  );
}

function ConfettiEmoji(props: {
  emoji: string;
  left: number;
  delay: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(props.delay),
        Animated.timing(t, {
          toValue: 1,
          duration: 2800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(t, { toValue: 0, duration: 1, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [props.delay, t]);
  const translateY = t.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 460],
  });
  const opacity = t.interpolate({
    inputRange: [0, 0.1, 0.9, 1],
    outputRange: [0, 1, 1, 0],
  });
  return (
    <Animated.Text
      style={[
        styles.confettiEmoji,
        {
          left: `${props.left}%`,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {props.emoji}
    </Animated.Text>
  );
}

export const GiftFxOverlay = memo(function GiftFxOverlay(props: {
  effect: string | null;
  label: string | null;
  barsCaption?: string;
}) {
  const { effect, label, barsCaption } = props;
  const seed = useMemo(
    () => (effect ? effect.length * 97 + (Date.now() % 1000) : 0),
    // re-roll when effect/label changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effect, label]
  );
  if (!effect && !label) return null;
  const kind = (effect || "") as GiftKind | string;
  const centerEmoji =
    label?.match(/^\S+/)?.[0] ||
    GIFTS.find((g) => g.id === kind)?.emoji ||
    "★";

  const isBars = kind === "bars";
  const isBalloons = kind === "balloons";
  const isConfetti = kind === "confetti";
  const isPassMic = kind === "pass_mic";
  const isAnimatedSpecial = isBars || isBalloons || isConfetti || isPassMic;

  const bits = useMemo(
    () => (isAnimatedSpecial ? [] : staticBits(kind || "heart", seed)),
    [isAnimatedSpecial, kind, seed]
  );

  const tint =
    kind === "bars"
      ? { backgroundColor: "rgba(6,8,12,0.55)" }
      : kind === "balloons"
        ? { backgroundColor: "rgba(30,12,40,0.28)" }
        : kind === "confetti"
          ? { backgroundColor: "rgba(20,16,8,0.22)" }
          : kind === "heart"
            ? { backgroundColor: "rgba(120,20,50,0.42)" }
            : kind === "flowers"
              ? { backgroundColor: "rgba(80,40,90,0.4)" }
              : kind === "fireworks"
                ? { backgroundColor: "rgba(30,20,80,0.48)" }
                : kind === "please_stay"
                  ? { backgroundColor: "rgba(40,80,60,0.48)" }
                  : kind === "pass_mic"
                    ? { backgroundColor: "rgba(50,36,8,0.38)" }
                    : { backgroundColor: "rgba(0,0,0,0.35)" };

  const a11y =
    label ||
    barsCaption ||
    (kind ? `Gift: ${kind}` : "Gift animation");

  return (
    <View
      style={[styles.root, tint]}
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLiveRegion="polite"
      accessibilityLabel={a11y}
    >
      {isBars ? <BarsOverlay /> : null}
      {isBalloons ? <BalloonsLayer seed={seed} /> : null}
      {isConfetti ? <ConfettiLayer seed={seed} /> : null}
      {isPassMic ? (
        <PassMicLayer caption={barsCaption || undefined} />
      ) : null}

      {bits.map((b) => (
        <Text
          key={b.key}
          style={[
            styles.bit,
            {
              left: `${b.left}%`,
              top: `${b.top}%`,
              fontSize: b.size,
            },
          ]}
          importantForAccessibility="no"
        >
          {b.emoji}
        </Text>
      ))}

      {!isBars && !isPassMic ? (
        <Text
          style={[
            styles.center,
            isBalloons || isConfetti ? styles.centerSoft : null,
          ]}
          importantForAccessibility="no"
        >
          {centerEmoji}
        </Text>
      ) : null}

      {isBars && barsCaption ? (
        <Text style={styles.sub} importantForAccessibility="no">
          {barsCaption}
        </Text>
      ) : null}
      {kind === "please_stay" ? (
        <Text style={styles.sub} importantForAccessibility="no">
          🙏
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 12,
    overflow: "hidden",
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  bit: {
    position: "absolute",
    opacity: 0.92,
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  center: {
    color: "#fff",
    fontSize: 52,
    fontWeight: "800",
    textShadowColor: "#000",
    textShadowRadius: 14,
    zIndex: 4,
  },
  centerSoft: {
    fontSize: 40,
    opacity: 0.92,
  },
  passMicRoot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  passMicMic: {
    position: "absolute",
    fontSize: 56,
    textShadowColor: "#000",
    textShadowRadius: 12,
    zIndex: 4,
  },
  passMicHand: {
    position: "absolute",
    right: "14%",
    top: "16%",
    fontSize: 40,
    textShadowColor: "#000",
    textShadowRadius: 8,
    zIndex: 3,
  },
  passMicBubble: {
    position: "absolute",
    fontSize: 22,
    textShadowColor: "#000",
    textShadowRadius: 6,
    zIndex: 2,
  },
  passMicLabelWrap: {
    position: "absolute",
    bottom: "18%",
    alignItems: "center",
    gap: 4,
    zIndex: 5,
    maxWidth: "90%",
  },
  passMicLabel: {
    color: "#fff6e0",
    fontSize: 16,
    fontWeight: "800",
    backgroundColor: "rgba(40, 28, 8, 0.9)",
    borderColor: "rgba(255, 200, 90, 0.55)",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  passMicSub: {
    color: "#ffe9b0",
    fontSize: 13,
    fontWeight: "700",
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  sub: {
    color: "#e8eef7",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 10,
    textShadowColor: "#000",
    textShadowRadius: 6,
    zIndex: 5,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  /* ── Bars ── */
  barsRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  barsShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  barsRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "space-evenly",
    paddingHorizontal: 4,
  },
  barsCol: {
    width: 14,
    height: "100%",
    position: "relative",
  },
  barMetalV: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 3,
    backgroundColor: "#3a424c",
    borderWidth: 1,
    borderColor: "rgba(10,12,14,0.9)",
    // Fake metal gradient via layered borders
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 0 },
  },
  barHighlightV: {
    position: "absolute",
    left: 3,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
    backgroundColor: "rgba(210,220,230,0.28)",
  },
  barMetalH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: "#4a525c",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(8,10,12,0.85)",
    zIndex: 2,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },
  barsSheen: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: "rgba(255,255,255,0.06)",
    zIndex: 3,
  },
  barsFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: "rgba(30,34,40,0.85)",
    borderRadius: 2,
    zIndex: 4,
  },
  lockBadge: {
    position: "absolute",
    alignSelf: "center",
    top: "42%",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(12,14,18,0.82)",
    borderWidth: 1.5,
    borderColor: "rgba(160,170,180,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 6,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  lockEmoji: { fontSize: 28 },
  /* ── Balloons ── */
  balloonWrap: {
    position: "absolute",
    bottom: 0,
    alignItems: "center",
    width: 40,
    marginLeft: -20,
  },
  balloonBody: {
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  balloonShine: {
    position: "absolute",
    left: "18%",
    top: "14%",
    width: "32%",
    height: "28%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  balloonKnot: {
    width: 7,
    height: 6,
    borderRadius: 2,
    marginTop: -2,
  },
  balloonString: {
    width: 1.5,
    height: 28,
    backgroundColor: "rgba(220,220,230,0.55)",
    marginTop: 1,
  },
  partyEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: "rgba(255,140,200,0.22)",
    borderRadius: 4,
  },
  /* ── Confetti ── */
  confettiBit: {
    position: "absolute",
    top: 0,
    marginLeft: -4,
    zIndex: 2,
  },
  confettiEmoji: {
    position: "absolute",
    top: 0,
    fontSize: 16,
    zIndex: 3,
    textShadowColor: "#000",
    textShadowRadius: 3,
  },
  confettiEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: "rgba(255,200,80,0.2)",
    borderRadius: 4,
  },
});
