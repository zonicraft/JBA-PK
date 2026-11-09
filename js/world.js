'use strict';
// ===================================================================
//  World systems: map connections, wild encounters, Poké Mart,
//  Poké Center, berry plants, cut trees, emote balloons
// ===================================================================

// ---- map connections (PBS/connections.txt): [mapA, edgeA, offsetA, mapB, edgeB, offsetB]
const CONNS = [[317, 'S', 0, 313, 'N', 4],[2, 'N', 0, 5, 'S', 0], [7, 'S', 6, 5, 'N', 0],
  [5, 'E', 120, 311, 'W', 0], [32, 'S', 59, 5, 'N', 0], [32, 'E', 0, 7, 'W', 6], [43, 'S', 2, 7, 'N', 0], [43, 'N', 0, 87, 'S', 2], [2, 'S', 0, 310, 'N', 0], [311, 'W', 0, 2, 'E', 80],
  [87, 'E', 15, 79, 'W', 0], [79, 'N', 0, 95, 'S', 0], [79, 'E', 0, 110, 'W', 30], [95, 'E', 0, 110, 'W', 6], [100, 'W', 0, 110, 'E', 0],
  [109, 'S', 4, 100, 'N', 0], [100, 'N', 36, 111, 'S', 0], [109, 'E', 0, 111, 'W', 1], [111, 'S', 0, 110, 'N', 121],
  [114, 'N', 0, 100, 'S', 0], [114, 'W', 0, 110, 'E', 40], [120, 'S', 0, 122, 'N', 2], [129, 'W', 0, 122, 'E', 6],
  [169, 'W', 0, 171, 'E', 0], [194, 'E', 0, 171, 'W', 0],
  [195, 'S', 0, 198, 'N', 0], [199, 'N', 0, 198, 'S', 6], [202, 'W', 0, 201, 'E', 0],
  [311, 'N', 73, 201, 'S', 0], [202, 'S', 0, 311, 'N', 102],                                   // Fuchsia / Route 18 down to the sea route
  [310, 'S', 0, 264, 'N', 0], [256, 'W', 0, 264, 'E', 0], [311, 'S', 0, 264, 'N', 36],          // Route 21 / Route 20 / sea route to Cinnabar
  [256, 'N', 0, 310, 'S', 30], [311, 'W', 0, 310, 'E', 60], [311, 'S', 0, 256, 'N', 6],
  [146, 'W', 0, 100, 'E', 5], [147, 'W', 0, 146, 'E', 0], [164, 'E', 0, 147, 'W', 81], [147, 'S', 0, 151, 'N', 0], [350, 'E', 12, 349, 'W', 0], [229, 'W', 0, 122, 'E', 69], [233, 'N', 0, 100, 'S', 100], [229, 'W', 0, 100, 'E', 229], [134, 'W', 119, 227, 'E', 0], [151, 'W', 139, 227, 'E', 0], [228, 'W', 0, 227, 'E', 1], [229, 'E', 0, 227, 'W', 0], [147, 'W', 224, 227, 'E', 0], [230, 'W', 71, 255, 'E', 0], [134, 'W', 0, 233, 'E', 70], [151, 'W', 0, 233, 'E', 50], [228, 'W', 0, 233, 'E', 190], [146, 'S', 52, 233, 'N', 0], [147, 'W', 35, 233, 'E', 0], [164, 'N', 53, 233, 'S', 0], [151, 'S', 0, 134, 'N', 0], [228, 'N', 0, 134, 'S', 0], [338, 'E', 0, 134, 'W', 5], [129, 'E', 0, 134, 'W', 56], [146, 'E', 105, 134, 'W', 0], [164, 'E', 24, 134, 'W', 0], [338, 'E', 0, 151, 'W', 25], [129, 'E', 0, 151, 'W', 76], [146, 'E', 85, 151, 'W', 0], [164, 'E', 4, 151, 'W', 0], [338, 'E', 115, 228, 'W', 0], [129, 'E', 64, 228, 'W', 0], [146, 'E', 225, 228, 'W', 0], [164, 'E', 144, 228, 'W', 0], [129, 'N', 52, 338, 'S', 0], [147, 'W', 110, 338, 'E', 0], [164, 'S', 53, 338, 'N', 0], [230, 'E', 0, 129, 'W', 63], [230, 'E', 0, 146, 'W', 224], [230, 'E', 0, 229, 'W', 0], [230, 'W', 30, 202, 'E', 0], [362, 'S', 17, 361, 'N', 0],   // Cerulean - Route 9 - Route 10 (Route 8 / Lavender are not built yet)
  // Sevii Islands
  [290, 'N', 0, 292, 'S', 0], [297, 'W', 0, 308, 'E', 2], [299, 'N', 0, 308, 'S', 94], [299, 'N', 2, 297, 'S', 0], [37, 'N', 0, 38, 'S', 0], [47, 'W', 0, 45, 'E', 0], [31, 'E', 0, 45, 'W', 0], [37, 'S', 76, 45, 'N', 0], [37, 'S', 100, 47, 'N', 0], [37, 'S', 0, 31, 'N', 0], [57, 'N', 27, 49, 'S', 0], [64, 'S', 54, 49, 'N', 0], [54, 'W', 42, 49, 'E', 0], [64, 'N', 0, 66, 'S', 0], [54, 'W', 0, 66, 'E', 73], [54, 'W', 81, 57, 'E', 0], [54, 'W', 2, 64, 'E', 0], [78, 'E', 18, 88, 'W', 0], [328, 'N', 54, 88, 'S', 0], [78, 'W', 85, 336, 'E', 0], [328, 'N', 0, 336, 'S', 0], [337, 'W', 0, 78, 'E', 0], [328, 'N', 22, 78, 'S', 0], [70, 'S', 0, 78, 'N', 2], [70, 'S', 30, 337, 'N', 0], [70, 'N', 0, 75, 'S', 6], [277, 'E', 0, 276, 'W', 0], [279, 'E', 0, 276, 'W', 140], [274, 'E', 0, 276, 'W', 119], [274, 'N', 7, 277, 'S', 0], [274, 'S', 0, 279, 'N', 2],
  [202, 'S', 12, 255, 'N', 0], [256, 'E', 0, 255, 'W', 40], [311, 'E', 0, 255, 'W', 0]];                           // Fuchsia - Route 19 - Route 20
