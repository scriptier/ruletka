/**
 * Draggable PiP: snap to corners, remember position, double-tap swap.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import {
  loadPipPrefs,
  savePipPrefs,
  snapPipToCorner,
} from "../media/pipPrefs";

export const PIP_W = 108;
export const PIP_H = 148;

export function DraggablePip(props: {
  children: ReactNode;
  onDoubleTap: () => void;
  stageW: number;
  stageH: number;
  showHint: boolean;
  hintText: string;
  onHintSeen: () => void;
}) {
  const {
    children,
    onDoubleTap,
    stageW,
    stageH,
    showHint,
    hintText,
    onHintSeen,
  } = props;
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const posRef = useRef(pos);
  posRef.current = pos;
  const stageRefPip = useRef({ w: stageW, h: stageH });
  stageRefPip.current = { w: stageW, h: stageH };
  const onDoubleTapRef = useRef(onDoubleTap);
  onDoubleTapRef.current = onDoubleTap;
  const onHintSeenRef = useRef(onHintSeen);
  onHintSeenRef.current = onHintSeen;
  const startRef = useRef({ px: 0, py: 0 });
  const lastTap = useRef(0);
  const moved = useRef(false);

  useEffect(() => {
    loadPipPrefs().then((p) => {
      if (p && p.x >= 0 && p.y >= 0) setPos({ x: p.x, y: p.y });
    });
  }, []);

  const maxX = Math.max(8, stageW - PIP_W - 8);
  const maxY = Math.max(8, stageH - PIP_H - 8);
  const x = pos.x < 0 ? maxX : Math.min(maxX, Math.max(8, pos.x));
  const y = pos.y < 0 ? maxY : Math.min(maxY, Math.max(8, pos.y));

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        moved.current = false;
        const { w, h } = stageRefPip.current;
        const mx = Math.max(8, w - PIP_W - 8);
        const my = Math.max(8, h - PIP_H - 8);
        const cur = posRef.current;
        startRef.current = {
          px: cur.x < 0 ? mx : cur.x,
          py: cur.y < 0 ? my : cur.y,
        };
        const now = Date.now();
        if (now - lastTap.current < 280) {
          onDoubleTapRef.current();
          lastTap.current = 0;
        } else {
          lastTap.current = now;
        }
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) moved.current = true;
        const { w, h } = stageRefPip.current;
        const mx = Math.max(8, w - PIP_W - 8);
        const my = Math.max(8, h - PIP_H - 8);
        const nx = Math.min(mx, Math.max(8, startRef.current.px + g.dx));
        const ny = Math.min(my, Math.max(8, startRef.current.py + g.dy));
        setPos({ x: nx, y: ny });
      },
      onPanResponderRelease: () => {
        if (!moved.current) return;
        const { w, h } = stageRefPip.current;
        const cur = posRef.current;
        const snapped = snapPipToCorner(
          cur.x < 0 ? w - PIP_W - 8 : cur.x,
          cur.y < 0 ? h - PIP_H - 8 : cur.y,
          w,
          h,
          PIP_W,
          PIP_H
        );
        setPos(snapped);
        void savePipPrefs({ ...snapped, hintSeen: true });
        onHintSeenRef.current();
      },
    })
  ).current;

  return (
    <View
      style={[
        styles.pip,
        { left: x, top: y, right: undefined, bottom: undefined },
      ]}
      {...pan.panHandlers}
      collapsable={false}
    >
      {children}
      {showHint ? (
        <View style={styles.pipHint} pointerEvents="none">
          <Text style={styles.pipHintText}>{hintText}</Text>
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
