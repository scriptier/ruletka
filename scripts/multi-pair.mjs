#!/usr/bin/env node
/**
 * Multi-peer harness scaffold — 2 web, 2web+phone find-third, or 3 web.
 *
 * Agents use this to exercise multi / find-third paths without 3 humans.
 * Does NOT invent multi product PASS or GOAL_MET. Reports observed phases only.
 *
 * Sibling: scripts/multi-smoke.mjs (scorecard + --mode 3web|2web-phone + README).
 * Patterns: scripts/phone-web-pair.mjs + scripts/prod-pair-media.mjs
 * (isolated browser contexts, fake media, soft-skip, Start reclick).
 *
 * Modes (MODE env):
 *   web2       2 headless Chromium tabs — 1v1 pair scaffold (default)
 *   web2phone  2 web tabs; after match attempt find-third; budget left for phone as 3rd
 *   web3       3 web tabs: A+B match → find-third invite/accept → C as third (best-effort)
 *
 * Usage:
 *   node scripts/multi-pair.mjs
 *   MODE=web2phone BUDGET_MS=90000 CHROME=/usr/bin/chromium node scripts/multi-pair.mjs
 *   MODE=web3 RULETKA_URL=https://ruletka.vip/live.html node scripts/multi-pair.mjs
 *   FIND_THIRD=0 MODE=web2 node scripts/multi-pair.mjs   # pair only
 *   STAGGER_MS=1500 node scripts/multi-pair.mjs
 *
 * Env:
 *   RULETKA_URL   default https://ruletka.vip/live.html
 *   BUDGET_MS     wall time for queue/match/hunt (default 90000 web2phone/web3, 60000 web2)
 *   CHROME        path to chromium/google-chrome
 *   MODE          web2 | web2phone | web3
 *   FIND_THIRD    1=try invite+accept after 1v1 (default 1 for web2phone/web3, 0 for web2)
 *   STAGGER_MS    delay between tab boots (default 1200)
 *   ART_DIR       screenshot dir (default mobile/artifacts/multi-pair)
 *
 * Exit:
 *   0  scaffold complete or soft-skip — NEVER means multi product PASS
 *   2  hard fail after boot
 *   1  unexpected
 *
 * Observed phase labels (JSON `phase` / final summary) — honest only:
 *   boot | queued | pair_1v1_hint | find_third_invite_sent | find_third_accept_ui
 *   hunt_ui_hint | multi_pc_hint | third_tile_hint | budget_elapsed
 * Never emits "MULTI_PASS" / "GOAL_MET".
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.env.RULETKA_URL || "https://ruletka.vip/live.html";
const MODE = String(process.env.MODE || "web2").toLowerCase().replace(/[_-]/g, "");
const STAGGER = Number(process.env.STAGGER_MS || 1200);

const defaultBudget =
  MODE === "web2phone" || MODE === "web3" || MODE === "2webphone" || MODE === "3web"
    ? 90_000
    : 60_000;
const BUDGET = Number(process.env.BUDGET_MS || defaultBudget);

const FIND_THIRD_DEFAULT =
  MODE === "web2phone" ||
  MODE === "2webphone" ||
  MODE === "web3" ||
  MODE === "3web"
    ? "1"
    : "0";
const FIND_THIRD = String(process.env.FIND_THIRD ?? FIND_THIRD_DEFAULT) !== "0";

const CHROME =
  process.env.CHROME ||
  ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find(
    (p) => fs.existsSync(p)
  );

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 23);
const log = (...a) => console.log(`[multi-pair ${stamp()}]`, ...a);

function skip(reason) {
  console.log(`[multi-pair] SKIP: ${reason}`);
  process.exit(0);
}

if (!CHROME) skip("no Chrome/Chromium binary (set CHROME=…)");

/** Normalize mode aliases. */
function resolveMode(m) {
  if (m === "2web" || m === "web2" || m === "pair") return "web2";
  if (m === "2webphone" || m === "web2phone" || m === "phone" || m === "webphone")
    return "web2phone";
  if (m === "3web" || m === "web3" || m === "triple") return "web3";
  return "web2";
}
const mode = resolveMode(MODE);

