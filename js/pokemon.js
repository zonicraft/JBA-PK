'use strict';
// ===================================================================
//  Pokémon data model (Essentials-style): stats, natures, exp, moves, items
// ===================================================================
const D = window.DATA;
const STAT_NAMES = ['HP', 'Attack', 'Defense', 'Speed', 'Sp. Atk', 'Sp. Def'];   // PBS order
const NATURES = [
  ['Hardy'], ['Lonely', 1, 2], ['Brave', 1, 3], ['Adamant', 1, 4], ['Naughty', 1, 5],
  ['Bold', 2, 1], ['Docile'], ['Relaxed', 2, 3], ['Impish', 2, 4], ['Lax', 2, 5],
  ['Timid', 3, 1], ['Hasty', 3, 2], ['Serious'], ['Jolly', 3, 4], ['Naive', 3, 5],
  ['Modest', 4, 1], ['Mild', 4, 2], ['Quiet', 4, 3], ['Bashful'], ['Rash', 4, 5],
  ['Calm', 5, 1], ['Gentle', 5, 2], ['Sassy', 5, 3], ['Careful', 5, 4], ['Quirky']];
const rnd = n => Math.floor(Math.random() * n);

function expFor(growth, n) {
  switch (growth) {
    case 'Fast': return Math.floor(4 * n * n * n / 5);
    case 'Slow': return Math.floor(5 * n * n * n / 4);
    case 'Parabolic': return Math.max(0, Math.floor(6 * n * n * n / 5 - 15 * n * n + 100 * n - 140));
    case 'Erratic':
      if (n <= 50) return Math.floor(n * n * n * (100 - n) / 50);
      if (n <= 68) return Math.floor(n * n * n * (150 - n) / 100);
      if (n <= 98) return Math.floor(n * n * n * Math.floor((1911 - 10 * n) / 3) / 500);
      return Math.floor(n * n * n * (160 - n) / 100);
    case 'Fluctuating':
      if (n <= 15) return Math.floor(n * n * n * (Math.floor((n + 1) / 3) + 24) / 50);
      if (n <= 36) return Math.floor(n * n * n * (n + 14) / 50);
      return Math.floor(n * n * n * (Math.floor(n / 2) + 32) / 50);
    default: return n * n * n;
  }
}
const MAXLEVEL = 100;
function femaleChance(rate) {
  return { AlwaysMale: 0, AlwaysFemale: 1, Genderless: -1, FemaleOneEighth: 0.125, Female25Percent: 0.25, Female50Percent: 0.5, Female75Percent: 0.75, FemaleSevenEighths: 0.875 }[rate] ?? 0.5;
}
function moveData(id) { return D.MV[id]; }
function newMoveSlot(id) { const m = D.MV[id]; return { id, pp: m ? m.pp : 10, ppup: 0 }; }
function maxPP(slot) { const m = D.MV[slot.id]; return m ? Math.floor(m.pp * (5 + slot.ppup) / 5) : 0; }

function calcStats(p) {
  const sp = D.SP[p.sym], n = NATURES[p.nature] || NATURES[12];
  const st = [];
  for (let i = 0; i < 6; i++) {
    const base = sp.base[i], iv = p.ivs[i], ev = p.evs[i];
    if (i === 0) st.push(Math.floor((2 * base + iv + Math.floor(ev / 4)) * p.lvl / 100) + p.lvl + 10);
    else {
      let v = Math.floor((2 * base + iv + Math.floor(ev / 4)) * p.lvl / 100) + 5;
      if (n[1] === i) v = Math.floor(v * 1.1); else if (n[2] === i) v = Math.floor(v * 0.9);
      st.push(v);
    }
  }
  return st;
}
function refreshStats(p) {
  const old = p.maxhp || 0; p.stats = calcStats(p); p.maxhp = p.stats[0];
  if (old) p.hp = Math.min(p.maxhp, p.hp + (p.maxhp - old)); // keeps the missing HP the same on level up
}
function learnsetMoves(sym, lvl) {
  const sp = D.SP[sym]; const out = [];
  for (const [l, mv] of sp.moves) { if (l <= lvl && !out.includes(mv)) out.push(mv); }
  return out.slice(-4);
}
function mkPoke(sym, lvl, o = {}) {
  const sp = D.SP[sym];
  const p = {
    sym, name: sp.name, lvl, exp: 0, ivs: [0, 1, 2, 3, 4, 5].map(() => rnd(32)), evs: [0, 0, 0, 0, 0, 0],
    nature: rnd(25), hp: 1, maxhp: 0, status: null, sleep: 0, item: null, ball: 0, happy: sp.happy,
    ot: o.ot || G.name || 'Jorge', otid: o.otid || (o.ot && o.ot !== G.name ? 10000 + rnd(55000) : (G.trainerId || 10000 + rnd(55000))), met: o.met || 'Pallet Town', metLvl: lvl,
    shiny: false, nick: null, ability: null,
  };
  const fc = femaleChance(sp.gender); p.gender = fc < 0 ? 2 : (Math.random() < fc ? 1 : 0);  // 0 male 1 female 2 none
  p.exp = expFor(sp.growth, lvl);
  const abl = sp.abilities.filter(Boolean); p.ability = abl[rnd(abl.length)] || null;
  const mvs = o.moves || learnsetMoves(sym, lvl); p.moves = mvs.map(newMoveSlot);
  if (o.nature !== undefined) p.nature = o.nature;
  refreshStats(p); p.hp = p.maxhp;
  return p;
}
const makeMon = (sym, lvl) => mkPoke(sym, lvl);
function healMon(p) { p.hp = p.maxhp; p.status = null; p.sleep = 0; p.moves.forEach(m => m.pp = maxPP(m)); }
function pokeName(p) { return p.nick || p.name; }
function pokeTypes(p) { return D.SP[p.sym].types; }
function expToNext(p) { return p.lvl >= MAXLEVEL ? 0 : expFor(D.SP[p.sym].growth, p.lvl + 1) - p.exp; }

