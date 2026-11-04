/**
 * Headless check for the genital detector + auto-ban (2026-11-04). Local only.
 *
 *   CHROME=/usr/bin/chromium FACE_Y4M=/tmp/face.y4m SAFE_DIR=/tmp/safe \
 *     BASE=http://127.0.0.1:8979 SHOTS=/tmp/genital-shots node scripts/genital-ban-headless.mjs
 *
 * Part 1 (real model, SAFE images only): load time, per-frame inference time,
 *   and the genital score on every image in SAFE_DIR (faces, swimwear torsos)
 *   plus synthetic frames (black, dark room, noise, skin-tone fill). Any
 *   genital score >= DET_WEAK on these is a false positive.
 * Part 2 (stubbed detector, NO explicit imagery): two face peers match; the
 *   viewer's model file is blocked and a fake ORT session returning a synthetic
 *   genital box is injected. Expect: blur, two genital_hit, hub ban, viewer
 *   notice "Собеседник заблокирован за нарушение правил", offender ban screen,
 *   and the ban screen again after the offender reloads.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const t of ["playwright", `${process.env.HOME}/.local/share/mise/installs/npm-playwright/latest/node_modules/playwright`]) {
    try {
      return require(t);
    } catch (_) {}
  }
  throw new Error("playwright not found");
}
const { chromium } = loadPlaywright();

const BASE = process.env.BASE || "http://127.0.0.1:8979";
const FACE_Y4M = process.env.FACE_Y4M;
const SAFE_DIR = process.env.SAFE_DIR || "";
const SHOTS = process.env.SHOTS || "/tmp/genital-shots";
const CHROME = process.env.CHROME || undefined;
const PART = process.env.PART || "all";
fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}
const BASE_ARGS = [
  "--no-sandbox",
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  "--autoplay-policy=no-user-gesture-required",
  "--disable-dev-shm-usage",
  // two headless browsers on one host: plain host candidates, no mDNS
  "--disable-features=WebRtcHideLocalIpsWithMdns",
];
const bench = {};

async function part1() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: BASE_ARGS });
  const ctx = await browser.newContext();
  const imgs = [];
  if (SAFE_DIR && fs.existsSync(SAFE_DIR)) {
    for (const f of fs.readdirSync(SAFE_DIR).sort()) {
      if (/\.(jpe?g|png)$/i.test(f)) imgs.push(f);
    }
  }
  await ctx.route(`${BASE}/__genital_bench.html`, (r) =>
    r.fulfill({ contentType: "text/html", body: "<!doctype html><title>bench</title><body></body>" })
  );
  await ctx.route(`${BASE}/__safe/**`, (r) => {
    const f = decodeURIComponent(new URL(r.request().url()).pathname.replace("/__safe/", ""));
    r.fulfill({ path: path.join(SAFE_DIR, path.basename(f)) });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[bench] pageerror ${e.message}`));
  await page.goto(`${BASE}/__genital_bench.html`);
  const cdp = await ctx.newCDPSession(page);
  // lite_1thread / normal at full speed, then 4x and 6x CPU throttling as a
  // rough stand-in for mid / low-end Android phones (an estimate, not a phone).
  for (const [lite, throttle] of [[true, 1], [false, 1], [true, 4], [true, 6]]) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
    const r = await page.evaluate(
      async ({ imgs, lite }) => {
        delete window.RuletkaGenitalGuard;
        delete window.ort;
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = `/genital-guard.js?v=bench${Date.now()}`;
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
        });
        const G = window.RuletkaGenitalGuard;
        const t0 = performance.now();
        const ok = await G.load({ lite });
        const wall = Math.round(performance.now() - t0);
        if (!ok) return { error: "load failed", stats: G.stats };
        const out = [];
        const synth = (name, paint) => {
          const c = document.createElement("canvas");
          c.width = 640;
          c.height = 480;
          paint(c.getContext("2d"), c);
          return { name, el: c };
        };
        const frames = [
          synth("black", (x) => {
            x.fillStyle = "#000";
            x.fillRect(0, 0, 640, 480);
          }),
          synth("dark-room", (x) => {
            const g = x.createRadialGradient(320, 200, 10, 320, 240, 400);
            g.addColorStop(0, "#3a2e26");
            g.addColorStop(1, "#050404");
            x.fillStyle = g;
            x.fillRect(0, 0, 640, 480);
          }),
          synth("noise", (x) => {
            const d = x.createImageData(640, 480);
            for (let i = 0; i < d.data.length; i++) d.data[i] = (Math.random() * 255) | 0;
            x.putImageData(d, 0, 0);
          }),
          synth("skin-fill", (x) => {
            x.fillStyle = "#d9a88a";
            x.fillRect(0, 0, 640, 480);
            x.fillStyle = "#b9846a";
            x.beginPath();
            x.ellipse(320, 300, 120, 160, 0, 0, Math.PI * 2);
            x.fill();
          }),
        ];
        for (const f of imgs) {
          const im = new Image();
          im.src = `/__safe/${encodeURIComponent(f)}`;
          await im.decode();
          frames.push({ name: f, el: im });
        }
        // warm-up (first run compiles kernels)
        const w0 = performance.now();
        await G.detect(frames[0].el);
        const warm = Math.round(performance.now() - w0);
        for (const f of frames) {
          const times = [];
          let det = null;
          for (let i = 0; i < 3; i++) {
            det = await G.detect(f.el);
            times.push(det.ms);
          }
          times.sort((a, b) => a - b);
          out.push({
            name: f.name,
            score: Math.round(det.score * 1000) / 1000,
            cls: det.cls,
            ms: times[1],
            top: `${det.topAny.cls}:${Math.round(det.topAny.score * 100) / 100}`,
          });
        }
        return { wall, warm, stats: { ...G.stats }, threads: G.stats.threads, coi: !!self.crossOriginIsolated, out };
      },
      { imgs, lite }
    );
    const key = (lite ? "lite_1thread" : "normal") + (throttle > 1 ? `_cpu${throttle}x` : "");
    bench[key] = r;
    console.log(`[bench ${key}]`, JSON.stringify(r));
    check(`model loads (${key})`, !r.error, JSON.stringify(r.stats));
    if (!r.error) {
      const fps = r.out.filter((o) => o.score >= 0.4);
      check(
        `no genital score >= 0.4 on safe frames (${key})`,
        fps.length === 0,
        r.out.map((o) => `${o.name}=${o.score}${o.cls ? "/" + o.cls : ""}@${o.ms}ms [top ${o.top}]`).join(", ")
      );
    }
  }
  await browser.close();
}

// Distinct fake public IPs (TEST-NET ranges): the hub forces TURN relay for two
// clients on the same IP, and the demo TURN is not reachable from a test box.
let ipSeq = 0;
const TEST_IPS = ["203.0.113.10", "198.51.100.20", "192.0.2.30"];
async function peer(label, { lang = "ru", blockModel = false } = {}) {
  const args = [...BASE_ARGS, `--use-file-for-fake-video-capture=${FACE_Y4M}`];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args });
  const ctx = await browser.newContext({
    viewport: { width: 900, height: 700 },
    permissions: ["camera", "microphone"],
    locale: lang === "ru" ? "ru-RU" : "en-US",
    extraHTTPHeaders: { "x-forwarded-for": TEST_IPS[ipSeq++ % TEST_IPS.length] },
  });
  const uid = `gb-test-${label}-${Math.random().toString(16).slice(2, 10)}`;
  await ctx.addInitScript(
    ({ uid, label, lang }) => {
      try {
        localStorage.setItem("nextface-user-v1", JSON.stringify({ user_id: uid, name: label }));
        localStorage.setItem("nextface-rules-v1", "1");
        localStorage.setItem("ruletka-first-session-guide-v1", "1");
        localStorage.setItem("nextface-lang-v1", lang);
      } catch (_) {}
    },
    { uid, label, lang }
  );
  if (blockModel) await ctx.route("**/vendor/genital/model/**", (r) => r.abort());
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => {
    const t = m.text();
    logs.push(t);
    if (/\[genital\]|\[nsfw\]/.test(t)) console.log(`[${label}] ${t.slice(0, 300)}`);
  });
  page.on("pageerror", (e) => console.log(`[${label}] pageerror ${e.message}`));
  page.on("websocket", (ws) => {
    ws.on("framesent", (f) => {
      const s = String(f.payload || "");
      if (s.includes('"genital_hit"')) logs.push("WS> " + s.slice(0, 400));
    });
    ws.on("framereceived", (f) => {
      const s = String(f.payload || "");
      if (/genital_hit_result|partner_banned|"type":"banned"/.test(s)) logs.push("WS< " + s.slice(0, 400));
    });
  });
  await page.goto(`${BASE}/live.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(3000);
  return { label, uid, browser, page, logs };
}

async function start(p) {
  return p.page.evaluate(() => {
    for (const id of ["btn-rules-accept", "btn-age-ok", "btn-guide-ok", "btn-swipe-coach-ok", "btn-blur-starter-ok", "btn-cellular-tip-ok", "btn-notif-optin-no"]) {
      const el = document.getElementById(id);
      if (el && el.offsetParent !== null) el.click();
    }
    const s = document.getElementById("btn-start-match");
    if (s && !s.disabled) {
      s.click();
      return "start";
    }
    return null;
  });
}

async function state(p) {
  return p.page.evaluate(() => {
    const n = document.getElementById("partner-banned-notice");
    const b = document.getElementById("ban-screen");
    return {
      matched: typeof matched !== "undefined" ? !!matched : null,
      partner: typeof primaryPartnerUserId !== "undefined" ? primaryPartnerUserId : "",
      blurred: typeof partnerBlurred !== "undefined" ? !!partnerBlurred : null,
      seq: typeof genitalSeq !== "undefined" ? genitalSeq : -1,
      guard: !!window.RuletkaGenitalGuard,
      ready: !!window.RuletkaGenitalGuard?.ready,
      rv: (() => {
        const v = document.getElementById("remote");
        return v ? `${v.readyState}/${v.videoWidth}x${v.videoHeight}` : "none";
      })(),
      nsfwTimer: typeof nsfwTimer !== "undefined" ? !!nsfwTimer : null,
      cooldown: typeof nsfwHitCooldown !== "undefined" ? !!nsfwHitCooldown : null,
      recent: typeof genitalConfirm !== "undefined" && genitalConfirm ? genitalConfirm.recent.join(",") : "",
      runs: window.RuletkaGenitalGuard?.stats?.runs ?? -1,
      notice: n ? n.innerText.trim() : "",
      ban: b && !b.hidden ? b.innerText.replace(/\s+/g, " ").trim() : "",
    };
  });
}
async function waitFor(p, pred, ms) {
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < ms) {
    s = await state(p);
    if (pred(s)) return s;
    await sleep(300);
  }
  return s;
}
const shot = (p, name) => p.page.screenshot({ path: `${SHOTS}/${name}.png` });

/** Fake ORT session: synthetic [1,22,2100] with one MALE_GENITALIA_EXPOSED box (0.88). */
async function injectFakeDetector(p) {
  return p.page.evaluate(() => {
    const G = window.RuletkaGenitalGuard;
    if (!G) return false;
    const N = 2100;
    const C = G.LABELS.length;
    const data = new Float32Array((4 + C) * N);
    data[0] = 160;
    data[N] = 150;
    data[2 * N] = 50;
    data[3 * N] = 50;
    data[(4 + 14) * N] = 0.88;
    window.ort = window.ort || { Tensor: function (t, d, dims) { this.type = t; this.data = d; this.dims = dims; } };
    G._setSession({
      inputNames: ["images"],
      outputNames: ["output0"],
      async run() {
        return { output0: { data, dims: [1, 4 + C, N] } };
      },
    });
    return G.ready;
  });
}

