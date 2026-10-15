/**
 * Gift FX overlays for Live — closer to web live-stage.css particle FX.
 * RN Animated only (no Lottie/extra deps). Keep RTC/SurfaceView usable:
 * soft edge tint (not full mud), elevation above zOrder-0 RTCView.
 */
import { memo, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { GIFTS, type GiftKind } from "./gifts";

/** Hold times aligned with web STAR_GIFT_SECS (ms). */
export const GIFT_FX_HOLD_MS: Record<string, number> = {
  heart: 3000,
  bars: 15500,
  fence: 15000,
  flowers: 15000,
  balloons: 15000,
  confetti: 15000,
  shooting_star: 15000,
  snow: 15000,
  spotlight: 15000,
  crown: 12000,
  disco: 12000,
  pass_mic: 5200,
  fireworks: 20000,
  please_stay: 15000,
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
  const n = 96;
  return Array.from({ length: n }, (_, i) => {
    const near = i % 3 !== 0;
    let left = 1 + ((seedN(seed, i + 1) * 1.25) % 96);
    if (near && left > 26 && left < 74) {
      left = i % 2 === 0 ? 4 + (i % 20) : 78 + (i % 18);
    }
    return {
      key: `c-${i}`,
      left,
      size: 5 + (i % 9) * 1.55,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: (i % 16) * 65,
      dur: 2300 + (i % 9) * 280,
      shape: shapes[i % shapes.length],
      rot: (i * 47) % 360,
    };
  });
}

type SnowBand = "far" | "mid" | "near";
type SnowShape = "dot" | "needle" | "plate" | "dendrite";
type SnowSpec = {
  key: string;
  left: number;
  size: number;
  delay: number;
  dur: number;
  drift: number;
  band: SnowBand;
  shape: SnowShape;
};

/** Transform-only full-tile travel (px). Never animate layout `top`/`bottom`. */
export const SNOW_FALL_Y = [-80, 680] as const;
export const BALLOON_RISE_Y = [96, -640] as const;

function snowSpecs(seed: number): SnowSpec[] {
  // Web snow-v4: ~28 crystals, near flakes stay off the face.
  const n = 28;
  return Array.from({ length: n }, (_, i) => {
    const band: SnowBand = i % 5 === 0 ? "far" : i % 3 === 0 ? "mid" : "near";
    let left = 1 + ((seedN(seed, i + 3) * 1.25) % 96);
    if (band === "near" && left > 22 && left < 78) {
      left = i % 2 === 0 ? 6 + (i % 16) : 82 + (i % 14);
    }
    const shape: SnowShape =
      band === "far" && i % 4 === 0
        ? "dot"
        : band === "far"
          ? "needle"
          : i % 2 === 0
            ? "dendrite"
            : "plate";
    return {
      key: `sn-${i}`,
      left,
      size:
        band === "far" ? 6 + (i % 3) : band === "mid" ? 10 + (i % 4) : 15 + (i % 5),
      delay: (i % 18) * 70,
      dur: band === "far" ? 4200 + (i % 5) * 280 : 2800 + (i % 9) * 280,
      drift: ((i * 17) % 36) - 18,
      band,
      shape,
    };
  });
}

function balloonSpecs(seed: number): BalloonSpec[] {
  // Web balloons-v6: side columns only so the face stays open.
  const n = 18;
  return Array.from({ length: n }, (_, i) => ({
    key: `b-${i}`,
    left: i % 2 === 0 ? 6 + ((i * 5) % 16) : 80 + ((i * 7) % 16),
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
    { cx: 16, cy: 22 },
    { cx: 84, cy: 20 },
    { cx: 12, cy: 42 },
    { cx: 88, cy: 38 },
    { cx: 22, cy: 14 },
    { cx: 78, cy: 12 },
  ];
  return centers.map((c, bi) => {
    // 20–28 sparks per burst for richer radial fans
    const nSparks = 26 + (bi % 5) * 2;
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

function GlowOrb(props: {
  left: number;
  top: number;
  size: number;
  color: string;
  delay: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(props.delay),
        Animated.timing(t, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [props.delay, t]);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.25] });
  const opacity = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.55],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: `${props.left}%`,
        top: `${props.top}%`,
        width: props.size,
        height: props.size,
        marginLeft: -props.size / 2,
        marginTop: -props.size / 2,
        borderRadius: props.size,
        backgroundColor: props.color,
        opacity,
        transform: [{ scale }],
        elevation: 6,
        shadowColor: props.color,
        shadowOpacity: 0.9,
        shadowRadius: 16,
      }}
    />
  );
}

function HeroPulse(props: { emoji: string; size?: number; chest?: boolean }) {
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
        props.chest ? styles.heroEmojiChest : null,
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
  return (
    <View style={styles.layer} pointerEvents="none">
      {bursts.map((b) => (
        <FireworkBurst key={b.key} burst={b} />
      ))}
      <View style={styles.fwEdge} />
    </View>
  );
}

