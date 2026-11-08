// ==UserScript==
// @name         Zeta Desktop Skin
// @namespace    zeta-desktop-skin
// @version      0.6.1
// @description  Turns zeta-ai.io's phone-width view into a full-width desktop layout: nav rail, wide pages, adjustable text size, quiet Three.js background.
// @match        https://zeta-ai.io/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
// @grant        none
// @updateURL    https://raw.githubusercontent.com/cruxcified/zeta-reskin/main/zeta-reskin.user.js
// @downloadURL  https://raw.githubusercontent.com/cruxcified/zeta-reskin/main/zeta-reskin.user.js
// @run-at       document-idle
// ==/UserScript==

/* Layout (window 1100px wide or more):  nav rail | Zeta's page, widened
 *  - Zeta's own nav buttons are moved into a fixed rail on the left; they work as normal.
 *  - Card feeds wrap several rows side by side instead of 2 cards per row.
 *  - Inside a chat: a ~820px reading column, message box to match, images capped, grey accents,
 *    and a stand-in rail (Zeta hides its nav there). The chat list remembers its scroll position.
 *  - Text size: 100 / 115 / 130 / 145 %, saved per browser.
 *  - Neutral grey/black palette. Three.js background of slow grey particles.
 *  - Effects: Full / Calm (30fps, slower) / Off. Pauses when the tab is hidden.
 * Narrower windows get Zeta's normal view.
 * Hooks into Zeta's markup as of Nov 2026: <body> is the app column, #contents,
 * #navigation-item-*, #portal-container, a[href*="/plots/"].
 */
