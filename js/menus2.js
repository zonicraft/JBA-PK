'use strict';
// ===================================================================
//  Bag, item use, pause menu, trainer card, options, save / load, title
// ===================================================================

// ------------------------------------------------------------ item effects
const HEAL_HP = { POTION: 20, SUPERPOTION: 60, HYPERPOTION: 120, MAXPOTION: 9999, FULLRESTORE: 9999, ORANBERRY: 10, SITRUSBERRY: 30, FRESHWATER: 30, SODAPOP: 50, LEMONADE: 70, MOOMOOMILK: 100, ENERGYPOWDER: 50, ENERGYROOT: 200 };
const CURE = { ANTIDOTE: ['PSN'], PARLYZHEAL: ['PAR'], AWAKENING: ['SLP'], BURNHEAL: ['BRN'], ICEHEAL: ['FRZ'], FULLHEAL: ['PSN', 'PAR', 'SLP', 'BRN', 'FRZ'], FULLRESTORE: ['PSN', 'PAR', 'SLP', 'BRN', 'FRZ'], LAVACOOKIE: ['PSN', 'PAR', 'SLP', 'BRN', 'FRZ'], OLDGATEAU: ['PSN', 'PAR', 'SLP', 'BRN', 'FRZ'], CASTELIACONE: ['PSN', 'PAR', 'SLP', 'BRN', 'FRZ'], LUMBERRY: ['PSN', 'PAR', 'SLP', 'BRN', 'FRZ'] };
const REVIVE = { REVIVE: 0.5, MAXREVIVE: 1, REVIVALHERB: 1 };
function isMedicine(k) { return k in HEAL_HP || k in CURE || k in REVIVE || k === 'RARECANDY' || /^(ETHER|MAXETHER|ELIXIR|MAXELIXIR)$/.test(k); }
function consume(k, n = 1) { G.items[k] = (G.items[k] || 0) - n; if (G.items[k] <= 0) delete G.items[k]; }
// Applies to a party member. Returns false if it would have no effect.
function* useItemOn(key, p, S) {
  const name = pokeName(p);
  if (key in REVIVE) {
    if (p.hp > 0) { yield* uiMessage('It won\'t have any effect.'); return false; }
    p.hp = Math.max(1, Math.floor(p.maxhp * REVIVE[key])); p.status = null; consume(key); sfx('item');
    yield* uiMessage(name + ' was revived!'); return true;
  }
  if (key === 'RARECANDY') {
    if (p.lvl >= MAXLEVEL) { yield* uiMessage('It won\'t have any effect.'); return false; }
    const r = gainExp(p, expFor(D.SP[p.sym].growth, p.lvl + 1) - p.exp); consume(key); sfx('exp');
    yield* uiMessage(name + ' grew to Lv. ' + p.lvl + '!'); return true;
  }
  if (p.hp <= 0) { yield* uiMessage('It won\'t have any effect.'); return false; }
  let did = false;
  if (key in HEAL_HP) {
    if (p.hp < p.maxhp) {
      const amt = Math.min(HEAL_HP[key], p.maxhp - p.hp), end = p.hp + amt;
      sfx('item'); while (p.hp < end) { p.hp = Math.min(end, p.hp + Math.max(1, Math.ceil(p.maxhp / 60))); yield; }
      yield* uiMessage(name + '\'s HP was restored by ' + amt + ' points.'); did = true;
    }
  }
  if (key in CURE && p.status && CURE[key].includes(p.status)) {
    p.status = null; p.sleep = 0; if (!did) sfx('item'); yield* uiMessage(name + ' was cured.'); did = true;
  }
  if (/^(ETHER|MAXETHER)$/.test(key)) {
    const m = p.moves.find(mv => mv.pp < maxPP(mv)); if (m) { m.pp = Math.min(maxPP(m), m.pp + (key === 'ETHER' ? 10 : 99)); yield* uiMessage('PP was restored.'); did = true; }
  }
  if (!did) { yield* uiMessage('It won\'t have any effect.'); return false; }
  consume(key); return true;
}

// ------------------------------------------------------------ Bag
// mode: 'field' | 'party' (pick item to use on party) | 'give' | 'battle' (pick a battle item)
function bagPockets() { const out = [[], [], [], [], [], [], [], []]; for (const k of Object.keys(G.items)) { if (G.items[k] > 0) out[Math.min(7, Math.max(0, itemInfo(k).pocket - 1))].push(k); } out.forEach(a => a.sort((x, y) => (itemInfo(x).id || 0) - (itemInfo(y).id || 0))); return out; }
function drawBag(S) {
  const pk = S.pockets[S.pocket], n = S.pocket + 1;
  pic('bag/bg_' + n, 0, 0);
  pic('bag/bag_' + n, 30, 20);
  // pocket strip: coloured icon for the active pocket (the strip itself is part of the background)
  const ip = UI('bag/icon_pocket'); if (ip) ctx.drawImage(ip, S.pocket * 28, 0, 28, 28, 3 + S.pocket * 22, 228, 28, 28);
  txt(POCKETS[S.pocket], 94, 190, { col: COL.light, shadow: '#585858', align: 'center', size: 24 });
  // arrows
  if (S.pocket > 0) { const la = UI('leftarrow'); if (la) ctx.drawImage(la, 0, (Math.floor(G.frame / 4) % 8) * 28, 40, 28, 2, 120, 40, 28); }
  if (S.pocket < 7) { const ra = UI('rightarrow'); if (ra) ctx.drawImage(ra, 0, (Math.floor(G.frame / 4) % 8) * 28, 40, 28, 144, 120, 40, 28); }
  // list
  const rows = 8, first = S.scroll;
  for (let r = 0; r < rows; r++) {
    const i = first + r, y = 12 + r * 32;
    if (i > pk.length) break;
    if (i === S.idx) { const cu = UI(S.move ? 'bag/cursor_swap' : 'bag/cursor'); if (cu) ctx.drawImage(cu, 0, 0, 282, 68, 194, y - 18, 262, 68); }
    if (i === pk.length) { txt('CLOSE', 212, y + 6, { size: 24 }); continue; }
    const k = pk[i], it = itemInfo(k);
    txt(itemLabel(k), 212, y + 6, { size: 22 });
    if (it.pocket !== 8) txt('×' + G.items[k], 440, y + 6, { align: 'right', size: 22 });
    if (S.reg && S.reg.includes(k)) pic('bag/icon_register', 440, y);
  }
  // item icon + description
  const cur = S.idx < pk.length ? pk[S.idx] : null;
  if (cur) { drawItemIcon(cur, 24, SH - 72); wrap(itemInfo(cur).desc, 400, 22).slice(0, 3).forEach((l, i) => txt(l, 84, 288 + i * 26, { col: COL.light, size: 22 })); }
  else txt('Close the Bag.', 84, 290, { col: COL.light, size: 22 });
  if (S.hint) txt(S.hint, 8, 4, { col: COL.light, size: 20 });
}
function* bagScreen(o = {}) {
  const S = { pockets: bagPockets(), pocket: o.pocket || 0, idx: 0, scroll: 0, hint: '' };
  const memKey = o.mode || 'field'; G.bagMem = G.bagMem || {};
  const mem = G.bagMem[memKey];
  if (mem) { S.pocket = mem.pocket; S.idx = mem.idx; S.scroll = mem.scroll; const n = (S.pockets[S.pocket] || []).length; if (S.idx > n) S.idx = n; if (S.scroll > S.idx) S.scroll = S.idx; }
  else if (o.mode === 'battle') { const f = [1, 2, 0].find(i => S.pockets[i] && S.pockets[i].length); S.pocket = f === undefined ? 1 : f; }
  const draw = () => { drawBag(S); drawPopup(); drawUiMsg(); };
  const result = yield* withDraw(draw, (function* () {
    sfx('open');
    while (true) {
      yield;
      const pk = S.pockets[S.pocket];
      if (rep('left')) { if (S.pocket > 0) { S.pocket--; S.idx = S.scroll = 0; sfx('cursor'); } }
      if (rep('right')) { if (S.pocket < 7) { S.pocket++; S.idx = S.scroll = 0; sfx('cursor'); } }
      if (rep('up')) { S.idx = (S.idx + pk.length) % (pk.length + 1); sfx('cursor'); }
      if (rep('down')) { S.idx = (S.idx + 1) % (pk.length + 1); sfx('cursor'); }
      if (S.idx < S.scroll) S.scroll = S.idx; if (S.idx > S.scroll + 7) S.scroll = S.idx - 7;
      if (back()) { sfx('back'); return null; }
      if (!ok()) continue;
      if (S.idx >= pk.length) { sfx('back'); return null; }
      const key = pk[S.idx], it = itemInfo(key); sfx('ok');
      if (o.filter) { if (o.filter(key)) return key; yield* uiMessage("That won't fit in this plot."); continue; }
      if (o.mode === 'give') { return key; }
      if (o.mode === 'party') { if (isMedicine(key)) return key; yield* uiMessage('It can\'t be used on a Pokémon.'); continue; }
      if (o.mode === 'battle') {
        if (isMedicine(key) || it.pocket === 3) return key;
        yield* uiMessage('It can\'t be used in battle.'); continue;
      }
      // field menu
      const opts = []; if (isMedicine(key) || key === 'POKEGEAR' || key === 'OLDROD' || key === 'BICYCLE' || key in REPEL_STEPS) opts.push('USE'); opts.push('TOSS', 'CANCEL');
      const c = yield* choiceWindow(opts, { y: SH - 96 - opts.length * 32 - 32, x: SW - 150 });
      const choice = c < 0 ? 'CANCEL' : opts[c];
      if (choice === 'USE') {
        if (key in REPEL_STEPS) {
          if (G.repel > 0) yield* uiMessage('But the effects of a Repel lingered from earlier.');
          else {
            G.repel = REPEL_STEPS[key]; G.repelItem = key; consume(key); sfx('item');
            yield* uiMessage(G.name + ' used the ' + it.name + '!');
            S.pockets = bagPockets(); if (S.idx > S.pockets[S.pocket].length) S.idx = S.pockets[S.pocket].length;
          }
          continue;
        }
        if (key === 'OLDROD') { G.fishReq = 'OldRod'; return null; }
        if (key === 'BICYCLE') { if (G.biking) { G.biking = false; G.bikeMsg = G.name + ' got off the Skateboard.'; } else if (bikeAllowed()) { G.biking = true; G.bikeMsg = G.name + ' got on the Skateboard.'; } else G.bikeMsg = 'You can\'t use the Skateboard here.'; return null; }
        if (isMedicine(key)) {
          const r = yield* partyScreen({ mode: 'item', text: 'Use on which Pokémon?', use: (p, i) => useItemOn(key, p) });
          S.pockets = bagPockets(); if (S.idx > S.pockets[S.pocket].length) S.idx = S.pockets[S.pocket].length;
        }
      } else if (choice === 'TOSS') {
        if (it.pocket === 8) { yield* uiMessage('That\'s too important to toss out!'); continue; }
        const ok2 = yield* (function* () { G.uiMsg = null; yield* uiMessage('Toss out the ' + it.name + '?', { noWait: true }); const r = yield* yesNo(); G.uiMsg = null; return r; })();
        if (ok2) { consume(key); yield* uiMessage('Threw away the ' + it.name + '.'); S.pockets = bagPockets(); S.idx = Math.min(S.idx, S.pockets[S.pocket].length); }
      }
    }
  })());
  G.bagMem[memKey] = { pocket: S.pocket, idx: S.idx, scroll: S.scroll };
  return result;
}

