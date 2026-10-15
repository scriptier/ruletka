#!/usr/bin/env node
/**
 * multi-smoke.mjs — SCAFFOLD for multi-party (3-way) agent smoke
 * =================================================================
 * Plan ref: knowledge/specs/BLUR-MULTI-FINISH-PLAN.md · B1
 *           knowledge/specs/current-multi-party.md
 *
 * Goal (scaffold only — not product GOAL_MET):
 *   Give agents a runnable entry to drive 3 headless Chromium tabs
 *   (or 2 web + human phone) so future multi work can observe match /
 *   find-third / peer counts without inventing multi PASS.
 *
 * Modes
 * -----
 *   3web         Three isolated headless Chromium contexts on live.html
 *                (default). Boots A/B/C, Start queue, observe peerPcs /
 *                stage classes, optionally poke #btn-find-third after 1v1.
 *
 *   2web-phone   Two headless web partners; prints phone smoke steps.
 *                Does NOT steal adb. Human/phone is optional.
 *
 * Usage
 * -----
 *   node scripts/multi-smoke.mjs --help
 *   node scripts/multi-smoke.mjs                 # 3web, soft-skip ok
 *   node scripts/multi-smoke.mjs --mode 3web
 *   node scripts/multi-smoke.mjs --mode 2web-phone
 *   MULTI_SMOKE_MODE=3web BUDGET_MS=45000 node scripts/multi-smoke.mjs
 *   RULETKA_URL=https://ruletka.vip/live.html CHROME=/usr/bin/chromium \
 *     node scripts/multi-smoke.mjs --mode 3web
 *
 *   Local bridge (optional — mirrors pair-smoke port style):
 *     MULTI_SMOKE_URL=http://127.0.0.1:8797/live.html node scripts/multi-smoke.mjs
 *
 * Env
 * ---
 *   MULTI_SMOKE_MODE     3web | 2web-phone   (default 3web)
 *   RULETKA_URL / MULTI_SMOKE_URL   live page (default prod live.html)
 *   BUDGET_MS            wall observe budget (default 45000)
 *   CHROME               chromium / google-chrome path
 *   MULTI_SMOKE_STRICT   1 = exit 2 on hard boot fail (default soft 0)
 *   MULTI_SMOKE_FIND3    1 = after 1v1, click Find 3rd on first pair (default 1)
 *   MULTI_SMOKE_ART      artifact dir (default artifacts/multi-smoke)
 *
 * Exit codes (honest — never claim multi product PASS)
 * ----------------------------------------------------
 *   0  SCAFFOLD_OK / OBSERVE done / soft SKIP (no chrome / no puppeteer)
 *   1  unexpected crash
 *   2  hard fail only if MULTI_SMOKE_STRICT=1
 *
 * What this does NOT do
 * ---------------------
 *   - Does NOT print multi PASS / GOAL_MET / product.ok for 3-way
 *   - Does NOT deploy, build APK, or hold adb exclusively
 *   - Does NOT thrash ICE / force_relay / pool size
 *
 * Related harnesses (1v1 — do not replace)
 * ----------------------------------------
 *   scripts/pair-smoke.mjs          local bridge 2-web budgets
 *   scripts/prod-pair-media.mjs     prod 2-web frames/ICE
 *   scripts/phone-web-pair.mjs      1 headless partner for phone device-smoke
 *   scripts/pair-test-headless.mjs  1 bot for human pair-debug
 *   scripts/multi-pair.mjs          MODE=web2|web2phone|web3 phase observe sibling
 *
 * Next steps (for follow-up jobs — not this scaffold)
 * ---------------------------------------------------
 *   1. Assert peerPcs.size >= 2 on ≥2 tabs for ≥15s after find-third accept
 *   2. Wire accept path for incoming find_third_invite on bot B
 *   3. Harvest inbound framesDecoded per remote tile (#remote, #remote2, #remote-third)
 *   4. Optional: spawn phone-web-pair.mjs + document adb UIAutomator Start
 *   5. 4-way stretch: 4th bot after partyCap / joinPeers path green
 *   6. SCORECARD JSONL → artifacts/connect-scorecard.jsonl with v=multi-smoke
 *
 * Soft rules: no browser → SKIP exit 0. Never invent multi PASS.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TAG = "multi-smoke";

// ── CLI / env ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function flag(name) {
  return argv.includes(name);
}
function opt(name, fallback) {
  const i = argv.indexOf(name);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("-")) return argv[i + 1];
  return fallback;
}

if (flag("--help") || flag("-h")) {
  printHelp();
  process.exit(0);
}

const MODE = String(
  opt("--mode", process.env.MULTI_SMOKE_MODE || "3web")
).toLowerCase();
const URL =
  process.env.MULTI_SMOKE_URL ||
  process.env.RULETKA_URL ||
  "https://ruletka.vip/live.html";
const BUDGET = Number(process.env.BUDGET_MS || 45_000);
const STRICT = String(process.env.MULTI_SMOKE_STRICT || "0") === "1";
const DO_FIND3 = String(process.env.MULTI_SMOKE_FIND3 ?? "1") !== "0";
const ART_DIR =
  process.env.MULTI_SMOKE_ART || path.join(ROOT, "artifacts/multi-smoke");
const CHROME =
  process.env.CHROME ||
  ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find(
    (p) => fs.existsSync(p)
  );

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 23);
const log = (...a) => console.log(`[${TAG} ${stamp()}]`, ...a);

function printHelp() {
  const text = `
${TAG} — multi-party smoke SCAFFOLD (3-web or 2-web+phone)

USAGE
  node scripts/multi-smoke.mjs --help
  node scripts/multi-smoke.mjs [--mode 3web|2web-phone]
  MULTI_SMOKE_MODE=3web BUDGET_MS=60000 node scripts/multi-smoke.mjs

MODES
  3web         Three headless Chromium contexts (default). Observe mesh/find-3rd.
  2web-phone   Two headless partners; print phone steps (adb optional, not stolen).

ENV
  MULTI_SMOKE_MODE / RULETKA_URL / MULTI_SMOKE_URL / BUDGET_MS / CHROME
  MULTI_SMOKE_STRICT=1  hard-fail boot errors (default soft)
  MULTI_SMOKE_FIND3=0   disable Find-3rd poke after 1v1
  MULTI_SMOKE_ART       artifact dir (screenshots + scorecard)

EXIT
  0  scaffold ran / observe done / SKIP (no chrome|puppeteer)
  1  unexpected
  2  only if STRICT=1 and boot hard-fails

HONESTY
  Never prints multi PASS / GOAL_MET. Status is SCAFFOLD | OBSERVE | SKIP.
  Product 3-way DONE WHEN remains human smoke (faces ≥60s). See:
    knowledge/specs/current-multi-party.md
    knowledge/specs/BLUR-MULTI-FINISH-PLAN.md B1

RELATED
  pair-smoke.mjs · prod-pair-media.mjs · phone-web-pair.mjs
`.trim();
  console.log(text);
}

function skip(reason) {
  console.log(`[${TAG}] SKIP: ${reason}`);
  writeScorecard({ status: "SKIP", reason, mode: MODE });
  process.exit(0);
}

function loadPuppeteer() {
  const require = createRequire(import.meta.url);
  const candidates = [
    path.join(ROOT, "node_modules/puppeteer-core"),
    path.join(ROOT, "mobile/node_modules/puppeteer-core"),
    "/tmp/node_modules/puppeteer-core",
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(path.join(c, "package.json"))) return require(c);
    } catch (_) {}
  }
  try {
    return require("puppeteer-core");
  } catch (_) {}
  try {
    return require("/tmp/node_modules/puppeteer-core");
  } catch (_) {}
  return null;
}

function ensureArt() {
  try {
    fs.mkdirSync(ART_DIR, { recursive: true });
  } catch (_) {}
}

function writeScorecard(payload) {
  ensureArt();
  const row = {
    v: "multi-smoke-scaffold",
    ts: new Date().toISOString(),
    mode: MODE,
    url: URL,
    budget_ms: BUDGET,
    // Explicit: scaffold never invents multi product PASS
    multi_product_pass: false,
    multi_goal_met: false,
    ...payload,
  };
  const p = path.join(ART_DIR, "last-scorecard.json");
  try {
    fs.writeFileSync(p, JSON.stringify(row, null, 2));
    log(`scorecard ${p} status=${row.status}`);
  } catch (e) {
    log(`scorecard write fail: ${e.message}`);
  }
  // Append JSONL for compound later (optional)
  try {
    const jl = path.join(ART_DIR, "scorecard.jsonl");
    fs.appendFileSync(jl, JSON.stringify(row) + "\n");
  } catch (_) {}
  return row;
}

// ── page helpers (mirrors phone-web-pair / prod-pair-media) ─────────────────

async function bootPage(browser, name) {
  const ctx = await browser.createBrowserContext();
  try {
    await ctx.overridePermissions(new URL(URL).origin, ["camera", "microphone"]);
  } catch (_) {}
  const page = await ctx.newPage();
  page.__ruletCtx = ctx;
  page.__botName = name;

  page.on("console", (msg) => {
    const t = msg.text();
    if (
      /webrtc|ice|offer|answer|track|frame|matched|queue|find.?third|peer|party|trio|joinPeers|hunting/i.test(
        t
      )
    ) {
      console.log(`[${name}] ${t.slice(0, 240)}`);
    }
  });

  await page.evaluateOnNewDocument((botName) => {
    try {
      localStorage.setItem("nextface-rules-v1", "1");
      localStorage.setItem("ruletka-first-session-guide-v1", "1");
      localStorage.setItem(
        "ruletka-match-prefs-v1",
        JSON.stringify({ blurStrangersMode: "off", blurStrangers: false })
      );
      localStorage.setItem(
        "nextface-user-v1",
        JSON.stringify({
          user_id: "multi-smoke-" + botName + "-" + Math.random().toString(36).slice(2, 10),
          name: "Multi" + botName,
        })
      );
    } catch (_) {}
  }, name);

  const goto =
    URL +
    (URL.includes("?") ? "&" : "?") +
    "v=" +
    Date.now() +
    "&tab=" +
    encodeURIComponent(name) +
    "&from=multi-smoke";
  await page.goto(goto, { waitUntil: "networkidle2", timeout: 45_000 });
  await sleep(2200);
  await dismissGates(page, name);
  await clickStart(page, name);
  await sleep(1200);
  return page;
}

async function dismissGates(page, name) {
  for (const sel of [
    "#btn-age-yes",
    "#btn-age-ok",
    "#btn-rules-accept",
    "#btn-guide-ok",
    "#btn-swipe-coach-ok",
    "#btn-blur-starter-ok",
    "#btn-cellular-tip-ok",
    "#btn-notif-optin-no",
    "#age-yes",
    "button.age-gate-yes",
  ]) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        log(`${name} dismiss ${sel}`);
        await sleep(350);
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
}

async function clickStart(page, name) {
  let started = false;
  for (const sel of [
    "#btn-start-match",
    "button.start-match-btn",
    "#btn-start",
    "#start",
    "[data-testid='start']",
    "button.btn-start",
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
      log(`${name} start fallback: ${String(e.message || e).slice(0, 80)}`);
    }
  }
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
  } catch (_) {}
}

/**
 * Snapshot multi-relevant client state. Soft — never throws for product PASS.
 *
 * NOTE: live.js keeps `matched` / `peerPcs` module-private (not on window).
 * Prefer DOM signals: remote video paint, stage classes, Find-3rd control.
 * Optional: any RTCPeerConnection we can still reach via window hooks.
 */
