'use strict';
// ===================================================================
//  UI toolkit: Essentials-style text, window skins, SE, screen runner
// ===================================================================
const FONT = 'PkmnEms';
const COL = {
  dark: ['#585850', '#a8b8b8'],          // DARKTEXTBASE / SHADOW  (text on light windows)
  light: ['#f8f8f8', '#485058'],         // LIGHTTEXTBASE / SHADOW (text on dark windows)
  red: ['#e00808', '#f8b8b8'], blue: ['#0070f8', '#98b8e8'], green: ['#00a800', '#a0e0a0'],
  black: ['#303030', '#b8b8b8'],
};
function txt(s, x, y, o = {}) {
  s = String(s); const size = o.size || 24; y += Math.round(size * 0.75) + 1;
  ctx.font = size + 'px ' + (o.font || FONT); ctx.textBaseline = 'alphabetic'; ctx.textAlign = o.align || 'left';
  const c = o.col || COL.dark; const base = o.base || c[0], sh = o.shadow || c[1];
  if (o.shadow !== null) { ctx.fillStyle = sh; ctx.fillText(s, x + 2, y + 2); }
  ctx.fillStyle = base; ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
}
function txtW(s, size = 24) { ctx.font = size + 'px ' + FONT; return ctx.measureText(String(s)).width; }
function wrap(s, maxW, size = 24) {
  ctx.font = size + 'px ' + FONT; const out = [];
  for (const para of String(s).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}
const UI = n => img('ui', n);
function pic(name, x, y, sx, sy, sw, sh, dx, dy, dw, dh) {
  const im = UI(name); if (!im) return;
  if (sx === undefined) ctx.drawImage(im, x, y);
  else ctx.drawImage(im, sx, sy, sw, sh, x, y, sw, sh);
}
function slice(name, sx, sy, sw, sh, dx, dy) { const im = UI(name); if (im) ctx.drawImage(im, sx, sy, sw, sh, dx, dy, sw, sh); }
// 3x3 window skin (Essentials "choice" skins: 48x48 => 16px cells)
function skinBox(name, x, y, w, h) {
  const im = UI(name); if (!im) { ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x, y, w, h); return; }
  const c = im.width / 3;
  ctx.drawImage(im, c, c, c, c, x + c, y + c, w - 2 * c, h - 2 * c);
  ctx.drawImage(im, c, 0, c, c, x + c, y, w - 2 * c, c); ctx.drawImage(im, c, 2 * c, c, c, x + c, y + h - c, w - 2 * c, c);
  ctx.drawImage(im, 0, c, c, c, x, y + c, c, h - 2 * c); ctx.drawImage(im, 2 * c, c, c, c, x + w - c, y + c, c, h - 2 * c);
  ctx.drawImage(im, 0, 0, c, c, x, y, c, c); ctx.drawImage(im, 2 * c, 0, c, c, x + w - c, y, c, c);
  ctx.drawImage(im, 0, 2 * c, c, c, x, y + h - c, c, c); ctx.drawImage(im, 2 * c, 2 * c, c, c, x + w - c, y + h - c, c, c);
}

// ------------------------------------------------------------ sound effects (real Essentials SEs)
const SEPOOL = {};
function playSE(name, vol = 1) {
  if (SET.sfx <= 0 || !name) return;
  if (/Door/i.test(name)) G.lastDoorSE = G.frame;
  try {
    const f = name.replace(/ /g, '_');
    let a = SEPOOL[f]; if (!a) { a = SEPOOL[f] = new Audio('assets/se/' + f + '.ogg'); a.preload = 'auto'; }
    const b = a.cloneNode(); b.volume = Math.min(1, vol * SET.sfx); b.play().catch(() => { });
  } catch (e) { }
}
const SFXMAP = { cursor: 'GUI_sel_cursor', ok: 'GUI_sel_decision', back: 'GUI_sel_cancel', bump: 'frlg_bump', buzzer: 'GUI_sel_buzzer', open: 'GUI_menu_open', save: 'save', item: 'ItemGet', exp: 'Pkmn_exp_full', faint: 'Pkmn_faint', hit: 'Battle_damage_normal', hitsuper: 'Battle_damage_super', hitweak: 'Battle_damage_weak', recall: 'Battle_recall', throw: 'Battle_throw', ballopen: 'Open_Pokeball', jump: 'Battle_jump_to_ball', run: 'frlg_run' };
function sfx(kind) { playSE(SFXMAP[kind] || kind); }

// ------------------------------------------------------------ screen runner
// A "screen" is a generator that yields once per frame. It sets G.uiDraw to draw itself.
G.uiGen = null; G.uiDraw = null; G.uiMsg = null;
function startUI(gen) { G.uiGen = gen; }
function* withDraw(drawFn, body) {
  const prev = G.uiDraw; G.uiDraw = drawFn;
  try { return yield* body; } finally { G.uiDraw = prev; }
}
function updateUI() {
  if (!G.uiGen) return;
  const r = G.uiGen.next();
  if (r.done) { G.uiGen = null; G.uiDraw = null; G.uiMsg = null; G.lock = G.lock || {}; for (const k of ['ok', 'back', 'up', 'down', 'left', 'right', 'menu']) if (keys.held[k]) G.lock[k] = true; }
}
// key repeat for lists
const _rp = {};
function rep(k) {
  if (pressed(k)) { _rp[k] = 0; return true; }
  if (keys.held[k]) { _rp[k] = (_rp[k] || 0) + 1; if (_rp[k] >= 16 && (_rp[k] - 16) % 5 === 0) return true; } else _rp[k] = 0;
  return false;
}
const ok = () => pressed('ok'), back = () => pressed('back') || pressed('menu');
function* wait(n) { while (n-- > 0) yield; }
// fade helper (screen overlay)
G.fade = 0;
function* fadeTo(a, frames = 8) { const from = G.fade; for (let i = 1; i <= frames; i++) { G.fade = from + (a - from) * i / frames; yield; } G.fade = a; }