// ------------------------------------------------------------ Trainer card (simplified)
function fmtTime(frames) { const s = Math.floor(frames / FPS); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0'); }
function drawTrainerCard() {
  pic('loadbg', 0, 0);
  skinBox('skin_choice_1', 24, 40, SW - 48, 280);
  txt('TRAINER CARD', 52, 56, { size: 28 });
  const rows = [['Name', G.name], ['ID No.', String(G.trainerId).padStart(5, '0')], ['Money', '$' + G.money], ['Pokédex', String(dexCounts()[1])], ['Time', fmtTime(G.playFrames)], ['Badges', String(badgeCount())]];
  rows.forEach(([a, b], i) => { txt(a, 56, 106 + i * 36, { size: 24 }); txt(b, 330, 106 + i * 36, { size: 24, align: 'right' }); });
  const im = img('faces', 'facemain'); if (im) ctx.drawImage(im, 0, 0, 96, 96, 350, 100, 112, 112);
}
function* trainerCard() { return yield* withDraw(drawTrainerCard, (function* () { while (true) { yield; if (ok() || back()) { sfx('back'); return; } } })()); }

// ------------------------------------------------------------ Options
function* optionsScreen() {
  const S = { idx: 0, touch: SET.touch };   // S.touch = pending value: turning controls OFF only takes effect on Close
  const items = [['Music Volume', 'music'], ['Sound Effects', 'sfx'], ['Game Speed', 'speed'], ['Side Bars', 'bars'], ['On-Screen Controls', 'touch'], ['Close', null]];
  const draw = () => {
    pic('loadbg', 0, 0); skinBox('skin_choice_1', 24, 24, SW - 48, 300);
    txt('OPTIONS', 52, 38, { size: 28 });
    items.forEach(([l, k], i) => {
      const y = 80 + i * 36; txt(l, 70, y, { size: 26 }); if (i === S.idx) pic('selarrow', 46, y - 2);
      if (k === 'music' || k === 'sfx') {
        ctx.fillStyle = '#b8c0c8'; ctx.fillRect(280, y + 6, 130, 14); ctx.fillStyle = '#3a78d8'; ctx.fillRect(280, y + 6, 130 * SET[k], 14);
        ctx.strokeStyle = '#485058'; ctx.strokeRect(280.5, y + 6.5, 129, 13); txt(Math.round(SET[k] * 100) + '%', 420, y, { size: 22 });
      } else if (k === 'speed') txt('◀ ' + SET.speed + 'x ▶', 280, y, { size: 26 });
      else if (k === 'bars') txt('◀ ' + (SET.bars ? 'Image' : 'Black') + ' ▶', 280, y, { size: 26 });
      else if (k === 'touch') txt('◀ ' + (S.touch ? 'On' : 'Off') + ' ▶', 280, y, { size: 26 });
    });
    txt('Left/Right: change   X: back', 52, 294, { size: 20, col: COL.dark });
  };
  return yield* withDraw(draw, (function* () {
    while (true) {
      yield;
      if (rep('up')) { S.idx = (S.idx + items.length - 1) % items.length; sfx('cursor'); }
      if (rep('down')) { S.idx = (S.idx + 1) % items.length; sfx('cursor'); }
      const dl = rep('left') ? -1 : rep('right') ? 1 : 0;
      if (dl) {
        const k = items[S.idx][1];
        if (k === 'music') { SET.music = Math.max(0, Math.min(1, Math.round((SET.music + dl * 0.05) * 20) / 20)); applyVolumes(); }
        else if (k === 'sfx') { SET.sfx = Math.max(0, Math.min(1, Math.round((SET.sfx + dl * 0.05) * 20) / 20)); sfx('cursor'); }
        else if (k === 'speed') { let i = SPEEDS.indexOf(SET.speed); i = Math.max(0, Math.min(SPEEDS.length - 1, i + dl)); SET.speed = SPEEDS[i]; sfx('cursor'); }
        else if (k === 'bars') { SET.bars = SET.bars ? 0 : 1; applyBars(); sfx('cursor'); }
        else if (k === 'touch') { S.touch = S.touch ? 0 : 1; if (S.touch) { SET.touch = 1; applyTouch(); } sfx('cursor'); }
      }
      if (ok() && items[S.idx][1] === 'bars') { SET.bars = SET.bars ? 0 : 1; applyBars(); sfx('cursor'); }
      if (ok() && items[S.idx][1] === 'touch') { S.touch = S.touch ? 0 : 1; if (S.touch) { SET.touch = 1; applyTouch(); } sfx('cursor'); }
      if (ok() && S.idx === items.length - 1) { SET.touch = S.touch; applyTouch(); sfx('back'); saveSettings(); return; }   // Close: apply the choice
      if (back()) { sfx('back'); SET.touch = SET.touch ? 1 : 0; saveSettings(); return; }   // X: a pending 'Off' is discarded
    }
  })());
}

// ------------------------------------------------------------ Save / Load
const SAVE_KEY = 'jba_save_v1';
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
function writeSave() {
  const p = G.player;
  const data = {
    v: 1, t: Date.now(), switches: G.switches, vars: G.vars, selfsw: G.selfsw, party: G.party, items: G.items, name: G.name, starterName: G.starterName, money: G.money, trainerId: G.trainerId,
    runningShoes: !!G.runningShoes, playFrames: G.playFrames, healPoint: G.healPoint || null, erasedEv: G.erasedEv || {}, berries: G.berries || {}, box: G.box || [], pc: G.pc || null, seen: G.seen || {}, pokedex: !!G.pokedex, repel: G.repel || 0, repelItem: G.repelItem || null, pcItems: G.pcItems || null, daycare: G.daycare ? { mon: G.daycare.mon, el: G.playFrames - G.daycare.t0 } : null, owned: G.owned || {}, map: G.mapId, x: p.x, y: p.y, dir: p.dir, mapName: G.mapName || '', bgm: G.bgm ? G.bgm.name : null,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}
const SYM_RENAME = { NIDOQUEEN: 'ARU', FERALIGATR: 'DAVINCI', WOOPER: 'ILLYA', QUAGSIRE: 'ILLYA2', CLAMPERL: 'RORY', HUNTAIL: 'AETHER', BURMY: 'CHINO', CHANDELURE: 'HIZUNA', AXEW: 'JIBRIL', VIRIZION: 'KUKA', ORANGURU: 'YUITRINITY' };
function migrateSyms(d) {   // saves made before species were renamed to their character names
  const fix = m => { if (m && SYM_RENAME[m.sym]) m.sym = SYM_RENAME[m.sym]; };
  (d.party || []).forEach(fix); (d.box || []).forEach(fix); if (d.pc) d.pc.boxes.forEach(b => b.mons.forEach(fix));
  if (d.owned) for (const k of Object.keys(d.owned)) if (SYM_RENAME[k]) { d.owned[SYM_RENAME[k]] = d.owned[k]; delete d.owned[k]; }
}
function loadSave(d) {
  migrateSyms(d);
  G.switches = d.switches; G.vars = d.vars; G.selfsw = d.selfsw; G.party = d.party; G.items = d.items; G.name = d.name; G.starterName = d.starterName; G.money = d.money; G.trainerId = d.trainerId;
  G.runningShoes = d.runningShoes; G.playFrames = d.playFrames; G.temp = {}; G.healPoint = d.healPoint || null; G.daycare = d.daycare ? { mon: d.daycare.mon, t0: G.playFrames - d.daycare.el } : null; G.erasedEv = d.erasedEv || {}; G.berries = d.berries || {}; G.box = d.box || []; G.pc = d.pc || null; G.seen = d.seen || {}; G.pokedex = !!d.pokedex; G.repel = d.repel || 0; G.repelItem = d.repelItem || null; G.repelEnd = false; G.pcItems = d.pcItems || null; G.owned = d.owned || {};
  enterMap(d.map, d.x, d.y, d.dir); if (d.bgm) playBGM(d.bgm);
}
const MAPNAMES = { 1: "Jorge's House 2F", 2: 'Pallet Town', 3: 'Pallet Town', 4: "Jorge's House", 8: "Geso's Lab", 5: 'Route 1', 7: 'Viridian City', 81: 'Viridian City', 84: 'Viridian City', 398: 'Viridian City', 354: 'Pokémon Center', 43: 'Route 2', 48: 'Viridian Forest', 85: 'Route 2', 86: 'Route 2', 132: 'Route 2', 145: 'Route 2', 87: 'Pewter City', 89: 'Pewter City', 92: 'Pewter City', 93: 'Pewter City', 94: 'Pewter City', 355: 'Pewter City', 79: 'Route 3', 95: 'Route 4', 96: 'Route 4', 110: 'Route 4', 356: 'Route 4', 97: 'Mt. Moon', 98: 'Mt. Moon', 99: 'Mt. Moon', 100: 'Cerulean City', 101: 'Cerulean City', 102: 'Cerulean City', 103: 'Cerulean City', 104: 'Cerulean City', 105: 'Cerulean City', 106: 'Cerulean City', 107: 'Cerulean City', 108: 'Cerulean City', 113: 'Cerulean City', 357: 'Cerulean City', 109: 'Route 24', 111: 'Route 25', 112: "Nuno's House" };
function mapNameOf(id) { return MAPNAMES[id] || (window.MAPNAME && MAPNAME[id]) || 'Pallet Town'; }
function* saveGame() {
  const draw = () => { drawUiMsg(); drawPopup(); drawSaveInfo(); };
  return yield* withDraw(draw, (function* () {
    yield* uiMessage('Would you like to save the game?', { noWait: true });
    const yes = yield* yesNo(); G.uiMsg = null;
    if (!yes) return false;
    if (hasSave()) {
      yield* uiMessage('There is already a saved file. Is it OK to overwrite it?', { noWait: true });
      const y2 = yield* yesNo(); G.uiMsg = null; if (!y2) return false;
    }
    yield* uiMessage('Saving... Don\'t turn off the power.', { noWait: true }); yield* wait(40);
    const done = writeSave(); sfx('save');
    yield* uiMessage(done ? G.name + ' saved the game!' : 'The game could not be saved.');
    return done;
  })());
}
function drawSaveInfo() {
  skinBox('skin_choice_1', 0, 0, 290, 160);
  const rows = [['Player', G.name], ['Badges', String(badgeCount())], ['Time', fmtTime(G.playFrames)], ['Location', mapNameOf(G.mapId)]];
  rows.forEach(([a, b], i) => { txt(a, 22, 18 + i * 34, { size: 22 }); txt(b, 270, 18 + i * 34, { size: 22, align: 'right', col: COL.blue }); });
}

// ------------------------------------------------------------ Town map (PBS/townmap.txt)
const TPOINTS = [[13, 13, "Pallet Town", ""], [13, 11, "Route 1", ""], [13, 12, "Route 1", ""], [12, 9, "Viridian City", ""], [13, 9, "Viridian City", ""], [12, 10, "Viridian City", ""], [13, 10, "Viridian City", ""], [9, 10, "Route 22", ""], [10, 10, "Route 22", ""], [11, 10, "Route 22", ""], [13, 6, "Route 2", "Burrow Tunnel"], [13, 7, "Route 2", "Viridian Forest"], [13, 8, "Route 2", ""], [13, 4, "Pewter City", ""], [13, 5, "Pewter City", ""], [14, 4, "Pewter City", ""], [14, 5, "Pewter City", ""], [15, 5, "Route 3", ""], [16, 5, "Route 3", ""], [17, 5, "Route 4", "Mt. Moon"], [18, 5, "Route 4", ""], [19, 5, "Route 4", ""], [20, 5, "Route 4", ""], [21, 5, "Cerulean City", "Cerulean Cave"], [22, 5, "Cerulean City", ""], [21, 6, "Cerulean City", ""], [22, 6, "Cerulean City", ""], [22, 3, "Route 24", ""], [22, 4, "Route 24", ""], [23, 3, "Route 25", ""], [24, 3, "Route 25", ""], [25, 3, "Route 25", ""], [21, 7, "Route 5", ""], [21, 10, "Route 6", ""], [21, 11, "Vermilion City", ""], [22, 11, "Vermilion City", ""], [21, 12, "Vermilion City", ""], [22, 12, "Vermilion City", ""], [23, 11, "Route 11", "Burrow Tunnel"], [24, 11, "Route 11", ""], [25, 10, "Route 12", ""], [25, 11, "Route 12", ""], [25, 12, "Route 12", ""], [25, 13, "Route 12", ""], [23, 6, "Route 9", ""], [24, 6, "Route 9", ""], [25, 6, "Route 10", "Rock Tunnel"], [25, 7, "Route 10", "Power Plant"], [25, 8, "Route 10", ""], [25, 9, "Lavender Town", "Pokémon Tower"], [23, 9, "Route 8", ""], [24, 9, "Route 8", ""], [20, 9, "Route 7", ""], [18, 9, "Celadon City", ""], [19, 9, "Celadon City", ""], [18, 10, "Celadon City", ""], [19, 10, "Celadon City", ""], [16, 10, "Route 16", ""], [17, 10, "Route 16", ""], [16, 11, "Route 17", ""], [16, 12, "Route 17", ""], [16, 13, "Route 17", ""], [16, 14, "Route 17", ""], [16, 15, "Route 18", ""], [17, 15, "Route 18", ""], [18, 14, "Fuchsia City", "Safari Zone"], [19, 14, "Fuchsia City", ""], [18, 15, "Fuchsia City", ""], [19, 15, "Fuchsia City", ""], [24, 13, "Route 13", ""], [23, 13, "Route 14", ""], [23, 14, "Route 14", ""], [23, 15, "Route 14", ""], [20, 15, "Route 15", ""], [21, 15, "Route 15", ""], [22, 15, "Route 15", ""], [21, 8, "Saffron City", ""], [22, 8, "Saffron City", ""], [21, 9, "Saffron City", ""], [22, 9, "Saffron City", ""], [18, 16, "Route 19", ""], [18, 17, "Route 19", ""], [14, 17, "Route 20", ""], [15, 17, "Route 20", ""], [16, 17, "Route 20", "Seafoam Islands"], [17, 17, "Route 20", ""], [13, 17, "Cinnabar Island", "Pokémon Mansion"], [13, 14, "Route 21", ""], [13, 15, "Route 21", ""], [13, 16, "Route 21", ""], [9, 9, "Route 23", "Victory Road"], [9, 8, "Indigo Plateau", ""], [6, 10, "Mt. Silver", ""], [7, 10, "Route 28", ""], [8, 10, "Route 28", ""]];
const TMAP_HOME = { 'Pallet Town': [13, 13], 'Route 1': [13, 12], 'Viridian City': [13, 9], 'Pokémon Center': [13, 9], 'Route 2': [13, 8], 'Viridian Forest': [13, 7], 'Pewter City': [13, 5], 'Route 3': [15, 5], 'Route 4': [17, 5], 'Mt. Moon': [18, 5], 'Cerulean City': [19, 5], 'Route 24': [19, 3], 'Route 25': [21, 3], "Nuno's House": [21, 3] };
function* townMapScreen() {
  const here = (window.MAPPOS && MAPPOS[G.mapId]) || TMAP_HOME[mapNameOf(G.mapId)] || [13, 13]; let cx = here[0], cy = here[1];
  const ptName = (x, y) => { const p = TPOINTS.find(q => q[0] === x && q[1] === y); return p ? p[2] + (p[3] ? ' - ' + p[3] : '') : ''; };
  const draw = () => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
    pic('map/mapbg', 0, 0);
    const rg = UI('map/mapRegion0'); if (rg) ctx.drawImage(rg, 16, 32);
    const pl = UI('map/mapPlayer000'); if (pl) ctx.drawImage(pl, 16 + here[0] * 16 - 8, 32 + here[1] * 16 - 8);
    const cu = UI('map/mapCursor'); if (cu) ctx.drawImage(cu, (Math.floor(G.frame / 14) % 2) * 32, 0, 32, 32, 16 + cx * 16 - 8, 32 + cy * 16 - 8, 32, 32);
    const nm = ptName(cx, cy); txt(nm, 24, 362, { col: COL.light, shadow: '#383838', size: 22 });
    txt(mapNameOf(G.mapId), 24, 6, { col: COL.light, shadow: '#383838', size: 22 });
  };
  return yield* withDraw(draw, (function* () {
    sfx('open');
    while (true) {
      yield;
      if (rep('left') && cx > 0) { cx--; sfx('cursor'); }
      if (rep('right') && cx < 29) { cx++; sfx('cursor'); }
      if (rep('up') && cy > 0) { cy--; sfx('cursor'); }
      if (rep('down') && cy < 19) { cy++; sfx('cursor'); }
      if (back() || ok()) { sfx('back'); return; }
    }
  })());
}

// ------------------------------------------------------------ Cheats menu (debug helpers, sits under BAG in the pause menu)
function* learnMoveField(p, id) {   // field version of learnMove (uses the same forget screen as battle)
  const md = D.MV[id]; if (!md || p.moves.some(m => m.id === id)) return;
  if (p.moves.length < 4) { p.moves.push(newMoveSlot(id)); sfx('Pkmn_move_learnt'); yield* uiMessage(pokeName(p) + ' learned ' + md.name + '!'); return; }
  while (true) {
    yield* uiMessage(pokeName(p) + ' wants to learn ' + md.name + ', but ' + pokeName(p) + ' already knows four moves.');
    yield* uiMessage('Delete a move to make room for ' + md.name + '?', { noWait: true });
    const yes = yield* yesNo(); G.uiMsg = null;
    if (!yes) { yield* uiMessage(pokeName(p) + ' did not learn ' + md.name + '.'); return; }
    const r = yield* forgetScreen(p, id); if (r < 0) continue;
    const old = D.MV[p.moves[r].id].name; p.moves[r] = newMoveSlot(id);
    yield* uiMessage('1, 2, and... ... ... Poof!'); yield* uiMessage(pokeName(p) + ' forgot ' + old + '. And...');
    sfx('Pkmn_move_learnt'); yield* uiMessage(pokeName(p) + ' learned ' + md.name + '!'); return;
  }
}
function* cheatsMenu() {
  const labels = ['LEVEL UP POKéMON', 'RARE CANDY x10', '+$10000', 'HEAL PARTY', 'CANCEL'];
  let idx = 0;
  while (true) {
    const w = 330, x = SW - w - 8, y = 8;
    const r = yield* choiceWindow(labels, { x, y, w, idx });
    if (r < 0 || r === 4) return; idx = r;
    if (r === 0) {
      while (true) {
        const i = yield* partyScreen({ mode: 'choose', text: 'Level up which Pokémon?' });
        if (i < 0) break;
        const p = G.party[i];
        if (p.lvl >= MAXLEVEL) { yield* uiMessage(pokeName(p) + ' is already at the maximum level.'); continue; }
        const res = gainExp(p, expFor(D.SP[p.sym].growth, p.lvl + 1) - p.exp); sfx('exp');
        yield* uiMessage(pokeName(p) + ' grew to Lv. ' + p.lvl + '!');
        for (const lv of res) for (const mv of lv.learn) yield* learnMoveField(p, mv);
        if (evoTarget(p)) { p.evoCheck = false; yield* evolveScene([p]); }
        if (p.hp > 0) p.hp = Math.min(p.maxhp, p.hp + 1);
      }
    } else if (r === 1) { G.items.RARECANDY = Math.min(999, (G.items.RARECANDY || 0) + 10); sfx('item'); yield* uiMessage('Got 10 Rare Candies!'); }
    else if (r === 2) { G.money = Math.min(999999, G.money + 10000); sfx('item'); yield* uiMessage('Got $10000! You now have $' + G.money + '.'); }
    else if (r === 3) { G.party.forEach(healMon); sfx('item'); yield* uiMessage('Your party was fully healed.'); }
  }
}

// ------------------------------------------------------------ Pause menu
function pauseItems() {
  const l = []; if (G.pokedex) l.push(['POKéDEX', 'dex']); if (G.party.length) l.push(['POKéMON', 'party']); l.push(['BAG', 'bag']); l.push(['CHEATS', 'cheats']); l.push(['MAP', 'map']); l.push([G.name.toUpperCase(), 'card']); l.push(['SAVE', 'save']); l.push(['OPTIONS', 'options']); l.push(['EXIT', 'title']);
  return l;
}
function* pauseMenu() {
  const list = pauseItems(); let idx = G.pauseIdx || 0;
  const w = 200, h = list.length * 32 + 32;
  const draw = () => {
    skinBox('skin_choice_1', SW - w, 0, w, h);
    list.forEach(([l], i) => { txt(l, SW - w + 44, 16 + i * 32 + 1, { size: 26 }); if (i === idx) pic('selarrow', SW - w + 24, 16 + i * 32); });
    drawUiMsg(); drawPopup();
  };
  return yield* withDraw(draw, (function* () {
    sfx('open');
    while (true) {
      yield;
      if (rep('up')) { idx = (idx + list.length - 1) % list.length; sfx('cursor'); }
      if (rep('down')) { idx = (idx + 1) % list.length; sfx('cursor'); }
      if (back()) { sfx('back'); return; }
      if (!ok()) continue;
      sfx('ok'); const act = list[idx][1]; G.pauseIdx = idx;
      if (act === 'exit') return;
      if (act === 'title') {
        yield* uiMessage('Return to the main menu?\nUnsaved progress will be lost.', { noWait: true });
        const yes = yield* yesNo(); G.uiMsg = null;
        if (yes) { location.reload(); while (true) yield; }
        continue;
      }
      if (act === 'dex') yield* pokedexScreen();
      else if (act === 'party') yield* partyScreen({ mode: 'menu' });
      else if (act === 'bag') { yield* bagScreen({ mode: 'field' }); if (G.fishReq) return; }
      else if (act === 'cheats') yield* cheatsMenu();
      else if (act === 'map') yield* townMapScreen();
      else if (act === 'card') yield* trainerCard();
      else if (act === 'options') yield* optionsScreen();
      else if (act === 'save') { const r = yield* saveGame(); if (r) return; }
    }
  })());
}
function openPause() { G.pauseOpen = true; startUI((function* () { yield* pauseMenu(); G.pauseOpen = false; if (G.fishReq) { const rod = G.fishReq; G.fishReq = null; G.main = new Interp([[355, 0, ['pbFish("' + rod + '")']], [0, 0, []]], null); } })()); }

// ------------------------------------------------------------ Export / import save files (title screen)
// Export: downloads the current save as a .json file.  Import: reads such a file back into this browser's save slot.
const SAVE_FILE_FORMAT = 'jba-pokemon-save';
function exportSaveFile() {
  let raw = null; try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { }
  if (!raw) return null;
  let d; try { d = JSON.parse(raw); } catch (e) { return false; }
  const pack = { format: SAVE_FILE_FORMAT, version: 1, exported: new Date().toISOString(), save: d };
  const nm = String(d.name || 'save').replace(/[^\w-]+/g, '') || 'save', day = new Date().toISOString().slice(0, 10);
  const name = 'JBA-Pokemon-' + nm + '-' + day + '.json';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(pack)], { type: 'application/json' })); a.download = name;
  a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  return name;
}
function validSaveData(d) {
  return !!d && typeof d === 'object' && !!d.switches && typeof d.switches === 'object' && !!d.vars && typeof d.vars === 'object' && Array.isArray(d.party) && !!d.items && typeof d.items === 'object'
    && typeof d.name === 'string' && typeof d.map === 'number' && typeof d.x === 'number' && typeof d.y === 'number';
}
// opens the browser's file picker; resolves with the file's text, or null if cancelled / unreadable
function pickSaveFile() {
  return new Promise(res => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json'; inp.style.display = 'none';
    let fin = false; const end = v => { if (fin) return; fin = true; window.removeEventListener('focus', onFocus); inp.remove(); res(v); };
    const onFocus = () => setTimeout(() => { if (!inp.files.length) end(null); }, 1500);   // picker closed without a choice (older browsers have no "cancel" event)
    inp.onchange = () => { const f = inp.files[0]; if (!f) return end(null); const r = new FileReader(); r.onload = () => end(String(r.result)); r.onerror = () => end(null); r.readAsText(f); };
    inp.addEventListener('cancel', () => end(null));
    document.body.appendChild(inp); inp.click(); setTimeout(() => window.addEventListener('focus', onFocus), 500);
  });
}
// popup on the title screen. Returns true when a save was imported.
function* saveFileMenu(drawBase) {
  const d = () => { drawBase(); drawPopup(); drawUiMsg(); };
  return yield* withDraw(d, (function* () {
    let imported = false;
    while (true) {
      const i = yield* choiceWindow(['EXPORT SAVE', 'IMPORT SAVE', 'CANCEL'], { x: 112, y: 108, w: 288 });
      if (i < 0 || i === 2) return imported;
      if (i === 0) {
        const r = exportSaveFile();
        if (r === null) yield* uiMessage('There is no saved game to export yet.');
        else if (r === false) yield* uiMessage('The saved game is damaged and could not be exported.');
        else yield* uiMessage('Save exported! Look for ' + r + ' in your Downloads folder.');
        continue;
      }
      yield* uiMessage('Choose a save file (.json) to import...', { noWait: true });
      let text, fin = false; pickSaveFile().then(t => { text = t; fin = true; }); while (!fin) yield;
      G.uiMsg = null;
      if (text === null) continue;
      let data = null; try { const j = JSON.parse(text); data = j && j.save ? j.save : j; } catch (e) { }
      if (!validSaveData(data)) { sfx('buzzer'); yield* uiMessage("That file isn't a valid JBA Pokémon save."); continue; }
      if (hasSave()) {
        const badges = [260, 261, 262, 263].filter(k => data.switches[k]).length;
        yield* uiMessage('Import ' + data.name + "'s save (" + badges + ' badges, ' + fmtTime(data.playFrames || 0) + ')? This replaces the save in this browser.', { noWait: true });
        const yes = yield* yesNo(); G.uiMsg = null; if (!yes) continue;
      }
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { yield* uiMessage('The save could not be stored in this browser.'); continue; }
      sfx('save'); imported = true;
      yield* uiMessage('Save imported! Choose CONTINUE to play it.');
      return true;
    }
  })());
}

