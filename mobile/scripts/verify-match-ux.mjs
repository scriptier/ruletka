#!/usr/bin/env node
/**
 * L0 static invariants for match UX (name / ★ / loc / blur / eye).
 * Fail closed before APK build — catches thrash that only showed up on device.
 *
 * Usage: node scripts/verify-match-ux.mjs
 * Exit 0 = ok, 1 = fail
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.resolve(__dirname, "..");
const REPO = path.resolve(MOBILE, "..");

let fails = 0;
let oks = 0;

function ok(name) {
  console.log(`  OK  ${name}`);
  oks += 1;
}
function fail(name, detail) {
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  fails += 1;
}

function read(rel) {
  const p = path.join(MOBILE, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

function readRepo(rel) {
  const p = path.join(REPO, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

console.log("=== L0 match-ux static ===");

// ── Stage partner HUD must be ON when matched ───────────────────────────
const liveTsx = read("app/live.tsx");
if (!liveTsx) {
  fail("live.tsx present", "missing app/live.tsx");
} else {
  // Single identity surface: stage HUD OFF; exactly one PartnerIdentityDock
  if (/showStagePartnerHud\s*=\s*\{\s*false\s*\}/.test(liveTsx)) {
    ok("showStagePartnerHud off (single identity surface)");
  } else if (
    /showStagePartnerHud\s*=\s*\{\s*true\s*\}/.test(liveTsx) ||
    /showStagePartnerHud\s*=\s*\{[^}]*matched/.test(liveTsx)
  ) {
    fail(
      "showStagePartnerHud stacked",
      "must be false — stage HUD duplicates dock ★/name (user report 3 chips)"
    );
  } else {
    fail("showStagePartnerHud", "set showStagePartnerHud={false}");
  }

  if (/onToggleBlur\s*=\s*\{\s*togglePartnerBlur\s*\}/.test(liveTsx)) {
    ok("eye blur wired (onToggleBlur → togglePartnerBlur)");
  } else {
    fail("eye blur wired", "LiveBottomBar needs onToggleBlur={togglePartnerBlur}");
  }

  const dockCount = (liveTsx.match(/<PartnerIdentityDock\b/g) || []).length;
  const chromeMatch =
    /uiPhase\s*===\s*"matched"[\s\S]{0,120}<PartnerChrome\b/.test(liveTsx);
  if (dockCount === 1 && !chromeMatch) {
    ok("single PartnerIdentityDock, no matched PartnerChrome");
  } else if (dockCount !== 1) {
    fail(
      "PartnerIdentityDock count",
      `found ${dockCount} mounts — need exactly 1 (name·★·loc once)`
    );
  } else {
    fail(
      "PartnerChrome on match",
      "remove PartnerChrome mid-match — duplicates identity chips"
    );
  }
}

// ── Dual-flag + opaque header guard (2026-08-11 15:01 screenshot) ───────
{
  const dock = read("src/live/PartnerIdentityDock.tsx");
  const flagTrust = read("src/identity/flagTrust.ts");
  const styles = read("src/live/liveStyles.ts");
  const stage = read("src/live/LiveStageVideo.tsx");

  if (dock && /omitFlag\s*:\s*true/.test(dock)) {
    ok("PartnerIdentityDock formatLocLine omitFlag: true");
  } else {
    fail(
      "dock omitFlag",
      "need formatLocLine({ omitFlag: true }) so loc has no second 🇨🇦"
    );
  }
  // Name must not be `${em} ${name}` — chip owns the flag
  if (
    dock &&
    /nameLine\s*=\s*em\s*\?\s*[`$]\{em\}/.test(dock)
  ) {
    fail(
      "dock name flag prefix",
      "do not prefix name with flag emoji — partnerFlagChip is the only flag"
    );
  } else if (dock) {
    ok("dock name has no flag-emoji prefix");
  }

  if (flagTrust && /omitFlag\??\s*:/.test(flagTrust)) {
    ok("formatLocLine accepts omitFlag");
  } else {
    fail("flagTrust omitFlag option", "formatLocLine needs omitFlag?: boolean");
  }

  // Transparent top strip — no solid black header over video
  if (styles) {
    const topStripBlock = styles.match(
      /partnerIdentityTopStrip\s*:\s*\{([\s\S]*?)\n\s{2}\}/
    );
    const body = topStripBlock ? topStripBlock[1] : "";
    if (
      /backgroundColor\s*:\s*["']transparent["']/.test(body) ||
      /backgroundColor\s*:\s*["']rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0(?:\.\d+)?\s*\)["']/.test(
        body
      )
    ) {
      ok("partnerIdentityTopStrip transparent / light frost");
    } else if (/backgroundColor\s*:\s*["']rgba\(0,\s*0,\s*0,\s*0\.(0\d|[12]\d)\s*\)["']/.test(body)) {
      // rgba(0,0,0,0.01–0.29) still under 0.25 max glass
      ok("partnerIdentityTopStrip light frost ≤0.25");
    } else {
      fail(
        "partnerIdentityTopStrip bg",
        "must be transparent or rgba(0,0,0,≤0.25) — no solid black header"
      );
    }
    // Reject near-opaque dock bg if mis-applied to top strip
    if (
      /backgroundColor\s*:\s*["']rgba\(\s*[0-9]+\s*,\s*[0-9]+\s*,\s*[0-9]+\s*,\s*0\.(9|9[0-9]|[89][0-9])\s*\)["']/.test(
        body
      )
    ) {
      fail(
        "partnerIdentityTopStrip opaque",
        "solid/near-opaque panel blocks video (screenshot fail)"
      );
    }
  }

  if (stage && /partnerFlagChip/.test(stage) && /showStageFlag/.test(stage)) {
    ok("LiveStageVideo partnerFlagChip (single stage flag)");
  } else {
    fail(
      "partnerFlagChip",
      "stage must paint one flag chip when flag known"
    );
  }
}

// ── Privacy blur: cover + keep RTCView (unmount mid-match crashes WebRTC) ─
const stage = read("src/live/LiveStageVideo.tsx");
if (!stage) {
  fail("LiveStageVideo.tsx present");
} else {
  if (stage.includes("PartnerBlurVeil") && /privacyBlur|coverMainPartner/.test(stage)) {
    ok("blur: PartnerBlurVeil on privacy path");
  } else {
    fail("PartnerBlurVeil on privacy path");
  }
  // Crash-safe: must keep stream mounted (not unmount while privacyBlur)
  if (/mountMainVideo\s*=\s*!!mainStream\s*;/.test(stage)) {
    ok("blur: keep RTCView mounted (crash-safe)");
  } else if (
    /mountMainVideo\s*=/.test(stage) &&
    (/!\(\s*privacyBlur\s*&&/.test(stage) ||
      /!privacyBlur\s*\?\s*\(?\s*<VideoView/.test(stage) ||
      /tile\.stream\s*&&\s*!tile\.placeholder\s*&&\s*!privacyBlur/.test(stage))
  ) {
    fail(
      "blur unmounts partner RTCView while veiled",
      "unmount mid-call crashes WebRTC on some devices"
    );
  } else {
    ok("blur path present");
  }
  // Multi-remote must also keep VideoView under veil
  if (/tile\.stream\s*&&\s*!tile\.placeholder\s*&&\s*!privacyBlur/.test(stage)) {
    fail(
      "multi-remote unmounts RTCView while privacyBlur",
      "keep VideoView mounted; cover with PartnerBlurVeil"
    );
  } else if (stage.includes("pickMultiTiles") || stage.includes("multiRemote")) {
    ok("blur: multi-remote keeps RTC under veil");
  }
}

// Prefs: one-shot off→intro after connect-fix left installs on off
const prefsStore = read("src/prefs/store.ts");
if (!prefsStore) {
  fail("prefs/store.ts present");
} else {
  if (
    /ruletka\.blur-ux-intro-v\d+/.test(prefsStore) &&
    /blurStrangersMode\s*===\s*"off"/.test(prefsStore) &&
    /"intro"/.test(prefsStore)
  ) {
    ok("prefs: blur-ux-intro-v* off→intro one-shot");
  } else {
    fail(
      "prefs blur-ux-intro migration",
      "need one-shot off→intro when ruletka.blur-ux-intro-v* unset"
    );
  }
  if (/blurStrangersMode:\s*"intro"/.test(prefsStore)) {
    ok("prefs: default blurStrangersMode is intro");
  } else {
    fail("prefs default blur mode intro");
  }
}

// Android: no always-on chrome Modal on match (Modal+WebRTC crash class)
if (liveTsx) {
  if (
    /Platform\.OS\s*===\s*"android"\s*&&\s*uiPhase\s*===\s*"matched"\s*\?[\s\S]{0,80}<Modal/.test(
      liveTsx
    )
  ) {
    fail(
      "no always-on chrome Modal on match",
      "opening Modal every stranger match races SurfaceView"
    );
  } else {
    ok("no always-on Android chrome Modal on match");
  }
  if (/showPrivacyBlur\s*&&\s*Platform\.OS\s*===\s*"android"/.test(liveTsx)) {
    ok("Android privacy Modal only while showPrivacyBlur");
  } else {
    fail(
      "Android privacy Modal while veiled",
      "need showPrivacyBlur && Platform.OS === \"android\" ? <Modal opaque PartnerBlurVeil"
    );
  }
  // Crash fix: <PartnerBlurVeil> JSX without import → ReferenceError on privacy path
  if (/<PartnerBlurVeil[\s/>]/.test(liveTsx)) {
    if (
      /import\s*\{[\s\S]*?\bPartnerBlurVeil\b[\s\S]*?\}\s*from\s*["'][^"']+["']/.test(
        liveTsx
      ) ||
      /import\s+PartnerBlurVeil\b/.test(liveTsx)
    ) {
      ok("live.tsx imports PartnerBlurVeil (JSX crash guard)");
    } else {
      fail(
        "live.tsx PartnerBlurVeil import",
        "JSX uses <PartnerBlurVeil> but no import — runtime ReferenceError"
      );
    }
  }
  if (
    /\[blur\]\s+show why=/.test(liveTsx) &&
    /\[blur\]\s+hide why=/.test(liveTsx)
  ) {
    ok("blur logs: [blur] show/hide why=");
  } else {
    fail("blur show/hide why= logs", "need console.log `[blur] show why=` / hide");
  }
  // Stranger match applies intro/hold immediately; friends skip
  if (
    /wantBlur[\s\S]{0,120}isFriendMatch/.test(liveTsx) ||
    (/!isFriendMatch/.test(liveTsx) &&
      /mode\s*===\s*"hold"\s*\|\|\s*mode\s*===\s*"intro"/.test(liveTsx))
  ) {
    ok("match: stranger wantBlur for intro/hold");
  } else {
    fail("match stranger wantBlur", "apply intro/hold veil on stranger match only");
  }
  if (/togglePartnerBlur/.test(liveTsx) && /setRemoteBlurred\(\s*true\s*\)/.test(liveTsx)) {
    ok("eye toggle sets remoteBlurred");
  } else {
    fail("eye toggle remoteBlurred");
  }
  // Autostart deep-link: spin before clear + idle retry (idle Start flake)
  if (
    /tryAutostartSpin|autostart → spin/.test(liveTsx) &&
    /retry still idle|@500ms|500\s*\)/.test(liveTsx) &&
    /wantAutostart/.test(liveTsx)
  ) {
    ok("autostart: spin path + idle retry @500ms");
  } else {
    fail(
      "autostart harden",
      "need spin-before-clear + retry if still idle after 500ms"
    );
  }
}

// ── Stars display: max(stars, trust) ────────────────────────────────────
const chrome = read("src/identity/PartnerChrome.tsx");
const peers = read("src/live/matchPeers.ts");
if (peers && /function displayPartnerStars|export function displayPartnerStars/.test(peers)) {
  ok("displayPartnerStars helper exists");
} else {
  fail("displayPartnerStars helper in matchPeers.ts");
}
if (
  chrome &&
  (/Math\.max\s*\(\s*stars\s*,\s*trust\s*\)/.test(chrome) ||
    /displayPartnerStars\s*\(/.test(chrome) ||
    /displayStars\s*=\s*Math\.max/.test(chrome) ||
    /stars\s*>\s*0\s*\?\s*stars\s*:\s*trust/.test(chrome))
) {
  ok("PartnerChrome uses stars/trust display (not spendable-only wall)");
} else {
  fail(
    "PartnerChrome displayStars",
    "need max(stars,trust) or stars>0?stars:trust"
  );
}
if (stage && /stagePartnerStars|displayPartnerStars|Math\.max/.test(stage)) {
  ok("LiveStageVideo stage ★ uses max/spendable+trust path");
} else {
  fail("LiveStageVideo stagePartnerStars");
}

// ── Brand watermark: dedicated component must exist and be wired in ─────
const brandWatermark = read("src/live/BrandWatermark.tsx");
if (!brandWatermark) {
  fail("BrandWatermark.tsx present", "missing src/live/BrandWatermark.tsx");
} else if (/export const BrandWatermark\b/.test(brandWatermark)) {
  ok("BrandWatermark.tsx exports BrandWatermark");
} else {
  fail("BrandWatermark export", "expected `export const BrandWatermark`");
}
if (stage) {
  const importsBrandWatermark =
    /import\s*\{[\s\S]*?\bBrandWatermark\b[\s\S]*?\}\s*from\s*["']\.\/BrandWatermark["']/.test(
      stage
    );
  const mountsBrandWatermark = /<BrandWatermark\b/.test(stage);
  if (importsBrandWatermark && mountsBrandWatermark) {
    ok("LiveStageVideo imports + mounts BrandWatermark");
  } else {
    fail(
      "LiveStageVideo wires BrandWatermark",
      "need `import { BrandWatermark } from \"./BrandWatermark\"` and `<BrandWatermark` mount — brand mark must not regress to inline duplicate"
    );
  }
}

// ── Blur button present ─────────────────────────────────────────────────
const bar = read("src/live/LiveBottomBar.tsx");
if (bar && /live-blur-btn/.test(bar) && /onToggleBlur/.test(bar)) {
  ok("LiveBottomBar live-blur-btn + onToggleBlur");
} else {
  fail("LiveBottomBar blur control");
}

// ── Web cache-bust contract (repo ui/) ───────────────────────────────────
const liveHtml = readRepo("ui/live.html");
if (!liveHtml) {
  fail("ui/live.html present (repo)");
} else {
  const liveV = liveHtml.match(/live\.js\?v=(\d+)/);
  const rtcV = liveHtml.match(/webrtc\.js\?v=(\d+)/);
  if (liveV && rtcV) {
    ok(`ui/live.html cache-bust live.js?v=${liveV[1]} webrtc.js?v=${rtcV[1]}`);
  } else {
    fail(
      "ui/live.html cache-bust",
      "need live.js?v=NNN and webrtc.js?v=NNN (browsers cache forever without bump)"
    );
  }
  const liveJs = readRepo("ui/live.js");
  if (liveJs && /free stuck inflight|_inflightAt/.test(liveJs)) {
    ok("ui/live.js has hop9 stuck-offer recovery markers");
  } else if (liveJs) {
    fail(
      "ui/live.js stuck-offer markers",
      "missing free stuck inflight / _inflightAt (25s MTO regression risk)"
    );
  }
}

// Answerer latch regression guard (nightly black remote 2026-08-11)
{
  const ms = read("src/media/MediaSession.ts");
  if (ms) {
    const hasRemoteBlock = ms.match(/const hasRemoteSdp\s*=\s*([^;]+);/);
    const rhs = hasRemoteBlock ? hasRemoteBlock[1].replace(/\s+/g, " ") : "";
    if (rhs.includes("answeredAsAnswerer")) {
      fail(
        "hasRemoteSdp latch",
        "answeredAsAnswerer in hasRemoteSdp — black remote regression"
      );
    } else if (rhs.includes("hasRemoteDescription")) {
      ok("MediaSession hasRemoteSdp uses real remote SDP (not latch alone)");
    } else {
      fail("hasRemoteSdp", "expected hasRemoteDescription in hasRemoteSdp");
    }
  }
}

console.log(`L0 done: ${oks} ok, ${fails} fail`);
process.exit(fails > 0 ? 1 : 0);