// type effectiveness
function typeMul(atkType, defTypes) {
  let m = 1;
  for (const dt of defTypes) {
    const t = D.TYPES.find(x => x.key === dt); if (!t) continue;
    if (t.i.includes(atkType)) m *= 0; else if (t.w.includes(atkType)) m *= 2; else if (t.r.includes(atkType)) m *= 0.5;
  }
  return m;
}
const typeIndex = key => Math.max(0, D.TYPES.findIndex(t => t.key === key));
const typeName = key => (D.TYPES.find(t => t.key === key) || { name: '???' }).name;

// items
function itemInfo(key) {
  const i = D.IT[key]; if (i) return i;
  const extra = { OAKSPARCEL: { name: "Geso's Parcel", plural: "Geso's Parcels", pocket: 8, price: 0, desc: 'A parcel for Geso, to be delivered.', field: 0, battle: 0 } };
  return extra[key] || { name: key, plural: key, pocket: 8, price: 0, desc: '', field: 0, battle: 0 };
}
itemName = k => itemInfo(k).name;
function itemLabel(k) { const it = itemInfo(k), mv = it.move && D.MV[it.move]; return mv ? it.name + ' ' + mv.name : it.name; }
const POCKETS = ['Items', 'Medicine', 'Poké Balls', 'TMs & HMs', 'Berries', 'Mail', 'Battle Items', 'Key Items'];

// gain exp / level up. Returns [{lvl, oldStats, newStats, moves:[ids]}]
function gainExp(p, amt) {
  const res = [];
  if (p.lvl >= MAXLEVEL) return res;
  p.exp += amt;
  const g = D.SP[p.sym].growth;
  while (p.lvl < MAXLEVEL && p.exp >= expFor(g, p.lvl + 1)) {
    const old = p.stats.slice(); p.lvl++;
    refreshStats(p);
    const learn = D.SP[p.sym].moves.filter(([l, m]) => l === p.lvl).map(x => x[1]);
    res.push({ lvl: p.lvl, old, now: p.stats.slice(), learn }); p.evoCheck = true;
  }
  return res;
}
function applyEvs(p, foeSym) {
  const y = D.SP[foeSym].ev; let tot = p.evs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 6; i++) { const add = Math.min(y[i], 255 - p.evs[i], 510 - tot); if (add > 0) { p.evs[i] += add; tot += add; } }
}
function gainedExp(foe, isTrainer) {
  const sp = D.SP[foe.sym];
  return Math.max(1, Math.floor(sp.baseexp * foe.lvl / 5 * (isTrainer ? 1.5 : 1)));
}
function hasUsable(party) { return party.some(p => p.hp > 0); }

// ---- evolutions. D.SP[sym].evo = "TARGET,Level,24[,TARGET2,Level,30]" (Essentials format); only Level is supported
function evoTarget(p) {
  const e = (D.SP[p.sym].evo || '').split(',').map(x => x.trim()); if (e.length < 3) return null;
  for (let i = 0; i + 2 < e.length; i += 3) if (e[i + 1] === 'Level' && D.SP[e[i]] && p.lvl >= parseInt(e[i + 2], 10)) return e[i];
  return null;
}
