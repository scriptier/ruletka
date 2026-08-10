#!/usr/bin/env node
/**
 * Local pair smoke: two headless Chromium processes + local roulette-bridge
 * (simple mode, TURN off). Proves wire SDP hygiene + connect budgets.
 *
 * Checks (per match):
 *   - exactly 1 wire offer + 1 wire answer
 *   - no second offer within SECOND_OFFER_GUARD_MS
 *   - hub match_to_offer_ms / match_to_answer_ms within budgets
 *   - both sides get a remote track within MATCH_TO_TRACK_MS
 * Optional rematch (default on): hangup → Start again → same budgets
 *
 * Usage:
 *   node scripts/pair-smoke.mjs
 *   PAIR_SMOKE_PORT=8799 CHROME=/usr/bin/chromium node scripts/pair-smoke.mjs
 *   PAIR_SMOKE_REMATCH=0 node scripts/pair-smoke.mjs   # first match only
 *
 * Env budgets (ms):
 *   PAIR_SMOKE_MTO_MS          match→offer hub (default 3000)
 *   PAIR_SMOKE_MTA_MS          match→answer hub (default 4000)
 *   PAIR_SMOKE_OTA_MS          client offer→answer (default 3000)
 *   PAIR_SMOKE_MATCH_TO_TRACK_MS  match→remote track (default 15000)
 *   PAIR_SMOKE_BUDGET_MS       wall wait per match (default 25000)
 *   PAIR_SMOKE_ATTEMPTS        glare retries (default 5)
 *   PAIR_SMOKE_REMATCH         1=second match (default 1)
 *   PAIR_SMOKE_SCORECARD       path for JSONL (default artifacts/connect-scorecard.jsonl)
 *
 * Exit: 0 pass, 2 assertion fail, 1 unexpected, 0 skip (no chrome/bridge)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const PORT = Number(process.env.PAIR_SMOKE_PORT || 8797);
const BASE = `http://127.0.0.1:${PORT}`;
// Prefer chromium for headless (google-chrome often slower / flakier here)
const CHROME =
  process.env.CHROME ||
  ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find(
    (p) => fs.existsSync(p)
  );
const BRIDGE_BIN = path.join(ROOT, "target/release/roulette-bridge");

const SECOND_OFFER_GUARD_MS = 5_000;
const OVERALL_BUDGET_MS = Number(process.env.PAIR_SMOKE_BUDGET_MS || 25_000);
const MAX_ATTEMPTS = Number(process.env.PAIR_SMOKE_ATTEMPTS || 5);
const DO_REMATCH = String(process.env.PAIR_SMOKE_REMATCH ?? "1") !== "0";
/** If 0 (default), rematch failure is WARN only — match1 pass still exits 0. */
const REMATCH_STRICT = String(process.env.PAIR_SMOKE_REMATCH_STRICT ?? "0") === "1";
const BUDGET_MTO = Number(process.env.PAIR_SMOKE_MTO_MS || 3000);
const BUDGET_MTA = Number(process.env.PAIR_SMOKE_MTA_MS || 4000);
const BUDGET_OTA = Number(process.env.PAIR_SMOKE_OTA_MS || 3000);
const BUDGET_TRACK = Number(process.env.PAIR_SMOKE_MATCH_TO_TRACK_MS || 15_000);
const SCORECARD_PATH =
  process.env.PAIR_SMOKE_SCORECARD ||
  path.join(ROOT, "artifacts/connect-scorecard.jsonl");