function peerCountForMode(m) {
  if (m === "web3") return 3;
  return 2; // web2 + web2phone
}

/** Resolve puppeteer-core from common install locations. */
function loadPuppeteer() {
  const require = createRequire(import.meta.url);
  const candidates = [
    path.join(ROOT, "node_modules/puppeteer-core"),
    path.join(ROOT, "mobile/node_modules/puppeteer-core"),
    "/tmp/node_modules/puppeteer-core",
  ];
  for (const c of candidates) {
    try {
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
  skip("puppeteer-core not found — npm i puppeteer-core (root or /tmp)");
}

const puppeteer = loadPuppeteer();

function isChurn(err) {
  return /detached|Target closed|Session closed|Execution context was destroyed|frame was detached/i.test(
    String(err?.message || err)
  );
}

/**
 * Install page hooks before navigation:
 * - unique identity
 * - skip rules / blur intro friction
 * - RTCPeerConnection counter (peerPcs is not on window)
 */
async function installPreNav(page, name, uid) {
  await page.evaluateOnNewDocument(
    (opts) => {
      try {
        localStorage.setItem("nextface-rules-v1", "1");
        localStorage.setItem("ruletka-first-session-guide-v1", "1");
        localStorage.setItem(
          "ruletka-match-prefs-v1",
          JSON.stringify({ blurStrangersMode: "off", blurStrangers: false })
        );
        localStorage.setItem(
          "nextface-user-v1",
          JSON.stringify({ user_id: opts.uid, name: opts.name })
        );
      } catch (_) {}

      window.__multiHarness = {
        name: opts.name,
        pcs: [],
        pcAlive: 0,
        trackEvents: 0,
        events: [],
      };

      try {
        const Orig = window.RTCPeerConnection;
        if (Orig && !Orig.__multiHarnessHooked) {
          function Hooked(cfg) {
            const pc = new Orig(cfg);
            try {
              window.__multiHarness.pcs.push(pc);
              window.__multiHarness.pcAlive = window.__multiHarness.pcs.filter(
                (p) => p && p.connectionState !== "closed"
              ).length;
              pc.addEventListener("track", () => {
                window.__multiHarness.trackEvents += 1;
              });
              pc.addEventListener("connectionstatechange", () => {
                window.__multiHarness.pcAlive = window.__multiHarness.pcs.filter(
                  (p) => p && p.connectionState !== "closed"
                ).length;
              });
            } catch (_) {}
            return pc;
          }
          Hooked.prototype = Orig.prototype;
          Object.keys(Orig).forEach((k) => {
            try {
              Hooked[k] = Orig[k];
            } catch (_) {}
          });
          Hooked.__multiHarnessHooked = true;
          window.RTCPeerConnection = Hooked;
        }
      } catch (_) {}
    },
    { name, uid }
  );
}

async function dismissGates(page, name) {
  for (const sel of [
    "#btn-age-yes",
    "#btn-rules-accept",
    "#age-yes",
    "#age-confirm",
    "button#age-accept",
    "[data-age-ok]",
    "#rules-accept",
    "button.rules-accept",
    "[data-testid='age-accept']",
    "button.age-gate-yes",
  ]) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        log(`${name} dismiss ${sel}`);
        await sleep(400);
      }
    } catch (_) {}
  }
  try {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button, a, [role=button]")];
      const yes = btns.find((b) =>
        /^(yes|i.?m 18|enter|accept|agree|да|oui|sí)/i.test((b.textContent || "").trim())
      );
      if (yes) yes.click();
    });
  } catch (_) {}
  await sleep(600);
}