(function () {
  "use strict";
  if (window.__zetaSkin || typeof THREE === "undefined") return;
  window.__zetaSkin = true;

  const store = {
    get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let fx = store.get("zeta-skin-fx", reduced ? "calm" : "full");
  let textSize = store.get("zeta-skin-text", "100");
  const RAIL = 232, GAP = 16;
  const root = document.documentElement;

  /* ---------------- styles ---------------- */
  const css = document.createElement("style");
  css.textContent = `
  :root {
    --zs-ink: #0a0a0b;       /* page ground */
    --zs-panel: #141415;     /* main surfaces */
    --zs-raised: #1c1c1e;    /* hover / selected */
    --zs-line: rgba(255,255,255,.08);
    --zs-text: #ededee;
    --zs-muted: #8e8e93;
    --zs-text-scale: 1;
  }
  html { background: var(--zs-ink) !important; }
  #zs-canvas { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 0; pointer-events: none; display: block; }
  body { z-index: 1; }

  html.zs-wide body {
    width: auto !important; max-width: none !important; margin: 0 !important;
    padding: ${GAP}px ${GAP}px ${GAP}px ${RAIL + GAP * 2}px !important;
    box-sizing: border-box; background: transparent !important; min-height: 100vh; height: auto !important;
  }

  /* Zeta's page becomes one wide panel */
  html.zs-wide body > header {
    background: var(--zs-panel) !important; border: 1px solid var(--zs-line); border-bottom: 1px solid var(--zs-line) !important;
    border-radius: 14px 14px 0 0; top: 0 !important; padding-inline: 24px !important;
  }
  html.zs-wide body > header > div.pointer-events-none { display: none; }
  html.zs-wide #contents { background: var(--zs-panel); border: 1px solid var(--zs-line); border-top: 0; border-radius: 0 0 14px 14px; }
  html.zs-wide #contents > div { max-height: calc(100dvh - 52px - ${GAP * 2}px) !important; }
  html.zs-wide #contents .overflow-y-auto { padding-inline: 24px !important; }
  html.zs-wide #contents > div > div > div > div.pointer-events-none { display: none; }

  /* text size: scales Zeta's page content, not the rail */
  /* zoom what's inside each scrolling area (not the area itself), so pages still fit and scroll to the end */
  html.zs-wide #contents .overflow-y-auto > :not(#contents .overflow-y-auto .overflow-y-auto > *) { zoom: var(--zs-text-scale); }
  html.zs-wide #contents textarea { font-size: calc(16px * var(--zs-text-scale)) !important; }

  /* card feeds: each row of 2 cards is its own block, so let the rows sit side by side
     (the feed and its rows are tagged from JS; a CSS-only :has() match also caught the page's scroll areas) */
  html.zs-wide [data-zs-feed] { flex-flow: row wrap !important; column-gap: 14px; align-items: flex-start; }
  html.zs-wide [data-zs-feed] > * { flex: 1 0 100%; min-width: 0; }
  html.zs-wide [data-zs-feed] > [data-zs-row] { flex: 1 1 340px; }
  html.zs-wide [data-zs-row] li { gap: 14px !important; }
  html.zs-wide div:has(> a[href*="/plots/"]) { transition: transform .2s ease, box-shadow .2s ease; }
  html.zs-wide div:has(> a[href*="/plots/"]):hover { transform: translateY(-2px); box-shadow: 0 14px 30px -14px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.12); }

  /* chat pages: one readable column in the middle of the wide panel */
  html.zs-wide.zs-room #contents .overflow-y-auto > :not(#contents .overflow-y-auto .overflow-y-auto > *),
  html.zs-wide.zs-room [data-zs-composer] { max-width: 820px; margin-inline: auto !important; width: 100%; box-sizing: border-box; }
  html.zs-wide.zs-room #contents { line-height: 1.6; }
  /* Pictures in a chat. Zeta sizes the picture box in pixels from the window width, which on a
     desktop makes it far wider than the reading column, so the picture drifts right and gets cut off.
     Size the box from the column instead and let the picture keep its own shape. */
  html.zs-wide.zs-room #contents .mx-auto:has(> button img) { max-width: 100% !important; width: 100%; }
  html.zs-wide.zs-room #contents .mx-auto > button:has(img) {
    width: 100% !important; height: auto !important; max-width: 100%; display: flex !important; justify-content: center;
  }
  html.zs-wide.zs-room #contents .mx-auto > button img {
    width: auto !important; height: auto !important; max-width: 100% !important; max-height: 70vh;
    object-fit: contain; border-radius: 12px; position: static !important;
  }
  html.zs-wide.zs-room [data-zs-composer] { margin-bottom: 12px !important; }
  html.zs-wide.zs-room [data-zs-composer] textarea, html.zs-wide.zs-room [data-zs-composer] input { color: var(--zs-text); }
  /* Zeta's purple accents (your message bubbles, send button) in neutral grey */
  html.zs-wide [data-zs-accent] { background-color: #3a3a3c !important; border-color: #4a4a4d !important; color: var(--zs-text) !important; }

  /* the rail: Zeta's nav row, pinned to the left */
  html.zs-wide [data-zs-navwrap] { height: 0 !important; min-height: 0 !important; margin: 0 !important; }
  html.zs-wide [data-zs-navwrap] > :not([data-zs-rail]) { display: none !important; }
  html.zs-wide [data-zs-rail] {
    position: fixed !important; left: ${GAP}px; top: ${GAP}px; bottom: ${GAP}px; width: ${RAIL}px; height: auto !important;
    flex-direction: column !important; align-items: stretch !important; justify-content: flex-start !important; gap: 2px;
    background: var(--zs-panel) !important; border: 1px solid var(--zs-line) !important; border-radius: 14px !important;
    padding: 76px 12px 120px !important; box-sizing: border-box; z-index: 5 !important;
  }
  html.zs-wide [data-zs-rail]::before {
    content: "zeta"; position: absolute; top: 20px; left: 24px; font: 700 28px/1 "Pretendard Variable", system-ui, sans-serif;
    letter-spacing: -.03em; color: var(--zs-text);
  }
  html.zs-wide [id^="navigation-item-"] {
    flex: none !important; flex-direction: row !important; justify-content: flex-start !important; gap: 12px !important;
    padding: 10px 12px !important; border-radius: 10px;
  }
  html.zs-wide [id^="navigation-item-"]:hover { background: var(--zs-raised); }
  html.zs-wide [id^="navigation-item-"] span { font-size: 14.5px !important; line-height: 1.2; }
  html.zs-wide [id^="navigation-item-"] > div.absolute { left: 30px !important; margin-left: 0 !important; top: 8px !important; }

  /* pop-ups stay phone-sized and centred on the screen */
  html.zs-wide #portal-container { left: 0 !important; right: 0 !important; width: 100vw !important; }
  html.zs-wide #portal-container > .z-30 { inset: 0 !important; }
  html.zs-wide #portal-container > .z-30 > * { max-width: min(480px, 92vw); max-height: 92vh; }
  html.zs-wide #portal-container > .z-30 img { max-height: 70vh; width: auto; max-width: 100%; object-fit: contain; }

  /* stand-in rail for pages where Zeta hides its nav (inside a chat) */
  #zs-rail-fallback { display: none; }
  html.zs-wide.zs-norail #zs-rail-fallback {
    display: flex; flex-direction: column; gap: 2px; position: fixed; left: ${GAP}px; top: ${GAP}px; bottom: ${GAP}px; width: ${RAIL}px;
    background: var(--zs-panel); border: 1px solid var(--zs-line); border-radius: 14px; padding: 76px 12px 120px; box-sizing: border-box; z-index: 5;
    font: 14.5px/1.2 "Pretendard Variable", system-ui, sans-serif;
  }
  #zs-rail-fallback .zs-logo { position: absolute; top: 20px; left: 24px; font: 700 28px/1 "Pretendard Variable", system-ui, sans-serif; letter-spacing: -.03em; color: var(--zs-text); }
  #zs-rail-fallback a { color: var(--zs-muted); text-decoration: none; padding: 12px; border-radius: 10px; display: flex; gap: 12px; align-items: center; }
  #zs-rail-fallback a:hover { background: var(--zs-raised); color: var(--zs-text); }
  #zs-rail-fallback a:focus-visible { outline: 2px solid var(--zs-text); outline-offset: 1px; }

  /* rail controls */
  #zs-controls { display: none; }
  html.zs-wide #zs-controls {
    position: fixed; left: ${GAP + 12}px; bottom: ${GAP + 12}px; width: ${RAIL - 24}px; z-index: 6;
    display: flex; flex-direction: column; gap: 10px; font: 12px/1.2 "Pretendard Variable", system-ui, sans-serif; color: var(--zs-muted);
  }
  #zs-controls .zs-label { padding-left: 4px; letter-spacing: .06em; text-transform: uppercase; font-size: 10.5px; }
  #zs-controls .zs-seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; padding: 3px; box-sizing: border-box;
    background: var(--zs-ink); border: 1px solid var(--zs-line); border-radius: 10px; }
  #zs-controls button { all: unset; cursor: pointer; text-align: center; padding: 6px 0; border-radius: 7px; color: var(--zs-muted); }
  #zs-controls button:hover { color: var(--zs-text); }
  #zs-controls button[aria-pressed="true"] { background: var(--zs-raised); color: var(--zs-text); }
  #zs-controls button:focus-visible { outline: 2px solid var(--zs-text); outline-offset: 1px; }
  #zs-text-seg button { font-weight: 600; }
  `;
  document.head.appendChild(css);

  /* ---------------- rail: tag Zeta's nav row so the CSS can pin it ---------------- */
  function tagRail() {
    const item = document.getElementById("navigation-item-Home");
    if (!item) return;
    const row = item.parentElement, wrap = row && row.parentElement;
    if (!row || row.hasAttribute("data-zs-rail")) return;
    document.querySelectorAll("[data-zs-rail]").forEach(e => e.removeAttribute("data-zs-rail"));
    document.querySelectorAll("[data-zs-navwrap]").forEach(e => e.removeAttribute("data-zs-navwrap"));
    row.setAttribute("data-zs-rail", "");
    // Some pages wrap the nav in a box with decorative images; others put it straight into the
    // page column. Only collapse the wrapper when everything else in it is decoration.
    const decorOnly = wrap && [...wrap.children].every(c => c === row || c.classList.contains("pointer-events-none"));
    if (decorOnly && wrap !== document.body && wrap.id !== "contents") wrap.setAttribute("data-zs-navwrap", "");
  }

  /* ---------------- controls ---------------- */
  const controls = document.createElement("div"); controls.id = "zs-controls";
  controls.innerHTML = `
    <span class="zs-label">Text size</span>
    <div class="zs-seg" id="zs-text-seg" role="group" aria-label="Text size">
      <button data-size="100" style="font-size:11px">A</button><button data-size="115" style="font-size:13px">A</button>
      <button data-size="130" style="font-size:15px">A</button><button data-size="145" style="font-size:17px">A</button>
    </div>
    <span class="zs-label">Background</span>
    <div class="zs-seg" id="zs-fx-seg" role="group" aria-label="Background effects">
      <button data-fx="full">Full</button><button data-fx="calm">Calm</button><button data-fx="off">Off</button>
    </div>`;
  root.appendChild(controls);
  function applyText() {
    root.style.setProperty("--zs-text-scale", String(Number(textSize) / 100));
    controls.querySelectorAll("[data-size]").forEach(b => b.setAttribute("aria-pressed", b.dataset.size === textSize));
  }
  function applyFx() { controls.querySelectorAll("[data-fx]").forEach(b => b.setAttribute("aria-pressed", b.dataset.fx === fx)); }
  controls.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.size) { textSize = b.dataset.size; store.set("zeta-skin-text", textSize); applyText(); }
    if (b.dataset.fx) { fx = b.dataset.fx; store.set("zeta-skin-fx", fx); applyFx(); draw(performance.now()); }
  });
  applyText(); applyFx();

  /* ---------------- Three.js background: slow grey particles ---------------- */
  const canvas = document.createElement("canvas"); canvas.id = "zs-canvas"; root.appendChild(canvas);
  const R = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "low-power" });
  R.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0a0b);
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 200); cam.position.set(0, 0, 30);
  const N = 1100, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i*3] = (Math.random()-.5)*120; pos[i*3+1] = (Math.random()-.5)*70; pos[i*3+2] = -Math.random()*80+12; seed[i] = Math.random(); }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pg.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  const pMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float seed; uniform float uTime; varying float vA;
      void main(){ vec3 p = position; p.y += sin(uTime*.25 + seed*6.28)*1.2; p.x += cos(uTime*.18 + seed*9.)*.8;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = 2.2*(.6+seed)*(30./-mv.z); vA = .2 + .8*fract(seed*7.13); }`,
    fragmentShader: `varying float vA;
      void main(){ float d = length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor = vec4(vec3(.85),(1.-d*2.)*vA*.35); }` });
  scene.add(new THREE.Points(pg, pMat));
  // faint grey haze band for depth
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(160, 40, 60, 8), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `uniform float uTime; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position;
      p.z += sin(p.x*.06+uTime*.15)*6.; p.y += sin(p.x*.04+uTime*.12)*5.;
      gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime; void main(){
      float band = smoothstep(0.,.5,vUv.y)*smoothstep(1.,.5,vUv.y); float w = .5+.5*sin(vUv.x*10.+uTime*.3);
      gl_FragColor = vec4(vec3(.6), band*(.025+.03*w)); }` }));
  haze.position.set(0, 2, -45); haze.rotation.x = -.2; scene.add(haze);

  let wide = false, sizedW = 0, sizedH = 0;
  function layout() {
    wide = innerWidth >= 1100;
    root.classList.toggle("zs-wide", wide);
    if (innerWidth === sizedW && innerHeight === sizedH) return;   // resizing clears the canvas, so only when needed
    sizedW = innerWidth; sizedH = innerHeight;
    R.setSize(innerWidth, innerHeight, false);
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
    if (fx === "off") draw(performance.now());
  }
  addEventListener("resize", layout);

  let mx = 0, my = 0;
  addEventListener("pointermove", e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  const t0 = performance.now(); let last = 0;
  function draw(now) {
    last = now;
    const slow = fx === "calm" ? .35 : 1, t = (now - t0) / 1000 * slow;
    pMat.uniforms.uTime.value = t; haze.material.uniforms.uTime.value = t;
    cam.position.x += (mx * 2 * slow - cam.position.x) * .04; cam.position.y += (-my * 1.5 * slow - cam.position.y) * .04;
    cam.lookAt(cam.position.x, cam.position.y, 0);
    R.render(scene, cam);
  }
  (function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden || fx === "off") return;
    if (fx === "calm" && now - last < 33) return;
    draw(now);
  })(performance.now());

  /* ---------------- keep up with Zeta's page changes ---------------- */
  let lastPath = "";
  function tagFeeds() {
    document.querySelectorAll("li:has(> div > a[href*='/plots/'])").forEach(li => {
      // climb to the block that holds just this row, then its parent is the feed
      let row = li;
      while (row.parentElement && row.parentElement.children.length === 1 && row.parentElement.id !== "contents") row = row.parentElement;
      const feed = row.parentElement;
      if (!feed || feed.id === "contents" || feed.classList.contains("overflow-y-auto")) return;
      row.setAttribute("data-zs-row", ""); feed.setAttribute("data-zs-feed", "");
    });
  }
  /* stand-in rail: Zeta drops its nav inside a chat, so offer the way back */
  const fallback = document.createElement("nav"); fallback.id = "zs-rail-fallback"; fallback.setAttribute("aria-label", "Main");
  fallback.innerHTML = `<span class="zs-logo">zeta</span><a href="/en/rooms" data-go>← All chats</a><a href="/en" data-go>Home</a>`;
  fallback.addEventListener("click", e => {
    const a = e.target.closest("a[data-go]"); if (!a) return;
    const router = window.next && window.next.router;   // stay inside Zeta's app instead of a full reload
    if (router && router.push) { e.preventDefault(); router.push(a.getAttribute("href")); }
  });
  root.appendChild(fallback);

  // inside a chat: the message box and Zeta's purple accents
  function tagRoom() {
    const box = document.querySelector("#contents textarea");
    root.classList.toggle("zs-room", !!box);
    if (!box) return;
    const panelW = document.getElementById("contents").getBoundingClientRect().width;
    let el = box;
    while (el.parentElement && el.parentElement.id !== "contents" && el.parentElement.getBoundingClientRect().width < panelW - 8) el = el.parentElement;
    if (!el.hasAttribute("data-zs-composer")) {
      document.querySelectorAll("[data-zs-composer]").forEach(x => x.removeAttribute("data-zs-composer"));
      el.setAttribute("data-zs-composer", "");
    }
    document.querySelectorAll("#contents [class*='bg-']:not([data-zs-accent])").forEach(x => {
      const m = getComputedStyle(x).backgroundColor.match(/\d+(\.\d+)?/g); if (!m) return;
      const [r, g, b] = m.map(Number);
      if (b > 150 && r > 60 && g < 120 && b - g > 70) x.setAttribute("data-zs-accent", "");   // purple / violet
    });
  }

  // remember where you were in the chat list when you come back to it
  const SCROLL_KEY = "zeta-skin-scroll:";
  document.addEventListener("scroll", e => {
    const t = e.target;
    if (t instanceof Element && t.closest("#contents") && location.pathname.endsWith("/rooms")) {
      try { sessionStorage.setItem(SCROLL_KEY + location.pathname, String(t.scrollTop)); } catch (er) {}
    }
  }, true);
  function restoreScroll() {
    if (!location.pathname.endsWith("/rooms")) return;
    let y = 0; try { y = Number(sessionStorage.getItem(SCROLL_KEY + location.pathname)) || 0; } catch (e) {}
    const sc = [...document.querySelectorAll("#contents .overflow-y-auto")].find(e => e.scrollHeight > e.clientHeight + 5);
    if (y && sc && sc.scrollTop === 0) sc.scrollTop = y;
  }

  function onPage() {
    tagRail(); tagFeeds(); tagRoom(); layout();
    root.classList.toggle("zs-norail", !document.querySelector("[data-zs-rail]"));
  }
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      [100, 600, 1500].forEach(t => setTimeout(onPage, t));
      [700, 1600].forEach(t => setTimeout(restoreScroll, t));
    } else onPage();
  }, 500);
  onPage(); draw(performance.now());
})();