function HeartLayer() {
  const scale = useRef(new Animated.Value(0.16)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const grow = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 3.4,
        duration: 1650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    const swell = Animated.timing(scale, {
      toValue: 3.9,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    const pop = Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.05,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]);
    const loop = Animated.sequence([grow, swell, pop]);
    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);
  return (
    <View style={styles.layer} pointerEvents="none">
      <Animated.Text
        style={[
          styles.heroEmoji,
          styles.heroEmojiCenter,
          styles.heroEmojiDepth,
          {
            fontSize: 168,
            opacity,
            transform: [{ scale }, { translateX: 5 }, { translateY: 7 }],
          },
        ]}
        importantForAccessibility="no"
      >
        💖
      </Animated.Text>
      <Animated.Text
        style={[
          styles.heroEmoji,
          styles.heroEmojiCenter,
          {
            fontSize: 168,
            opacity,
            transform: [{ scale }],
            textShadowColor: "rgba(255,240,246,0.55)",
            textShadowRadius: 18,
            textShadowOffset: { width: -4, height: -6 },
          },
        ]}
        importantForAccessibility="no"
      >
        💖
      </Animated.Text>
    </View>
  );
}

function BloomView({ color, size }: { color: string; size: number }) {
  const pw = size * 0.34;
  const ph = size * 0.52;
  const petal = (deg: number, under?: boolean) => ({
    position: "absolute" as const,
    width: pw,
    height: ph,
    borderRadius: size,
    backgroundColor: under ? "#5a1830" : color,
    opacity: under ? 0.4 : 1,
    left: size / 2 - pw / 2,
    top: size / 2 - ph / 2,
    transform: [
      { rotate: `${deg}deg` },
      { translateY: -size * (under ? 0.16 : 0.22) },
      { translateX: under ? 1.4 : 0 },
    ],
  });
  return (
    <View style={{ width: size, height: size }}>
      {[0, 72, 144, 216, 288].map((deg) => (
        <View key={`u${deg}`} style={petal(deg, true)} />
      ))}
      {[0, 72, 144, 216, 288].map((deg) => (
        <View key={deg} style={petal(deg, false)} />
      ))}
      <View
        style={{
          position: "absolute",
          width: size * 0.28,
          height: size * 0.28,
          borderRadius: size,
          backgroundColor: "#ffe08a",
          left: size * 0.36,
          top: size * 0.36,
        }}
      />
    </View>
  );
}

function FlowersLayer({ seed }: { seed: number }) {
  const hues = ["#ff8ab8", "#ff5a9a", "#ffc2d4", "#e85a8a"];
  const wreath = useMemo(() => {
    const n = 16;
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const st = Math.sin(t);
      const x = 16 * st * st * st;
      const y = -(
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)
      );
      out.push({
        key: `w${i}`,
        left: 50 + x * 2.1,
        top: 48 + y * 1.7,
        color: hues[i % hues.length],
        size: 22 + (i % 3) * 3,
      });
    }
    return out;
  }, [seed]);
  return (
    <View style={styles.layer} pointerEvents="none">
      {wreath.map((b) => (
        <View
          key={b.key}
          style={{
            position: "absolute",
            left: `${b.left}%`,
            top: `${b.top}%`,
            marginLeft: -b.size / 2,
            marginTop: -b.size / 2,
          }}
        >
          <BloomView color={b.color} size={b.size} />
        </View>
      ))}
      <View style={styles.flowerEdge} />
    </View>
  );
}

