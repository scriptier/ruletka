/**
 * Local QR helper (no third-party image API).
 * Uses vendored qrcode-generator (Kazuhiko Arase / MIT).
 */
(function (global) {
  function makeQr(text, errLevel) {
    if (typeof qrcode !== "function") {
      throw new Error("qrcode-generator not loaded");
    }
    var qr = qrcode(0, errLevel || "M");
    qr.addData(String(text || ""), "Byte");
    qr.make();
    return qr;
  }

  /**
   * Render QR into a container as a canvas (crisp on retina).
   * @param {HTMLElement} el
   * @param {string} text
   * @param {{ size?: number, margin?: number, alt?: string, dark?: string, light?: string }} [opts]
   */
  function renderQr(el, text, opts) {
    if (!el) return null;
    opts = opts || {};
    var size = Math.max(80, opts.size || 140);
    var marginMod = opts.margin != null ? opts.margin : 2;
    var dark = opts.dark || "#0a0b0e";
    var light = opts.light || "#ffffff";
    var alt = opts.alt || "QR code";

    el.innerHTML = "";
    try {
      var qr = makeQr(text, "M");
      var count = qr.getModuleCount();
      var scale = Math.floor(size / (count + marginMod * 2));
      if (scale < 2) scale = 2;
      var canvas = document.createElement("canvas");
      var dim = (count + marginMod * 2) * scale;
      canvas.width = dim;
      canvas.height = dim;
      canvas.style.width = size + "px";
      canvas.style.height = size + "px";
      canvas.style.borderRadius = "10px";
      canvas.style.display = "block";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", alt);
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, dim, dim);
      ctx.fillStyle = dark;
      for (var r = 0; r < count; r++) {
        for (var c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect(
              (c + marginMod) * scale,
              (r + marginMod) * scale,
              scale,
              scale
            );
          }
        }
      }
      el.appendChild(canvas);
      return canvas;
    } catch (e) {
      // Fallback: show the URL as selectable text (still usable offline)
      var p = document.createElement("p");
      p.className = "qr-fallback-text";
      p.textContent = String(text || "");
      p.style.cssText =
        "font-size:0.72rem;word-break:break-all;max-width:" +
        size +
        "px;margin:0;padding:0.5rem;opacity:0.85";
      el.appendChild(p);
      console.warn("[qr]", e);
      return null;
    }
  }

  global.RuletQr = {
    render: renderQr,
    make: makeQr,
  };
})(typeof window !== "undefined" ? window : globalThis);