async function clickStart(page, name) {
  let started = false;
  for (const sel of [
    "#btn-start-match",
    "button.start-match-btn",
    "#btn-start",
    "#start",
    "button.start",
    "[data-start]",
    "[data-testid='start']",
    "button.btn-start",
    "#live-start",
  ]) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click({ delay: 40 });
        log(`${name} clicked ${sel}`);
        started = true;
        break;
      }
    } catch (_) {}
  }
  if (!started) {
    try {
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll("button, a, [role=button]")];
        const start = btns.find((b) =>
          /^\s*(start|search|find|go|найти|старт)\s*$/i.test((b.textContent || "").trim())
        );
        if (start) start.click();
        if (typeof window.startSearch === "function") window.startSearch();
        if (typeof window.queueJoin === "function") window.queueJoin();
        if (typeof window.kickSolo === "function") window.kickSolo();
      });
      log(`${name} evaluate start fallback`);
    } catch (e) {
      log(`${name} start fallback churn: ${e.message?.slice(0, 80)}`);
    }
  }
}

async function boot(browser, name, uid) {
  const ctx = await browser.createBrowserContext();
  try {
    await ctx.overridePermissions(new URL(URL).origin, ["camera", "microphone"]);
  } catch (_) {}
  const page = await ctx.newPage();
  page.__ruletCtx = ctx;
  page.__peerName = name;
  page.on("console", (msg) => {
    const t = msg.text();
    if (
      /webrtc|ice|offer|answer|track|frame|relay|force|pc |error|matched|queue|find.?third|trio|party|joinPeers|browse/i.test(
        t
      )
    ) {
      console.log(`[${name}] ${t.slice(0, 240)}`);
    }
  });

  await installPreNav(page, name, uid);
  await page.goto(URL + "?v=" + Date.now() + "&tab=" + name + "&from=multi-pair", {
    waitUntil: "networkidle2",
    timeout: 45_000,
  });
  await sleep(2500);
  await dismissGates(page, name);
  await clickStart(page, name);
  await sleep(1500);
  try {
    await page.waitForFunction(() => document.readyState === "complete", {
      timeout: 8000,
    });
  } catch (_) {}
  return page;
}

async function reclickStart(page, name) {
  try {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const start = btns.find((x) =>
        /start|search|найти|старт/i.test(x.textContent || "")
      );
      if (start && !/stop|next|end/i.test(start.textContent || "")) start.click();
    });
    log(`${name} reclick start`);
  } catch (e) {
    if (isChurn(e)) log(`${name} reclick skipped (churn): ${e.message?.slice(0, 80)}`);
  }
}

/**
 * Multi-aware snapshot via DOM + RTCPeerConnection hook.
 * peerPcs is module-local in live.js — do not rely on window.peerPcs.
 */