function PleaseStayLayer({ seed }: { seed: number }) {
  void seed;
  return (
    <View style={styles.layer} pointerEvents="none">
      <View style={styles.stayLock} pointerEvents="none">
        <View style={styles.stayShackle} />
        <View style={styles.stayBody}>
          <View style={styles.stayKeyhole} />
        </View>
      </View>
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
      <Animated.View
        style={[
          styles.passMicBubble,
          { opacity: bubbleOp, left: "16%", top: "26%" },
        ]}
      />
      <Animated.View
        style={[
          styles.passMicBubble,
          { opacity: bubbleOp, left: "28%", top: "38%" },
        ]}
      />
      <Animated.View
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
        <View style={styles.passMicHead} />
        <View style={styles.passMicStem} />
        <View style={styles.passMicBase} />
      </Animated.View>
      <Animated.View
        style={[
          styles.passMicHand,
          {
            opacity: handOp,
            transform: [{ scale: handScale }],
          },
        ]}
      >
        <View style={styles.passMicPalm} />
      </Animated.View>
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
              duration: spec.dur * 0.28,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(x, {
              toValue: -1,
              duration: spec.dur * 0.32,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(x, {
              toValue: 0.4,
              duration: spec.dur * 0.24,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(x, {
              toValue: 0,
              duration: spec.dur * 0.16,
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
        Animated.timing(y, { toValue: 0, duration: 1, useNativeDriver: true }),
        Animated.timing(x, { toValue: 0, duration: 1, useNativeDriver: true }),
      ])
    );
    rise.start();
    return () => rise.stop();
  }, [spec.delay, spec.dur, spec.key, opacity, x, y]);

  const translateY = y.interpolate({
    inputRange: [0, 1],
    outputRange: [...BALLOON_RISE_Y],
  });
  const translateX = x.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-Math.abs(spec.drift) * 0.7, 0, Math.abs(spec.drift)],
  });

  const bodyH = spec.size * 1.35;
  const bodyW = spec.size;

  return (
    <View
      pointerEvents="none"
      style={[styles.balloonWrap, { left: `${spec.left}%` }]}
    >
      <Animated.View
        renderToHardwareTextureAndroid
        collapsable={false}
        style={{
          alignItems: "center",
          opacity,
          transform: [{ translateY }, { translateX }],
        }}
      >
        <View
          style={[
            styles.balloonBody,
            {
              width: bodyW,
              height: bodyH,
              backgroundColor: spec.color,
              borderColor: "rgba(255,255,255,0.28)",
              borderTopLeftRadius: bodyW * 0.5,
              borderTopRightRadius: bodyW * 0.5,
              borderBottomLeftRadius: bodyW * 0.42,
              borderBottomRightRadius: bodyW * 0.42,
            },
          ]}
        >
          <View style={styles.balloonShade} />
          <View style={styles.balloonShine} />
        </View>
        <View style={[styles.balloonKnot, { backgroundColor: spec.color }]} />
        <View
          style={[
            styles.balloonString,
            { transform: [{ rotate: spec.drift >= 0 ? "10deg" : "-10deg" }] },
          ]}
        />
      </Animated.View>
    </View>
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
    <View
      pointerEvents="none"
      collapsable={false}
      style={[styles.confettiBit, { left: `${spec.left}%` }]}
    >
      <Animated.View
        renderToHardwareTextureAndroid
        style={[
          shapeStyle,
          {
            backgroundColor: spec.color,
            opacity,
            transform: [{ translateY }, { translateX }, { rotate }, { scale }],
          },
        ]}
      />
    </View>
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

  const barCount = 7;
  return (
    <Animated.View
      style={[styles.barsRoot, { transform: [{ scale: slam }] }]}
      pointerEvents="none"
    >
      <View style={styles.barsShade} pointerEvents="none">
        <View style={styles.barsShadeFill} />
        <View style={styles.barsShadeTop} />
        <View style={styles.barsShadeBottom} />
        <View style={[styles.barsShadeCorner, styles.barsShadeTL]} />
        <View style={[styles.barsShadeCorner, styles.barsShadeTR]} />
        <View style={[styles.barsShadeCorner, styles.barsShadeBL]} />
        <View style={[styles.barsShadeCorner, styles.barsShadeBR]} />
      </View>
      <View style={styles.barsRow}>
        {Array.from({ length: barCount }).map((_, i) => (
          <View key={`v-${i}`} style={styles.barsCol}>
            <View style={styles.barCastShadow} />
            <View style={styles.barMetalV} />
            <View style={styles.barUmbraV} />
            <View style={styles.barHighlightV} />
          </View>
        ))}
      </View>
      <View style={[styles.barMetalH, { top: "22%" }]}>
        <View style={styles.barMetalHHighlight} />
        <View style={styles.barMetalHUmbra} />
      </View>
      <View style={[styles.barMetalH, { top: "76%" }]}>
        <View style={styles.barMetalHHighlight} />
        <View style={styles.barMetalHUmbra} />
      </View>
      <Animated.View
        style={[styles.barsSheen, { transform: [{ translateX: sheenX }] }]}
      />
      <View style={styles.barsFrame} />
    </Animated.View>
  );
}

/**
 * Chain-link like browser: one repeating PNG (no 4×4 stretch tiles).
 * Stretching 16 cells made huge diamonds + seams. No ⛓️ badge.
 */
export function FenceOverlay() {
  const fade = useRef(new Animated.Value(0)).current;
  const sheen = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sheen, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheen, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sheen, fade]);
  const sheenX = sheen.interpolate({
    inputRange: [0, 1],
    outputRange: [-70, 70],
  });
  return (
    <Animated.View
      style={[styles.fenceRoot, { opacity: fade }]}
      pointerEvents="none"
    >
      <Image
        source={require("../../assets/fx/fence-mesh.png")}
        style={StyleSheet.absoluteFill}
        resizeMode="repeat"
      />
      <View style={styles.fenceLight} pointerEvents="none">
        <View style={styles.fenceLightTL} />
        <View style={styles.fenceLightTLCore} />
        <View style={styles.fenceShadeBottom} />
        <View style={styles.fenceShadeBottomCore} />
      </View>
      <View style={styles.fenceFrame} pointerEvents="none" />
      <View style={styles.fenceFrameInner} pointerEvents="none" />
      <Animated.View
        style={[styles.fenceSheen, { transform: [{ translateX: sheenX }] }]}
      />
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
      <View style={styles.confettiEdge} />
    </View>
  );
}

