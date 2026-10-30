'use strict';
// ===================================================================
//  JBA Pokémon – HTML engine (RPG Maker XP style maps + event interpreter)
// ===================================================================
const SW = 512, SH = 384, TS = 32, FPS = 40;
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const G = window.G = {
  switches: {}, vars: {}, selfsw: {}, temp: {},
  player: null, map: null, mapId: 0, chars: [], events: {},
  pics: {}, tone: { cur: [0, 0, 0, 0], tgt: [0, 0, 0, 0], left: 0 },
  main: null, msg: null, choice: null, battle: null, modal: false,
  frame: 0, party: [], items: {}, name: 'Jorge', frozen: null, trans: null,
  bgm: null, started: false, log: [], pending: null, debug: false,
};
const IMGS = {};
const dirVec = { 2: [0, 1], 4: [-1, 0], 6: [1, 0], 8: [0, -1] };
const opp = { 2: 8, 8: 2, 4: 6, 6: 4 };
// speed (1..6) -> tiles per second
const TPS = { 1: 1.5, 2: 2.5, 3: 4, 4: 7.5, 5: 10, 6: 16 };

// ------------------------------------------------------------ assets
// GitHub Pages is case-sensitive and can drop requests when hundreds fire at once, so images load through a small pool,
// are retried when they fail, and fall back to an upper-case ".PNG" extension (a few files were committed that way).
const IMG_PENDING = {};
function loadImage(f) {
  IMG_PENDING[f] = 1;
  return new Promise(res => {
    const tries = [f, f + '?r=1', f.replace(/\.png$/, '.PNG') + '?r=2', f + '?r=3'];
    let i = 0;
    const next = () => {
      if (i >= tries.length) { console.warn('missing image', f); return res(); }
      const n = i++, im = new Image();
      im.onload = () => { IMGS[f] = im; res(); };
      im.onerror = () => setTimeout(next, n * 300);
      im.src = tries[n];
    };
    next();
  });
}
async function loadAssets() {
  const list = window.ASSETS.filter(f => f.endsWith('.png')); let k = 0;
  const worker = async () => { while (k < list.length) await loadImage(list[k++]); };
  await Promise.all(Array.from({ length: 24 }, worker));
}
const symOf = s => (window.D && D.SP[s]) ? s : ((window.PH && window.PH[s]) || s);   // PBS placeholder species names -> current character keys
const img = (dir, name) => {
  const f = 'assets/' + dir + '/' + name + '.png';
  if (IMGS[f]) return IMGS[f];
  if (!IMG_PENDING[f]) loadImage(f);   // anything missing from the manifest, or that failed to load earlier, is fetched on demand (with retries)
  return undefined;
};

// ------------------------------------------------------------ audio
const SET = { music: 0.7, sfx: 0.7, speed: 1, bars: 1, touch: (('ontouchstart' in window) || navigator.maxTouchPoints > 0) ? 1 : 0 };
try { const o = JSON.parse(localStorage.getItem('jba_settings') || '{}'); for (const k in SET) if (typeof o[k] === 'number') SET[k] = o[k]; } catch (e) { }
// The backdrop is applied from an Image() so its URL is resolved exactly like every other asset (a CSS url() set from script was requested
// from the site root on GitHub Pages, which 404'd and left the background black).
let BARS_URL = null;
function applyBars() {
  try {
    if (!SET.bars) { document.body.style.backgroundImage = 'none'; return; }
    const show = () => { if (SET.bars) document.body.style.backgroundImage = 'url("' + BARS_URL + '")'; };
    if (BARS_URL) return show();
    const im = new Image(); im.onload = () => { BARS_URL = im.src; show(); }; im.src = 'assets/ui/background_bars.jpg';
  } catch (err) { }
}
applyBars();
function saveSettings() { try { localStorage.setItem('jba_settings', JSON.stringify(SET)); } catch (e) { } }
const AUD = {};
let actx = null;
function sfx(kind) {
  if (SET.sfx <= 0) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t0 = actx.currentTime;
    const defs = { cursor: [[880, 0, .05]], ok: [[660, 0, .05], [990, .05, .08]], bump: [[110, 0, .07]], back: [[500, 0, .05], [380, .05, .06]], door: [[520, 0, .06], [390, .07, .1]] };
    for (const [f, d, l] of (defs[kind] || defs.ok)) {
      const o = actx.createOscillator(), g = actx.createGain(); o.type = kind === 'bump' ? 'triangle' : 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.18 * SET.sfx, t0 + d); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + l);
      o.connect(g); g.connect(actx.destination); o.start(t0 + d); o.stop(t0 + d + l + 0.02);
    }
  } catch (e) { }
}
function applyVolumes() { if (G.bgm) G.bgm.a.volume = G.me ? 0 : Math.min(1, (G.bgm.base || 0.6) * SET.music); }
function audio(name) {
  if (!AUD[name]) { const a = new Audio('assets/audio/' + name + '.ogg'); a.loop = true; a.preload = 'auto'; AUD[name] = a; }
  return AUD[name];
}
function playBGM(name, vol = 0.6) {
  if (!name) { stopBGM(); return; }
  if (G.bgm && G.bgm.name === name && !G.bgm.a.paused) { G.bgm.base = vol; applyVolumes(); return; }
  stopBGM();
  const a = audio(name); a.volume = Math.min(1, vol * SET.music); a.currentTime = 0;
  a.play().catch(() => { G.bgmBlocked = true; });
  G.bgm = { name, a, base: vol };
}
function stopBGM() { if (G.bgm) { G.bgm.a.pause(); G.bgm = null; } }
function fadeBGM(sec) {
  if (!G.bgm) return; const a = G.bgm.a; const v0 = a.volume; let t = 0;
  const iv = setInterval(() => { t += 50; a.volume = Math.max(0, v0 * (1 - t / (sec * 1000))); if (t >= sec * 1000) { clearInterval(iv); a.pause(); a.volume = v0; if (G.bgm && G.bgm.a === a) G.bgm = null; } }, 50);
}
function stopME() { if (G.me) { const a = G.me.a; G.me = null; try { a.pause(); } catch (e) { } applyVolumes(); } }
function playME(name) {
  stopME(); const a = new Audio('assets/audio/' + String(name).replace(/ /g, '_') + '.ogg'); a.volume = Math.min(1, 0.7 * SET.music);
  G.me = { a, name }; applyVolumes();
  a.onended = () => { if (G.me && G.me.a === a) { G.me = null; applyVolumes(); } };
  a.play().catch(() => { if (G.me && G.me.a === a) { G.me = null; applyVolumes(); } });
}
function cry(id) { try { const a = new Audio('assets/cries/' + String(id).padStart(3, '0') + '.ogg'); a.volume = Math.min(1, 0.9 * SET.sfx); a.play().catch(() => { }); } catch (e) { } }