// bottom message box used by menus (typewriter + wait for key)
function* uiMessage(text, opts = {}) {
  const lines = wrap(text, 470);
  const pages = []; for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2));
  for (let pi = 0; pi < pages.length; pi++) {
    const m = G.uiMsg = { lines: pages[pi], shown: 0, total: pages[pi].join('').length, wait: opts.noWait && pi === pages.length - 1 ? false : true, done: false };
    while (m.shown < m.total) { m.shown += 2; if (pressed('ok')) m.shown = m.total; yield; }
    m.done = true;
    if (opts.noWait && pi === pages.length - 1) return;
    keys.pressed.ok = false; yield;
    while (!pressed('ok') && !pressed('back')) yield;
    sfx('ok');
  }
  G.uiMsg = null;
}
function drawUiMsg() {
  const m = G.uiMsg; if (!m) return;
  pic('battle/overlay_message', 0, SH - 96);
  let left = m.shown;
  m.lines.forEach((ln, i) => { const s = ln.slice(0, Math.max(0, left)); left -= ln.length; if (s) txt(s, 30, SH - 96 + 18 + i * 32, { base: '#404040', shadow: '#b8b8b8', size: 26 }); });
  if (m.done && m.wait && Math.floor(G.frame / 12) % 2 === 0) { ctx.fillStyle = '#f8f8f8'; ctx.beginPath(); ctx.moveTo(478, SH - 24); ctx.lineTo(492, SH - 24); ctx.lineTo(485, SH - 14); ctx.fill(); }
}
// small command window (Window_CommandPokemon-like). Returns index or -1. opts: x,y,w, anchor right/bottom
function* choiceWindow(labels, o = {}) {
  const rowH = 32, w = o.w || Math.max(...labels.map(l => txtW(l, 26))) + 64, h = labels.length * rowH + 32;
  const x = o.x !== undefined ? o.x : SW - w, y = o.y !== undefined ? o.y : (SH - 96 - h);
  let idx = o.idx || 0;
  G.uiPopup = { x, y, w, h, labels, idx };
  while (true) {
    yield;
    if (rep('up')) { idx = (idx + labels.length - 1) % labels.length; sfx('cursor'); }
    if (rep('down')) { idx = (idx + 1) % labels.length; sfx('cursor'); }
    G.uiPopup.idx = idx;
    if (ok()) { sfx('ok'); G.uiPopup = null; return idx; }
    if (back()) { sfx('back'); G.uiPopup = null; return -1; }
  }
}
function drawPopup() {
  const p = G.uiPopup; if (!p) return;
  skinBox('skin_choice_1', p.x, p.y, p.w, p.h);
  p.labels.forEach((l, i) => {
    txt(l, p.x + 40, p.y + 16 + i * 32 + 4, { size: 26 });
    if (i === p.idx) pic('selarrow', p.x + 22, p.y + 16 + i * 32);
  });
}
function* yesNo(x, y) { const r = yield* choiceWindow(['YES', 'NO'], { x: x ?? SW - 120, y: y ?? SH - 96 - 96 }); return r === 0; }
// HP bar helpers (Essentials colours: >50% green, >20% yellow, else red). bar rows of overlay_hp = 3 colours.
function hpColorRow(cur, max) { const f = cur / max; return f > 0.5 ? 0 : f > 0.2 ? 1 : 2; }
function drawHpFill(sheetName, rowH, x, y, w, cur, max, hBar) {
  const im = UI(sheetName); if (!im || !max) return;
  const fw = Math.max(cur > 0 ? 2 : 0, Math.round(w * Math.max(0, cur) / max)); const row = hpColorRow(cur, max);
  ctx.drawImage(im, 0, row * rowH, fw, hBar || rowH, x, y, fw, hBar || rowH);
}
function genderSym(g) { return g === 0 ? '♂' : g === 1 ? '♀' : ''; }
function genderCol(g) { return g === 0 ? ['#4888f8', '#b8c8e8'] : ['#f87898', '#f8d0d8']; }
function drawStatus(st, x, y) {
  const row = { SLP: 0, PSN: 1, BRN: 2, PAR: 3, FRZ: 4 }[st]; if (row === undefined) return;
  ctx.drawImage(UI('battle/icon_statuses'), 0, row * 16, 44, 16, x, y, 44, 16);
}
// Pokémon icon (2 frames, 64x64 each, sheet 128x64 — older ones are 80x60? handled)
function drawIcon(p, x, y, anim = true, scale = 1) {
  const sp = D.SP[p.sym]; if (!sp) return; const im = img('icons', 'icon' + String(sp.id).padStart(3, '0')) || img('icons', 'icon000'); if (!im) return;
  const fw = im.width >= 128 ? im.width / 2 : im.width, fh = im.height;
  const f = anim && im.width >= 128 ? Math.floor(G.frame / 10) % 2 : 0;
  ctx.drawImage(im, f * fw, 0, fw, fh, x + (64 - fw) / 2 * scale, y + (64 - fh) * scale, fw * scale, fh * scale);
}
function drawItemIcon(key, x, y) {
  const it = itemInfo(key), mv = it.move && D.MV[it.move]; const im = (mv && img('icons', 'itemMachine' + mv.type)) || img('icons', 'item' + String(it.id || 0).padStart(3, '0')) || img('icons', 'itemBack'); if (im) ctx.drawImage(im, x, y);
}
function drawTypeIcon(typeKey, x, y) { ctx.drawImage(UI('types'), 0, typeIndex(typeKey) * 28, 64, 28, x, y, 64, 28); }
