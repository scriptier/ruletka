/**
 * Gift FX overlays for Live — closer to web live-stage.css particle FX.
 * RN Animated only (no Lottie/extra deps). Keep RTC/SurfaceView usable:
 * soft edge tint (not full mud), elevation above zOrder-0 RTCView.
 */
import { memo, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
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
  balloons: 3800,
  confetti: 4000,
  // Matches hub 5s duration (keep UI a beat longer for the handoff)
  pass_mic: 5200,
  // Longer hold so multi-burst fireworks + spark trails finish on screen
  fireworks: 5200,
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
  "#ff6bcb",
  "#22d3ee",
];

const FW_COLORS = [
  "#ffd14a",
  "#ff5a7a",
  "#4db7ff",
  "#a78bfa",
  "#5ad48a",
  "#ff8a3d",
  "#ffffff",
  "#f472b6",
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

type FloatSpec = {
  key: string;
  emoji: string;
  left: number;
  size: number;
  delay: number;
  dur: number;
  sway: number;
};

type SparkSpec = {
  key: string;
  ang: number;
  color: string;
  dist: number;
  size: number;
};

type BurstSpec = {
  key: string;
  cx: number;
  cy: number;
  delay: number;
  scale: number;
  sparks: SparkSpec[];
  color: string;
};

function seedN(seed: number, i: number): number {
  return ((seed * 17 + i * 31) % 1000) / 10;
}

function floatSpecs(
  emojis: string[],
  count: number,
  seed: number,
  sizeBase: number
): FloatSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `f-${i}`,
    emoji: emojis[i % emojis.length],
    left: 4 + ((seedN(seed, i) * 1.15) % 90),
    size: sizeBase + (i % 6) * 2.5,
    delay: (i % 10) * 110 + (i % 3) * 40,
    dur: 2400 + (i % 7) * 320,
    sway: ((i * 13) % 36) - 18,
  }));
}

function confettiSpecs(seed: number): ConfettiSpec[] {
  // Mix of ribbon / rect / circle for denser, less uniform fall
  const shapes: ConfettiSpec["shape"][] = [
    "rect",
    "ribbon",
    "circle",
    "rect",
    "ribbon",
    "rect",
    "circle",
    "ribbon",
  ];
  const n = 72;
  return Array.from({ length: n }, (_, i) => ({
    key: `c-${i}`,
    left: 1 + ((seedN(seed, i + 1) * 1.25) % 96),
    size: 5 + (i % 9) * 1.55,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: (i % 16) * 65,
    // Slightly longer fall so denser field stays visible
    dur: 2300 + (i % 9) * 280,
    shape: shapes[i % shapes.length],
    rot: (i * 47) % 360,
  }));
}

function balloonSpecs(seed: number): BalloonSpec[] {
  const n = 20;
  return Array.from({ length: n }, (_, i) => ({
    key: `b-${i}`,
    left: 2 + ((seedN(seed, i) * 1.1) % 94),
    size: 24 + (i % 7) * 4,
    color: BALLOON_COLORS[i % BALLOON_COLORS.length],
    delay: (i % 10) * 150,
    dur: 2700 + (i % 6) * 380,
    drift: ((i * 17) % 44) - 22,
  }));
}

function fireworkBursts(seed: number): BurstSpec[] {
  // 5 staggered bursts across the stage (web-canvas density, RN Animated only)
  const centers = [
    { cx: 50, cy: 38 },
    { cx: 28, cy: 48 },
    { cx: 72, cy: 42 },
    { cx: 42, cy: 28 },
    { cx: 62, cy: 55 },
  ];
  return centers.map((c, bi) => {
    // 20–28 sparks per burst for richer radial fans
    const nSparks = 20 + (bi % 5) * 2;
    const color = FW_COLORS[bi % FW_COLORS.length];
    const sparks: SparkSpec[] = Array.from({ length: nSparks }, (_, si) => ({
      key: `s-${bi}-${si}`,
      ang: (360 / nSparks) * si + (seedN(seed, bi * 10 + si) % 12),
      color: FW_COLORS[(bi + si) % FW_COLORS.length],
      dist: 52 + (si % 6) * 11 + (bi % 2) * 10,
      size: 3.5 + (si % 4) * 0.9,
    }));
    return {
      key: `burst-${bi}`,
      cx: c.cx + ((seedN(seed, bi) % 10) - 5) * 0.4,
      cy: c.cy + ((seedN(seed, bi + 2) % 8) - 4) * 0.35,
      delay: bi * 420,
      scale: 0.88 + (bi % 3) * 0.12,
      sparks,
      color,
    };
  });
}

