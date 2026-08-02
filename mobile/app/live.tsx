import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HubClient } from "../src/hub/HubClient";
import type { ServerMsg } from "../src/hub/types";
import { MediaSession } from "../src/media/MediaSession";
import { useApp } from "./_layout";

type Phase = "idle" | "connecting" | "search" | "matched" | "error";

export default function LiveScreen() {
  const { identity } = useApp();
  const hubRef = useRef<HubClient | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [friendCode, setFriendCode] = useState("");
  const [online, setOnline] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [partner, setPartner] = useState("");
  const [stars, setStars] = useState(0);

  const push = useCallback((line: string) => {
    setLog((prev) => [line, ...prev].slice(0, 40));
  }, []);

  useEffect(() => {
    const hub = new HubClient();
    hubRef.current = hub;
    const media = new MediaSession();

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
            if (m.phase === "search" || m.phase === "waiting") setPhase("search");
            if (m.detail) push(`status ${m.phase}: ${m.detail}`);
            break;
          }
          case "matched": {
            const m = msg as {
              partner_short?: string;
              is_offerer?: boolean;
              session_id?: string;
            };
            setPartner(m.partner_short || "?");
            setPhase("matched");
            push(
              `matched ${m.partner_short} offerer=${m.is_offerer} sess=${String(m.session_id || "").slice(0, 8)}`
            );
            // Phase 0: signal path only — attach MediaSession when native WebRTC linked
            if (!MediaSession.webrtcAvailable()) {
              push("WebRTC not linked — match signal only (no A/V yet)");
            }
            break;
          }
          case "signal":
            push(`signal ${(msg as { kind?: string }).kind}`);
            break;
          case "error":
            push(`error ${(msg as { message?: string }).message}`);
            setPhase("error");
            break;
          default:
            push(`← ${msg.type}`);
        }
      },
    });

    hub.fetchIceConfig()
      .then((cfg) => {
        media.setIceConfig(cfg);
        push(`ICE has_turn=${cfg.has_turn}`);
      })
      .catch((e) => push(`config fail ${e}`));

    hub.connect();
    return () => {
      hub.disconnect();
      media.close();
    };
  }, [identity.name, identity.user_id, push]);

  function start() {
    try {
      hubRef.current?.spin();
      setPhase("search");
      push("→ spin");
    } catch (e) {
      push(String(e));
    }
  }

  function next() {
    try {
      hubRef.current?.next();
      setPhase("search");
      setPartner("");
      push("→ next");
    } catch (e) {
      push(String(e));
    }
  }

  function stop() {
    try {
      hubRef.current?.stop();
      setPhase("idle");
      setPartner("");
      push("→ stop");
    } catch (e) {
      push(String(e));
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <Text style={styles.stageLabel}>
          {phase === "matched"
            ? `Matched · ${partner}`
            : phase === "search"
              ? "Looking…"
              : "Preview / idle"}
        </Text>
        <Text style={styles.stageHint}>
          A/V surface lands when react-native-webrtc is linked via prebuild.
        </Text>
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
      </View>

      <View style={styles.log}>
        {log.map((line, i) => (
          <Text key={`${i}-${line.slice(0, 12)}`} style={styles.logLine}>
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
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  stageLabel: { color: "#e8eef7", fontSize: 18, fontWeight: "700" },
  stageHint: {
    color: "#6b7a90",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
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
  btnText: { color: "#fff", fontWeight: "700" },
  log: {
    maxHeight: 140,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  logLine: { color: "#6b7a90", fontSize: 11, fontFamily: "monospace" },
});