// ------------------------------------------------------------ input
const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
  z: 'ok', Z: 'ok', Enter: 'ok', ' ': 'ok', c: 'ok', C: 'ok', x: 'back', X: 'back', Escape: 'menu', m: 'menu', M: 'menu', Tab: 'menu', Shift: 'run', b: 'bike', B: 'bike'
};
const keys = { held: {}, pressed: {} };
keys.kb = {};
function toggleFullscreen() { try { if (document.fullscreenElement) document.exitFullscreen(); else (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement); } catch (err) { } }
window.addEventListener('keydown', e => {
  const k = KEYMAP[e.key]; if (!k) return;
  if (G.modal) return;
  e.preventDefault(); keys.kb[k] = true;
  if (!keys.held[k]) keys.pressed[k] = true;
  keys.held[k] = true;
  if (k === 'back') keys.held.run = true;
});
window.addEventListener('keyup', e => {
  const k = KEYMAP[e.key]; if (!k) return;
  keys.kb[k] = false; keys.held[k] = false; if (k === 'back') keys.held.run = false;
});
// ---- controller (standard mapping): A confirm, B cancel/run, X or Start menu, D-pad / left stick move
const PAD = { prev: {} };
function pollPad() {
  let gp = null;
  try { for (const g of (navigator.getGamepads ? navigator.getGamepads() : [])) if (g && g.connected) { gp = g; break; } } catch (e) { }
  const now = {};
  if (gp) {
    const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    now.up = b(12) || ay < -0.5; now.down = b(13) || ay > 0.5; now.left = b(14) || ax < -0.5; now.right = b(15) || ax > 0.5;
    now.ok = b(0); now.back = b(1); now.menu = b(2) || b(9) || b(8); now.run = b(1); now.bike = b(4) || b(5);   // LB / RB: Skateboard
    const yb = b(3); if (yb && !PAD.yDown) toggleFullscreen(); PAD.yDown = yb;
  }
  for (const k of ['up', 'down', 'left', 'right', 'ok', 'back', 'menu', 'run', 'bike']) {
    const n = !!now[k], p = !!PAD.prev[k];
    if (n && !p) { if (!keys.held[k] && k !== 'run') keys.pressed[k] = true; keys.held[k] = true; if (k === 'back') keys.held.run = true; }
    else if (!n && p) { if (!keys.kb[k]) keys.held[k] = false; if (k === 'back' && !keys.kb.back) keys.held.run = false; if (k === 'run' && !keys.kb.back && !now.back) keys.held.run = false; }
  }
  PAD.prev = now;
}
window.addEventListener('blur', () => { keys.held = {}; });
const pressed = k => { const p = keys.pressed[k]; return !!p; };
// ---- on-screen touch controls (toggle in Options). Feeds the same keys.held / keys.pressed flags as keyboard + gamepad.
keys.tp = {};
function touchSet(k, on) {
  if (on) { if (G.modal) return; if (!keys.tp[k]) { if (!keys.held[k]) keys.pressed[k] = true; keys.held[k] = true; if (k === 'back') keys.held.run = true; keys.tp[k] = true; } }
  else if (keys.tp[k]) { keys.tp[k] = false; if (!keys.kb[k]) keys.held[k] = false; if (k === 'back' && !keys.kb.back) keys.held.run = false; }
}
function releaseTouch() { for (const k in keys.tp) touchSet(k, false); }
let touchHidden = false;   // LB hides the controls for now (setting stays on); double-tap or Options brings them back
function applyTouch() { touchHidden = false; const el = document.getElementById('touchUI'); if (el) el.style.display = SET.touch ? 'block' : 'none'; if (!SET.touch) releaseTouch(); }
function hideTouch() { touchHidden = true; releaseTouch(); const el = document.getElementById('touchUI'); if (el) el.style.display = 'none'; }
(function buildTouchUI() {
  // Xbox-style layout: stick/d-pad combo (left), Y/X/B/A diamond (right), LB / RB along the top.
  const css = document.createElement('style');
  css.textContent = '#touchUI{--b:clamp(46px,14vmin,72px);--m:max(14px,env(safe-area-inset-left));position:fixed;inset:0;z-index:4;pointer-events:none;display:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:none}' +
    '#touchUI .tc{position:absolute;pointer-events:auto;touch-action:none;background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.35);color:rgba(255,255,255,.85);font:700 calc(var(--b)*.36) sans-serif;display:flex;align-items:center;justify-content:center;box-sizing:border-box}' +
    '#touchUI .tc.on{background:rgba(255,255,255,.4)}' +
    '#tStick{left:var(--m);bottom:max(14px,env(safe-area-inset-bottom));width:calc(var(--b)*2.7);height:calc(var(--b)*2.7);border-radius:50%}' +
    '#tStick .ar{position:absolute;color:rgba(255,255,255,.55);font-size:calc(var(--b)*.3);pointer-events:none}' +
    '#tStick .u{top:5%;left:50%;transform:translateX(-50%)}#tStick .d{bottom:5%;left:50%;transform:translateX(-50%)}#tStick .l{left:7%;top:50%;transform:translateY(-50%)}#tStick .r{right:7%;top:50%;transform:translateY(-50%)}' +
    '#tKnob{position:absolute;left:50%;top:50%;width:46%;height:46%;margin:-23% 0 0 -23%;border-radius:50%;background:rgba(255,255,255,.3);border:2px solid rgba(255,255,255,.55);pointer-events:none;transition:transform .08s}' +
    '#tStick.on #tKnob{transition:none;background:rgba(255,255,255,.5)}' +
    '#tFace{position:absolute;right:max(14px,env(safe-area-inset-right));bottom:max(14px,env(safe-area-inset-bottom));width:calc(var(--b)*3);height:calc(var(--b)*3);pointer-events:none}' +
    '#tFace .tc{width:var(--b);height:var(--b);border-radius:50%}' +
    '#tY{left:var(--b);top:0;color:#f2c230;border-color:rgba(242,194,48,.7)}#tA{left:var(--b);top:calc(var(--b)*2);color:#4cc24c;border-color:rgba(76,194,76,.7)}' +
    '#tX{left:0;top:var(--b);color:#4a90e8;border-color:rgba(74,144,232,.7)}#tB{left:calc(var(--b)*2);top:var(--b);color:#e8504a;border-color:rgba(232,80,74,.7)}' +
    '.tSh{width:calc(var(--b)*1.7);height:calc(var(--b)*.62);top:max(8px,env(safe-area-inset-top));border-radius:12px;font-size:calc(var(--b)*.3)!important}' +
    '#tLB{left:var(--m)}#tRB{right:max(14px,env(safe-area-inset-right))}';
  document.head.appendChild(css);
  const ui = document.createElement('div'); ui.id = 'touchUI';
  const mk = (id, cls, label, parent) => { const d = document.createElement('div'); d.id = id; d.className = 'tc ' + cls; d.textContent = label; (parent || ui).appendChild(d); return d; };
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { } };
  const bind = (el, k, fn) => {
    const dn = e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) { } el.classList.add('on'); buzz(); if (fn) fn(); else touchSet(k, true); };
    const up = e => { e.preventDefault(); el.classList.remove('on'); if (!fn) touchSet(k, false); };
    el.addEventListener('pointerdown', dn); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  };
  // shoulders: LB hides the controls (double-tap the screen to bring them back), RB = skateboard
  bind(mk('tLB', 'tSh', 'LB'), null, hideTouch); bind(mk('tRB', 'tSh', 'RB'), 'bike');
  // face buttons: A confirm, B cancel/run, X menu, Y fullscreen (same as the controller)
  const face = document.createElement('div'); face.id = 'tFace'; ui.appendChild(face);
  bind(mk('tY', '', 'Y', face), null, toggleFullscreen); bind(mk('tX', '', 'X', face), 'menu');
  bind(mk('tB', '', 'B', face), 'back'); bind(mk('tA', '', 'A', face), 'ok');
  // stick + d-pad combo: arrows on a round base, a thumb knob follows the finger; slide to change direction
  const st = mk('tStick', '', ''); st.style.borderRadius = '50%';
  for (const [c, t] of [['u', '▲'], ['d', '▼'], ['l', '◀'], ['r', '▶']]) { const a = document.createElement('div'); a.className = 'ar ' + c; a.textContent = t; st.appendChild(a); }
  const knob = document.createElement('div'); knob.id = 'tKnob'; st.appendChild(knob);
  const dir = e => {
    const r = st.getBoundingClientRect(), R = r.width / 2;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const len = Math.hypot(dx, dy), lim = R * 0.5, k = len > lim ? lim / len : 1;
    knob.style.transform = 'translate(' + dx * k + 'px,' + dy * k + 'px)';
    const dz = R * 0.2, h = Math.abs(dx) >= Math.abs(dy);
    const want = { left: h && dx < -dz, right: h && dx > dz, up: !h && dy < -dz, down: !h && dy > dz };
    for (const q in want) touchSet(q, want[q]);
  };
  st.addEventListener('pointerdown', e => { e.preventDefault(); try { st.setPointerCapture(e.pointerId); } catch (x) { } st.classList.add('on'); dir(e); });
  st.addEventListener('pointermove', e => { if (st.classList.contains('on')) dir(e); });
  const stUp = e => { e.preventDefault(); st.classList.remove('on'); knob.style.transform = ''; for (const q of ['up', 'down', 'left', 'right']) touchSet(q, false); };
  st.addEventListener('pointerup', stUp); st.addEventListener('pointercancel', stUp);
  ui.addEventListener('contextmenu', e => e.preventDefault());
  document.body.appendChild(ui); applyTouch();
})();
// double-click / double-tap anywhere on the game brings the on-screen controls back
(function dblShow() {
  let last = 0, lx = 0, ly = 0;
  window.addEventListener('pointerdown', e => {
    if (e.target.closest && e.target.closest('#touchUI')) return;
    const t = Date.now(), near = Math.abs(e.clientX - lx) < 40 && Math.abs(e.clientY - ly) < 40;
    if (t - last < 350 && near && (!SET.touch || touchHidden)) { SET.touch = 1; applyTouch(); saveSettings(); try { navigator.vibrate && navigator.vibrate(15); } catch (x) { } last = 0; }
    else { last = t; lx = e.clientX; ly = e.clientY; }
  });
})();

// ------------------------------------------------------------ switches / variables
const SW_NAMES = { 21: 'tsOn', 22: 'tsOff' };
function getSwitch(id, ev) {
  if (id === 21) return !!(ev && G.temp[ev.key + 'A']);
  if (id === 22) return !(ev && G.temp[ev.key + 'A']);
  if (id === 14) return true;
  if (id >= 15 && id <= 20) return false;
  return !!G.switches[id];
}
function setSwitch(id, v) { G.switches[id] = v; G.refresh = true; }
// Skateboard (the Bike): can be used everywhere
function bikeAllowed() { return true; }
function toggleBike() {   // B key / LB / RB
  if (!(G.items.BICYCLE > 0)) return;
  if (G.biking) { G.biking = false; return; }
  if (bikeAllowed()) G.biking = true; else G.bikeMsg = 'You can\'t use the Skateboard here.';
}
function badgeCount() { return [260, 261, 262, 263].filter(k => getSwitch(k)).length; }   // 260 Pewter, 261 Cerulean, 262 Saffron, 263 Vermilion (Wuant mixtape)
function getVar(id) { return G.vars[id] || 0; }
function setVar(id, v) { G.vars[id] = v; G.refresh = true; }
function selfKey(mapId, evId, ch) { return mapId + '_' + evId + '_' + ch; }