function ShootingStarLayer() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: 1850,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(1400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  const tx = t.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 420],
  });
  const ty = t.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [8, 28, 72],
  });
  const rot = t.interpolate({
    inputRange: [0, 1],
    outputRange: ["16deg", "40deg"],
  });
  const op = t.interpolate({
    inputRange: [0, 0.08, 0.86, 1],
    outputRange: [0, 1, 1, 0],
  });
  return (
    <View style={styles.layer} pointerEvents="none">
      <Animated.View
        style={[
          styles.ssHero,
          { opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { rotate: rot }] },
        ]}
      >
        <View style={styles.ssPlume} />
        <View style={styles.ssStar}>
          <View style={styles.ssStarArmH} />
          <View style={styles.ssStarArmV} />
        </View>
      </Animated.View>
    </View>
  );
}

function FallingCrystal(props: { spec: SnowSpec }) {
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
        Animated.parallel([
          Animated.timing(t, { toValue: 0, duration: 1, useNativeDriver: true }),
          Animated.timing(rot, { toValue: 0, duration: 1, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [spec.delay, spec.dur, spec.key, rot, t]);

  const translateY = t.interpolate({
    inputRange: [0, 1],
    outputRange: [...SNOW_FALL_Y],
  });
  const translateX = t.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, spec.drift, spec.drift * 1.35],
  });
  const rotate = rot.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", spec.band === "far" ? "80deg" : "200deg"],
  });
  const opacity = t.interpolate({
    inputRange: [0, 0.08, 0.9, 1],
    outputRange: [
      0,
      spec.band === "far" ? 0.28 : spec.band === "mid" ? 0.58 : 0.94,
      spec.band === "far" ? 0.2 : 0.85,
      0,
    ],
  });
  const s = spec.size;

  return (
    <View
      pointerEvents="none"
      style={[styles.snowBit, { left: `${spec.left}%` }]}
    >
      <Animated.View
        renderToHardwareTextureAndroid
        collapsable={false}
        style={{
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }],
        }}
      >
        {spec.shape === "dot" ? (
          <View style={[styles.snowDot, { width: s, height: s, borderRadius: s / 2 }]} />
        ) : spec.shape === "needle" ? (
          <View style={[styles.snowNeedle, { width: Math.max(3, s * 0.28), height: s }]} />
        ) : spec.shape === "plate" ? (
          <View style={[styles.snowPlate, { width: s, height: s }]} />
        ) : (
          <View style={[styles.snowDendrite, { width: s, height: s }]}>
            <View style={[styles.snowArmH, { width: s, top: s / 2 - 0.75 }]} />
            <View style={[styles.snowArmV, { height: s, left: s / 2 - 0.75 }]} />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

function SnowLayer({ seed }: { seed: number }) {
  const specs = useMemo(() => snowSpecs(seed), [seed]);
  return (
    <View style={styles.layer} pointerEvents="none">
      {specs.map((s) => (
        <FallingCrystal key={s.key} spec={s} />
      ))}
      <View style={styles.snowEdge} />
    </View>
  );
}

/** Top-down follow-spot. No yellow face ring. Never filter the RTC SurfaceView. */
function SpotlightLayer() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const beamOp = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.42, 0.78],
  });
  return (
    <View style={styles.layer} pointerEvents="none">
      <View style={styles.spotEdgeTop} />
      <View style={styles.spotEdgeLeft} />
      <View style={styles.spotEdgeRight} />
      <View style={styles.spotCan} />
      <Animated.View style={[styles.spotBeam, { opacity: beamOp }]} />
      <Animated.View style={[styles.spotShaft, { opacity: beamOp }]} />
    </View>
  );
}

