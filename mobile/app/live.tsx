import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { hubBase } from "../src/config";
import { useHub } from "../src/hub/HubProvider";
import type { MatchPeer, ServerMatched, ServerMsg } from "../src/hub/types";
import { MediaSession, type MediaStreamLike } from "../src/media/MediaSession";
import { loadMatchPrefs } from "../src/prefs/store";
import { GIFTS } from "../src/stars/gifts";

type Phase = "idle" | "search" | "matched" | "error";

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
  userId: string;
  isOfferer: boolean;
  name: string;
  mode: string;
} {
  const peers = (msg.peers || []) as MatchPeer[];
  if (peers.length) {
    const p = peers[0];
    return {
      peerId: String(p.peer_id || "legacy"),
      userId: String(p.user_id || ""),
      isOfferer: p.is_offerer != null ? !!p.is_offerer : !!msg.is_offerer,
      name: String(p.name || p.short_id || msg.partner_short || "?"),
      mode: String(msg.mode || "solo"),
    };
  }
  return {
    peerId: "legacy",
    userId: "",
    isOfferer: !!msg.is_offerer,
    name: String(msg.partner_short || "?"),
    mode: String(msg.mode || "solo"),
  };
}

export default function LiveScreen() {
  const {
    hub,
    friendCode,
    stars,
    addMessageListener,
    connected,
    ratePrompt,
    clearRatePrompt,
  } = useHub();
  const mediaRef = useRef<MediaSession | null>(null);
  const remotePeerId = useRef<string>("");
  const partnerUserId = useRef<string>("");
  const searchingRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [online, setOnline] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [partner, setPartner] = useState("");
  const [matchMode, setMatchMode] = useState("");
  const [conn, setConn] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStreamLike | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStreamLike | null>(
    null
  );
  const [webrtcOk, setWebrtcOk] = useState(false);
  const [chat, setChat] = useState<{ from: string; body: string }[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [alone, setAlone] = useState(false);

  const push = useCallback((line: string) => {
    setLog((prev) => [line, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    setWebrtcOk(MediaSession.webrtcAvailable());
    const media = new MediaSession();
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

    loadMatchPrefs().then((prefs) => {
      media.setHideIp(prefs.hideIp);
    });

    hub
      .fetchIceConfig()
      .then((cfg) => {
        media.setIceConfig(cfg);
        push(`ICE has_turn=${cfg.has_turn}`);
      })
      .catch((e) => push(`config fail ${e}`));

    media.ensureLocalStream().then((s) => {
      if (s) push("local preview ready");
    });

    const unsub = addMessageListener((msg: ServerMsg) => {
      switch (msg.type) {
        case "status": {
          const m = msg as {
            phase?: string;
            online?: number;
            waiting_peers?: number;
            detail?: string;
          };
          const on = Number(m.online || 0);
          const wait = Number(m.waiting_peers || 0);
          setOnline(on);
          setWaiting(wait);
          if (m.phase === "search" || m.phase === "waiting") {
            setPhase("search");
            searchingRef.current = true;
            setAlone(wait <= 1 && on <= 2);
          }
          if (m.detail) push(`status ${m.phase}: ${m.detail}`);
          break;
        }
        case "matched": {
          const m = msg as ServerMatched;
          const peer = pickPeer(m);
          remotePeerId.current = peer.peerId;
          partnerUserId.current = peer.userId;
          setPartner(peer.name);
          setMatchMode(peer.mode);
          setPhase("matched");
          searchingRef.current = false;
          setAlone(false);
          setRemoteStream(null);
          setChat([]);
          push(
            `matched ${peer.name} mode=${peer.mode} offerer=${peer.isOfferer}`
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
        case "chat": {
          const m = msg as { author?: string; body?: string };
          if (m.body) {
            setChat((c) =>
              [...c, { from: m.author || "peer", body: m.body || "" }].slice(
                -30
              )
            );
          }
          break;
        }
        case "call_ended": {
          // If we were in a friend call, return to idle
          if (matchMode === "friend" || searchingRef.current === false) {
            media.closeCall({ keepLocal: true, sendBye: false });
            setRemoteStream(null);
            setPartner("");
            setPhase("idle");
          }
          break;
        }
        case "error":
          push(`error ${(msg as { message?: string }).message}`);
          setPhase("error");
          searchingRef.current = false;
          break;
        default:
          break;
      }
    });

    return () => {
      unsub();
      media.close();
      mediaRef.current = null;
    };
  }, [addMessageListener, hub, push]);

  // Resume stranger search after reconnect
  useEffect(() => {
    if (connected && searchingRef.current && phase === "search") {
      try {
        hub.spin();
        push("→ spin (resume)");
      } catch {
        /* ignore */
      }
    }
  }, [connected, hub, phase, push]);

  function start() {
    try {
      mediaRef.current?.closeCall({ keepLocal: true, sendBye: false });
      setRemoteStream(null);
      setChat([]);
      searchingRef.current = true;
      hub.spin();
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
      setChat([]);
      remotePeerId.current = "";
      partnerUserId.current = "";
      if (matchMode === "friend") {
        try {
          hub.hangupFriend();
        } catch {
          /* ignore */
        }
        searchingRef.current = false;
        setPhase("idle");
        setMatchMode("");
        push("→ hangup friend");
        return;
      }
      searchingRef.current = true;
      hub.next();
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
      setChat([]);
      remotePeerId.current = "";
      partnerUserId.current = "";
      searchingRef.current = false;
      setAlone(false);
      if (matchMode === "friend") {
        try {
          hub.hangupFriend();
        } catch {
          /* ignore */
        }
      } else {
        hub.stop();
      }
      setMatchMode("");
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

  function sendChat() {
    const body = chatDraft.trim();
    if (!body || phase !== "matched") return;
    try {
      hub.chat(body);
      setChat((c) => [...c, { from: "you", body }].slice(-30));
      setChatDraft("");
    } catch (e) {
      push(String(e));
    }
  }

  function shareInvite() {
    const code = friendCode || "……";
    const url = `${hubBase()}/live.html?friend=${encodeURIComponent(code)}&ref=friend_invite`;
    Share.share({
      message: `I'm on ruletka live — add code ${code}, Accept, then Call.\n${url}`,
      title: "ruletka invite",
    }).catch(() => {});
  }

  function reportOrBlock() {
    const uid = partnerUserId.current;
    if (!uid) {
      Alert.alert("Not ready", "Partner id not known yet — try Next.");
      return;
    }
    Alert.alert("Safety", `Partner ${partner || uid.slice(0, 8)}…`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block + Next",
        style: "destructive",
        onPress: () => {
          try {
            hub.blockUser(uid);
            push("→ block");
            next();
          } catch (e) {
            push(String(e));
          }
        },
      },
      {
        text: "Report + Block",
        style: "destructive",
        onPress: () => {
          Alert.alert("Report reason", undefined, [
            {
              text: "Harassment",
              onPress: () => doReport(uid, "harassment"),
            },
            { text: "Spam", onPress: () => doReport(uid, "spam") },
            {
              text: "Underage suspicion",
              onPress: () => doReport(uid, "underage"),
            },
            { text: "Other", onPress: () => doReport(uid, "other") },
            { text: "Cancel", style: "cancel" },
          ]);
        },
      },
    ]);
  }

  function doReport(uid: string, reason: string) {
    try {
      hub.reportUser(uid, reason);
      hub.blockUser(uid);
      push(`→ report ${reason} + block`);
      next();
    } catch (e) {
      push(String(e));
    }
  }

  function spend(effect: string, cost: number) {
    const uid = partnerUserId.current;
    if (!uid || phase !== "matched") return;
    if (stars < cost) {
      Alert.alert("Need more ★", `This gift costs ${cost}★ (you have ${stars}).`);
      return;
    }
    try {
      hub.spendStars(uid, effect);
      push(`→ spend ${effect} (−${cost}★)`);
    } catch (e) {
      push(String(e));
    }
  }

  function submitRate(star: boolean, amount = 1) {
    if (!ratePrompt) return;
    try {
      hub.ratePartner(ratePrompt.user_id, star, amount);
      clearRatePrompt();
    } catch (e) {
      push(String(e));
    }
  }

  const showAloneBanner = phase === "search" && alone;
  const isFriendCall = matchMode === "friend";

  return (
    <View style={styles.root}>
      {ratePrompt ? (
        <View style={styles.rateCard}>
          <Text style={styles.rateTitle}>
            Rate {ratePrompt.name}?
            {ratePrompt.early ? " (early)" : ""}
          </Text>
          <Text style={styles.rateBody}>
            Chat {Math.floor(ratePrompt.duration_secs / 60)}+ min. Gift up to ★
            {ratePrompt.max_gift} or skip.
          </Text>
          <View style={styles.row}>
            {Array.from({ length: ratePrompt.max_gift }, (_, i) => i + 1).map(
              (n) => (
                <Pressable
                  key={n}
                  style={styles.rateGift}
                  onPress={() => submitRate(true, n)}
                >
                  <Text style={styles.btnText}>★{n}</Text>
                </Pressable>
              )
            )}
            <Pressable
              style={styles.btnGhost}
              onPress={() => submitRate(false)}
            >
              <Text style={styles.btnText}>Skip</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.stage}>
        <VideoView
          stream={remoteStream || localStream}
          mirror={!remoteStream}
          style={styles.remoteFill}
          zOrder={0}
        />
        {remoteStream && localStream ? (
          <View style={styles.pip}>
            <VideoView
              stream={localStream}
              mirror
              style={styles.pipVideo}
              zOrder={1}
            />
          </View>
        ) : null}
        <View style={styles.overlay}>
          <Text style={styles.stageLabel}>
            {phase === "matched"
              ? `${isFriendCall ? "Friend" : "Matched"} · ${partner}${conn ? ` · ${conn}` : ""}`
              : phase === "search"
                ? alone
                  ? "You're first in line…"
                  : "Looking…"
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

        {showAloneBanner ? (
          <View style={styles.aloneCard}>
            <Text style={styles.aloneTitle}>Quiet pool</Text>
            <Text style={styles.aloneBody}>
              Few people online. Share your friend code — they open live, you
              Accept, then Call when Online.
            </Text>
            {friendCode ? (
              <Text style={styles.aloneCode}>Code {friendCode}</Text>
            ) : null}
            <Pressable style={styles.aloneBtn} onPress={shareInvite}>
              <Text style={styles.btnText}>Share invite</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === "matched" && chat.length > 0 ? (
          <View style={styles.chatOverlay}>
            {chat.slice(-4).map((c, i) => (
              <Text key={i} style={styles.chatLine}>
                <Text style={styles.chatFrom}>{c.from}: </Text>
                {c.body}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {phase === "matched" ? (
        <>
          <View style={styles.giftsRow}>
            {GIFTS.map((g) => (
              <Pressable
                key={g.id}
                style={[
                  styles.giftChip,
                  stars < g.cost && styles.giftChipDisabled,
                ]}
                onPress={() => spend(g.id, g.cost)}
              >
                <Text style={styles.giftEmoji}>{g.emoji}</Text>
                <Text style={styles.giftCost}>{g.cost}★</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.chatRow}>
            <TextInput
              style={styles.chatInput}
              value={chatDraft}
              onChangeText={setChatDraft}
              placeholder="Message…"
              placeholderTextColor="#6b7a90"
              onSubmitEditing={sendChat}
              returnKeyType="send"
            />
            <Pressable style={styles.chatSend} onPress={sendChat}>
              <Text style={styles.btnText}>Send</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <View style={styles.bar}>
        <Text style={styles.meta}>
          ★ {stars} · online {online} · wait {waiting}
          {friendCode ? ` · code ${friendCode}` : ""}
          {!connected ? " · reconnecting" : ""}
        </Text>
        <View style={styles.row}>
          {phase === "idle" || phase === "error" ? (
            <Pressable style={styles.btn} onPress={start}>
              <Text style={styles.btnText}>Start</Text>
            </Pressable>
          ) : null}
          {phase === "search" || phase === "matched" ? (
            <>
              {!isFriendCall ? (
                <Pressable style={styles.btnSecondary} onPress={next}>
                  <Text style={styles.btnText}>Next</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.btnGhost} onPress={stop}>
                <Text style={styles.btnText}>
                  {isFriendCall ? "Hang up" : "Stop"}
                </Text>
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
          {phase === "matched" ? (
            <Pressable style={styles.btnDanger} onPress={reportOrBlock}>
              <Text style={styles.btnText}>Report</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.btnGhost} onPress={shareInvite}>
              <Text style={styles.btnText}>Invite</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => setShowLog((v) => !v)}>
          <Text style={styles.logToggle}>
            {showLog ? "Hide debug log" : "Show debug log"}
          </Text>
        </Pressable>
      </View>

      {showLog ? (
        <View style={styles.log}>
          {log.map((line, i) => (
            <Text key={`${i}-${line.slice(0, 16)}`} style={styles.logLine}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
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
  overlay: { position: "absolute", left: 12, top: 12, right: 12 },
  stageLabel: {
    color: "#e8eef7",
    fontSize: 15,
    fontWeight: "700",
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  stageHint: { color: "#9aa8bc", fontSize: 11, marginTop: 6, lineHeight: 16 },
  aloneCard: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(16,20,30,0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,200,80,0.35)",
    gap: 6,
  },
  aloneTitle: { color: "#ffe9a0", fontWeight: "800", fontSize: 15 },
  aloneBody: { color: "#c8d4e4", fontSize: 13, lineHeight: 18 },
  aloneCode: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 1,
  },
  aloneBtn: {
    marginTop: 4,
    backgroundColor: "#ff2d55",
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  chatOverlay: {
    position: "absolute",
    left: 12,
    right: 120,
    bottom: 12,
    gap: 2,
  },
  chatLine: {
    color: "#e8eef7",
    fontSize: 12,
    textShadowColor: "#000",
    textShadowRadius: 3,
  },
  chatFrom: { fontWeight: "700", color: "#9ec5ff" },
  giftsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  giftChip: {
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    minWidth: 44,
  },
  giftChipDisabled: { opacity: 0.4 },
  giftEmoji: { fontSize: 16 },
  giftCost: { color: "#9aa8bc", fontSize: 10, fontWeight: "700" },
  rateCard: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(40,32,12,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,200,80,0.4)",
    gap: 8,
    zIndex: 50,
  },
  rateTitle: { color: "#ffe9a0", fontWeight: "800", fontSize: 16 },
  rateBody: { color: "#c8d4e4", fontSize: 13, lineHeight: 18 },
  rateGift: {
    flex: 1,
    backgroundColor: "rgba(255,200,80,0.25)",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  chatRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  chatInput: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  chatSend: {
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(61,126,255,0.85)",
  },
  bar: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  meta: { color: "#9aa8bc", fontSize: 12 },
  row: { flexDirection: "row", gap: 8 },
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
  btnDanger: {
    flex: 1,
    backgroundColor: "rgba(255,80,90,0.35)",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  logToggle: {
    color: "#6b7a90",
    fontSize: 11,
    textAlign: "center",
    paddingVertical: 4,
  },
  log: { maxHeight: 100, paddingHorizontal: 16, paddingBottom: 12 },
  logLine: { color: "#6b7a90", fontSize: 10, fontFamily: "monospace" },
});
