// Shared site behaviour: theme, nav chrome, scroll reveal, card tilt, three.js hero.
export const PALETTES = {
  cyan:   { light: ['0.545 0.115 205','0.470 0.115 205','0.995 0 0','0.912 0.042 205','0.325 0.075 205'], dark: ['0.818 0.112 200','0.888 0.098 200','0.208 0.045 200','0.338 0.068 200','0.898 0.058 200'], hex: { light: '#1e7c93', dark: '#7fd8ee' } },
  violet: { light: ['0.522 0.148 292','0.448 0.148 292','0.995 0 0','0.914 0.052 292','0.322 0.092 292'], dark: ['0.792 0.128 292','0.862 0.112 292','0.212 0.052 292','0.342 0.082 292','0.896 0.068 292'], hex: { light: '#6d4bc4', dark: '#c3aaf4' } },
  amber:  { light: ['0.558 0.128 62','0.482 0.128 62','0.995 0 0','0.918 0.052 62','0.330 0.082 62'], dark: ['0.822 0.122 72','0.886 0.108 72','0.212 0.048 72','0.342 0.072 72','0.900 0.062 72'], hex: { light: '#96661a', dark: '#e9b96a' } },
  lime:   { light: ['0.545 0.132 148','0.468 0.132 148','0.995 0 0','0.910 0.052 148','0.320 0.082 148'], dark: ['0.818 0.126 152','0.882 0.112 152','0.212 0.048 152','0.342 0.076 152','0.896 0.062 152'], hex: { light: '#1c7f4f', dark: '#79dda6' } },
  iron:   { light: ['0.505 0.148 32','0.438 0.140 32','0.965 0.015 85','0.895 0.052 34','0.335 0.108 32'], dark: ['0.694 0.145 34','0.756 0.130 36','0.176 0.012 72','0.346 0.088 32','0.902 0.045 40'], hex: { light: '#a8432c', dark: '#d97a5a' } }
};

const KEY = 'rafid-portfolio-theme';
let gfx = null;
let heroReady = false;
const seenReveal = new WeakSet();
const seenTilt = new WeakSet();

