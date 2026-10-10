#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const live = readFileSync(join(root, "ui/live.js"), "utf8");
const css = readFileSync(join(root, "ui/live-stage.css"), "utf8");
const html = readFileSync(join(root, "ui/live.html"), "utf8");
const hub = readFileSync(join(root, "bridge/src/simple.rs"), "utf8");
const en = readFileSync(join(root, "ui/i18n/en.json"), "utf8");
let fail = 0;
const ok = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    fail += 1;
  }
};
ok(live.includes("fence: 5"), "STAR_GIFT_COSTS fence");
ok(live.includes('fence: { ico: "⛓️"'), "giftKindMeta fence");
ok(live.includes("function giftKindMeta"), "giftKindMeta exists");
ok(live.includes("const meta = giftKindMeta(k);"), "impact uses giftKindMeta");
ok(live.includes("fx-flavor-fence"), "flavor cleanup includes fence");
ok(live.includes("stars.fenceOnYou"), "receive toast fence");
ok(html.includes('data-effect="fence"'), "stars sheet fence card");
ok(html.includes('id="remote-fx-fence"'), "remote fence overlay");
ok(!/fx-bars-mesh[\s\S]{0,400}fx-bars-fence\.png/.test(css), "bars mesh must not use fence PNG");
ok(css.includes("fx-bars-slam"), "bars slam-in");
ok(
  !/\.fx-flavor-bars[^\n]*video[\s\S]{0,80}filter:/.test(css),
  "bars must not filter:<video> (Chrome HW black)"
);
ok(
  !/\.fx-flavor-(flowers|heart|balloons|confetti|fireworks|pass_mic)[^\n]*video[\s\S]{0,80}filter:/.test(
    css
  ),
  "gift flavors must not filter:<video>"
);
ok(css.includes(".fx-fence-mesh"), "fence mesh CSS");
ok(
  !/fx-fence-mesh[\s\S]{0,500}repeating-linear-gradient/.test(css),
  "fence mesh must not stack CSS diamonds on the PNG"
);
ok(!hub.includes('"fence" => Some("bars")'), "hub must not alias fence to bars");
ok(hub.includes('"fence" | "chain" | "mesh" => Some("fence")'), "hub fence first-class");
ok(en.includes("stars.fenceOnYou"), "en fenceOnYou");
ok(en.includes("Steel jail bars"), "barsSub not chain-link");
ok(live.includes("function ensurePleaseStayFx"), "please stay bits");
ok(live.includes("function paintConnectingIdentity"), "name first while linking");
ok(live.includes("function firstRealMatchName"), "match name before ICE");
ok(live.includes("fw-v12-L"), "fireworks canvas-only face-safe chrys");
ok(live.includes('"chrys"'), "fireworks chrysanthemum shell");
ok(live.includes("function isFxLite"), "weak-GPU fxLite helper");
ok(
  !/soft\|none/i.test(live.split("function isFxLite")[1]?.slice(0, 1200) || ""),
  "fxLite must not treat WebGL none as weak (GPU PCs)"
);
ok(live.includes("if (isFxLite()) return;"), "fxLite gates canvas/NSFW");
ok(html.includes("fx-please-stay-layer"), "please stay layer in html");
ok(live.includes("wish.mp3"), "heart/flowers wish file");
ok(live.includes("oops.mp3"), "fence oops file");
ok(live.includes("GIFT_FILE_VOL = 0.1"), "gift files 10% volume");
ok(existsSync(join(root, "ui/sounds/wish.mp3")), "ui/sounds/wish.mp3");
ok(
  existsSync(join(root, "mobile/assets/sounds/wish.mp3")),
  "android wish.mp3"
);
ok(live.includes("function showStarGiftedPopup"), "star gifted popup");
ok(live.includes("STAR_GIFTED_POP_MS = 2600"), "popup ~2.6s");
ok(live.includes("star-gifted-comet"), "shooting-star comet");
ok(live.includes("star-gifted-back"), "3D back face");
ok(live.includes("star-gifted-mid"), "3D mid facet");
ok(live.includes("star-gifted-spec"), "specular slash");
ok(live.includes("star-gifted-shadow"), "ground shadow");
ok(live.includes('classList.add("is-go")'), "star fly starts after mount");
ok(css.includes("star-gifted-arc"), "arc path");
ok(css.includes("star-gifted-spin"), "spin while flying");
ok(css.includes("star-gifted-bloom"), "landing bloom");
ok(css.includes("translateZ(-140px)"), "approach in Z");
ok(live.includes("star-click.mp3"), "star click SFX");
ok(live.includes('kind === "crown"'), "crown SFX branch");
ok(live.includes('playGiftFile("royal.mp3")'), "crown uses royal.mp3");
ok(live.includes('playGiftFile("riz.mp3")'), "spotlight uses riz.mp3");
ok(live.includes('playGiftFile("portalenter.wav")'), "snow uses portalenter.wav");
ok(live.includes('playGiftFile("flame.mp3")'), "fireworks uses flame.mp3");
ok(existsSync(join(root, "ui/sounds/flame.mp3")), "ui/sounds/flame.mp3");
ok(
  existsSync(join(root, "mobile/assets/sounds/flame.mp3")),
  "android flame.mp3"
);
ok(existsSync(join(root, "ui/sounds/portalenter.wav")), "ui/sounds/portalenter.wav");
ok(
  existsSync(join(root, "mobile/assets/sounds/portalenter.wav")),
  "android portalenter.wav"
);
ok(existsSync(join(root, "ui/sounds/riz.mp3")), "ui/sounds/riz.mp3");
ok(
  existsSync(join(root, "mobile/assets/sounds/riz.mp3")),
  "android riz.mp3"
);
ok(existsSync(join(root, "ui/sounds/royal.mp3")), "ui/sounds/royal.mp3");
ok(
  existsSync(join(root, "mobile/assets/sounds/royal.mp3")),
  "android royal.mp3"
);
ok(live.includes("undertaker-bell.mp3"), "debate start bell");
ok(live.includes("ticktock.mp3"), "debate last-10s ticktock");
ok(live.includes("pressing.mp3"), "debate turn press");
ok(live.includes("repair.mp3"), "bars repair SFX");
ok(live.includes("good-job.mp3"), "balloons good-job SFX");
ok(live.includes("legendary-drop.mp3"), "★>3 legendary drop");
ok(live.includes("item-used.mp3"), "confetti item-used SFX");
ok(live.includes("received: true"), "admin grant uses gift popup");
ok(live.includes("reviewTeach"), "review teaches ★ is reputation");
ok(
  /function displaySlotStars[\s\S]{0,280}trust/.test(live),
  "partner ★ uses trust not max(wallet)"
);
ok(existsSync(join(root, "ui/sounds/item-used.mp3")), "ui/sounds/item-used.mp3");
ok(
  existsSync(join(root, "ui/sounds/legendary-drop.mp3")),
  "ui/sounds/legendary-drop.mp3"
);
ok(existsSync(join(root, "ui/sounds/good-job.mp3")), "ui/sounds/good-job.mp3");
ok(existsSync(join(root, "ui/sounds/repair.mp3")), "ui/sounds/repair.mp3");
ok(
  existsSync(join(root, "mobile/assets/sounds/repair.mp3")),
  "android repair.mp3"
);
ok(existsSync(join(root, "ui/sounds/ticktock.mp3")), "ui/sounds/ticktock.mp3");
ok(existsSync(join(root, "ui/sounds/pressing.mp3")), "ui/sounds/pressing.mp3");
ok(
  existsSync(join(root, "ui/sounds/undertaker-bell.mp3")),
  "ui/sounds/undertaker-bell.mp3"
);
ok(
  existsSync(join(root, "mobile/assets/sounds/undertaker-bell.mp3")),
  "android undertaker-bell.mp3"
);
ok(css.includes(".star-gifted-pop"), "popup CSS");
ok(
  existsSync(join(root, "ui/sounds/star-click.mp3")),
  "ui/sounds/star-click.mp3"
);
ok(
  existsSync(join(root, "mobile/assets/sounds/star-click.mp3")),
  "android star-click.mp3"
);
ok(existsSync(join(root, "ui/sounds/oops.mp3")), "ui/sounds/oops.mp3");
ok(
  existsSync(join(root, "mobile/assets/sounds/oops.mp3")),
  "android oops.mp3"
);
ok(live.includes("shooting_star: 3"), "shooting star costs 3");
ok(live.includes("function giftStarToConversationalist"), "avatar tap gifts a star");
ok(hub.includes('format!("gift:{kind}")'), "hub credits +1 wallet via gift:{kind}");
ok(hub.includes("fn gift_grants_wallet_star"), "hub grants helper");
ok(hub.includes('kind != "bars" && kind != "fence"'), "bars/fence no ★1");
ok(live.includes("function giftGrantsWalletStar"), "web grants helper");
ok(live.includes('k !== "bars" && k !== "fence"'), "web bars/fence no ★1");
ok(html.includes('data-gift="shooting_star"'), "gift strip keeps shooting star gift");
ok(!html.includes('id="btn-partner-shooting-star"'), "partner menu has no shooting star");
ok(html.includes('id="btn-partner-snow"'), "partner menu snow");
ok(html.includes('id="btn-partner-spotlight"'), "partner menu spotlight");
ok(html.includes('data-effect="shooting_star"'), "stars sheet keeps shooting star gift");
ok(!/const cosmeticKinds = \[[^\]]*"shooting_star"/.test(live), "overlay catalog excludes shooting star");
ok(en.includes("stars.shootingStarBtn"), "en shootingStarBtn");
ok(html.includes('id="remote-fx-snow"'), "snow overlay");
ok(html.includes('id="remote-fx-spotlight"'), "spotlight overlay");
ok(css.includes(".fx-snow"), "snow CSS");
ok(css.includes(".fx-spotlight"), "spotlight CSS");
ok(html.includes("fx-shooting-star-layer"), "shooting star layer");
ok(html.includes("fx-snow-layer"), "snow flake layer");
ok(html.includes("fx-spotlight-beam"), "spotlight beam");
ok(html.includes("fx-spotlight-shaft"), "spotlight shaft not iris");
ok(!html.includes("fx-spotlight-iris"), "no yellow iris circle");
ok(css.includes("fx-spot-sweep"), "spotlight beam sweep");
ok(css.includes("No radial hole"), "spotlight dim has no circular hole");
ok(
  css.includes("fx-spotlight-dim::before"),
  "spotlight dim wedges outside cone"
);
ok(
  !/\.fx-spotlight-beam[\s\S]{0,500}mix-blend-mode:\s*screen/.test(css),
  "spotlight beam must not mix-blend screen (gold ring)"
);
ok(live.includes("spot-v3-L"), "spotlight fixture v3");
ok(html.includes("fx-spotlight-can"), "spotlight can in html");
ok(css.includes(".fx-spotlight-can"), "spotlight can CSS");
ok(live.includes("function ensureShootingStarFx"), "ensureShootingStarFx");
ok(live.includes("function ensureSnowFlakes"), "ensureSnowFlakes");
ok(live.includes("function ensureSpotlightFx"), "ensureSpotlightFx");
ok(live.includes("crown: 5"), "STAR_GIFT_COSTS crown");
ok(live.includes("crown: 12"), "STAR_GIFT_SECS crown");
ok(live.includes('crown: { ico: "👑"'), "giftKindMeta crown");
ok(live.includes("function ensureCrownFx"), "ensureCrownFx");
ok(live.includes('spendEffectOnPartner("crown")'), "menu spends crown");
ok(hub.includes('"crown" | "crowns" | "king"'), "hub crown aliases");
ok(hub.includes('"crown" => (5, 12)'), "hub crown 5/12");
ok(html.includes('id="remote-fx-crown"'), "remote crown overlay");
ok(html.includes('id="local-fx-crown"'), "local crown overlay");
ok(html.includes('data-gift="crown"'), "gift strip crown");
ok(html.includes('data-effect="crown"'), "stars sheet crown");
ok(html.includes('id="btn-partner-crown"'), "partner menu crown");
ok(html.includes('id="btn-partner-heart"'), "partner menu heart");
ok(html.includes('data-i18n="stars.giftHeartName"'), "partner heart name-only");
ok(html.includes('data-i18n="stars.giftCrownName"'), "partner crown name-only");
ok(html.includes('class="pm-cost"'), "partner gift cost chip");
ok(
  !/id="btn-partner-crown"[\s\S]{0,280}they get/.test(html),
  "partner crown not verbose"
);
ok(live.includes("costEl.textContent = `${cost}★`"), "wireGiftBtn cost only");
ok(html.includes("fx-crown-dust"), "crown dust layer");
ok(html.includes("fx-crown-hero"), "crown hero");
ok(live.includes("svg-v8"), "crown royal 3d no sheen");
ok(live.includes("fx-crown-orbs"), "crown tip orbs group");
ok(css.includes(".fx-crown"), "crown CSS");
ok(css.includes("fx-crown-idle"), "crown idle");
ok(css.includes("fx-crown-mote"), "crown mote");
ok(en.includes("stars.crownBtn"), "en crownBtn");
ok(en.includes("stars.crownOnYou"), "en crownOnYou");
ok(live.includes("disco: 5"), "STAR_GIFT_COSTS disco");
ok(live.includes("function ensureDiscoFx"), "ensureDiscoFx");
ok(hub.includes('"disco" | "discoball"'), "hub disco aliases");
ok(hub.includes('"disco" => (5, 12)'), "hub disco 5/12");
ok(html.includes('id="remote-fx-disco"'), "remote disco overlay");
ok(html.includes('data-gift="disco"'), "gift strip disco");
ok(html.includes('id="btn-partner-disco"'), "partner menu disco");
ok(css.includes(".fx-disco-ball"), "disco ball CSS");
ok(en.includes("stars.discoBtn"), "en discoBtn");
ok(css.includes("fx-ss-arc"), "comet arc");
ok(live.includes("ss-v7-L"), "shooting star svg head v7");
ok(live.includes("stay-v2-L"), "please stay lock v2");
ok(live.includes("function ensurePassMicFx"), "pass mic svg injector");
ok(live.includes("fx-pass-mic-svg"), "pass mic svg class");
ok(css.includes(".fx-pass-mic-svg"), "pass mic svg CSS");
ok(live.includes("fx-please-stay-lock"), "please stay lock svg");
ok(live.includes("fx-ss-star"), "shooting star svg class");
ok(css.includes(".fx-ss-star"), "shooting star CSS");
ok(css.includes("fx-snow-tumble"), "snow 3d tumble");
{
  const sliceKf = (name) => {
    const start = css.indexOf(`@keyframes ${name}`);
    if (start < 0) return "";
    const open = css.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) return css.slice(start, i + 1);
      }
    }
    return "";
  };
  const snowKf = sliceKf("fx-snow-tumble");
  ok(!!snowKf, "snow tumble keyframes exist");
  ok(!/\btop\s*:/.test(snowKf), "snow tumble must not animate top (Chrome GPU freeze)");
  ok(/140vh/.test(snowKf), "snow falls via translateY");
  const balloonKf = sliceKf("fx-balloon-rise");
  ok(!!balloonKf, "balloon rise keyframes exist");
  ok(!/\bbottom\s*:/.test(balloonKf), "balloon rise must not animate bottom (Chrome GPU freeze)");
  ok(/-140vh/.test(balloonKf), "balloons rise via translateY");
  const confettiKf = sliceKf("fx-confetti-tumble");
  ok(!!confettiKf, "confetti tumble keyframes exist");
  ok(!/\btop\s*:/.test(confettiKf), "confetti tumble must not animate top");
  ok(/130vh/.test(confettiKf), "confetti falls via translateY");
  const discoKf = sliceKf("fx-disco-orb");
  ok(!!discoKf, "disco orb keyframes exist");
  ok(/0px/.test(discoKf), "disco orb from uses 0px not unitless 0");
}
ok(!/\.fx-snow[^\n]*filter:/.test(css), "snow must not filter video");
ok(!/\.fx-spotlight[^\n]*filter:/.test(css), "spotlight must not filter video");
ok(live.includes("heart-v8-L"), "heart 3d balloon tag");
ok(live.includes("flowers-v11-L"), "flowers double garland v11");
ok(live.includes("fx-bloom-leaf"), "flowers leaves");
ok(live.includes("function fxWhichForUserId"), "3-way gift tile map");
ok(live.includes("function ensureThirdFxHosts"), "third-tile FX hosts");
ok(live.includes("function ensureRemoteAFxClip"), "3-way FX clip to first face");
ok(live.includes("const fxBySlot"), "3-way FX expire per tile (third/remote2)");
ok(live.includes("function stopFxCanvas"), "stop balloon/snow/disco rAF on hide");
ok(live.includes('return "remote2"'), "remote2 FX not mapped to third");
ok(live.includes('ensureSlotFxHosts("remote2"'), "remote2-wrap FX hosts");
ok(live.includes("function drainPendingSignalsForPeer"), "1v2 drain pending before extra offer");
ok(
  /function findPcForPeer[\s\S]{0,400}meshPeerIdEq/.test(live),
  "findPcForPeer matches compact hub from_peer"
);
{
  const rtc = readFileSync(join(root, "ui/webrtc.js"), "utf8");
  ok(
    rtc.includes("Answerer: NEVER self-promote") &&
      !rtc.includes("promote answerer → offerer"),
    "answerer watchdog never promotes to offerer"
  );
}
ok(live.includes("function peerHasInboundOffer"), "1v2 glare: inbound offer → answer");
ok(live.includes("Never offer if they already sent us an offer"), "1v2 no dual-offer");
ok(live.includes("radialGradient"), "flower petal volume gradient");
ok(live.includes("fx-bloom-wreath"), "flowers CSS blooms not emoji soup");
ok(live.includes("svg-v3"), "heart radial 3d no sheen");
ok(css.includes("rotateY(-32deg)"), "heart 3d yaw");
ok(live.includes("dataset.heartPlay"), "heart plays once per until");
ok(live.includes("heart: 5"), "heart costs 5");
ok(css.includes("fx-heart-balloon"), "heart balloon inflate");
ok(hub.includes('"heart" => (5, 3)'), "hub heart 5/3");
ok(live.includes("svg-v3"), "heart 3d SVG no sheen");
ok(live.includes("svg-v8"), "crown SVG no sheen");
ok(live.includes("balloons-v9-L"), "balloons latex svg v9");
ok(live.includes("function startFxWaapiTravel"), "WAAPI balloon/snow/confetti travel");
ok(live.includes("function playBalloonsCanvasRise"), "canvas balloons always rise");
ok(live.includes("function playDiscoCanvasClub"), "canvas disco club rig");
ok(live.includes("function playSnowCanvasFall"), "canvas snow always falls");
ok(live.includes("function playFlowersCanvasDrift"), "canvas flowers drift");
ok(live.includes("drawRosePetal"), "3D rose petal bezier");
ok(live.includes("function playSpotlightCanvasSweep"), "canvas spotlight sweep");
ok(
  live.includes("playConfettiCanvasFall") ||
    (live.includes("fx-confetti") && /recycle/.test(live)),
  "canvas confetti fall"
);
ok(live.includes("fx-balloon-svg"), "balloon svg class");
ok(live.includes("snow-v7-L"), "snow crystals v7");
ok(live.includes("disco-v6-L"), "disco 3d spin v6");
ok(live.includes("friend-av-wrap"), "friends presence wrap");
ok(css.includes(".friend-av-wrap::after"), "friends presence dot");
ok(css.includes(".friend-row.online .friend-av-wrap::after"), "friends online green");
ok(live.includes("confetti-v8-L"), "confetti 3d tumble v8");
ok(css.includes("fx-confetti-tumble"), "confetti tumble CSS");
ok(live.includes("fx-disco-orb"), "disco rim orbs");
ok(css.includes("rotateY(-7deg)"), "crown 3d idle yaw");
ok(css.includes(".fx-disco-orb"), "disco orb CSS");
ok(css.includes("animation-direction: alternate"), "disco orbs ping-pong");
ok(!/gSheen/.test(live), "crown markup has no sheen gradient");
ok(!/fx-heart-sheen[\s\S]{0,80}fill=/.test(live), "heart markup has no sheen rect");
ok(
  !/function ensureHeartsFx[\s\S]{0,1200}fx-heart-bit/.test(live),
  "ensureHeartsFx does not emit bits"
);
ok(html.includes("fx-heart-hero"), "heart hero host");
ok(html.includes("fx-heart-dust"), "heart dust layer");
ok(
  !/\.fx-heart-hero\s*\{[^}]*display:\s*none/.test(css),
  "heart hero is visible"
);
ok(
  !/\.fx-overlay\.fx-lvl-[23] \.fx-heart-hero\s*\{[^}]*\btransform:/.test(css),
  "L2/L3 must not override hero transform"
);
ok(!/\.fx-heart[^\n]*filter:/.test(css), "heart overlay must not filter video");
ok(html.includes('id="remote-avatar-letter"'), "remote-avatar-letter");
ok(html.includes('id="local-avatar-letter"'), "local-avatar-letter");
ok(live.includes("call-toast-av"), "call-toast-av");
ok(
  /function setTileAvatar[\s\S]{0,1200}(remote-avatar-letter|avatarLetterFromName)/.test(
    live
  ),
  "setTileAvatar letter fallback"
);
ok(css.includes(".call-toast-av"), ".call-toast-av");
ok(css.includes(".tile-avatar-letter"), ".tile-avatar-letter");
ok(live.includes('sent: true'), "shooting-star sender comet popup");
ok(live.includes("#remote-avatar-stars"), "avatar stack tap gifts a star");
{
  const pinJs = html.includes("live.js?v=859");
  const pinCss = html.includes("live-stage.css?v=572");
  if (pinJs || pinCss) {
    ok(pinJs, "live.js pin 859");
    ok(pinCss, "live-stage.css pin 572");
  } else {
    console.log("note pin pending live.js?v=856 live-stage.css?v=569");
  }
}
if (fail) process.exit(1);
console.log("ok gift-kinds", "asserts");