/** Rising / floating emoji — matches web fx-heart-float spirit. */
function FloatingEmoji(props: { spec: FloatSpec; mode?: "rise" | "drift" }) {
  const { spec, mode = "rise" } = props;
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    t.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(spec.delay),
        Animated.timing(t, {
          toValue: 1,
          duration: spec.dur,
          easing: Easing.bezier(0.25, 0.4, 0.4, 1),
          useNativeDriver: true,
        }),
        Animated.timing(t, { toValue: 0, duration: 1, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [spec.delay, spec.dur, spec.key, t]);

  const translateY = t.interpolate({
    inputRange: [0, 1],
    outputRange: mode === "rise" ? [36, -420] : [20, -200],
  });
  const translateX = t.interpolate({
    inputRange: [0, 0.35, 0.7, 1],
    outputRange: [0, spec.sway * 0.35, spec.sway, spec.sway * 0.4],
  });
  const scale = t.interpolate({
    inputRange: [0, 0.12, 0.55, 1],
    outputRange: [0.55, 1.05, 1.12, 0.9],
  });
  const rotate = t.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["-8deg", "6deg", "-4deg"],
  });
  const opacity = t.interpolate({
    inputRange: [0, 0.08, 0.82, 1],
    outputRange: [0, 1, 0.92, 0],
  });

  return (
    <Animated.Text
      style={[
        styles.floatEmoji,
        {
          left: `${spec.left}%`,
          fontSize: spec.size,
          opacity,
          transform: [{ translateY }, { translateX }, { scale }, { rotate }],
        },
      ]}
      importantForAccessibility="no"
    >
      {spec.emoji}
    </Animated.Text>
  );
}

function HeroPulse(props: { emoji: string; size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.14],
  });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.78, 1],
  });
  return (
    <Animated.Text
      style={[
        styles.heroEmoji,
        {
          fontSize: props.size ?? 56,
          opacity,
          transform: [{ scale }],
        },
      ]}
      importantForAccessibility="no"
    >
      {props.emoji}
    </Animated.Text>
  );
}

/** Spark flight + core flash duration (ms) — long enough to read as trails. */
const FW_SPARK_MS = 2500;
const FW_GAP_MS = 280;