// ---- seamless overworld: connected maps (CONNS) are loaded around the active one, drawn and walkable across the edge.
// All characters share one coordinate space (the active map's); a neighbour sits at tile offset (ox, oy). When the player steps onto a neighbour
// it becomes the active map: everything is shifted by its offset, so nothing moves on screen and no fade or reload happens.
function connNeighbors(id) {
  const out = [], me = window.MAPS && window.MAPS[id]; if (!me) return out;
  for (const [a, ea, oa, b, eb, ob] of CONNS) {
    let other, edge, shift;
    if (a === id) { other = b; edge = ea; shift = ob - oa; } else if (b === id) { other = a; edge = eb; shift = oa - ob; } else continue;
    const om = window.MAPS[other]; if (!om || out.some(q => q.id === other)) continue;
    let ox, oy;
    if (edge === 'N') { ox = -shift; oy = -om.h; } else if (edge === 'S') { ox = -shift; oy = me.h; } else if (edge === 'W') { ox = -om.w; oy = -shift; } else { ox = me.w; oy = -shift; }
    const overlap = (edge === 'N' || edge === 'S') ? (ox < me.w && ox + om.w > 0) : (oy < me.h && oy + om.h > 0);
    if (!overlap) continue;       // the connection's offset puts it beside the map's corner, not along its edge: the old edge transfer handles it
    out.push({ id: other, ox, oy });
  }
  return out;
}
// which loaded map owns the world tile (x, y)? -> { m, x, y } with x, y local to that map, or null
function worldAt(x, y) {
  const m = G.map; if (!m) return null;
  if (x >= 0 && y >= 0 && x < m.w && y < m.h) return { m, x, y };
  for (const n of (G.nbrs || [])) { const lx = x - n.ox, ly = y - n.oy; if (lx >= 0 && ly >= 0 && lx < n.m.w && ly < n.m.h) return { m: n.m, x: lx, y: ly }; }
  return null;
}
function worldAddChars(n) {
  Object.values(n.m.events).sort((a, b) => a.id - b.id).forEach(d => {
    const e = new EventChr(d, n.id); e.setPos(d.x + n.ox, d.y + n.oy); e.mts = n.m.ts; G.chars.push(e);
    if (G.erasedEv && G.erasedEv[n.id + ':' + d.id]) e.erased = true;
  });
  G.refresh = true;
}
const IMG_WARMED = {};
function worldWarmImages() {   // decode the pictures of the maps ahead (neighbours and their neighbours) off the main thread, so the first look at them can't stall a step
  try {
    const ids = {}; for (const n of (G.nbrs || [])) { ids[n.id] = n.m; for (const c of connNeighbors(n.id)) if (c.id !== G.mapId && !ids[c.id]) ids[c.id] = loadMap(c.id); }
    const files = [];
    for (const id in ids) {
      const m = ids[id]; if (!m) continue;
      if (m.ts) { if (m.ts.tileset) files.push('tilesets/' + m.ts.tileset); for (const a of (m.ts.autotiles || [])) if (a) files.push('autotiles/' + a); }
      for (const e of Object.values(m.events || {})) for (const pg of (e.pages || [])) if (pg.gfx && pg.gfx.name) files.push('characters/' + pg.gfx.name);
    }
    for (const f of files) {
      if (IMG_WARMED[f]) continue; IMG_WARMED[f] = true;
      const im = (typeof IMGS !== 'undefined') && IMGS['assets/' + f + '.png'];
      if (im && im.decode) im.decode().catch(() => { });
    }
  } catch (e) { }
}
const WARMED = {};
function worldWarm() {
  worldWarmImages();   // fully fetch + buffer the music of every adjacent map, so the switch at the border never waits on a download
  try {
    for (const n of (G.nbrs || [])) {
      const name = n.m.bgm; if (!name || typeof audio !== 'function') continue;
      const a = audio(name);
      if (!WARMED[name]) {
        WARMED[name] = true;
        a.preload = 'auto'; try { a.load(); } catch (e) { }
      }
    }
  } catch (e) { }
}
function worldBuild() {                 // called by enterMap once the active map is in place
  G.nbrs = [];
  for (const c of connNeighbors(G.mapId)) { const m = loadMap(c.id); if (!m) continue; const n = { id: c.id, m, ox: c.ox, oy: c.oy }; G.nbrs.push(n); worldAddChars(n); }
  worldWarm();
}
function worldCheckSwap() {
  const p = G.player, m = G.map; if (!m || (p.x >= 0 && p.y >= 0 && p.x < m.w && p.y < m.h)) return;
  const n = (G.nbrs || []).find(q => p.x >= q.ox && p.y >= q.oy && p.x < q.ox + q.m.w && p.y < q.oy + q.m.h);
  if (n) worldSwap(n);
}
function worldSwap(n) {
  const prev = G.mapId, dx = n.ox, dy = n.oy;
  for (const c of G.chars) { c.x -= dx; c.y -= dy; c.rx -= dx * TS; c.ry -= dy * TS; }          // new origin: everything shifts, the picture does not move
  if (G.grassFx) for (const f of G.grassFx) { f.x -= dx; f.y -= dy; }
  const loaded = [{ id: prev, m: G.map, ox: -dx, oy: -dy }].concat(G.nbrs.filter(q => q !== n).map(q => ({ id: q.id, m: q.m, ox: q.ox - dx, oy: q.oy - dy })));
  G.map = n.m; G.mapId = n.id;
  const next = [], fresh = [];
  for (const c of connNeighbors(n.id)) {
    const have = loaded.find(q => q.id === c.id);
    if (have) next.push(have); else { const m = loadMap(c.id); if (!m) continue; const q = { id: c.id, m, ox: c.ox, oy: c.oy }; next.push(q); fresh.push(q); }
  }
  G.nbrs = next;
  G.chars = G.chars.filter(c => c.isPlayer || c.mapId === undefined || c.mapId === n.id || next.some(q => q.id === c.mapId));
  fresh.forEach(worldAddChars);
  G.events = {}; for (const c of G.chars) if (c.mapId === n.id && c.data) G.events[c.id] = c;
  if (typeof syncTilePatches === 'function') { G.map.patchKey = undefined; syncTilePatches(); }
  if (typeof CHEAT_CITIES !== 'undefined' && CHEAT_CITIES.some(c => c[1] === n.id)) G.switches['city' + n.id] = true;
  if (typeof seviiVisit === 'function') seviiVisit(n.id);
  if (typeof locationSign === 'function') locationSign(prev, n.id);
  G.player.transparent = (n.id === 1);
  if (n.m.bgm) { const want = n.id, bgm = n.m.bgm; setTimeout(() => { if (G.mapId === want) playBGM(bgm); }, 120); }   // start the music just after the swap so audio start-up can't hitch the step
  worldWarm();
  G.swapAt = G.frame;
  G.refresh = true;
}
// ---- map tile patches: a rectangle of tiles is blanked while its switch is on (the story changes the scenery)
const TILE_PATCHES = [
  { map: 171, sw: 215, rects: [[31, 21, 37, 26, 2, 0]] },   // Celadon: the arcade building is blown up
  { map: 185, sw: 208, rects: [[11, 0, 11, 1, 1, 0]] },     // arcade: the poster has been torn off the wall
];
function syncTilePatches() {
  const m = G.map, raw = window.MAPS && window.MAPS[G.mapId]; if (!m || !raw) return;
  const act = TILE_PATCHES.filter(p => p.map === G.mapId && getSwitch(p.sw)), key = act.map(p => p.sw).join(',');
  if (m.patchKey === key) return;
  m.patchKey = key;
  if (!act.length) { m.data = raw.data; return; }
  const d = raw.data.slice();
  for (const p of act) for (const [x1, y1, x2, y2, z, t] of p.rects) for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) d[x + y * m.w + z * m.w * m.h] = t;
  m.data = d;
}
function findConnection(mapId, dir, p) {
  const edge = { 8: 'N', 2: 'S', 4: 'W', 6: 'E' }[dir];
  let first = null;
  for (const [a, ea, oa, b, eb, ob] of CONNS) {
    let c = null;
    if (a === mapId && ea === edge) c = { to: b, toEdge: eb, shift: ob - oa };
    else if (b === mapId && eb === edge) c = { to: a, toEdge: ea, shift: oa - ob };
    if (!c) continue;
    if (!p) return c;
    const tm = window.MAPS[c.to]; if (!tm) { first = first || c; continue; }
    const v = (edge === 'N' || edge === 'S') ? p.x + c.shift : p.y + c.shift, lim = (edge === 'N' || edge === 'S') ? tm.w : tm.h;
    if (v >= 0 && v < lim) return c;       // several maps can share an edge: take the one that covers the player's position
  }
  return first;
}
function edgeConnection() {
  const p = G.player, cn = findConnection(G.mapId, p.dir, p); if (!cn) return;
  const tm = window.MAPS[cn.to];
  if (!tm) { G.main = new Interp([[101, 0, ['(That part of the game is not in this test build yet.)']], [0, 0, []]], null); return; }
  let x, y;
  if (cn.toEdge === 'S' || cn.toEdge === 'N') { x = p.x + cn.shift; y = cn.toEdge === 'S' ? tm.h - 1 : 0; }
  else { y = p.y + cn.shift; x = cn.toEdge === 'E' ? tm.w - 1 : 0; }
  if (x < 0 || y < 0 || x >= tm.w || y >= tm.h) return;
  G.main = new Interp([[201, 0, [0, cn.to, x, y, p.dir, 0]], [0, 0, []]], null);
}

