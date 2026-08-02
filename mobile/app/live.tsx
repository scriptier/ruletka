import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { HubClient } from "../src/hub/HubClient";
import type { MatchPeer, ServerMatched, ServerMsg } from "../src/hub/types";
import { MediaSession, type MediaStreamLike } from "../src/media/MediaSession";
import { useApp } from "./_layout";

type Phase = "idle" | "connecting" | "search" | "matched" | "error";

/** Lazy RTCView — only present after native WebRTC link. */
function VideoView(props: {
  stream: MediaStreamLike | null;
  mirror?: boolean;
  style?: StyleProp<ViewStyle>;
  zOrder?: number;
}) {
  const { stream, mirror, style, zOrder } = props;
  if (!stream) {
    return <View style={[styles.videoPlaceholder, style]} />;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RTCView } = require("react-native-webrtc");
    return (
      <RTCView
        streamURL={stream.toURL()}
        objectFit="cover"
        mirror={!!mirror}
        zOrder={zOrder ?? 0}
        style={style}
      />
    );
  } catch {
    return (
      <View style={[styles.videoPlaceholder, style]}>
        <Text style={styles.stageHint}>RTCView unavailable</Text>
      </View>
    );
  }
}

function pickPeer(msg: ServerMatched): {
  peerId: string;
  isOfferer: boolean;
  name: string;
} {
  const peers = (msg.peers || []) as MatchPeer[];
  if (peers.length) {
    const p = peers[0];
    return {
      peerId: String(p.peer_id || "legacy"),
      isOfferer: p.is_offerer != null ? !!p.is_offerer : !!msg.is_offerer,
      name: String(p.name || p.short_id || msg.partner_short || "?"),
    };
  }
  return {
    peerId: "legacy",
    isOfferer: !!msg.is_offerer,
    name: String(msg.partner_short || "?"),
  };
}

