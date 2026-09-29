/*!
 * liquid-glass.js — Apple-style liquid glass refraction for web elements.
 * Provides physical lens displacement, chromatic fringe, and crystal clarity.
 * Adapted for iOS 27 Liquid Glass Navigation Bar.
 */
(function (global) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  let uid = 0;
  let svgDefs = null;

  // Check support for SVG filters in backdrop-filter
  const supported = (() => {
    const ua = navigator.userAgent;
    const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
    const isFirefox = /Firefox/.test(ua);
    if (isSafari || isFirefox) return false;
    if (!CSS.supports("backdrop-filter", "url(#lg)")) return false;
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 4;
      c.getContext("2d").getImageData(0, 0, 1, 1);
      return true;
    } catch (_) {
      return false;
    }
  })();

  function ensureDefs() {
    if (svgDefs) return svgDefs;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svg.style.pointerEvents = "none";
    svg.style.overflow = "hidden";
    svgDefs = document.createElementNS(SVG_NS, "defs");
    svg.appendChild(svgDefs);
    document.body.appendChild(svg);
    return svgDefs;
  }

  // Displacement map with gradient-difference method:
  // Red ramp encodes X displacement, Blue ramp encodes Y displacement.
  // Center is neutral gray (128,128,128) for 100% zero-distortion crystal clarity.
  // The outer border zone produces the physical lens refraction bend.
  function makeMap(w, h, radius, border, mapBlur) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    const ctx = canvas.getContext("2d");

    // X displacement gradient (Red)
    const gx = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gx.addColorStop(0, "rgb(0,0,0)");
    gx.addColorStop(1, "rgb(255,0,0)");
    ctx.fillStyle = gx;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Y displacement gradient (Blue)
    const gy = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gy.addColorStop(0, "rgb(0,0,0)");
    gy.addColorStop(1, "rgb(0,0,255)");
    ctx.globalCompositeOperation = "difference";
    ctx.fillStyle = gy;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Inset neutral gray (128, 128, 128) - 100% crystal clear center
    ctx.globalCompositeOperation = "source-over";
    const inset = Math.max(12, border * Math.min(canvas.width, canvas.height));
    ctx.filter = "blur(" + mapBlur + "px)";
    ctx.fillStyle = "rgba(128, 128, 128, 0.96)";
    ctx.beginPath();
    const cornerRadius = Math.max(radius - inset, 4);
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(inset, inset, canvas.width - inset * 2, canvas.height - inset * 2, cornerRadius);
    } else {
      ctx.rect(inset, inset, canvas.width - inset * 2, canvas.height - inset * 2);
    }
    ctx.fill();
    ctx.filter = "none";

    return canvas.toDataURL();
  }

  // 3-pass chromatic aberration refraction filter
  function buildFilter(id, scales) {
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.setAttribute("id", id);
    filter.setAttribute("x", "-5%");
    filter.setAttribute("y", "-5%");
    filter.setAttribute("width", "110%");
    filter.setAttribute("height", "110%");
    filter.setAttribute("color-interpolation-filters", "sRGB");

    const feImage = document.createElementNS(SVG_NS, "feImage");
    feImage.setAttribute("x", "0");
    feImage.setAttribute("y", "0");
    feImage.setAttribute("result", "map");
    feImage.setAttribute("preserveAspectRatio", "none");
    filter.appendChild(feImage);

    const keep = [
      "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
      "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
      "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
    ];
    const channels = [];
    for (let i = 0; i < 3; i++) {
      const disp = document.createElementNS(SVG_NS, "feDisplacementMap");
      disp.setAttribute("in", "SourceGraphic");
      disp.setAttribute("in2", "map");
      disp.setAttribute("scale", scales[i]);
      disp.setAttribute("xChannelSelector", "R");
      disp.setAttribute("yChannelSelector", "B");
      disp.setAttribute("result", "d" + i);
      filter.appendChild(disp);

      const cm = document.createElementNS(SVG_NS, "feColorMatrix");
      cm.setAttribute("in", "d" + i);
      cm.setAttribute("type", "matrix");
      cm.setAttribute("values", keep[i]);
      cm.setAttribute("result", "c" + i);
      filter.appendChild(cm);
      channels.push("c" + i);
    }

    const blend1 = document.createElementNS(SVG_NS, "feBlend");
    blend1.setAttribute("in", channels[0]);
    blend1.setAttribute("in2", channels[1]);
    blend1.setAttribute("mode", "screen");
    blend1.setAttribute("result", "c01");
    filter.appendChild(blend1);

    const blend2 = document.createElementNS(SVG_NS, "feBlend");
    blend2.setAttribute("in", "c01");
    blend2.setAttribute("in2", channels[2]);
    blend2.setAttribute("mode", "screen");
    filter.appendChild(blend2);

    ensureDefs().appendChild(filter);
    return { filter, feImage };
  }

  function resolveRadius(el, w, h, override) {
    if (override != null) return override;
    const raw = getComputedStyle(el).borderTopLeftRadius || "50px";
    const v = parseFloat(raw) || 50;
    return raw.trim().endsWith("%") ? (v / 100) * Math.min(w, h) : v;
  }

  function liquidGlass(el, opts) {
    const o = Object.assign(
      {
        scale: -125,       // Strong optical lens displacement
        chroma: 8,         // Vivid chromatic aberration prism fringe
        border: 0.12,      // 4-side perimeter refraction zone
        mapBlur: 14,       // Smooth optical curvature
        blur: 0,           // 100% Crystal clear interior
        saturate: 1.6,     // High-definition vibrancy
        radius: 50,
        fallbackBlur: 0
      },
      opts
    );

    if (!supported) {
      // High-performance optic clarity fallback for unsupported engines
      const fallbackFilter = "blur(" + o.blur + "px) saturate(" + o.saturate + ") contrast(104%)";
      el.style.setProperty("backdrop-filter", fallbackFilter, "important");
      el.style.setProperty("-webkit-backdrop-filter", fallbackFilter, "important");
      el.classList.add("lg-active");
      return {
        supported: false,
        refresh: function () {},
        destroy: function () {
          el.style.backdropFilter = "";
          el.style.webkitBackdropFilter = "";
          el.classList.remove("lg-active");
        },
      };
    }

    const id = "lg-filter-" + (++uid);
    const scales = [o.scale, o.scale + o.chroma, o.scale + 2 * o.chroma];
    const parts = buildFilter(id, scales);

    function refresh() {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) return;
      const radius = resolveRadius(el, w, h, o.radius);
      parts.feImage.setAttribute("href", makeMap(w, h, radius, o.border, o.mapBlur));
      parts.feImage.setAttribute("width", w);
      parts.feImage.setAttribute("height", h);
    }

    refresh();
    const filterVal = "url(#" + id + ") blur(" + o.blur + "px) saturate(" + o.saturate + ") contrast(104%)";
    el.style.setProperty("backdrop-filter", filterVal, "important");
    el.style.setProperty("-webkit-backdrop-filter", filterVal, "important");
    el.classList.add("lg-active");

    let timer = null;
    const ro = new ResizeObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(refresh, 80);
    });
    ro.observe(el);

    return {
      supported: true,
      refresh: refresh,
      destroy: function () {
        ro.disconnect();
        clearTimeout(timer);
        parts.filter.remove();
        el.style.backdropFilter = "";
        el.style.webkitBackdropFilter = "";
        el.classList.remove("lg-active");
      },
    };
  }

  global.liquidGlass = liquidGlass;
})(window);