async function snapshot(page) {
  try {
    return await page.evaluate(async () => {
      const mh = window.__multiHarness || { pcs: [], trackEvents: 0 };
      const pcs = [];
      const list = Array.isArray(mh.pcs) ? mh.pcs : [];
      for (let i = 0; i < list.length; i++) {
        const pc = list[i];
        if (!pc || typeof pc.getStats !== "function") continue;
        if (pc.connectionState === "closed") continue;
        let frames = 0;
        let framesOut = 0;
        try {
          const s = await pc.getStats();
          s.forEach((r) => {
            if (r.type === "inbound-rtp" && (r.kind === "video" || r.mediaType === "video")) {
              frames = Math.max(frames, r.framesDecoded || 0, r.framesReceived || 0);
            }
            if (r.type === "outbound-rtp" && (r.kind === "video" || r.mediaType === "video")) {
              framesOut = Math.max(framesOut, r.framesEncoded || 0, r.framesSent || 0);
            }
          });
        } catch (_) {}
        pcs.push({
          i,
          ice: pc.iceConnectionState,
          cs: pc.connectionState,
          frames,
          framesOut,
        });
      }

      const vidMeta = (id) => {
        const v = document.getElementById(id);
        if (!v) return { id, present: false };
        return {
          id,
          present: true,
          hidden: !!(v.hidden || v.hasAttribute("hidden")),
          w: v.videoWidth || 0,
          h: v.videoHeight || 0,
          hasSrc: !!(v.srcObject || v.src),
        };
      };

      const stage = document.querySelector("main.stage");
      const findBtn = document.getElementById("btn-find-third");
      const findToast = document.getElementById("find-third-toast");
      const tileThird = document.getElementById("tile-third");
      const body = document.body?.innerText || "";
      const bodyHint = body.slice(0, 160).replace(/\s+/g, " ");

      const matchedHint = !!(
        /MATCHED|matched|in chat|connected|Stop|Next/i.test(body) &&
        !/start match|searching for a partner/i.test(bodyHint)
      );
      // stop/next dock often means mid-match
      const dockStop = !!document.getElementById("btn-stop");
      const dockStopVisible =
        dockStop &&
        (() => {
          const el = document.getElementById("btn-stop");
          return el && !el.hidden && el.offsetParent !== null;
        })();

      const iceOk = pcs.some(
        (p) => p.ice === "connected" || p.ice === "completed" || p.cs === "connected"
      );
      const hasRemoteFrames = pcs.some((p) => p.frames > 0);
      const remoteVid =
        vidMeta("remote").w > 0 ||
        vidMeta("remote2").w > 0 ||
        vidMeta("remote-third").w > 0;

      return {
        name: mh.name || "",
        pcCount: pcs.length,
        trackEvents: mh.trackEvents || 0,
        pcs,
        iceOk,
        hasRemoteFrames,
        remoteVid,
        matchedHint: matchedHint || dockStopVisible || iceOk || hasRemoteFrames || remoteVid,
        bodyHint,
        stageTrio: !!(stage && stage.classList.contains("stage-trio")),
        stageTrioSearching: !!(stage && stage.classList.contains("stage-trio-searching")),
        findThirdBtn: findBtn
          ? {
              hidden: !!findBtn.hidden,
              disabled: !!findBtn.disabled,
              text: (findBtn.textContent || "").trim().slice(0, 40),
            }
          : null,
        findThirdToast: !!findToast,
        tileThirdHidden: tileThird ? !!(tileThird.hidden || tileThird.hasAttribute("hidden")) : true,
        videos: {
          remote: vidMeta("remote"),
          remote2: vidMeta("remote2"),
          remoteThird: vidMeta("remote-third"),
          local: vidMeta("local"),
        },
      };
    });
  } catch (e) {
    if (isChurn(e)) {
      return {
        matchedHint: false,
        bodyHint: `(page churn) ${e.message?.slice(0, 60)}`,
        pcs: [],
        pcCount: 0,
        iceOk: false,
        hasRemoteFrames: false,
        remoteVid: false,
        stageTrio: false,
        stageTrioSearching: false,
        findThirdToast: false,
        tileThirdHidden: true,
        videos: {},
      };
    }
    throw e;
  }
}

/** Best-effort: open ⋯ menu and click Find 3rd (or partner-menu twin). */
async function tryFindThirdInvite(page, name) {
  try {
    const r = await page.evaluate(() => {
      const steps = [];
      const more = document.getElementById("btn-match-more");
      if (more) {
        more.click();
        steps.push("btn-match-more");
      }
      const wrap = document.getElementById("match-more-wrap");
      if (wrap) wrap.hidden = false;
      const menu = document.getElementById("match-more-menu");
      if (menu) menu.hidden = false;

      let clicked = null;
      for (const id of ["btn-find-third", "btn-partner-find-third"]) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.hidden = false;
        el.disabled = false;
        el.removeAttribute("hidden");
        el.click();
        clicked = id;
        steps.push(id);
        break;
      }
      return { clicked, steps };
    });
    log(`${name} find-third invite attempt ${JSON.stringify(r)}`);
    return !!(r && r.clicked);
  } catch (e) {
    log(`${name} find-third invite fail: ${e.message?.slice(0, 100)}`);
    return false;
  }
}

