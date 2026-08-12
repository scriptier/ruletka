/**
 * PC `#remote-empty` parity: full-stage brand animation loop while idle/search
 * (no partner yet). Bundled asset only — no network stream.
 */
import { Video, ResizeMode, type AVPlaybackStatus } from "expo-av";
import { memo, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

// Bundled high-quality loop (720×1096 H.264, muted).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BRAND_LOADING_SOURCE = require("../../assets/brand/loading-screen.mp4");

export type BrandLoadingLoopProps = {
  /**
   * When false, pause and drop the source so the decoder is freed.
   * Default true.
   */
  active?: boolean;
};

export const BrandLoadingLoop = memo(function BrandLoadingLoop(
  props: BrandLoadingLoopProps
) {
  const active = props.active !== false;
  const videoRef = useRef<Video | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    return () => {
      const v = videoRef.current;
      if (!v) return;
      void v.unloadAsync().catch(() => {
        /* silent */
      });
    };
  }, []);

  useEffect(() => {
    if (failed) return;
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      void v.playAsync().catch(() => {
        /* silent — onError handles permanent fail */
      });
    } else {
      void v.pauseAsync().catch(() => {
        /* silent */
      });
    }
  }, [active, failed]);

  const onError = () => {
    setFailed(true);
  };

  const onStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded && "error" in status && status.error) {
      setFailed(true);
    }
  };

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      collapsable={false}
      testID="live-brand-loading-loop"
    >
      {active && !failed ? (
        <Video
          ref={videoRef}
          source={BRAND_LOADING_SOURCE}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={active}
          isMuted
          volume={0}
          useNativeControls={false}
          onError={onError}
          onPlaybackStatusUpdate={onStatus}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#050608",
    zIndex: 0,
    width: "100%",
    height: "100%",
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
});
