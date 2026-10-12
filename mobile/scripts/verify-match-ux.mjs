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
import { createContext, runInContext } from "node:vm";
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
  // Name string must not embed `${em}` — separate flag Text node is OK
  if (
    dock &&
    /nameLine\s*=\s*em\s*\?\s*[`$]\{em\}/.test(dock)
  ) {
    fail(
      "dock name flag prefix",
      "do not bake flag into nameLine string — use separate flag Text"
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

  // Single flag on dock only (stage chip removed — dual 🇨🇦 product fail).
  if (
    stage &&
    !/showStageFlag\s*=\s*true/.test(stage) &&
    !/testID=["']live-partner-flag-chip/.test(stage)
  ) {
    ok("LiveStageVideo stage flag chip off (dock owns flag)");
  } else if (stage && /partnerFlagChip/.test(stage) && /showStageFlag/.test(stage)) {
    fail(
      "partnerFlagChip",
      "stage flag chip reintroduced — dual 🇨🇦 with dock; keep dock-only"
    );
  } else {
    ok("LiveStageVideo stage flag chip off (dock owns flag)");
  }

  if (dock && /testID=["']live-partner-identity-flag["']/.test(dock)) {
    ok("PartnerIdentityDock paints single flag");
  } else if (dock && /flagEmoji\(props\.flag\)/.test(dock) && /\{em\}/.test(dock)) {
    ok("PartnerIdentityDock paints single flag");
  } else {
    fail(
      "dock flag",
      "dock must paint one flag emoji when stage chip is off"
    );
  }
}

// ── Privacy blur: SoftBlurRemote product path + keep RTCView ─────────────
const stage = read("src/live/LiveStageVideo.tsx");
if (!stage) {
  fail("LiveStageVideo.tsx present");
} else {
  // Product: native SoftBlurRemote on privacy (intro/hold/eye). Not mosaic on every path.
  if (
    stage.includes("SoftBlurRemote") &&
    /privacyBlur|softBlurPartner/.test(stage)
  ) {
    ok("blur: SoftBlurRemote on privacy path");
  } else {
    fail(
      "SoftBlurRemote on privacy path",
      "need SoftBlurRemote + privacyBlur / softBlurPartner"
    );
  }
  // PartnerBlurVeil remains fallback only when native is missing (iOS / no manager)
  if (
    /import\s*\{[\s\S]*?\bPartnerBlurVeil\b/.test(stage) &&
    stage.includes("PartnerBlurVeil") &&
    /!softBlurNative/.test(stage)
  ) {
    ok("blur: PartnerBlurVeil fallback when !softBlurNative");
  } else {
    fail(
      "PartnerBlurVeil fallback",
      "keep PartnerBlurVeil imported/used when !softBlurNative"
    );
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
  } else if (/mountMainVideo\s*=\s*!!displayMainStream/.test(stage)) {
    ok("blur: keep RTCView mounted (crash-safe)");
  } else {
    ok("blur path present");
  }
  // Multi-remote must also keep VideoView under veil
  if (/tile\.stream\s*&&\s*!tile\.placeholder\s*&&\s*!privacyBlur/.test(stage)) {
    fail(
      "multi-remote unmounts RTCView while privacyBlur",
      "keep VideoView mounted; cover with SoftBlurRemote or PartnerBlurVeil"
    );
  } else if (stage.includes("pickMultiTiles") || stage.includes("multiRemote")) {
    ok("blur: multi-remote keeps RTC under veil");
  }
  // Intro peel must collapse SoftBlur overlay (not leave opaque slate over RTCView)
  if (
    stage.includes("softBlurCover") &&
    stage.includes("softBlurIdle") &&
    /softBlurPartner\s*\?/.test(stage)
  ) {
    ok("blur: SoftBlur peel uses transparent cover + idle collapse");
  } else {
    fail(
      "SoftBlur peel overlay",
      "need softBlurCover (transparent) while on + softBlurIdle after peel"
    );
  }
  // A4 SurfaceView z-order: multi tiles always zOrder 0 + elevated cover shell
  if (/zOrder=\{0\}/.test(stage) && /blurCoverElevated/.test(stage)) {
    ok("blur: multi/1v1 cover uses zOrder 0 + blurCoverElevated");
  } else {
    fail(
      "blur multi/hunt z-order shell",
      "need multi zOrder={0} + blurCoverElevated wrapper so cover is not under RTCView"
    );
  }
  // A5 multi-tile: ExtraRemoteTile SoftBlurRemote or PartnerBlurVeil,
  // zOrder={0} + elev shell. (Do not require mosaic on every privacy path.)
  {
    const extraStart = stage.indexOf("function ExtraRemoteTile");
    const extraEnd =
      extraStart >= 0
        ? stage.indexOf("export function LiveStageVideo", extraStart)
        : -1;
    const extra =
      extraStart >= 0
        ? stage.slice(
            extraStart,
            extraEnd > extraStart ? extraEnd : extraStart + 5000
          )
        : "";
    const extraZ0 = extra && /zOrder=\{0\}/.test(extra);
    const extraElev = extra && extra.includes("blurCoverElevated");
    const extraCover =
      extra &&
      (extra.includes("SoftBlurRemote") || extra.includes("PartnerBlurVeil"));
    const oldZGate =
      extra &&
      /\(privacyBlur\s*\|\|\s*partnerHideOn\)\s*&&\s*idx\s*===\s*0/.test(extra);
    if (extraZ0 && extraElev && extraCover && !oldZGate) {
      ok("blur: multi ExtraRemoteTile SoftBlur or veil + z0 + elev");
    } else {
      fail(
        "multi-tile blur remote2/3 (A5)",
        "ExtraRemoteTile: SoftBlurRemote or PartnerBlurVeil; zOrder={0} + blurCoverElevated"
      );
    }
  }
  // 201649Z: leftover partnerNoCam must not cover a live PC RTCView.
  // Extra tiles keep advertisedNoCam (laptop cylinder).
  if (
    /paintPrimaryNoCam/.test(stage) &&
    /!remoteHasVideo/.test(stage) &&
    /advertisedNoCam=\{\!\!extraNoCam2\}/.test(stage) &&
    /advertisedNoCam=\{\!\!extraNoCam3\}/.test(stage)
  ) {
    ok("primary NoCamPortrait gated on !remoteHasVideo; extra advertisedNoCam stays");
  } else {
    fail(
      "primary NoCamPortrait gate",
      "need paintPrimaryNoCam + !remoteHasVideo; extra tiles keep advertisedNoCam"
    );
  }
  // Rotate: splitWide follows Dimensions; first RTCView key stays (wrap only).
  if (
    /Dimensions\.addEventListener\(\s*["']change["']/.test(stage) &&
    /splitWide/.test(stage) &&
    /key="live-first-remote"/.test(stage)
  ) {
    ok("splitWide follows Dimensions change; first RTCView key stable");
  } else {
    fail(
      "splitWide rotate",
      "need Dimensions change listener + splitWide + key=live-first-remote (no remount)"
    );
  }
}

const appJson = read("app.json");
if (appJson && /"orientation"\s*:\s*"default"/.test(appJson)) {
  ok("app.json orientation default (auto-rotate)");
} else {
  fail(
    "app.json orientation",
    'need "orientation": "default" so the phone can rotate'
  );
}
const manifest = read("android/app/src/main/AndroidManifest.xml");
if (
  manifest &&
  /android:screenOrientation="fullUser"/.test(manifest) &&
  !/android:screenOrientation="portrait"/.test(manifest)
) {
  ok("AndroidManifest fullUser (follows system auto-rotate)");
} else {
  fail(
    "AndroidManifest orientation",
    "need MainActivity screenOrientation=fullUser not portrait"
  );
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
  if (/blurStrangersMode:\s*"hold"/.test(prefsStore)) {
    ok("prefs: default blurStrangersMode is hold");
  } else {
    fail("prefs default blur mode hold");
  }
}

// Android: no always-on chrome Modal; no privacy Modal (SoftBlur is the cover)
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
  // Product: eye peels SoftBlur. Privacy Modal covered SoftBlur / tap races.
  if (/showPrivacyBlur\s*&&\s*Platform\.OS\s*===\s*"android"/.test(liveTsx)) {
    fail(
      "Android privacy Modal removed",
      "do not mount showPrivacyBlur && Platform.OS === \"android\" ? Modal"
    );
  } else {
    ok("no Android privacy Modal (SoftBlur is the product cover)");
  }
  if (
    /allowSoftBlur=\{blurMode\s*!==\s*["']intro["']\}/.test(liveTsx)
  ) {
    fail(
      "allowSoftBlur gated on intro",
      "intro + hold + eye all use SoftBlur — allowSoftBlur={true} or omit"
    );
  } else if (
    /allowSoftBlur=\{\s*true\s*\}/.test(liveTsx) ||
    !/allowSoftBlur=/.test(liveTsx)
  ) {
    ok("allowSoftBlur true (intro+hold+eye)");
  } else {
    fail(
      "allowSoftBlur true",
      "pass allowSoftBlur={true} or omit (default true)"
    );
  }
  if (
    /<LiveStatusBanners[\s\S]{0,500}showBlurBanner=\{\s*false\s*\}/.test(
      liveTsx
    )
  ) {
    ok("no privacy-veil banner (SoftBlur is the product)");
  } else {
    fail(
      "privacy veil banner",
      "LiveStatusBanners showBlurBanner={false} — duplicate Privacy veil row is not product blur"
    );
  }
  const revealStart = liveTsx.indexOf("const revealPartnerVideo");
  const revealBody =
    revealStart >= 0 ? liveTsx.slice(revealStart, revealStart + 2000) : "";
  const introRet = revealBody.indexOf('why.startsWith("intro_")');
  const forcePaint = revealBody.indexOf("forceRepaintRemote?");
  if (introRet >= 0 && (forcePaint < 0 || introRet < forcePaint)) {
    ok("intro peel does not remount RTCView");
  } else {
    fail(
      "intro peel remount",
      "revealPartnerVideo intro_* must return before forceRepaintRemote"
    );
  }
  if (
    /const\s*\[\s*blurMode\s*,\s*setBlurMode\s*\]/.test(liveTsx)
  ) {
    ok("blurMode state defined (388/389 crash guard)");
  } else {
    fail(
      "blurMode state",
      "keep const [blurMode, setBlurMode] — 388 crashed property blurMode doesn't exist"
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

// ── Stars display: partner ★ = trust (rep), not max(wallet, trust) ─────
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
    "need displayPartnerStars or trust-first chip"
  );
}
if (stage && /stagePartnerStars|displayPartnerStars/.test(stage)) {
  ok("LiveStageVideo stage ★ uses displayPartnerStars");
} else {
  fail("LiveStageVideo stagePartnerStars");
}
if (peers && /max\(wallet, trust\)|public score/.test(peers)) {
  ok("displayPartnerStars is max(wallet, trust) public chip");
} else {
  fail("displayPartnerStars comment", "must document max(wallet, trust)");
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
  if (liveJs && /function armMeshLateOfferKicks/.test(liveJs)) {
    const arm = String(liveJs.split("function armMeshLateOfferKicks")[1] || "")
      .split("function pruneMeshPeer")[0];
    if (/meshLateOfferAfter \+ 8000/.test(arm)) {
      fail(
        "web extra kick",
        "armMeshLateOfferKicks must not treat meshLateOfferAfter+8000 as a kick barrier"
      );
    } else {
      ok("armMeshLateOfferKicks kicks extras without +8000 skip");
    }
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

// Hide/Blur: live <video> + backdrop-filter veil (never filter:blur on video — GPU black)
{
  const stageCss = readRepo("ui/live-stage.css") || "";
  const liveJs = readRepo("ui/live.js") || "";
  const html = readRepo("ui/live.html") || "";
  const veil =
    /#self-hide-veil/.test(stageCss) &&
    /partner-blurred::after/.test(stageCss) &&
    /backdrop-filter:\s*blur\(26px\)/.test(stageCss);
  const noFilterOnVid =
    /#tile-local\.self-blurred #local[\s\S]{0,220}filter:\s*none/.test(
      stageCss
    );
  if (veil && noFilterOnVid) {
    ok("web Hide/Blur: backdrop-filter veil over live video (no filter on <video>)");
  } else {
    fail(
      "web Hide/Blur CSS",
      "Hide/Blur them = live video + backdrop-filter veil; never filter:blur on #local/#remote"
    );
  }
  if (
    /must stay previewStream/.test(liveJs) &&
    !/function bindLocalPreviewToHide/.test(liveJs) &&
    !/function localPreviewSrcObject/.test(liveJs)
  ) {
    ok("web Hide: #local stays real preview (no blur-stream swap)");
  } else {
    fail(
      "web Hide local preview",
      "#local must keep previewStream — do not bind blur captureStream"
    );
  }
  if (
    /function bindFrostVideo/.test(liveJs) &&
    /function getPeerFrostStream/.test(liveJs) &&
    html.includes('id="local-frost"') &&
    html.includes('id="remote-frost"')
  ) {
    ok("web frost: second video layer like Android SoftBlur");
  } else {
    fail(
      "web frost videos",
      "need local-frost + remote-frost + bindFrostVideo (Android SoftBlur parity)"
    );
  }
}

// ── Tap-a-face partner actions (task 531) ────────────────────────────────
{
  if (stage && /\bonSelectPartner\b/.test(stage)) {
    ok("LiveStageVideo has onSelectPartner");
  } else {
    fail(
      "LiveStageVideo onSelectPartner",
      "missing onSelectPartner — tap-a-face partner actions not wired"
    );
  }

  // Must be actually CALLED for all three slots — declaring it in the prop
  // type alone does not prove the tap targets are wired.
  {
    const hasPrimaryCall =
      stage && /onSelectPartner\(\s*["']primary["']\s*\)/.test(stage);
    const forwardFnMatch =
      stage &&
      stage.match(
        /const\s+(\w+)\s*=\s*\(\s*slot\s*:[^)]*\)\s*=>\s*\{[\s\S]{0,400}?onSelectPartner\(\s*slot\s*\)/
      );
    const forwardFn = forwardFnMatch ? forwardFnMatch[1] : null;
    const extra0Call =
      forwardFn &&
      new RegExp(`\\b${forwardFn}\\(\\s*["']extra0["']\\s*\\)`).test(stage);
    const extra1Call =
      forwardFn &&
      new RegExp(`\\b${forwardFn}\\(\\s*["']extra1["']\\s*\\)`).test(stage);
    if (hasPrimaryCall && extra0Call && extra1Call) {
      ok(
        "LiveStageVideo calls onSelectPartner for primary + extra0 + extra1 (real call sites, not just the prop type)"
      );
    } else {
      fail(
        "onSelectPartner call sites dead",
        'need onSelectPartner("primary") plus a slot-forwarding fn (that calls onSelectPartner(slot)) invoked with "extra0" and "extra1" — declaring the prop type alone is not wiring'
      );
    }
  }

  // peelOrSelectPrimary (or onSelectPartner("primary")) must be CALLED from a
  // real Pressable onPress / SwipeSkip onTap — not just defined and unused.
  {
    const swipeOnTap =
      stage && /onTap=\{[^}]*\bpeelOrSelectPrimary\b[^}]*\}/.test(stage);
    const pressableOnPress =
      stage &&
      /onPress=\{\(\)\s*=>\s*\{[\s\S]{0,500}?\bpeelOrSelectPrimary\(\)/.test(
        stage
      );
    const directOnTap =
      stage &&
      /onTap=\{[^}]*onSelectPartner\(\s*["']primary["']\s*\)[^}]*\}/.test(
        stage
      );
    if (swipeOnTap || pressableOnPress || directOnTap) {
      ok(
        'peelOrSelectPrimary/onSelectPartner("primary") called from a real tap handler'
      );
    } else {
      fail(
        "peelOrSelectPrimary call site dead",
        'peelOrSelectPrimary (or onSelectPartner("primary")) must be called inside a Pressable onPress or SwipeSkip onTap — not just defined'
      );
    }
  }

  if (stage && /key="live-first-remote"/.test(stage)) {
    ok("first VideoView still key=live-first-remote");
  } else {
    fail(
      "first VideoView key",
      'key="live-first-remote" missing — remount risk'
    );
  }

  const moreSheet = read("src/live/LiveMoreSheet.tsx");
  if (moreSheet && /\bactionSlot\b/.test(moreSheet)) {
    ok("LiveMoreSheet has actionSlot");
  } else {
    fail(
      "LiveMoreSheet actionSlot",
      moreSheet ? "missing actionSlot" : "missing src/live/LiveMoreSheet.tsx"
    );
  }

  // live.tsx must pass onSelectPartner= as an actual prop into <LiveStageVideo,
  // not merely reference the identifier elsewhere in the file.
  {
    const stageJsxStart = liveTsx ? liveTsx.indexOf("<LiveStageVideo") : -1;
    const stageJsxEnd =
      liveTsx && stageJsxStart >= 0
        ? liveTsx.indexOf("\n        />", stageJsxStart)
        : -1;
    const stageJsxProps =
      liveTsx && stageJsxStart >= 0
        ? liveTsx.slice(
            stageJsxStart,
            stageJsxEnd > stageJsxStart ? stageJsxEnd : stageJsxStart + 6000
          )
        : "";
    if (/onSelectPartner=/.test(stageJsxProps)) {
      ok("live.tsx passes onSelectPartner= into <LiveStageVideo>");
    } else {
      fail(
        "live.tsx onSelectPartner prop",
        "onSelectPartner= must be passed as a prop to <LiveStageVideo>"
      );
    }
  }

  if (liveTsx && /\bactionSlot\b/.test(liveTsx)) {
    ok("live.tsx has actionSlot");
  } else {
    fail("live.tsx actionSlot", "missing actionSlot");
  }

  // matchContinuity.ts must export extraPartnerActionTarget. OK for this to
  // fail if the sibling task hasn't landed yet — do not weaken this check.
  {
    const matchContinuity = read("src/live/matchContinuity.ts");
    if (
      matchContinuity &&
      /export\s+function\s+extraPartnerActionTarget\b/.test(matchContinuity)
    ) {
      ok("matchContinuity.ts exports extraPartnerActionTarget");
    } else {
      fail(
        "matchContinuity.ts extraPartnerActionTarget",
        matchContinuity
          ? "missing export function extraPartnerActionTarget"
          : "missing src/live/matchContinuity.ts"
      );
    }
  }
}

// ── Extra no-cam chrome (identity over cylinder) ────────────────────────
{
  if (!stage) {
    fail("extra no-cam chrome: LiveStageVideo.tsx present");
  } else {
    if (/function StageTileChrome\b/.test(stage)) {
      ok("StageTileChrome still exists");
    } else {
      fail("StageTileChrome exists", "need function StageTileChrome");
    }

    // ExtraRemoteTile must keep StageTileChrome on advertisedNoCam / audio-only.
    // Product fail: `{!privacyBlur && !tileNoCam ? (<StageTileChrome` hid name/★/loc.
    const extraStart = stage.indexOf("function ExtraRemoteTile");
    const extraEnd =
      extraStart >= 0
        ? stage.indexOf("export function LiveStageVideo", extraStart)
        : -1;
    const extra =
      extraStart >= 0
        ? stage.slice(
            extraStart,
            extraEnd > extraStart ? extraEnd : extraStart + 5000
          )
        : "";
    const chromeGatedOffNoCam =
      extra &&
      /\{!\s*privacyBlur\s*&&\s*!\s*tileNoCam[\s\S]{0,160}<StageTileChrome\b/.test(
        extra
      );
    if (!extra) {
      fail(
        "ExtraRemoteTile StageTileChrome",
        "function ExtraRemoteTile missing in LiveStageVideo.tsx"
      );
    } else if (chromeGatedOffNoCam) {
      fail(
        "ExtraRemoteTile StageTileChrome not gated on !tileNoCam",
        "found {!privacyBlur && !tileNoCam wrapping StageTileChrome — chrome must paint over no-cam cylinder"
      );
    } else if (/<StageTileChrome\b/.test(extra)) {
      ok("ExtraRemoteTile StageTileChrome not gated on !tileNoCam");
    } else {
      fail(
        "ExtraRemoteTile StageTileChrome",
        "ExtraRemoteTile must still mount StageTileChrome"
      );
    }

    // first VideoView key already asserted in tap-a-face block — keep it there.

    // Optional: extra/chrome flag prop (p-stage may land secondFlag or chrome flag).
    if (
      /\bsecondFlag\b/.test(stage) ||
      /function StageTileChrome[\s\S]{0,500}\bflag\??\s*:/.test(stage) ||
      /function ExtraRemoteTile[\s\S]{0,800}\bflag\??\s*:/.test(stage)
    ) {
      ok("LiveStageVideo secondFlag or chrome/extra flag prop");
    }
  }
}

// ── Android dedupe chrome (task 20260815T221947Z) ───────────────────────
// One identity belt; extra tiles keep chrome; gifts/chat compose off match.
{
  // 1) Primary 3-way tile must NOT mount StageTileChrome (dock owns name/flag/loc).
  if (!stage) {
    fail("dedupe: LiveStageVideo.tsx present");
  } else {
    const liveStageStart = stage.indexOf("export function LiveStageVideo");
    const primaryBody =
      liveStageStart >= 0 ? stage.slice(liveStageStart) : stage;
    if (
      /multiRemote\s*&&\s*!privacyBlur[\s\S]{0,200}<StageTileChrome\b/.test(
        primaryBody
      )
    ) {
      fail(
        "primary multiRemote StageTileChrome",
        "must not wrap <StageTileChrome in multiRemote && !privacyBlur (dock is the only identity)"
      );
    } else {
      ok("primary tile does not mount StageTileChrome via multiRemote && !privacyBlur");
    }
  }

  // 2) ExtraRemoteTile must still contain <StageTileChrome (409 hop).
  {
    const extraFile = read("src/live/ExtraRemoteTile.tsx") || "";
    let extraInline = "";
    if (stage) {
      const extraStart = stage.indexOf("function ExtraRemoteTile");
      const extraEnd =
        extraStart >= 0
          ? stage.indexOf("export function LiveStageVideo", extraStart)
          : -1;
      extraInline =
        extraStart >= 0
          ? stage.slice(
              extraStart,
              extraEnd > extraStart ? extraEnd : extraStart + 5000
            )
          : "";
    }
    const extra = extraFile || extraInline;
    if (extra && /<StageTileChrome\b/.test(extra)) {
      ok("ExtraRemoteTile still contains <StageTileChrome (409 hop)");
    } else {
      fail(
        "ExtraRemoteTile StageTileChrome (409 hop)",
        extra
          ? "ExtraRemoteTile missing <StageTileChrome — keep extra-tile chrome"
          : "ExtraRemoteTile not found (LiveStageVideo.tsx or ExtraRemoteTile.tsx)"
      );
    }
  }

  // 3) Dock paints ★ again (410 hid them; 223755Z human: missing stars).
  if (!liveTsx) {
    fail("PartnerIdentityDock showStars", "missing app/live.tsx");
  } else {
    const dockStart = liveTsx.indexOf("<PartnerIdentityDock");
    const dockEnd = dockStart >= 0 ? liveTsx.indexOf("/>", dockStart) : -1;
    const dockJsx =
      dockStart >= 0
        ? liveTsx.slice(
            dockStart,
            dockEnd > dockStart ? dockEnd + 2 : dockStart + 1500
          )
        : "";
    if (dockJsx && /showStars=\{\s*false\s*\}/.test(dockJsx)) {
      fail(
        "PartnerIdentityDock showStars={false}",
        "dock must paint ★ (showStars true or omit) — 223755Z missing stars"
      );
    } else if (
      dockJsx &&
      (/showStars=\{\s*true\s*\}/.test(dockJsx) ||
        !/showStars=/.test(dockJsx))
    ) {
      ok("PartnerIdentityDock paints stars");
    } else {
      fail(
        "PartnerIdentityDock showStars",
        "need showStars={true} or omit (default on)"
      );
    }
  }

  // 3b) peerStrip chips overlapped dock (223755Z Dragonov/Laptop under loc).
  if (liveTsx && /styles\.peerStrip/.test(liveTsx)) {
    fail(
      "live.tsx peerStrip",
      "matched peerStrip chips overlap dock — remove (tap tiles instead)"
    );
  } else {
    ok("live.tsx has no matched peerStrip");
  }

  // 4) Matched native compose: no <LiveGiftBar; no chatSend. Import/comment OK.
  if (!liveTsx) {
    fail("live.tsx matched compose LiveGiftBar");
  } else {
    if (/<LiveGiftBar\b/.test(liveTsx)) {
      fail(
        "live.tsx <LiveGiftBar",
        "matched compose must not mount <LiveGiftBar (import/comment OK)"
      );
    } else {
      ok("live.tsx has no <LiveGiftBar");
    }
    if (
      /uiPhase\s*===\s*["']matched["'][\s\S]{0,2500}style=\{\s*styles\.chatSend\s*\}/.test(
        liveTsx
      )
    ) {
      fail(
        "live.tsx matched compose chatSend",
        "styles.chatSend used in matched compose — Message/Send must be off"
      );
    } else {
      ok("live.tsx matched compose has no chatSend");
    }
  }

  // 5) first VideoView key stays (already asserted in tap-a-face; keep here too)
  if (stage && /key="live-first-remote"/.test(stage)) {
    ok("dedupe: first VideoView still key=live-first-remote");
  } else {
    fail(
      "dedupe: first VideoView key",
      'key="live-first-remote" missing — remount risk'
    );
  }
}

// ── Partner actions gifts+chat (20260815T224336Z) ───────────────────────
// Sheet is gifts + message + send. Stage compose stays off (410 hop).
{
  const moreSheet = read("src/live/LiveMoreSheet.tsx") || "";

  // 1) LiveMoreSheet mounts LiveGiftBar + chat send.
  {
    const hasGiftBar =
      /<LiveGiftBar\b/.test(moreSheet) ||
      /import\s*\{[\s\S]*?\bLiveGiftBar\b/.test(moreSheet);
    const hasChatSend =
      /more-chat-send/.test(moreSheet) || /\bchatSend\b/.test(moreSheet);
    if (moreSheet && hasGiftBar && hasChatSend) {
      ok("LiveMoreSheet has LiveGiftBar + more-chat-send/chatSend");
    } else {
      fail(
        "LiveMoreSheet LiveGiftBar + chat send",
        !moreSheet
          ? "missing src/live/LiveMoreSheet.tsx"
          : "need LiveGiftBar and more-chat-send (or chatSend)"
      );
    }
  }

  // 2) Sheet does not render mute / blur / flip / browser-layout rows.
  if (/more-partner-mute/.test(moreSheet)) {
    fail(
      "LiveMoreSheet more-partner-mute",
      "sheet must not contain more-partner-mute"
    );
  } else {
    ok("LiveMoreSheet has no more-partner-mute");
  }
  if (/more-blur/.test(moreSheet)) {
    fail("LiveMoreSheet more-blur", "sheet must not contain more-blur");
  } else {
    ok("LiveMoreSheet has no more-blur");
  }
  {
    const flipRow =
      /row\(\s*L\.flipCam\b/.test(moreSheet) ||
      /row\(\s*[^,]+,\s*onFlipCam\b/.test(moreSheet) ||
      /onPress=\{\s*onFlipCam\s*\}/.test(moreSheet);
    if (flipRow) {
      fail(
        "LiveMoreSheet flipCam row",
        "sheet must not render flipCam / onFlipCam row"
      );
    } else {
      ok("LiveMoreSheet has no flipCam row");
    }
  }
  {
    const layoutHandler =
      /row\(\s*[\s\S]{0,280}?\bonToggleLiveLayout\b/.test(moreSheet) ||
      /onPress=\{\s*onToggleLiveLayout\s*\}/.test(moreSheet);
    if (layoutHandler) {
      fail(
        "LiveMoreSheet onToggleLiveLayout handler",
        "sheet must not render onToggleLiveLayout as a row handler"
      );
    } else {
      ok("LiveMoreSheet has no onToggleLiveLayout rendered handler");
    }
  }

  // 3) live.tsx still has no <LiveGiftBar (do not weaken the 410 hop assert).
  if (!liveTsx) {
    fail("gifts+chat: live.tsx present");
  } else if (/<LiveGiftBar\b/.test(liveTsx)) {
    fail(
      "live.tsx <LiveGiftBar (stage compose hop held)",
      "matched compose must not mount <LiveGiftBar — gifts live in LiveMoreSheet"
    );
  } else {
    ok("live.tsx still has no <LiveGiftBar (stage compose hop held)");
  }

  // 4) LiveMoreSheet call wires spend + chat draft/send.
  {
    const sheetStart = liveTsx ? liveTsx.indexOf("<LiveMoreSheet") : -1;
    let sheetJsx = "";
    if (liveTsx && sheetStart >= 0) {
      const closeTag = liveTsx.indexOf("</LiveMoreSheet>", sheetStart);
      const selfClose = liveTsx.indexOf("/>", sheetStart);
      const sheetEnd =
        closeTag >= 0 && (selfClose < 0 || closeTag < selfClose)
          ? closeTag + "</LiveMoreSheet>".length
          : selfClose >= 0
            ? selfClose + 2
            : sheetStart + 8000;
      sheetJsx = liveTsx.slice(sheetStart, sheetEnd);
    }
    const hasSpend = /onSpend=/.test(sheetJsx);
    const hasChat =
      /chatDraft=/.test(sheetJsx) || /onSendChat=/.test(sheetJsx);
    if (sheetJsx && hasSpend && hasChat) {
      ok("live.tsx LiveMoreSheet has onSpend= and chatDraft=/onSendChat=");
    } else {
      fail(
        "live.tsx LiveMoreSheet onSpend + chat",
        !sheetJsx
          ? "missing <LiveMoreSheet call"
          : "need onSpend= and chatDraft= (or onSendChat=) on <LiveMoreSheet"
      );
    }
  }

  // 5) first VideoView key stays (already asserted; keep here too).
  if (stage && /key="live-first-remote"/.test(stage)) {
    ok("gifts+chat: first VideoView still key=live-first-remote");
  } else {
    fail(
      "gifts+chat: first VideoView key",
      'key="live-first-remote" missing — remount risk'
    );
  }
}

// ── Android bar vs PiP (20260815T225522Z) ───────────────────────────────
{
  const bar = read("src/live/LiveBottomBar.tsx") || "";
  if (bar && /testID="live-report-btn"/.test(bar)) {
    fail(
      "LiveBottomBar live-report-btn",
      "report must leave the bar (tap-face sheet owns it)"
    );
  } else {
    ok("LiveBottomBar has no live-report-btn");
  }
  if (bar && /testID="live-friends-btn"/.test(bar)) {
    fail(
      "LiveBottomBar live-friends-btn",
      "friends must leave the bar (overlap + clutter)"
    );
  } else {
    ok("LiveBottomBar has no live-friends-btn");
  }
  const swipe = read("src/live/SwipeSkipOverlay.tsx") || "";
  if (
    swipe.includes("styles.wash") &&
    swipe.includes("interpolate(translateX.value") &&
    swipe.includes("Easing.out(Easing.cubic)")
  ) {
    ok("swipe card tilt + wash + fly-off easing");
  } else {
    fail("swipe animation", "SwipeSkipOverlay needs tilt interpolate, wash, cubic fly-off");
  }
  const tap = read("src/ui/TapPressable.tsx") || "";
  const stage = read("src/live/LiveStageVideo.tsx") || "";
  if (
    stage.includes("onSwipeStart") &&
    stage.includes("swipeStartActive") &&
    stage.includes("handleSwipeStartCommit")
  ) {
    ok("idle brand video swipe starts search");
  } else {
    fail("idle swipe start", "LiveStageVideo must swipe brand loop → onSwipeStart");
  }
  if (stage.includes("swipeExtraActive") && stage.includes("onSwipeDropExtra")) {
    ok("3-way extra tile swipe-to-drop");
  } else {
    fail("3-way extra swipe", "swipeExtraActive + onSwipeDropExtra");
  }
  if (tap.includes("unstable_pressDelay={0}") && tap.includes("hapticLight")) {
    ok("TapPressable instant press + haptic");
  } else {
    fail("TapPressable", "need pressDelay 0 + hapticLight");
  }
  const liveTsx = read("app/live.tsx") || "";
  if (liveTsx.includes("extraGiftFx0") && stage.includes("extraGiftFx0")) {
    ok("3-way extra tile GiftFxOverlay");
  } else {
    fail("extra tile FX", "extraGiftFx0 on live.tsx + LiveStageVideo");
  }
  if (
    liveTsx.includes("stageGiftFx") &&
    stage.includes("stageGiftFx") &&
    liveTsx.includes("extraPeers.length < 1")
  ) {
    ok("3-way primary gift FX clipped to tile (not full-screen)");
  } else {
    fail("3-way gift clip", "stageGiftFx + skip full-screen when extras");
  }
  const home = read("app/index.tsx") || "";
  const startAt = home.indexOf("home-start-cta");
  const whatsAt = home.indexOf("whatsNew ?");
  if (startAt >= 0 && whatsAt >= 0 && startAt < whatsAt && home.includes("goLive")) {
    ok("home Start CTA above What's new; Start marks seen");
  } else {
    fail("whatsnew block", "Start chatting must sit above What's new and markWhatsNewSeen");
  }
  const liveHtml = readRepo("ui/live.html") || "";
  const liveJs = readRepo("ui/live.js") || "";
  if (
    liveHtml.includes('id="third-avatar"') &&
    liveHtml.includes('id="third-avatar-stars"') &&
    liveHtml.includes('id="third-friend-code"') &&
    liveHtml.includes('id="third-trust-chip"') &&
    liveHtml.includes('id="fourth-avatar"') &&
    liveHtml.includes('id="fourth-friend-code"') &&
    liveJs.includes('giftStarToConversationalist(extraSlotUserId(elId))') &&
    liveJs.includes('bindExtraGift($("third-avatar")') &&
    liveJs.includes('paintSlotFriendCode')
  ) {
    ok("3-way/4-way extra tile avatar + code + trusted/praise");
  } else {
    fail("3-way extra avatar gift", "tile-third/fourth avatar + friend-code + trust/praise");
  }
  if (stage.includes("connectName") && stage.includes("stagePartnerLabel")) {
    ok("connecting card paints name first");
  } else {
    fail("connecting name", "LiveStageVideo connect card must show stagePartnerLabel first");
  }
  const layout = read("app/_layout.tsx") || "";
  const hubP = read("src/hub/HubProvider.tsx") || "";
  if (
    hubP.includes("incomingFriendReq") &&
    layout.includes("incomingFriendReq") &&
    layout.includes("hub.acceptFriend") &&
    layout.includes("hub.declineFriend")
  ) {
    ok("Android friend-request Accept/Decline popup");
  } else {
    fail(
      "friend request popup",
      "HubProvider incomingFriendReq + _layout accept/decline"
    );
  }
  const callAv = read("src/friends/CallPeerAvatar.tsx") || "";
  if (
    callAv.includes("testID=\"call-peer-avatar\"") &&
    layout.includes("CallPeerAvatar") &&
    layout.includes("incomingCall.from_user_id") &&
    hubP.includes("listed?.avatar") &&
    (read("app/friends.tsx") || "").includes("avatar: \"avatar\" in f")
  ) {
    ok("friend-call incoming/outgoing avatar");
  } else {
    fail(
      "call avatar",
      "CallPeerAvatar on call cards + HubProvider friends lookup + outbound avatar"
    );
  }
  {
    const fr = read("app/friends.tsx") || "";
    if (
      fr.includes('sheetTab === "blocked"') &&
      /friends-tab-\$\{id\}/.test(fr) &&
      fr.includes("unblockUser") &&
      /mobile\.live\.addFriend/.test(fr) &&
      /mobile\.live\.report/.test(fr) &&
      !/onBlock=\{\(\) => blockFriend/.test(fr)
    ) {
      ok("Friends: Blocked tab + Calls Add/Block/Report + friends Message only");
    } else {
      fail(
        "friends blocked tab",
        "friends.tsx: Chats|Calls|Blocked; Calls Add/Block/Report; no friend-row Block"
      );
    }
  }
  const moreSrc = read("src/live/LiveMoreSheet.tsx") || "";
  const stageH = read("src/live/stageStreams.ts") || "";
  if (
    moreSrc.includes("extraPeerCount >= 2") &&
    moreSrc.includes("onFindThirdToggle") &&
    !/isFriendCall && extraPeerCount === 0[\s\S]{0,80}browseTogether/.test(
      moreSrc
    ) &&
    liveTsx.includes("Wait for them to accept") &&
    /return !!opts.remoteStream && !!opts.huntingWithPartner/.test(stageH)
  ) {
    ok("friend call stays 1v1 until Find 3rd accept");
  } else {
    fail(
      "friend 1v1 hunt",
      "More sheet Find 3rd (not instant browse); hunt only after huntingWithPartner"
    );
  }
  if (
    moreSrc.includes("more-please-stay") &&
    moreSrc.includes('g.id !== "please_stay"') &&
    liveTsx.includes("pleaseStay:")
  ) {
    ok("please stay is a partner-actions row (not gift chip)");
  } else {
    fail(
      "please stay action",
      "LiveMoreSheet more-please-stay row; filter please_stay from gift chips"
    );
  }
  const dockSrc = read("src/live/PartnerIdentityDock.tsx") || "";
  if (
    dockSrc.includes('testID="live-partner-identity-code"') &&
    dockSrc.includes("props.code") &&
    liveTsx.includes("code={partnerIdFriendCode")
  ) {
    ok("dock paints conversationalist friend code");
  } else {
    fail(
      "dock friend code",
      "PartnerIdentityDock code line + live.tsx code={partnerIdFriendCode}"
    );
  }
  if (
    dockSrc.includes("onGiftStar") &&
    liveTsx.includes('spend("shooting_star", 3)')
  ) {
    ok("tap conversationalist ★ sends shooting_star (3★ → ★1)");
  } else {
    fail(
      "avatar star gift",
      "PartnerIdentityDock onGiftStar → spend shooting_star 3"
    );
  }
  if (
    stage.includes("code={props.code}") &&
    !/StageTileChrome[\s\S]*splitTileVolume/.test(stage)
  ) {
    ok("extra-tile chrome has code, no volume in identity");
  } else {
    fail(
      "extra identity volume",
      "StageTileChrome must paint code and not embed splitTileVolume"
    );
  }
  if (
    liveTsx.includes("extraHit") &&
    liveTsx.includes("p2p_dc2") &&
    liveTsx.includes("media2.sendDataMessage(payload)")
  ) {
    ok("3-way gift_fx extra DC + skip paint on spectator");
  } else {
    fail("3-way gift_fx extra", "need extraHit skip + media2/3 send + dc2/dc3 recv");
  }
  if (bar && bar.includes("TapPressable")) {
    ok("LiveBottomBar uses TapPressable");
  } else {
    fail("LiveBottomBar TapPressable", "bar buttons should use TapPressable");
  }
  {
    const moreWin = read("src/live/LiveMoreSheet.tsx") || "";
    if (
      /more-window-card/.test(moreWin) &&
      /moreWindowScrim/.test(moreWin) &&
      /moreWindowRoot/.test(moreWin)
    ) {
      ok("LiveMoreSheet is a floating window (not a bottom tab)");
    } else {
      fail(
        "LiveMoreSheet window",
        "partner actions must be more-window-card + scrim overlay, not a bar tab"
      );
    }
  }
  if (
    bar &&
    /btnNextFloor/.test(bar) &&
    /btnStopFloor/.test(bar) &&
    !/\bPIP_W\b/.test(bar) &&
    !/paddingRight:\s*PIP_W/.test(bar)
  ) {
    ok("LiveBottomBar full-width 3D Stop/Next (PiP on video, not in bar)");
  } else {
    fail(
      "LiveBottomBar 3D full-width",
      "Stop/Next need btnStopFloor + btnNextFloor and must not pad PIP_W (PiP sits on video)"
    );
  }
  {
    const liveTsx = read("app/live.tsx") || "";
    const dock = read("src/live/PartnerIdentityDock.tsx") || "";
    if (
      /trustGifters=\{partnerTrustGifters\}/.test(liveTsx) &&
      /live-partner-identity-praised/.test(dock) &&
      /if \(extraHit\) \{/.test(liveTsx) &&
      !/extraHit && !fromMe/.test(liveTsx)
    ) {
      ok("Android praised-by HUD + 3-way extra-tile gift FX");
    } else {
      fail(
        "android praised/gifts",
        "live.tsx must pass partnerTrustGifters; extraHit must paint extra tiles"
      );
    }
  }
  {
    const stage = read("src/live/LiveStageVideo.tsx") || "";
    const prefs = read("src/prefs/store.ts") || "";
    if (
      /youTileDockWide/.test(stage) &&
      /duoMatchClusterWide/.test(stage) &&
      /browserDuo/.test(stage) &&
      /liveLayout: "browser"/.test(prefs)
    ) {
      ok("Android 1v1 browser-duo (you bottom, chrome on partner)");
    } else {
      fail(
        "browser duo",
        "LiveStageVideo youTileDock + prefs default liveLayout browser"
      );
    }
  }
  if (bar && /idleBeforeStart/.test(bar) && /!idleBeforeStart/.test(bar)) {
    ok("LiveBottomBar hides Stop/Next until Start");
  } else {
    fail(
      "idle Stop/Next hidden",
      "LiveBottomBar must gate showSearchControls on idleBeforeStart"
    );
  }
  const arcadeStyles = read("src/live/liveStyles.ts") || "";
  if (
    arcadeStyles &&
    /top:\s*"70%"/.test(arcadeStyles) &&
    /idleArcadeWrap/.test(arcadeStyles)
  ) {
    ok("Idle Start sits on brand diamond (~70% of 720×1096 loop)");
  } else {
    fail(
      "idle arcade diamond",
      "idleArcadeWrap top must be 70% (gold diamond between wordmark and Chat Roulette)"
    );
  }
  const moreSheet = read("src/live/LiveMoreSheet.tsx") || "";
  if (
    moreSheet &&
    (/moreRowDanger/.test(moreSheet) || /\bL\.report\b/.test(moreSheet))
  ) {
    ok("LiveMoreSheet still has report");
  } else {
    fail(
      "LiveMoreSheet report",
      "report must stay on partner-actions sheet after leaving the bar"
    );
  }
}

{
  const ms = read("src/media/MediaSession.ts") || "";
  if (
    ms.includes("this.secondaryLink || (liveV && !outboundDead)") &&
    !/this\.secondaryLink \|\| this\.multiPeerAudio \|\| \(liveV && !outboundDead\)/.test(
      ms
    )
  ) {
    ok("3-way primary may GUM on zero_f (not skip_multi forever)");
  } else {
    fail(
      "3-way primary GUM on zero_f",
      "refreshLocalVideoTrack must not skip GUM on primary when multiPeerAudio && outboundDead"
    );
  }
}

{
  const chrome = read("src/live/LiveDebateChrome.tsx") || "";
  const st = read("src/live/liveStyles.ts") || "";
  if (
    chrome.includes("DebateIncomingOverlay") &&
    chrome.includes("debateScreenCover")
  ) {
    ok("debate invite is root-level centered cover (not under Stop/Next)");
  } else {
    fail(
      "debate invite placement",
      "DebateIncomingOverlay + debateScreenCover at live root"
    );
  }
  const liveTsx = read("app/live.tsx") || "";
  if (liveTsx.includes("<DebateIncomingOverlay")) {
    ok("live.tsx mounts DebateIncomingOverlay at root");
  } else {
    fail("live.tsx debate overlay", "mount DebateIncomingOverlay at root");
  }
  if (
    /debateInviteCard:/.test(st) &&
    !/debateInviteCard:[\s\S]{0,180}bottom:\s*16/.test(st)
  ) {
    ok("debateInviteCard not pinned under the bottom bar");
  } else {
    fail(
      "debateInviteCard placement",
      "do not position invite at bottom:16 over Stop/Next"
    );
  }
  const pop = read("src/live/StarGiftPopup.tsx") || "";
  if (
    pop.includes("starGiftedScreenCover") &&
    pop.includes("starGiftedCard") &&
    !pop.includes("<Modal")
  ) {
    ok("StarGiftPopup 2s root cover (not Modal under camera)");
  } else {
    fail("StarGiftPopup", "root starGiftedScreenCover 2s popup");
  }
  const snd = read("src/feedback/sounds.ts") || "";
  if (snd.includes("playStarGiftClick") && snd.includes("star-click.mp3")) {
    ok("star-click SFX at playStarGiftClick");
  } else {
    fail("star-click SFX", "playStarGiftClick + star-click.mp3");
  }
  if (snd.includes("playDebateBell") && snd.includes("undertaker-bell.mp3")) {
    ok("debate start undertaker bell 10%");
  } else {
    fail("debate bell", "playDebateBell + undertaker-bell.mp3");
  }
  if (
    snd.includes("playDebateTickTock") &&
    snd.includes("ticktock.mp3") &&
    snd.includes("playDebatePress") &&
    snd.includes("pressing.mp3")
  ) {
    ok("debate ticktock + press SFX 10%");
  } else {
    fail("debate turn SFX", "ticktock + pressing at 10%");
  }
  if (snd.includes('k === "bars"') && snd.includes("repair")) {
    ok("bars repair SFX 10%");
  } else {
    fail("bars repair SFX", "playOnce repair on bars");
  }
  if (
    snd.includes('k === "crown"') &&
    snd.includes("royal.mp3") &&
    snd.includes('playOnce("royal", 0.1)')
  ) {
    ok("crown royal SFX 10%");
  } else {
    fail("crown royal SFX", "playOnce royal 0.1 + royal.mp3");
  }
  if (
    snd.includes('k === "spotlight"') &&
    snd.includes("riz.mp3") &&
    snd.includes('playOnce("riz", 0.1)')
  ) {
    ok("spotlight riz SFX 10%");
  } else {
    fail("spotlight riz SFX", "playOnce riz 0.1 + riz.mp3");
  }
  if (
    snd.includes('k === "snow"') &&
    snd.includes("portalenter.wav") &&
    snd.includes('playOnce("portalEnter", 0.1)')
  ) {
    ok("snow portalenter SFX 10%");
  } else {
    fail("snow portalenter SFX", "playOnce portalEnter 0.1 + portalenter.wav");
  }
  if (
    snd.includes('k === "fireworks"') &&
    snd.includes("flame.mp3") &&
    snd.includes('playOnce("flame", 0.1)')
  ) {
    ok("fireworks flame SFX 10%");
  } else {
    fail("fireworks flame SFX", "playOnce flame 0.1 + flame.mp3");
  }
  if (snd.includes('k === "balloons"') && snd.includes("goodJob")) {
    ok("balloons good-job SFX 10%");
  } else {
    fail("balloons SFX", "playOnce goodJob on balloons");
  }
  if (
    snd.includes("legendaryDrop") &&
    snd.includes("legendary-drop.mp3") &&
    snd.includes("n > 3")
  ) {
    ok("★>3 legendary drop SFX 10%");
  } else {
    fail("legendary drop", "playOnce legendaryDrop when amount > 3");
  }
  if (snd.includes('k === "confetti"') && snd.includes("itemUsed")) {
    ok("confetti item-used SFX 10%");
  } else {
    fail("confetti SFX", "playOnce itemUsed on confetti");
  }
  const fx = read("src/stars/GiftFxOverlay.tsx") || "";
  if (
    fx.includes('resizeMode="repeat"') &&
    !fx.includes("fenceCell") &&
    !/<Text[^>]*>⛓️/.test(fx)
  ) {
    ok("android fence = repeating mesh, no 4x4 stretch / chain badge");
  } else {
    fail("android fence", "repeat PNG, not 16 stretched tiles + ⛓️");
  }
  if (
    fx.includes("function GlowOrb") &&
    !fx.includes("lockBadge") &&
    /const n = 96/.test(fx)
  ) {
    ok("android FX: glow orbs, iron bars no lock, denser confetti");
  } else {
    fail("android FX richness", "GlowOrb + no bars lock + 96 confetti");
  }
  if (
    fx.includes("function FallingCrystal") &&
    fx.includes("6 + ((i * 5) % 16)") &&
    fx.includes("80 + ((i * 7) % 16)") &&
    fx.includes("[22, 30, 42, 30, 22]") &&
    fx.includes("discoFlash") &&
    fx.includes("left > 22 && left < 78")
  ) {
    ok("android FX v6/v8/v4/v3: balloons sides, crown king, snow hole, disco rim");
  } else {
    fail(
      "android FX 820 parity",
      "FallingCrystal + side balloons + king spike + snow hole + discoFlash"
    );
  }
}

// ── Self-avatar wiring (task 540) — asserts may fail until sibling lanes land ──
{
  const hubClient = read("src/hub/HubClient.ts") || "";
  const hubProvider = read("src/hub/HubProvider.tsx") || "";
  if (/prefs\.avatar|opts\.avatar/.test(hubClient + hubProvider)) {
    ok("HubClient/HubProvider wires prefs.avatar or opts.avatar");
  } else {
    fail(
      "HubClient/HubProvider avatar prefs",
      'expected prefs.avatar or opts.avatar (not only avatar: "") — self-avatar send not wired yet'
    );
  }

  const dock = read("src/live/PartnerIdentityDock.tsx") || "";
  if (/live-partner-identity-avatar/.test(dock)) {
    ok("PartnerIdentityDock live-partner-identity-avatar");
  } else {
    fail(
      "PartnerIdentityDock avatar testID",
      'need testID="live-partner-identity-avatar" on the partner avatar element'
    );
  }
  if (
    /avatarReady/.test(dock) &&
    /props\.ready !== false/.test(dock) &&
    /avatarReady=\{/.test(liveTsx) &&
    /hasRemoteMedia/.test(liveTsx)
  ) {
    ok("dock defers avatar Image until live audio/frame");
  } else {
    fail(
      "avatarReady defer",
      "PartnerIdentityDock must gate Image on avatarReady; live.tsx must pass hasRemoteMedia"
    );
  }

  const settingsTsx = read("app/settings.tsx") || "";
  if (/resizeUriToAvatarDataUrl|avatar/.test(settingsTsx)) {
    ok("settings.tsx resizeUriToAvatarDataUrl or avatar");
  } else {
    fail(
      "settings.tsx avatar UI",
      "need resizeUriToAvatarDataUrl or avatar wiring for the self-avatar photo picker"
    );
  }
}

// ── Find-3rd invite overlay: real Accept/Decline UI, not toast-only ─────
{
  const layout = read("app/_layout.tsx") || "";
  const hubP = read("src/hub/HubProvider.tsx") || "";
  const hubC = read("src/hub/HubClient.ts") || "";

  const hasState =
    /findThirdIncoming/.test(hubP) && /find_third_incoming/.test(hubP);
  const hasRespond = /findThirdRespond\s*\(\s*accept\s*:\s*boolean/.test(hubC);
  if (hasState && hasRespond) {
    ok("HubProvider find_third_incoming state + HubClient findThirdRespond");
  } else {
    fail(
      "find-3rd hub wiring",
      "need HubProvider findThirdIncoming/find_third_incoming and HubClient findThirdRespond(accept)"
    );
  }

  const overlayStart = layout.indexOf("findThirdIncoming && !incomingCall");
  const overlayBlock =
    overlayStart >= 0 ? layout.slice(overlayStart, overlayStart + 1600) : "";
  const noToastOnly =
    overlayBlock &&
    !/Alert\.alert/.test(overlayBlock) &&
    !/ToastAndroid/.test(overlayBlock) &&
    /<Pressable\b/.test(overlayBlock);
  const hasAcceptDecline =
    /hub\.findThirdRespond\(\s*false\s*\)/.test(overlayBlock) &&
    /hub\.findThirdRespond\(\s*true\s*\)/.test(overlayBlock);
  if (overlayBlock && noToastOnly && hasAcceptDecline) {
    ok("live.tsx/_layout find-3rd overlay is real Accept/Decline UI, not toast-only");
  } else {
    fail(
      "find-3rd overlay not toast-only",
      "_layout.tsx must render a scrim/card with Pressable Accept/Decline calling hub.findThirdRespond(true/false) — not Alert.alert/ToastAndroid"
    );
  }
}

// ── Stop 1v1: leftover partner video must not leave a black left tile ──
{
  const liveJs = readRepo("ui/live.js") || "";
  const stageCss = readRepo("ui/live-stage.css") || "";
  const html = readRepo("ui/live.html") || "";
  const idleJs =
    /function paintIdlePartnerStage\(/.test(liveJs) &&
    /function clearMainRemotePaintSurface\(/.test(liveJs) &&
    /function stopPartnerIdleWatchers\(/.test(liveJs) &&
    /function canSwipeStartIdle\(/.test(liveJs) &&
    /if \(partnerStageShouldBeIdle\(\)\) \{\s*try \{\s*paintIdlePartnerStage\(\);/.test(
      liveJs
    );
  if (idleJs) {
    ok("Stop idle: clear #remote inline paint + gate paintRemoteFromPc");
  } else {
    fail(
      "Stop idle JS",
      "paintIdlePartnerStage must clear inline #remote styles and paintRemoteFromPc must no-op when idle"
    );
  }
  const idleCss =
    /html\.start-idle #tile-remote:has\(#remote-no-cam:not\(\[hidden\]\)\) #remote-empty/.test(
      stageCss
    ) &&
    /html\.start-idle #tile-remote #remote-empty\[hidden\]/.test(stageCss) &&
    /html\.start-idle #tile-remote #remote-no-cam/.test(stageCss);
  if (idleCss) {
    ok("Stop idle CSS: empty beats leftover no-cam + hidden");
  } else {
    fail(
      "Stop idle CSS",
      "start-idle must force #remote-empty over leftover #remote-no-cam"
    );
  }
  if (
    /live-stage\.css\?v=658/.test(html) &&
    /live\.js\?v=988/.test(html) &&
    /webrtc\.js\?v=356/.test(html) &&
    /hubs\.js\?v=157/.test(html)
  ) {
    ok("live.html pins stage 658 + live.js 988 + webrtc 356 + hubs 157");
  } else {
    fail(
      "Stop idle cache-bust",
      "live.html must pin live-stage.css?v=658 and live.js?v=988 (webrtc 356, hubs 157)"
    );
  }
  const idlePreview =
    /id="idle-self-hint"/.test(html) &&
    /function syncIdleSelfPreview\(/.test(liveJs) &&
    /idle-self-preview #tile-local/.test(stageCss) &&
    /idle\.faceHint/.test(readRepo("ui/i18n.js") || "") &&
    /pendingInviteSkipsAutoStart\(/.test(liveJs);
  if (idlePreview) {
    ok("idle self-preview is text-only and leaves invite skip in place");
  } else {
    fail(
      "idle self-preview",
      "need #idle-self-hint, syncIdleSelfPreview, large #tile-local, idle.faceHint, pendingInviteSkipsAutoStart"
    );
  }
}

{
  const liveJs = readRepo("ui/live.js") || "";
  const indexHtml = readRepo("ui/index.html") || "";
  if (
    /rel="canonical" href="https:\/\/ruletka\.me\/"/.test(indexHtml) &&
    /href="\/live\.html"/.test(indexHtml)
  ) {
    ok("index.html is the Russian home and links to /live.html");
  } else {
    fail(
      "index canonical",
      "ui/index.html canonical must be https://ruletka.me/ and the page must link to /live.html"
    );
  }
  const hint =
    /reach\.useMeNoVpn/.test(liveJs) &&
    /https:\/\/ruletka\.me\/live\.html/.test(liveJs) &&
    /В России открывайте ruletka\.me — без VPN/.test(liveJs) &&
    /function maybeShowRuReachMeHint\(/.test(liveJs);
  const autoRedir = /location\.(replace|assign)\([^)]*ruletka\.me/.test(
    liveJs
  );
  if (hint && !autoRedir) {
    ok("RU vip hint: reach.useMeNoVpn → ruletka.me (no auto-redirect)");
  } else {
    fail(
      "RU reach hint",
      "live.js must hint ruletka.me for ru lang on vip; must not auto-redirect"
    );
  }
}

{
  const hubsJs = readRepo("ui/hubs.js") || "";
  const liveJs = readRepo("ui/live.js") || "";
  const html = readRepo("ui/live.html") || "";
  if (/turns:/i.test(hubsJs)) {
    fail("hubs.js TURNS", "must not list TURNS URLs (ICE stays turns:ruletka.vip:443)");
  } else {
    ok("hubs.js does not change TURNS");
  }
  const wired =
    /function siblingSeed\(/.test(hubsJs) &&
    /function trySiblingFailover\(/.test(hubsJs) &&
    /siblingSeed,/.test(hubsJs) &&
    /trySiblingFailover,/.test(hubsJs) &&
    /SIBLING_FAILOVER_MS = 20_000/.test(hubsJs);
  if (wired) {
    ok("hubs.js siblingSeed + trySiblingFailover (20s, exported)");
  } else {
    fail(
      "hub sibling API",
      "need siblingSeed/trySiblingFailover exported on RuletHub, 20s cooldown"
    );
  }
  const immediate =
    /function tryImmediateSiblingReconnect\(/.test(liveJs) &&
    /hub sibling → /.test(liveJs) &&
    /reconnectAttempt === 0/.test(liveJs) &&
    /trySiblingFailover\(\)/.test(liveJs) &&
    /if \(matched\) return false/.test(liveJs);
  if (immediate) {
    ok("live.js sibling reconnect on attempt 0, skipped while matched");
  } else {
    fail(
      "live sibling reconnect",
      "tryImmediateSiblingReconnect: attempt 0 + skip if matched"
    );
  }
  if (
    /hubs\.js\?v=157/.test(html) &&
    /live\.js\?v=988/.test(html) &&
    /webrtc\.js\?v=356/.test(html) &&
    /live-stage\.css\?v=658/.test(html) &&
    /identity\.js\?v=156/.test(html)
  ) {
    ok("lockstep pins hubs 157 · live 988 · webrtc 356 · stage 658");
  } else {
    fail(
      "sibling pin lockstep",
      "live.html: hubs.js?v=157 live.js?v=988 webrtc.js?v=356 live-stage.css?v=658 (identity 156)"
    );
  }
  {
    const brand = readRepo("ui/live-brand.css") || "";
    const stage = readRepo("ui/live-stage.css") || "";
    if (
      /writing-mode:\s*horizontal-tb/.test(brand) &&
      /top:\s*56%/.test(brand) &&
      /height:\s*56% !important/.test(stage) &&
      /justify-content:\s*flex-end !important/.test(stage)
    ) {
      ok("portrait 1v1: horizontal ruletka.me on seam + actions right");
    } else {
      fail(
        "portrait brand/actions",
        "live-brand.css horizontal-tb at 56% seam; live-stage match tray flex-end"
      );
    }
    const liveJs = readRepo("ui/live.js") || "";
    if (
      /partner-menu-open/.test(stage) &&
      /classList\.add\("partner-menu-open"\)/.test(liveJs) &&
      /z-index:\s*231/.test(stage)
    ) {
      ok("partner-menu sits above tile chrome (volume/flag/avatar)");
    } else {
      fail(
        "partner-menu z",
        "html.partner-menu-open hides tile chrome; menu z-index 231"
      );
    }
    if (
      /pingWorker/.test(liveJs) &&
      /inCall && reconnectAttempt === 0/.test(liveJs)
    ) {
      ok("live.js Worker ping + zero-delay reconnect in call");
    } else {
      fail(
        "ws stay-up",
        "startPing needs pingWorker; scheduleReconnect delay 0 while inCall"
      );
    }
  }
  if (hubsJs) {
    try {
      function loadHub(prefill = {}) {
        const store = Object.create(null);
        Object.assign(store, prefill);
        const sandbox = {
          URL,
          Date,
          Math,
          JSON,
          Error,
          TypeError,
          location: {
            href: "https://ruletka.vip/live.html",
            origin: "https://ruletka.vip",
            protocol: "https:",
            host: "ruletka.vip",
            hostname: "ruletka.vip",
            search: "",
          },
          localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => {
              store[k] = String(v);
            },
            removeItem: (k) => {
              delete store[k];
            },
          },
          CustomEvent: class CustomEvent {
            constructor(type, init = {}) {
              this.type = type;
              this.detail = init.detail;
            }
          },
          dispatchEvent() {
            return true;
          },
          performance: { now: () => 0 },
        };
        sandbox.window = sandbox;
        sandbox.globalThis = sandbox;
        const ctx = createContext(sandbox);
        runInContext(hubsJs, ctx);
        return ctx.RuletHub;
      }
      const H = loadHub();
      const vipToMe =
        H.siblingSeed("https://ruletka.vip") === "https://ruletka.me";
      const meToVip =
        H.siblingSeed("https://ruletka.me") === "https://ruletka.vip";
      const wwwStrip =
        H.siblingSeed("https://www.ruletka.vip") === "https://ruletka.me";
      const otherEmpty = H.siblingSeed("https://example.com") === "";
      if (vipToMe && meToVip && wwwStrip && otherEmpty) {
        ok("siblingSeed maps vip↔me (www stripped; other empty)");
      } else {
        fail(
          "siblingSeed map",
          `vip→${H.siblingSeed("https://ruletka.vip")} me→${H.siblingSeed("https://ruletka.me")} www→${H.siblingSeed("https://www.ruletka.vip")}`
        );
      }
      const first = H.trySiblingFailover();
      const after = H.base();
      const second = H.trySiblingFailover();
      if (first === true && after === "https://ruletka.me" && second === false) {
        ok("trySiblingFailover vip→me once per 20s");
      } else {
        fail(
          "trySiblingFailover throttle",
          `first=${first} base=${after} second=${second}`
        );
      }
      const Hoff = loadHub({ "ruletka-hub-auto-v1": "0" });
      const off = Hoff.trySiblingFailover();
      if (off === false && Hoff.base() === "https://ruletka.vip") {
        ok("trySiblingFailover respects autoFailoverEnabled");
      } else {
        fail(
          "trySiblingFailover auto off",
          `off=${off} base=${Hoff.base()}`
        );
      }
    } catch (e) {
      fail("hubs.js sibling vm", String(e && e.message ? e.message : e));
    }
  }
}

console.log(`L0 done: ${oks} ok, ${fails} fail`);
process.exit(fails > 0 ? 1 : 0);