// ------------------------------------------------------------ autotiles
const AUTOTILES = [
  [[27, 28, 33, 34], [5, 28, 33, 34], [27, 6, 33, 34], [5, 6, 33, 34], [27, 28, 33, 12], [5, 28, 33, 12], [27, 6, 33, 12], [5, 6, 33, 12]],
  [[27, 28, 11, 34], [5, 28, 11, 34], [27, 6, 11, 34], [5, 6, 11, 34], [27, 28, 11, 12], [5, 28, 11, 12], [27, 6, 11, 12], [5, 6, 11, 12]],
  [[25, 26, 31, 32], [25, 6, 31, 32], [25, 26, 31, 12], [25, 6, 31, 12], [15, 16, 21, 22], [15, 16, 21, 12], [15, 16, 11, 22], [15, 16, 11, 12]],
  [[29, 30, 35, 36], [29, 30, 11, 36], [5, 30, 35, 36], [5, 30, 11, 36], [39, 40, 45, 46], [5, 40, 45, 46], [39, 6, 45, 46], [5, 6, 45, 46]],
  [[25, 30, 31, 36], [15, 16, 45, 46], [13, 14, 19, 20], [13, 14, 19, 12], [17, 18, 23, 24], [17, 18, 11, 24], [41, 42, 47, 48], [5, 42, 47, 48]],
  [[37, 38, 43, 44], [37, 6, 43, 44], [13, 18, 19, 24], [13, 14, 43, 44], [37, 42, 43, 48], [17, 18, 47, 48], [13, 18, 43, 48], [1, 2, 7, 8]],
];
function drawTile(c, ts, tid, dx, dy) {
  if (tid < 48) return;
  if (tid < 384) {
    const at = Math.floor(tid / 48) - 1, pat = tid % 48;
    const nm = ts.autotiles[at]; if (!nm) return;
    const im = img('autotiles', nm); if (!im) return;
    if (im.height <= 32) { // small animated flat tile
      const n = Math.max(1, Math.floor(im.width / 32)); const f = Math.floor(G.frame / 16) % n;
      c.drawImage(im, f * 32, 0, 32, 32, dx, dy, 32, 32); return;
    }
    const n = Math.max(1, Math.floor(im.width / 96)); const f = Math.floor(G.frame / 16) % n; const fx = f * 96;
    const q = AUTOTILES[Math.floor(pat / 8)][pat % 8];
    for (let k = 0; k < 4; k++) {
      const num = q[k] - 1; const sx = fx + (num % 6) * 16, sy = Math.floor(num / 6) * 16;
      c.drawImage(im, sx, sy, 16, 16, dx + (k % 2) * 16, dy + Math.floor(k / 2) * 16, 16, 16);
    }
  } else {
    const id = tid - 384; const im = img('tilesets', ts.tileset); if (!im) return;
    c.drawImage(im, (id % 8) * 32, Math.floor(id / 8) * 32, 32, 32, dx, dy, 32, 32);
  }
}

// ------------------------------------------------------------ characters
class Chr {
  constructor() {
    this.x = 0; this.y = 0; this.rx = 0; this.ry = 0; this.dir = 2; this.speed = 3; this.moving = false;
    this.gfx = ''; this.tile = 0; this.pattern = 0; this.basePattern = 0; this.anim = 0; this.walkAnim = true; this.stepAnim = false;
    this.dirFix = false; this.through = false; this.top = false; this.opacity = 255; this.transparent = false; this.erased = false;
    this.route = null; this.isPlayer = false; this.forcing = false; this.freqWait = 0; this.sheetOverride = null;
  }
  setPos(x, y) { this.x = x; this.y = y; this.rx = x * TS; this.ry = y * TS; this.moving = false; }
  get gname() { return this.sheetOverride || this.gfx; }
  passableTile(x, y, d) {
    const m = G.map; if (x < 0 || y < 0 || x >= m.w || y >= m.h) { if (this === G.player && !this.through) G.edgeHit = true; return false; }
    const ts = m.ts; const bit = (1 << (d / 2 - 1)) & 0x0f;
    for (let z = 2; z >= 0; z--) {
      const tid = m.data[x + y * m.w + z * m.w * m.h];
      if (tid === undefined) return false;
      const pas = ts.passages[tid] || 0;
      if (pas & 0x10) continue;
      if (pas & bit) return false;
      if ((pas & 0x0f) === 0x0f) return false;
      if ((ts.priorities[tid] || 0) === 0) return true;
    }
    return true;
  }
  canMove(d) {
    if (this.through) return true;
    const [dx, dy] = dirVec[d]; const nx = this.x + dx, ny = this.y + dy;
    if (!this.passableTile(this.x, this.y, d)) return false;
    if (!this.passableTile(nx, ny, opp[d])) return false;
    for (const e of G.chars) {
      if (e === this || e.through || e.erased) continue;
      if (e.x !== nx || e.y !== ny) continue;
      if (e.isPlayer) { if (!this.isPlayer && e.gname !== '') return false; continue; }
      // event blocks if it has a graphic, or (for events) always
      if (this.isPlayer) { if (e.gname !== '' || e.tile > 0) return false; }
      else return false;
    }
    return true;
  }
  turn(d) { if (!this.dirFix) this.dir = d; }
  moveDir(d, turn = true) {
    if (turn) this.turn(d);
    if (!this.canMove(d)) return false;
    const [dx, dy] = dirVec[d]; this.x += dx; this.y += dy; this.moving = true; return true;
  }
  jump(dx, dy) { this.x += dx; this.y += dy; this.moving = true; this.jumping = true; this.jumpTotal = (Math.abs(dx) + Math.abs(dy)) * TS || 1; }
  towardPlayer() { const p = G.player; const dx = p.x - this.x, dy = p.y - this.y; if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 6 : 4; return dy > 0 ? 2 : 8; }
  update() {
    if (this.moving) {
      const sp = TPS[this.speed] * TS / FPS;
      const tx = this.x * TS, ty = this.y * TS;
      const stepx = Math.sign(tx - this.rx) * Math.min(sp, Math.abs(tx - this.rx));
      const stepy = Math.sign(ty - this.ry) * Math.min(sp, Math.abs(ty - this.ry));
      this.rx += stepx; this.ry += stepy;
      this.anim += sp / TS * 2.2;
      if (this.rx === tx && this.ry === ty) { this.moving = false; this.jumping = false; this.onArrive && this.onArrive(); }
    } else if (this.stepAnim) { this.anim += 0.12; }
    if (this.walkAnim && (this.moving || this.stepAnim)) this.pattern = Math.floor(this.anim) % 4;
    else this.pattern = this.basePattern;
    this.updateRoute();
  }
  // ----- forced move routes
  startRoute(route) { this.route = { list: route.list.filter(c => c[0] !== 0), idx: 0, wait: 0, repeat: route.repeat, skip: route.skip, stuck: 0 }; this.forcing = true; }
  updateRoute() {
    const r = this.route; if (!r || this.moving) return;
    if (r.wait > 0) { r.wait--; return; }
    if (r.idx >= r.list.length) { if (r.repeat && r.list.length) { r.idx = 0; } else { this.route = null; this.forcing = false; return; } }
    const [code, p] = r.list[r.idx];
    let adv = true;
    switch (code) {
      case 1: adv = this.rmove(2); break; case 2: adv = this.rmove(4); break;
      case 3: adv = this.rmove(6); break; case 4: adv = this.rmove(8); break;
      case 9: this.rmove([2, 4, 6, 8][Math.floor(Math.random() * 4)]); break;
      case 10: adv = this.rmove(this.towardPlayer()); break;
      case 11: adv = this.rmove(opp[this.towardPlayer()]); break;
      case 12: adv = this.rmove(this.dir); break;
      case 13: adv = this.rmove(opp[this.dir], false); break;
      case 14: this.jump(p[0], p[1]); break;
      case 15: r.wait = p[0] * 2; break;
      case 16: this.turn(2); break; case 17: this.turn(4); break; case 18: this.turn(6); break; case 19: this.turn(8); break;
      case 20: this.turn({ 2: 4, 4: 8, 8: 6, 6: 2 }[this.dir]); break;
      case 21: this.turn({ 2: 6, 6: 8, 8: 4, 4: 2 }[this.dir]); break;
      case 22: this.turn(opp[this.dir]); break;
      case 23: this.turn([2, 4, 6, 8][Math.floor(Math.random() * 4)]); break;
      case 24: this.turn([2, 4, 6, 8][Math.floor(Math.random() * 4)]); break;
      case 25: this.turn(this.towardPlayer()); break;
      case 26: this.turn(opp[this.towardPlayer()]); break;
      case 27: setSwitch(p[0], true); break; case 28: setSwitch(p[0], false); break;
      case 29: this.speed = p[0]; break; case 30: break;
      case 31: this.walkAnim = true; break; case 32: this.walkAnim = false; break;
      case 33: this.stepAnim = true; break; case 34: this.stepAnim = false; break;
      case 35: this.dirFix = true; break; case 36: this.dirFix = false; break;
      case 37: this.through = true; break; case 38: this.through = false; break;
      case 39: this.top = true; break; case 40: this.top = false; break;
      case 41: this.gfx = p[0]; this.dir = p[2]; this.basePattern = p[3]; break;
      case 42: this.opacity = p[0]; break;
      case 43: break; case 44: break; case 45: break;
    }
    if (adv) { r.idx++; r.stuck = 0; }
    else { r.stuck++; if (r.skip) { r.idx++; r.stuck = 0; } else if (r.stuck > 160) { console.warn('route stuck, skipping', this.name, code); r.idx++; r.stuck = 0; } }
  }
  rmove(d, turn = true) { return this.moveDir(d, turn); }
}