// ------------------------------------------------------------ Title + load screen (Essentials style)
function* titleScreen() {
  stopME(); stopBGM();
  if (!G.gesture) {   // browsers only allow sound after a click / key press
    yield* withDraw(() => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH); if (Math.floor(Date.now() / 600) % 2 === 0) txt('Click or press any key to start', SW / 2, SH / 2 - 14, { col: COL.light, size: 26, align: 'center' }); },
      (function* () { while (!G.gesture) { yield; const gps = navigator.getGamepads ? navigator.getGamepads() : []; for (const g of gps) if (g && g.buttons.some(b => b.pressed)) G.gesture = true; } })());
    yield; keys.pressed = {};
  }
  let save = null, opts = [];
  const refresh = () => { save = hasSave() ? readSave() : null; if (save) migrateSyms(save); opts = save ? ['continue', 'new', 'transfer', 'options'] : ['new', 'transfer', 'options']; };
  refresh();
  // splash: "press start"
  const splash = () => {
    pic('title_splash', 0, 0);
    if (Math.floor(Date.now() / 600) % 2 === 0 && UI('title_start')) ctx.drawImage(UI('title_start'), 0, 0, 512, UI('title_start').height, 0, 300 + 0, 512, UI('title_start').height);
  };
  yield* withDraw(splash, (function* () { stopME(); playBGM('frlg_title', 0.6); while (true) { yield; if (ok() || pressed('menu')) { sfx('ok'); return; } } })());
  yield* fadeTo(1, 10);
  let idx = 0;
  const label = { continue: 'CONTINUE', new: 'NEW GAME', transfer: 'EXPORT / IMPORT', options: 'OPTIONS' };
  const draw = () => {
    pic('loadbg', 0, 0);
    // panel positions: continue (big), others (small)
    const lp = UI('loadPanels');
    let y = save ? 8 : 24;   // with a save the big CONTINUE panel needs the extra room
    opts.forEach((o, i) => {
      const sel = i === idx;
      if (o === 'continue') {
        ctx.drawImage(lp, 0, sel ? 222 : 0, 408, 222, 52, y, 408, 222);
        txt('CONTINUE', 70, y + 11, { col: COL.light, shadow: '#383838', size: 24 });
        txt('Player', 70, y + 50, { col: COL.light, shadow: '#383838', size: 22 }); txt(save.name, 440, y + 50, { col: COL.light, shadow: '#383838', size: 22, align: 'right' });
        txt('Badges', 70, y + 76, { col: COL.light, shadow: '#383838', size: 22 }); txt(String([260, 261, 262, 263].filter(k => save.switches && save.switches[k]).length), 440, y + 76, { col: COL.light, shadow: '#383838', size: 22, align: 'right' });
        txt('Time', 70, y + 102, { col: COL.light, shadow: '#383838', size: 22 }); txt(fmtTime(save.playFrames), 440, y + 102, { col: COL.light, shadow: '#383838', size: 22, align: 'right' });
        txt(mapNameOf(save.map), 70, y + 128, { col: COL.light, shadow: '#383838', size: 22 });
        save.party.slice(0, 6).forEach((p, j) => drawIcon(p, 62 + j * 62, y + 160, false, 0.9));
        y += 226;
      } else {
        ctx.drawImage(lp, 0, sel ? 490 : 444, 408, 46, 52, y, 408, 46);
        txt(label[o], 76, y + 15, { col: COL.light, shadow: '#383838', size: 24 });
        y += save ? 49 : 56;
      }
    });
    if (G.fade) { ctx.fillStyle = 'rgba(0,0,0,' + G.fade + ')'; }
  };
  G.fade = 0;
  while (true) {
    const choice = yield* withDraw(draw, (function* () {
      while (true) {
        yield;
        if (rep('up')) { idx = (idx + opts.length - 1) % opts.length; sfx('cursor'); }
        if (rep('down')) { idx = (idx + 1) % opts.length; sfx('cursor'); }
        if (ok()) { sfx('ok'); return opts[idx]; }
      }
    })());
    if (choice === 'options') { yield* optionsScreen(); continue; }
    if (choice === 'transfer') { const imported = yield* saveFileMenu(draw); if (imported) { refresh(); idx = 0; } continue; }
    stopBGM(); G.fade = 0;
    if (choice === 'continue') { loadSave(save); G.started = true; return; }
    enterMap(START.map, START.x, START.y, START.dir); G.started = true; return;
  }
}