/** 5-spike gold circlet at the top of the tile (on their head). No video filter. */
function CrownLayer() {
  const drop = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    drop.setValue(0);
    const enter = Animated.spring(drop, {
      toValue: 1,
      friction: 7,
      tension: 68,
      useNativeDriver: true,
    });
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    enter.start(() => loop.start());
    return () => {
      enter.stop();
      loop.stop();
    };
  }, [drop, bob]);
  const ty = drop.interpolate({
    inputRange: [0, 1],
    outputRange: [-72, 0],
  });
  const bobY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 3],
  });
  // Web svg-v8: taller center spike. No traveling sheen.
  const spikes = [22, 30, 42, 30, 22];
  return (
    <View style={styles.layer} pointerEvents="none">
      <View style={styles.crownHalo} />
      <Animated.View
        style={[
          styles.crownHero,
          { transform: [{ translateY: ty }, { translateY: bobY }] },
        ]}
      >
        <View style={styles.crownBack} pointerEvents="none">
          {spikes.map((h, i) => (
            <View key={`b-${i}`} style={styles.crownSpikeCol}>
              <View
                style={[
                  styles.crownSpike,
                  {
                    borderBottomWidth: h,
                    borderLeftWidth: 8,
                    borderRightWidth: 8,
                    borderBottomColor: "#4a2808",
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.crownSpikes}>
          {spikes.map((h, i) => (
            <View key={i} style={styles.crownSpikeCol}>
              <View
                style={[
                  styles.crownOrb,
                  i === 2 ? styles.crownOrbKing : null,
                ]}
              />
              <View
                style={[
                  styles.crownSpike,
                  {
                    borderBottomWidth: h,
                    borderLeftWidth: 8,
                    borderRightWidth: 8,
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.crownBand}>
          <View style={styles.crownBandLit} />
        </View>
      </Animated.View>
    </View>
  );
}

const DISCO_FACETS = [
  "#f6f8ff",
  "#c8d0e0",
  "#7a8498",
  "#eef2fa",
  "#9aa4b8",
  "#5e6678",
];
/** magenta, cyan, gold, lime, orange */
const DISCO_ORB_HUES = ["#ff2bd6", "#22d3ee", "#fbbf24", "#84cc16", "#fb923c"];
/** Club beams (browser canvas 855 hues). */
const DISCO_BEAM_COLORS = [
  "#FF2EA6",
  "#22D3EE",
  "#FFD14A",
  "#FF6B1A",
  "#A78BFA",
  "#7CFF4A",
  "#C026D3",
  "#FF4D6A",
];

type DiscoOrbSpec = {
  key: string;
  left: number;
  top: number;
  size: number;
  color: string;
  delay: number;
  travelX: number;
  travelY: number;
  dur: number;
};

/** Rim DiscoOrb lights (replaces discoFlash sparkles). Edges only — not the face center. */
const DISCO_ORBS: DiscoOrbSpec[] = [
  { key: "o0", left: 6, top: 10, size: 14, color: DISCO_ORB_HUES[0], delay: 0, travelX: 56, travelY: 22, dur: 1300 },
  { key: "o1", left: 86, top: 12, size: 13, color: DISCO_ORB_HUES[1], delay: 80, travelX: -58, travelY: 24, dur: 1500 },
  { key: "o2", left: 6, top: 22, size: 11, color: DISCO_ORB_HUES[2], delay: 40, travelX: 48, travelY: -18, dur: 1400 },
  { key: "o3", left: 90, top: 20, size: 12, color: DISCO_ORB_HUES[3], delay: 120, travelX: -50, travelY: 18, dur: 1600 },
  { key: "o4", left: 14, top: 6, size: 12, color: DISCO_ORB_HUES[4], delay: 60, travelX: 62, travelY: 14, dur: 1450 },
  { key: "o5", left: 78, top: 7, size: 11, color: DISCO_ORB_HUES[0], delay: 160, travelX: -54, travelY: 16, dur: 1350 },
  { key: "o6", left: 4, top: 16, size: 10, color: DISCO_ORB_HUES[1], delay: 200, travelX: 44, travelY: 28, dur: 1200 },
  { key: "o7", left: 92, top: 15, size: 10, color: DISCO_ORB_HUES[2], delay: 100, travelX: -40, travelY: 20, dur: 1550 },
  { key: "o8", left: 18, top: 5, size: 13, color: DISCO_ORB_HUES[3], delay: 220, travelX: 70, travelY: 10, dur: 1700 },
  { key: "o9", left: 74, top: 5, size: 12, color: DISCO_ORB_HUES[4], delay: 140, travelX: -64, travelY: 12, dur: 1250 },
];

function DiscoOrb(props: { spec: DiscoOrbSpec }) {
  const { spec } = props;
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    // ping-pong translate along the rim (out then BACK)
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(spec.delay),
        Animated.timing(t, {
          toValue: 1,
          duration: spec.dur,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: spec.dur,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [spec.delay, spec.dur, spec.key, t]);

  const translateX = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0, spec.travelX],
  });
  const translateY = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0, spec.travelY],
  });
  const opacity = t.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.55, 1, 0.55],
  });
  const scale = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0.86, 1.14],
  });

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={[
        styles.discoOrb,
        {
          left: `${spec.left}%`,
          top: `${spec.top}%`,
          width: spec.size,
          height: spec.size,
        },
      ]}
    >
      <Animated.View
        renderToHardwareTextureAndroid
        style={{
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size,
          backgroundColor: spec.color,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
          shadowColor: spec.color,
        }}
      >
        <View style={styles.discoOrbCore} />
      </Animated.View>
    </View>
  );
}

/**
 * Club beam from the hanging ball. Outer View holds layout; inner Animated
 * rotates only (Android will not run native transform if left/top is on the same node).
 */
function DiscoBeam(props: { index: number }) {
  const { index } = props;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [index, spin]);
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: [`${index * 45}deg`, `${index * 45 + 360}deg`],
  });
  const width = 26 + (index % 4) * 2;
  const opacity = 0.32 + (index % 6) * 0.03;
  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={[
        styles.discoBeam,
        {
          width,
          marginLeft: -(width / 2),
          opacity,
        },
      ]}
    >
      <Animated.View
        renderToHardwareTextureAndroid
        style={[
          styles.discoBeamRay,
          {
            backgroundColor: DISCO_BEAM_COLORS[index % DISCO_BEAM_COLORS.length],
            transform: [{ rotate }],
          },
        ]}
      />
    </View>
  );
}