export function currentTheme(){
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function bootTheme(mode){
  let t = mode;
  if (!t || t === 'system'){
    let stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) {}
    t = (stored === 'dark' || stored === 'light') ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  document.documentElement.dataset.theme = t;
  return t;
}

export function applyAccent(key){
  let k = (key || document.documentElement.dataset.accent || 'cyan').toLowerCase();
  if (document.documentElement.dataset.skin === 'letterpress') k = 'iron';
  const p = PALETTES[k] || PALETTES.cyan;
  document.documentElement.dataset.accent = k;
  const dark = currentTheme() === 'dark';
  const vals = (dark ? p.dark : p.light).map(v => 'oklch(' + v + ')');
  const root = document.documentElement.style;
  root.setProperty('--primary', vals[0]);
  root.setProperty('--primary-hover', vals[1]);
  root.setProperty('--on-primary', vals[2]);
  root.setProperty('--p-container', vals[3]);
  root.setProperty('--on-p-container', vals[4]);
  paintHero();
}

export function setTheme(t){
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch (e) {}
  applyAccent();
  paintThemeIcon();
  return t;
}

export function toggleTheme(){
  return setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}

export function paintThemeIcon(){
  const disc = document.getElementById('themeDisc');
  const rays = document.getElementById('sunRays');
  const cut = document.getElementById('moonCut');
  if (!disc || !rays || !cut) return;
  const dark = currentTheme() === 'dark';
  rays.style.transition = 'opacity .3s ease';
  rays.style.opacity = dark ? '0' : '1';
  cut.style.transition = 'all .35s cubic-bezier(.2,0,0,1)';
  cut.setAttribute('cx', dark ? '17.6' : '26');
  cut.setAttribute('cy', dark ? '7' : '-4');
  disc.setAttribute('r', dark ? '7.4' : '5.6');
}

/* ---------- nav ---------- */

export function initNavChrome(){
  const nav = document.getElementById('navbar');
  if (!nav || nav.dataset.wired) return;
  nav.dataset.wired = '1';

  const onScroll = () => {
    const scrolled = window.scrollY > 32;
    nav.style.boxShadow = scrolled ? 'var(--shadow-2)' : 'var(--shadow-1)';
    nav.style.padding = scrolled ? '7px 9px' : '9px 11px';
    const wrap = document.getElementById('heroCanvasWrap');
    if (wrap) wrap.style.opacity = String(Math.max(0, 1 - window.scrollY / (window.innerHeight * 0.85)));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('[data-navlink]').forEach(l => {
    const on = (l.getAttribute('href') || '').toLowerCase() === file;
    l.style.background = on ? 'var(--p-container)' : 'transparent';
    l.style.color = on ? 'var(--on-p-container)' : 'var(--on-surface-var)';
    l.style.fontWeight = on ? '700' : '500';
  });
  paintThemeIcon();
}

export function toggleMenu(){
  const m = document.getElementById('mobileMenu');
  if (!m) return;
  const open = m.style.opacity === '1';
  m.style.opacity = open ? '0' : '1';
  m.style.pointerEvents = open ? 'none' : 'auto';
  document.body.style.overflow = open ? '' : 'hidden';
}

export function closeMenu(){
  const m = document.getElementById('mobileMenu');
  if (!m) return;
  m.style.opacity = '0';
  m.style.pointerEvents = 'none';
  document.body.style.overflow = '';
}

/* ---------- reveal + tilt ---------- */

let io = null;
let failsafe = null;

export function initReveal(){
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nodes = Array.from(document.querySelectorAll('[data-reveal]')).filter(n => !seenReveal.has(n));
  if (!nodes.length) return;
  if (!io && 'IntersectionObserver' in window){
    io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.style.opacity = '1';
        e.target.style.transform = 'none';
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
  }
  const vh = window.innerHeight;
  nodes.forEach((n, i) => {
    seenReveal.add(n);
    if (n.getBoundingClientRect().top <= vh * 0.94) return;
    const d = (i % 4) * 70;
    n.style.opacity = '0';
    n.style.transform = 'translateY(24px)';
    n.style.transition = 'opacity .75s cubic-bezier(.2,0,0,1) ' + d + 'ms, transform .75s cubic-bezier(.2,0,0,1) ' + d + 'ms';
    if (io) io.observe(n); else { n.style.opacity = '1'; n.style.transform = 'none'; }
  });
  clearTimeout(failsafe);
  failsafe = setTimeout(() => {
    document.querySelectorAll('[data-reveal]').forEach(n => {
      if (n.getBoundingClientRect().top < window.innerHeight){ n.style.opacity = '1'; n.style.transform = 'none'; }
    });
  }, 2600);
}

export function initTilt(){
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
  document.querySelectorAll('[data-tilt]').forEach(card => {
    if (seenTilt.has(card)) return;
    seenTilt.add(card);
    const glow = document.createElement('div');
    glow.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .4s ease;border-radius:inherit;';
    card.appendChild(glow);
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = 'perspective(1200px) rotateX(' + (-y * 2.2).toFixed(2) + 'deg) rotateY(' + (x * 2.6).toFixed(2) + 'deg) translateY(-3px)';
      glow.style.opacity = '1';
      glow.style.background = 'radial-gradient(460px circle at ' + (e.clientX - r.left) + 'px ' + (e.clientY - r.top) + 'px, var(--p-container), transparent 60%)';
      glow.style.mixBlendMode = currentTheme() === 'dark' ? 'soft-light' : 'multiply';
    });
    card.addEventListener('pointerleave', () => { card.style.transform = 'none'; glow.style.opacity = '0'; });
  });
}

/* ---------- three.js constellation ---------- */

function paintHero(){
  if (!gfx) return;
  const p = PALETTES[document.documentElement.dataset.accent || 'cyan'] || PALETTES.cyan;
  const dark = currentTheme() === 'dark';
  const hex = dark ? p.hex.dark : p.hex.light;
  gfx.points.material.color.set(hex);
  gfx.points.material.opacity = dark ? 0.95 : 0.78;
  gfx.lines.material.color.set(hex);
  gfx.lines.material.opacity = dark ? 0.17 : 0.12;
}

