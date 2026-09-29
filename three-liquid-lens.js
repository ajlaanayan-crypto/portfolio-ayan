/*!
 * three-liquid-lens.js
 * Hardware-accelerated Three.js Physical Liquid Lens Refraction Shader.
 * Implements Snell's Law refraction, physical dispersion, Fresnel caustics,
 * and dynamic scroll-reactive liquid response for iOS 27 Liquid Glass Navigation.
 * Designed for 100% cross-platform reliability on Netlify, Chrome, Safari, Firefox.
 */
(function (global) {
  "use strict";

  function createThreeLiquidLens(nav) {
    if (!nav || nav._hasThreeLiquidLens) return;
    if (typeof THREE === "undefined") {
      console.warn("Three.js not loaded yet; deferring liquid lens init.");
      setTimeout(() => createThreeLiquidLens(nav), 50);
      return;
    }
    nav._hasThreeLiquidLens = true;

    // Create Three.js WebGL canvas
    const canvas = document.createElement("canvas");
    canvas.className = "three-liquid-lens-canvas";
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.borderRadius = "inherit";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "1";
    nav.insertBefore(canvas, nav.firstChild);

    // Three.js Scene & Orthographic Camera
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Three.js WebGL Renderer
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch (e) {
      console.warn("WebGL initialization failed:", e);
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);

    // Full-quad geometry
    const geometry = new THREE.PlaneGeometry(2, 2);

    // Custom physical liquid lens shader uniforms
    const uniforms = {
      u_resolution: { value: new THREE.Vector2(100, 50) },
      u_time: { value: 0.0 },
      u_mouse: { value: new THREE.Vector2(0.0, 0.5) },
      u_scroll_delta: { value: 0.0 },
      u_scroll_y: { value: 0.0 },
      u_dark_mode: { value: 0.0 },
      u_border_radius: { value: 50.0 },
    };

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;
      varying vec2 vUv;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform float u_scroll_delta;
      uniform float u_scroll_y;
      uniform float u_dark_mode;
      uniform float u_border_radius;

      // Signed Distance Field for a 2D rounded rectangle
      float sdRoundedBox(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + r;
        return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
      }

      void main() {
        vec2 p = (vUv - 0.5) * u_resolution;
        vec2 halfSize = u_resolution * 0.5;

        // Rounded capsule boundary check
        float d = sdRoundedBox(p, halfSize, u_border_radius);
        if (d > 0.0) {
          discard;
        }

        // Normalized coordinates spanning the single continuous lens (-1.0 to 1.0)
        vec2 uv = p / max(vec2(1.0), halfSize);

        // SINGLE UNIFIED LENS DOME OPTICS:
        // The entire navbar is a single continuous convex glass lens slab.
        float distFromCenter = length(p);
        float maxDist = max(1.0, distFromCenter - d);
        float rNorm = clamp(distFromCenter / maxDist, 0.0, 1.0);

        // Continuous lens surface profile (half-cosine dome):
        // Apex height = 1.0 at center, sloping smoothly to 0.0 at perimeter.
        // Center (rNorm = 0.0) has normal = (0, 0, 1) -> 100% crystal clear transmission!
        float lensHeight = cos(rNorm * 1.5707963);
        float slopeMag = sin(rNorm * 1.5707963);
        vec2 dir = (distFromCenter > 0.001) ? (p / distFromCenter) : vec2(0.0);

        // Dynamic hydrodynamic ripple on scroll momentum
        float ripple = sin(rNorm * 7.0 - u_time * 2.2 + u_scroll_y * 0.004) * clamp(abs(u_scroll_delta) * 0.012, 0.0, 0.035);
        slopeMag += ripple;

        // Unified 3D Normal Vector across the whole single lens
        vec3 normal = normalize(vec3(-dir * slopeMag * 0.8, 1.0));

        // Snell's Law Refraction for physical crown glass (n ~ 1.517)
        vec3 viewDir = vec3(0.0, 0.0, 1.0);
        vec3 refractR = refract(-viewDir, normal, 1.0 / 1.512);
        vec3 refractG = refract(-viewDir, normal, 1.0 / 1.517);
        vec3 refractB = refract(-viewDir, normal, 1.0 / 1.522);

        // Natural chromatic dispersion (wavelength difference)
        float dispersion = length(refractB.xy - refractR.xy) * 5.0;

        // Single continuous specular glare across the entire lens
        vec3 lightPos = vec3(u_mouse.x * 1.4, u_mouse.y * 1.4, 0.95);
        vec3 lightDir = normalize(lightPos - vec3(uv.x * 0.6, uv.y * 0.6, lensHeight * 0.2));
        vec3 halfVec = normalize(lightDir + viewDir);

        float NdotH = max(0.0, dot(normal, halfVec));
        float broadSheen = pow(NdotH, 18.0) * 0.45;
        float tightGlint = pow(NdotH, 70.0) * 0.85;
        float specular = broadSheen + tightGlint;

        // Fresnel reflection (Schlick's approximation for glass)
        float NdotV = max(0.0, dot(normal, viewDir));
        float fresnel = 0.04 + 0.96 * pow(1.0 - NdotV, 3.8);

        // Single continuous lens caustics (smooth optical dispersion, NO 4-side prism borders)
        vec3 caustics = vec3(
          fresnel * 0.90 + dispersion * 0.25,
          fresnel * 0.95 + dispersion * 0.40,
          fresnel * 1.00 + dispersion * 0.55
        );

        // Anti-aliased outer meniscus edge
        float edgeAlpha = smoothstep(0.0, -1.5, d);

        vec4 finalColor;
        if (u_dark_mode > 0.5) {
          // Dark Mode: Deep crystal glass, crisp specular highlights, seamless single lens sheen
          vec3 col = vec3(1.0) * specular + caustics * 0.22;
          float alpha = clamp(specular * 0.7 + fresnel * 0.35 + dispersion * 0.18, 0.0, 0.7) * edgeAlpha;
          finalColor = vec4(col, alpha);
        } else {
          // Light Mode: Pure diamond clarity, natural sunlight sheen, subtle glass refraction
          vec3 col = vec3(1.0) * specular + caustics * 0.28;
          float alpha = clamp(specular * 0.75 + fresnel * 0.38 + dispersion * 0.22, 0.0, 0.75) * edgeAlpha;
          finalColor = vec4(col, alpha);
        }

        gl_FragColor = finalColor;
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Dynamic state
    let width = 0;
    let height = 0;
    let mouseX = 0.0;
    let mouseY = 0.5;
    let targetMouseX = 0.0;
    let targetMouseY = 0.5;
    let scrollDelta = 0.0;
    let lastScrollY = window.scrollY;
    let startTime = performance.now();

    function resize() {
      const rect = nav.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));

      renderer.setSize(width, height, false);
      const pixelRatio = renderer.getPixelRatio();
      uniforms.u_resolution.value.set(width * pixelRatio, height * pixelRatio);

      const computedRadius = (parseFloat(getComputedStyle(nav).borderTopLeftRadius) || 50) * pixelRatio;
      uniforms.u_border_radius.value = computedRadius;
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });

    // Track scroll momentum
    window.addEventListener("scroll", () => {
      const currentScrollY = window.scrollY;
      scrollDelta = (currentScrollY - lastScrollY) * 0.15;
      lastScrollY = currentScrollY;
    }, { passive: true });

    // Track mouse for interactive specular glare
    window.addEventListener("mousemove", (e) => {
      const rect = nav.getBoundingClientRect();
      if (e.clientY >= rect.top - 150 && e.clientY <= rect.bottom + 150) {
        targetMouseX = ((e.clientX - rect.left) / rect.width) - 0.5;
        targetMouseY = 0.5 - ((e.clientY - rect.top) / rect.height);
      }
    }, { passive: true });

    // Render loop
    function animate(time) {
      const elapsed = (time - startTime) * 0.001;

      // Smooth lerp mouse & damp scroll delta
      mouseX += (targetMouseX - mouseX) * 0.1;
      mouseY += (targetMouseY - mouseY) * 0.1;
      scrollDelta *= 0.92;

      const isDark = document.documentElement.classList.contains("dark") ? 1.0 : 0.0;

      uniforms.u_time.value = elapsed;
      uniforms.u_mouse.value.set(mouseX, mouseY);
      uniforms.u_scroll_delta.value = scrollDelta;
      uniforms.u_scroll_y.value = lastScrollY;
      uniforms.u_dark_mode.value = isDark;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  // Auto-init on all navbars
  function initAll() {
    const navbars = document.querySelectorAll(".navbar, nav.fixed");
    navbars.forEach(createThreeLiquidLens);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  global.initThreeLiquidLens = initAll;
})(window);