// ------------------------------------------------------------ Pokémon Storage System (port of Essentials' PokemonStorageScene / Screen)
const PCB = { W: 6, H: 5, SIZE: 30 };
function pcImg(n) { return img('pictures', 'storage/' + n); }
function pcWin(x, y, w, h) { skinBox('skin_choice_1', x, y, w, h); }
// the storage "PC" menu list with a help text box (pbShowCommandsWithHelp)
function* pcMenuList(lines, descs, idx0 = 0) {
  let idx = idx0;
  const w = Math.max(...lines.map(l => txtW(l, 26))) + 64;
  return yield* withDraw(() => {
    pcWin(0, 0, w, lines.length * 32 + 32);
    lines.forEach((l, i) => { txt(l, 40, 16 + i * 32 + 4, { size: 26 }); if (i === idx) pic('selarrow', 22, 16 + i * 32); });
    pic('battle/overlay_message', 0, SH - 96);
    wrap(descs[idx] || '', 456, 26).forEach((ln, i) => txt(ln, 30, SH - 96 + 28 + i * 32, { base: '#404040', shadow: '#b8b8b8', size: 26 }));
    drawUiMsg();
  }, (function* () {
    while (true) {
      yield;
      if (rep('up')) { idx = (idx + lines.length - 1) % lines.length; sfx('cursor'); }
      if (rep('down')) { idx = (idx + 1) % lines.length; sfx('cursor'); }
      if (ok()) { sfx('ok'); return idx; }
      if (back()) { sfx('back'); return -1; }
    }
  })());
}
function pcAbleCount() { return G.party.filter(p => p.hp > 0).length; }
function* pcSession() {
  pcInit();
  yield* withDraw(() => { drawUiMsg(); }, uiMessage('The Pokémon Storage System was opened.', { noWait: false }));
  let cmd = 0;
  while (true) {
    cmd = yield* pcMenuList(['Organize Boxes', 'Withdraw Pokémon', 'Deposit Pokémon', 'See ya!'],
      ['Organize the Pokémon in Boxes and in your party.', 'Move Pokémon stored in Boxes to your party.', 'Store Pokémon in your party in Boxes.', 'Return to the previous menu.'], Math.max(cmd, 0));
    if (cmd < 0 || cmd === 3) break;
    if (cmd === 1 && G.party.length >= 6) { yield* withDraw(drawUiMsg, uiMessage('Your party is full!')); continue; }
    if (cmd === 2 && pcAbleCount() <= 1) { yield* withDraw(drawUiMsg, uiMessage("Can't deposit the last Pokémon!")); continue; }
    yield* fadeTo(1, 8);
    yield* pcStorageScreen(cmd);
    yield* fadeTo(0, 8);
  }
}