class EventChr extends Chr {
  constructor(data, mapId) {
    super(); this.data = data; this.id = data.id; this.name = data.name; this.mapId = mapId; this.key = mapId + '_' + data.id + '_';
    this.setPos(data.x, data.y); this.page = null; this.parallel = null; this.pageIdx = -1; this.randWait = 0;
    this.refreshPage(true);
  }
  condOk(c) {
    if (c.sw1 !== null && !getSwitch(c.sw1, this)) return false;
    if (c.sw2 !== null && !getSwitch(c.sw2, this)) return false;
    if (c.var && getVar(c.var[0]) < c.var[1]) return false;
    if (c.self && !G.selfsw[selfKey(this.mapId, this.id, c.self)]) return false;
    return true;
  }
  refreshPage(first) {
    let idx = -1;
    if (!this.erased) for (let i = this.data.pages.length - 1; i >= 0; i--) { if (this.condOk(this.data.pages[i].cond)) { idx = i; break; } }
    if (idx === this.pageIdx && !first) return;
    this.pageIdx = idx;
    if (idx < 0) { this.page = null; this.gfx = ''; this.tile = 0; this.parallel = null; this.route = null; this.forcing = false; return; }
    const p = this.page = this.data.pages[idx];
    this.gfx = p.gfx.name; this.tile = p.gfx.tile; this.dir = p.gfx.dir; this.basePattern = p.gfx.pat; this.pattern = p.gfx.pat;
    this.opacity = p.gfx.opacity; this.speed = p.speed; this.walkAnim = p.walk; this.stepAnim = p.step; this.dirFix = p.dirfix;
    this.through = p.through; this.top = p.top; this.route = null; this.forcing = false; this.transparent = false;
    this.parallel = (p.trigger === 4) ? new Interp(p.list, this) : null;
  }
  update() {
    super.update();
    if (this.data.name === 'BerryPlant' && typeof berrySync === 'function') berrySync(this);
    if (this.page && this.page.moveType === 3 && this.page.route && !G.main && !G.msg && !G.battle && !this.moving) {   // custom route: only the turn commands are used, so a lookout keeps changing the way it faces
      const ds = this.page.route.list.filter(c => c[0] >= 16 && c[0] <= 19).map(c => ({ 16: 2, 17: 4, 18: 6, 19: 8 })[c[0]]);
      if (ds.length) { if (this.lookWait === undefined || this.lookPage !== this.page) { this.lookPage = this.page; this.lookIdx = 0; this.lookWait = 60; }
        if (--this.lookWait <= 0) { this.lookIdx = (this.lookIdx + 1) % ds.length; this.turn(ds[this.lookIdx]); this.lookWait = 60; } }
    }
    if (this.page && this.page.moveType === 5 && this.page.route && !G.main && !G.msg && !G.battle && !this.moving && !this.forcing) {   // patrol: walk the page's move route in a loop
      const rl = this.page.route.list.filter(c => c[0] >= 1 && c[0] <= 4);
      if (rl.length) { this.patI = (this.patI || 0) % rl.length; if (this.moveDir({ 1: 2, 2: 4, 3: 6, 4: 8 }[rl[this.patI][0]])) this.patI++; }
    }
    if (this.page && this.page.moveType === 1 && !this.moving && !this.forcing && !G.main && !G.msg) {
      if (--this.randWait <= 0) { this.moveDir([2, 4, 6, 8][Math.floor(Math.random() * 4)]); this.randWait = 20 + Math.floor(Math.random() * 40); }
    }
  }
}

const INDOOR_MAPS = [1, 3, 4, 8, 81, 84, 354, 398];
class PlayerChr extends Chr {
  constructor() { super(); this.isPlayer = true; this.name = 'Player'; this.gfx = 'trchar000'; this.speed = 3; this.running = false; this.walkSheet = 'trchar000'; }
  onArrive() { if (typeof grassAnim === 'function') grassAnim(this.x, this.y); if (!G.main) checkTouch(this.x, this.y); if (!G.main && !G.battle && typeof checkWild === 'function') checkWild(this.x, this.y); if (typeof repelStep === 'function') repelStep(); }
}

// ------------------------------------------------------------ maps
function loadMap(id) {
  const raw = window.MAPS[id]; if (!raw) return null;
  const ts = window.TILESETS[raw.tileset] ? {
    tileset: window.TILESETS[raw.tileset].tileset, autotiles: window.TILESETS[raw.tileset].autotiles,
    passages: window.TILESETS[raw.tileset].passages, priorities: window.TILESETS[raw.tileset].priorities, tags: window.TILESETS[raw.tileset].tags || []
  } : { tileset: '', autotiles: [], passages: [], priorities: [], tags: [] };
  return { id, w: raw.w, h: raw.h, data: raw.data, ts, bgm: raw.bgm, events: raw.events, tsId: raw.tileset };
}
function enterMap(id, x, y, dir) {
  const prevMap = G.mapId; const m = loadMap(id); G.map = m; G.mapId = id;
  G.temp = {};
  G.chars = [];
  G.events = {};
  const p = G.player; p.setPos(x, y); if (dir) p.dir = dir; p.route = null; p.forcing = false;
  G.chars.push(p);
  Object.values(m.events).sort((a, b) => a.id - b.id).forEach(d => {
    const e = new EventChr(d, id); G.events[d.id] = e; G.chars.push(e);
    if (G.erasedEv && G.erasedEv[id + ':' + d.id]) e.erased = true;
  });
  G.refresh = true;
  if (typeof locationSign === 'function') locationSign(prevMap, id);
  p.transparent = (id === 1);
  if (m.bgm) playBGM(m.bgm); else if (id !== 1) { /* keep */ }
  G.cam = null;
}
function activeChars() { return G.chars; }
function eventAt(x, y, pred) { return G.chars.filter(e => !e.isPlayer && e.x === x && e.y === y && !e.erased && e.page && (!pred || pred(e))); }

function startEvent(ev) {
  if (G.main || G.battle) return false;
  G.main = new Interp(ev.page.list, ev); return true;
}
// player touch / event touch triggers (RMXP rules)
function overTrigger(e) {
  if (e.gname !== '' && !e.through) return false;
  const m = G.map, ts = m.ts;
  for (let z = 2; z >= 0; z--) {                // passable?(x, y, 0): only fully blocked tiles stop it
    const tid = m.data[e.x + e.y * m.w + z * m.w * m.h]; const pas = ts.passages[tid] || 0;
    if (pas & 0x10) continue; if ((pas & 0x0f) === 0x0f) return false; if ((ts.priorities[tid] || 0) === 0) return true;
  }
  return true;
}
// "Trainer(N)" events spot the player along their facing direction (Essentials' pbEventCanReachPlayer)
function trainerSight() {
  const p = G.player;
  for (const e of G.chars) {
    if (e.isPlayer || e.erased || !e.page || e.page.trigger !== 2 || e.moving) continue;
    const mm = /^Trainer\((\d+)\)/i.exec(e.name || ''); if (!mm) continue;
    const dist = +mm[1], [dx, dy] = dirVec[e.dir];
    const swim = [2, 4, 6, 8].every(d => !e.passableTile(e.x, e.y, d));     // trainer swimming in water: sees the shore tile next to it
    for (let i = 1; i <= dist; i++) {
      const x = e.x + dx * i, y = e.y + dy * i;
      if (!(i === 1 && swim) && (!e.passableTile(x - dx, y - dy, e.dir) || !e.passableTile(x, y, opp[e.dir]))) break;     // trees / walls block the view
      if (p.x === x && p.y === y) { if (startEvent(e)) return true; break; }
      if (G.chars.some(o => o !== e && !o.isPlayer && !o.erased && o.x === x && o.y === y && (o.gname || o.tile))) break;
    }
  }
  return false;
}
function checkTouch(x, y) {
  for (const e of eventAt(x, y, e => (e.page.trigger === 1 || e.page.trigger === 2) && overTrigger(e))) { if (startEvent(e)) return true; }
  return false;
}
function checkBump(d) {
  const [dx, dy] = dirVec[d]; const nx = G.player.x + dx, ny = G.player.y + dy;
  for (const e of eventAt(nx, ny, e => (e.page.trigger === 1 || e.page.trigger === 2) && !overTrigger(e))) { if (startEvent(e)) return true; }
  return false;
}
function faceTalker(e) { if (!e.dirFix && /^(NPC|trchar|trainer)/i.test(e.gname || '')) e.dir = opp[G.player.dir]; }
function checkAction() {
  const p = G.player; const [dx, dy] = dirVec[p.dir];
  for (const e of eventAt(p.x, p.y, e => e.page.trigger === 0 && e.through)) { if (startEvent(e)) return true; }
  for (const e of eventAt(p.x + dx, p.y + dy, e => e.page.trigger === 0)) { if (startEvent(e)) { faceTalker(e); return true; } }
  if (typeof isCounter === 'function' && isCounter(p.x + dx, p.y + dy))        // counter: talk across it
    for (const e of eventAt(p.x + dx * 2, p.y + dy * 2, e => e.page.trigger === 0)) { if (startEvent(e)) { faceTalker(e); return true; } }
  if (typeof wallMapCheck === 'function' && wallMapCheck(p.x + dx, p.y + dy)) return true;
  if (G.items && G.items.OLDROD && typeof terrainTagAt === 'function' && [5, 6, 7].includes(terrainTagAt(p.x + dx, p.y + dy)) && !G.main) {
    G.main = new Interp([[355, 0, ['pbFishAsk']], [0, 0, []]], null); return true;
  }
  return false;
}