async function part2() {
  if (!FACE_Y4M || !fs.existsSync(FACE_Y4M)) throw new Error("set FACE_Y4M to a face .y4m");
  const all = [];
  try {
    const offender = await peer("offender", { lang: "ru" });
    const viewer = await peer("viewer", { lang: "ru", blockModel: true });
    all.push(offender, viewer);
    await start(offender);
    await sleep(1500);
    await start(viewer);
    const v1 = await waitFor(viewer, (s) => s.matched && s.partner === offender.uid, 30000);
    check("viewer matched with offender", !!v1.matched && v1.partner === offender.uid, JSON.stringify(v1));
    const g1 = await waitFor(viewer, (s) => s.guard, 15000);
    check("guard script lazy-loaded on match", g1.guard, JSON.stringify(g1));
    await sleep(1500); // let the (blocked) real model load fail first
    check("fake detector injected", await injectFakeDetector(viewer));
    await shot(viewer, "00-viewer-matched-before");
    const v2 = await waitFor(viewer, (s) => s.seq >= 1, 30000);
    check("first confirmed hit (2 of 3) sent, video blurred", v2.seq >= 1 && v2.blurred, JSON.stringify(v2));
    await shot(viewer, "01-viewer-blurred-checking");
    const v3 = await waitFor(viewer, (s) => /заблокирован за нарушение правил/.test(s.notice), 30000);
    check("viewer notice shown (ru)", /Собеседник заблокирован за нарушение правил/.test(v3.notice), JSON.stringify(v3));
    await shot(viewer, "02-viewer-partner-banned-notice");
    const o3 = await waitFor(offender, (s) => !!s.ban, 10000);
    check("offender sees Russian ban screen with 24h", /заблокированы/.test(o3.ban) && /24 часа/.test(o3.ban), o3.ban);
    await shot(offender, "03-offender-ban-screen");
    const sent = viewer.logs.filter((l) => l.startsWith("WS> "));
    check("exactly 2 genital_hit messages, with masked proof", sent.length === 2 && sent.every((l) => /proof_jpeg_b64/.test(l)), sent.map((l) => l.slice(0, 160)).join(" | "));
    const v4 = await waitFor(viewer, (s) => !s.matched || s.partner !== offender.uid, 8000);
    check("viewer no longer matched with offender", !v4.matched || v4.partner !== offender.uid, JSON.stringify(v4));
    // Offender reloads and tries again → ban screen on hello / start.
    await offender.page.reload({ waitUntil: "domcontentloaded" });
    await sleep(3000);
    await start(offender);
    const o5 = await waitFor(offender, (s) => !!s.ban, 15000);
    check("ban screen again after reload", /заблокированы/.test(o5.ban), o5.ban);
    await shot(offender, "04-offender-ban-after-reload");
    fs.writeFileSync(`${SHOTS}/viewer-console.txt`, viewer.logs.join("\n"));
    fs.writeFileSync(`${SHOTS}/offender-console.txt`, offender.logs.join("\n"));
  } catch (e) {
    check("script error", false, String(e && e.stack));
  } finally {
    for (const p of all) {
      try {
        await p.browser.close();
      } catch (_) {}
    }
  }
}

if (PART === "all" || PART === "1") await part1();
if (PART === "all" || PART === "2") await part2();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
fs.writeFileSync(`${SHOTS}/results.json`, JSON.stringify({ results, bench }, null, 2));
process.exit(failed.length ? 1 : 0);