// ---- wild encounters (PBS/encounters.txt, Land only, equal-ish slot weights)
const ENC = {
  // Route 7: Kanna is a rare (5%) wild encounter
  169: { chance: 0.1, land: [['BAKI', 24, 27, 19], ['TAKAO', 24, 27, 19], ['ELICHANHALLOWEEN', 24, 27, 19], ['ANASTASIA', 24, 27, 19], ['MIRAJANE', 24, 27, 19], ['KANNA', 24, 27, 5]] },
  5: { chance: 0.1, land: [['DAVINCI', 2, 3, 20], ['KUKA', 2, 3, 20], ['ARU', 2, 3, 20], ['CHINO', 2, 3, 20], ['YUITRINITY', 2, 3, 20]] },
};
// water you can fish in: terrain tags 5-7, or any water autotile (the sea / pond / fountain tiles of a tileset carry no tag in some places)
function isWaterAt(x, y) {
  const w = worldAt(x, y); if (!w) return false;
  if ([5, 6, 7].includes(terrainTagAt(x, y))) return true;
  const m = w.m, names = m.ts.autotiles || [], lx = w.x, ly = w.y;
  for (let z = 0; z < 3; z++) {
    const tid = m.data[lx + ly * m.w + z * m.w * m.h];
    if (tid >= 48 && tid < 384) { const nm = names[Math.floor(tid / 48) - 1] || ''; if (/sea|water|pond|lake|river|ocean|fountain/i.test(nm) && !/fall/i.test(nm)) return true; }
  }
  return false;
}
// a walkable bridge plank / platform drawn above water: stepping onto it from the boat means getting off the boat
function bridgeAt(x, y) {
  const ww = worldAt(x, y); if (!ww) return false;
  const m = ww.m, ts = m.ts;
  for (let z = 0; z < 3; z++) {
    const tid = m.data[ww.x + ww.y * m.w + z * m.w * m.h];
    if (tid >= 384 && ts.tags && ts.tags[tid] === 13) return true;   // tileset terrain tag 13 = bridge planks
  }
  for (let z = 2; z >= 0; z--) {                                      // otherwise: the top solid-or-not tile decides whether you could walk here on foot
    const tid = m.data[ww.x + ww.y * m.w + z * m.w * m.h]; if (!tid) continue;
    const pas = ts.passages[tid] || 0;
    if (pas & 0x10) continue;
    return z > 0 && tid >= 384 && (pas & 0x0f) !== 0x0f;
  }
  return false;
}
// a solid tile (rock, pillar...) drawn on top of the water: the boat can't sail through it
function solidOverWater(x, y) {
  const w = worldAt(x, y); if (!w) return false;
  const m = w.m, ts = m.ts, names = ts.autotiles || [];
  for (let z = 2; z >= 0; z--) {
    const tid = m.data[w.x + w.y * m.w + z * m.w * m.h]; if (!tid) continue;
    if (tid >= 48 && tid < 384) { const nm = names[Math.floor(tid / 48) - 1] || ''; if (/sea|water|pond|lake|river|ocean|fountain/i.test(nm) && !/fall/i.test(nm)) return false; }
    const pas = ts.passages[tid] || 0;
    if (pas & 0x10) continue;
    if ((pas & 0x0f) === 0x0f) return true;
    if ((ts.priorities[tid] || 0) === 0) return false;
  }
  return false;
}
// Seafoam water currents: only the boat can enter them, and once on one it carries the player along (see the update loop)
// the currents of B2F-B4F calm down once the boulders have been dropped into the holes above (those boulders set these switches)
const CURRENT_STOP = { 260: [102, 104], 262: [102, 104], 261: [107, 108], 263: [107, 108] };
function currentsRunning() { const s = CURRENT_STOP[G.mapId]; return !(s && s.every(sw => getSwitch(sw))); }
function currentInfo(x, y) {
  const w = worldAt(x, y); if (!w || w.m !== G.map || !currentsRunning()) return null;
  const m = w.m, names = m.ts.autotiles || []; let dir = 0, bridge = false;
  for (let z = 0; z < 3; z++) {
    const tid = m.data[w.x + w.y * m.w + z * m.w * m.h]; if (!tid) continue;
    if (tid >= 48 && tid < 384) { const mm = (names[Math.floor(tid / 48) - 1] || '').match(/current (north|south|east|west)/i); if (mm) dir = { north: 8, south: 2, east: 6, west: 4 }[mm[1].toLowerCase()]; }
    else if (tid >= 384 && z > 0 && (m.ts.priorities[tid] || 0) > 0) bridge = true;     // something walkable drawn above the water
  }
  return dir ? { dir, bridge } : null;
}
function currentDirAt(x, y) { const c = currentInfo(x, y); return c ? c.dir : 0; }
function currentBlocks(x, y) { const c = currentInfo(x, y); return !!c && !c.bridge; }
function terrainTagAt(x, y) {
  const w = worldAt(x, y); if (!w || !w.m.ts.tags) return 0;
  const m = w.m;
  for (let z = 2; z >= 0; z--) {
    const tid = m.data[w.x + w.y * m.w + z * m.w * m.h]; if (!tid) continue;
    const t = m.ts.tags[tid] || 0; if (t > 0) return t;
  }
  return 0;
}
// counters: terrain tag 1, or - the interior tilesets (3, 25) carry no terrain tags in this project - any fully blocked tile indoors
function isCounter(x, y) {
  if (G.mapId === 185 && y === 3 && x >= 4 && x <= 6) return true;   // the arcade's service counter (the employee stands behind it)
  if (G.mapId === 318 && ((x === 1 && y >= 6 && y <= 7) || (x >= 11 && x <= 13 && y === 11))) return true;   // Indigo Plateau lobby: the Mart clerks and the Nurse stand behind their counters
  if (terrainTagAt(x, y) === 1) return true;
  const w = worldAt(x, y); if (!w || ![3, 25].includes(w.m.tsId)) return false;
  const m = w.m;
  for (let z = 2; z >= 0; z--) { const tid = m.data[w.x + w.y * m.w + z * m.w * m.h]; if (!tid) continue; const pv = m.ts.passages[tid] || 0; if (pv & 0x10) continue; return (pv & 0x0f) === 0x0f; }
  return false;
}
const LAND_W = [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1];   // Essentials land slot weights
function wildTable(mapId) {
  if (ENC[mapId]) return ENC[mapId];
  const e = window.ENCOUNTERS && ENCOUNTERS[mapId]; if (!e) return null;
  const kind = e.Land && e.Land.length ? 'Land' : (e.Cave && e.Cave.length ? 'Cave' : null); if (!kind) return null;
  const dens = (e.dens && e.dens[kind === 'Land' ? 0 : 1]) || 25;
  return { chance: dens / 250, kind, land: e[kind].map((s, i) => [s[0], s[1], s[2], LAND_W[i] || 1]) };
}
const WATER_W = [60, 30, 5, 4, 1];
function checkWild(x, y) {
  let enc = wildTable(G.mapId);
  if (G.surfing) {                                              // sailing: the Water table, only over water
    const e = window.ENCOUNTERS && ENCOUNTERS[G.mapId];
    enc = e && e.Water && e.Water.length ? { chance: ((e.dens && e.dens[2]) || 10) / 250, kind: 'Water', land: e.Water.map((s, i) => [s[0], s[1], s[2], WATER_W[i] || 1]) } : null;
    if (!isWaterAt(x, y)) return;
  }
  if (!enc || !G.party.length || !G.started) return;
  if (!G.party.some(m => m.hp > 0)) return;
  if (enc.kind !== 'Cave' && enc.kind !== 'Water' && terrainTagAt(x, y) !== 2) return;
  if (G.wildMap !== G.mapId) { G.wildMap = G.mapId; G.wildSteps = 0; }
  if (++G.wildSteps < 4) return;
  if (Math.random() >= enc.chance) return;
  const tot = enc.land.reduce((a, e) => a + e[3], 0); let r = Math.random() * tot, pick = enc.land[0];
  for (const e of enc.land) { if ((r -= e[3]) < 0) { pick = e; break; } }
  const lvl = pick[1] + Math.floor(Math.random() * (pick[2] - pick[1] + 1));
  const lead = G.party.find(m => m.hp > 0);
  if (G.repel > 0 && lead && lvl < lead.lvl) return;   // Repel: weaker wild Pokémon than the lead Pokémon stay away
  G.wildSteps = 0;
  G.main = new Interp([[355, 0, ['pbWildBattle(:' + pick[0] + ',' + lvl + ')']], [0, 0, []]], null);
}