// ------------------------------------------------------------ text
const COLORS = ['#303030', '#2a58d8', '#d83030', '#2c9c3c', '#28a8c8', '#b848c0', '#c89818', '#707070', '#c0c0c0'];
function prepText(s) {
  let face = null, bubble = null, sign = false, center = false;
  s = s.replace(/<ac>/g, () => { center = true; return ''; });
  s = s.replace(/\\l\[\d+\]/g, '');
  s = s.replace(/\\ff\[(\w+)\]/g, (m, f) => { face = f; return ''; });
  s = s.replace(/\\w\[(\w+)\]/g, () => { sign = true; return ''; });
  s = s.replace(/\\b/g, () => { bubble = 'b'; return ''; });
  s = s.replace(/\\r/g, () => { bubble = 'r'; return ''; });
  s = s.replace(/\\PN/g, G.name);
  s = s.replace(/\\STARTER/g, () => G.starterName || ((G.party || []).find(p => /^(ILLYA|RORY|HIZUNA)/.test(p.sym)) || (G.party || [])[0] || {}).name || 'my Pokémon');
  s = s.replace(/\\v\[(\d+)\]/g, (m, n) => { const v = G.vars[+n]; return v === undefined ? '0' : String(v); });
  s = s.replace(/\\n/g, '\n');
  s = s.replace(/\\\\/g, '\\');
  return { text: s, face, bubble, sign, center };
}
function tokenize(text, startColor) {
  // returns array of {ch,color}
  const out = []; let color = startColor;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' && text[i + 1] === 'c' && text[i + 2] === '[') {
      const j = text.indexOf(']', i); const n = parseInt(text.slice(i + 3, j)); color = n === 0 ? startColor : (COLORS[n] || startColor); i = j; continue;
    }
    out.push({ ch: c, color });
  }
  return out;
}
function layoutText(tokens, maxW) {
  ctx.font = '26px PkmnEms';
  const lines = []; let cur = []; let curW = 0;
  const words = []; let w = [];
  for (const t of tokens) {
    if (t.ch === '\n') { if (w.length) words.push(w); words.push('NL'); w = []; }
    else if (t.ch === ' ') { w.push(t); words.push(w); w = []; }
    else w.push(t);
  }
  if (w.length) words.push(w);
  for (const wd of words) {
    if (wd === 'NL') { lines.push(cur); cur = []; curW = 0; continue; }
    const ww = wd.reduce((a, t) => a + ctx.measureText(t.ch).width, 0);
    if (curW + ww > maxW && cur.length) { lines.push(cur); cur = []; curW = 0; }
    cur.push(...wd); curW += ww;
  }
  if (cur.length) lines.push(cur);
  return lines.map(l => { while (l.length && l[l.length - 1].ch === ' ') l.pop(); return l; });
}
// message state machine used by the interpreter
function* showMessage(raw, opts = {}) {
  const P = prepText(raw);
  const startColor = P.bubble === 'b' ? '#2a58d8' : P.bubble === 'r' ? '#d83030' : COLORS[0];
  const hasFace = !!P.face && img('faces', P.face);
  const maxW = hasFace ? 360 : 460;
  const toks = tokenize(P.text, startColor);
  const lines = layoutText(toks, maxW);
  const pages = []; for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2));
  if (!pages.length) pages.push([[]]);
  for (let pi = 0; pi < pages.length; pi++) {
    const m = G.msg = { lines: pages[pi], face: hasFace ? P.face : null, shown: 0, total: pages[pi].reduce((a, l) => a + l.length, 0), done: false, center: P.center, sign: P.sign, last: pi === pages.length - 1 };
    while (m.shown < m.total) { m.shown += 2; if (pressed('ok')) { m.shown = m.total; keys.pressed.ok = false; } yield; }
    m.shown = m.total; m.done = true;
    if (opts.noWait && m.last) return;
    yield; keys.pressed.ok = false;
    while (!pressed('ok')) yield;
    keys.pressed.ok = false;
  }
  G.msg = null;
}
function* showChoices(labels, cancelType) {
  const c = G.choice = { labels, idx: 0 }; keys.pressed = {};
  while (true) {
    yield;
    if (pressed('up')) { c.idx = (c.idx + labels.length - 1) % labels.length; keys.pressed.up = false; sfx('cursor'); }
    if (pressed('down')) { c.idx = (c.idx + 1) % labels.length; keys.pressed.down = false; sfx('cursor'); }
    if (pressed('ok')) { keys.pressed.ok = false; sfx('ok'); break; }
    if (pressed('back') && cancelType >= 1 && cancelType <= 4) { keys.pressed.back = false; c.idx = Math.min(cancelType - 1, labels.length - 1); break; }
    keys.pressed.back = false;
  }
  G.choice = null; G.msg = null;
  return c.idx;
}
function* promptName(label, def, max) {
  G.modal = true;
  const box = document.getElementById('nameBox'), inp = document.getElementById('nameInput');
  document.getElementById('nameLabel').textContent = label; inp.value = def || ''; inp.maxLength = max || 10;
  box.style.display = 'flex'; let ok = false;
  const done = () => { ok = true; };
  const btn = document.getElementById('nameOk'); btn.onclick = done;
  inp.onkeydown = e => { if (e.key === 'Enter') done(); e.stopPropagation(); };
  setTimeout(() => inp.focus(), 30);
  keys.pressed = {}; let wait = 20;
  while (!ok) { yield; if (wait > 0) wait--; else if (keys.pressed.ok || keys.pressed.menu) done(); }   // controller: A / Start confirms
  const val = inp.value.trim() || def;
  box.style.display = 'none'; G.modal = false; canvas.focus(); keys.pressed = {}; keys.held = {};
  return val;
}

