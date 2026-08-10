/**
 * Privacy / battery: pause outbound cam + mic while app is backgrounded mid-call.
 * Resumes on return when user still has cam/mic toggled on.
 */
import { useEffect, type MutableRefObject, type RefObject } from "react";
import { AppState } from "react-native";
import type { MediaSession } from "../media/MediaSession";
import type { LivePhase } from "./phase";

export type BackgroundMediaPauseOpts = {
  phaseRef: MutableRefObject<LivePhase>;
  camOnRef: MutableRefObject<boolean>;
  micOnRef: MutableRefObject<boolean>;
  debateMicLockedRef: MutableRefObject<boolean>;
  bgPausedCamRef: MutableRefObject<boolean>;
  bgPausedMicRef: MutableRefObject<boolean>;
  mediaRef: RefObject<MediaSession | null>;
  media2Ref: RefObject<MediaSession | null>;
  showToast: (msg: string) => void;
  resumedMessage: () => string;
  /** Optional: remount partner RTCView / epoch after return from background. */
  onResumeRepaint?: () => void;
};

export function useBackgroundMediaPause(opts: BackgroundMediaPauseOpts): void {
  const {
    phaseRef,
    camOnRef,
    micOnRef,
    debateMicLockedRef,
    bgPausedCamRef,
    bgPausedMicRef,
    mediaRef,
    media2Ref,
    showToast,
    resumedMessage,
    onResumeRepaint,
  } = opts;

  // Intentionally empty deps — all live values are refs / stable callbacks.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const matched = phaseRef.current === "matched";
      if (state === "background" || state === "inactive") {
        if (!matched) return;
        if (camOnRef.current) {
          mediaRef.current?.setCamEnabled(false);
          media2Ref.current?.setCamEnabled(false);
          bgPausedCamRef.current = true;
        }
        if (micOnRef.current && !debateMicLockedRef.current) {
          mediaRef.current?.setMicEnabled(false);
          media2Ref.current?.setMicEnabled(false);
          bgPausedMicRef.current = true;
        }
      } else if (state === "active") {
        const stillMatched = phaseRef.current === "matched";
        let resumed = false;
        if (bgPausedCamRef.current) {
          bgPausedCamRef.current = false;
          if (stillMatched && camOnRef.current) {
            mediaRef.current?.setCamEnabled(true);
            media2Ref.current?.setCamEnabled(true);
            resumed = true;
          }
        }
        if (bgPausedMicRef.current) {
          bgPausedMicRef.current = false;
          if (
            stillMatched &&
            micOnRef.current &&
            !debateMicLockedRef.current
          ) {
            mediaRef.current?.setMicEnabled(true);
            media2Ref.current?.setMicEnabled(true);
            resumed = true;
          }
        }
        // Android: after background, ICE can stall — soft restartIce only.
        // Never promote to offerer (dual-offer thrash vs web preferred offerer).
        if (stillMatched) {
          const framesOk =
            !!mediaRef.current?.hasInboundVideoFrames?.() ||
            (mediaRef.current?.getRemoteStream()?.getVideoTracks?.()?.length ??
              0) > 0;
          if (!framesOk) {
            void mediaRef.current?.tryIceRestart({
              force: true,
              promoteOfferer: false,
            });
            void media2Ref.current?.tryIceRestart({
              force: true,
              promoteOfferer: false,
            });
          }
          // Re-bind partner surface after background (SurfaceView often goes black).
          try {
            mediaRef.current?.forceRepaintRemote?.("app_resume");
            media2Ref.current?.forceRepaintRemote?.("app_resume");
          } catch {
            /* ignore */
          }
          try {
            onResumeRepaint?.();
          } catch {
            /* ignore */
          }
        }
        if (resumed) {
          showToast(resumedMessage());
        }
      }
    });
    return () => {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; refs hold latest
  }, []);
}
