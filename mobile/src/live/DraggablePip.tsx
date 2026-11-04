/**
 * Draggable self-view PiP.
 * - Drag (past PIP_DRAG_SLOP) moves it; release snaps to the nearest corner
 *   inside the stage minus top chrome (safeTop) and bottom dock (safeBottom).
 *   Corner is remembered (AsyncStorage).
 * - Tap → onTap (classic split view). Double-tap → onDoubleTap (swap /
 *   unblur) when provided; single tap then waits PIP_DOUBLE_TAP_MS.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import { loadPipPrefs, savePipPrefs } from "../media/pipPrefs";
import {
  PIP_DOUBLE_TAP_MS,
  clampPip,
  cornerFromLegacyXY,
  cornerToPos,
  isDragMove,
  nearestCorner,
  pipBounds,
  type PipCorner,
} from "./pipLayout";

export const PIP_W = 108;
export const PIP_H = 148;

export function DraggablePip(props: {
  children: ReactNode;
  /** Single tap (after the double-tap window when onDoubleTap is set). */
  onTap?: () => void;
  /** Optional double-tap; return false to fall back to onTap. */
  onDoubleTap?: () => boolean | void;
  stageW: number;
  stageH: number;
  /** Height of chrome over the stage top (status / steps / identity). */
  safeTop?: number;
  /** Height of the control dock over the stage bottom. */
  safeBottom?: number;
  showHint: boolean;
  hintText: string;
  onHintSeen: () => void;
  accessibilityLabel?: string;
}) {
  const {
    children,
    stageW,
    stageH,
    safeTop = 0,
    safeBottom = 0,
    showHint,
    hintText,
    onHintSeen,
    accessibilityLabel,
  } = props;
  const [corner, setCorner] = useState<PipCorner>("br");
  /** Live finger position while dragging (null = parked at corner). */
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  const bounds = pipBounds(stageW, stageH, PIP_W, PIP_H, safeTop, safeBottom);
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const cornerRef = useRef(corner);
  cornerRef.current = corner;
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const onTapRef = useRef(props.onTap);
  onTapRef.current = props.onTap;
  const onDoubleTapRef = useRef(props.onDoubleTap);
  onDoubleTapRef.current = props.onDoubleTap;
  const onHintSeenRef = useRef(onHintSeen);
  onHintSeenRef.current = onHintSeen;
  const startRef = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef({ w: stageW, h: stageH });
  stageRef.current = { w: stageW, h: stageH };

  useEffect(() => {
    let alive = true;
    loadPipPrefs().then((p) => {
      if (!alive || !p) return;
      if (p.corner) {
        setCorner(p.corner);
        return;
      }
      const { w, h } = stageRef.current;
      const legacy = cornerFromLegacyXY(p.x, p.y, w, h, PIP_W, PIP_H);
      if (legacy) setCorner(legacy);
    });
    return () => {
      alive = false;
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  const parked = cornerToPos(corner, bounds);
  const pos = drag ? clampPip(drag.x, drag.y, bounds) : parked;

  const fireTap = () => {
    const dbl = onDoubleTapRef.current;
    if (!dbl) {
      onTapRef.current?.();
      return;
    }
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      if (dbl() === false) onTapRef.current?.();
      return;
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      onTapRef.current?.();
    }, PIP_DOUBLE_TAP_MS);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Swipe-to-next / stage gestures must not steal a PiP drag.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        moved.current = false;
        startRef.current = cornerToPos(cornerRef.current, boundsRef.current);
      },
      onPanResponderMove: (_, g) => {
        if (!moved.current && !isDragMove(g.dx, g.dy)) return;
        moved.current = true;
        setDrag({
          x: startRef.current.x + g.dx,
          y: startRef.current.y + g.dy,
        });
      },
      onPanResponderRelease: (_, g) => {
        if (!moved.current && !isDragMove(g.dx, g.dy)) {
          setDrag(null);
          fireTap();
          return;
        }
        const b = boundsRef.current;
        const cur = clampPip(
          startRef.current.x + g.dx,
          startRef.current.y + g.dy,
          b
        );
        const next = nearestCorner(cur.x, cur.y, PIP_W, PIP_H, b);
        setCorner(next);
        setDrag(null);
        void savePipPrefs({ corner: next, hintSeen: true });
        onHintSeenRef.current();
      },
      onPanResponderTerminate: () => {
        setDrag(null);
      },
    })
  ).current;

  return (
    <View
      style={[
        styles.pip,
        { left: pos.x, top: pos.y, right: undefined, bottom: undefined },
        drag ? styles.pipDragging : null,
      ]}
      {...pan.panHandlers}
      collapsable={false}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onAccessibilityTap={() => onTapRef.current?.()}
      testID="live-self-pip"
    >
      {children}
      {showHint ? (
        <View style={styles.pipHint} pointerEvents="none">
          <Text style={styles.pipHintText} numberOfLines={1}>
            {hintText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pip: {
    position: "absolute",
    width: PIP_W,
    height: PIP_H,
    borderRadius: 12,
    // Do not use overflow:hidden — clips Android SurfaceView → black PiP
    overflow: "visible",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "#12151c",
    zIndex: 8,
    elevation: 6,
  },
  pipDragging: {
    borderColor: "rgba(255,255,255,0.7)",
    opacity: 0.92,
  },
  pipHint: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingVertical: 2,
  },
  pipHintText: {
    color: "#c8d4e4",
    fontSize: 9,
    textAlign: "center",
    fontWeight: "600",
  },
});
