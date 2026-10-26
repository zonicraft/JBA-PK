'use strict';
// ===================================================================
//  Move animations – port of Pokémon Essentials' PBAnimationPlayerX.
//  Data (data/anims.js) was exported from the project's PkmnAnimations.rxdata.
// ===================================================================
const ANIM_FU = { x: 128, y: 224 }, ANIM_FT = { x: 384, y: 96 };     // FOCUSUSER / FOCUSTARGET
const ANIM_TYPE_DEFAULT = {
  NORMAL: 'TACKLE', FIGHTING: 'COMETPUNCH', FLYING: 'GUST', POISON: 'SLUDGE', GROUND: 'MUDSLAP', ROCK: 'ROCKTHROW', BUG: 'TWINEEDLE',
  GHOST: 'NIGHTSHADE', STEEL: 'GYROBALL', FIRE: 'EMBER', WATER: 'WATERGUN', GRASS: 'RAZORLEAF', ELECTRIC: 'THUNDERSHOCK', PSYCHIC: 'CONFUSION',
  ICE: 'ICEBALL', DRAGON: 'DRAGONRAGE', DARK: 'PURSUIT', FAIRY: 'FAIRYWIND'
};
const _animSEPool = {};
function animSE(name, vol, pitch) {
  if (!name || SET.sfx <= 0) return;
  try {
    let a = _animSEPool[name];
    if (!a) { a = _animSEPool[name] = new Audio(encodeURI('assets/se/anim/' + name)); a.preload = 'auto'; a.onerror = () => { a._bad = true; }; }
    if (a._bad) return;
    const b = a.cloneNode(); b.volume = Math.min(1, (vol == null ? 80 : vol) / 100 * SET.sfx);
    b.preservesPitch = false; b.playbackRate = Math.max(0.25, Math.min(4, (pitch == null ? 100 : pitch) / 100));
    b.play().catch(() => { });
  } catch (e) { }
}
// centre of the battler sprite on screen
function animCenter(s) {
  const B = B_(), mon = s === 0 ? B.me : B.foe, sp = mon && D.SP[mon.sym] || {}, sc = sprOf(s).sc || 1;
  return s === 0 ? { x: ME_BASE.x, y: ME_BASE.y + 34 + (sp.playerY || 0) - 80 * sc } : { x: FOE_BASE.x, y: FOE_BASE.y + 8 + (sp.enemyY || 0) - 80 * sc };
}
// which animation plays for a move: {idx, opp} or null
function findAnim(md, us, isStatus) {
  const M = ANIMS.move;
  const pick = id => { const m = M[String(id)]; if (!m) return null; if (us === 1 && m[1] != null) return { idx: m[1], opp: true }; return m[0] != null ? { idx: m[0], opp: false } : null; };
  let r = md.id != null ? pick(md.id) : null;
  if (!r && !isStatus) {
    const dn = ANIM_TYPE_DEFAULT[md.type] || 'TACKLE', dm = D.MV[dn] || D.MV.TACKLE;
    r = pick(dm.id) || pick(D.MV.TACKLE.id);
  }
  return r;
}
function* commonAnim(name, side) {
  const idx = ANIMS.common[name]; if (idx == null) return;
  yield* playAnim(idx, side, side, false);
}
function* playAnim(idx, us, ts, opp) {
  const A = ANIMS.anims[idx]; const B = B_(); if (!A || !B) return;
  if (opp) { const t = us; us = ts; ts = t; }   // the opposing version is authored from the player's point of view
  const P = B.anim = {
    A, us, ts, uo: animCenter(us), to: animCenter(ts), list: [],
    bg: { im: null, white: false, ox: 0, oy: 0, op: 0, col: [0, 0, 0, 0] }, bgc: { op: 0, col: [0, 0, 0, 0] },
    fo: { im: null, white: false, ox: 0, oy: 0, op: 0, col: [0, 0, 0, 0] }, foc: { op: 0, col: [0, 0, 0, 0] },
    oldbg: [0, 0, 0, [0, 0, 0, 0]], oldfo: [0, 0, 0, [0, 0, 0, 0]], sheet: A.g ? IMGS['assets/animations/' + A.g] : null
  };
  P.cov = [false, false];   // which battlers the animation draws itself (the others stay visible)
  for (const fr of A.fr) for (const c of fr) if (c && c[6] === 1) { if (c[7] === -1) P.cov[us] = true; else if (c[7] === -2) P.cov[ts] = true; }
  const nz = v => v == null ? 0 : v;
  const setG = (layer, col, T) => {
    if (T.n) { layer.g.im = IMGS['assets/animations/' + T.n] || null; layer.g.white = !layer.g.im && /white/i.test(T.n); layer.g.ox = -nz(T.bx); layer.g.oy = -nz(T.by); layer.g.col = [nz(T.r), nz(T.g), nz(T.b), nz(T.a)]; layer.g.op = nz(T.o); layer.c.op = 0; layer.g.on = true; }
    else { layer.g.im = null; layer.g.white = false; layer.g.on = false; layer.g.op = 0; layer.c.col = [nz(T.r), nz(T.g), nz(T.b), nz(T.a)]; layer.c.op = nz(T.o); }
  };
  const L = { bg: { g: P.bg, c: P.bgc, old: P.oldbg }, fo: { g: P.fo, c: P.foc, old: P.oldfo } };
  const capture = l => { if (l.g.on) { l.old[0] = l.g.ox; l.old[1] = l.g.oy; l.old[2] = l.g.op; l.old[3] = l.g.col.slice(); } else { l.old[0] = 0; l.old[1] = 0; l.old[2] = l.c.op; l.old[3] = l.c.col.slice(); } };
  const interp = (l, T, f) => {
    const o = l.old, cc = k => T[k] != null ? o[3][['r', 'g', 'b', 'a'].indexOf(k)] + (T[k] - o[3][['r', 'g', 'b', 'a'].indexOf(k)]) * f : o[3][['r', 'g', 'b', 'a'].indexOf(k)];
    if (l.g.on) {
      if (T.bx != null) l.g.ox = o[0] - (T.bx - o[0]) * f; if (T.by != null) l.g.oy = o[1] - (T.by - o[1]) * f;
      if (T.o != null) l.g.op = o[2] + (T.o - o[2]) * f; l.g.col = [cc('r'), cc('g'), cc('b'), cc('a')];
    } else { if (T.o != null) l.c.op = o[2] + (T.o - o[2]) * f; l.c.col = [cc('r'), cc('g'), cc('b'), cc('a')]; }
  };
  const isRev = (s0, s1, d0, d1) => s0 === s1 ? false : s0 < s1 ? d0 > d1 : d0 < d1;
  for (let af = 0; af < A.fr.length; af++) {
    // ---- build this animation frame's cells
    const list = []; const fr = A.fr[af];
    for (let i = 0; i < fr.length; i++) {
      const c = fr[i]; if (!c || c[6] !== 1) continue;
      let x = c[0], y = c[1], mir = c[4] > 0; const pat = c[7], foc = c[26];
      if (foc === 1) { x += P.to.x - ANIM_FT.x; y += P.to.y - ANIM_FT.y; }
      else if (foc === 2) { x += P.uo.x - ANIM_FU.x; y += P.uo.y - ANIM_FU.y; }
      else if (foc === 3) {
        const dx = ANIM_FT.x - ANIM_FU.x, dy = ANIM_FT.y - ANIM_FU.y;
        const tx = dx === 0 ? 0 : (x - ANIM_FU.x) / dx, ty = dy === 0 ? 0 : (y - ANIM_FU.y) / dy;
        x = P.uo.x + tx * (P.to.x - P.uo.x); y = P.uo.y + ty * (P.to.y - P.uo.y);
        if (isRev(ANIM_FU.x, ANIM_FT.x, P.uo.x, P.to.x) && pat >= 0) mir = !mir;
      }
      const bz = s => s === 0 ? 22 : 16;
      let z;
      if (i < 2 && pat < 0) z = bz(pat === -1 ? us : ts);
      else switch (c[25]) { case 0: z = 5; break; case 1: z = 35; break; case 2: z = foc === 1 ? bz(ts) - 1 : foc === 2 ? bz(us) - 1 : 5; break; case 3: z = foc === 1 ? bz(ts) + 1 : foc === 2 ? bz(us) + 1 : 35; break; default: z = 35; }
      list.push({ c, x, y, mir, z, pat });
    }
    P.list = list;
    // ---- timings
    for (const T of A.tim) {
      if (T.f !== af) continue;
      if (T.t === 0) animSE(T.n, T.v, T.p);
      else if (T.t === 1) setG(L.bg, 0, T);
      else if (T.t === 2) capture(L.bg);
      else if (T.t === 3) setG(L.fo, 0, T);
      else if (T.t === 4) capture(L.fo);
    }
    for (const T of A.tim) {
      if ((T.t === 2 || T.t === 4) && T.d > 0 && af >= T.f && af <= T.f + T.d) interp(T.t === 2 ? L.bg : L.fo, T, (af - T.f) / T.d);
    }
    yield; yield;
  }
  B.anim = null;
}
// ---- drawing
let _animTmp = null;
function animTinted(im, sx, sy, sw, sh, col) {
  if (!_animTmp) _animTmp = document.createElement('canvas');
  if (_animTmp.width < sw || _animTmp.height < sh) { _animTmp.width = Math.max(_animTmp.width, sw); _animTmp.height = Math.max(_animTmp.height, sh); }
  const g = _animTmp.getContext('2d'); g.clearRect(0, 0, _animTmp.width, _animTmp.height);
  g.globalCompositeOperation = 'source-over'; g.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ',' + Math.max(0, Math.min(1, col[3] / 255)) + ')'; g.fillRect(0, 0, sw, sh);
  g.globalCompositeOperation = 'source-over';
  return _animTmp;
}
function animDrawLayer(g, c) {
  if (g.on && (g.im || g.white) && g.op > 0) {
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, g.op / 255));
    if (g.white) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, SW, SH); }
    else if (g.col[3] > 0) ctx.drawImage(animTinted(g.im, 0, 0, g.im.width, g.im.height, g.col), 0, 0, g.im.width, g.im.height, -g.ox, -g.oy, g.im.width, g.im.height);
    else ctx.drawImage(g.im, -g.ox, -g.oy);
    ctx.restore();
  } else if (!g.on && c.op > 0 && c.col[3] > 0) {
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, c.op / 255 * c.col[3] / 255)); ctx.fillStyle = 'rgb(' + (c.col[0] | 0) + ',' + (c.col[1] | 0) + ',' + (c.col[2] | 0) + ')'; ctx.fillRect(0, 0, SW, SH); ctx.restore();
  }
}
function drawAnim(B) {
  const P = B.anim; if (!P) return;
  animDrawLayer(P.bg, P.bgc);
  const items = P.list.map((it, n) => ({ it, n })).sort((a, b) => a.it.z - b.it.z || a.n - b.n);
  for (const { it } of items) {
    const c = it.c; let im, sx = 0, sy = 0, sw, sh, hue = 0;
    if (it.pat === -1 || it.pat === -2) {
      const s = it.pat === -1 ? P.us : P.ts, mon = s === 0 ? B.me : B.foe, sp = sprOf(s); if (!mon || !sp.vis) continue;
      const d = D.SP[mon.sym]; im = img('battlers', String(d.id).padStart(3, '0') + (s === 0 ? 'b' : '')); if (!im) continue;
      sw = sh = 160 * (sp.sc || 1); var srcw = im.width, srch = im.height;
    } else {
      im = P.sheet; if (!im) continue; sx = (it.pat % 5) * 192; sy = Math.floor(it.pat / 5) * 192; sw = srcw = sh = srch = 192; hue = P.A.hue || 0;
    }
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, c[8] / 255));
    if (c[5] === 1) ctx.globalCompositeOperation = 'lighter'; else if (c[5] === 2) ctx.globalCompositeOperation = 'multiply';
    if (hue && 'filter' in ctx) ctx.filter = 'hue-rotate(' + hue + 'deg)';
    ctx.translate(it.x, it.y); if (c[3]) ctx.rotate(-c[3] * Math.PI / 180);
    ctx.scale((it.mir ? -1 : 1) * c[2] / 100, (c[11] == null ? c[2] : c[11]) / 100);
    if (c[15] > 0) {
      const t = animTinted(im, sx, sy, it.pat < 0 ? im.width : 192, it.pat < 0 ? im.height : 192, [c[12], c[13], c[14], c[15]]);
      ctx.drawImage(t, 0, 0, it.pat < 0 ? im.width : 192, it.pat < 0 ? im.height : 192, -sw / 2, -sh / 2, sw, sh);
    } else if (it.pat < 0) ctx.drawImage(im, -sw / 2, -sh / 2, sw, sh);
    else ctx.drawImage(im, sx, sy, 192, 192, -96, -96, 192, 192);
    ctx.restore();
  }
  animDrawLayer(P.fo, P.foc);
}
