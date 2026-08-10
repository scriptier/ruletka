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
  const page = await browser.newPage();
  page.on("console", (msg) => {
    const t = msg.text();
    if (/webrtc|ice|offer|answer|track|frame|relay|force|pc |error/i.test(t)) {
      console.log(`[${name}] ${t.slice(0, 200)}`);
    }
  });
  await page.goto(URL + "?v=" + Date.now(), {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await sleep(2000);
  // dismiss age / rules if present
  for (const sel of [
    "#age-yes",
    "#age-confirm",
    "button#age-accept",
    "[data-age-ok]",
    "#rules-accept",
    "button.rules-accept",
  ]) {
    try {
      const el = await page.$(sel);
      if (el) await el.click();
    } catch (_) {}
  }
  await sleep(500);
  // click start
  for (const sel of ["#btn-start", "#start", "button.start", "[data-start]"]) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        console.log(`[${name}] clicked ${sel}`);
        break;
      }
    } catch (_) {}
  }
  // try evaluate start
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const start = btns.find((b) =>
      /start|search|find|go/i.test(b.textContent || "")
    );
    if (start) start.click();
    if (typeof window.startSearch === "function") window.startSearch();
    if (typeof window.queueJoin === "function") window.queueJoin();
  });
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
  ],
});

try {
  const a = await boot(browser, "A");
  await sleep(800);
  const b = await boot(browser, "B");
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < BUDGET) {
    await sleep(3000);
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
  }
  console.log("FAIL no mutual frames");
  // screenshots
  await a.screenshot({ path: "mobile/artifacts/prod-pair-A.png" });
  await b.screenshot({ path: "mobile/artifacts/prod-pair-B.png" });
  process.exit(2);
} finally {
  await browser.close();
}
