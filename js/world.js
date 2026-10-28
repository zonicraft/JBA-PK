'use strict';
// ===================================================================
//  World systems: map connections, wild encounters, Poké Mart,
//  Poké Center, berry plants, cut trees, emote balloons
// ===================================================================

// ---- map connections (PBS/connections.txt): [mapA, edgeA, offsetA, mapB, edgeB, offsetB]
const CONNS = [[2, 'N', 0, 5, 'S', 0], [7, 'S', 6, 5, 'N', 0],
  [5, 'E', 120, 311, 'W', 0], [32, 'S', 59, 5, 'N', 0], [32, 'E', 0, 7, 'W', 6], [43, 'S', 2, 7, 'N', 0], [43, 'N', 0, 87, 'S', 2], [2, 'S', 0, 310, 'N', 0], [311, 'W', 0, 2, 'E', 80],
  [87, 'E', 15, 79, 'W', 0], [79, 'N', 0, 95, 'S', 0], [79, 'E', 0, 110, 'W', 30], [95, 'E', 0, 110, 'W', 6], [100, 'W', 0, 110, 'E', 0],
  [109, 'S', 4, 100, 'N', 0], [100, 'N', 36, 111, 'S', 0], [109, 'E', 0, 111, 'W', 1], [111, 'S', 0, 110, 'N', 121],
  [114, 'N', 0, 100, 'S', 0], [114, 'W', 0, 110, 'E', 40], [120, 'S', 0, 122, 'N', 2], [129, 'W', 0, 122, 'E', 6]];  // the rest lead to areas not built yet
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
  5: { chance: 0.1, land: [['DAVINCI', 2, 3, 20], ['KUKA', 2, 3, 20], ['ARU', 2, 3, 20], ['CHINO', 2, 3, 20], ['YUITRINITY', 2, 3, 20]] },
};
function terrainTagAt(x, y) {
  const m = G.map; if (!m || !m.ts.tags) return 0;
  for (let z = 2; z >= 0; z--) {
    const tid = m.data[x + y * m.w + z * m.w * m.h]; if (!tid) continue;
    const t = m.ts.tags[tid] || 0; if (t > 0) return t;
  }
  return 0;
}
// counters: terrain tag 1, or - the interior tilesets (3, 25) carry no terrain tags in this project - any fully blocked tile indoors
function isCounter(x, y) {
  if (terrainTagAt(x, y) === 1) return true;
  if (![3, 25].includes(G.map.tsId)) return false;
  const m = G.map; if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
  for (let z = 2; z >= 0; z--) { const tid = m.data[x + y * m.w + z * m.w * m.h]; if (!tid) continue; const pv = m.ts.passages[tid] || 0; if (pv & 0x10) continue; return (pv & 0x0f) === 0x0f; }
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
function checkWild(x, y) {
  const enc = wildTable(G.mapId); if (!enc || !G.party.length || !G.started) return;
  if (!G.party.some(m => m.hp > 0)) return;
  if (enc.kind !== 'Cave' && terrainTagAt(x, y) !== 2) return;
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

function* rockSmashCheck() {
  if (!getSwitch(156)) { yield* showMessage("It's a rugged rock, but a Pokémon may be able to smash it."); return false; }
  yield* showMessage('This rock appears to be breakable.');
  yield* showMessage('Would you like to use Rock Smash?', { noWait: true });
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
  if (terrainTagAt(nx, ny) !== 1 || m.tsId !== 1) return false;
  // sideways hops only over vertical ledge walls (the tile above or below is a ledge too)
  if (dx && terrainTagAt(nx, ny - 1) !== 1 && terrainTagAt(nx, ny + 1) !== 1) return false;
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
  if (![354, 355, 356, 357, 358].includes(G.mapId) || y !== 10 || (x !== 7 && x !== 8) || G.main) return false;
  G.main = new Interp([[355, 0, ['pbWallTownMap']], [0, 0, []]], null); return true;
}
function* worldScript(it, s) {
  let m;
  if (s === 'pbDayCareMan' || s === 'pbDayCareHeal') {          // the old folk turn to face the player, then back to where they were
    const ev = it && it.ev, d0 = ev && ev.dir; if (ev) faceEvent(ev, G.player);
    try { return yield* worldScriptDayCare(s); } finally { if (ev) ev.dir = d0; }
  }
  if (s === 'pbWallTownMap') { playSE('GUI_sel_decision'); yield* showMessage('It\'s a map of the region.'); G.uiGen = townMapScreen(); yield; return true; }
  if (s.startsWith('Kernel.pbExclaim')) {
    const mm = s.match(/events\[(\d+)\]/), te = mm ? G.events[+mm[1]] : null;
    if (te && te !== G.player) faceEvent(G.player, te);   // the player turns towards the trainer who spotted them
    yield* exclaim(te || G.player); return true;
  }
  if (s.startsWith('pbWait(')) { let n = +s.match(/\d+/)[0]; while (n-- > 0) yield; return true; }
  if (s === 'Kernel.pbSetPokemonCenter') { const p = G.player; G.healPoint = { map: G.mapId, x: p.x, y: p.y, dir: p.dir }; return true; }
  if (s.includes('for i in 1..')) {            // Poké Center ball-by-ball healing animation
    const n = Math.max(1, G.party.length);
    for (let i = 1; i <= n; i++) { setVar(6, i); playSE('ballshake'); for (let k = 0; k < 16; k++) yield; }
    return true;
  }
  if (s === 'pbPokeCenterPC') {
    playSE('PC_open'); yield* showMessage('\\PN booted up the PC.');
    while (true) {
      yield* showMessage('Which PC should be accessed?', { noWait: true });
      const i = yield* showChoices(["Geso's PC", G.name + "'s PC", 'Log off'], 3);
      if (i === 0) { G.uiGen = pcSession(); yield; }
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
  if (s === 'Kernel.pbRockSmashRandomEncounter') return true;
  if (s === 'pbEraseThisEvent') {
    if (it.ev) { it.ev.erased = true; G.erasedEv = G.erasedEv || {}; G.erasedEv[G.mapId + ':' + it.ev.id] = true; }
    return true;
  }
  if ((m = s.match(/^pbPickBerry\(:(\w+),(\d+)\)/))) {
    const n = +m[2], nm = n > 1 ? itemInfo(m[1]).plural : itemName(m[1]);
    yield* showMessage('There are ' + n + ' \\c[1]' + nm + '\\c[0]!\nWant to pick them?', { noWait: true });
    const i = yield* showChoices(['Yes', 'No'], 2);
    if (i === 0) {
      G.items[m[1]] = (G.items[m[1]] || 0) + n; playME('frlg_berry');
      yield* showMessage('You picked the ' + n + ' \\c[1]' + nm + '\\c[0].');
      if (it.ev) { G.selfsw[selfKey(G.mapId, it.ev.id, 'A')] = true; G.refresh = true; }
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
  if (s === 'pbFishAsk') {                   // action button on water with a rod in the bag
    yield* showMessage('The water is calm.\nWant to fish here?', { noWait: true });
    const i = yield* showChoices(['Yes', 'No'], 2);
    if (i === 0) return yield* worldScript(it, 'pbFish("OldRod")');
    return true;
  }
  if ((m = s.match(/^pbFish\("(\w+)"\)/))) {          // field use of a fishing rod: needs water in front of the player
    const pl = G.player, [fx, fy] = dirVec[pl.dir]; const wx = pl.x + fx, wy = pl.y + fy;
    if (![5, 6, 7].includes(terrainTagAt(wx, wy))) { yield* showMessage("There's no water to fish in here."); return true; }
    const e = window.ENCOUNTERS && ENCOUNTERS[G.mapId], tbl = e && ((e[m[1]] && e[m[1]].length ? e[m[1]] : null) || (e.Water && e.Water.length ? e.Water : null));
    yield* showMessage('\\PN cast the line...'); for (let i = 0; i < 50; i++) yield;
    if (!tbl || Math.random() < 0.2) { yield* showMessage('Not even a nibble...'); return true; }
    yield* exclaim(pl); yield* showMessage('Oh! A bite!');
    const pk = tbl[Math.floor(Math.random() * tbl.length)], lv = pk[1] + Math.floor(Math.random() * (pk[2] - pk[1] + 1));
    yield* runWildBattle(pk[0], lv);
    if (G.battleResult === 'lose') yield* blackout(); else if (G.map && G.map.bgm) playBGM(G.map.bgm);
    return true;
  }
  if ((m = s.match(/^pbWildBattle\(:(\w+),(\d+)\)/))) {
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
