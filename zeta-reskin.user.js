// ==UserScript==
// @name         Zeta Desktop Skin
// @namespace    zeta-desktop-skin
// @version      0.4.0
// @description  Turns zeta-ai.io's phone-width view into a full-width desktop layout: nav rail, wide feed, 3D character panel, Three.js background.
// @match        https://zeta-ai.io/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
// @grant        none
// @updateURL    https://raw.githubusercontent.com/cruxcified/zeta-reskin/main/zeta-reskin.user.js
// @downloadURL  https://raw.githubusercontent.com/cruxcified/zeta-reskin/main/zeta-reskin.user.js
// @run-at       document-idle
// ==/UserScript==

/* Layout (window 1100px wide or more):  nav rail | Zeta's page, widened | character panel
 *  - Zeta's own bottom nav is moved into a left rail; its links still work as normal.
 *  - Feeds of character cards become a wide grid instead of 2 per row.
 *  - Right panel: the hovered (or open) character as a 3D card, with name, blurb and a link.
 *  - Chat pages keep a ~72-character reading width so long roleplay stays easy to read.
 *  - One Three.js scene behind everything, tinted by the current character's colours.
 *  - Full / Calm / Off switch at the bottom of the rail. Pauses when the tab is hidden.
 * Narrower windows get Zeta's normal view (plus the background).
 * Hooks into Zeta's markup as of Nov 2026: <body> is the app column, #contents,
 * #navigation-item-*, #portal-container, a[href*="/plots/"], images on image.zeta-ai.io.
 */