// ---- Repel (100 / 200 / 250 steps; blocks wild Pokémon whose level is below the first healthy party member's)
const REPEL_STEPS = { REPEL: 100, SUPERREPEL: 200, MAXREPEL: 250 };
function repelStep() {
  if (!(G.repel > 0) || !G.started || G.battle) return;
  if (--G.repel <= 0) { G.repel = 0; G.repelEnd = true; }
}

// ---- emote balloon
G.balloons = [];
function* exclaim(chr) {
  playSE('frlg_exclaim'); const b = { chr, t: 0 }; G.balloons.push(b);
  while (b.t < 28) { b.t++; yield; }
  G.balloons = G.balloons.filter(x => x !== b);
}
function drawBalloons() {
  if (!G.balloons.length) return;
  const [cx, cy] = camera();
  for (const b of G.balloons) {
    const c = b.chr; if (!c) continue;
    const hop = b.t < 6 ? (6 - b.t) * 1.5 : 0;
    const x = Math.round(c.rx + 16 - cx), y = Math.round(c.ry - 24 - cy - hop);
    ctx.fillStyle = '#383838'; roundRect(ctx, x - 11, y - 20, 22, 22, 5); ctx.fill();
    ctx.fillStyle = '#f8f8f8'; roundRect(ctx, x - 9, y - 18, 18, 18, 4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 4, y + 1); ctx.lineTo(x + 2, y + 1); ctx.lineTo(x - 1, y + 7); ctx.fill();
    ctx.fillStyle = '#e02020'; ctx.fillRect(x - 1.5, y - 15, 3, 9); ctx.fillRect(x - 1.5, y - 4, 3, 3);
  }
}

// ---- cut trees (this game's world setup unlocks the field moves from the start)
function* cutTreeCheck() {
  if (!(G.items.KATANA > 0)) { yield* showMessage('This tree looks like it can be cut down!\nBut you need something sharp.'); return false; }
  yield* showMessage('This tree looks like it can be cut down!');
  yield* showMessage('Would you like to cut it?', { noWait: true });
  const i = yield* showChoices(['Yes', 'No'], 2);
  if (i !== 0) return false;
  yield* showMessage('\\PN used the Manyullyn Katana!', { noWait: true }); playSE('Cut'); for (let k = 0; k < 40; k++) yield; G.msg = null;
  return true;
}

function* rockSmashCheck() {           // rocks are broken with the Pickaxe key item
  if (!(G.items && G.items.PICKAXE > 0)) { yield* showMessage("It's a rugged rock.\nYou would need a pickaxe to break it."); return false; }
  yield* showMessage('This rock appears to be breakable.');
  yield* showMessage('Would you like to use the Pickaxe?', { noWait: true });
  const i = yield* showChoices(['Yes', 'No'], 2);
  if (i !== 0) return false;
  playSE('Rock Smash'); for (let k = 0; k < 30; k++) yield;
  return true;
}

// ---- script commands
// ---- ledges (terrain tag 1): walking down into one hops over it
function ledgeJump(p, d) {
  d = d || 2;
  const dx = d === 4 ? -1 : d === 6 ? 1 : 0, dy = d === 2 ? 1 : 0, m = G.map;
  if (!m || !(dx || dy)) return false;
  const nx = p.x + dx, ny = p.y + dy, lx = nx + dx, ly = ny + dy;
  if (lx < 0 || ly < 0 || lx >= m.w || ly >= m.h) return false;
  if (terrainTagAt(nx, ny) !== 1 || ![1, 6].includes(m.tsId)) return false;   // outdoor + cave (Tanoby Key) tilesets
  if (dx && m.tsId !== 1) return false;                                              // cave ledges are down-only
  // sideways hops only over vertical ledge walls (the tile above or below is a ledge too)
  if (dx && terrainTagAt(nx, ny - 1) !== 1 && terrainTagAt(nx, ny + 1) !== 1) return false;
  // ...and each vertical wall only one way: you hop towards the side where the cliff face is drawn: tiles 1205/1206/1214 left to right, tiles 1202/1203/1210 right to left
  if (dx) {
    let ids = []; for (let z = 0; z < 3; z++) ids.push(m.data[nx + ny * m.w + z * m.w * m.h]);
    const R = [1205, 1206, 1214, 1285, 1286, 1294], Lf = [1202, 1203, 1210, 1282, 1283, 1290];   // second set: the grey Mt. Ember cliff variant
    if (dx > 0 ? !ids.some(t => R.includes(t)) : !ids.some(t => Lf.includes(t))) return false;
  }
  if (!p.passableTile(lx, ly, { 2: 8, 4: 6, 6: 4 }[d])) return false;
  for (const e of G.chars) if (e !== p && !e.erased && !e.through && e.x === lx && e.y === ly && (e.gname !== '' || e.tile > 0)) return false;
  p.dir = d; p.speed = 3; p.sheetOverride = null; playSE('Player_jump'); p.jump(dx * 2, dy * 2); return true;
}
// ---- tall grass rustle (Graphics/Animations/DustandGrass.png, cells 3-5)
G.grassFx = [];
function grassAnim(x, y) { if (terrainTagAt(x, y) === 2) G.grassFx.push({ x, y, t0: G.frame }); }
function grassItems(items, cx, cy) {
  const im = img('animations', 'DustandGrass'); if (!im || !G.grassFx.length) return;
  G.grassFx = G.grassFx.filter(f => G.frame - f.t0 < 15);
  for (const f of G.grassFx) {
    const c = [3, 4, 5][Math.min(2, Math.floor((G.frame - f.t0) / 5))];
    items.push({ z: f.y * TS + 32.2, f: () => ctx.drawImage(im, (c % 4) * 192, Math.floor(c / 4) * 192, 192, 192, f.x * TS + 16 - 96 - cx, f.y * TS + 24 - 96 - cy, 192, 192) });
  }
}