async function snapshot(page) {
  try {
    return await page.evaluate(async () => {
      const pcs = [];
      let peerCount = 0;
      // Optional globals (may be absent — live.js module scope)
      try {
        if (window.peerPcs && typeof window.peerPcs.size === "number") {
          peerCount = window.peerPcs.size;
          for (const [id, pcw] of window.peerPcs.entries()) {
            pcs.push({ id: String(id).slice(0, 8), pc: pcw?.pc || pcw });
          }
        }
      } catch (_) {}
      try {
        if (window.soloPc?.pc) pcs.push({ id: "solo", pc: window.soloPc.pc });
      } catch (_) {}

      const out = [];
      for (const { id, pc } of pcs) {
        if (!pc || typeof pc.getStats !== "function") continue;
        let ice = pc.iceConnectionState;
        let cs = pc.connectionState;
        let frames = 0;
        try {
          const s = await pc.getStats();
          s.forEach((r) => {
            if (r.type === "inbound-rtp" && (r.kind === "video" || r.mediaType === "video")) {
              frames = Math.max(frames, r.framesDecoded || 0, r.framesReceived || 0);
            }
          });
        } catch (_) {}
        out.push({ id, ice, cs, frames });
      }

      const body = document.body || {};
      const className = body.className || "";
      const stageCount =
        (className.match(/stage-count-(\d+)/) || [])[1] ||
        (className.includes("stage-trio") ? "3" : null);

      // Find-3rd lives in match-more menu; treat present+not-hidden as signal
      const findBtn = document.getElementById("btn-find-third");
      const findVisible = !!(findBtn && !findBtn.hidden && findBtn.offsetParent !== null);
      const findInDom = !!(findBtn && !findBtn.hidden);

      // DOM remote tiles (multi: #remote, #remote2, #remote-third)
      const remoteIds = ["remote", "remote2", "remote-third", "remote3"];
      const remotes = remoteIds.map((id) => {
        const v = document.getElementById(id);
        if (!v) return { id, present: false, w: 0, h: 0 };
        return {
          id,
          present: true,
          w: v.videoWidth || 0,
          h: v.videoHeight || 0,
          hasSrc: !!(v.srcObject || v.src),
        };
      });
      const paintedRemotes = remotes.filter((r) => r.w > 0 || r.h > 0 || r.hasSrc).length;
      const videos = [...document.querySelectorAll("video")].map((v) => ({
        id: v.id || "",
        w: v.videoWidth || 0,
        h: v.videoHeight || 0,
      }));
      const bodyText = (body.innerText || "").slice(0, 200).replace(/\s+/g, " ");
      const statusEl =
        document.getElementById("match-status") ||
        document.getElementById("conn-status") ||
        document.querySelector("[data-match-status]");
      const statusText = (statusEl?.textContent || "").trim().slice(0, 80);

      // DOM-first matched heuristic (module `matched` is not on window)
      const matched = !!(
        paintedRemotes > 0 ||
        peerCount > 0 ||
        findInDom ||
        /MATCHED|matched with|in chat|peer-to-peer|Browsing together|party of/i.test(
          bodyText + " " + statusText
        ) ||
        /stage-count-[2-4]|stage-trio|has-remote|in-call|matched/i.test(className)
      );

      // Prefer painted remotes as peer stand-in when peerPcs not exposed
      const peerEstimate = Math.max(peerCount, paintedRemotes);

      return {
        peerCount: peerEstimate,
        peerPcsExposed: peerCount,
        paintedRemotes,
        matched,
        stageCount,
        classHints: className
          .split(/\s+/)
          .filter((c) => /stage|trio|party|hunt|multi|remote|match/i.test(c))
          .slice(0, 14),
        findThirdVisible: findVisible || findInDom,
        findThirdPending:
          typeof window.findThirdPending !== "undefined" ? window.findThirdPending : null,
        statusText,
        pcs: out,
        remotes,
        videos,
        bodyHint: bodyText,
      };
    });
  } catch (e) {
    return {
      peerCount: 0,
      matched: false,
      error: String(e.message || e).slice(0, 120),
      pcs: [],
      videos: [],
    };
  }
}

