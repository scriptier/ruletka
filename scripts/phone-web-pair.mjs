#!/usr/bin/env node
/**
 * ONE headless Chromium tab against production live.html with fake media.
 * Acts as a match partner so a physical phone can pair during device smoke.
 *
 * Patterns mirrored from scripts/prod-pair-media.mjs (boot, age dismiss, Start).
 * Soft-skips if puppeteer-core or Chrome is unavailable (exit 0).
 *
 * Usage:
 *   node scripts/phone-web-pair.mjs
 *   RULETKA_URL=https://ruletka.vip/live.html BUDGET_MS=60000 node scripts/phone-web-pair.mjs
 *   CHROME=/usr/bin/chromium node scripts/phone-web-pair.mjs
 *
 * Env:
 *   RULETKA_URL   default https://ruletka.vip/live.html
 *   BUDGET_MS     how long to stay in queue/match (default 60000)
 *   CHROME        path to chromium/google-chrome
 *
 * Exit: 0 stay complete or soft-skip; 1 unexpected; 2 hard fail after boot
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.env.RULETKA_URL || "https://ruletka.vip/live.html";
const BUDGET = Number(process.env.BUDGET_MS || 60_000);
const CHROME =
  process.env.CHROME ||
  ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find(
    (p) => fs.existsSync(p)
  );

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 23);
const log = (...a) => console.log(`[phone-web-pair ${stamp()}]`, ...a);

function skip(reason) {
  console.log(`[phone-web-pair] SKIP: ${reason}`);
  process.exit(0);
}

if (!CHROME) skip("no Chrome/Chromium binary (set CHROME=…)");

/** Resolve puppeteer-core from common install locations (same as pair-smoke). */
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

async function boot(browser, name) {
  const ctx = await browser.createBrowserContext();
  try {
    await ctx.overridePermissions(new URL(URL).origin, ["camera", "microphone"]);
  } catch (_) {}
  const page = await ctx.newPage();
  page.__ruletCtx = ctx;
  page.on("console", (msg) => {
    const t = msg.text();
    if (/webrtc|ice|offer|answer|track|frame|relay|force|pc |error|matched|queue/i.test(t)) {
      console.log(`[${name}] ${t.slice(0, 220)}`);
    }
  });

  // Seed prefs so we skip blur / first-session friction (local pair-smoke style)
  await page.evaluateOnNewDocument(() => {
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
          user_id: "phone-web-pair-" + Math.random().toString(36).slice(2, 10),
          name: "WebPair",
        })
      );
    } catch (_) {}
  });

  await page.goto(URL + "?v=" + Date.now() + "&tab=" + name + "&from=phone-web-pair", {
    waitUntil: "networkidle2",
    timeout: 45_000,
  });
  await sleep(2500);

  // dismiss age / rules if present
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
        log(`dismiss ${sel}`);
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
  await sleep(800);

  // click start
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
        log(`clicked ${sel}`);
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
      log("evaluate start fallback");
    } catch (e) {
      log(`start fallback churn (ok if navigated): ${e.message?.slice(0, 80)}`);
    }
  }
  // Start may trigger soft navigation / SPA remount — wait for settle
  await sleep(1500);
  try {
    await page.waitForFunction(() => document.readyState === "complete", {
      timeout: 8000,
    });
  } catch (_) {}
  return page;
}

function isChurn(err) {
  return /detached|Target closed|Session closed|Execution context was destroyed|frame was detached/i.test(
    String(err?.message || err)
  );
}

async function reclickStart(page) {
  try {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const start = btns.find((x) =>
        /start|search|найти|старт/i.test(x.textContent || "")
      );
      if (start && !/stop|next|end/i.test(start.textContent || "")) start.click();
    });
    log("reclick start");
  } catch (e) {
    if (isChurn(e)) log(`reclick skipped (page churn): ${e.message?.slice(0, 80)}`);
  }
}

async function snapshot(page) {
  try {
    return await page.evaluate(async () => {
      const pcs = [];
      try {
        if (window.peerPcs) {
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
        const v = document.querySelector("video");
        out.push({
          id,
          ice,
          cs,
          frames,
          videoW: v?.videoWidth || 0,
          videoH: v?.videoHeight || 0,
        });
      }
      const body = document.body?.innerText || "";
      return {
        matched: !!(window.matched || /MATCHED|matched|in chat|connected/i.test(body)),
        bodyHint: body.slice(0, 140).replace(/\s+/g, " "),
        pcs: out,
      };
    });
  } catch (e) {
    if (isChurn(e)) {
      return { matched: false, bodyHint: `(page churn) ${e.message?.slice(0, 60)}`, pcs: [] };
    }
    throw e;
  }
}

const artDir = path.join(ROOT, "mobile/artifacts/device-smoke");
try {
  fs.mkdirSync(artDir, { recursive: true });
} catch (_) {}

log(`chrome=${CHROME}`);
log(`url=${URL} budget_ms=${BUDGET}`);

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

let page;
try {
  page = await boot(browser, "phone-web");
  const t0 = Date.now();
  let n = 0;
  let sawMatch = false;
  while (Date.now() - t0 < BUDGET) {
    await sleep(3000);
    n += 1;
    if (n === 2 || n === 5 || n === 10) {
      await reclickStart(page);
    }
    const st = await snapshot(page);
    log(JSON.stringify({ age: Date.now() - t0, ...st }));
    const frames = (st.pcs || []).some((p) => p.frames > 0 || p.videoW > 0);
    const iceOk = (st.pcs || []).some(
      (p) => p.ice === "connected" || p.ice === "completed" || p.cs === "connected"
    );
    if (st.matched || frames || iceOk) {
      sawMatch = true;
      log(
        frames
          ? "partner has remote frames (phone likely matched)"
          : iceOk
            ? "ICE connected (fake media may report 0 frames)"
            : "matched flag / body hint"
      );
    }
  }
  try {
    const shot = path.join(artDir, `web-pair-${Date.now()}.png`);
    await page.screenshot({ path: shot });
    log(`screenshot ${shot}`);
  } catch (_) {}
  if (sawMatch) {
    log("DONE (saw match/ICE/frames during budget)");
  } else {
    log("DONE (budget elapsed — may still help phone if both in queue)");
  }
  process.exit(0);
} catch (e) {
  // Detached frame after Start is often harmless SPA churn — soft-ok so
  // device-smoke background partner does not die mid-queue.
  if (isChurn(e)) {
    log(`WARN page churn after boot (continuing as soft-ok): ${e.message?.slice(0, 120)}`);
    process.exit(0);
  }
  console.error("[phone-web-pair] FAIL", e?.message || e);
  try {
    if (page) {
      await page.screenshot({
        path: path.join(artDir, `web-pair-fail-${Date.now()}.png`),
      });
    }
  } catch (_) {}
  process.exit(2);
} finally {
  try {
    await page?.__ruletCtx?.close?.();
  } catch (_) {}
  try {
    await browser.close();
  } catch (_) {}
}
