/**
 * Headless Chromium peer for live pair-debug with a human on ruletka.vip.
 *
 *   WAIT_MS=300000 node scripts/pair-test-headless.mjs
 */
import fs from "node:fs";
import puppeteer from "/tmp/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";

const URL = process.env.PAIR_URL || "https://ruletka.vip/live.html?pairtest=1";
const WAIT_MS = Number(process.env.WAIT_MS || 300_000);
const CHROME =
  process.env.CHROME ||
  (fs.existsSync("/usr/bin/google-chrome")
    ? "/usr/bin/google-chrome"
    : "/usr/bin/chromium");

const stamp = () => new Date().toISOString().slice(11, 23);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BOT_UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1";

async function main() {
  console.log(`[pair] chrome=${CHROME}`);
  console.log(`[pair] url=${URL}`);
  console.log(
    `[pair] wait=${WAIT_MS}ms — YOU: hard-refresh live.html → Start match → stay (do not spam Next)`
  );

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
      "--window-size=960,720",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 720 });

  page.on("console", (msg) => {
    const t = msg.text();
    if (
      /webrtc|force.?relay|matched|ICE|ice|offer|answer|signal|path:|TURN|conn|glare|relay|error|failed|connected|checking|settling/i.test(
        t
      )
    ) {
      console.log(`[page ${stamp()}] ${t.slice(0, 500)}`);
    }
  });
  page.on("pageerror", (e) => console.log(`[pageerr] ${e.message}`));

  await page.evaluateOnNewDocument((uid) => {
    try {
      localStorage.setItem(
        "nextface-user-v1",
        JSON.stringify({ user_id: uid, name: "PairBot" })
      );
      // live.js RULES_KEY / first-session guide
      localStorage.setItem("nextface-rules-v1", "1");
      localStorage.setItem("ruletka-first-session-guide-v1", "1");
    } catch (_) {}
  }, BOT_UID);

  console.log(`[pair ${stamp()}] loading…`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await sleep(4000);

  try {
    const ctx = browser.defaultBrowserContext();
    await ctx.overridePermissions(new URL(URL).origin, [
      "camera",
      "microphone",
    ]);
  } catch (_) {}

  const deploy = await page.evaluate(async () => {
    try {
      return await (await fetch("/deploy.json", { cache: "no-store" })).json();
    } catch (e) {
      return { err: String(e) };
    }
  });
  console.log(`[pair] deploy`, deploy);

  // Dismiss common modals then start match
  async function clickStart() {
    return page.evaluate(() => {
      const dismissIds = [
        "btn-rules-accept",
        "btn-age-ok",
        "btn-guide-ok",
        "btn-swipe-coach-ok",
        "btn-blur-starter-ok",
        "btn-cellular-tip-ok",
        "btn-notif-optin-no",
      ];
      for (const id of dismissIds) {
        const el = document.getElementById(id);
        if (el && el.offsetParent !== null) el.click();
      }
      const start = document.getElementById("btn-start-match");
      if (start && !start.disabled) {
        start.click();
        return "btn-start-match";
      }
      const next = document.getElementById("btn-next");
      if (next && !next.disabled && next.offsetParent !== null) {
        next.click();
        return "btn-next";
      }
      return null;
    });
  }

  let c = await clickStart();
  console.log(`[pair ${stamp()}] click: ${c || "none"}`);
  // Do NOT re-click Start after match — that thrash was killing SDP.

  // Hook RTCPeerConnection for ICE logging
  await page.evaluate(() => {
    const Orig = window.RTCPeerConnection;
    if (!Orig || Orig.__pairHooked) return;
    function Hooked(cfg) {
      console.info(
        "[pairhook] new PC iceTransportPolicy=" +
          (cfg && cfg.iceTransportPolicy) +
          " servers=" +
          (cfg && cfg.iceServers ? cfg.iceServers.length : 0)
      );
      const pc = new Orig(cfg);
      pc.addEventListener("iceconnectionstatechange", () => {
        console.info("[pairhook] ice=" + pc.iceConnectionState);
      });
      pc.addEventListener("connectionstatechange", () => {
        console.info("[pairhook] cs=" + pc.connectionState);
      });
      pc.addEventListener("track", (ev) => {
        console.info(
          "[pairhook] track kind=" +
            (ev.track && ev.track.kind) +
            " streams=" +
            (ev.streams ? ev.streams.length : 0)
        );
      });
      window.__lastPc = pc;
      return pc;
    }
    Hooked.prototype = Orig.prototype;
    Object.keys(Orig).forEach((k) => {
      try {
        Hooked[k] = Orig[k];
      } catch (_) {}
    });
    Hooked.__pairHooked = true;
    window.RTCPeerConnection = Hooked;
  });

  const t0 = Date.now();
  let last = "";
  let success = false;

  while (Date.now() - t0 < WAIT_MS) {
    const snap = await page.evaluate(async () => {
      const body = document.body;
      const logEl =
        document.getElementById("log") ||
        document.querySelector(".debug-log, #event-log");
      const logText = (logEl && logEl.innerText) || "";
      const lastLog = logText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(-6);
      const remote =
        document.getElementById("remote-video") ||
        document.querySelector("video.remote, #remote video, video#remote");
      let remoteOk = false;
      let remoteTracks = 0;
      try {
        const s = remote && remote.srcObject;
        if (s && s.getTracks) {
          remoteTracks = s.getTracks().filter((t) => t.readyState === "live")
            .length;
          remoteOk = s.getVideoTracks().some((t) => t.readyState === "live");
        }
      } catch (_) {}
      let ice = null;
      let cs = null;
      const pc = window.__lastPc;
      if (pc) {
        ice = pc.iceConnectionState;
        cs = pc.connectionState;
      }
      let icePath = null;
      try {
        if (pc && typeof window.getIcePathKind === "function") {
          icePath = await window.getIcePathKind(pc);
        }
      } catch (_) {}
      const startHidden = (() => {
        const b = document.getElementById("btn-start-match");
        return !b || b.hidden || b.offsetParent === null;
      })();
      return {
        remoteOk,
        remoteTracks,
        ice,
        cs,
        icePath,
        forceRelay:
          typeof window.sessionForceRelayEnabled === "function"
            ? window.sessionForceRelayEnabled()
            : null,
        startHidden,
        lastLog,
        emptyTitle: document
          .querySelector("#remote-empty .empty-title, .empty-title")
          ?.textContent?.trim()
          ?.slice(0, 80),
      };
    });

    const line = JSON.stringify(snap);
    if (line !== last) {
      console.log(`[pair ${stamp()}]`, snap);
      last = line;
    }
    if (snap.remoteOk || snap.cs === "connected") {
      console.log(`[pair ${stamp()}] SUCCESS media/conn`, snap);
      success = true;
      // Hold a bit so we can inspect TURN
      await sleep(8000);
      break;
    }

    // Re-click Start only while idle (not matched / not searching)
    if (
      !snap.startHidden &&
      !snap.remoteOk &&
      snap.emptyTitle &&
      /tap start|start to begin/i.test(String(snap.emptyTitle)) &&
      (Date.now() - t0) % 15_000 < 2500
    ) {
      const again = await clickStart();
      if (again) console.log(`[pair ${stamp()}] reclick ${again}`);
    }

    await sleep(2000);
  }

  try {
    await page.screenshot({
      path: "/home/drakosik/freenet-roulette/mobile/artifacts/pair-test-last.png",
    });
    console.log("[pair] screenshot saved");
  } catch (e) {
    console.log("[pair] screenshot failed", e.message);
  }

  await browser.close();
  console.log(`[pair ${stamp()}] done success=${success}`);
  process.exit(success ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
