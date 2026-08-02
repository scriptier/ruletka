/**
 * Ready-to-paste invite copy for growth (Telegram / SMS / stories).
 * Used on homepage pack + live friend share.
 */
(function (global) {
  function rangeLabel() {
    try {
      if (global.RuletLiveWindow && RuletLiveWindow.getState) {
        return RuletLiveWindow.getState().rangeLabel || "18:00–23:00";
      }
    } catch (_) {}
    return "18:00–23:00";
  }

  function fill(str, vars) {
    return String(str || "").replace(/\{(\w+)\}/g, function (_, k) {
      return vars && vars[k] != null ? String(vars[k]) : "";
    });
  }

  /**
   * @param {{
   *   brand?: string,
   *   url?: string,
   *   code?: string,
   *   online?: number,
   *   liveNow?: boolean,
   *   lang?: string,
   *   t?: (key: string, fallback: string) => string
   * }} opts
   */
  function buildPack(opts) {
    opts = opts || {};
    var brand = opts.brand || "ruletka.vip";
    var url = opts.url || (typeof location !== "undefined" ? location.origin + "/live.html" : "https://ruletka.vip/live.html");
    var code = (opts.code || "").toUpperCase();
    var online = Number(opts.online) || 0;
    var liveNow = !!opts.liveNow;
    var range = rangeLabel();
    var t = opts.t || function (_k, fb) {
      return fb;
    };

    var title;
    var body;
    if (liveNow && code) {
      title = t(
        "invite.packLiveTitle",
        "I’m live on {brand} — add me"
      );
      body = t(
        "invite.packLiveBody",
        "I’m on {brand} right now (peer-to-peer video, no account).\n\n1) Open: {url}\n2) Add my code: {code}\n3) I Accept → Call when Online\n\nTonight window: {range}"
      );
    } else if (online > 0) {
      title = t("invite.packLiveTitle", "Join me on {brand}");
      body = t(
        "invite.packOnlineBody",
        "{n} people online on {brand} now — random video chat or friends Call.\n\nOpen: {url}\nNo account · video stays browser-to-browser."
      );
    } else if (code) {
      title = t("invite.packTitle", "Join me on {brand} tonight");
      body = t(
        "invite.packBodyCode",
        "Let’s try {brand} together during tonight live ({range}).\n\n1) Open: {url}\n2) Add my friend code: {code}\n3) Accept → Call when both Online\n\nPeer-to-peer video · no account · Block/Report built in."
      );
    } else {
      title = t("invite.packTitle", "Join me on {brand} tonight");
      body = t(
        "invite.packBody",
        "Let’s try {brand} during tonight live ({range}) so we’re not alone.\n\nOpen: {url}\n\nRandom video chat or Call friends · no account · P2P video."
      );
    }

    var vars = {
      brand: brand,
      url: url,
      code: code,
      range: range,
      n: String(online),
    };
    title = fill(title, vars);
    body = fill(body, vars);
    var full = body;
    // Ensure URL is present once at end if missing
    if (url && full.indexOf(url) === -1) {
      full = full.replace(/\s+$/, "") + "\n\n" + url;
    }
    return {
      title: title,
      body: body,
      full: full,
      range: range,
      url: url,
      code: code,
    };
  }

  /** Short one-liner for native share sheets. */
  function buildShareLine(opts) {
    var pack = buildPack(opts);
    var code = opts && opts.code;
    if (code) {
      return fill(
        (opts.t &&
          opts.t(
            "invite.shareLineCode",
            "{brand}: add me {code} then Call · {url}"
          )) ||
          "{brand}: add me {code} then Call · {url}",
        {
          brand: opts.brand || "ruletka.vip",
          code: code,
          url: pack.url,
        }
      );
    }
    return pack.title + " · " + pack.url;
  }

  global.RuletInviteCopy = {
    buildPack: buildPack,
    buildShareLine: buildShareLine,
    rangeLabel: rangeLabel,
    fill: fill,
  };
})(typeof window !== "undefined" ? window : globalThis);