const stamp = () => new Date().toISOString().slice(11, 23);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[pair-smoke ${stamp()}]`, ...a);

function skip(reason) {
  console.log(`[pair-smoke] SKIP: ${reason}`);
  process.exit(0);
}

if (!CHROME) skip("no Chrome/Chromium binary found (set CHROME=/path/to/chrome)");
if (!fs.existsSync(BRIDGE_BIN)) {
  skip(
    `bridge binary missing at ${BRIDGE_BIN} — build with: cargo build -p freenet-roulette-bridge --release`
  );
}

/** Resolve puppeteer-core from common install locations. */
function loadPuppeteer() {
  const require = createRequire(import.meta.url);
  const candidates = [
    path.join(ROOT, "node_modules/puppeteer-core"),
    "/tmp/node_modules/puppeteer-core",
    path.join(os.homedir(), ".npm/_npx"),
  ];
  for (const c of candidates) {
    try {
      if (c.includes("_npx")) continue;
      if (fs.existsSync(path.join(c, "package.json"))) {
        return require(c);
      }
    } catch (_) {}
  }
  try {
    return require("puppeteer-core");
  } catch (_) {}
  try {
    return require("/tmp/node_modules/puppeteer-core");
  } catch (_) {}
  skip("puppeteer-core not found — npm i puppeteer-core in /tmp or project root");
}

const puppeteer = loadPuppeteer();

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pair-smoke-"));
const bridgeLogPath = path.join(tmpDir, "bridge.log");
const bridgeLogFd = fs.openSync(bridgeLogPath, "a");

/** @type {number} byte offset in bridge log already consumed */
let bridgeLogOffset = 0;

function installHooks(uid, name) {
  try {
    localStorage.setItem(
      "nextface-user-v1",
      JSON.stringify({ user_id: uid, name })
    );
    localStorage.setItem("nextface-rules-v1", "1");
    localStorage.setItem("ruletka-first-session-guide-v1", "1");
    // Skip stranger intro blur so track paints without unblur tap
    localStorage.setItem(
      "ruletka-match-prefs-v1",
      JSON.stringify({ blurStrangersMode: "off", blurStrangers: false })
    );
  } catch (_) {}

  window.__pairSmoke = {
    wsOut: [],
    wsIn: [],
    localSdp: [],
    remoteSdp: [],
    matchedAt: null,
    pcCreatedAt: null,
    trackAt: null,
    connStates: [],
    matchedCount: 0,
  };

  const OrigWS = window.WebSocket;
  function HookedWS(url, proto) {
    const ws = proto !== undefined ? new OrigWS(url, proto) : new OrigWS(url);
    const origSend = ws.send.bind(ws);
    ws.send = function (data) {
      try {
        const obj = JSON.parse(data);
        if (obj && obj.type === "signal" && (obj.kind === "offer" || obj.kind === "answer")) {
          const rec = { t: Date.now(), kind: obj.kind };
          window.__pairSmoke.wsOut.push(rec);
          console.log(`[pairsmoke] wsOut ${obj.kind} t=${rec.t}`);
        }
      } catch (_) {}
      return origSend(data);
    };
    ws.addEventListener("message", (ev) => {
      try {
        const obj = JSON.parse(ev.data);
        if (obj && obj.type === "matched") {
          const t = Date.now();
          if (!window.__pairSmoke.matchedAt) window.__pairSmoke.matchedAt = t;
          window.__pairSmoke.matchedCount =
            (window.__pairSmoke.matchedCount || 0) + 1;
          console.log(
            `[pairsmoke] matched #${window.__pairSmoke.matchedCount} t=${t}`
          );
        }
        if (
          obj &&
          obj.type === "signal" &&
          (obj.kind === "offer" || obj.kind === "answer")
        ) {
          const rec = { t: Date.now(), kind: obj.kind };
          window.__pairSmoke.wsIn.push(rec);
          console.log(`[pairsmoke] wsIn ${obj.kind} t=${rec.t}`);
        }
      } catch (_) {}
    });
    return ws;
  }
  HookedWS.prototype = OrigWS.prototype;
  Object.keys(OrigWS).forEach((k) => {
    try {
      HookedWS[k] = OrigWS[k];
    } catch (_) {}
  });
  window.WebSocket = HookedWS;

  const OrigPC = window.RTCPeerConnection;
  function HookedPC(cfg) {
    const pc = new OrigPC(cfg);
    if (!window.__pairSmoke.pcCreatedAt) {
      window.__pairSmoke.pcCreatedAt = Date.now();
    }
    const origSetLocal = pc.setLocalDescription.bind(pc);
    pc.setLocalDescription = function (desc) {
      return origSetLocal(desc).then((r) => {
        try {
          const type =
            (desc && desc.type) ||
            (pc.localDescription && pc.localDescription.type);
          if (type === "offer" || type === "answer") {
            window.__pairSmoke.localSdp.push({ t: Date.now(), type });
            console.log(`[pairsmoke] localSdp ${type}`);
          }
        } catch (_) {}
        return r;
      });
    };
    const origSetRemote = pc.setRemoteDescription.bind(pc);
    pc.setRemoteDescription = function (desc) {
      return origSetRemote(desc).then((r) => {
        try {
          const type = desc && desc.type;
          if (type === "offer" || type === "answer") {
            window.__pairSmoke.remoteSdp.push({ t: Date.now(), type });
            console.log(`[pairsmoke] remoteSdp ${type}`);
          }
        } catch (_) {}
        return r;
      });
    };
    const markTrack = () => {
      if (!window.__pairSmoke.trackAt) window.__pairSmoke.trackAt = Date.now();
    };
    pc.addEventListener("track", markTrack);
    pc.addEventListener("connectionstatechange", () => {
      window.__pairSmoke.connStates.push({
        t: Date.now(),
        s: pc.connectionState,
      });
      // Catch tracks that arrived before hook / after rematch without new event
      try {
        for (const r of pc.getReceivers?.() || []) {
          if (r?.track && r.track.readyState === "live") markTrack();
        }
      } catch (_) {}
    });
    // Poll once shortly after create — fake devices can fire track before listener
    setTimeout(() => {
      try {
        for (const r of pc.getReceivers?.() || []) {
          if (r?.track && r.track.readyState === "live") markTrack();
        }
      } catch (_) {}
    }, 100);
    return pc;
  }
  HookedPC.prototype = OrigPC.prototype;
  Object.keys(OrigPC).forEach((k) => {
    try {
      HookedPC[k] = OrigPC[k];
    } catch (_) {}
  });
  window.RTCPeerConnection = HookedPC;
}