/** Accept incoming find-third toast if present. */
async function tryFindThirdAccept(page, name) {
  try {
    const r = await page.evaluate(() => {
      const yes = document.getElementById("btn-find-third-yes");
      if (yes) {
        yes.click();
        return "btn-find-third-yes";
      }
      const toast = document.getElementById("find-third-toast");
      if (!toast) return null;
      const btns = [...toast.querySelectorAll("button")];
      const accept = btns.find((b) => /yes|accept|find|да|ищем/i.test(b.textContent || ""));
      if (accept) {
        accept.click();
        return "toast-text";
      }
      return null;
    });
    if (r) log(`${name} find-third accept via ${r}`);
    return !!r;
  } catch (e) {
    if (!isChurn(e)) log(`${name} find-third accept fail: ${e.message?.slice(0, 80)}`);
    return false;
  }
}

function classifyPeer(st) {
  if (st.stageTrioSearching || (st.stageTrio && st.tileThirdHidden === false && !st.videos?.remoteThird?.w))
    return "hunt_ui_hint";
  if (st.stageTrio && (st.videos?.remoteThird?.w > 0 || st.videos?.remote2?.w > 0))
    return "third_tile_hint";
  if (st.pcCount >= 2) return "multi_pc_hint";
  if (st.findThirdToast) return "find_third_accept_ui";
  if (st.matchedHint || st.iceOk || st.hasRemoteFrames || st.remoteVid) return "pair_1v1_hint";
  return "queued";
}

// --- run ---
const artDir =
  process.env.ART_DIR || path.join(ROOT, "mobile/artifacts/multi-pair");
try {
  fs.mkdirSync(artDir, { recursive: true });
} catch (_) {}

const nPeers = peerCountForMode(mode);
const peerNames =
  nPeers === 3 ? ["MultiA", "MultiB", "MultiC"] : ["MultiA", "MultiB"];
const runId = Math.random().toString(36).slice(2, 8);

log(`chrome=${CHROME}`);
log(`url=${URL} mode=${mode} peers=${nPeers} budget_ms=${BUDGET} find_third=${FIND_THIRD ? 1 : 0}`);
log(`HONESTY: exit 0 ≠ multi product PASS; phases are observations only`);
if (mode === "web2phone") {
  log(`PHONE: start Android app (or Chrome) on same prod URL; accept match / join as 3rd after hunt`);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-web-security",
    "--no-sandbox",
    "--disable-dev-shm-usage",
  ],
});

/** @type {import('puppeteer-core').Page[]} */
const pages = [];
/** Observed milestones — never claim product multi PASS */
const observed = {
  boot: false,
  pair_1v1_hint: false,
  find_third_invite_sent: false,
  find_third_accept_ui: false,
  hunt_ui_hint: false,
  multi_pc_hint: false,
  third_tile_hint: false,
};

