/* global RouletteProtocol, RouletteWebRtc, FreenetNodeClient, freenetDefaultWs */

const { Lobby, Peer } = RouletteProtocol;

const lobby = new Lobby();
const sessions = new Map();
const peers = [new Peer("you"), new Peer("stranger")];
let nowMs = 1_000;
/** @type {import('./webrtc.js').RouletteWebRtc | null} */
let rtc = null;
let freenet = null;

const $ = (id) => document.getElementById(id);

function setStatus(text) {
  $("status").textContent = text;
}

function render() {
  peers.forEach((p, i) => {
    $(`pid-${i}`).textContent = p.peerId.slice(0, 8);
    const phaseEl = $(`phase-${i}`);
    phaseEl.textContent = p.phase;
    phaseEl.className = `phase ${p.phase}`;

    const log = $(`log-${i}`);
    log.innerHTML = "";

    for (const e of p.log.slice(-8)) {
      const d = document.createElement("div");
      d.className = "sys";
      d.textContent = e.body;
      log.appendChild(d);
    }

    let msgs = p.messages;
    if (p.sessionId && sessions.has(p.sessionId)) {
      msgs = sessions.get(p.sessionId);
    }
    for (const m of msgs) {
      const d = document.createElement("div");
      d.className = "bubble" + (m.author === p.peerId ? " mine" : "");
      d.innerHTML = `<div class="meta">${m.author.slice(0, 8)}</div>${escapeHtml(m.body)}`;
      log.appendChild(d);
    }
    log.scrollTop = log.scrollHeight;
  });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function spin(i) {
  nowMs += 100;
  peers[i].spin(lobby, nowMs);
  setStatus(`peer ${i} waiting · offers=${lobby.offers.size}`);
  render();
}

function next(i) {
  nowMs += 100;
  peers[i].next(lobby, nowMs);
  if (rtc) {
    rtc.close();
    rtc = null;
  }
  setStatus(`peer ${i} idle`);
  render();
}

async function tick() {
  nowMs += 500;
  await peers[0].tick(lobby, nowMs);
  await peers[1].tick(lobby, nowMs);
  await peers[0].tick(lobby, nowMs);
  await peers[1].tick(lobby, nowMs);

  for (const p of peers) {
    if (p.sessionId && sessions.has(p.sessionId)) {
      p.messages = sessions.get(p.sessionId);
    }
  }

  const matched = peers.filter((p) => p.phase === "matched").length;
  setStatus(
    `offers=${lobby.offers.size} claims=${lobby.claims.size} matched=${matched}`
  );
  render();
  return matched === 2;
}

async function autoMatch() {
  if (peers[0].phase === "idle") spin(0);
  if (peers[1].phase === "idle") spin(1);
  for (let i = 0; i < 25; i++) {
    if (await tick()) {
      setStatus("matched ✓ — optional: Video");
      return;
    }
  }
  setStatus("no match yet — tick again");
}

/**
 * In dual-pane sim, peer 0 is "you" (offer if lex smaller vs peer 1).
 * Signals are injected into peer logs for visibility; full multi-tab path
 * would push SignalMessage into the session CRDT.
 */
async function startVideo() {
  const a = peers[0];
  const b = peers[1];
  if (a.phase !== "matched" || b.phase !== "matched") {
    setStatus("match first, then Video");
    return;
  }

  const isOfferer = a.peerId < b.peerId;
  setStatus(isOfferer ? "webrtc: you offer" : "webrtc: you answer");

  // Sim: two RTCPeerConnections on one page via a local signal bus
  const bus = [];
  const deliver = async (from, kind, payload) => {
    bus.push({ from, kind, payload });
    const other = from === 0 ? rtcB : rtcA;
    if (other) await other.handleRemoteSignal(kind, payload);
  };

  let rtcA = null;
  let rtcB = null;

  try {
    rtcA = new RouletteWebRtc(
      {
        onSignal: (kind, payload) => deliver(0, kind, payload),
        onRemoteStream: (stream) => {
          $("remote-0").srcObject = stream;
        },
        onConnectionState: (s) => setStatus(`webrtc A: ${s}`),
      },
      isOfferer
    );
    rtcB = new RouletteWebRtc(
      {
        onSignal: (kind, payload) => deliver(1, kind, payload),
        onRemoteStream: (stream) => {
          $("remote-1").srcObject = stream;
        },
        onConnectionState: (s) => setStatus(`webrtc B: ${s}`),
      },
      !isOfferer
    );

    const localA = await rtcA.startLocalMedia({ video: true, audio: true });
    const localB = await rtcB.startLocalMedia({ video: true, audio: true });
    $("local-0").srcObject = localA;
    $("local-1").srcObject = localB;

    await rtcA.connect();
    await rtcB.connect();
    rtc = rtcA; // for Next cleanup
    a.log.push({ sys: true, body: "webrtc started (sim dual-pc)" });
    b.log.push({ sys: true, body: "webrtc started (sim dual-pc)" });
    render();
  } catch (e) {
    console.error(e);
    setStatus("video failed: " + (e.message || e));
    rtcA?.close();
    rtcB?.close();
  }
}

// --- Freenet panel ---
function setupFreenetPanel() {
  const panel = $("freenet-panel");
  const mode = $("mode");
  $("ws-url").value =
    typeof freenetDefaultWs === "function"
      ? freenetDefaultWs()
      : "ws://127.0.0.1:7509/v1/contract/command";

  mode.addEventListener("change", () => {
    panel.hidden = mode.value !== "freenet";
  });

  $("btn-connect").addEventListener("click", async () => {
    if (typeof FreenetNodeClient === "undefined") {
      // freenet-client.js is type=module — attach after import
      const mod = await import("./freenet-client.js").catch(() => null);
      if (mod?.FreenetNodeClient) {
        window.FreenetNodeClient = mod.FreenetNodeClient;
        window.freenetDefaultWs = mod.defaultWs || freenetDefaultWs;
      }
    }
    const Client = window.FreenetNodeClient;
    if (!Client) {
      $("freenet-status").textContent = "no client";
      return;
    }
    freenet = new Client({
      onStatus: (s) => {
        const el = $("freenet-status");
        el.textContent = s;
        el.className = "phase " + (s === "connected" ? "matched" : s === "error" ? "waiting" : "");
      },
      onLog: (...args) => console.log(...args),
    });
    freenet.setLobbyKey($("lobby-key").value);
    await freenet.connect($("ws-url").value);
  });
}

$("btn-spin-both").addEventListener("click", () => {
  spin(0);
  spin(1);
});
$("btn-tick").addEventListener("click", () => tick());
$("btn-auto").addEventListener("click", () => autoMatch());
$("btn-video").addEventListener("click", () => startVideo());

document.querySelectorAll(".compose").forEach((form) => {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const i = Number(form.dataset.peer);
    const input = form.querySelector("input");
    const body = input.value.trim();
    if (!body) return;
    nowMs += 10;
    peers[i].nowMs = nowMs;
    const msg = peers[i].send(body, sessions);
    if (msg && peers[i].sessionId) {
      for (const p of peers) {
        if (p.sessionId === peers[i].sessionId) {
          p.messages = sessions.get(p.sessionId);
        }
      }
    }
    input.value = "";
    render();
  });
});

document.querySelectorAll("button.next").forEach((btn) => {
  btn.addEventListener("click", () => next(Number(btn.dataset.peer)));
});
document.querySelectorAll("button.spin").forEach((btn) => {
  btn.addEventListener("click", () => spin(Number(btn.dataset.peer)));
});

setupFreenetPanel();
render();
setStatus("ready — Spin both → Auto-match → Video");