// ------------------------------------------------------------ Player's PC: Item Storage (pbPCItemStorage)
function pcItemsInit() { if (!G.pcItems) G.pcItems = { POTION: 1 }; }
// scrollable list of the PC's items; returns the chosen key or null
function* pcItemPick(title, keys) {
  let idx = 0, scroll = 0;
  return yield* withDraw(() => {
    pic('loadbg', 0, 0);
    skinBox('skin_choice_1', 150, 8, SW - 158, 8 * 32 + 24);
    for (let r = 0; r < 8; r++) { const i = scroll + r; if (i > keys.length) break; const y = 22 + r * 32;
      if (i === keys.length) { txt('CANCEL', 190, y + 4, { size: 24 }); } else { txt(itemInfo(keys[i]).name, 190, y + 4, { size: 24 }); txt('×' + G.pcItems[keys[i]], 480, y + 4, { align: 'right', size: 22 }); }
      if (i === idx) pic('selarrow', 166, y + 2); }
    pic('battle/overlay_message', 0, SH - 96);
    const k = keys[idx]; if (k) { drawItemIcon(k, 12, SH - 80); wrap(itemInfo(k).desc, 400, 24).slice(0, 3).forEach((l, i) => txt(l, 76, SH - 96 + 20 + i * 26, { base: '#404040', shadow: '#b8b8b8', size: 24 })); }
    txt(title, 12, 12, { base: '#f8f8f8', shadow: '#404040', size: 22 });
    drawUiMsg();
  }, (function* () {
    while (true) { yield;
      if (rep('up')) { idx = (idx + keys.length) % (keys.length + 1); sfx('cursor'); }
      if (rep('down')) { idx = (idx + 1) % (keys.length + 1); sfx('cursor'); }
      if (idx < scroll) scroll = idx; if (idx > scroll + 7) scroll = idx - 7;
      if (back()) { sfx('back'); return null; }
      if (ok()) { sfx('ok'); return idx >= keys.length ? null : keys[idx]; } }
  })());
}
function* pcQty(max, text) {
  let n = 1;
  return yield* withDraw(() => {
    drawUiMsg(); skinBox('skin_choice_1', SW - 150, SH - 96 - 56, 150, 56); txt('×' + String(n).padStart(3, ' '), SW - 130, SH - 96 - 56 + 14, { size: 26 });
  }, (function* () {
    G.uiMsg = null; yield* uiMessage(text, { noWait: true });
    while (true) { yield;
      if (rep('up')) n = n >= max ? 1 : n + 1; if (rep('down')) n = n <= 1 ? max : n - 1;
      if (rep('right')) n = Math.min(max, n + 10); if (rep('left')) n = Math.max(1, n - 10);
      if (ok()) { sfx('ok'); G.uiMsg = null; return n; } if (back()) { sfx('back'); G.uiMsg = null; return 0; } }
  })());
}
function* pcItemStorage() {
  pcItemsInit(); let cmd = 0;
  while (true) {
    cmd = yield* pcMenuList(['Withdraw Item', 'Deposit Item', 'Toss Item', 'Exit'],
      ['Take out items from the PC.', 'Store items in the PC.', 'Throw away items stored in the PC.', 'Go back to the previous menu.'], Math.max(cmd, 0));
    if (cmd < 0 || cmd === 3) break;
    const say = m => withDraw(drawUiMsg, uiMessage(m));
    if (cmd === 1) {
      const key = yield* bagScreen({ mode: 'give' }); if (!key) continue;
      const it = itemInfo(key);
      if (it.pocket === 8) { yield* say('The ' + it.name + " can't be stored at the PC."); continue; }
      let q = G.items[key]; if (q > 1) q = yield* pcQty(q, 'How many ' + it.name + ' do you want to deposit?'); if (!q) continue;
      G.items[key] -= q; if (G.items[key] <= 0) delete G.items[key]; G.pcItems[key] = (G.pcItems[key] || 0) + q;
      yield* say('Deposited ' + q + ' ' + it.name + '.');
    } else {
      const keys = Object.keys(G.pcItems).filter(k => G.pcItems[k] > 0);
      if (!keys.length) { yield* say('There are no items.'); continue; }
      while (true) {
        const ks = Object.keys(G.pcItems).filter(k => G.pcItems[k] > 0); if (!ks.length) break;
        const key = yield* pcItemPick(cmd === 0 ? 'Withdraw which item?' : 'Toss which item?', ks); if (!key) break;
        const it = itemInfo(key); let q = G.pcItems[key];
        if (cmd === 0) {
          if ((G.items[key] || 0) >= 99) { yield* say("There's no more room in the Bag."); continue; }
          q = Math.min(q, 99 - (G.items[key] || 0));
          if (q > 1) q = yield* pcQty(q, 'How many ' + it.name + ' do you want to withdraw?'); if (!q) continue;
          G.pcItems[key] -= q; if (G.pcItems[key] <= 0) delete G.pcItems[key]; G.items[key] = (G.items[key] || 0) + q;
          yield* say('Withdrew ' + q + ' ' + it.name + '.');
        } else {
          if (q > 1) q = yield* pcQty(q, 'How many ' + it.name + ' do you want to toss?'); if (!q) continue;
          const yes = (yield* withDraw(drawUiMsg, (function* () { yield* uiMessage('Is it OK to throw away ' + q + ' ' + it.name + '?', { noWait: true }); const r = yield* yesNo(); G.uiMsg = null; return r; })()));
          if (!yes) continue;
          G.pcItems[key] -= q; if (G.pcItems[key] <= 0) delete G.pcItems[key];
          yield* say('Threw away ' + q + ' ' + it.name + '.');
        }
      }
    }
  }
}
const WALLPAPER_N = 40;
function pcDrawMark(on, i, x, y) { const im = pcImg('markings'); if (im) ctx.drawImage(im, i * 16, on * 16, 16, 16, x, y, 16, 16); }
function pcDrawMarks(m, x, y) { for (let i = 0; i < 6; i++) pcDrawMark(m.marks && m.marks[i] ? 1 : 0, i, x + i * 16, y); }
function* pcStorageScreen(command) {
  const PC = G.pc; const st = { sel: 0, partySel: 0, held: null, heldBack: null, partyY: command === 2 ? SH - 352 : SH, boxX: 184, slide: null, popup: null, msg: null, hand: 0, grab: 0, place: 0, rel: 0, relMon: null, inParty: command === 2, boxName: false };
  const curBox = () => PC.boxes[PC.cur];
  const handPos = () => {
    if (st.inParty) { const i = st.partySel; if (i >= 6) return [236, 220]; return [200 + 72 * (i % 2), 2 + 16 * (i % 2) + 64 * Math.floor(i / 2)]; }
    const s = st.sel;
    if (s === -1) return [314, -24]; if (s === -2) return [238, 278]; if (s === -3) return [414, 278];
    return [194 + 48 * (s % PCB.W), 16 + 48 * Math.floor(s / PCB.W)];
  };
  const selMon = () => st.held || (st.inParty ? G.party[st.partySel] : (st.sel >= 0 ? curBox().mons[st.sel] : null));
  const drawBox = (bi, x) => {
    const b = PC.boxes[bi]; const bg = pcImg('box_' + b.bg) || pcImg('box_0'); if (bg) ctx.drawImage(bg, x, 18);
    const nm = b.name; txt(nm, x + 162, 18 + 14, { align: 'center', base: '#f8f8f8', shadow: '#283030', size: 22 });
    for (let j = 0; j < PCB.H; j++) for (let k = 0; k < PCB.W; k++) { const m = b.mons[j * PCB.W + k]; if (m) drawIcon(m, x + 10 + 48 * k, 18 + 30 + 48 * j, false); }
  };
  const draw = () => {
    const bgim = pcImg('bg'); if (bgim) ctx.drawImage(bgim, 0, 0); else { ctx.fillStyle = '#3070d8'; ctx.fillRect(0, 0, SW, SH); }
    if (st.slide) { drawBox(st.slide.from, st.slide.fx); drawBox(st.slide.to, st.slide.tx); } else drawBox(PC.cur, st.boxX);
    const om = pcImg('overlay_main'); if (om) ctx.drawImage(om, 0, 0);
    const bt = ['#f8f8f8', '#505050'];
    txt('Party: ' + G.party.length, 270, 334, { align: 'center', base: bt[0], shadow: bt[1], size: 22 }); txt('Exit', 446, 334, { align: 'center', base: bt[0], shadow: bt[1], size: 22 });
    const m = selMon();
    if (m) {
      const base = '#585850', sh = '#a8b8b8', sp = D.SP[m.sym];
      txt(pokeName(m), 10, 14, { base, shadow: sh, size: 22 });
      if (m.gender !== 2) txt(genderSym(m.gender), 148, 14, { base: m.gender === 0 ? '#1870d8' : '#f83820', shadow: m.gender === 0 ? '#88a8d0' : '#e09890', size: 22 });
      const lv = pcImg('overlay_lv'); if (lv) ctx.drawImage(lv, 6, 246);
      pcDrawMarks(m, 70, 240);
      txt(m.lvl, 28, 240, { base, shadow: sh, size: 22 });
      const ab = D.AB && D.AB[m.ability]; txt(ab ? ab.name : (m.ability || 'No ability'), 86, 312, { align: 'center', base: ab || m.ability ? base : '#d0d0d0', shadow: ab || m.ability ? sh : '#e0e0e0', size: 22 });
      txt(m.item ? ((typeof itemInfo === 'function' && itemInfo(m.item).name) || itemName(m.item)) : 'No item', 86, 348, { align: 'center', base: m.item ? base : '#d0d0d0', shadow: m.item ? sh : '#e0e0e0', size: 22 });
      sp.types.forEach((t, i) => drawTypeIcon(t, sp.types.length === 1 ? 52 : 18 + 70 * i, 272));
      const bim = img('battlers', String(sp.id).padStart(3, '0')); if (bim) drawFitted(bim, 10, 66, 160, 136, String(sp.id));
    }
    // party tab
    if (st.partyY < SH) {
      const op = pcImg('overlay_party'); if (op) ctx.drawImage(op, 182, st.partyY);
      txt('Back', 182 + 86, st.partyY + 248, { align: 'center', base: '#f8f8f8', shadow: '#505050', size: 22 });
      G.party.forEach((p, i) => { if (st.held && st.held === p) return; drawIcon(p, 182 + 18 + 72 * (i % 2), st.partyY + 2 + 16 * (i % 2) + 64 * Math.floor(i / 2), false); });
    }
    // hand
    let [hx, hy] = handPos(); let hand;
    if (st.grab > 0 || st.place > 0) { hy += st.grab > 0 ? (st.grab <= 4 ? st.grab * 4 : (8 - st.grab) * 4) : (st.place <= 4 ? st.place * 4 : (8 - st.place) * 4); hand = st.grab > 0 ? (st.grab <= 4 ? 'grab' : 'fist') : (st.place <= 4 ? 'fist' : 'grab'); }
    else if (st.held) hand = 'fist'; else hand = (st.hand % 40 < 20) ? 'point_1' : 'point_2';
    if (st.held) drawIcon(st.held, hx, hy + 16, false);
    if (st.rel > 0) { const k = st.rel / 30; ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(hx + 32, hy + 48); ctx.scale(1 - k, 1 - k); drawIcon(st.relMon, -32, -32 - 16, false); ctx.restore(); }
    const hi = pcImg('cursor_' + hand); if (hi) ctx.drawImage(hi, hx, hy);
    // marking popup
    if (st.mark) {
      const mb = pcImg('overlay_marking'); if (mb) ctx.drawImage(mb, 292, 68);
      for (let i = 0; i < 6; i++) pcDrawMark(st.mark.marks[i] ? 1 : 0, i, 336 + 58 * (i % 3), 106 + 50 * Math.floor(i / 3));
      txt('OK', 402, 216, { align: 'center', base: '#f8f8f8', shadow: '#505050', size: 22 }); txt('Cancel', 402, 280, { align: 'center', base: '#f8f8f8', shadow: '#505050', size: 22 });
      const ax = [162, 191, 220, 162, 191, 220, 184, 184][st.mark.idx] * 2, ay = [24, 24, 24, 49, 49, 49, 77, 109][st.mark.idx] * 2;
      const ph = pcImg('cursor_point_' + ((st.hand % 40 < 20) ? 1 : 2)); if (ph) ctx.drawImage(ph, ax, ay);
      pcWin(180, SH - 64, SW - 180, 64); txt('Mark your Pokémon.', 200, SH - 64 + 16 + 4, { size: 26 });
    }
    // popups
    const P = st.popup;
    if (P) {
      const msgLines = wrap(P.msg || '', 332 - 40, 26), mh = msgLines.length * 32 + 32;
      let top = SH - mh;
      if (P.cmds) { const cw = Math.max(...P.cmds.map(l => txtW(l, 26))) + 64, chh = P.cmds.length * 32 + 32; pcWin(SW - cw, top - chh, cw, chh); P.cmds.forEach((l, i) => { txt(l, SW - cw + 40, top - chh + 16 + i * 32 + 4, { size: 26 }); if (i === P.idx) pic('selarrow', SW - cw + 22, top - chh + 16 + i * 32); }); }
      if (P.list) {
        const lw = 300, rows = Math.min(7, P.list.length), chh = rows * 32 + 32; pcWin(SW - lw, top - chh, lw, chh);
        const first = Math.max(0, Math.min(P.idx - 3, P.list.length - rows));
        for (let r = 0; r < rows; r++) { const li = first + r; txt(P.list[li], SW - lw + 40, top - chh + 16 + r * 32 + 4, { size: 26 }); if (li === P.idx) pic('selarrow', SW - lw + 22, top - chh + 16 + r * 32); }
      }
      pcWin(180, top, SW - 180, mh); msgLines.forEach((ln, i) => txt(ln, 200, top + 16 + i * 32 + 4, { size: 26 }));
    }
  };
  const frame = function* (n = 1) { for (let i = 0; i < n; i++) { st.hand++; yield; } };
  const display = function* (msg) { st.popup = { msg }; yield; while (true) { yield* frame(); if (ok() || back()) { sfx(ok() ? 'ok' : 'back'); break; } } st.popup = null; };
  const showCommands = function* (msg, cmds, idx = 0) {
    st.popup = { msg, cmds, idx };
    while (true) { yield* frame();
      if (rep('up')) { st.popup.idx = (st.popup.idx + cmds.length - 1) % cmds.length; sfx('cursor'); }
      if (rep('down')) { st.popup.idx = (st.popup.idx + 1) % cmds.length; sfx('cursor'); }
      if (ok()) { sfx('ok'); const r = st.popup.idx; st.popup = null; return r; }
      if (back()) { sfx('back'); st.popup = null; return -1; } }
  };
  const confirm = function* (msg) { return (yield* showCommands(msg, ['Yes', 'No'])) === 0; };
  const chooseList = function* (msg, list, idx = 0) {
    st.popup = { msg, list, idx };
    while (true) { yield* frame();
      if (rep('up')) { st.popup.idx = (st.popup.idx + list.length - 1) % list.length; sfx('cursor'); }
      if (rep('down')) { st.popup.idx = (st.popup.idx + 1) % list.length; sfx('cursor'); }
      if (ok()) { sfx('ok'); const r = st.popup.idx; st.popup = null; return r; }
      if (back()) { sfx('back'); st.popup = null; return -1; } }
  };
  const slideBox = function* (to, dir) {  // dir 1: new box comes from the right
    const from = PC.cur; st.slide = { from, to, fx: 184, tx: dir > 0 ? 520 : -152 };
    while (true) { yield; st.slide.fx -= 32 * dir; st.slide.tx -= 32 * dir; if (dir > 0 ? st.slide.tx <= 184 : st.slide.tx >= 184) break; }
    st.slide = null; PC.cur = to;
  };
  const doGrab = function* () { for (st.grab = 1; st.grab <= 8; st.grab++) yield; st.grab = 0; };
  const doPlace = function* () { for (st.place = 1; st.place <= 8; st.place++) yield; st.place = 0; };
  const heal = p => { if (p) healMon(p); };
  // --- actions (pbWithdraw / pbStore / pbHold / pbPlace / pbSwap / pbRelease)
  const firstFree = (bi) => PC.boxes[bi].mons.findIndex(m => !m);
  const act = {
    *withdraw(src) {
      if (G.party.length >= 6) { yield* display("Your party's full!"); return; }
      const mon = curBox().mons[src]; curBox().mons[src] = null; st.held = mon; yield* doGrab(); st.held = null; heal(mon); G.party.push(mon); yield* doPlace();
    },
    *store(pi) {
      const mon = G.party[pi];
      if (pcAbleCount() <= 1 && mon.hp > 0 && !st.held) { sfx('buzzer'); yield* display("That's your last Pokémon!"); return; }
      const names = PC.boxes.map((b, i) => b.name + ' (' + b.mons.filter(Boolean).length + '/' + PCB.SIZE + ')');
      while (true) {
        const dest = yield* chooseList('Deposit in which Box?', names, PC.cur); if (dest < 0) return;
        const ff = firstFree(dest); if (ff < 0) { yield* display('The Box is full.'); continue; }
        st.held = mon; G.party.splice(pi, 1); yield* doGrab(); heal(mon); PC.boxes[dest].mons[ff] = mon; st.held = null; yield* doPlace();
        st.partySel = Math.min(st.partySel, Math.max(0, G.party.length - 1));
        return;
      }
    },
    *hold(box, i) {
      if (box === -1) { const m = G.party[i]; if (m.hp > 0 && pcAbleCount() <= 1) { sfx('buzzer'); yield* display("That's your last Pokémon!"); return; } st.held = m; G.party.splice(i, 1); st.heldBack = -1; }
      else { st.held = curBox().mons[i]; curBox().mons[i] = null; }
      yield* doGrab();
    },
    *place(box, i) {
      if (box === -1) { heal(st.held); G.party.splice(Math.min(i, G.party.length), 0, st.held); } else { heal(st.held); curBox().mons[i] = st.held; }
      st.held = null; yield* doPlace();
    },
    *swap(box, i) {
      const h = st.held;
      if (box === -1) { const other = G.party[i]; if (other.hp > 0 && pcAbleCount() <= 1 && h.hp <= 0) { sfx('buzzer'); yield* display("That's your last Pokémon!"); return; } heal(h); G.party[i] = h; st.held = other; }
      else { heal(h); const other = curBox().mons[i]; curBox().mons[i] = h; st.held = other; }
      yield* doGrab(); yield* doPlace(); st.held = st.held; // (stays held)
      st.grab = 0; st.place = 0;
    },
    *release(box, i) {
      const mon = st.held || (box === -1 ? G.party[i] : curBox().mons[i]); if (!mon) return;
      if (box === -1 && !st.held && pcAbleCount() <= 1 && mon.hp > 0) { sfx('buzzer'); yield* display("That's your last Pokémon!"); return; }
      if ((yield* showCommands('Release this Pokémon?', ['No', 'Yes'])) !== 1) return;
      const nm = pokeName(mon); st.relMon = mon;
      if (st.held) st.held = null; else if (box === -1) G.party.splice(i, 1); else curBox().mons[i] = null;
      for (st.rel = 1; st.rel <= 30; st.rel++) yield; st.rel = 0; st.relMon = null;
      yield* display(nm + ' was released.'); yield* display('Bye-bye, ' + nm + '!');
      st.partySel = Math.min(st.partySel, Math.max(0, G.party.length - 1));
    },
  };
  const monAt = (box, i) => st.held || (box === -1 ? G.party[i] : curBox().mons[i]);
  const markMon = function* (box, i) {
    const mon = monAt(box, i); if (!mon) return;
    const marks = (mon.marks || [0, 0, 0, 0, 0, 0]).slice(); st.mark = { marks, idx: 0 };
    const M = st.mark; while (true) {
      yield* frame();
      const key = rep('down') ? 'down' : rep('right') ? 'right' : rep('left') ? 'left' : rep('up') ? 'up' : null;
      if (key) {
        let s = M.idx, o = s;
        if (key === 'left') { if (s < 6) { s--; if (s % 3 === 2) s += 3; } }
        else if (key === 'right') { if (s < 6) { s++; if (s % 3 === 0) s -= 3; } }
        else if (key === 'up') { if (s === 7) s = 6; else if (s === 6) s = 4; else if (s < 3) s = 7; else s -= 3; }
        else { if (s === 7) s = 1; else if (s === 6) s = 7; else if (s >= 3) s = 6; else s += 3; }
        if (s !== o) sfx('cursor'); M.idx = s; continue;
      }
      if (back()) { sfx('back'); break; }
      if (ok()) { sfx('ok'); if (M.idx === 6) { mon.marks = marks; break; } if (M.idx === 7) break; marks[M.idx] = marks[M.idx] ? 0 : 1; }
    }
    st.mark = null;
  };
  const itemMon = function* (box, i) {
    const mon = monAt(box, i); if (!mon) return;
    if (mon.item) {
      const nm = itemName(mon.item);
      if (yield* confirm('Take this ' + nm + '?')) { G.items[mon.item] = (G.items[mon.item] || 0) + 1; mon.item = null; yield* display('Took the ' + nm + '.'); }
    } else {
      const key = yield* bagScreen({ mode: 'give' });
      if (key) { mon.item = key; G.items[key]--; if (!G.items[key]) delete G.items[key]; yield* display(itemName(key) + ' is now being held.'); }
    }
  };
  const summary = function* (box, i) { const list = st.held ? [st.held] : box === -1 ? G.party : [curBox().mons[i]]; const idx = st.held ? 0 : box === -1 ? i : 0; const keep = G.uiPopup; yield* summaryScreen(list, idx); };
  const boxCommands = function* () {
    const c = yield* showCommands('What do you want to do?', ['Jump', 'Wallpaper', 'Name', 'Cancel']);
    if (c === 0) { const names = PC.boxes.map(b => b.name); const d = yield* chooseList('Jump to which Box?', names, PC.cur); if (d >= 0 && d !== PC.cur) yield* slideBox(d, d > PC.cur ? 1 : -1); }
    else if (c === 1) {
      const names = []; for (let i = 0; i < WALLPAPER_N; i++) names.push('Wallpaper ' + (i + 1));
      const w = yield* chooseList('Pick the wallpaper.', names, curBox().bg); if (w >= 0) curBox().bg = w;
    } else if (c === 2) {
      const nm = yield* promptName('Box name?', curBox().name, 12); if (nm) curBox().name = nm;
    }
  };
  return yield* withDraw(draw, (function* () {
    playSE('PC_open'); yield* fadeTo(0, 8);
    if (command === 2) st.inParty = true;
    // main selection loop
    while (true) {
      yield* frame();
      const m = selMon();
      if (!st.inParty) {
        let moved = false;
        const s0 = st.sel; let s = s0;
        const key = rep('down') ? 'down' : rep('right') ? 'right' : rep('left') ? 'left' : rep('up') ? 'up' : null;
        if (key) {
          sfx('cursor');
          if (key === 'up') { if (s === -1) s = -2; else if (s === -2) s = PCB.SIZE - 1 - Math.floor(PCB.W * 2 / 3); else if (s === -3) s = PCB.SIZE - Math.floor(PCB.W / 3); else { s -= PCB.W; if (s < 0) s = -1; } }
          else if (key === 'down') { if (s === -1) s = Math.floor(PCB.W / 3); else if (s === -2 || s === -3) s = -1; else { s += PCB.W; if (s >= PCB.SIZE) s = s < PCB.SIZE + Math.floor(PCB.W / 2) ? -2 : -3; } }
          else if (key === 'left') { if (s === -1) s = -4; else if (s === -2) s = -3; else if (s === -3) s = -2; else if (s % PCB.W === 0) s += PCB.W - 1; else s--; }
          else { if (s === -1) s = -5; else if (s === -2) s = -3; else if (s === -3) s = -2; else if (s % PCB.W === PCB.W - 1) s -= PCB.W - 1; else s++; }
          if (s === -4) { yield* slideBox((PC.cur + PC.boxes.length - 1) % PC.boxes.length, -1); s = -1; }
          else if (s === -5) { yield* slideBox((PC.cur + 1) % PC.boxes.length, 1); s = -1; }
          st.sel = s; continue;
        }
        if (back()) {
          if (st.held) { sfx('buzzer'); yield* display("You're holding a Pokémon!"); continue; }
          sfx('back'); if (yield* confirm('Continue Box operations?')) continue; break;
        }
        if (!ok()) continue;
        sfx('ok');
        if (st.sel === -3) { if (st.held) { yield* display("You're holding a Pokémon!"); continue; } if (yield* confirm('Exit from the Box?')) { playSE('PC_close'); break; } continue; }
        if (st.sel === -1) { yield* boxCommands(); continue; }
        if (st.sel === -2) {
          if (command === 1) { yield* display('Which one will you take?'); continue; }
          // show party tab
          playSE('GUI_storage_show_party_panel'); while (st.partyY > SH - 352) { st.partyY = Math.max(SH - 352, st.partyY - 24); yield; }
          st.inParty = true; st.partySel = 0; continue;
        }
        const mon = curBox().mons[st.sel]; if (!mon && !st.held) continue;
        {
          const names = command === 1 ? ['Withdraw', 'Summary', 'Mark', 'Release', 'Cancel']
            : st.held ? [mon ? 'Shift' : 'Place', 'Summary', 'Item', 'Mark', 'Release', 'Cancel'] : ['Move', 'Summary', 'Withdraw', 'Item', 'Mark', 'Release', 'Cancel'];
          const c = yield* showCommands(pokeName(st.held || mon) + ' is selected.', names); const name = names[c];
          if (name === 'Move') yield* act.hold(0, st.sel);
          else if (name === 'Shift') yield* act.swap(0, st.sel);
          else if (name === 'Place') yield* act.place(0, st.sel);
          else if (name === 'Summary') yield* summary(0, st.sel);
          else if (name === 'Withdraw') yield* act.withdraw(st.sel);
          else if (name === 'Item') yield* itemMon(0, st.sel);
          else if (name === 'Mark') yield* markMon(0, st.sel);
          else if (name === 'Release') yield* act.release(0, st.sel);
        }
      } else {   // party selection
        const key = rep('down') ? 'down' : rep('right') ? 'right' : rep('left') ? 'left' : rep('up') ? 'up' : null;
        if (key) {
          sfx('cursor'); let s = st.partySel;
          if (key === 'left') { s--; if (s < 0) s = 6; } else if (key === 'right') { s++; if (s > 6) s = 0; }
          else if (key === 'up') { if (s === 6) s = 4; else if (s < 2) { if (command !== 2) { yield* hideParty(); st.inParty = false; st.sel = -1; continue; } } else s -= 2; }
          else { if (s === 6) s = -1; else if (s + 2 >= 6) s = 6; else s += 2; if (s === -1) { s = 6; } }
          st.partySel = s; continue;
        }
        if (back()) {
          sfx('back');
          if (command === 2) { if (yield* confirm('Continue Box operations?')) continue; break; }
          yield* hideParty(); st.inParty = false; st.sel = -2; continue;
        }
        if (!ok()) continue;
        sfx('ok');
        if (st.partySel === 6) {
          if (command === 2) { if (yield* confirm('Exit from the Box?')) { playSE('PC_close'); break; } continue; }
          yield* hideParty(); st.inParty = false; st.sel = -2; continue;
        }
        const mon = G.party[st.partySel];
        {
          if (!mon && !st.held) continue;
          const names = command === 2 ? ['Store', 'Summary', 'Mark', 'Release', 'Cancel']
            : st.held ? [mon ? 'Shift' : 'Place', 'Summary', 'Item', 'Mark', 'Release', 'Cancel'] : ['Move', 'Summary', 'Store', 'Item', 'Mark', 'Release', 'Cancel'];
          const c = yield* showCommands(pokeName(st.held || mon) + ' is selected.', names); const name = names[c];
          if (name === 'Move') yield* act.hold(-1, st.partySel);
          else if (name === 'Shift') yield* act.swap(-1, st.partySel);
          else if (name === 'Place') yield* act.place(-1, st.partySel);
          else if (name === 'Summary') yield* summary(-1, st.partySel);
          else if (name === 'Store') yield* act.store(st.partySel);
          else if (name === 'Item') yield* itemMon(-1, st.partySel);
          else if (name === 'Mark') yield* markMon(-1, st.partySel);
          else if (name === 'Release') yield* act.release(-1, st.partySel);
        }
      }
    }
    G.pc.cur = PC.cur;
  })());
  function* hideParty() { playSE('GUI_storage_hide_party_panel'); while (st.partyY < SH) { st.partyY = Math.min(SH, st.partyY + 24); yield; } }
}