try {
  for (let i = 0; i < peerNames.length; i++) {
    const name = peerNames[i];
    const uid = `multi-pair-${runId}-${name.toLowerCase()}`;
    // web3: delay C so A/B can 1v1 first
    if (i === 2) {
      log("stagger MultiC — wait for A/B pair window");
      await sleep(Math.max(STAGGER, 8000));
    } else if (i > 0) {
      await sleep(STAGGER);
    }
    const page = await boot(browser, name, uid);
    pages.push(page);
  }
  observed.boot = true;

  const t0 = Date.now();
  let n = 0;
  let inviteAttempts = 0;
  let acceptTried = false;
  let stablePairTicks = 0;
  const MAX_INVITE_ATTEMPTS = 3;

  while (Date.now() - t0 < BUDGET) {
    await sleep(3000);
    n += 1;

    // Reclick Start early if still idle (not after we think matched)
    if (n === 2 || n === 5 || n === 10) {
      for (const p of pages) {
        const st0 = await snapshot(p);
        if (!st0.matchedHint) await reclickStart(p, p.__peerName);
      }
    }

    const snaps = [];
    for (const p of pages) {
      const st = await snapshot(p);
      st.peer = p.__peerName;
      st.phase = classifyPeer(st);
      snaps.push(st);
      if (st.phase === "pair_1v1_hint") observed.pair_1v1_hint = true;
      if (st.phase === "hunt_ui_hint") observed.hunt_ui_hint = true;
      if (st.phase === "multi_pc_hint") observed.multi_pc_hint = true;
      if (st.phase === "third_tile_hint") observed.third_tile_hint = true;
      if (st.findThirdToast) observed.find_third_accept_ui = true;
    }

    log(
      JSON.stringify({
        age: Date.now() - t0,
        mode,
        peers: snaps.map((s) => ({
          peer: s.peer,
          phase: s.phase,
          pcCount: s.pcCount,
          iceOk: s.iceOk,
          frames: s.hasRemoteFrames,
          stageTrio: s.stageTrio,
          stageTrioSearching: s.stageTrioSearching,
          toast: s.findThirdToast,
          body: s.bodyHint?.slice(0, 80),
        })),
      })
    );

    // Find-third only after stable mutual 1v1 (both ice/frames or matched)
    // — avoids invite while one tab is still rematching a stranger.
    if (FIND_THIRD && pages.length >= 2 && !observed.hunt_ui_hint) {
      const aSnap = snaps[0];
      const bSnap = snaps[1];
      const a = pages[0];
      const b = pages[1];
      const mutualStable =
        aSnap?.matchedHint &&
        bSnap?.matchedHint &&
        (aSnap.iceOk || aSnap.hasRemoteFrames) &&
        (bSnap.iceOk || bSnap.hasRemoteFrames);
      if (mutualStable) stablePairTicks += 1;
      else stablePairTicks = 0;

      if (
        mutualStable &&
        stablePairTicks >= 2 &&
        inviteAttempts < MAX_INVITE_ATTEMPTS &&
        !observed.find_third_accept_ui
      ) {
        // Space retries (~9s apart with 3s poll)
        if (inviteAttempts === 0 || stablePairTicks % 3 === 0) {
          inviteAttempts += 1;
          let ok = await tryFindThirdInvite(a, a.__peerName);
          if (!ok) ok = await tryFindThirdInvite(b, b.__peerName);
          if (ok) observed.find_third_invite_sent = true;
          await sleep(800);
        }
      }

      // Accept toast on either side
      for (const p of pages.slice(0, 2)) {
        const st = snaps.find((s) => s.peer === p.__peerName);
        if (st?.findThirdToast || (observed.find_third_invite_sent && !acceptTried)) {
          const acc = await tryFindThirdAccept(p, p.__peerName);
          if (acc) {
            observed.find_third_accept_ui = true;
            acceptTried = true;
          }
        }
      }
    }
  }

  // Screenshots
  for (const p of pages) {
    try {
      const shot = path.join(artDir, `${p.__peerName}-${Date.now()}.png`);
      await p.screenshot({ path: shot, fullPage: false });
      log(`screenshot ${shot}`);
    } catch (_) {}
  }

  const summary = {
    mode,
    budget_ms: BUDGET,
    find_third_enabled: FIND_THIRD,
    observed,
    honesty:
      "SCAFFOLD_DONE only — not multi product PASS; human faces still required for GOAL_MET",
    next:
      mode === "web2phone"
        ? "Human: phone joins hunt as 3rd; confirm partner still moving ≥30s"
        : "Human: verify 3-way faces if third_tile/multi_pc observed; else re-run longer BUDGET",
  };
  log("SUMMARY " + JSON.stringify(summary));
  console.log("[multi-pair] SCAFFOLD_DONE (not MULTI_PASS)");
  process.exit(0);
} catch (e) {
  if (isChurn(e)) {
    log(`WARN page churn (soft-ok): ${e.message?.slice(0, 120)}`);
    console.log("[multi-pair] SCAFFOLD_DONE soft-churn (not MULTI_PASS)");
    process.exit(0);
  }
  console.error("[multi-pair] FAIL", e?.message || e);
  for (const p of pages) {
    try {
      await p.screenshot({
        path: path.join(artDir, `fail-${p.__peerName}-${Date.now()}.png`),
      });
    } catch (_) {}
  }
  process.exit(2);
} finally {
  for (const p of pages) {
    try {
      await p.__ruletCtx?.close?.();
    } catch (_) {}
  }
  try {
    await browser.close();
  } catch (_) {}
}
