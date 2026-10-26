'use strict';
// ===================================================================
//  Pokédex – port of Essentials' PScreen_PokedexMain / PokedexEntry
//  (numerical list + info page; search, Area and Forms pages not included)
// ===================================================================
function dexOwned(sym) { return ownedSpecies(sym); }
function dexSeen(sym) { return !!(G.seen && G.seen[sym]) || ownedSpecies(sym); }
function dexMarkSeen(sym) { if (!sym) return; G.seen = G.seen || {}; G.seen[sym] = true; }
function dexCounts() { let s = 0, o = 0; for (const k in D.SP) { if (dexOwned(k)) { o++; s++; } else if (dexSeen(k)) s++; } return [s, o]; }
function dexList() {
  const all = Object.keys(D.SP).map(k => ({ sym: k, num: D.SP[k].id, name: D.SP[k].name })).sort((a, b) => a.num - b.num);
  let n = all.length; while (n > 0 && !dexSeen(all[n - 1].sym)) n--;     // trailing unseen species are hidden
  return all.slice(0, n);
}
const DEX_BASE = '#585850', DEX_SHADOW = '#a8b8b8', DEX_ROWS = 10;
function dexPic(n, x, y) { const im = img('pictures', 'pokedex/' + n); if (im) ctx.drawImage(im, x, y); return im; }
function dexSprite(sym, cx, cy, size) {
  const sp = D.SP[sym], key = String(sp.id).padStart(3, '0'), im = img('battlers', key); if (!im) return;
  drawFitted(im, cx - size / 2, cy - size / 2, size, size, key);
}
// squares of the region map where a species can be found (from the encounter tables + MapPosition/MapSize metadata)
function dexAreaPoints(sym) {
  const W = 30, pts = [];
  for (const id in (window.ENCOUNTERS || {})) {
    const e = ENCOUNTERS[id]; let found = false;
    for (const t in e) if (t !== 'dens' && e[t].some(x => x[0] === sym)) found = true;
    const mp = window.MAPPOS && MAPPOS[id];
    if (!found || !mp) continue;
    if (mp[2] && mp[2] > 0) {
      const sw = mp[2], bits = mp[3] || '', sh = Math.ceil(bits.length / sw);
      for (let i = 0; i < sw; i++) for (let j = 0; j < sh; j++) if (+bits[i + j * sw] > 0) pts[mp[0] + i + (mp[1] + j) * W] = true;
    } else pts[mp[0] + mp[1] * W] = true;
  }
  return pts;
}
function dexDrawArea(e, sp) {
  dexPic('bg_area', 0, 0);
  const W = 30, mi = img('pictures', 'mapRegion0'), mx = mi ? Math.floor((SW - mi.width) / 2) : 16, my = mi ? Math.floor((SH + 32 - mi.height) / 2) : 48;
  if (mi) ctx.drawImage(mi, mx, my);
  const pts = dexAreaPoints(e.sym), has = i => i >= 0 && !!pts[i];
  for (let j = 0; j < pts.length; j++) {
    if (!pts[j]) continue;
    const x = mx + (j % W) * 16, y = my + Math.floor(j / W) * 16;
    ctx.fillStyle = 'rgb(0,248,248)'; ctx.fillRect(x, y, 16, 16); ctx.fillStyle = 'rgb(192,248,248)';
    if (!has(j - W)) ctx.fillRect(x, y - 2, 16, 2);
    if (!has(j + W)) ctx.fillRect(x, y + 16, 16, 2);
    if (j % W === 0 || !has(j - 1)) ctx.fillRect(x - 2, y, 2, 16);
    if ((j + 1) % W === 0 || !has(j + 1)) ctx.fillRect(x + 16, y, 2, 16);
  }
  dexPic('overlay_area', 0, 0);
  if (!pts.some(Boolean)) { dexPic('overlay_areanone', 108, 188); txt('Area unknown', SW / 2, SH / 2 + 8, { align: 'center', base: DEX_BASE, shadow: DEX_SHADOW, size: 22 }); }
  txt('Kanto', 414, 52, { align: 'center', base: DEX_BASE, shadow: DEX_SHADOW, size: 22 });
  txt(sp.name + "'s area", SW / 2, 360, { align: 'center', base: DEX_BASE, shadow: DEX_SHADOW, size: 22 });
}
function dexDrawForms(e, sp) {
  dexPic('bg_forms', 0, 0);
  const f = img('battlers', String(sp.id).padStart(3, '0')), b = img('battlers', String(sp.id).padStart(3, '0') + 'b');
  if (f) drawFitted(f, 130 - 88, 158 - 88, 176, 176, String(sp.id));
  if (b) drawFitted(b, 382 - 88, 256 - 176, 176, 176, String(sp.id) + 'b');
  drawIcon({ sym: e.sym }, 50, 288, false);
  const fn = sp.gender === 'AlwaysFemale' ? 'Female' : sp.gender === 'AlwaysMale' ? 'Male' : sp.gender === 'Genderless' ? 'Genderless' : 'One Form';
  txt(sp.name, SW / 2, SH - 88, { align: 'center', base: DEX_BASE, shadow: DEX_SHADOW, size: 22 });
  txt(fn, SW / 2, SH - 56, { align: 'center', base: DEX_BASE, shadow: DEX_SHADOW, size: 22 });
}
function* pokedexEntry(list, index) {
  const S = { i: index, page: 1 };
  const cur = () => list[S.i];
  const draw = () => {
    const e = cur(), sp = D.SP[e.sym];
    if (S.page === 2) { dexDrawArea(e, sp); return; }
    if (S.page === 3) { dexDrawForms(e, sp); return; }
    dexPic('bg_info', 0, 0); ctx.save(); ctx.translate(0, 4);
    const owned = dexOwned(e.sym);
    dexSprite(e.sym, 104, 136, 176);
    txt(String(e.num).padStart(3, '0') + ' ' + sp.name, 246, 42, { base: '#f8f8f8', shadow: '#000', size: 22 });
    txt('Height', 314, 158, { base: DEX_BASE, shadow: DEX_SHADOW, size: 22 }); txt('Weight', 314, 190, { base: DEX_BASE, shadow: DEX_SHADOW, size: 22 });
    if (owned) {
      txt((sp.kind || '???') + ' Pokémon', 246, 74, { base: DEX_BASE, shadow: DEX_SHADOW, size: 22 });
      txt((sp.height || 0).toFixed(1) + ' m', 470, 158, { align: 'right', base: DEX_BASE, shadow: DEX_SHADOW, size: 22 });
      txt((sp.weight || 0).toFixed(1) + ' kg', 482, 190, { align: 'right', base: DEX_BASE, shadow: DEX_SHADOW, size: 22 });
      wrap(sp.dex || '', 432, 24).slice(0, 4).forEach((l, i) => txt(l, 40, 246 + i * 32, { base: DEX_BASE, shadow: DEX_SHADOW, size: 24 }));
      dexPic('icon_own', 212, 40);
      const ti = img('pictures', 'pokedex/icon_types');
      if (ti) { sp.types.forEach((t, k) => ctx.drawImage(ti, 0, typeIndex(t) * 32, 96, 32, 296 + 100 * k, 110, 96, 32)); }
    } else {
      txt('????? Pokémon', 246, 74, { base: DEX_BASE, shadow: DEX_SHADOW, size: 22 });
      txt('????.? m', 470, 158, { align: 'right', base: DEX_BASE, shadow: DEX_SHADOW, size: 22 }); txt('????.? kg', 482, 190, { align: 'right', base: DEX_BASE, shadow: DEX_SHADOW, size: 22 });
    }
    ctx.restore();
  };
  const step = d => { let j = S.i; for (let n = 0; n < list.length; n++) { j = (j + d + list.length) % list.length; if (dexSeen(list[j].sym)) { S.i = j; return true; } } return false; };
  return yield* withDraw(draw, (function* () {
    cry(cur().num);
    while (true) {
      yield;
      if (rep('left') && S.page > 1) { S.page--; sfx('cursor'); }
      if (rep('right') && S.page < 3) { S.page++; sfx('cursor'); }
      if (rep('up')) { const o = S.i; step(-1); if (S.i !== o) { sfx('cursor'); if (S.page === 1) cry(cur().num); } }
      if (rep('down')) { const o = S.i; step(1); if (S.i !== o) { sfx('cursor'); if (S.page === 1) cry(cur().num); } }
      if (back()) { sfx('back'); return S.i; }
      if (ok() && S.page === 1) { sfx('ok'); cry(cur().num); }
    }
  })());
}
function* pokedexScreen() {
  const list = dexList(); let idx = G.dexIndex || 0, top = 0; if (idx >= list.length) idx = 0;
  const [seen, owned] = dexCounts();
  const draw = () => {
    dexPic('bg_list', 0, 0); ctx.save(); ctx.translate(0, 4);
    const e = list[idx];
    txt('Pokédex', SW / 2, 2, { align: 'center', base: '#f8f8f8', shadow: '#000', size: 22 });
    if (e && dexSeen(e.sym)) { dexSprite(e.sym, 112, 196, 176); txt(e.name, 112, 52, { align: 'center', base: DEX_BASE, shadow: DEX_SHADOW, size: 22 }); }
    txt('Seen:', 42, 308, { base: DEX_BASE, shadow: DEX_SHADOW, size: 22 }); txt(String(seen), 182, 308, { align: 'right', base: DEX_BASE, shadow: DEX_SHADOW, size: 22 });
    txt('Owned:', 42, 340, { base: DEX_BASE, shadow: DEX_SHADOW, size: 22 }); txt(String(owned), 182, 340, { align: 'right', base: DEX_BASE, shadow: DEX_SHADOW, size: 22 });
    // list
    const cu = img('pictures', 'pokedex/cursor_list');
    for (let r = 0; r < DEX_ROWS; r++) {
      const i = top + r; if (i >= list.length) break; const y = 46 + r * 32, it = list[i];
      if (i === idx && cu) ctx.drawImage(cu, 222, y - 6);
      const sn = dexSeen(it.sym);
      if (sn) dexPic(dexOwned(it.sym) ? 'icon_own' : 'icon_seen', 232, y);
      txt(String(it.num).padStart(3, '0') + ' ' + (sn ? ' ' + it.name : ' ----------'), 274, y + 6, { base: DEX_BASE, shadow: DEX_SHADOW, size: 22 });
    }
    // slider
    const sl = img('pictures', 'pokedex/icon_slider');
    if (sl && list.length > DEX_ROWS) {
      if (top > 0) ctx.drawImage(sl, 0, 0, 40, 30, 468, 48, 40, 30);
      if (top + DEX_ROWS < list.length) ctx.drawImage(sl, 0, 30, 40, 30, 468, 346, 40, 30);
      const sh = 268, rowMax = list.length, pageRows = DEX_ROWS;
      let bh = Math.floor(sh * pageRows / rowMax); bh += Math.min(Math.floor((sh - bh) / 2), Math.floor(sh / 6)); bh = Math.max(Math.floor(bh), 40);
      const y = 78 + Math.floor((sh - bh) * top / (rowMax - pageRows));
      ctx.drawImage(sl, 40, 0, 40, 8, 468, y, 40, 8);
      for (let i = 0; i * 16 < bh - 24; i++) { const h = Math.min(bh - 24 - i * 16, 16); ctx.drawImage(sl, 40, 8, 40, h, 468, y + 8 + i * 16, 40, h); }
      ctx.drawImage(sl, 40, 24, 40, 16, 468, y + bh - 16, 40, 16);
    }
    ctx.restore();
  };
  const fix = () => { if (idx < top) top = idx; if (idx >= top + DEX_ROWS) top = idx - DEX_ROWS + 1; top = Math.max(0, Math.min(top, Math.max(0, list.length - DEX_ROWS))); };
  yield* withDraw(draw, (function* () {
    fix();
    while (true) {
      yield;
      const n = list.length; if (!n) { if (back() || ok()) { sfx('back'); break; } continue; }
      if (rep('up')) { idx = (idx + n - 1) % n; sfx('cursor'); fix(); }
      if (rep('down')) { idx = (idx + 1) % n; sfx('cursor'); fix(); }
      if (rep('left')) { idx = Math.max(0, idx - DEX_ROWS); sfx('cursor'); fix(); }
      if (rep('right')) { idx = Math.min(n - 1, idx + DEX_ROWS); sfx('cursor'); fix(); }
      if (back()) { sfx('back'); break; }
      if (ok() && dexSeen(list[idx].sym)) { sfx('ok'); idx = yield* pokedexEntry(list, idx); fix(); }
    }
  })());
  G.dexIndex = idx;
}