export async function initHero3D(wrap, opts){
  if (!wrap || heroReady) return;
  heroReady = true;
  const o = opts || {};
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let THREE;
  try { THREE = await import('https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js'); }
  catch (e) { return; }

  const W = () => wrap.clientWidth || window.innerWidth;
  const H = () => wrap.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(W(), H());
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, W() / H(), 0.1, 100);
  camera.position.set(0, 0, o.distance || 8.4);

  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const N = coarse ? 520 : (o.count || 1000);

  const shapes = [
    i => { const k = i / (N - 1), phi = Math.acos(1 - 2 * k), th = Math.PI * (1 + Math.sqrt(5)) * i, r = 2.85;
      return [Math.cos(th) * Math.sin(phi) * r, Math.cos(phi) * r, Math.sin(th) * Math.sin(phi) * r]; },
    i => { const k = i / (N - 1), t = k * Math.PI * 7, off = (i % 2) ? Math.PI : 0, r = 1.35;
      return [Math.cos(t + off) * r, (k - 0.5) * 7.4, Math.sin(t + off) * r]; },
    i => { const t = (i / N) * Math.PI * 2, r = 1.9 + 0.7 * Math.cos(3 * t);
      return [r * Math.cos(2 * t), 1.05 * Math.sin(3 * t), r * Math.sin(2 * t)]; },
    i => { const side = Math.ceil(Math.sqrt(N)), s = 8.4;
      const x = ((i % side) / (side - 1) - 0.5) * s, z = (Math.floor(i / side) / (side - 1) - 0.5) * s;
      return [x, Math.sin(x * 1.1) * Math.cos(z * 1.1) * 0.9, z]; }
  ];

  const pos = new Float32Array(N * 3);
  const target = new Float32Array(N * 3);
  const phase = new Float32Array(N);
  const fill = (arr, fn) => { for (let i = 0; i < N; i++){ const p = fn(i); arr[i*3] = p[0]; arr[i*3+1] = p[1]; arr[i*3+2] = p[2]; } };
  fill(pos, shapes[0]); fill(target, shapes[0]);
  for (let i = 0; i < N; i++) phase[i] = Math.random() * Math.PI * 2;

  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g2 = c.getContext('2d');
  const grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.88)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = grad; g2.beginPath(); g2.arc(32, 32, 32, 0, Math.PI * 2); g2.fill();
  const sprite = new THREE.Texture(c); sprite.needsUpdate = true;

  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(pg, new THREE.PointsMaterial({
    size: 0.088, map: sprite, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true
  }));

  const pairs = [];
  for (let i = 0; i < N - 1; i++) if (i % 37 !== 0) pairs.push(i, i + 1);
  for (let i = 0; i + 53 < N; i += 11) pairs.push(i, i + 53);
  const lpos = new Float32Array(pairs.length * 3);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ transparent: true, depthWrite: false }));

  const group = new THREE.Group();
  group.add(points); group.add(lines);
  group.position.y = 0.2;
  scene.add(group);

  gfx = { points, lines };
  paintHero();

  let mx = 0, my = 0, tx = 0, ty = 0, idx = 0, last = 0;
  const t0 = performance.now();
  window.addEventListener('pointermove', e => {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
  window.addEventListener('resize', () => {
    camera.aspect = W() / H(); camera.updateProjectionMatrix(); renderer.setSize(W(), H());
  });

  const tick = now => {
    requestAnimationFrame(tick);
    const t = (now - t0) / 1000;
    if (!reduce && now - last > 7400){ last = now; idx = (idx + 1) % shapes.length; fill(target, shapes[idx]); }
    mx += (tx - mx) * 0.045; my += (ty - my) * 0.045;
    const P = pg.attributes.position.array;
    const ease = reduce ? 1 : 0.028;
    for (let i = 0; i < N; i++){
      const j = i * 3;
      P[j] += (target[j] - P[j]) * ease;
      P[j+1] += (target[j+1] - P[j+1]) * ease;
      P[j+2] += (target[j+2] - P[j+2]) * ease;
      if (!reduce){
        const b = Math.sin(t * 1.05 + phase[i]) * 0.022;
        P[j] += b; P[j+1] += b * 0.7; P[j+2] += b;
      }
    }
    pg.attributes.position.needsUpdate = true;
    const L = lg.attributes.position.array;
    for (let k = 0; k < pairs.length; k++){
      const s = pairs[k] * 3, d = k * 3;
      L[d] = P[s]; L[d+1] = P[s+1]; L[d+2] = P[s+2];
    }
    lg.attributes.position.needsUpdate = true;
    if (!reduce) group.rotation.y = t * 0.112;
    group.rotation.x = -my * 0.26;
    group.rotation.z = mx * 0.09;
    camera.position.x = mx * 0.8;
    camera.position.y = -my * 0.45;
    camera.lookAt(0, 0.2, 0);
    renderer.render(scene, camera);
  };
  requestAnimationFrame(tick);
}

export function initPage(opts){
  const o = opts || {};
  document.documentElement.dataset.skin = 'letterpress';
  bootTheme(o.themeMode);
  applyAccent(o.accent);
  requestAnimationFrame(() => {
    initNavChrome();
    initReveal();
    initTilt();
    if (o.hero) initHero3D(document.getElementById('heroCanvasWrap'), o);
  });
}
