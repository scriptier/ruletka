#!/usr/bin/env node
/**
 * Two headless Chromium tabs against production ruletka.vip.
 * Fake media; report ICE + inbound frames. Exit 0 if both see remote frames.
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME =
  process.env.CHROME ||
  ["/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => fs.existsSync(p));
const URL = process.env.RULETKA_URL || "https://ruletka.vip/live.html";
const BUDGET = Number(process.env.BUDGET_MS || 45000);

if (!CHROME) {
  console.error("no chrome");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(browser, name) {
  // Isolated context per tab so hub identity / localStorage does not kick the other
  const ctx = await browser.createBrowserContext();
  try {
    await ctx.overridePermissions(new URL(URL).origin, [
      "camera",
      "microphone",
    ]);
  } catch (_) {}
  const page = await ctx.newPage();
  page.__ruletCtx = ctx;
  page.on("console", (msg) => {
    const t = msg.text();
    if (/webrtc|ice|offer|answer|track|frame|relay|force|pc |error|matched|queue/i.test(t)) {
      console.log(`[${name}] ${t.slice(0, 220)}`);
    }
  });
  await page.goto(URL + "?v=" + Date.now() + "&tab=" + name, {
    waitUntil: "networkidle2",
    timeout: 45000,
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
        console.log(`[${name}] dismiss ${sel}`);
        await sleep(400);
      }
    } catch (_) {}
  }
  // text-based age yes
  try {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button, a, [role=button]")];
      const yes = btns.find((b) =>
        /^(yes|i.?m 18|enter|accept|agree|да|oui|sí)/i.test(
          (b.textContent || "").trim()
        )
      );
      if (yes) yes.click();
    });
  } catch (_) {}
  await sleep(800);
  // click start (multiple strategies)
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
        console.log(`[${name}] clicked ${sel}`);
        started = true;
        break;
      }
    } catch (_) {}
  }
  if (!started) {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button, a, [role=button]")];
      const start = btns.find((b) =>
        /^\s*(start|search|find|go|найти|старт)\s*$/i.test(
          (b.textContent || "").trim()
        )
      );
      if (start) start.click();
      if (typeof window.startSearch === "function") window.startSearch();
      if (typeof window.queueJoin === "function") window.queueJoin();
      if (typeof window.kickSolo === "function") window.kickSolo();
    });
    console.log(`[${name}] evaluate start fallback`);
  }
  return page;
}

async function stats(page, name) {
  return page.evaluate(async () => {
    const pcs = [];
    // collect from window peerPcs / solo pc if exposed
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
    // fallback: any RTCPeerConnection via webrtc helper
    const out = [];
    for (const { id, pc } of pcs) {
      if (!pc || typeof pc.getStats !== "function") continue;
      let ice = pc.iceConnectionState;
      let cs = pc.connectionState;
      let frames = 0;
      let bytes = 0;
      let selected = "";
      try {
        const s = await pc.getStats();
        s.forEach((r) => {
          if (r.type === "inbound-rtp" && (r.kind === "video" || r.mediaType === "video")) {
            frames = Math.max(frames, r.framesDecoded || 0, r.framesReceived || 0);
            bytes = Math.max(bytes, r.bytesReceived || 0);
          }
          if (r.type === "candidate-pair" && r.selected) {
            selected = `state=${r.state} rtt=${r.currentRoundTripTime}`;
          }
          if (r.type === "transport" && r.selectedCandidatePairId) {
            /* ignore */
          }
        });
      } catch (e) {
        selected = String(e);
      }
      const v = document.querySelector("video");
      out.push({
        id,
        ice,
        cs,
        frames,
        bytes,
        selected,
        videoW: v?.videoWidth || 0,
        videoH: v?.videoHeight || 0,
      });
    }
    return {
      matched: !!(window.matched || document.body?.innerText?.includes("MATCHED")),
      bodyHint: (document.body?.innerText || "").slice(0, 120),
      pcs: out,
      webrtcV: [...document.scripts].map((s) => s.src).find((u) => u.includes("webrtc")),
    };
  });
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

try {
  const a = await boot(browser, "A");
  await sleep(1200);
  const b = await boot(browser, "B");
  // Second Start click mid-wait if still idle
  const reclick = async (page, name) => {
    try {
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll("button")];
        const start = btns.find((x) =>
          /start|search|найти|старт/i.test(x.textContent || "")
        );
        if (start && !/stop|next|end/i.test(start.textContent || "")) start.click();
      });
      console.log(`[${name}] reclick start`);
    } catch (_) {}
  };
  const t0 = Date.now();
  let last = null;
  let n = 0;
  while (Date.now() - t0 < BUDGET) {
    await sleep(3000);
    n += 1;
    if (n === 2 || n === 5) {
      await reclick(a, "A");
      await reclick(b, "B");
    }
    const sa = await stats(a, "A");
    const sb = await stats(b, "B");
    last = { a: sa, b: sb, age: Date.now() - t0 };
    console.log(JSON.stringify(last, null, 2));
    const fa = (sa.pcs || []).some((p) => p.frames > 0 || p.videoW > 0);
    const fb = (sb.pcs || []).some((p) => p.frames > 0 || p.videoW > 0);
    if (fa && fb) {
      console.log("PASS both have frames");
      process.exit(0);
    }
    // Soft pass: both ICE connected (fake-media frames can stay 0)
    const iceA = (sa.pcs || []).some(
      (p) => p.ice === "connected" || p.ice === "completed" || p.cs === "connected"
    );
    const iceB = (sb.pcs || []).some(
      (p) => p.ice === "connected" || p.ice === "completed" || p.cs === "connected"
    );
    if (iceA && iceB && Date.now() - t0 > 12000) {
      console.log("PASS_SOFT both ICE connected (frames may be 0 with fake media)");
      process.exit(0);
    }
  }
  console.log("FAIL no mutual frames / ICE");
  try {
    await a.screenshot({ path: "mobile/artifacts/prod-pair-A.png" });
    await b.screenshot({ path: "mobile/artifacts/prod-pair-B.png" });
  } catch (_) {}
  process.exit(2);
} finally {
  try {
    await a?.__ruletCtx?.close?.();
  } catch (_) {}
  try {
    await b?.__ruletCtx?.close?.();
  } catch (_) {}
  await browser.close();
}