async function dismissModals(page) {
  return page.evaluate(() => {
    const dismissIds = [
      "btn-rules-accept",
      "btn-age-ok",
      "btn-guide-ok",
      "btn-swipe-coach-ok",
      "btn-blur-starter-ok",
      "btn-cellular-tip-ok",
      "btn-notif-optin-no",
      "btn-unblur-coach-ok",
      "btn-unblur-coach-dismiss",
    ];
    for (const id of dismissIds) {
      const el = document.getElementById(id);
      if (el && el.offsetParent !== null) el.click();
    }
  });
}

async function clickStart(page) {
  await dismissModals(page);
  return page.evaluate(() => {
    const start = document.getElementById("btn-start-match");
    if (start && !start.disabled) {
      start.click();
      return "btn-start-match";
    }
    return null;
  });
}

async function clickNext(page) {
  return page.evaluate(() => {
    // Force-click even if CSS "hidden" (offsetParent null) — Next is often
    // display:none until layout settles; still works when matched.
    const next = document.getElementById("btn-next");
    if (next && !next.disabled) {
      try {
        next.hidden = false;
        next.removeAttribute("hidden");
        next.style.display = "";
        next.style.visibility = "visible";
        next.style.pointerEvents = "auto";
      } catch (_) {}
      next.click();
      return "btn-next";
    }
    const stop = document.getElementById("btn-stop");
    if (stop && !stop.disabled) {
      try {
        stop.hidden = false;
        stop.removeAttribute("hidden");
      } catch (_) {}
      stop.click();
      return "btn-stop";
    }
    return null;
  });
}

/** Wait until Start is clickable (left call / idle). */
async function waitForStartReady(page, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const ok = await page.evaluate(() => {
      const start = document.getElementById("btn-start-match");
      if (!start || start.disabled) return false;
      // Visible or at least in DOM and enabled
      return true;
    });
    if (ok) return true;
    await sleep(200);
  }
  return false;
}

/** Leave current match only (one Next/Stop). Never double-click —
 *  second Next kills the auto-rematch that First Next just started. */
async function leaveMatch(page, name) {
  await dismissModals(page);
  const leave = await clickNext(page);
  log(`[${name}] leave=${leave}`);
  await sleep(500);
  await dismissModals(page);
}