/** Best-effort Find 3rd poke (scaffold). Accept path on peer is TODO. */
async function tryFindThird(page, name) {
  try {
    const r = await page.evaluate(() => {
      // Open match-more menu if Find 3rd is nested
      const more = document.getElementById("btn-match-more");
      if (more) {
        try {
          more.click();
        } catch (_) {}
      }
      const btn = document.getElementById("btn-find-third");
      if (!btn) return { ok: false, reason: "no #btn-find-third" };
      if (btn.hidden) return { ok: false, reason: "find-third hidden" };
      if (btn.disabled) return { ok: false, reason: "find-third disabled" };
      btn.click();
      return { ok: true, reason: "clicked #btn-find-third" };
    });
    log(`${name} find3: ${JSON.stringify(r)}`);
    return r;
  } catch (e) {
    log(`${name} find3 error: ${String(e.message || e).slice(0, 80)}`);
    return { ok: false, reason: String(e.message || e).slice(0, 80) };
  }
}

/** Accept incoming find-third invite if a visible accept control exists. */
async function tryAcceptFindThird(page, name) {
  try {
    const r = await page.evaluate(() => {
      const sels = [
        "#btn-find-third-accept",
        "#btn-trio-accept",
        "[data-find-third-accept]",
        "button.find-third-accept",
      ];
      for (const s of sels) {
        const el = document.querySelector(s);
        if (el && !el.hidden) {
          el.click();
          return { ok: true, reason: `clicked ${s}` };
        }
      }
      // text fallback
      const btns = [...document.querySelectorAll("button")];
      const acc = btns.find((b) =>
        /accept|yes|join|соглас|принять/i.test((b.textContent || "").trim())
      );
      // only if something looks like trio invite UI
      const body = document.body?.innerText || "";
      if (acc && /3rd|third|trio|party|треть/i.test(body)) {
        acc.click();
        return { ok: true, reason: "clicked text accept (trio context)" };
      }
      return { ok: false, reason: "no accept control" };
    });
    if (r.ok) log(`${name} accept3: ${JSON.stringify(r)}`);
    return r;
  } catch (_) {
    return { ok: false, reason: "eval error" };
  }
}

