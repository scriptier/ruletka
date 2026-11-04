/**
 * Headless check for the face check before matching (2026-11-04).
 * Local only: point it at a local bridge serving this tree's ui/.
 *
 *   FACE_Y4M=/tmp/face.y4m BASE=http://127.0.0.1:8979 SHOTS=/tmp/face-shots \
 *     node scripts/face-gate-headless.mjs
 *
 * Chrome's default fake camera (green pattern) has no face → must stay
 * unmatched with the prompt shown. A face y4m (--use-file-for-fake-video-capture)
 * must match. A tab whose /vendor/face/* is blocked must FAIL OPEN and match.
 */
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
function loadPlaywright() {
  const tries = [
    "playwright",
    `${process.env.HOME}/.local/share/mise/installs/npm-playwright/latest/node_modules/playwright`,
  ];
  for (const t of tries) {
    try {
      return require(t);
    } catch (_) {}
  }
  throw new Error("playwright not found");
}
const { chromium } = loadPlaywright();

const BASE = process.env.BASE || "http://127.0.0.1:8979";
const FACE_Y4M = process.env.FACE_Y4M;
const SHOTS = process.env.SHOTS || "/tmp/face-shots";
const CHROME = process.env.CHROME || undefined; // default: playwright's chromium
if (!FACE_Y4M || !fs.existsSync(FACE_Y4M)) throw new Error("set FACE_Y4M to a face .y4m");
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
];

async function peer(label, { face = false, blockFace = false, lang = "ru" } = {}) {
  const args = [...BASE_ARGS];
  if (face) args.push(`--use-file-for-fake-video-capture=${FACE_Y4M}`);
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args });
  const ctx = await browser.newContext({
    viewport: { width: 900, height: 700 },
    permissions: ["camera", "microphone"],
    locale: lang === "ru" ? "ru-RU" : "en-US",
  });
  const uid = `face-test-${label}-${Math.random().toString(16).slice(2, 10)}`;
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
  if (blockFace) {
    await ctx.route("**/vendor/face/**", (r) => r.abort());
  }
  const page = await ctx.newPage();
  page.on("console", (m) => {
    const t = m.text();
    if (/\[face\]/.test(t)) console.log(`[${label}] ${t.slice(0, 300)}`);
  });
  page.on("pageerror", (e) => console.log(`[${label}] pageerror ${e.message}`));
  await page.goto(`${BASE}/live.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(3000);
  return { label, browser, page };
}

async function start(p) {
  return p.page.evaluate(() => {
    for (const id of [
      "btn-rules-accept",
      "btn-age-ok",
      "btn-guide-ok",
      "btn-swipe-coach-ok",
      "btn-blur-starter-ok",
      "btn-cellular-tip-ok",
      "btn-notif-optin-no",
    ]) {
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
    const g = window.__ruletFaceGate || {};
    const el = document.getElementById("face-gate-prompt");
    return {
      matched: typeof matched !== "undefined" ? !!matched : null,
      inQueue: typeof inQueue !== "undefined" ? !!inQueue : null,
      faceOk: !!g.ok,
      kind: g.kind || "",
      failOpen: !!g.failOpen,
      reason: g.reason || "",
      backend: typeof nsfwBackend !== "undefined" ? nsfwBackend : "",
      prompt: el && !el.hidden ? el.innerText.replace(/\s+/g, " ").trim() : "",
    };
  });
}

async function waitFor(p, pred, ms) {
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < ms) {
    s = await state(p);
    if (pred(s)) return s;
    await sleep(500);
  }
  return s;
}

const shot = (p, name) => p.page.screenshot({ path: `${SHOTS}/${name}.png` });

const all = [];
try {
  // 1) No face (default fake cam) + face A: neither may match each other.
  const noFace = await peer("noface");
  const faceA = await peer("faceA", { face: true });
  all.push(noFace, faceA);
  console.log("start", await start(noFace), await start(faceA));
  const a1 = await waitFor(faceA, (s) => s.faceOk, 20000);
  check("face A: detector sees the face", a1.faceOk, JSON.stringify(a1));
  const n1 = await waitFor(noFace, (s) => s.reason === "noface" && !!s.prompt, 20000);
  check("no-face: prompt shown", !!n1.prompt && n1.reason === "noface", JSON.stringify(n1));
  check("no-face: Russian prompt text", /Покажите лицо в камеру, чтобы начать/.test(n1.prompt), n1.prompt);
  await sleep(8000);
  const n2 = await state(noFace);
  const a2 = await state(faceA);
  check("no face -> blocked (not matched after 8s with a face peer waiting)", !n2.matched && !a2.matched, `noface=${JSON.stringify(n2)} faceA=${JSON.stringify(a2)}`);
  await shot(noFace, "01-noface-blocked-prompt");
  await shot(faceA, "02-faceA-waiting-ok");

  // 2) Second face peer B → A and B match; no-face still waiting.
  const faceB = await peer("faceB", { face: true, lang: "en" });
  all.push(faceB);
  await start(faceB);
  const b3 = await waitFor(faceB, (s) => s.matched, 25000);
  const a3 = await state(faceA);
  check("face A + face B -> matched", !!b3.matched && !!a3.matched, `A=${JSON.stringify(a3)} B=${JSON.stringify(b3)}`);
  const n3 = await state(noFace);
  check("no-face still unmatched while face pair matched", !n3.matched, JSON.stringify(n3));
  await sleep(3000);
  await shot(faceA, "03-faceA-matched");
  await shot(faceB, "04-faceB-matched-en");

  // 3) Fail-open: detector files blocked → match anyway (with logging), even with no face.
  const failOpen = await peer("failopen", { blockFace: true });
  const faceC = await peer("faceC", { face: true });
  all.push(failOpen, faceC);
  await start(failOpen);
  const f4 = await waitFor(failOpen, (s) => s.failOpen, 25000);
  check("blocked model -> client fails open", f4.failOpen && !f4.prompt, JSON.stringify(f4));
  await start(faceC);
  const f5 = await waitFor(failOpen, (s) => s.matched, 25000);
  check("fail-open client still gets matched", !!f5.matched, JSON.stringify(f5));
  const n5 = await state(noFace);
  check("no-face still unmatched at the end", !n5.matched, JSON.stringify(n5));
  await sleep(2000);
  await shot(failOpen, "05-failopen-matched");
} catch (e) {
  check("script error", false, String(e && e.stack));
} finally {
  for (const p of all) {
    try {
      await p.browser.close();
    } catch (_) {}
  }
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
fs.writeFileSync(`${SHOTS}/results.json`, JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
