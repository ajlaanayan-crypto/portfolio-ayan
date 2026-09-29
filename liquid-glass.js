/*!
 * liquid-glass.js — Authentic Apple-style liquid glass optical refraction.
 * Uses real SVG feDisplacementMap & chromatic dispersion to physically warp
 * and refract DOM content scrolling behind the navbar.
 * Optimized for production deployments (Netlify, Safari iOS, Chrome desktop/mobile).
 */
(function (global) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK_NS = "http://www.w3.org/1999/xlink";
  let uid = 0;
  let svgDefs = null;

  function ensureDefs() {
    if (svgDefs && svgDefs.parentNode) return svgDefs;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svg.style.pointerEvents = "none";
    svg.style.overflow = "hidden";
    svg.style.opacity = "0";
    svgDefs = document.createElementNS(SVG_NS, "defs");
    svg.appendChild(svgDefs);
    document.body.appendChild(svg);
    return svgDefs;
  }

  // Generate 4-sided physical displacement map:
  // Red channel encodes X refraction, Blue channel encodes Y refraction.
  // Center is strictly neutral gray (128, 128, 128) for 100% zero-distortion crystal clarity.
  // The outer 4 borders create physical lens curvature and light bending.
  function makeMap(w, h, radius, border, mapBlur) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    const ctx = canvas.getContext("2d");

    // X displacement gradient (Red channel: left to right)
    const gx = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gx.addColorStop(0, "rgb(0,0,0)");
    gx.addColorStop(1, "rgb(255,0,0)");
    ctx.fillStyle = gx;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Y displacement gradient (Blue channel: top to bottom)
    const gy = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gy.addColorStop(0, "rgb(0,0,0)");
    gy.addColorStop(1, "rgb(0,0,255)");
    ctx.globalCompositeOperation = "difference";
    ctx.fillStyle = gy;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Inset neutral gray (128, 128, 128) - 100% crystal-clear distortion-free center
    ctx.globalCompositeOperation = "source-over";
    const inset = Math.max(14, border * Math.min(canvas.width, canvas.height));
    ctx.filter = "blur(" + mapBlur + "px)";
    ctx.fillStyle = "rgba(128, 128, 128, 0.98)";
    ctx.beginPath();
    const cornerRadius = Math.max(radius - inset, 4);
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(inset, inset, canvas.width - inset * 2, canvas.height - inset * 2, cornerRadius);
    } else {
      ctx.rect(inset, inset, canvas.width - inset * 2, canvas.height - inset * 2);
    }
    ctx.fill();
    ctx.filter = "none";

    return canvas.toDataURL("image/png");
  }

  // Build 3-channel chromatic aberration refraction filter
  function buildFilter(id, scales) {
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.setAttribute("id", id);
    filter.setAttribute("x", "-10%");
    filter.setAttribute("y", "-10%");
    filter.setAttribute("width", "120%");
    filter.setAttribute("height", "120%");
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
    const dispNodes = [];
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
      dispNodes.push(disp);

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
    return { filter, feImage, dispNodes };
  }

  function resolveRadius(el, w, h, override) {
    if (override != null) return override;
    const raw = getComputedStyle(el).borderTopLeftRadius || "50px";
    const v = parseFloat(raw) || 50;
    return raw.trim().endsWith("%") ? (v / 100) * Math.min(w, h) : v;
  }

  function liquidGlass(el, opts) {
    if (!el) return;

    const o = Object.assign(
      {
        scale: -140,       // Optical displacement intensity
        chroma: 10,        // Chromatic aberration prism dispersion
        border: 0.16,      // 4-side perimeter refraction zone
        mapBlur: 14,       // Smooth optical curvature
        blur: 0,           // 100% Crystal clear interior
        saturate: 1.65,    // Optical vibrancy
        radius: 50
      },
      opts
    );

    const id = "lg-filter-" + (++uid);
    const baseScales = [o.scale, o.scale + o.chroma, o.scale + 2 * o.chroma];
    const parts = buildFilter(id, baseScales);

    function refresh() {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) return;
      const radius = resolveRadius(el, w, h, o.radius);
      const dataUrl = makeMap(w, h, radius, o.border, o.mapBlur);
      parts.feImage.setAttribute("href", dataUrl);
      parts.feImage.setAttributeNS(XLINK_NS, "xlink:href", dataUrl);
      parts.feImage.setAttribute("width", w);
      parts.feImage.setAttribute("height", h);
    }

    refresh();

    // Apply real SVG displacement backdrop-filter
    const filterVal = "url(#" + id + ") blur(" + o.blur + "px) saturate(" + o.saturate + ") contrast(104%)";
    el.style.setProperty("backdrop-filter", filterVal, "important");
    el.style.setProperty("-webkit-backdrop-filter", filterVal, "important");
    el.classList.add("lg-active");

    // Dynamic Scroll-reactive Liquid Momentum Refraction
    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;
    let animFrame = null;

    function onScroll() {
      const currentScrollY = window.scrollY;
      const delta = Math.abs(currentScrollY - lastScrollY);
      lastScrollY = currentScrollY;
      scrollVelocity = Math.min(delta * 0.8, 45); // Max flex boost

      if (!animFrame) {
        animFrame = requestAnimationFrame(updateScrollFlex);
      }
    }

    function updateScrollFlex() {
      animFrame = null;
      scrollVelocity *= 0.88;

      const dynamicScale = o.scale - scrollVelocity;
      const dynamicScales = [dynamicScale, dynamicScale + o.chroma, dynamicScale + 2 * o.chroma];

      parts.dispNodes.forEach((node, i) => {
        node.setAttribute("scale", dynamicScales[i]);
      });

      if (scrollVelocity > 0.5) {
        animFrame = requestAnimationFrame(updateScrollFlex);
      } else {
        parts.dispNodes.forEach((node, i) => {
          node.setAttribute("scale", baseScales[i]);
        });
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    let timer = null;
    const ro = new ResizeObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(refresh, 80);
    });
    ro.observe(el);

    return {
      refresh: refresh,
      destroy: function () {
        ro.disconnect();
        clearTimeout(timer);
        window.removeEventListener("scroll", onScroll);
        if (animFrame) cancelAnimationFrame(animFrame);
        parts.filter.remove();
        el.style.backdropFilter = "";
        el.style.webkitBackdropFilter = "";
        el.classList.remove("lg-active");
      },
    };
  }

  // Auto-init on all navbars
  function autoInit() {
    const navbars = document.querySelectorAll(".navbar, nav.fixed");
    navbars.forEach((nav) => {
      if (nav._liquidGlassInstance) return;
      nav._liquidGlassInstance = liquidGlass(nav);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }

  global.liquidGlass = liquidGlass;
})(window);