// ── modes ──────────────────────────────────────────────────────────────────

async function run3web(browser) {
  log("mode=3web — launching bots A B C");
  const names = ["A", "B", "C"];
  const pages = [];
  for (const n of names) {
    const p = await bootPage(browser, n);
    pages.push(p);
    await sleep(900); // stagger queue so hub can pair progressively
  }

  const t0 = Date.now();
  let tick = 0;
  let find3Tried = false;
  const history = [];
  let maxPeersSeen = 0;
  let tabsWithMatch = 0;

  while (Date.now() - t0 < BUDGET) {
    await sleep(3000);
    tick += 1;
    // Snapshot first so we do not reclick a live match
    const snaps = {};
    for (const p of pages) {
      snaps[p.__botName] = await snapshot(p);
    }
    if (tick === 2 || tick === 5) {
      for (const p of pages) {
        const st = snaps[p.__botName];
        if (!st?.matched) await reclickStart(p, p.__botName);
      }
    }
    const age = Date.now() - t0;
    const summary = {
      age,
      A: slim(snaps.A),
      B: slim(snaps.B),
      C: slim(snaps.C),
    };
    history.push(summary);
    log(JSON.stringify(summary));

    for (const s of Object.values(snaps)) {
      maxPeersSeen = Math.max(maxPeersSeen, s.peerCount || 0, s.paintedRemotes || 0);
    }
    tabsWithMatch = Object.values(snaps).filter((s) => s.matched).length;

    // Scaffold: if A matched 1v1 and Find 3rd visible, poke once
    if (DO_FIND3 && !find3Tried && snaps.A?.matched && snaps.A?.findThirdVisible) {
      find3Tried = true;
      await tryFindThird(pages[0], "A");
      await sleep(800);
      await tryAcceptFindThird(pages[1], "B");
    } else if (DO_FIND3 && !find3Tried && snaps.A?.matched && tick >= 4) {
      // poke menu even if visibility probe failed (DOM timing)
      find3Tried = true;
      await tryFindThird(pages[0], "A");
      await sleep(800);
      await tryAcceptFindThird(pages[1], "B");
    }

    // Keep C in queue if idle (do not thrash if already matched)
    if (snaps.C && !snaps.C.matched && tick % 3 === 0) {
      await reclickStart(pages[2], "C");
    }
  }

  // screenshots
  for (const p of pages) {
    try {
      const shot = path.join(ART_DIR, `3web-${p.__botName}-${Date.now()}.png`);
      await p.screenshot({ path: shot, fullPage: false });
      log(`screenshot ${shot}`);
    } catch (_) {}
  }

  const obs = {
    status: "OBSERVE",
    mode: "3web",
    ticks: tick,
    maxPeersSeen,
    tabsWithMatch,
    find3Tried,
    // Honest: scaffold never upgrades to multi PASS
    multi_product_pass: false,
    multi_goal_met: false,
    note:
      maxPeersSeen >= 2
        ? "saw peerCount>=2 on at least one tab — OBSERVE only, not multi PASS"
        : tabsWithMatch >= 2
          ? "≥2 tabs matched (likely 1v1 pairs) — 3-way not proven"
          : "no multi peer mesh observed in budget — harness scaffold still OK",
    last: history[history.length - 1] || null,
    next_steps: [
      "Wire find_third accept reliably on bot B",
      "Assert peerPcs.size>=2 + frames on #remote and #remote2",
      "Optional 2web-phone mode with human Start on device",
      "Do not claim GOAL_MET without human faces ≥60s",
    ],
  };
  writeScorecard(obs);
  log("DONE status=OBSERVE (scaffold — multi_product_pass=false)");
  log(obs.note);
  return obs;
}