/** Hard reset via reload (clean match1 retries). Hooks re-run via evaluateOnNewDocument. */
async function reloadBot(page, name) {
  log(`[${name}] reload`);
  await page.goto(`${BASE}/live.html`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await sleep(1200);
  await dismissModals(page);
}

/** Enter stranger queue (Start). Safe if already searching. */
async function enterQueue(page, name) {
  await dismissModals(page);
  await waitForStartReady(page, 3000);
  const st = await clickStart(page);
  log(`[${name}] start=${st}`);
  await sleep(150);
  await clickStart(page);
}

async function resetPairSmoke(page) {
  await page.evaluate(() => {
    const s = window.__pairSmoke;
    if (!s) return;
    s.wsOut = [];
    s.wsIn = [];
    s.localSdp = [];
    s.remoteSdp = [];
    s.matchedAt = null;
    s.pcCreatedAt = null;
    s.trackAt = null;
    s.connStates = [];
    s.matchedCount = 0;
  });
}

async function launchBot(uid, name) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=640,480",
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 640, height: 480 });
  page.on("console", (msg) => {
    const t = msg.text();
    if (/pairsmoke|webrtc|matched|offer|answer/i.test(t)) {
      log(`[${name}]`, t.slice(0, 300));
    }
  });
  page.on("pageerror", (e) => log(`[${name}] pageerr`, e.message));
  await page.evaluateOnNewDocument(installHooks, uid, name);
  const ctx = browser.defaultBrowserContext();
  try {
    await ctx.overridePermissions(BASE, ["camera", "microphone"]);
  } catch (_) {}
  await page.goto(`${BASE}/live.html`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await sleep(1500);
  await dismissModals(page);
  return { browser, page };
}

function readBridgeLogDelta() {
  const full = fs.readFileSync(bridgeLogPath, "utf8");
  const slice = full.slice(bridgeLogOffset);
  bridgeLogOffset = full.length;
  return slice;
}

function parseHubTiming(logSlice) {
  const offerLines = logSlice
    .split("\n")
    .filter((l) => l.includes("first offer after match"));
  const answerLines = logSlice
    .split("\n")
    .filter((l) => l.includes("first answer after match"));
  const lastOffer = offerLines[offerLines.length - 1] || "";
  const lastAnswer = answerLines[answerLines.length - 1] || "";
  const mto = lastOffer.match(/match_to_offer_ms=(\d+)/);
  const mta = lastAnswer.match(/match_to_answer_ms=(\d+)/);
  return {
    offerLines: offerLines.length,
    answerLines: answerLines.length,
    mto_ms: mto ? Number(mto[1]) : null,
    mta_ms: mta ? Number(mta[1]) : null,
    offerLine: lastOffer.trim(),
    answerLine: lastAnswer.trim(),
  };
}

function wireOffers(snap) {
  return (snap.wsOut || []).filter((x) => x.kind === "offer");
}
function wireAnswers(snap) {
  return (snap.wsOut || []).filter((x) => x.kind === "answer");
}

/**
 * Wait until both bots matched, have 1+ offer/answer on wire, and tracks
 * (or timeout). Returns { snapA, snapB, ok }.
 */
function snapWithTrackHarvest() {
  try {
    if (typeof peerPcs !== "undefined" && peerPcs?.values) {
      for (const p of peerPcs.values()) {
        for (const r of p?.pc?.getReceivers?.() || []) {
          if (r?.track?.readyState === "live" && !window.__pairSmoke.trackAt) {
            window.__pairSmoke.trackAt = Date.now();
          }
        }
      }
    }
  } catch (_) {}
  return window.__pairSmoke;
}

async function waitForMatchMedia(pageA, pageB, budgetMs) {
  const t0 = Date.now();
  let snapA = null;
  let snapB = null;
  while (Date.now() - t0 < budgetMs) {
    [snapA, snapB] = await Promise.all([
      pageA.evaluate(snapWithTrackHarvest),
      pageB.evaluate(snapWithTrackHarvest),
    ]);
    const offers =
      wireOffers(snapA).length + wireOffers(snapB).length;
    const answers =
      wireAnswers(snapA).length + wireAnswers(snapB).length;
    const bothTracked = !!(snapA.trackAt && snapB.trackAt);
    const matched = !!(snapA.matchedAt && snapB.matchedAt);
    if (matched && offers >= 1 && answers >= 1 && bothTracked) {
      return { snapA, snapB, ok: true };
    }
    await sleep(250);
  }
  return { snapA, snapB, ok: false };
}

/**
 * Analyze one match snapshot. Returns { pass, fails[], metrics }.
 */