// ---- storage PC data: 40 boxes of 30 slots (Essentials' PokemonStorage)
function pcInit() {
  if (!G.pc) { G.pc = { cur: 0, boxes: [] }; for (let i = 0; i < 40; i++) G.pc.boxes.push({ name: 'Box ' + (i + 1), bg: i % 16, mons: new Array(30).fill(null) }); }
  if (G.box && G.box.length) { for (const m of G.box) pcAdd(m); G.box = []; }
  return G.pc;
}
function pcAdd(mon) {
  pcInit(); const n = G.pc.boxes.length;
  for (let k = 0; k < n; k++) { const b = G.pc.boxes[(G.pc.cur + k) % n]; const i = b.mons.findIndex(m => !m); if (i >= 0) { b.mons[i] = mon; return true; } }
  return false;
}
function pcAll() { const l = (G.box || []).slice(); if (G.pc) for (const b of G.pc.boxes) for (const m of b.mons) if (m) l.push(m); return l; }

// ---- the region map on the wall of the Poké Center / Mart building
function wallMapCheck(x, y) {
  if (![172, 205, 238, 266, 354, 355, 356, 357, 358, 359].includes(G.mapId) || y !== 10 || (x !== 7 && x !== 8) || G.main) return false;
  G.main = new Interp([[355, 0, ['pbWallTownMap']], [0, 0, []]], null); return true;
}
// ---- Sevii Islands: Island Pass + ferry network. Island 0 is Vermilion's port, 1-7 are One Island .. Seven Island.
const SEV_ISLANDS = ['Vermilion City', 'One Island', 'Two Island', 'Three Island', 'Four Island', 'Five Island', 'Six Island', 'Seven Island'];
// where the ferry drops you: [map, x, y, dir] (each island's harbor building; Cinnabar's port is the beach south of the Poké Center)
const SEV_LANDING = { 0: [122, 41, 25, 8], 1: [275, 8, 5, 2], 2: [291, 8, 5, 2], 3: [298, 8, 5, 2], 4: [20, 8, 5, 2], 5: [33, 8, 5, 2], 6: [50, 8, 5, 2], 7: [71, 8, 5, 2] };
const SEV_MAP_ISLAND = { 264: 0, 122: 0, 275: 1, 274: 1, 291: 2, 290: 2, 298: 3, 299: 3, 297: 3, 20: 4, 19: 4, 33: 5, 31: 5, 50: 6, 49: 6, 71: 7, 70: 7 };
function seviiVisit(id) { const n = SEV_MAP_ISLAND[id]; if (n > 0) G.switches['sev' + n] = true; }
// One Island is always open; the other islands unlock for good once the quest in the One Island lab is finished
function seviiAllowed(n) { return n === 1 || !!G.switches[978]; }   // only One Island until Uchikido's research quest is done (switch 978), then every island
function* seviiFerryUI(cur) {
  G.ferryReq = null;
  const draw = () => { drawUiMsg(); drawPopup(); };
  return yield* withDraw(draw, (function* () {
    const dests = [];
    for (let n = 0; n <= 7; n++) if (n !== cur && (n === 0 || seviiAllowed(n))) dests.push(n);
    yield* uiMessage('Welcome aboard the Seagallop Ferry! Where would you like to sail?', { noWait: true });
    const labels = dests.map(n => SEV_ISLANDS[n]).concat(['CANCEL']);
    const c = yield* choiceWindow(labels, { x: 8, y: 8, w: 330, idx: 0, max: 8 });
    G.uiMsg = null;
    if (c >= 0 && c < dests.length) G.ferryReq = { to: dests[c] };
  })());
}
function* worldScript(it, s) {
  let m;
  if (s === 'pbSeviiFerry') {
    const cur = SEV_MAP_ISLAND[G.mapId] || 0;
    if (!(G.items && G.items.SEVIIPASS > 0)) { yield* showMessage('Welcome to the Seagallop Ferry Service!\nOur ferries only carry passengers who hold an \\c[1]Island Pass\\c[0].'); return true; }
    G.uiGen = seviiFerryUI(cur); yield;
    const r = G.ferryReq; G.ferryReq = null; if (!r) return true;
    const [mid, x, y, d] = SEV_LANDING[r.to];
    tone([-255, -255, -255, 0], 20); while (G.tone.left > 0) yield;
    for (let k = 0; k < 90; k++) yield;                         // the crossing
    yield* it.transfer([0, mid, x, y, d, 1]);
    if (r.to > 0) G.switches['sev' + r.to] = true;
    tone([0, 0, 0, 0], 20); while (G.tone.left > 0) yield;
    yield* showMessage('We have arrived at ' + SEV_ISLANDS[r.to] + '!\nThank you for sailing with us.');
    return true;
  }
  if (s === 'pbDayCareMan' || s === 'pbDayCareHeal') {          // the old folk turn to face the player, then back to where they were
    const ev = it && it.ev, d0 = ev && ev.dir; if (ev) faceEvent(ev, G.player);
    try { return yield* worldScriptDayCare(s); } finally { if (ev) ev.dir = d0; }
  }
  if (s === 'pbWallTownMap') { playSE('GUI_sel_decision'); yield* showMessage('It\'s a map of the region.'); G.uiGen = townMapScreen({ view: true }); yield; return true; }
  if (s.startsWith('Kernel.pbExclaim')) {
    const mm = s.match(/events\[(\d+)\]/), te = mm ? G.events[+mm[1]] : null;
    if (te && te !== G.player) faceEvent(G.player, te);   // the player turns towards the trainer who spotted them
    yield* exclaim(te || G.player); return true;
  }
  if ((m = s.match(/^pbSpin\((\d),(\d+)\)$/))) {          // Rocket hideout spinner arrows: slide the player along, then chain into the next arrow they land on
    const pl = G.player; let d = +m[1], n = +m[2], guard = 0;
    while (guard++ < 60) {
      let moved = 0;
      for (let k = 0; k < n; k++) { if (!pl.moveDir(d, false)) break; moved++; while (pl.moving) yield; }
      pl.dir = d;
      let nx = null;
      for (const e of G.chars) {
        if (e === pl || e === (it && it.ev) || e.erased || !e.page || e.x !== pl.x || e.y !== pl.y) continue;
        const c = e.page.list.find(c => c[0] === 355 && /^pbSpin\(/.test(String(c[2][0])));
        const mm = c && String(c[2][0]).match(/^pbSpin\((\d),(\d+)\)$/); if (mm) { nx = mm; break; }
      }
      if (!nx || !moved) break;
      d = +nx[1]; n = +nx[2];
    }
    return true;
  }
  if (s.startsWith('pbSEPlay(')) return true;
  if (s.startsWith('pbWait(')) { let n = +s.match(/\d+/)[0]; while (n-- > 0) yield; return true; }
  if (s === 'Kernel.pbSetPokemonCenter') { const p = G.player; G.healPoint = { map: G.mapId, x: p.x, y: p.y, dir: p.dir }; return true; }
  if (s.includes('for i in 1..')) {            // Poké Center ball-by-ball healing animation
    const n = Math.max(1, G.party.length);
    for (let i = 1; i <= n; i++) { setVar(6, i); playSE('ballshake'); for (let k = 0; k < 16; k++) yield; }
    return true;
  }
  if (s === 'pbAutoSave') { try { writeSave(); } catch (x) { } return true; }
  if (s === 'pbHallOfFame') { G.uiGen = hallOfFameScene(); yield; return true; }
  if (s === 'pbPokeCenterPC') {
    playSE('PC_open'); yield* showMessage('\\PN booted up the PC.');
    while (true) {
      yield* showMessage('Which PC should be accessed?', { noWait: true });
      const i = yield* showChoices(["Geso's PC", G.name + "'s PC", 'Hall of Fame', 'Log off'], 4);
      if (i === 0) { G.uiGen = pcSession(); yield; }
      else if (i === 2) { G.uiGen = hallOfFameViewer(); yield; }
      else if (i === 1) {
        let c = 0;
        while (true) {
          yield* showMessage('What do you want to do?', { noWait: true });
          c = yield* showChoices(['Item Storage', 'Mailbox', 'Turn Off'], 3);
          if (c === 0) { G.uiGen = pcItemStorage(); yield; }
          else if (c === 1) yield* showMessage("There's no Mail here.");
          else break;
        }
      } else break;
    }
    playSE('PC_close'); return true;
  }
  if (s === 'pbPushThisBoulder') {          // Seafoam boulders: shoved one tile in the direction the player is facing (no Strength in this build)
    const e = it.ev, pl = G.player; if (!e || e.moving) return true;
    if (!(G.items && G.items.DOLLY > 0)) { yield* showMessage('A heavy boulder.\nYou would need a dolly to move it.'); return true; }
    const d = pl.dir, [dx, dy] = dirVec[d]; if (e.x !== pl.x + dx || e.y !== pl.y + dy) return true;
    const nx = e.x + dx, ny = e.y + dy;
    const free = e.passableTile(e.x, e.y, d) && e.passableTile(nx, ny, opp[d]) && !(G.chars.some(c => c !== e && !c.erased && c.x === nx && c.y === ny && (c.isPlayer || c.gname !== '' || c.tile > 0)));
    if (!free) return true;
    sfx('bump'); e.speed = 3; e.x = nx; e.y = ny; e.moving = true; while (e.moving) yield;
    return true;
  }
  if (s === 'Kernel.pbRockSmashRandomEncounter') return true;
  if (s === 'pbEraseThisEvent') {
    if (it.ev) { it.ev.erased = true; G.erasedEv = G.erasedEv || {}; G.erasedEv[(it.ev.mapId !== undefined ? it.ev.mapId : (it.evMap || G.mapId)) + ':' + it.ev.id] = true; }
    return true;
  }
  if ((m = s.match(/^pbPickBerry\(:(\w+),(\d+)\)/))) {
    const n = +m[2], nm = n > 1 ? itemInfo(m[1]).plural : itemName(m[1]);
    yield* showMessage('There are ' + n + ' \\c[1]' + nm + '\\c[0]!\nWant to pick them?', { noWait: true });
    const i = yield* showChoices(['Yes', 'No'], 2);
    if (i === 0) {
      G.items[m[1]] = (G.items[m[1]] || 0) + n; playME('frlg_berry');
      yield* showMessage('You picked the ' + n + ' \\c[1]' + nm + '\\c[0].');
      if (it.ev) { G.selfsw[selfKey(evMapId(it.ev), it.ev.id, 'A')] = true; G.refresh = true; }
    }
    return true;
  }
  if (s === 'pbTrainerApproach') {          // the trainer walks up to the player, then faces them
    const e = it.ev, pl = G.player; let n = 0;
    while (e && n++ < 14 && Math.abs(e.x - pl.x) + Math.abs(e.y - pl.y) > 1) { if (!e.moveDir(e.dir, true)) break; while (e.moving) yield; }
    if (e) { e.turn(e.towardPlayer()); faceEvent(pl, e); }
    for (let i = 0; i < 8; i++) yield; return true;
  }
  if (s === 'pbBerryPlant') { yield* berryPlantScript(it); return true; }
  if (s === 'pbSurfAsk') {                   // action button on water once the boat has been lent
    const rod = G.items && G.items.OLDROD, opts = rod ? ['Navigate', 'Fish', 'Cancel'] : ['Navigate', 'Cancel'];
    yield* showMessage(rod ? 'The water is calm.\nNavigate or fish?' : 'The water is calm.\nDo you want to navigate?', { noWait: true });
    const c = opts[yield* showChoices(opts, opts.length)];
    if (c === 'Fish') return yield* worldScript(it, 'pbFish("OldRod")');
    if (c === 'Navigate') return yield* worldScript(it, 'pbSurfStart');
    return true;
  }
  if (s === 'pbSurfStart') {                 // board the boat and sail one tile out
    const pl = G.player, [fx, fy] = dirVec[pl.dir];
    if (G.surfing) { yield* showMessage('You are already on the boat.'); return true; }
    if (!isWaterAt(pl.x + fx, pl.y + fy)) { yield* showMessage("There's no water to sail on here."); return true; }
    G.biking = false; G.surfing = true; pl.speed = 4; pl.sheetOverride = 'base_surf';
    if (pl.moveDir(pl.dir, false)) { while (pl.moving) yield; }
    return true;
  }
  if (s === 'pbFishAsk') {                   // action button on water with a rod in the bag
    yield* showMessage('The water is calm.\nWant to fish here?', { noWait: true });
    const i = yield* showChoices(['Yes', 'No'], 2);
    if (i === 0) return yield* worldScript(it, 'pbFish("OldRod")');
    return true;
  }
  if ((m = s.match(/^pbFish\("(\w+)"\)/))) {          // field use of a fishing rod: needs water in front of the player
    const pl = G.player, [fx, fy] = dirVec[pl.dir]; const wx = pl.x + fx, wy = pl.y + fy;
    if (!isWaterAt(wx, wy)) { yield* showMessage("There's no water to fish in here."); return true; }
    if (G.surfing) { yield* showMessage("You can't fish from the boat."); return true; }
    const e = window.ENCOUNTERS && ENCOUNTERS[G.mapId], tbl = e && ((e[m[1]] && e[m[1]].length ? e[m[1]] : null) || (e.Water && e.Water.length ? e.Water : null));
    const pose = n => { pl.sheetOverride = 'boy_fish_offset'; pl.basePattern = n; pl.pattern = n; };
    if (G.biking) { G.biking = false; pl.sheetOverride = null; pl.speed = 3; }          // fishing is done on foot
    pl.fishing = true; pl.turn(pl.dir);
    for (let n = 3; n >= 0; n--) { pose(n); for (let i = 0; i < 5; i++) yield; }           // cast: rod raised (3) -> swung out over the water (0)
    const reel = function* () { for (let n = 0; n <= 3; n++) { pose(n); for (let i = 0; i < 5; i++) yield; } pl.fishing = false; pl.sheetOverride = null; pl.basePattern = 0; pl.pattern = 0; };
    yield* showMessage('\\PN cast the line...'); for (let i = 0; i < 50; i++) yield;
    if (!tbl || Math.random() < 0.2) { yield* reel(); yield* showMessage('Not even a nibble...'); return true; }
    yield* exclaim(pl); for (let k = 0; k < 4; k++) { pose(k % 2 ? 0 : 1); for (let i = 0; i < 4; i++) yield; }   // the rod tugs on the bite
    yield* showMessage('Oh! A bite!'); yield* reel();
    const pk = tbl[Math.floor(Math.random() * tbl.length)], lv = pk[1] + Math.floor(Math.random() * (pk[2] - pk[1] + 1));
    yield* runWildBattle(pk[0], lv);
    if (G.battleResult === 'lose') yield* blackout(); else if (G.map && G.map.bgm) playBGM(G.map.bgm);
    return true;
  }
  if ((m = s.match(/^pbWildBattle\(:(\w+),(\d+)\)/))) {
    it.evMap = G.mapId;   // a whiteout moves the player to another map, so remember where this event lives
    yield* runWildBattle(m[1], +m[2]);
    if (G.battleResult === 'lose') yield* blackout();
    else if (G.map && G.map.bgm) playBGM(G.map.bgm);
    return true;
  }
  if (s === 'pbRepelEnd') {
    yield* showMessage("Repel's effect wore off...");
    const k = G.repelItem; const nm = k && itemInfo(k).name;
    if (k && (G.items[k] || 0) > 0) {
      yield* showMessage('Do you want to use another ' + nm + '?', { noWait: true });
      const i = yield* showChoices(['Yes', 'No'], 2);
      if (i === 0) { consume(k); G.repel = REPEL_STEPS[k]; G.repelItem = k; playSE('GUI_sel_decision'); yield* showMessage('\\PN used the ' + nm + '!'); }
    }
    return true;
  }
  if (s.startsWith('pbPokemonMart(')) {
    const list = [...s.matchAll(/:(\w+)/g)].map(x => x[1]);
    G.uiGen = martScreen(list); yield; return true;
  }
  return false;
}

function faceEvent(a, b) { const dx = b.x - a.x, dy = b.y - a.y; a.turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 6 : 4) : (dy > 0 ? 2 : 8)); }