function FireworkSpark(props: {
  spec: SparkSpec;
  delay: number;
  burstScale: number;
}) {
  const { spec, delay, burstScale } = props;
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, {
          toValue: 1,
          duration: FW_SPARK_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(FW_GAP_MS),
        Animated.timing(t, { toValue: 0, duration: 1, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, spec.key, t]);

  const rad = (spec.ang * Math.PI) / 180;
  const dist = spec.dist * burstScale;
  const tx = Math.sin(rad) * dist;
  const ty = -Math.cos(rad) * dist;
  const translateX = t.interpolate({
    inputRange: [0, 0.08, 1],
    outputRange: [0, tx * 0.12, tx],
  });
  const translateY = t.interpolate({
    inputRange: [0, 0.08, 1],
    outputRange: [0, ty * 0.12, ty],
  });
  const scale = t.interpolate({
    inputRange: [0, 0.1, 0.55, 1],
    outputRange: [0.3, 1.25, 1, 0.28],
  });
  const opacity = t.interpolate({
    inputRange: [0, 0.05, 0.48, 1],
    outputRange: [0, 1, 0.92, 0],
  });

  return (
    <Animated.View
      style={[
        styles.fwSpark,
        {
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size,
          backgroundColor: spec.color,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
          shadowColor: spec.color,
        },
      ]}
    />
  );
}

function FireworkBurst(props: { burst: BurstSpec }) {
  const { burst } = props;
  const core = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    core.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(burst.delay),
        Animated.timing(core, {
          toValue: 1,
          duration: FW_SPARK_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(FW_GAP_MS),
        Animated.timing(core, { toValue: 0, duration: 1, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [burst.delay, burst.key, core]);

  const coreScale = core.interpolate({
    inputRange: [0, 0.08, 0.35, 1],
    outputRange: [0.15, 1.65, 1.1, 0.25],
  });
  const bloomScale = core.interpolate({
    inputRange: [0, 0.08, 0.35, 1],
    outputRange: [0.3, 2.4, 1.6, 0.4],
  });
  const coreOp = core.interpolate({
    inputRange: [0, 0.06, 0.4, 1],
    outputRange: [0, 1, 0.9, 0],
  });
  const bloomOp = core.interpolate({
    inputRange: [0, 0.06, 0.35, 1],
    outputRange: [0, 0.42, 0.28, 0],
  });

  return (
    <View
      style={[
        styles.fwBurst,
        { left: `${burst.cx}%`, top: `${burst.cy}%` },
      ]}
      pointerEvents="none"
    >
      {/* Outer soft bloom for stronger flash */}
      <Animated.View
        style={[
          styles.fwCoreBloom,
          {
            backgroundColor: burst.color,
            opacity: bloomOp,
            transform: [{ scale: bloomScale }],
            shadowColor: burst.color,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.fwCore,
          {
            backgroundColor: burst.color,
            opacity: coreOp,
            transform: [{ scale: coreScale }],
            shadowColor: burst.color,
          },
        ]}
      />
      {burst.sparks.map((s) => (
        <FireworkSpark
          key={s.key}
          spec={s}
          delay={burst.delay}
          burstScale={burst.scale}
        />
      ))}
    </View>
  );
}

function FireworksLayer({ seed }: { seed: number }) {
  const bursts = useMemo(() => fireworkBursts(seed), [seed]);
  const emojis = useMemo(
    () => floatSpecs(["✨", "✦", "★", "💫"], 14, seed + 3, 12),
    [seed]
  );
  return (
    <View style={styles.layer} pointerEvents="none">
      {bursts.map((b) => (
        <FireworkBurst key={b.key} burst={b} />
      ))}
      {emojis.map((s) => (
        <FloatingEmoji key={s.key} spec={s} mode="drift" />
      ))}
      <View style={styles.fwEdge} />
    </View>
  );
}

function HeartLayer({ seed }: { seed: number }) {
  const specs = useMemo(
    () => floatSpecs(["💖", "💗", "❤️", "💕", "💓"], 22, seed, 16),
    [seed]
  );
  return (
    <View style={styles.layer} pointerEvents="none">
      {specs.map((s) => (
        <FloatingEmoji key={s.key} spec={s} />
      ))}
      <HeroPulse emoji="💖" size={58} />
      <View style={styles.heartEdge} />
    </View>
  );
}

function FlowersLayer({ seed }: { seed: number }) {
  const specs = useMemo(
    () => floatSpecs(["🌸", "🌺", "🌼", "🌷", "💮", "🏵️"], 20, seed, 15),
    [seed]
  );
  return (
    <View style={styles.layer} pointerEvents="none">
      {specs.map((s) => (
        <FloatingEmoji key={s.key} spec={s} />
      ))}
      <HeroPulse emoji="🌸" size={48} />
      <View style={styles.flowerEdge} />
    </View>
  );
}

function PleaseStayLayer({ seed }: { seed: number }) {
  const specs = useMemo(
    () => floatSpecs(["🙏", "💛", "✨", "🤝"], 14, seed, 16),
    [seed]
  );
  return (
    <View style={styles.layer} pointerEvents="none">
      {specs.map((s) => (
        <FloatingEmoji key={s.key} spec={s} mode="drift" />
      ))}
      <HeroPulse emoji="🙏" size={52} />
      <View style={styles.stayLabelWrap} pointerEvents="none">
        <Text style={styles.stayLabel}>Please stay</Text>
      </View>
      <View style={styles.stayEdge} />
    </View>
  );
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
        style={[
          styles.passMicBubble,
          { opacity: bubbleOp, left: "16%", top: "26%" },
        ]}
      >
        …
      </Animated.Text>
      <Animated.Text
        style={[
          styles.passMicBubble,
          { opacity: bubbleOp, left: "28%", top: "38%" },
        ]}
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
    outputRange: [40, -460],
  });
  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [0, spec.drift],
  });

  const bodyH = spec.size * 1.2;
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
            borderColor: "rgba(255,255,255,0.4)",
          },
        ]}
      >
        <View style={styles.balloonShine} />
      </View>
      <View style={[styles.balloonKnot, { backgroundColor: spec.color }]} />
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
    outputRange: [-40, 520],
  });
  const translateX = t.interpolate({
    inputRange: [0, 0.35, 0.7, 1],
    outputRange: [
      0,
      spec.left % 2 === 0 ? 16 : -14,
      spec.left % 2 === 0 ? -10 : 12,
      spec.left % 2 === 0 ? 24 : -20,
    ],
  });
  const rotate = rot.interpolate({
    inputRange: [0, 1],
    outputRange: [`${spec.rot}deg`, `${spec.rot + 520}deg`],
  });
  const opacity = t.interpolate({
    inputRange: [0, 0.05, 0.88, 1],
    outputRange: [0, 1, 0.95, 0],
  });
  const scale = t.interpolate({
    inputRange: [0, 0.08, 1],
    outputRange: [0.55, 1.08, 0.75],
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
            width: spec.size * 1.45,
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
          transform: [{ translateY }, { translateX }, { rotate }, { scale }],
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
    <Animated.View style={[styles.barsRoot, { transform: [{ scale: slam }] }]}>
      <View style={styles.barsShade} />
      <View style={styles.barsRow}>
        {Array.from({ length: barCount }).map((_, i) => (
          <View key={`v-${i}`} style={styles.barsCol}>
            <View style={styles.barMetalV} />
            <View style={styles.barHighlightV} />
          </View>
        ))}
      </View>
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
      {["🎊", "🎉", "✨", "★", "💫", "💖", "✦"].map((em, i) => (
        <ConfettiEmoji
          key={em + i}
          emoji={em}
          left={5 + i * 13}
          delay={i * 120}
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
          duration: 3200,
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
    outputRange: [-24, 520],
  });
  const rotate = t.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const opacity = t.interpolate({
    inputRange: [0, 0.08, 0.9, 1],
    outputRange: [0, 1, 1, 0],
  });
  return (
    <Animated.Text
      style={[
        styles.confettiEmoji,
        {
          left: `${props.left}%`,
          opacity,
          transform: [{ translateY }, { rotate }],
        },
      ]}
    >
      {props.emoji}
    </Animated.Text>
  );
}

/** Soft edge vignette — web uses radial transparent center so faces stay clear. */
function SoftTint(props: { kind: string }) {
  const edge =
    props.kind === "heart"
      ? "rgba(255,80,140,0.22)"
      : props.kind === "flowers"
        ? "rgba(200,120,220,0.2)"
        : props.kind === "fireworks"
          ? "rgba(100,80,220,0.18)"
          : props.kind === "please_stay"
            ? "rgba(80,160,100,0.2)"
            : props.kind === "balloons"
              ? "rgba(255,120,200,0.14)"
              : props.kind === "confetti"
                ? "rgba(255,200,80,0.12)"
                : props.kind === "pass_mic"
                  ? "rgba(255,180,60,0.16)"
                  : props.kind === "bars"
                    ? "rgba(0,0,0,0.2)"
                    : "rgba(0,0,0,0.12)";
  return (
    <View style={styles.softTintRoot} pointerEvents="none">
      <View style={[styles.softTintEdge, { borderColor: edge }]} />
    </View>
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

  const isBars = kind === "bars";
  const isBalloons = kind === "balloons";
  const isConfetti = kind === "confetti";
  const isPassMic = kind === "pass_mic";
  const isHeart = kind === "heart";
  const isFlowers = kind === "flowers";
  const isFireworks = kind === "fireworks";
  const isStay = kind === "please_stay";

  const a11y =
    label ||
    barsCaption ||
    (kind ? `Gift: ${kind}` : "Gift animation");

  return (
    <View
      style={[
        styles.root,
        Platform.OS === "android" ? styles.rootAndroid : null,
      ]}
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLiveRegion="polite"
      accessibilityLabel={a11y}
    >
      {/* Soft edge only — avoid full-screen mud that made Android FX feel cheap */}
      {!isBars ? <SoftTint kind={kind || "heart"} /> : null}

      {isBars ? <BarsOverlay /> : null}
      {isBalloons ? <BalloonsLayer seed={seed} /> : null}
      {isConfetti ? <ConfettiLayer seed={seed} /> : null}
      {isPassMic ? (
        <PassMicLayer caption={barsCaption || undefined} />
      ) : null}
      {isHeart ? <HeartLayer seed={seed} /> : null}
      {isFlowers ? <FlowersLayer seed={seed} /> : null}
      {isFireworks ? <FireworksLayer seed={seed} /> : null}
      {isStay ? <PleaseStayLayer seed={seed} /> : null}

      {/* Unknown effect fallback — still animate stars */}
      {!isBars &&
      !isBalloons &&
      !isConfetti &&
      !isPassMic &&
      !isHeart &&
      !isFlowers &&
      !isFireworks &&
      !isStay ? (
        <View style={styles.layer} pointerEvents="none">
          {floatSpecs(["★", "✨", "💫"], 16, seed, 14).map((s) => (
            <FloatingEmoji key={s.key} spec={s} />
          ))}
          <HeroPulse
            emoji={
              label?.match(/^\S+/)?.[0] ||
              GIFTS.find((g) => g.id === kind)?.emoji ||
              "★"
            }
            size={48}
          />
        </View>
      ) : null}

      {isBars && barsCaption ? (
        <Text style={styles.sub} importantForAccessibility="no">
          {barsCaption}
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
    zIndex: 40,
    overflow: "hidden",
  },
  rootAndroid: {
    elevation: 32,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  softTintRoot: {
    ...StyleSheet.absoluteFillObject,
  },
  softTintEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderRadius: 4,
    backgroundColor: "transparent",
  },
  floatEmoji: {
    position: "absolute",
    bottom: 0,
    marginLeft: -12,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
    zIndex: 2,
  },
  heroEmoji: {
    position: "absolute",
    alignSelf: "center",
    top: "38%",
    textShadowColor: "rgba(255,80,140,0.55)",
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 4 },
    zIndex: 5,
  },
  stayLabelWrap: {
    position: "absolute",
    bottom: "16%",
    alignSelf: "center",
    zIndex: 6,
  },
  stayLabel: {
    color: "#e8ffe8",
    fontSize: 15,
    fontWeight: "800",
    backgroundColor: "rgba(20,40,28,0.88)",
    borderColor: "rgba(120,220,140,0.5)",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
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
    position: "absolute",
    bottom: "14%",
    color: "#e8eef7",
    fontSize: 15,
    fontWeight: "700",
    textShadowColor: "#000",
    textShadowRadius: 6,
    zIndex: 5,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  /* ── Fireworks ── */
  fwBurst: {
    position: "absolute",
    width: 0,
    height: 0,
    zIndex: 3,
  },
  fwCoreBloom: {
    position: "absolute",
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    borderRadius: 999,
    shadowOpacity: 1,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    // Android glow proxy (shadow* is iOS-only) — cores only, not every spark
    elevation: 10,
  },
  fwCore: {
    position: "absolute",
    width: 14,
    height: 14,
    marginLeft: -7,
    marginTop: -7,
    borderRadius: 999,
    shadowOpacity: 1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  fwSpark: {
    position: "absolute",
    marginLeft: -2,
    marginTop: -2,
    shadowOpacity: 0.95,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  fwEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: "rgba(180,140,255,0.2)",
    borderRadius: 4,
  },
  heartEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: "rgba(255,120,170,0.28)",
    borderRadius: 4,
  },
  flowerEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: "rgba(220,140,255,0.24)",
    borderRadius: 4,
  },
  stayEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: "rgba(120,220,140,0.28)",
    borderRadius: 4,
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
    fontSize: 18,
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
