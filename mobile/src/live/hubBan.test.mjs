import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

// Load the real TS module (same approach as pipLayout.test.mjs).
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "hubBan.ts"), "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const tmp = join(mkdtempSync(join(tmpdir(), "hubban-")), "hubBan.mjs");
writeFileSync(tmp, js);
const { parseHubBan, isHubBanActive, banCopy, banDurationKey, partnerBannedRecently } =
  await import(pathToFileURL(tmp).href);

const NOW = 1_800_000_000_000;

// Real overlay strings + the app's {var} format.
const ru = JSON.parse(readFileSync(join(here, "../i18n/overlay/ru.json"), "utf8"));
const en = JSON.parse(readFileSync(join(here, "../i18n/overlay/en.json"), "utf8"));
const tOf = (o) => (k, vars) =>
  String(o[k] ?? en[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => String(vars?.[n] ?? ""));

// parse: level 1 with hub `until` (unix seconds)
{
  const b = parseHubBan({ reason: "genitals", secs: 86400, until: NOW / 1000 + 86400, level: 1 }, NOW);
  assert.deepEqual(b, { permanent: false, level: 1, untilMs: NOW + 86400_000 });
  assert.equal(isHubBanActive(b, NOW), true);
  assert.equal(isHubBanActive(b, NOW + 86400_001), false);
  assert.equal(banDurationKey(b), "mobile.ban.dur24h");
}
// parse: secs only → end time from now
{
  const b = parseHubBan({ secs: 60, level: 2 }, NOW);
  assert.equal(b.untilMs, NOW + 60_000);
  assert.equal(banDurationKey(b), "mobile.ban.dur7d");
}
// parse: permanent by flag or by level 3
{
  assert.equal(parseHubBan({ permanent: true, until: 5 }, NOW).permanent, true);
  assert.equal(parseHubBan({ permanent: true, until: 5 }, NOW).untilMs, 0);
  const l3 = parseHubBan({ level: 3 }, NOW);
  assert.equal(l3.permanent, true);
  assert.equal(isHubBanActive(l3, NOW + 1e12), true);
  assert.equal(isHubBanActive(null, NOW), false);
}
// garbage in → inactive, not a crash
{
  const b = parseHubBan({ level: "x", until: "nope" }, NOW);
  assert.deepEqual(b, { permanent: false, level: 0, untilMs: 0 });
  assert.equal(isHubBanActive(b, NOW), false);
}

// Russian copy: duration + end time
{
  const b = parseHubBan({ until: NOW / 1000 + 86400, level: 1 }, NOW);
  const c = banCopy(b, tOf(ru), "ru");
  assert.equal(c.title, "Вы заблокированы");
  assert.match(c.body, /^Вы заблокированы на 24 часа за показ гениталий на камеру\./);
  assert.match(c.until, /^До: .+/);
  assert.equal(c.ok, "Понятно");
  const c7 = banCopy(parseHubBan({ until: NOW / 1000 + 7 * 86400, level: 2 }, NOW), tOf(ru), "ru");
  assert.match(c7.body, /на 7 дней/);
}
// permanent: no end line
{
  const c = banCopy(parseHubBan({ permanent: true, level: 3 }, NOW), tOf(ru), "ru");
  assert.match(c.body, /навсегда/);
  assert.equal(c.until, "");
}
// English fallback for a language without the key
{
  const c = banCopy(parseHubBan({ until: NOW / 1000 + 10, level: 1 }, NOW), tOf({}), "en");
  assert.match(c.body, /^You are banned for 24 hours/);
}

// Every overlay carries the new keys and keeps {dur} / {when}.
{
  const dir = join(here, "../i18n/overlay");
  const keys = [
    "mobile.live.partnerBanned",
    "mobile.ban.title",
    "mobile.ban.bodyGenitals",
    "mobile.ban.bodyPermanent",
    "mobile.ban.dur24h",
    "mobile.ban.dur7d",
    "mobile.ban.until",
    "mobile.ban.ok",
  ];
  for (const lang of ["ar", "bg", "cs", "de", "en", "es", "fr", "id", "it", "pl", "pt", "ru", "sr", "tr", "uk", "zh"]) {
    const o = JSON.parse(readFileSync(join(dir, `${lang}.json`), "utf8"));
    for (const k of keys) assert.ok(String(o[k] || "").trim(), `${lang} missing ${k}`);
    assert.ok(o["mobile.ban.bodyGenitals"].includes("{dur}"), `${lang} bodyGenitals needs {dur}`);
    assert.ok(o["mobile.ban.until"].includes("{when}"), `${lang} until needs {when}`);
  }
  assert.equal(ru["mobile.live.partnerBanned"], "Собеседник заблокирован за нарушение правил");
}

// partner_banned notice window
assert.equal(partnerBannedRecently(NOW - 1000, NOW), true);
assert.equal(partnerBannedRecently(NOW - 9000, NOW), false);
assert.equal(partnerBannedRecently(0, NOW), false);

console.log("hubBan OK");
