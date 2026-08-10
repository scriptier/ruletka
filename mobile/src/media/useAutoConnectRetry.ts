/**
 * Auto soft/hard ICE recovery when partner video never paints.
 * IMPORTANT: hasRemoteVideo (track present) is NOT enough — black stage with
 * Report chip meant tracks existed and this hook used to no-op forever.
 * Pass remoteFramesOk=false until inbound frames are decoded.
 */
import { useEffect, useRef, useState } from "react";
import { nextAutoRetryAction } from "./connectUi";

export function useAutoConnectRetry(opts: {
  phase: string;
  matchStartedAt: number;
  nowTick: number;
  /** True only when partner picture is actually painting (or frames decoded). */
  remoteFramesOk: boolean;
  onSoft: () => void;
  onHard: () => void;
  onTip: () => void;
  log?: (line: string) => void;
}): number {
  const {
    phase,
    matchStartedAt,
    nowTick,
    remoteFramesOk,
    onSoft,
    onHard,
    onTip,
    log,
  } = opts;
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const onSoftRef = useRef(onSoft);
  const onHardRef = useRef(onHard);
  const onTipRef = useRef(onTip);
  const logRef = useRef(log);
  onSoftRef.current = onSoft;
  onHardRef.current = onHard;
  onTipRef.current = onTip;
  logRef.current = log;

  // Reset schedule on new match
  useEffect(() => {
    if (phase !== "matched") {
      countRef.current = 0;
      setCount(0);
    } else if (matchStartedAt) {
      // New match timestamp — reset
      countRef.current = 0;
      setCount(0);
    }
  }, [phase, matchStartedAt]);

  useEffect(() => {
    if (phase !== "matched") return;
    if (remoteFramesOk) return;
    if (!matchStartedAt) return;
    const elapsed = nowTick - matchStartedAt;
    const action = nextAutoRetryAction(countRef.current, elapsed);
    if (!action) return;
    if (action === "soft") {
      countRef.current = 1;
      setCount(1);
      logRef.current?.("auto ICE soft (black partner ~10s)");
      onSoftRef.current();
    } else if (action === "hard") {
      countRef.current = 2;
      setCount(2);
      logRef.current?.("auto ICE hard rebuild (black partner ~16s)");
      onHardRef.current();
    } else if (action === "tip") {
      countRef.current = 3;
      setCount(3);
      onTipRef.current();
    }
  }, [phase, nowTick, matchStartedAt, remoteFramesOk]);

  return count;
}