// ------------------------------------------------------------ interpreter
class Interp {
  constructor(list, ev) { this.list = list; this.ev = ev; this.gen = this.run(); this.done = false; if (G.player) { G.player.speed = 3; G.player.sheetOverride = null; } }   // cutscenes always start at walking pace (not mid-run)
  update() { if (this.done) return; const r = this.gen.next(); if (r.done) this.done = true; }
  evChr(id) {
    if (id === -1) return G.player;
    if (id === 0) return this.ev;
    return G.events[id];
  }
  findEnd(i, indent, codes) {
    const L = this.list;
    for (let j = i + 1; j < L.length; j++) if (L[j][1] === indent && codes.includes(L[j][0])) return j;
    return L.length;
  }
  *run() {
    const L = this.list; let i = 0;
    while (i < L.length) {
      const [code, indent, p] = L[i];
      switch (code) {
        case 101: {
          let txt = p[0]; let j = i + 1;
          while (j < L.length && L[j][0] === 401) { txt += L[j][2][0]; j++; }
          const nextIsChoice = j < L.length && L[j][0] === 102;
          const dm = txt.match(/Take (Illya|Hizuna|Rory)\?/); if (dm) G.dexPic = dm[1];
          yield* showMessage(txt, { noWait: nextIsChoice });
          i = j; continue;
        }
        case 102: {
          let idx;
          if (p[0].includes('Adventure') && p[0].includes('Controls')) { idx = yield* showChoices(['Controls', 'No info needed'], 2); if (idx === 1) idx = 2; }   // the "Adventure" help page was removed
          else idx = yield* showChoices(p[0], p[1]);
          G.dexPic = null;
          let j = i + 1;
          while (j < L.length) { if (L[j][0] === 402 && L[j][1] === indent && L[j][2][0] === idx) break; j++; }
          i = j + 1; continue;
        }
        case 402: i = this.findEnd(i, indent, [404]) + 1; continue;
        case 111: {
          let ok;
          if (p[0] === 12 && p[1].includes('pbTrainerBattle')) { yield* runTrainerBattle(p[1]); ok = G.battleResult === 'win'; if (G.battleResult === 'lose') { yield* blackout(); this.done = true; return; } }
          else if (p[0] === 12 && p[1] === 'Kernel.pbCut') ok = yield* cutTreeCheck();
          else if (p[0] === 12 && p[1] === 'Kernel.pbRockSmash') ok = yield* rockSmashCheck();
          else ok = this.cond(p);
          if (ok) { i++; continue; }
          const j = this.findEnd(i, indent, [411, 412]); i = j + 1; continue;
        }
        case 411: i = this.findEnd(i, indent, [412]) + 1; continue;
        case 115: return;
        case 314: G.party.forEach(healMon); break;
        case 116: if (this.ev) { this.ev.erased = true; this.ev.refreshPage(); } break;
        case 118: break;
        case 119: { const j = L.findIndex(c => c[0] === 118 && c[2][0] === p[0]); if (j >= 0) { i = j + 1; continue; } break; }
        case 121: for (let k = p[0]; k <= p[1]; k++) setSwitch(k, p[2] === 0); break;
        case 122: {
          let val = p[4]; if (p[3] === 1) val = getVar(p[4]); else if (p[3] === 2) val = p[4] + Math.floor(Math.random() * (p[5] - p[4] + 1));
          for (let k = p[0]; k <= p[1]; k++) {
            const cur = getVar(k);
            const nv = [val, cur + val, cur - val, cur * val, val ? Math.trunc(cur / val) : cur, val ? cur % val : cur][p[2]];
            setVar(k, nv);
          }
          break;
        }
        case 123: G.selfsw[selfKey(G.mapId, this.ev.id, p[0])] = p[1] === 0; G.refresh = true; break;
        case 106: { let n = p[0] * 2; while (n-- > 0) yield; break; }
        case 201: { yield* this.transfer(p); break; }
        case 202: { const c = this.evChr(p[0]); if (c) { c.setPos(p[2], p[3]); if (p[4]) c.dir = p[4]; } break; }
        case 208: G.player.transparent = (p[0] === 0); break;
        case 209: {
          let c = this.evChr(p[0]);
          if (this.ev && p[0] > 0 && this.ev.name === 'Nurse' && (!c || c === this.ev)) {      // the heal script addresses the machine by its id in the original map; it may not be this map's id       // the heal script addresses the machine by id; here that id is the nurse herself
            const mach = G.chars.find(e => e.name === 'Healing balls'); if (mach) { c = mach; const ids = p[1].list.map(x => x[0]); if (ids.includes(33)) mach.walkAnim = true; if (ids.includes(34)) mach.walkAnim = false; }
          }
          if (c) c.startRoute(p[1]); break;
        }
        case 210: { while (G.chars.some(c => c.forcing)) yield; break; }
        case 221: G.frozen = snapshot(); break;
        case 222: yield* this.runTransition(); break;
        case 223: tone(p[0].tone, p[1]); break;
        case 231: {
          const [n, name, origin, , x, y, zx, zy, op] = p;
          G.pics[n] = { img: img('pictures', name), origin, x, y, zx: zx / 100, zy: zy / 100, op, mv: null }; break;
        }
        case 232: {
          const [n, dur, origin, , x, y, zx, zy, op] = p; const pc = G.pics[n]; if (!pc) break;
          pc.mv = { left: Math.max(1, dur * 2), x, y, zx: zx / 100, zy: zy / 100, op }; pc.origin = origin; break;
        }
        case 235: delete G.pics[p[0]]; break;
        case 241: playBGM(p[0].name, 0.6 * (p[0].vol / 100)); break;
        case 242: fadeBGM(p[0]); break;
        case 249: if (p[0] && p[0].name) playME(p[0].name); break;
        case 250: if (p[0] && p[0].name) playSE(p[0].name, (p[0].vol || 100) / 100); break;
        case 355: {
          let s = p[0]; let j = i + 1;
          while (j < L.length && L[j][0] === 655) { s += '\n' + L[j][2][0]; j++; }
          yield* this.script(s); i = j; continue;
        }
        default: break;
      }
      i++;
    }
  }
  cond(p) {
    switch (p[0]) {
      case 0: return getSwitch(p[1], this.ev) === (p[2] === 0);
      case 1: {
        const a = getVar(p[1]); const b = p[2] === 0 ? p[3] : getVar(p[3]);
        return [a === b, a >= b, a <= b, a > b, a < b, a !== b][p[4]];
      }
      case 2: return !!G.selfsw[selfKey(G.mapId, this.ev.id, p[1])] === (p[2] === 0);
      case 12: return this.scriptCond(p[1]);
    }
    console.warn('unhandled cond', p); return false;
  }
  scriptCond(s) {
    if (s.includes('onEvent?')) return G.player.x === this.ev.x && G.player.y === this.ev.y;
    if (s.includes('$game_player.x<15')) return G.player.x < 15 && G.mapId === 3;
    { const nb = s.match(/^\$Trainer\.numbadges\s*(>=|>|==)\s*(\d+)$/); if (nb) { const have = badgeCount(), n = +nb[2]; return nb[1] === '>=' ? have >= n : nb[1] === '>' ? have > n : have === n; } }
    { const hi = s.match(/^\$PokemonBag\.pbHasItem\?\(:(\w+)\)$/); if (hi) return !!(G.items[hi[1]] > 0); }
    if (s.includes('pbPokerus')) return false;
    if (s.includes('gender == 0')) return true;
    if (s.includes('gender == 1')) return false;
    { const pm = s.match(/^\$game_player\.([xy])\s*(==|!=|<=|>=|<|>)\s*(\d+)$/);
      if (pm) { const a = G.player[pm[1]], b = +pm[3]; return { '==': a === b, '!=': a !== b, '<=': a <= b, '>=': a >= b, '<': a < b, '>': a > b }[pm[2]]; } }
    console.warn('unhandled script cond', s); return false;
  }
  *runTransition() {
    const snap = G.frozen; G.frozen = null; if (!snap) return;
    for (let t = 0; t < 20; t++) { G.trans = { snap, a: 1 - t / 20 }; yield; }
    G.trans = null;
  }
  *transfer(p) {
    const [, mid, x, y, dir, fade] = p; G.keepDir = true;
    if (!window.MAPS[mid]) {
      yield* showMessage('(That part of the game is not in this test build yet.)');
      tone([0, 0, 0, 0], 8); G.player.moving = false;
      const d = dir || opp[G.player.dir]; const [dx, dy] = dirVec[opp[G.player.dir]];
      G.player.setPos(G.player.x + dx, G.player.y + dy); G.player.turn(G.player.dir);
      return;
    }
    { const was = INDOOR_MAPS.includes(G.mapId), will = INDOOR_MAPS.includes(mid);
      if (was !== will && !(G.lastDoorSE && G.frame - G.lastDoorSE < 60)) playSE(will ? 'Entering_Door' : 'Exit_Door'); }
    yield;
    const black = G.tone.cur[0] > -200 || G.tone.left > 0;
    if (fade === 0 && black) { tone([-255, -255, -255, 0], 8); while (G.tone.left > 0) yield; }
    enterMap(mid, x, y, dir || G.player.dir);
    yield;
    if (fade === 0 && black) { tone([0, 0, 0, 0], 8); }
  }
  *script(s) {
    let m;
    if ((m = s.match(/^pbToneChangeAll\(Tone\.new\((-?\d+),(-?\d+),(-?\d+),(-?\d+)\),(\d+)\)/))) { tone([+m[1], +m[2], +m[3], +m[4]], +m[5]); return; }
    if (s === 'pbEventScreen(ButtonEventScene)') {
      yield* showMessage('Move: arrow keys or WASD.\nConfirm / talk: Z, Enter or Space.\nCancel: X. Hold X or Shift to run (once you own running shoes).'); return;
    }
    if (s.startsWith('pbChangePlayer')) { return; }
    if (s === 'pbTrainerName') { G.name = yield* promptName('Your name?', 'Jorge', 8); return; }
    if (s.startsWith('pbTrainerName(')) return;
    if ((m = s.match(/^pbSet\((\d+),pbEnterNPCName\("([^"]*)",(\d+),(\d+),"([^"]*)"/))) {
      const v = yield* promptName(m[2].replace(/\s*\n\s*/g, ' ').replace(/Rival\\'s/, "Rival's"), m[5], +m[4]); setVar(+m[1], v); return;
    }
    if ((m = s.match(/^pbSet\((\d+),"([^"]*)"\)/))) { setVar(+m[1], m[2]); return; }
    if ((m = s.match(/^pbSetSelfSwitch\((\d+),"(\w)",(true|false)\)/))) { G.selfsw[selfKey(G.mapId, +m[1], m[2])] = m[3] === 'true'; G.refresh = true; return; }
    if ((m = s.match(/^setTempSwitchOn\("(\w)"\)/))) { if (this.ev) { G.temp[this.ev.key + m[1]] = true; G.refresh = true; } return; }
    if ((m = s.match(/^setTempSwitchOff\("(\w)"\)/))) { if (this.ev) { G.temp[this.ev.key + m[1]] = false; G.refresh = true; } return; }
    if (s.startsWith('e=$game_map.events[')) {
      const id = +s.match(/events\[(\d+)\]/)[1]; const e = G.events[id]; const pl = G.player;
      if (e) { const dx = e.x - pl.x, dy = e.y - pl.y; pl.turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 6 : 4) : (dy > 0 ? 2 : 8)); }
      return;
    }
    if ((m = s.match(/^pbAddPokemon\(:(\w+),(\d+)\)/))) { const mon = makeMon(symOf(m[1]), +m[2]); if (!G.party.length && !G.starterName) G.starterName = mon.name; if (G.party.length >= 6) { pcAdd(mon); G.owned = G.owned || {}; G.owned[mon.sym] = true; yield* showMessage(pokeName(mon) + ' was sent to the PC because your party is full.'); return; } G.party.push(mon); return; }
    if ((m = s.match(/^\$Trainer\.party\[-1\]\.pbLearnMove\(:(\w+)\)/))) {
      const mon = G.party[G.party.length - 1]; if (mon && D.MV[m[1]] && !mon.moves.some(x => x.id === m[1])) { const slot = newMoveSlot(m[1]); if (mon.moves.length < 4) mon.moves.push(slot); else mon.moves[3] = slot; }
      return;
    }
    if (/^pb(RemoveDependency2|DeregisterPartner|CaveExit|CaveEntrance)/.test(s)) return;
    if (s === 'pbHealAll') { G.party.forEach(healMon); return; }
    if (s === '$PokemonGlobal.runningShoes=true') { G.runningShoes = true; return; }
    if ((m = s.match(/^pbMEPlay\("([^"]+)"/))) { playME(m[1]); return; }
    if (s.startsWith('pbMEPlay')) { return; }
    if ((m = s.match(/^Kernel\.pbReceiveItem\(:(\w+)(?:,(\d+))?\)/))) {
      const n = m[2] ? +m[2] : 1; G.items[m[1]] = (G.items[m[1]] || 0) + n; playME('Item_get');
      yield* showMessage('\\PN found ' + (n > 1 ? n + ' ' : 'the ') + itemName(m[1]) + '!'); return;
    }
    if ((m = s.match(/^pbAddItem\(:(\w+)(?:,(\d+))?\)/))) { G.items[m[1]] = (G.items[m[1]] || 0) + (m[2] ? +m[2] : 1); return; }
    if ((m = s.match(/^pbTakeItem\(:(\w+)(?:,(\d+))?\)/))) { G.items[m[1]] = Math.max(0, (G.items[m[1]] || 0) - (m[2] ? +m[2] : 1)); if (!G.items[m[1]]) delete G.items[m[1]]; return; }
    if ((m = s.match(/^pbShake\((\d+),(\d+)\)/))) { G.shake = { p: +m[1], left: +m[2] }; return; }
    if ((m = s.match(/^pbFlash\((\d+),(\d+),(\d+),(\d+)\)/))) { G.flash = { c: [+m[1], +m[2], +m[3]], left: +m[4], total: +m[4] }; return; }
    if ((m = s.match(/^pbSE\("([^"]+)"\)/))) { playSE(m[1]); return; }
    if ((m = s.match(/^\$PokemonBag\.pbDeleteItem\(:(\w+)(?:,\s*(\d+))?\)/))) { G.items[m[1]] = Math.max(0, (G.items[m[1]] || 0) - (m[2] ? +m[2] : 1)); if (!G.items[m[1]]) delete G.items[m[1]]; return; }
    if (s.startsWith('$PokemonBag.pbDeleteItem')) { return; }
    if (s.startsWith('$Trainer.pokedex')) { G.pokedex = true; return; }
    if (s === 'pbTrainerPC') { yield* showMessage('\\PN booted up the PC.\n(Storage is not in this test build.)'); return; }
    if (s === 'pbCaveEntrance') return;
    if (typeof worldScript === 'function' && (yield* worldScript(this, s))) return;
    console.warn('unhandled script:', s);
  }
}
function itemName(k) { return { TOWNMAP: 'Town Map', POKEBALL: 'Poké Ball', OAKSPARCEL: "Geso's parcel" }[k] || (window.DATA && DATA.IT && DATA.IT[k] && DATA.IT[k].name) || k; }


// ------------------------------------------------------------ tone / transitions
function tone(t, dur) { G.tone.tgt = t.slice(); G.tone.left = Math.max(0, dur); if (dur <= 0) { G.tone.cur = t.slice(); } }
function snapshot() { const c = document.createElement('canvas'); c.width = SW; c.height = SH; c.getContext('2d').drawImage(canvas, 0, 0); return c; }

// ------------------------------------------------------------ update
function updateTone() {
  if (G.shake && G.shake.left > 0) G.shake.left--;
  if (G.flash && G.flash.left > 0) G.flash.left--;
  const t = G.tone; if (t.left > 0) { for (let i = 0; i < 4; i++) t.cur[i] += (t.tgt[i] - t.cur[i]) / t.left; t.left--; if (t.left === 0) t.cur = t.tgt.slice(); }
}
function updatePics() {
  for (const pc of Object.values(G.pics)) {
    const m = pc.mv; if (!m) continue;
    pc.x += (m.x - pc.x) / m.left; pc.y += (m.y - pc.y) / m.left; pc.zx += (m.zx - pc.zx) / m.left; pc.zy += (m.zy - pc.zy) / m.left; pc.op += (m.op - pc.op) / m.left;
    m.left--; if (m.left <= 0) { pc.x = m.x; pc.y = m.y; pc.zx = m.zx; pc.zy = m.zy; pc.op = m.op; pc.mv = null; }
  }
}
function update() {
  G.frame++; pollPad();
  if (G.fadeRelease) { G.fade = Math.max(0, G.fade - 0.07); if (G.fade <= 0) G.fadeRelease = false; }
  if (G.uiGen) { updateUI(); keys.pressed = {}; return; }
  if (G.started) G.playFrames++;
  if (G.menu) { updateMenu(); return; }
  if (G.refresh) { G.refresh = false; G.chars.forEach(c => c.refreshPage && c.refreshPage()); }
  updateTone(); updatePics();
  if (G.battle) { updateBattle(); keys.pressed = {}; return; }
  if (G.main) { G.main.update(); if (G.main.done) G.main = null; }
  // parallel processes
  for (const c of G.chars) {
    if (c.parallel) { c.parallel.update(); if (c.parallel.done && c.page) c.parallel = new Interp(c.page.list, c); }
  }
  if (G.refresh) { G.refresh = false; G.chars.forEach(c => c.refreshPage && c.refreshPage()); }
  if (G.biking && !bikeAllowed()) G.biking = false;
  if (G.repelEnd && !G.main && !G.msg && !G.battle && !G.trans && !G.frozen && !G.uiGen) { G.repelEnd = false; G.main = new Interp([[355, 0, ['pbRepelEnd']], [0, 0, []]], null); }
  if (G.bikeMsg && !G.main && !G.msg && !G.main) { const m = G.bikeMsg; G.bikeMsg = null; G.main = new Interp([[101, 0, [m]], [0, 0, []]], null); }
  // autorun
  if (!G.main && !G.msg && !G.battle && !G.trans && !G.frozen) {
    for (const c of G.chars) { if (c.page && !c.erased && c.page.trigger === 3) { startEvent(c); break; } }
  }
  const p = G.player;
  for (const c of G.chars) c.update();
  // player control
  if (G.edgeHit) {
    G.edgeHit = false;
    if (!G.main && !G.msg && !G.battle && !p.forcing && typeof edgeConnection === 'function') edgeConnection();
  }
  const busy = G.main || G.msg || G.choice || G.battle || G.trans || G.frozen || G.modal || p.forcing;
  if (busy) { G.wasBusy = true; p.turnWait = 0; }
  else if (G.wasBusy) {             // an event just ended: keys still held from before must be released first (no re-trigger)
    G.wasBusy = false; G.lock = {}; keys.pressed = {};
    const keep = G.keepDir; G.keepDir = false;                                   // after a map change keep walking in the held direction
    for (const k of (keep ? ['ok'] : ['up', 'down', 'left', 'right', 'ok'])) if (keys.held[k]) G.lock[k] = true;
  }
  if (G.lock) for (const k in G.lock) if (!keys.held[k]) delete G.lock[k];
  const held = k => keys.held[k] && !(G.lock && G.lock[k]);
  if (!busy && !p.moving) {
    if (trainerSight()) { keys.pressed = {}; return; }
    if (pressed('menu')) { openPause(); keys.pressed = {}; return; }
    if (pressed('bike')) { toggleBike(); keys.pressed = {}; return; }
    const run = held('run') && G.runningShoes;
    let moved = false, anyDir = false;
    for (const [k, d] of [['down', 2], ['left', 4], ['right', 6], ['up', 8]]) {
      if (held(k)) {
        anyDir = true;
        if (p.dir !== d) { p.dir = d; p.turnWait = 7; p.bumped = false; break; }      // tap = just turn
        if (p.turnWait > 0) { p.turnWait--; break; }                                  // keep holding to walk
        p.speed = G.biking ? 5 : run ? 4 : 3; p.sheetOverride = G.biking ? 'boy_bike' : run ? 'boy_run' : null;
        if (d !== 8 && typeof ledgeJump === 'function' && ledgeJump(p, d)) { moved = true; p.bumped = false; }
        else if (p.moveDir(d)) { moved = true; p.bumped = false; }
        else if (!p.bumped) { p.bumped = true; if (!checkBump(d)) sfx('bump'); }
        break;
      }
    }
    if (!anyDir) { p.turnWait = 0; p.bumped = false; }
    if (!moved && pressed('ok') && !(G.lock && G.lock.ok)) checkAction();
  }
  if (G.biking) p.sheetOverride = 'boy_bike';
  else if (!p.moving && !p.forcing && !keys.held.run) p.sheetOverride = null;
  else if (p.sheetOverride === 'boy_bike') p.sheetOverride = null;
  keys.pressed = {};
}

// ------------------------------------------------------------ options menu
const SPEEDS = [1, 1.5, 2, 3];
function openMenu() { G.menu = { idx: 0 }; sfx('ok'); }
function closeMenu() { G.menu = null; saveSettings(); keys.pressed = {}; G.lock = G.lock || {}; for (const k of ['ok', 'up', 'down', 'left', 'right']) if (keys.held[k]) G.lock[k] = true; }
function updateMenu() {
  const m = G.menu;
  if (pressed('up')) { m.idx = (m.idx + 3) % 4; sfx('cursor'); }
  if (pressed('down')) { m.idx = (m.idx + 1) % 4; sfx('cursor'); }
  const dl = pressed('left') ? -1 : pressed('right') ? 1 : 0;
  if (dl) {
    if (m.idx === 0) { SET.music = Math.max(0, Math.min(1, Math.round((SET.music + dl * 0.1) * 10) / 10)); applyVolumes(); }
    else if (m.idx === 1) { SET.sfx = Math.max(0, Math.min(1, Math.round((SET.sfx + dl * 0.1) * 10) / 10)); sfx('ok'); }
    else if (m.idx === 2) { let i = SPEEDS.indexOf(SET.speed); i = Math.max(0, Math.min(SPEEDS.length - 1, i + dl)); SET.speed = SPEEDS[i]; sfx('cursor'); }
  }
  if (pressed('ok') && m.idx === 2) { SET.speed = SPEEDS[(SPEEDS.indexOf(SET.speed) + 1) % SPEEDS.length]; sfx('cursor'); }
  if ((pressed('ok') && m.idx === 3) || pressed('menu') || pressed('back')) { sfx('back'); closeMenu(); return; }
  keys.pressed = {};
}
function drawMenu() {
  const m = G.menu; if (!m) return;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, SW, SH);
  const x = 56, y = 56, w = SW - 112, h = 272;
  drawBox(x, y, w, h);
  ctx.font = 'bold 22px "Trebuchet MS", sans-serif'; ctx.fillStyle = '#303030'; ctx.textAlign = 'left';
  ctx.fillText('Options', x + 26, y + 42);
  ctx.font = '19px "Trebuchet MS", sans-serif';
  const rows = [['Music volume', SET.music], ['Sound effects', SET.sfx], ['Game speed', null], ['Resume', null]];
  rows.forEach(([label, v], i) => {
    const ry = y + 86 + i * 44;
    if (i === m.idx) { ctx.fillStyle = '#d85048'; ctx.fillText('▶', x + 18, ry); }
    ctx.fillStyle = '#303030'; ctx.fillText(label, x + 44, ry);
    if (v !== null) {
      const bx = x + 200, bw = 130;
      ctx.fillStyle = '#c8d0d8'; ctx.fillRect(bx, ry - 14, bw, 14);
      ctx.fillStyle = '#3a78d8'; ctx.fillRect(bx, ry - 14, bw * v, 14);
      ctx.strokeStyle = '#485868'; ctx.lineWidth = 1; ctx.strokeRect(bx + .5, ry - 13.5, bw - 1, 13);
      ctx.fillStyle = '#303030'; ctx.fillText(Math.round(v * 100) + '%', bx + bw + 10, ry);
    } else if (i === 2) {
      ctx.fillText('◀  ' + SET.speed + 'x  ▶', x + 200, ry);
    }
  });
  ctx.font = '13px sans-serif'; ctx.fillStyle = '#707070';
  ctx.fillText('↑↓ select · ←→ change · Esc / X close', x + 26, y + h - 18);
}

// ------------------------------------------------------------ render
function camera() {
  const m = G.map, p = G.player; const mw = m.w * TS, mh = m.h * TS;
  let cx = p.rx + 16 - SW / 2, cy = p.ry + 16 - SH / 2;
  cx = mw <= SW ? -(SW - mw) / 2 : Math.max(0, Math.min(mw - SW, cx));
  cy = mh <= SH ? -(SH - mh) / 2 : Math.max(0, Math.min(mh - SH, cy));
  if (G.shake && G.shake.left > 0) { cx += Math.round(Math.sin(G.frame * 1.9) * G.shake.p); cy += Math.round(Math.cos(G.frame * 2.3) * G.shake.p * 0.6); }
  return [Math.round(cx), Math.round(cy)];
}
function drawChr(c, cx, cy) {
  if (c.erased || c.transparent || c.opacity <= 0) return;
  const name = c.gname; if (!name) return;
  const im = img('characters', name); if (!im) return;
  const fw = im.width / 4, fh = im.height / 4;
  const row = (name === 'boy_bike' ? { 2: 0, 4: 2, 6: 2, 8: 3 } : { 2: 0, 4: 1, 6: 2, 8: 3 })[c.dir];
  const px = Math.round(c.rx + 16 - fw / 2 - cx), py = Math.round(c.ry + 32 - fh - cy);
  ctx.globalAlpha = c.opacity / 255;
  let yo = 0;
  if (c.jumping && c.jumpTotal) { const rem = Math.abs(c.x * TS - c.rx) + Math.abs(c.y * TS - c.ry); const pr = Math.max(0, Math.min(1, 1 - rem / c.jumpTotal)); yo = -Math.sin(pr * Math.PI) * 26; const sh = img('ui', 'battle/object_shadow'); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(Math.round(c.rx + 16 - cx), Math.round(c.ry + 30 - cy), 11, 5, 0, 0, 7); ctx.fill(); }
  ctx.drawImage(im, c.pattern * fw, row * fh, fw, fh, px, py + Math.round(yo), fw, fh);
  ctx.globalAlpha = 1;
}
function drawMap() {
  const m = G.map; if (!m) return;
  const [cx, cy] = camera();
  const x0 = Math.max(0, Math.floor(cx / TS)), x1 = Math.min(m.w - 1, Math.floor((cx + SW) / TS));
  const y0 = Math.max(0, Math.floor(cy / TS)), y1 = Math.min(m.h - 1, Math.floor((cy + SH) / TS));
  const top = [];
  for (let z = 0; z < 3; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const tid = m.data[x + y * m.w + z * m.w * m.h]; if (!tid) continue;
    const pr = tid >= 48 ? (m.ts.priorities[tid] || 0) : (m.ts.priorities[tid] || 0);
    if (pr === 0) drawTile(ctx, m.ts, tid, x * TS - cx, y * TS - cy);
    else top.push({ z: (y + pr) * TS + 0.1, tid, x, y });
  }
  const items = top.map(t => ({ z: t.z, f: () => drawTile(ctx, m.ts, t.tid, t.x * TS - cx, t.y * TS - cy) }));
  for (const c of G.chars) items.push({ z: c.top ? 99999 : c.ry + 32 + (c.isPlayer ? 0.05 : 0), f: () => drawChr(c, cx, cy) });
  if (typeof grassItems === 'function') grassItems(items, cx, cy);
  items.sort((a, b) => a.z - b.z);
  items.forEach(it => it.f());
}
function drawPics() {
  const ks = Object.keys(G.pics).map(Number).sort((a, b) => a - b);
  for (const k of ks) {
    const pc = G.pics[k]; if (!pc.img) continue; const w = pc.img.width * pc.zx, h = pc.img.height * pc.zy;
    ctx.globalAlpha = Math.max(0, Math.min(1, pc.op / 255));
    const dx = pc.origin === 1 ? pc.x - w / 2 : pc.x, dy = pc.origin === 1 ? pc.y - h / 2 : pc.y;
    ctx.drawImage(pc.img, dx, dy, w, h); ctx.globalAlpha = 1;
  }
}
function drawTone() {
  if (G.flash && G.flash.left > 0) { ctx.fillStyle = 'rgba(' + G.flash.c.join(',') + ',' + (G.flash.left / G.flash.total).toFixed(3) + ')'; ctx.fillRect(0, 0, SW, SH); }
  const t = G.tone.cur; const dark = Math.max(0, Math.min(1, -Math.min(t[0], t[1], t[2]) / 255));
  if (dark > 0.002) { ctx.fillStyle = 'rgba(0,0,0,' + dark + ')'; ctx.fillRect(0, 0, SW, SH); }
}
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function drawBox(x, y, w, h) {
  ctx.fillStyle = '#485868'; roundRect(ctx, x, y, w, h, 12); ctx.fill();
  ctx.fillStyle = '#f8f8f8'; roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 9); ctx.fill();
  ctx.strokeStyle = '#d85048'; ctx.lineWidth = 2; roundRect(ctx, x + 7, y + 7, w - 14, h - 14, 7); ctx.stroke();
}
function drawMsg() {
  const m = G.msg; if (!m) return;
  const by = SH - 96;
  pic('battle/overlay_message', 0, by);
  let tx = 30;
  if (m.face) { const f = img('faces', m.face); if (f) ctx.drawImage(f, 8, by, 96, 96); tx = 116; }
  let left = m.shown;
  m.lines.forEach((ln, li) => {
    let wsum = 0; if (m.center) wsum = ln.reduce((a, t) => a + txtW(t.ch, 26), 0);
    let x = m.center ? (SW - wsum) / 2 : tx;
    for (const t of ln) {
      if (left <= 0) break; left--;
      const base = t.color === '#303030' ? '#404040' : t.color;
      txt(t.ch, x, by + 22 + li * 32, { base, shadow: '#b8b8b8', size: 26 }); x += txtW(t.ch, 26);
    }
  });
  if (m.done && Math.floor(G.frame / 12) % 2 === 0) { ctx.fillStyle = '#d85048'; ctx.beginPath(); ctx.moveTo(480, SH - 26); ctx.lineTo(494, SH - 26); ctx.lineTo(487, SH - 16); ctx.closePath(); ctx.fill(); }
}
function drawChoice() {
  const c = G.choice; if (!c) return;
  const w = Math.max(...c.labels.map(l => txtW(l, 26))) + 64, h = c.labels.length * 32 + 32;
  const x = SW - w, y = SH - 96 - h;
  skinBox('skin_choice_1', x, y, w, h);
  c.labels.forEach((l, i) => { txt(l, x + 40, y + 16 + i * 32, { size: 26 }); if (i === c.idx) pic('selarrow', x + 22, y + 16 + i * 32); });
}
function render() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
  if (G.frozen) { ctx.drawImage(G.frozen, 0, 0); return; }
  if (G.battle) drawBattle();
  else { drawMap(); if (typeof drawBalloons === 'function') drawBalloons(); if (typeof drawLocation === 'function') drawLocation(); drawPics(); }
  if (G.trans) { ctx.globalAlpha = G.trans.a; ctx.drawImage(G.trans.snap, 0, 0); ctx.globalAlpha = 1; }
  drawTone();
  if (G.dexPic && img('pictures', 'dex' + G.dexPic)) { const dpi = img('pictures', 'dex' + G.dexPic); ctx.drawImage(dpi, Math.round((SW - dpi.width) / 2), Math.max(8, Math.round((SH - 96 - dpi.height) / 2))); }
  drawMsg(); drawChoice(); drawMenu();
  if (G.uiDraw) G.uiDraw();
  if (G.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + G.fade + ')'; ctx.fillRect(0, 0, SW, SH); }
}

// ------------------------------------------------------------ main loop
let last = 0, acc = 0;
function loop(ts) {
  if (!last) last = ts; acc += Math.min(200, ts - last); last = ts;
  if (!G.manual) { const step = 1000 / (FPS * SET.speed); let n = 0; while (acc >= step && n++ < 40) { update(); acc -= step; } if (acc > step) acc = 0; render(); }
  requestAnimationFrame(loop);
}
G.tick = function (n = 1) { for (let i = 0; i < n; i++) update(); render(); };

for (const ev of ['keydown', 'pointerdown', 'mousedown', 'touchstart']) window.addEventListener(ev, () => { G.gesture = true; if (G.bgmBlocked && G.bgm && G.bgm.a.paused) { G.bgmBlocked = false; G.bgm.a.play().catch(() => { G.bgmBlocked = true; }); } }, true);