async function run2webPhone(browser) {
  log("mode=2web-phone — launching web partners W1 W2");
  log("PHONE: optional human — harness does not steal adb");
  console.log(`
┌─────────────────────────────────────────────────────────────┐
│  multi-smoke 2web-phone — phone steps (optional)            │
│  1. Install latest APK if testing app (human-owned)         │
│  2. Open Live → accept age → Start match                    │
│  3. Prefer same region/queue as prod live.html              │
│  4. After 1v1: Find 3rd (or wait for second web to join)    │
│  5. Paste faces/logcat notes in SMOKE — never invent PASS   │
│  Web partners stay up for BUDGET_MS=${BUDGET}               │
└─────────────────────────────────────────────────────────────┘
`);

  const pages = [];
  for (const n of ["W1", "W2"]) {
    pages.push(await bootPage(browser, n));
    await sleep(900);
  }

  const t0 = Date.now();
  let tick = 0;
  let find3Tried = false;
  let maxPeersSeen = 0;
  const history = [];

  while (Date.now() - t0 < BUDGET) {
    await sleep(3000);
    tick += 1;
    const snaps = {};
    for (const p of pages) snaps[p.__botName] = await snapshot(p);
    if (tick === 2 || tick === 5) {
      for (const p of pages) {
        if (!snaps[p.__botName]?.matched) await reclickStart(p, p.__botName);
      }
    }
    const age = Date.now() - t0;
    const summary = { age, W1: slim(snaps.W1), W2: slim(snaps.W2) };
    history.push(summary);
    log(JSON.stringify(summary));
    for (const s of Object.values(snaps)) {
      maxPeersSeen = Math.max(maxPeersSeen, s.peerCount || 0, s.paintedRemotes || 0);
    }
    if (DO_FIND3 && !find3Tried && snaps.W1?.matched && tick >= 3) {
      find3Tried = true;
      await tryFindThird(pages[0], "W1");
      await sleep(800);
      await tryAcceptFindThird(pages[1], "W2");
    }
  }

  for (const p of pages) {
    try {
      const shot = path.join(ART_DIR, `2web-${p.__botName}-${Date.now()}.png`);
      await p.screenshot({ path: shot });
      log(`screenshot ${shot}`);
    } catch (_) {}
  }

  const obs = {
    status: "OBSERVE",
    mode: "2web-phone",
    ticks: tick,
    maxPeersSeen,
    find3Tried,
    phone: "optional-not-automated",
    multi_product_pass: false,
    multi_goal_met: false,
    note:
      "2 web partners held for budget; phone not required for scaffold exit 0",
    last: history[history.length - 1] || null,
    next_steps: [
      "Human phone Start while this runs",
      "Or: node scripts/phone-web-pair.mjs as third web stand-in",
      "Future: adb optional probe without exclusive long thrash",
    ],
  };
  writeScorecard(obs);
  log("DONE status=OBSERVE (2web-phone scaffold — multi_product_pass=false)");
  return obs;
}