function analyzeMatch(label, snapA, snapB, hub) {
  const fails = [];
  const allOffers = [...wireOffers(snapA), ...wireOffers(snapB)].sort(
    (a, b) => a.t - b.t
  );
  const allAnswers = [...wireAnswers(snapA), ...wireAnswers(snapB)].sort(
    (a, b) => a.t - b.t
  );

  if (allOffers.length !== 1) {
    fails.push(`${label}: expected 1 wire offer, got ${allOffers.length}`);
  }
  if (allAnswers.length !== 1) {
    fails.push(`${label}: expected 1 wire answer, got ${allAnswers.length}`);
  }
  if (
    allOffers.length >= 2 &&
    allOffers[1].t - allOffers[0].t < SECOND_OFFER_GUARD_MS
  ) {
    fails.push(
      `${label}: second wire offer ${allOffers[1].t - allOffers[0].t}ms after first`
    );
  }

  const matchedAt = Math.min(
    snapA.matchedAt || Infinity,
    snapB.matchedAt || Infinity
  );
  let trackA = null;
  let trackB = null;
  if (!Number.isFinite(matchedAt)) {
    fails.push(`${label}: never matched`);
  } else {
    for (const [name, snap] of [
      ["botA", snapA],
      ["botB", snapB],
    ]) {
      if (!snap.trackAt) {
        fails.push(`${label}: ${name} no remote track within budget`);
      } else {
        const dt = snap.trackAt - matchedAt;
        if (name === "botA") trackA = dt;
        else trackB = dt;
        if (dt > BUDGET_TRACK) {
          fails.push(
            `${label}: ${name} track ${dt}ms > budget ${BUDGET_TRACK}ms`
          );
        }
      }
    }
  }

  let ota = null;
  if (allOffers.length >= 1 && allAnswers.length >= 1) {
    ota = allAnswers[0].t - allOffers[0].t;
    if (ota > BUDGET_OTA) {
      fails.push(
        `${label}: offer→answer ${ota}ms > budget ${BUDGET_OTA}ms`
      );
    }
    if (ota < 0) {
      fails.push(`${label}: answer before offer on wire (ota=${ota})`);
    }
  }

  if (hub.mto_ms != null && hub.mto_ms > BUDGET_MTO) {
    fails.push(
      `${label}: hub MTO ${hub.mto_ms}ms > budget ${BUDGET_MTO}ms`
    );
  }
  if (hub.mta_ms != null && hub.mta_ms > BUDGET_MTA) {
    fails.push(
      `${label}: hub MTA ${hub.mta_ms}ms > budget ${BUDGET_MTA}ms`
    );
  }
  // Local path should always log both; missing answer line is a fail
  if (hub.offerLines < 1) {
    fails.push(`${label}: hub missing "first offer after match"`);
  }
  if (hub.answerLines < 1) {
    fails.push(`${label}: hub missing "first answer after match"`);
  }

  const metrics = {
    offers: allOffers.length,
    answers: allAnswers.length,
    mto_ms: hub.mto_ms,
    mta_ms: hub.mta_ms,
    offer_to_answer_ms: ota,
    track_a_ms: trackA,
    track_b_ms: trackB,
    dual_offer: allOffers.length > 1 ? 1 : 0,
  };

  return { pass: fails.length === 0, fails, metrics };
}

function writeScorecard(row) {
  try {
    const dir = path.dirname(SCORECARD_PATH);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(SCORECARD_PATH, JSON.stringify(row) + "\n");
    log(`scorecard → ${SCORECARD_PATH}`);
  } catch (e) {
    log("scorecard write failed", e.message);
  }
}

