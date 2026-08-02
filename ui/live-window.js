/**
 * Shared “tonight live” window helper (local browser time).
 * Goal: tell users when to show up so the pool isn’t always alone.
 *
 * Default window: 18:00–23:00 local (evening peak for RU / casual chat).
 */
(function (global) {
  var START_H = 18;
  var END_H = 23;

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function fmtHour(h) {
    return pad2(h) + ":00";
  }

  /**
   * @param {Date} [now]
   * @returns {{
   *   inWindow: boolean,
   *   startH: number,
   *   endH: number,
   *   startLabel: string,
   *   endLabel: string,
   *   rangeLabel: string,
   *   hoursUntilStart: number,
   *   hoursLeftInWindow: number,
   *   phase: "open"|"soon"|"later"|"overnight"
   * }}
   */
  function getState(now) {
    now = now || new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var frac = h + m / 60;
    var inWindow = frac >= START_H && frac < END_H;
    var hoursUntilStart = 0;
    var hoursLeftInWindow = 0;
    var phase = "later";

    if (inWindow) {
      hoursLeftInWindow = Math.max(0, END_H - frac);
      phase = "open";
    } else if (frac < START_H) {
      hoursUntilStart = START_H - frac;
      phase = hoursUntilStart <= 3 ? "soon" : "later";
    } else {
      // After END_H → next window is tomorrow evening
      hoursUntilStart = 24 - frac + START_H;
      phase = "overnight";
    }

    return {
      inWindow: inWindow,
      startH: START_H,
      endH: END_H,
      startLabel: fmtHour(START_H),
      endLabel: fmtHour(END_H),
      rangeLabel: fmtHour(START_H) + "–" + fmtHour(END_H),
      hoursUntilStart: Math.ceil(hoursUntilStart * 10) / 10,
      hoursLeftInWindow: Math.ceil(hoursLeftInWindow * 10) / 10,
      phase: phase,
    };
  }

  /**
   * Build localized lines via a dictionary lookup function.
   * @param {(key: string, fallback: string, vars?: object) => string} t
   * @param {{ hasPeople?: boolean, online?: number }} [ctx]
   */
  function homeBusyLine(t, ctx) {
    ctx = ctx || {};
    var st = getState();
    var hasPeople = !!ctx.hasPeople;
    var online = Number(ctx.online) || 0;

    if (hasPeople && online > 0) {
      return {
        text: t(
          "home.busyNow",
          "People online now — Start chatting is the fastest path."
        ),
        className: "is-live",
        phase: "live",
      };
    }

    if (st.inWindow) {
      return {
        text: t(
          "home.windowOpen",
          "Tonight live is open ({range}) — join now or invite a friend so you’re not alone.",
          { range: st.rangeLabel }
        ),
        className: "is-window-open",
        phase: "open",
      };
    }

    if (st.phase === "soon") {
      return {
        text: t(
          "home.windowSoon",
          "Tonight live starts at {start} (in ~{h}h). Set a reminder — bring a friend.",
          { start: st.startLabel, h: Math.max(1, Math.ceil(st.hoursUntilStart)) }
        ),
        className: "is-window-soon",
        phase: "soon",
      };
    }

    return {
      text: t(
        "home.windowLater",
        "Best odds: {range} local. Quiet now — invite a friend for the evening window.",
        { range: st.rangeLabel }
      ),
      className: "is-window-later",
      phase: st.phase,
    };
  }

  /**
   * Alone-search / empty-pool lead on live.
   * @param {(key: string, fallback: string, vars?: object) => string} t
   */
  function aloneLeadLine(t) {
    var st = getState();
    if (st.inWindow) {
      return t(
        "friends.aloneWindowOpen",
        "Live window is open ({range}) but the pool is quiet — Share invite so a friend joins now.",
        { range: st.rangeLabel }
      );
    }
    if (st.phase === "soon") {
      return t(
        "friends.aloneWindowSoon",
        "Pool is quiet. Tonight live starts at {start} — share invite and meet then.",
        { start: st.startLabel }
      );
    }
    return t(
      "friends.aloneWindowLater",
      "Pool is quiet. Best odds {range} local — invite a friend for the same slot.",
      { range: st.rangeLabel }
    );
  }

  /**
   * Idle empty chip text under Start.
   */
  function idleChipLine(t) {
    var st = getState();
    if (st.inWindow) {
      return t(
        "remote.windowChipOpen",
        "Tonight live · open now · {range}",
        { range: st.rangeLabel }
      );
    }
    return t(
      "remote.windowChipNext",
      "Tonight live · {start}–{end} local",
      { start: st.startLabel, end: st.endLabel }
    );
  }

  /**
   * Simple template replace {key} from vars.
   */
  function fill(str, vars) {
    if (!vars) return str;
    return String(str).replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] != null ? String(vars[k]) : "";
    });
  }

  global.RuletLiveWindow = {
    START_H: START_H,
    END_H: END_H,
    getState: getState,
    homeBusyLine: homeBusyLine,
    aloneLeadLine: aloneLeadLine,
    idleChipLine: idleChipLine,
    fill: fill,
  };
})(typeof window !== "undefined" ? window : globalThis);