// whiteout: back to the last Poké Center used, or to the bed at home (spawn after the intro) if none was used yet
function* blackout() {
  G.party.forEach(healMon);
  const pc = G.healPoint && window.MAPS[G.healPoint.map] ? G.healPoint : null, h = pc || { map: 3, x: 22, y: 5, dir: 2 };
  yield* showMessage(pc ? '\\PN scurried to a Poké Center, protecting the exhausted Pokémon from further harm...' : '\\PN scurried back home, protecting the exhausted Pokémon from further harm...');
  tone([-255, -255, -255, 0], 8); for (let k = 0; k < 10; k++) yield;
  enterMap(h.map, h.x, h.y, h.dir); yield; tone([0, 0, 0, 0], 8);
}

// ---- Poké Mart (Essentials-style buy / sell)
function martPrice(k) { const p = itemInfo(k).price || 0; return G.items.TIAGOVIPCARD > 0 ? Math.floor(p * 0.7) : p; }
function drawMart(S) {
  pic('bag/bg_1', 0, 0);
  skinBox('skin_choice_1', 8, 8, 172, 56);
  txt('MONEY', 24, 18, { size: 20 }); txt('$' + G.money, 164, 36, { align: 'right', size: 24 });
  txt(S.mode === 'buy' ? 'BUY' : 'SELL', 94, 190, { col: COL.light, shadow: '#585858', align: 'center', size: 24 });
  const pk = S.list, rows = 8;
  if (S.scroll > 0) { const ua = UI('uparrow'); if (ua) ctx.drawImage(ua, (Math.floor(G.frame / 4) % 8) * 28, 0, 28, 40, 440, 0, 28, 40); }
  for (let r = 0; r < rows; r++) {
    const i = S.scroll + r, y = 12 + r * 32;
    if (i > pk.length) break;
    if (i === S.idx) { const cu = UI('bag/cursor'); if (cu) ctx.drawImage(cu, 0, 0, 282, 68, 194, y - 18, 262, 68); }
    if (i === pk.length) { txt('CANCEL', 212, y + 6, { size: 24 }); continue; }
    const k = pk[i];
    txt(itemLabel(k), 212, y + 6, { size: 22 });
    txt('$' + (S.mode === 'buy' ? martPrice(k) : Math.floor((itemInfo(k).price || 0) / 2)), 440, y + 6, { align: 'right', size: 22 });
  }
  if (S.scroll + rows < pk.length + 1) { const da = UI('downarrow'); if (da) ctx.drawImage(da, (Math.floor(G.frame / 4) % 8) * 28, 0, 28, 40, 440, 258, 28, 40); }
  const cur = S.idx < pk.length ? pk[S.idx] : null;
  if (cur) {
    drawItemIcon(cur, 24, SH - 72);
    wrap(itemInfo(cur).desc, 400, 22).slice(0, 3).forEach((l, i) => txt(l, 84, 288 + i * 26, { col: COL.light, size: 22 }));
    if (S.mode === 'sell') txt('In bag: ×' + (G.items[cur] || 0), 24, 72, { size: 20 });
  } else txt('Quit shopping.', 84, 290, { col: COL.light, size: 22 });
  if (S.qty) {
    skinBox('skin_choice_1', 236, 134, 244, 56);
    txt('×' + S.qty.n, 258, 148, { size: 26 }); txt('$' + S.qty.total, 462, 148, { align: 'right', size: 26 });
  }
}
function* martScreen(items) {
  const S = { mode: 'buy', list: items, idx: 0, scroll: 0, qty: null };
  const draw = () => { if (S.shown) drawMart(S); drawPopup(); drawUiMsg(); };
  return yield* withDraw(draw, (function* () {
    const pickQty = function* (max, unit) {
      let n = 1; S.qty = { n, total: n * unit };
      while (true) {
        yield;
        if (rep('up')) n = n >= max ? 1 : n + 1; if (rep('down')) n = n <= 1 ? max : n - 1;
        if (rep('right')) n = Math.min(max, n + 10); if (rep('left')) n = Math.max(1, n - 10);
        S.qty = { n, total: n * unit };
        if (ok()) { sfx('ok'); S.qty = null; return n; }
        if (back()) { sfx('back'); S.qty = null; return 0; }
      }
    };
    const browse = function* () {
      S.shown = true; S.idx = 0; S.scroll = 0;
      while (true) {
        yield;
        const n = S.list.length;
        if (rep('up')) { S.idx = (S.idx + n) % (n + 1); sfx('cursor'); }
        if (rep('down')) { S.idx = (S.idx + 1) % (n + 1); sfx('cursor'); }
        if (S.idx < S.scroll) S.scroll = S.idx; if (S.idx > S.scroll + 7) S.scroll = S.idx - 7;
        if (back()) { sfx('back'); break; }
        if (!ok()) continue;
        if (S.idx === n) { sfx('back'); break; }
        const k = S.list[S.idx]; sfx('ok');
        if (S.mode === 'buy') {
          const price = martPrice(k);
          if (price > G.money) { yield* uiMessage("You don't have enough money."); continue; }
          const have = G.items[k] || 0; const max = Math.max(1, Math.min(99 - have, Math.floor(G.money / price)));
          if (have >= 99) { yield* uiMessage("You can't carry any more."); continue; }
          const q = yield* pickQty(max, price); if (!q) continue;
          yield* uiMessage(itemName(k) + ', and you want ' + q + '. That will be $' + (q * price) + '. OK?', { noWait: true });
          const yes = yield* yesNo(); G.uiMsg = null;
          if (!yes) continue;
          G.money -= q * price; G.items[k] = have + q; playSE('ItemGet');
          yield* uiMessage('Here you are! Thank you!');
        } else {
          const unit = Math.floor((itemInfo(k).price || 0) / 2), have = G.items[k] || 0;
          const q = yield* pickQty(have, unit); if (!q) continue;
          yield* uiMessage('I can pay $' + (q * unit) + '. Would that be OK?', { noWait: true });
          const yes = yield* yesNo(); G.uiMsg = null;
          if (!yes) continue;
          G.items[k] = have - q; if (G.items[k] <= 0) { delete G.items[k]; S.list = S.list.filter(x => x !== k); S.idx = Math.min(S.idx, S.list.length); }
          G.money += q * unit; playSE('ItemGet');
          yield* uiMessage('Turned over the ' + itemName(k) + ' and received $' + (q * unit) + '.');
        }
      }
      S.shown = false;
    };
    sfx('open');
    while (true) {
      yield* uiMessage('Welcome! How may I help you?', { noWait: true });
      const c = yield* choiceWindow(['BUY', 'SELL', 'QUIT'], { x: 6, y: 6 });
      G.uiMsg = null;
      if (c < 0 || c === 2) break;
      if (c === 0) { S.mode = 'buy'; S.list = items; yield* browse(); }
      else {
        S.mode = 'sell'; S.list = Object.keys(G.items).filter(k => G.items[k] > 0 && itemInfo(k).pocket !== 8 && (itemInfo(k).price || 0) > 0);
        if (!S.list.length) { yield* uiMessage("You don't have anything I can buy."); continue; }
        yield* browse();
      }
    }
    yield* uiMessage('Please come again!', { noWait: true }); for (let i = 0; i < 24; i++) yield; G.uiMsg = null;
  })());
}