(function () {
  "use strict";
  if (window.__zetaSkin || typeof THREE === "undefined") return;
  window.__zetaSkin = true;

  const KEY = "zeta-skin-fx";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let fx = reduced ? "calm" : "full";
  try { fx = localStorage.getItem(KEY) || fx; } catch (e) {}
  const RAIL = 232, SIDE = 340, GAP = 16;
  const root = document.documentElement;

  /* ---------------- styles ---------------- */
  const css = document.createElement("style");
  css.textContent = `
  html { background: #0c0a11 !important; --zs-mood: #a77bff; }
  #zs-canvas { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 0; pointer-events: none; display: block; }
  body { z-index: 1; }

  html.zs-wide body {
    width: auto !important; max-width: none !important; margin: 0 !important;
    padding: ${GAP}px ${SIDE + GAP * 2}px ${GAP}px ${RAIL + GAP * 2}px !important;
    box-sizing: border-box; background: transparent !important; min-height: 100vh; height: auto !important;
  }
  /* Zeta's page becomes the centre panel */
  html.zs-wide body > header {
    background: rgba(21,19,27,.94) !important; border: 1px solid rgba(255,255,255,.07); border-bottom: 0 !important;
    border-radius: 14px 14px 0 0; top: 0 !important; padding-inline: 20px !important;
  }
  html.zs-wide body > header > div.pointer-events-none { display: none; }
  html.zs-wide #contents {
    background: rgba(21,19,27,.94); border: 1px solid rgba(255,255,255,.07); border-top: 0;
    border-radius: 0 0 14px 14px;
  }
  html.zs-wide #contents > div { max-height: calc(100dvh - 52px - ${GAP * 2}px) !important; }
  html.zs-wide #contents .overflow-y-auto { padding-inline: 20px !important; }

  /* character feeds: Zeta renders each row of 2 cards as its own block, so let the rows sit side by side */
  html.zs-wide div:has(> div li > div > a[href*="/plots/"]) { flex-flow: row wrap !important; column-gap: 14px; align-items: flex-start; }
  html.zs-wide div:has(> div li > div > a[href*="/plots/"]) > div { flex: 1 0 100%; min-width: 0; }
  html.zs-wide div:has(> div li > div > a[href*="/plots/"]) > div:has(li > div > a[href*="/plots/"]) { flex: 1 1 340px; }
  html.zs-wide li:has(> div > a[href*="/plots/"]) { gap: 14px !important; }
  html.zs-wide div:has(> a[href*="/plots/"]):hover { transform: translateY(-3px); box-shadow: 0 16px 36px -14px var(--zs-mood); }
  html.zs-wide div:has(> a[href*="/plots/"]) { transition: transform .25s ease, box-shadow .25s ease; }

  /* chat pages: keep a comfortable reading width */
  html.zs-wide.zs-chat #contents .overflow-y-auto > * { max-width: 760px; margin-inline: auto; width: 100%; }

  /* Zeta's bottom nav becomes the left rail */
  html.zs-wide div:has(> div > #navigation-item-Home) {
    position: fixed !important; left: ${GAP}px; top: ${GAP}px; bottom: ${GAP}px; width: ${RAIL}px; margin: 0 !important;
    background: rgba(21,19,27,.82); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,.07); border-radius: 14px;
    padding: 76px 12px 64px; box-sizing: border-box; z-index: 5 !important;
  }
  html.zs-wide div:has(> div > #navigation-item-Home)::before {
    content: "zeta"; position: absolute; top: 18px; left: 22px; font: 700 30px/1 "Pretendard Variable", system-ui, sans-serif;
    letter-spacing: -.03em; color: #fff;
  }
  html.zs-wide div:has(> div > #navigation-item-Home) > div.pointer-events-none { display: none !important; }
  html.zs-wide div:has(> #navigation-item-Home) {
    flex-direction: column !important; align-items: stretch !important; height: auto !important; gap: 2px; padding: 0 !important;
  }
  html.zs-wide [id^="navigation-item-"] {
    flex: none !important; flex-direction: row !important; justify-content: flex-start !important; gap: 12px !important;
    padding: 10px 12px !important; border-radius: 10px;
  }
  html.zs-wide [id^="navigation-item-"]:hover { background: rgba(255,255,255,.05); }
  html.zs-wide [id^="navigation-item-"] span { font-size: 14px !important; line-height: 1.2; }
  html.zs-wide [id^="navigation-item-"] > div.absolute { left: 26px !important; margin-left: 0 !important; }

  /* pop-ups stay phone-sized and centred on the screen */
  html.zs-wide #portal-container { left: 0 !important; right: 0 !important; width: 100vw !important; }
  html.zs-wide #portal-container > .z-30 { inset: 0 !important; }

  /* right panel */
  #zs-side { display: none; }
  html.zs-wide #zs-side {
    display: flex; flex-direction: column; position: fixed; right: ${GAP}px; top: ${GAP}px; bottom: ${GAP}px; width: ${SIDE}px;
    border: 1px solid rgba(255,255,255,.07); border-radius: 14px; z-index: 5; box-sizing: border-box; padding: 16px;
    font-family: "Pretendard Variable", system-ui, sans-serif; color: #fff; pointer-events: none;
    background: linear-gradient(to bottom, transparent 55%, rgba(21,19,27,.9) 75%);
  }
  #zs-side .zs-slot { aspect-ratio: 3 / 4; width: 100%; flex: none; }
  #zs-side .zs-info { display: flex; flex-direction: column; gap: 6px; margin-top: 16px; min-height: 0; overflow: hidden; }
  #zs-side .zs-eyebrow { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.5); }
  #zs-side h2 { margin: 0; font-size: 24px; line-height: 1.15; letter-spacing: -.02em; font-weight: 700; }
  #zs-side p { margin: 0; font-size: 14px; line-height: 1.5; color: rgba(255,255,255,.7); }
  #zs-side a { pointer-events: auto; align-self: flex-start; margin-top: 8px; background: var(--zs-mood); color: #120e18;
    font-weight: 700; font-size: 14px; padding: 10px 16px; border-radius: 10px; text-decoration: none; }
  #zs-side a[hidden] { display: none; }

  /* effects switch (bottom of the rail) */
  #zs-fx { position: fixed; left: ${GAP + 12}px; bottom: ${GAP + 12}px; width: ${RAIL - 24}px; z-index: 6; display: none;
    grid-template-columns: repeat(3, 1fr); padding: 3px; box-sizing: border-box;
    background: #0c0a11; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; font: 12px system-ui, sans-serif; }
  html.zs-wide #zs-fx { display: grid; }
  #zs-fx button { all: unset; cursor: pointer; text-align: center; padding: 6px 0; border-radius: 7px; color: rgba(255,255,255,.55); }
  #zs-fx button[aria-pressed="true"] { background: rgba(255,255,255,.1); color: #fff; }
  #zs-fx button:focus-visible { outline: 2px solid var(--zs-mood); }
  `;
  document.head.appendChild(css);

  const canvas = document.createElement("canvas"); canvas.id = "zs-canvas"; root.appendChild(canvas);
  const side = document.createElement("aside"); side.id = "zs-side";
  side.innerHTML = `<div class="zs-slot"></div><div class="zs-info"><span class="zs-eyebrow">Character</span><h2></h2><p></p><a hidden>Open character</a></div>`;
  root.appendChild(side);
  const slot = side.querySelector(".zs-slot"), sName = side.querySelector("h2"), sSub = side.querySelector("p"), sLink = side.querySelector("a");
  sName.textContent = "Hover a character"; sSub.textContent = "Their card shows up here.";

  /* ---------------- Three.js scene ---------------- */
  const R = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
  R.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0c0a11);
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 200); cam.position.set(0, 0, 30);
  const mood = new THREE.Color(0xa77bff), moodTarget = mood.clone();

  const N = 1200, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i*3] = (Math.random()-.5)*120; pos[i*3+1] = (Math.random()-.5)*70; pos[i*3+2] = -Math.random()*80+12; seed[i] = Math.random(); }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pg.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  const pMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: mood } },
    vertexShader: `attribute float seed; uniform float uTime; varying float vA;
      void main(){ vec3 p = position; p.y += sin(uTime*.25 + seed*6.28)*1.2; p.x += cos(uTime*.18 + seed*9.)*.8;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = 2.4*(.6+seed)*(30./-mv.z); vA = .25 + .75*fract(seed*7.13); }`,
    fragmentShader: `uniform vec3 uColor; varying float vA;
      void main(){ float d = length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor = vec4(uColor,(1.-d*2.)*vA*.55); }` });
  scene.add(new THREE.Points(pg, pMat));
  const rib = new THREE.Mesh(new THREE.PlaneGeometry(160, 40, 60, 8), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: mood } },
    vertexShader: `uniform float uTime; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position;
      p.z += sin(p.x*.06+uTime*.15)*6. + cos(p.y*.2+uTime*.1)*2.; p.y += sin(p.x*.04+uTime*.12)*5.;
      gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: `uniform vec3 uColor; varying vec2 vUv; uniform float uTime; void main(){
      float band = smoothstep(0.,.5,vUv.y)*smoothstep(1.,.5,vUv.y); float w = .5+.5*sin(vUv.x*12.+uTime*.3);
      gl_FragColor = vec4(uColor, band*(.07+.09*w)); }` }));
  rib.position.set(0, 2, -45); rib.rotation.x = -.2; scene.add(rib);

  // the 3D card, placed over the panel's card slot
  const card = new THREE.Group(); card.visible = false; scene.add(card);
  const W = 6, H = 8;
  const tex = new THREE.Texture(); tex.encoding = THREE.sRGBEncoding;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  const rim = new THREE.Mesh(new THREE.PlaneGeometry(W + .16, H + .16), new THREE.MeshBasicMaterial({ color: mood, transparent: true }));
  rim.position.z = -.02;
  const quad = (frag, uniforms, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`, fragmentShader: frag }));
  const glow = quad(`uniform vec3 uColor; uniform float uA; varying vec2 vUv; void main(){ float d = length((vUv-.5)*vec2(1.,1.2));
      gl_FragColor = vec4(uColor, smoothstep(.5,.0,d)*.35*uA); }`, { uColor: { value: mood }, uA: { value: 0 } }, W * 2, H * 1.7);
  glow.position.z = -.5;
  const shine = quad(`uniform float uT; varying vec2 vUv; void main(){ float x = vUv.x + vUv.y*.6 - uT;
      float s = smoothstep(0.,.08,x)*smoothstep(.2,.08,x); gl_FragColor = vec4(vec3(1.), s*.18); }`, { uT: { value: 0 } }, W, H);
  shine.position.z = .01;
  card.add(glow, rim, face, shine);
  let cardAlpha = 0, cardTarget = 0, flip = 0, wide = false;

  function layout() {
    wide = innerWidth >= 1100;
    root.classList.toggle("zs-wide", wide);
    R.setSize(innerWidth, innerHeight, false);
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.position.z, vw = vh * cam.aspect;
    const r = slot.getBoundingClientRect();
    if (wide && r.width) {
      const cx = (r.left + r.width / 2) / innerWidth * vw - vw / 2, cy = vh / 2 - (r.top + r.height / 2) / innerHeight * vh;
      card.userData.base = { x: cx, y: cy }; card.scale.setScalar((r.width * .86 / innerWidth * vw) / W);
    } else card.userData.base = null;
  }
  addEventListener("resize", layout);

  /* ---------------- which character to show ---------------- */
  let currentSrc = "";
  const bigSrc = src => src.replace(/([?&])w=\d+/, "$1w=640");
  function moodFrom(img) {
    try { const c = document.createElement("canvas"); c.width = c.height = 24; const g = c.getContext("2d"); g.drawImage(img, 0, 0, 24, 24);
      const d = g.getImageData(0, 0, 24, 24).data; let r = 0, gg = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { const w = (Math.max(d[i], d[i+1], d[i+2]) - Math.min(d[i], d[i+1], d[i+2])) / 255 + .05; r += d[i]*w; gg += d[i+1]*w; b += d[i+2]*w; n += w; }
      const col = new THREE.Color(r/n/255, gg/n/255, b/n/255); const hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h, Math.max(.55, hsl.s), .65); return col;
    } catch (e) { return new THREE.Color(0xa77bff); } }
  function show(info) {
    if (!info) return;
    sName.textContent = info.name || ""; sSub.textContent = info.sub || "";
    if (info.href) { sLink.href = info.href; sLink.hidden = false; } else sLink.hidden = true;
    if (info.src === currentSrc) return;
    currentSrc = info.src;
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      if (currentSrc !== info.src) return;
      const apply = () => { tex.image = img; tex.needsUpdate = true; };
      if (cardAlpha > .3 && fx !== "off" && !reduced) { flip = Math.PI; setTimeout(() => { apply(); flip = 0; card.rotation.y -= Math.PI * 2; }, 260); }
      else apply();
      moodTarget.copy(moodFrom(img));
      root.style.setProperty("--zs-mood", "#" + moodTarget.getHexString());
      cardTarget = 1;
      if (fx === "off") draw(performance.now());
    };
    img.src = bigSrc(info.src);
  }
  const ZIMG = "img[src*='image.zeta-ai.io']";
  function cardInfo(a) {
    const box = a.parentElement; const img = a.querySelector(ZIMG) || box.querySelector(ZIMG);
    if (!img) return null;
    const texts = [...box.querySelectorAll("p, span, h2, h3, div")].filter(e => !e.children.length)
      .map(e => e.textContent.trim()).filter(t => t && !/^[\d.,]+[KM]?$/.test(t) && !t.startsWith("#"));
    return { src: img.currentSrc || img.src, name: texts[0] || "", sub: texts[1] || "", href: a.getAttribute("href") };
  }
  document.addEventListener("pointerover", e => {
    const a = e.target.closest && e.target.closest("a[href*='/plots/']");
    if (a) show(cardInfo(a));
  });
  function fromPage() {
    root.classList.toggle("zs-chat", /\/rooms\/./.test(location.pathname));
    if (/\/plots\/|\/rooms\/./.test(location.pathname)) {
      const imgs = [...document.querySelectorAll("#contents " + ZIMG)].filter(i => i.getBoundingClientRect().width > 40)
        .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
      const h = document.querySelector("body > header h1, body > header h2, #contents h1, #contents h2");
      if (imgs[0]) show({ src: imgs[0].currentSrc || imgs[0].src, name: h ? h.textContent.trim() : "", sub: "", href: "" });
    } else if (!currentSrc) {
      const a = document.querySelector("a[href*='/plots/']"); if (a) show(cardInfo(a));
    }
    layout();
  }
  let lastPath = "";
  setInterval(() => { if (location.pathname !== lastPath) { lastPath = location.pathname; [300, 1200, 2500].forEach(t => setTimeout(fromPage, t)); } }, 400);

  /* ---------------- effects switch ---------------- */
  const sw = document.createElement("div"); sw.id = "zs-fx"; sw.setAttribute("role", "group"); sw.setAttribute("aria-label", "3D effects");
  sw.innerHTML = `<button data-fx="full">Full</button><button data-fx="calm">Calm</button><button data-fx="off">Off</button>`;
  root.appendChild(sw);
  const syncSw = () => sw.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.fx === fx));
  sw.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; fx = b.dataset.fx;
    try { localStorage.setItem(KEY, fx); } catch (er) {} syncSw(); draw(performance.now()); });
  syncSw();

  /* ---------------- loop ---------------- */
  let mx = 0, my = 0, tx = 0, ty = 0;
  addEventListener("pointermove", e => {
    mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5;
    const r = slot.getBoundingClientRect();
    if (e.clientX > r.left - 40) { tx = ((e.clientY - r.top) / r.height - .5) * .6; ty = ((e.clientX - r.left) / r.width - .5) * .8; } else { tx = ty = 0; }
  }, { passive: true });
  const t0 = performance.now(); let last = 0;
  function draw(now) {
    const dt = Math.min((now - last) / 1000, .1) || .016; last = now;
    const slow = fx === "calm" ? .35 : 1, t = (now - t0) / 1000 * slow;
    mood.lerp(moodTarget, fx === "off" ? 1 : 1 - Math.pow(.03, dt));
    pMat.uniforms.uTime.value = t; rib.material.uniforms.uTime.value = t;
    cam.position.x += (mx * 2 * slow - cam.position.x) * .04;
    cam.position.y += (-my * 1.5 * slow - cam.position.y) * .04;
    cam.lookAt(cam.position.x, cam.position.y, 0);
    cardAlpha += (cardTarget - cardAlpha) * (fx === "off" ? 1 : Math.min(1, dt * 4));
    face.material.opacity = rim.material.opacity = cardAlpha; glow.material.uniforms.uA.value = cardAlpha;
    shine.visible = cardAlpha > .5 && fx !== "off";
    const b = card.userData.base;
    card.visible = !!b && cardAlpha > .01 && !!tex.image;
    if (b) {
      card.position.set(b.x + cam.position.x, b.y + cam.position.y + (fx === "full" ? Math.sin(t * .8) * .12 : 0), 0);
      const idle = fx === "full" ? Math.sin(t * .6) * .07 : 0;
      const k = fx === "off" ? 1 : .1;
      card.rotation.x += (tx - card.rotation.x) * k; card.rotation.y += (ty + idle + flip - card.rotation.y) * k;
    }
    shine.material.uniforms.uT.value = ((t * .25) % 1.6) - .2 + ty * .3;
    R.render(scene, cam);
  }
  (function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden || fx === "off") return;
    if (fx === "calm" && now - last < 33) return;
    draw(now);
  })(performance.now());
  layout(); draw(performance.now());
})();