export default function LiveScreen() {
  const { identity } = useApp();
  const hubRef = useRef<HubClient | null>(null);
  const mediaRef = useRef<MediaSession | null>(null);
  const remotePeerId = useRef<string>("");

  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [friendCode, setFriendCode] = useState("");
  const [online, setOnline] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [partner, setPartner] = useState("");
  const [stars, setStars] = useState(0);
  const [conn, setConn] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStreamLike | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStreamLike | null>(
    null
  );
  const [webrtcOk, setWebrtcOk] = useState(false);

  const push = useCallback((line: string) => {
    setLog((prev) => [line, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    setWebrtcOk(MediaSession.webrtcAvailable());
    const hub = new HubClient();
    const media = new MediaSession();
    hubRef.current = hub;
    mediaRef.current = media;

    media.setHandlers({
      onLocalStream: (s) => setLocalStream(s),
      onRemoteStream: (s) => {
        setRemoteStream(s);
        push("remote stream");
      },
      onSignal: (kind, payload) => {
        try {
          const to = remotePeerId.current;
          hub.signal(kind, payload, to && to !== "legacy" ? to : "");
        } catch (e) {
          push(`signal send fail ${e}`);
        }
      },
      onConnectionState: (s) => {
        setConn(s);
        push(`pc ${s}`);
      },
      onIceConnectionState: (s) => push(`ice ${s}`),
      onError: (e) => push(`media ${e.message}`),
    });

    hub.setHandlers({
      onOpen: () => {
        push("ws open");
        setPhase("connecting");
        hub.hello({
          user_id: identity.user_id,
          name: identity.name,
        });
      },
      onClose: ({ code, reason }) => {
        push(`ws close ${code} ${reason}`);
        setPhase("idle");
      },
      onError: (e) => push(`ws err ${String(e)}`),
      onMessage: (msg: ServerMsg) => {
        switch (msg.type) {
          case "hello_ok": {
            const m = msg as {
              friend_code?: string;
              stars?: number;
              short_id?: string;
            };
            setFriendCode(m.friend_code || "");
            setStars(Number(m.stars || 0));
            push(`hello_ok · ${m.short_id || ""} · ★${m.stars ?? 0}`);
            setPhase("idle");
            // Preview camera early when native WebRTC is available
            media.ensureLocalStream().then((s) => {
              if (s) push("local preview ready");
            });
            break;
          }
          case "status": {
            const m = msg as {
              phase?: string;
              online?: number;
              waiting_peers?: number;
              detail?: string;
            };
            setOnline(Number(m.online || 0));
            setWaiting(Number(m.waiting_peers || 0));
            if (m.phase === "search" || m.phase === "waiting") {
              setPhase("search");
            }
            if (m.detail) push(`status ${m.phase}: ${m.detail}`);
            break;
          }
          case "matched": {
            const m = msg as ServerMatched;
            const peer = pickPeer(m);
            remotePeerId.current = peer.peerId;
            setPartner(peer.name);
            setPhase("matched");
            setRemoteStream(null);
            push(
              `matched ${peer.name} offerer=${peer.isOfferer} peer=${peer.peerId.slice(0, 8)}`
            );
            media
              .startCall({ isOfferer: peer.isOfferer })
              .then(() => push("startCall ok"))
              .catch((e) => push(`startCall ${e}`));
            break;
          }
          case "signal": {
            const m = msg as {
              kind?: string;
              payload?: string;
              from_peer?: string;
            };
            if (m.from_peer) remotePeerId.current = m.from_peer;
            push(`signal ← ${m.kind}`);
            if (m.kind && m.payload != null) {
              media
                .handleRemoteSignal(m.kind, m.payload)
                .catch((e) => push(`handle ${e}`));
            }
            break;
          }
          case "error":
            push(`error ${(msg as { message?: string }).message}`);
            setPhase("error");
            break;
          default:
            if (msg.type && msg.type !== "pong") push(`← ${msg.type}`);
        }
      },
    });

    hub
      .fetchIceConfig()
      .then((cfg) => {
        media.setIceConfig(cfg);
        push(`ICE has_turn=${cfg.has_turn}`);
      })
      .catch((e) => push(`config fail ${e}`));

    hub.connect();
    return () => {
      media.close();
      hub.disconnect();
      hubRef.current = null;
      mediaRef.current = null;
    };
  }, [identity.name, identity.user_id, push]);

  function start() {
    try {
      mediaRef.current?.closeCall({ keepLocal: true, sendBye: false });
      setRemoteStream(null);
      hubRef.current?.spin();
      setPhase("search");
      push("→ spin");
    } catch (e) {
      push(String(e));
    }
  }

  function next() {
    try {
      mediaRef.current?.closeCall({ keepLocal: true, sendBye: true });
      setRemoteStream(null);
      setPartner("");
      remotePeerId.current = "";
      hubRef.current?.next();
      setPhase("search");
      push("→ next");
    } catch (e) {
      push(String(e));
    }
  }

  function stop() {
    try {
      mediaRef.current?.closeCall({ keepLocal: true, sendBye: true });
      setRemoteStream(null);
      setPartner("");
      remotePeerId.current = "";
      hubRef.current?.stop();
      setPhase("idle");
      push("→ stop");
    } catch (e) {
      push(String(e));
    }
  }

  function toggleMic() {
    const nextOn = !micOn;
    setMicOn(nextOn);
    mediaRef.current?.setMicEnabled(nextOn);
  }

  function toggleCam() {
    const nextOn = !camOn;
    setCamOn(nextOn);
    mediaRef.current?.setCamEnabled(nextOn);
  }

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <VideoView
          stream={remoteStream || localStream}
          mirror={!remoteStream}
          style={styles.remoteFill}
          zOrder={0}
        />
        {remoteStream && localStream ? (
          <View style={styles.pip}>
            <VideoView stream={localStream} mirror style={styles.pipVideo} zOrder={1} />
          </View>
        ) : null}
        <View style={styles.overlay}>
          <Text style={styles.stageLabel}>
            {phase === "matched"
              ? `Matched · ${partner}${conn ? ` · ${conn}` : ""}`
              : phase === "search"
                ? "Looking…"
                : localStream
                  ? "Preview"
                  : "Idle"}
          </Text>
          {!webrtcOk ? (
            <Text style={styles.stageHint}>
              WebRTC needs a native build:{"\n"}
              npx expo prebuild && npx expo run:android
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.bar}>
        <Text style={styles.meta}>
          ★ {stars} · online {online} · wait {waiting}
          {friendCode ? ` · code ${friendCode}` : ""}
        </Text>
        <View style={styles.row}>
          {phase === "idle" || phase === "error" || phase === "connecting" ? (
            <Pressable style={styles.btn} onPress={start}>
              <Text style={styles.btnText}>Start</Text>
            </Pressable>
          ) : null}
          {phase === "search" || phase === "matched" ? (
            <>
              <Pressable style={styles.btnSecondary} onPress={next}>
                <Text style={styles.btnText}>Next</Text>
              </Pressable>
              <Pressable style={styles.btnGhost} onPress={stop}>
                <Text style={styles.btnText}>Stop</Text>
              </Pressable>
            </>
          ) : null}
        </View>
        <View style={styles.row}>
          <Pressable style={styles.btnGhost} onPress={toggleMic}>
            <Text style={styles.btnText}>{micOn ? "Mic on" : "Mic off"}</Text>
          </Pressable>
          <Pressable style={styles.btnGhost} onPress={toggleCam}>
            <Text style={styles.btnText}>{camOn ? "Cam on" : "Cam off"}</Text>
          </Pressable>
          <Pressable
            style={styles.btnGhost}
            onPress={() => mediaRef.current?.flipCamera()}
          >
            <Text style={styles.btnText}>Flip</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.log}>
        {log.map((line, i) => (
          <Text key={`${i}-${line.slice(0, 16)}`} style={styles.logLine}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#07080c" },
  stage: {
    flex: 1,
    margin: 12,
    borderRadius: 16,
    backgroundColor: "#12151c",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  remoteFill: { ...StyleSheet.absoluteFillObject },
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#12151c",
    alignItems: "center",
    justifyContent: "center",
  },
  pip: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  pipVideo: { width: "100%", height: "100%" },
  overlay: {
    position: "absolute",
    left: 12,
    top: 12,
    right: 12,
  },
  stageLabel: {
    color: "#e8eef7",
    fontSize: 15,
    fontWeight: "700",
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  stageHint: {
    color: "#9aa8bc",
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
  },
  bar: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  meta: { color: "#9aa8bc", fontSize: 12 },
  row: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    backgroundColor: "#ff2d55",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: "#3d7eff",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  btnGhost: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  log: {
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  logLine: { color: "#6b7a90", fontSize: 10, fontFamily: "monospace" },
});