// ---- location signpost (Essentials' LocationWindow): slides in from the top when entering an area
G.loc = null;
function locationSign(prev, id) {
  G.loc = null;
  if (!prev || prev === id || !window.MAPNAME || !window.SHOWAREA || !SHOWAREA.includes(id)) return;
  const name = MAPNAME[id]; if (!name || MAPNAME[prev] === name) return;
  G.loc = { name, y: null, frames: 0 };
}
function drawLocation() {
  const L = G.loc; if (!L) return;
  const w = Math.min(SW, txtW(L.name, 26) + 56), h = 56;
  if (L.y === null) L.y = -h;
  if (L.frames > 80) { L.y -= 4; if (L.y + h < 0) { G.loc = null; return; } }
  else { if (L.y < 0) L.y = Math.min(0, L.y + 4); L.frames++; }
  skinBox('skin_choice_1', 0, L.y, w, h);
  txt(L.name, 28, L.y + 14, { size: 26 });
}

// ---- Day Care: the Day Care Man trains one deposited Pokémon with play time, the Day Care Lady heals the party
const DC_FRAMES_PER_EXP = 8;                                   // 1 exp every 8 frames of play time (7.5 exp / second)
function dcGain() { const d = G.daycare; return d ? Math.floor((G.playFrames - d.t0) / DC_FRAMES_PER_EXP) : 0; }
function dcLevelsAfter(d) {                                     // dry run: how many levels would the deposited mon gain?
  const c = JSON.parse(JSON.stringify(d.mon)); const n = c.lvl; gainExp(c, dcGain()); return c.lvl - n;
}
function* worldScriptDayCare(s) {
  if (s === 'pbDayCareHeal') {
    yield* showMessage('Oh my, your Pokémon look tired. Let granny take a look at them, dear.');
    const n = Math.max(1, G.party.length);
    for (let i = 1; i <= n; i++) { playSE('ballshake'); for (let k = 0; k < 16; k++) yield; }
    G.party.forEach(healMon); playME('Pkmn healing');
    yield* showMessage('There, all better! Your Pokémon are in perfect health.'); return true;
  }
  if (s !== 'pbDayCareMan') return false;
  const d = G.daycare;
  if (!d) {
    yield* showMessage("I'm the Day Care Man. I can raise a Pokémon for you while you're out adventuring.");
    yield* showMessage('Would you like me to raise one of your Pokémon?', { noWait: true });
    if ((yield* showChoices(['Yes', 'No'], 2)) !== 0) { yield* showMessage('Fine, fine. Come back if you change your mind.'); return true; }
    if (G.party.length < 2) { yield* showMessage("Hmm... you only have one Pokémon with you. If I take it, you'll have nobody to travel with!"); return true; }
    yield* showMessage('Which Pokémon should I raise?');
    G.temp.dcPick = -1;
    G.uiGen = (function* () { G.temp.dcPick = yield* partyScreen({ mode: 'choose', text: 'Which Pokémon should I raise?' }); })(); yield;
    const i = G.temp.dcPick;
    if (i == null || i < 0) { yield* showMessage('Fine, fine. Come back if you change your mind.'); return true; }
    const mon = G.party[i];
    if (G.party.filter((q, j) => j !== i && q.hp > 0).length === 0) { yield* showMessage("If I take " + pokeName(mon) + ", you'd have no Pokémon able to battle!"); return true; }
    G.party.splice(i, 1); G.daycare = { mon, t0: G.playFrames };
    yield* showMessage("All right, I'll raise " + pokeName(mon) + '. The longer you leave it with me, the stronger it will get!');
    yield* showMessage('Come back whenever you want it back.'); return true;
  }
  const mon = d.mon, lv = d.mon.lvl, gain = dcLevelsAfter(d);
  yield* showMessage('Ah, ' + G.name + '! Your ' + pokeName(mon) + ' is doing great.');
  yield* showMessage(gain > 0 ? 'It has grown by ' + gain + ' level' + (gain > 1 ? 's' : '') + ' since you left it with me!' : "It hasn't grown much yet. Give it a little more time.");
  yield* showMessage('Do you want to take ' + pokeName(mon) + ' back?', { noWait: true });
  if ((yield* showChoices(['Take it back', 'Leave it'], 2)) !== 0) { yield* showMessage("All right, I'll keep looking after it."); return true; }
  if (G.party.length >= 6) { yield* showMessage('Your party is full! Make some room first.'); return true; }
  const res = gainExp(mon, dcGain()); const learn = [];
  for (const r of res) for (const mv of r.learn) learn.push(mv);
  for (const id of learn) {                                    // the day care keeps the four newest moves
    if (!D.MV[id] || mon.moves.some(x => x.id === id)) continue;
    if (mon.moves.length >= 4) mon.moves.shift();
    mon.moves.push(newMoveSlot(id));
  }
  mon.evoCheck = false; mon.hp = Math.min(mon.maxhp, Math.max(1, mon.hp));
  G.daycare = null; G.party.push(mon);
  playME('Item_get');
  yield* showMessage(G.name + ' took back ' + pokeName(mon) + (mon.lvl > lv ? ', now Lv. ' + mon.lvl + '!' : '.'));
  return true;
}