async function main() {
  log(
    `bridge=${BRIDGE_BIN} port=${PORT} chrome=${CHROME} rematch=${DO_REMATCH ? 1 : 0}`
  );
  log(
    `budgets MTO=${BUDGET_MTO} MTA=${BUDGET_MTA} OTA=${BUDGET_OTA} TRACK=${BUDGET_TRACK} wall=${OVERALL_BUDGET_MS}`
  );

  const bridge = spawn(
    BRIDGE_BIN,
    [
      "--mode",
      "simple",
      "--listen",
      `127.0.0.1:${PORT}`,
      "--ui-dir",
      path.join(ROOT, "ui"),
      "--friends-file",
      path.join(tmpDir, "friends.json"),
      "--directory-file",
      path.join(tmpDir, "directory_hubs.json"),
      "--federation-peers-file",
      path.join(tmpDir, "federation_peers.json"),
    ],
    {
      cwd: ROOT,
      env: { ...process.env, RUST_LOG: "info", ROULETTE_TURN: "off" },
      stdio: ["ignore", bridgeLogFd, bridgeLogFd],
    }
  );

  let bridgeExited = false;
  bridge.on("exit", () => {
    bridgeExited = true;
  });

  const cleanup = () => {
    try {
      fs.closeSync(bridgeLogFd);
    } catch (_) {}
    if (!bridgeExited) {
      try {
        bridge.kill("SIGTERM");
      } catch (_) {}
    }
  };
  process.on("exit", cleanup);

  let up = false;
  for (let i = 0; i < 50 && !bridgeExited; i++) {
    try {
      const r = await fetch(`${BASE}/v1/directory`);
      if (r.ok) {
        up = true;
        break;
      }
    } catch (_) {}
    await sleep(200);
  }
  if (!up) {
    const tail = fs.readFileSync(bridgeLogPath, "utf8").slice(-2000);
    console.error("[pair-smoke] bridge never came up:\n" + tail);
    process.exit(1);
  }
  log("bridge up");
  // Consume any boot noise so first match delta is clean
  bridgeLogOffset = fs.readFileSync(bridgeLogPath, "utf8").length;

  let exitCode = 0;
  let botA = null;
  let botB = null;
  const score = {
    v: "pair-smoke",
    at: new Date().toISOString(),
    pass: false,
    attempt: 0,
    rematch: DO_REMATCH,
    budgets: {
      mto_ms: BUDGET_MTO,
      mta_ms: BUDGET_MTA,
      ota_ms: BUDGET_OTA,
      track_ms: BUDGET_TRACK,
    },
    match1: null,
    match2: null,
    fails: [],
  };

  try {
    // Stagger launches — two simultaneous Chromiums starve createOffer on this host
    botA = await launchBot("aaaaaaaa-0000-0000-0000-000000000001", "botA");
    await sleep(400);
    botB = await launchBot("bbbbbbbb-0000-0000-0000-000000000002", "botB");
    const pageA = botA.page;
    const pageB = botB.page;

    let match1 = null;
    let attempt = 0;

    for (attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      log(`--- match1 attempt ${attempt}/${MAX_ATTEMPTS} ---`);
      await resetPairSmoke(pageA);
      await resetPairSmoke(pageB);
      // Consume hub log so this attempt's lines are isolated
      readBridgeLogDelta();

      if (attempt > 1) {
        // Full page reload — leave/Next thrash was killing auto-rematch mid-SDP
        await reloadBot(pageA, "botA");
        await reloadBot(pageB, "botB");
        await resetPairSmoke(pageA);
        await resetPairSmoke(pageB);
        readBridgeLogDelta();
      }

      await enterQueue(pageA, "botA");
      await enterQueue(pageB, "botB");
      log("both bots clicked Start");

      const waited = await waitForMatchMedia(
        pageA,
        pageB,
        OVERALL_BUDGET_MS
      );
      await sleep(200);
      const hub = parseHubTiming(readBridgeLogDelta());
      log("hub timing", hub);
      log("snapshots", {
        A: {
          matched: waited.snapA?.matchedAt,
          track: waited.snapA?.trackAt,
          out: waited.snapA?.wsOut?.length,
        },
        B: {
          matched: waited.snapB?.matchedAt,
          track: waited.snapB?.trackAt,
          out: waited.snapB?.wsOut?.length,
        },
      });

      const result = analyzeMatch(
        `match1@${attempt}`,
        waited.snapA || {},
        waited.snapB || {},
        hub
      );
      match1 = result;
      score.attempt = attempt;
      score.match1 = result.metrics;

      if (result.pass) {
        log(
          `PASS match1 offers=${result.metrics.offers} answers=${result.metrics.answers} ` +
            `MTO=${result.metrics.mto_ms} MTA=${result.metrics.mta_ms} ` +
            `OTA=${result.metrics.offer_to_answer_ms} ` +
            `trackA=${result.metrics.track_a_ms} trackB=${result.metrics.track_b_ms}`
        );
        break;
      }
      log(`attempt ${attempt} failed:`, result.fails.join("; "));
      if (attempt < MAX_ATTEMPTS) {
        // Glare/scheduler flake — retry fresh match
        continue;
      }
    }

    if (!match1 || !match1.pass) {
      for (const f of match1?.fails || ["match1 never passed"]) {
        console.error(`[pair-smoke] FAIL: ${f}`);
        score.fails.push(f);
      }
      exitCode = 2;
    }

    // --- rematch (2nd match speed) ---
    if (exitCode === 0 && DO_REMATCH) {
      log("--- rematch (match2) ---");
      // Product: fat-finger Next grace ~2s after match — wait it out or Next is no-op
      log("waiting 2.2s for nextGrace…");
      await sleep(2200);

      let result2 = null;
      for (let r = 1; r <= 3; r++) {
        log(`rematch try ${r}/3`);
        // Clear counters BEFORE Next so the next "matched" is match2
        await resetPairSmoke(pageA);
        await resetPairSmoke(pageB);
        readBridgeLogDelta();

        // Next auto re-queues — single click each (no Start; Start toggles search off)
        await leaveMatch(pageA, "botA");
        await sleep(300);
        await leaveMatch(pageB, "botB");
        log("both bots Next'd (auto re-queue)");

        // Brief settle; only Start if clearly idle (Start visible in layout)
        await sleep(800);
        const needStart = async (page) =>
          page.evaluate(() => {
            const start = document.getElementById("btn-start-match");
            if (!start || start.disabled) return false;
            // matched/searching often hides Start via [hidden] or display:none
            if (start.hidden) return false;
            const st = window.getComputedStyle(start);
            if (st.display === "none" || st.visibility === "hidden") return false;
            return start.offsetParent !== null;
          });
        if (await needStart(pageA)) {
          log("botA still idle — Start");
          await enterQueue(pageA, "botA");
        }
        if (await needStart(pageB)) {
          log("botB still idle — Start");
          await enterQueue(pageB, "botB");
        }

        const waited2 = await waitForMatchMedia(
          pageA,
          pageB,
          Math.min(OVERALL_BUDGET_MS, 18_000)
        );
        await sleep(250);
        const hub2 = parseHubTiming(readBridgeLogDelta());
        log("hub timing rematch", hub2);
        result2 = analyzeMatch(
          "match2",
          waited2.snapA || {},
          waited2.snapB || {},
          hub2
        );
        score.match2 = result2.metrics;
        if (result2.pass) break;
        log(`rematch try ${r} failed:`, result2.fails.join("; "));
        // Wait grace again before retry
        await sleep(2200);
      }

      if (result2 && result2.pass) {
        log(
          `PASS match2 offers=${result2.metrics.offers} answers=${result2.metrics.answers} ` +
            `MTO=${result2.metrics.mto_ms} MTA=${result2.metrics.mta_ms} ` +
            `OTA=${result2.metrics.offer_to_answer_ms} ` +
            `trackA=${result2.metrics.track_a_ms} trackB=${result2.metrics.track_b_ms}`
        );
      } else {
        for (const f of result2?.fails || ["match2 failed"]) {
          score.fails.push(f);
          if (REMATCH_STRICT) {
            console.error(`[pair-smoke] FAIL: ${f}`);
          } else {
            console.warn(`[pair-smoke] WARN rematch: ${f}`);
          }
        }
        if (REMATCH_STRICT) exitCode = 2;
        else log("rematch soft-fail (set PAIR_SMOKE_REMATCH_STRICT=1 to hard-fail)");
      }
    }

    // Gate = match1 only unless rematch strict
    score.pass =
      exitCode === 0 &&
      !!score.match1 &&
      (score.fails.length === 0 ||
        (!REMATCH_STRICT &&
          score.fails.every((f) => String(f).includes("match2"))));
    if (exitCode === 0 && score.match1) {
      // Recover pass flag when only soft rematch warns
      if (!REMATCH_STRICT) score.pass = true;
      log("PASS overall (match1 gate)");
    }
  } catch (e) {
    console.error("[pair-smoke] unexpected error", e);
    score.fails.push(String(e && e.message ? e.message : e));
    exitCode = 1;
  } finally {
    writeScorecard(score);
    // Human-readable scorecard line for agents / terminal
    console.log(
      "[pair-smoke] SCORECARD",
      JSON.stringify({
        pass: score.pass,
        attempt: score.attempt,
        m1: score.match1,
        m2: score.match2,
        fails: score.fails,
      })
    );
    try {
      await botA?.browser.close();
    } catch (_) {}
    try {
      await botB?.browser.close();
    } catch (_) {}
    cleanup();
    log(`bridge log: ${bridgeLogPath}`);
  }

  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