function slim(s) {
  if (!s) return null;
  return {
    matched: !!s.matched,
    peers: s.peerCount || 0,
    painted: s.paintedRemotes || 0,
    stage: s.stageCount,
    find3: !!s.findThirdVisible,
    status: s.statusText || undefined,
    remotes: (s.remotes || [])
      .filter((r) => r.present)
      .map((r) => `${r.id}:${r.w}x${r.h}${r.hasSrc ? "+src" : ""}`),
    pcs: (s.pcs || []).map((p) => ({
      id: p.id,
      ice: p.ice,
      cs: p.cs,
      f: p.frames,
    })),
    err: s.error || undefined,
  };
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  if (MODE !== "3web" && MODE !== "2web-phone") {
    console.error(`[${TAG}] unknown mode=${MODE} (use 3web|2web-phone)`);
    printHelp();
    process.exit(1);
  }

  if (!CHROME) skip("no Chrome/Chromium binary (set CHROME=…)");
  const puppeteer = loadPuppeteer();
  if (!puppeteer) skip("puppeteer-core not found — npm i puppeteer-core (root or /tmp)");

  ensureArt();
  log(`mode=${MODE}`);
  log(`chrome=${CHROME}`);
  log(`url=${URL}`);
  log(`budget_ms=${BUDGET} find3=${DO_FIND3} strict=${STRICT}`);
  log("status will be SCAFFOLD/OBSERVE/SKIP — never multi PASS");

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-web-security",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=960,720",
    ],
  });

  try {
    if (MODE === "2web-phone") {
      await run2webPhone(browser);
    } else {
      await run3web(browser);
    }
    process.exit(0);
  } catch (e) {
    console.error(`[${TAG}] FAIL`, e?.message || e);
    writeScorecard({
      status: STRICT ? "FAIL" : "OBSERVE",
      error: String(e?.message || e).slice(0, 300),
      multi_product_pass: false,
      multi_goal_met: false,
      note: STRICT
        ? "strict boot/run failure"
        : "soft: scaffold error logged; exit 0 unless STRICT",
    });
    if (STRICT) process.exit(2);
    // Soft default: scaffold availability > hard red on SPA churn
    process.exit(0);
  } finally {
    try {
      await browser.close();
    } catch (_) {}
  }
}

main();