/** Hanging 96px ball + 8 rotating color beams + rim orbs. Wash is a RING (face stays a hole). */
function DiscoLayer() {
  const spin = useRef(new Animated.Value(0)).current;
  const washSpin = useRef(new Animated.Value(0)).current;
  const lit = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const ballLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const washLoop = Animated.loop(
      Animated.timing(washSpin, {
        toValue: 1,
        duration: 5500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const litLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(lit, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(lit, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    ballLoop.start();
    washLoop.start();
    litLoop.start();
    return () => {
      ballLoop.stop();
      washLoop.stop();
      litLoop.stop();
    };
  }, [spin, washSpin, lit]);
  const rot = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const washRot = washSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const litX = lit.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 16],
  });
  const litY = lit.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, 10],
  });
  const litOp = lit.interpolate({
    inputRange: [0, 1],
    outputRange: [0.38, 0.88],
  });
  return (
    <View style={styles.layer} pointerEvents="none">
      <Animated.View
        style={[styles.discoWash, { transform: [{ rotate: washRot }] }]}
      />
      {DISCO_BEAM_COLORS.map((_, i) => (
        <DiscoBeam key={`beam-${i}`} index={i} />
      ))}
      <View style={styles.discoStem} />
      <View style={styles.discoBall}>
        <Animated.View
          style={[styles.discoFacetGrid, { transform: [{ rotate: rot }] }]}
        >
          {Array.from({ length: 64 }, (_, i) => (
            <View
              key={i}
              style={[
                styles.discoFacet,
                { backgroundColor: DISCO_FACETS[i % DISCO_FACETS.length] },
              ]}
            />
          ))}
        </Animated.View>
        <View style={styles.discoShade} />
        <Animated.View
          style={[
            styles.discoLit,
            {
              opacity: litOp,
              transform: [{ translateX: litX }, { translateY: litY }],
            },
          ]}
        />
      </View>
      {DISCO_ORBS.map((o) => (
        <DiscoOrb key={o.key} spec={o} />
      ))}
    </View>
  );
}

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
                : props.kind === "shooting_star"
                  ? "rgba(255,200,80,0.16)"
                  : props.kind === "snow"
                    ? "rgba(180,210,255,0.12)"
                    : props.kind === "crown"
                      ? "rgba(255,210,80,0.16)"
                    : props.kind === "pass_mic"
                  ? "rgba(255,180,60,0.16)"
                  : props.kind === "fence"
                    ? "rgba(40,50,40,0.14)"
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
  const isFence = kind === "fence";
  const isBalloons = kind === "balloons";
  const isConfetti = kind === "confetti";
  const isPassMic = kind === "pass_mic";
  const isHeart = kind === "heart";
  const isFlowers = kind === "flowers";
  const isFireworks = kind === "fireworks";
  const isStay = kind === "please_stay";
  const isShootingStar = kind === "shooting_star";
  const isSnow = kind === "snow";
  const isSpotlight = kind === "spotlight";
  const isCrown = kind === "crown";
  const isDisco = kind === "disco";

  const a11y =
    label ||
    barsCaption ||
    (kind ? `Gift: ${kind}` : "Gift animation");

  return (
    <View
      style={[
        styles.root,
        Platform.OS === "android" ? styles.rootAndroid : null,
        Platform.OS === "ios" ? styles.rootIOS : null,
      ]}
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLiveRegion="polite"
      accessibilityLabel={a11y}
    >
      {/* Soft edge only — avoid full-screen mud that made Android FX feel cheap.
          Spotlight paints its own radial hole; skip extra tint. */}
      {!isBars && !isFence && !isSpotlight ? (
        <SoftTint kind={kind || "heart"} />
      ) : null}

      {isBars ? <BarsOverlay /> : null}
      {isFence ? <FenceOverlay /> : null}
      {isBalloons ? <BalloonsLayer seed={seed} /> : null}
      {isConfetti ? <ConfettiLayer seed={seed} /> : null}
      {isPassMic ? (
        <PassMicLayer caption={barsCaption || undefined} />
      ) : null}
      {isHeart ? <HeartLayer /> : null}
      {isFlowers ? <FlowersLayer seed={seed} /> : null}
      {isFireworks ? <FireworksLayer seed={seed} /> : null}
      {isStay ? <PleaseStayLayer seed={seed} /> : null}
      {/* shooting_star is wallet-only — no overlay */}
      {isSnow ? <SnowLayer seed={seed} /> : null}
      {isSpotlight ? <SpotlightLayer /> : null}
      {isCrown ? <CrownLayer /> : null}
      {isDisco ? <DiscoLayer /> : null}

      {/* Unknown effect fallback — still animate stars */}
      {!isBars &&
      !isFence &&
      !isBalloons &&
      !isConfetti &&
      !isPassMic &&
      !isHeart &&
      !isFlowers &&
      !isFireworks &&
      !isStay &&
      !isShootingStar &&
      !isSnow &&
      !isSpotlight &&
      !isCrown &&
      !isDisco ? (
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
  /**
   * iOS has no SurfaceView hole-punch so the FX layer already paints above
   * the video by subview order alone, but on extra (multi-remote) tiles it
   * otherwise reads as flat/empty next to Android's elevated shadow — give
   * it the shadow* depth cue this file already uses elsewhere (fwCoreBloom)
   * as the iOS analog of elevation.
   */
  rootIOS: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
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
  heroEmojiChest: {
    top: "auto",
    bottom: "10%",
  },
  heroEmojiCenter: {
    top: "42%",
    bottom: "auto",
    marginLeft: -56,
  },
  heroEmojiDepth: {
    color: "#4a0818",
    textShadowColor: "rgba(20,4,10,0.55)",
    textShadowRadius: 8,
  },
  heartHeroWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  stayLock: {
    position: "absolute",
    bottom: "24%",
    alignSelf: "center",
    alignItems: "center",
    zIndex: 5,
  },
  stayShackle: {
    width: 22,
    height: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 4,
    borderBottomWidth: 0,
    borderColor: "#ffd0de",
    marginBottom: -2,
  },
  stayBody: {
    width: 40,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#ef2b6a",
    alignItems: "center",
    justifyContent: "center",
  },
  stayKeyhole: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff6f8",
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
    alignItems: "center",
    zIndex: 4,
  },
  passMicHead: {
    width: 28,
    height: 36,
    borderRadius: 14,
    backgroundColor: "#d8dee8",
    borderWidth: 1,
    borderColor: "#2a3038",
  },
  passMicStem: {
    width: 5,
    height: 16,
    backgroundColor: "#c8c0b0",
    marginTop: -1,
  },
  passMicBase: {
    width: 22,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#c8c0b0",
  },
  passMicHand: {
    position: "absolute",
    right: "14%",
    top: "16%",
    zIndex: 3,
  },
  passMicPalm: {
    width: 34,
    height: 28,
    borderRadius: 12,
    backgroundColor: "#f3c49a",
    borderWidth: 1,
    borderColor: "#8a5a38",
  },
  passMicBubble: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,246,224,0.9)",
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
  fenceRoot: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 1,
  },
  fenceLight: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  fenceLightTL: {
    position: "absolute",
    top: -48,
    left: -40,
    width: 240,
    height: 180,
    borderRadius: 120,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  fenceLightTLCore: {
    position: "absolute",
    top: -18,
    left: -14,
    width: 132,
    height: 96,
    borderRadius: 72,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  fenceShadeBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "30%",
    backgroundColor: "rgba(4, 5, 8, 0.26)",
  },
  fenceShadeBottomCore: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "14%",
    backgroundColor: "rgba(4, 5, 8, 0.2)",
  },
  fenceFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 5,
    borderColor: "#120e0c",
  },
  fenceFrameInner: {
    ...StyleSheet.absoluteFillObject,
    margin: 3,
    borderWidth: 2,
    borderColor: "rgba(168, 152, 132, 0.34)",
  },
  fenceSheen: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 36,
    backgroundColor: "rgba(210, 220, 230, 0.05)",
  },
  barsRoot: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 1,
  },
  barsShade: {
    ...StyleSheet.absoluteFillObject,
  },
  barsShadeFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 6, 4, 0.14)",
  },
  barsShadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "16%",
    backgroundColor: "rgba(4, 5, 8, 0.3)",
  },
  barsShadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "20%",
    backgroundColor: "rgba(4, 5, 8, 0.36)",
  },
  barsShadeCorner: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  barsShadeTL: { top: -44, left: -44 },
  barsShadeTR: { top: -44, right: -44 },
  barsShadeBL: { bottom: -44, left: -44 },
  barsShadeBR: { bottom: -44, right: -44 },
  barsRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "space-evenly",
    paddingHorizontal: 4,
  },
  barsCol: {
    width: 22,
    height: "100%",
    position: "relative",
    overflow: "visible",
  },
  barCastShadow: {
    position: "absolute",
    left: 5,
    top: 3,
    bottom: -2,
    width: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  barMetalV: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 18,
    borderRadius: 9,
    backgroundColor: "#3a2418",
    borderWidth: 1,
    borderColor: "#120e0c",
  },
  barUmbraV: {
    position: "absolute",
    left: 10,
    top: 1,
    bottom: 1,
    width: 7,
    borderRadius: 9,
    backgroundColor: "rgba(10, 6, 4, 0.5)",
  },
  barHighlightV: {
    position: "absolute",
    left: 3,
    top: 4,
    bottom: 4,
    width: 4,
    borderRadius: 2,
    backgroundColor: "rgba(176, 140, 104, 0.62)",
  },
  barMetalH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 14,
    backgroundColor: "#5a4030",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(8,10,12,0.85)",
    zIndex: 2,
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  barMetalHHighlight: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 1,
    height: 4,
    backgroundColor: "rgba(176, 140, 104, 0.42)",
  },
  barMetalHUmbra: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: "rgba(12, 8, 6, 0.52)",
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
  /* ── Balloons ── */
  balloonWrap: {
    position: "absolute",
    bottom: 0,
    alignItems: "center",
    width: 40,
    marginLeft: -20,
    overflow: "visible",
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
    backgroundColor: "rgba(255,255,255,0.32)",
  },
  balloonShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "38%",
    backgroundColor: "rgba(20, 6, 10, 0.28)",
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
  ssHero: {
    position: "absolute",
    width: 260,
    height: 56,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  ssPlume: {
    position: "absolute",
    right: 22,
    width: 210,
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255, 210, 90, 0.55)",
  },
  ssCore: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#fff6c2",
    shadowColor: "#ffd14a",
    shadowOpacity: 0.95,
    shadowRadius: 16,
    elevation: 8,
  },
  ssStar: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  ssStarArmH: {
    position: "absolute",
    width: 24,
    height: 6,
    borderRadius: 2,
    backgroundColor: "#fff6c8",
  },
  ssStarArmV: {
    position: "absolute",
    width: 6,
    height: 24,
    borderRadius: 2,
    backgroundColor: "#fff6c8",
  },
  starEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: "rgba(255,210,80,0.28)",
    borderRadius: 4,
  },
  discoWash: {
    position: "absolute",
    width: "140%",
    height: "140%",
    left: "-20%",
    top: "-20%",
    borderWidth: 72,
    borderColor: "rgba(180, 40, 220, 0.12)",
    backgroundColor: "transparent",
    borderRadius: 999,
  },
  discoBall: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#8a93a8",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#dce6ff",
    shadowOpacity: 0.55,
    shadowRadius: 12,
  },
  discoFacetGrid: {
    position: "absolute",
    width: "170%",
    height: "170%",
    left: "-35%",
    top: "-35%",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  discoFacet: {
    width: "12.5%",
    height: "12.5%",
  },
  discoShade: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: "72%",
    height: "72%",
    borderTopLeftRadius: 48,
    backgroundColor: "rgba(12, 16, 28, 0.32)",
  },
  discoLit: {
    position: "absolute",
    width: 22,
    height: 16,
    left: 8,
    top: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  discoStem: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    width: 2,
    height: 16,
    backgroundColor: "#c8d0e0",
  },
  discoBeam: {
    position: "absolute",
    top: 48,
    left: "50%",
    width: 28,
    height: "85%",
    marginLeft: -13,
    overflow: "visible",
  },
  discoBeamRay: {
    width: "100%",
    height: "100%",
    borderRadius: 3,
    transformOrigin: "50% 0%",
  },
  discoOrb: {
    position: "absolute",
    elevation: 8,
    shadowOpacity: 0.95,
    shadowRadius: 10,
  },
  discoOrbCore: {
    position: "absolute",
    width: "42%",
    height: "42%",
    left: "16%",
    top: "14%",
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.78)",
  },
  crownHalo: {
    position: "absolute",
    top: 0,
    left: "18%",
    right: "18%",
    height: 64,
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 80,
    backgroundColor: "rgba(255, 214, 90, 0.12)",
  },
  crownHero: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    alignItems: "center",
    width: 148,
  },
  crownBack: {
    position: "absolute",
    top: 10,
    left: 4,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
  },
  crownSpikes: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
  },
  crownSpikeCol: {
    alignItems: "center",
  },
  crownSpike: {
    width: 0,
    height: 0,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#ffd54a",
  },
  crownJewel: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,252,232,0.85)",
  },
  crownOrb: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: -3,
    backgroundColor: "#ffd54a",
    borderWidth: 1,
    borderColor: "#8a5a08",
  },
  crownOrbKing: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  crownBand: {
    width: 132,
    height: 14,
    marginTop: -2,
    borderRadius: 4,
    backgroundColor: "#e8b42a",
    borderWidth: 1,
    borderColor: "#8a5a08",
    overflow: "hidden",
  },
  crownBandLit: {
    position: "absolute",
    left: 10,
    top: 2,
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  snowBit: {
    position: "absolute",
    top: 0,
    marginLeft: -6,
    zIndex: 2,
    overflow: "visible",
  },
  snowDot: {
    backgroundColor: "rgba(230,240,255,0.85)",
  },
  snowNeedle: {
    backgroundColor: "rgba(220,236,255,0.88)",
    borderRadius: 2,
  },
  snowPlate: {
    backgroundColor: "rgba(216,238,254,0.82)",
    transform: [{ rotate: "45deg" }],
    borderRadius: 2,
  },
  snowDendrite: {
    position: "relative",
  },
  snowArmH: {
    position: "absolute",
    left: 0,
    height: 1.5,
    backgroundColor: "#e8f2ff",
  },
  snowArmV: {
    position: "absolute",
    top: 0,
    width: 1.5,
    backgroundColor: "#e8f2ff",
  },
  snowEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: "rgba(200,220,255,0.2)",
    borderRadius: 4,
  },
  /* Edge shade only — no circular hole (read as a yellow ring on web). */
  spotCan: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    width: 46,
    height: 12,
    borderRadius: 4,
    backgroundColor: "#3a4254",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    zIndex: 4,
  },
  spotEdgeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "22%",
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  spotEdgeLeft: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "18%",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  spotEdgeRight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: "18%",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  spotBeam: {
    position: "absolute",
    top: "-10%",
    left: "16%",
    width: "68%",
    height: "58%",
    borderBottomLeftRadius: 120,
    borderBottomRightRadius: 120,
    backgroundColor: "rgba(255,250,236,0.16)",
  },
  spotShaft: {
    position: "absolute",
    top: "-6%",
    left: "40%",
    width: "20%",
    height: "52%",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    backgroundColor: "rgba(255,255,248,0.18)",
  },
});
