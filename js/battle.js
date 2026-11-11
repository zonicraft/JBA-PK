'use strict';
// ===================================================================
//  Battle system — Pokémon Essentials look & flow (single battles)
// ===================================================================
const STAGE_NAMES = { 1: 'Attack', 2: 'Defense', 3: 'Speed', 4: 'Sp. Atk', 5: 'Sp. Def', 6: 'accuracy', 7: 'evasiveness' };
const stageMul = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
const accMul = s => s >= 0 ? (3 + s) / 3 : 3 / (3 - s);
const TYPE_COLORS = { NORMAL: '#a8a878', FIGHTING: '#c03028', FLYING: '#a890f0', POISON: '#a040a0', GROUND: '#e0c068', ROCK: '#b8a038', BUG: '#a8b820', GHOST: '#705898', STEEL: '#b8b8d0', FIRE: '#f08030', WATER: '#6890f0', GRASS: '#78c850', ELECTRIC: '#f8d030', PSYCHIC: '#f85888', ICE: '#98d8d8', DRAGON: '#7038f8', DARK: '#705848', FAIRY: '#ee99ac', QMARKS: '#68a090' };
// stat-stage move effects by function code
const STAGE_FX = {
  '01C': ['u', [[1, 1]]], '01D': ['u', [[2, 1]]], '01E': ['u', [[2, 1]]], '01F': ['u', [[3, 1]]], '020': ['u', [[4, 1]]], '021': ['u', [[5, 1]]], '022': ['u', [[7, 1]]],
  '024': ['u', [[1, 1], [2, 1]]], '025': ['u', [[1, 1], [2, 1], [6, 1]]], '026': ['u', [[1, 1], [3, 1]]], '027': ['u', [[1, 1], [4, 1]]], '028': ['u', [[1, 1], [4, 1]]], '029': ['u', [[1, 1], [6, 1]]],
  '02A': ['u', [[2, 1], [5, 1]]], '02B': ['u', [[4, 1], [5, 1], [3, 1]]], '02C': ['u', [[4, 1], [5, 1]]], '02D': ['u', [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]]],
  '02E': ['u', [[1, 2]]], '02F': ['u', [[2, 2]]], '030': ['u', [[3, 2]]], '031': ['u', [[3, 2]]], '032': ['u', [[4, 2]]], '033': ['u', [[5, 2]]], '034': ['u', [[7, 2]]],
  '042': ['t', [[1, -1]]], '043': ['t', [[2, -1]]], '044': ['t', [[3, -1]]], '045': ['t', [[4, -1]]], '046': ['t', [[5, -1]]], '047': ['t', [[6, -1]]], '048': ['t', [[7, -1]]],
  '04B': ['t', [[1, -2]]], '04C': ['t', [[2, -2]]], '04D': ['t', [[3, -2]]], '04E': ['t', [[4, -2]]], '04F': ['t', [[5, -2]]], '050': ['t', [[6, -2]]],
};
const STATUS_FX = { '003': 'SLP', '004': 'SLP', '005': 'PSN', '006': 'PSN', '007': 'PAR', '008': 'PAR', '009': 'PAR', '00A': 'BRN', '00B': 'BRN', '00C': 'FRZ', '00D': 'FRZ' };

const FOE_BASE = { x: 384, y: 190 }, ME_BASE = { x: 128, y: 262 };
const BOX_FOE = { x: -16, y: 36, base: 16 }, BOX_ME = { x: SW - 260, y: SH - 192, base: 34 };

function newSide() { return { age: 0, hurt: false, moved: false, lastHit: null, recharge: false, chain: 0, echo: 0, st: [0, 0, 0, 0, 0, 0, 0, 0], protect: false, protectN: 0, flinch: false, gone: false }; }
function bgFor(mapId) {
  if (G.surfing && G.player && typeof isWaterAt === 'function' && isWaterAt(G.player.x, G.player.y)) return 'Water';     // battles started while sailing use the water background
  const m = window.MAPS && MAPS[mapId], ts = m ? m.tileset : 1;
  if ([7, 87, 100, 171].includes(mapId)) return 'City';
  if (mapId === 48) return 'Forest';
  if ([6, 23, 24].includes(ts)) return 'Cave';     // caves (23 / 24: the Seafoam floors with currents)
  if (ts === 14) return 'IndoorB';
  if ([3, 4, 5, 18, 25].includes(ts)) return 'IndoorA';
  return 'Field';
}
function newSpr() { return { x: 0, y: 0, a: 1, sc: 1, vis: false, tint: 0, shk: 0, dx: 0, dy: 0 }; }
function mkBattle(o) {
  const B = G.battle = {
    kind: o.kind, trainer: o.trainer || null, foeParty: o.foeParty, meParty: G.party, bg: o.bg || 'Field', bgm: o.bgm, msg: null, menu: null, menuText: '',
    me: null, foe: null, S: [newSide(), newSide()], turn: 0, result: null, intro: 28, transIn: 56, transOut: 0, transType: Math.floor(Math.random() * TRANS_N), snap: (function () { try { return snapshot(); } catch (e) { return null; } })(), runN: 0, participants: new Set(),
    meHp: 0, foeHp: 0, meExp: 0, fx: [], flash: 0, lvBox: null, lastCmd: 0, lastMove: 0,
    spr: { foe: newSpr(), me: newSpr(), foeTr: { x: 0, vis: false }, meTr: { x: 0, vis: false }, ball: null },
    box: { foe: 0, me: 0 }, endText: o.endText || '',
  };
  return B;
}
const B_ = () => G.battle;
const sideMon = s => s === 0 ? B_().me : B_().foe;
const sprOf = s => s === 0 ? B_().spr.me : B_().spr.foe;

// ------------------------------------------------------------ message + tween helpers
function* bmsg(text, o = {}) {
  const B = B_(); B.menu = null; B.menuText = '';
  const lines = wrap(text, 468, 26);
  const pages = []; for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2));
  for (let pi = 0; pi < pages.length; pi++) {
    const m = B.msg = { lines: pages[pi], shown: 0, total: pages[pi].join('').length, done: false, wait: false };
    while (m.shown < m.total) { m.shown += 2; yield; if (pressed('ok')) m.shown = m.total; }
    m.done = true;
    if (o.pause || pi < pages.length - 1) { m.wait = true; yield; while (!pressed('ok')) yield; sfx('ok'); m.wait = false; }
    else if (o.hold !== 0) { let n = o.hold === undefined ? 26 : o.hold; while (n-- > 0) { yield; if (pressed('ok')) break; } }
  }
}
function* bwait(n) { while (n-- > 0) yield; }
function* tween(obj, to, frames, ease) {
  const from = {}; for (const k in to) from[k] = obj[k] || 0;
  for (let i = 1; i <= frames; i++) { const t = ease ? ease(i / frames) : i / frames; for (const k in to) obj[k] = from[k] + (to[k] - from[k]) * t; yield; }
  for (const k in to) obj[k] = to[k];
}
const easeOut = t => 1 - (1 - t) * (1 - t);
function* animHp(side, target) {
  const B = B_(), key = side === 0 ? 'meHp' : 'foeHp'; const mon = sideMon(side);
  const speed = Math.max(0.6, mon.maxhp / 80);
  while (B[key] !== target) { const d = target - B[key]; B[key] += Math.sign(d) * Math.min(Math.abs(d), speed); yield; }
  yield* bwait(6);
}
function* animExp(from, to) { const B = B_(); B.meExp = from; while (B.meExp < to) { B.meExp = Math.min(to, B.meExp + 0.015); yield; } }
function expRatio(p) { if (p.lvl >= MAXLEVEL) return 1; const g = D.SP[p.sym].growth, a = expFor(g, p.lvl), b = expFor(g, p.lvl + 1); return Math.max(0, Math.min(1, (p.exp - a) / Math.max(1, b - a))); }

// ------------------------------------------------------------ send out / recall
function* sendOut(s) {
  const B = B_(); const mon = sideMon(s); const sp = sprOf(s); const base = s === 0 ? ME_BASE : FOE_BASE;
  B.S[s] = newSide();
  if (B.pass && B.pass.s === s) { Object.assign(B.S[s], B.pass.d); B.pass = null; }
  if (s === 0) { B.participants.add(mon); B.meExp = expRatio(mon); } else B.participants = new Set(B.me ? [B.me] : []);
  B[s === 0 ? 'meHp' : 'foeHp'] = mon.hp;
  const sx = s === 0 ? 70 : SW - 90, sy = s === 0 ? 200 : 110;
  const ball = B.spr.ball = { x: sx, y: sy, open: false, rot: 0, dx: 0, id: mon.ball || 0 };
  sfx('throw');
  const tx = base.x, ty = base.y - 30;
  for (let i = 1; i <= 20; i++) { const t = i / 20; ball.x = sx + (tx - sx) * t; ball.y = sy + (ty - sy) * t - Math.sin(t * Math.PI) * 60; ball.rot += 0.5; yield; }
  ball.open = true; ball.rot = 0; sfx('ballopen'); cry(mon.gender); sp.vis = true; sp.a = 0; sp.sc = 0.1; sp.tint = 1; sp.dx = 0; sp.dy = 0; B.flash = 1;
  for (let i = 1; i <= 16; i++) { const t = i / 16; sp.a = Math.min(1, t * 2); sp.sc = 0.1 + 0.9 * easeOut(t); sp.tint = 1 - t; if (i === 6) B.spr.ball = null; yield; }
  sp.sc = 1; sp.a = 1; sp.tint = 0; B.spr.ball = null;
  yield* tween(B.box, { [s === 0 ? 'me' : 'foe']: 1 }, 10);
  yield* healingWishIn(s);
  yield* applyHazards(s);
  if (B.started && sideMon(s).hp > 0) yield* abilSwitchIn(s);
}
function* recall(s) {
  const B = B_(); const sp = sprOf(s); btRestore(sideMon(s)); yield* abilSwitchOut(s);
  sfx('recall');
  for (let i = 1; i <= 14; i++) { const t = i / 14; sp.tint = t; sp.sc = 1 - 0.9 * t; sp.a = 1 - t; yield; }
  sp.vis = false; sp.tint = 0; sp.sc = 1; sp.a = 1;
  yield* tween(B.box, { [s === 0 ? 'me' : 'foe']: 0 }, 8);
}

// ------------------------------------------------------------ damage / effects
function effStat(s, idx) { const mon = sideMon(s); let v = mon.stats[idx] * stageMul(B_().S[s].st[idx]); if (idx === 3) { if (mon.status === 'PAR' && abilOf(s) !== 'QUICKFEET') v *= 0.5; if (hItem(mon) === 'CHOICESCARF') v *= 1.5; if (team(s).tailwind > 0) v *= 2; v *= abilSpeedMul(s); } return v; }
function moveTypeMul(md, tgt) { return md.type === 'QMARKS' ? 1 : typeMul(md.type, pokeTypes(tgt)); }

// ------------------------------------------------------------ held items
const TYPE_ITEM = { CHARCOAL: 'FIRE', MYSTICWATER: 'WATER', MAGNET: 'ELECTRIC', MIRACLESEED: 'GRASS', NEVERMELTICE: 'ICE', BLACKBELT: 'FIGHTING', POISONBARB: 'POISON', SOFTSAND: 'GROUND', SHARPBEAK: 'FLYING', TWISTEDSPOON: 'PSYCHIC', SILVERPOWDER: 'BUG', HARDSTONE: 'ROCK', SPELLTAG: 'GHOST', DRAGONFANG: 'DRAGON', BLACKGLASSES: 'DARK', METALCOAT: 'STEEL', SILKSCARF: 'NORMAL',
  FLAMEPLATE: 'FIRE', SPLASHPLATE: 'WATER', ZAPPLATE: 'ELECTRIC', MEADOWPLATE: 'GRASS', ICICLEPLATE: 'ICE', FISTPLATE: 'FIGHTING', TOXICPLATE: 'POISON', EARTHPLATE: 'GROUND', SKYPLATE: 'FLYING', MINDPLATE: 'PSYCHIC', INSECTPLATE: 'BUG', STONEPLATE: 'ROCK', SPOOKYPLATE: 'GHOST', DRACOPLATE: 'DRAGON', DREADPLATE: 'DARK', IRONPLATE: 'STEEL', PIXIEPLATE: 'FAIRY',
  SEAINCENSE: 'WATER', WAVEINCENSE: 'WATER', ROSEINCENSE: 'GRASS', ODDINCENSE: 'PSYCHIC', ROCKINCENSE: 'ROCK' };
const RESIST_BERRY = { OCCABERRY: 'FIRE', PASSHOBERRY: 'WATER', WACANBERRY: 'ELECTRIC', RINDOBERRY: 'GRASS', YACHEBERRY: 'ICE', CHOPLEBERRY: 'FIGHTING', KEBIABERRY: 'POISON', SHUCABERRY: 'GROUND', COBABERRY: 'FLYING', PAYAPABERRY: 'PSYCHIC', TANGABERRY: 'BUG', CHARTIBERRY: 'ROCK', KASIBBERRY: 'GHOST', HABANBERRY: 'DRAGON', COLBURBERRY: 'DARK', BABIRIBERRY: 'STEEL', ROSELIBERRY: 'FAIRY', CHILANBERRY: 'NORMAL' };
const STATUS_BERRY = { CHERIBERRY: 'PAR', CHESTOBERRY: 'SLP', PECHABERRY: 'PSN', RAWSTBERRY: 'BRN', ASPEARBERRY: 'FRZ' };
const PINCH_HEAL = ['FIGYBERRY', 'WIKIBERRY', 'MAGOBERRY', 'AGUAVBERRY', 'IAPAPABERRY'];
const PINCH_STAT = { LIECHIBERRY: 1, GANLONBERRY: 2, SALACBERRY: 3, PETAYABERRY: 4, APICOTBERRY: 5 };
const hItem = m => (m && m.item && !(m.embargo > 0) && !(G.battle && G.battle.field && G.battle.field.magicRoom > 0) && !isKlutz(m)) ? m.item : '';
const isChoice = k => k === 'CHOICEBAND' || k === 'CHOICESPECS' || k === 'CHOICESCARF';
function atkItem(user, md, eff) {
  const k = hItem(user), phys = md.cat === 'Physical'; let m = 1, gem = false;
  if (k === 'CHOICEBAND' && phys) m *= 1.5; if (k === 'CHOICESPECS' && !phys) m *= 1.5;
  if (k === 'MUSCLEBAND' && phys) m *= 1.1; if (k === 'WISEGLASSES' && !phys) m *= 1.1;
  if (k === 'LIFEORB') m *= 1.3; if (k === 'EXPERTBELT' && eff > 1) m *= 1.2;
  if (TYPE_ITEM[k] && TYPE_ITEM[k] === md.type) m *= 1.2;
  if (/GEM$/.test(k) && k.slice(0, -3) === md.type) { m *= 1.5; gem = true; }
  return { m, gem };
}
function* healItem(s, amt, msg) {
  const m = sideMon(s); if (m.hp <= 0 || m.hp >= m.maxhp) return;
  m.hp = Math.min(m.maxhp, m.hp + Math.max(1, amt)); sfx('item'); yield* animHp(s, m.hp); yield* bmsg(msg);
}
// berries, herbs: checked after every move and at end of turn
function* checkItems(s) { yield* checkItems0(s); if (B_().S[s].cheek) { B_().S[s].cheek = false; const m = sideMon(s); if (m.hp > 0 && m.hp < m.maxhp) yield* healItem(s, Math.floor(m.maxhp / 3), __('{0}\'s Cheek Pouch restored its health!', mname(s))); } }
function* checkItems0(s) {
  const B = B_(), m = sideMon(s); if (!m || m.hp <= 0) return; const k = hItem(m); if (!k) return;
  if (/BERRY$/.test(k) && abilOf(1 - s) === 'UNNERVE') return;
  const nm = mname(s), iname = itemName(k);
  if ((STATUS_BERRY[k] && m.status === STATUS_BERRY[k]) || (k === 'LUMBERRY' && m.status)) { B.S[s].lastItem = k; B.S[s].ate = true; B.S[s].cheek = abilOf(s) === 'CHEEKPOUCH'; m.item = null; m.status = null; sfx('item'); yield* bmsg(__('{0}\'s {1} cured its status problem!', nm, iname)); return; }
  if (k === 'SITRUSBERRY' && m.hp <= m.maxhp / 2) { B.S[s].lastItem = k; B.S[s].ate = true; B.S[s].cheek = abilOf(s) === 'CHEEKPOUCH'; m.item = null; yield* healItem(s, Math.floor(m.maxhp / 4), __('{0} restored its health using its {1}!', nm, iname)); return; }
  if (k === 'ORANBERRY' && m.hp <= m.maxhp / 2) { B.S[s].lastItem = k; B.S[s].ate = true; B.S[s].cheek = abilOf(s) === 'CHEEKPOUCH'; m.item = null; yield* healItem(s, 10, __('{0} restored its health using its {1}!', nm, iname)); return; }
  if (PINCH_HEAL.includes(k) && m.hp <= m.maxhp * (abilOf(s) === 'GLUTTONY' ? 0.5 : 0.25)) { B.S[s].lastItem = k; B.S[s].ate = true; B.S[s].cheek = abilOf(s) === 'CHEEKPOUCH'; m.item = null; yield* healItem(s, Math.floor(m.maxhp / 3), __('{0} restored its health using its {1}!', nm, iname)); return; }
  if (PINCH_STAT[k] && m.hp <= m.maxhp * (abilOf(s) === 'GLUTTONY' ? 0.5 : 0.25)) { B.S[s].lastItem = k; B.S[s].ate = true; B.S[s].cheek = abilOf(s) === 'CHEEKPOUCH'; m.item = null; yield* bmsg(__('{0} used its {1}!', nm, iname)); yield* changeStage(s, PINCH_STAT[k], 1); return; }
  if (k === 'LEPPABERRY') { const sl = m.moves.find(x => x.pp <= 0); if (sl) { B.S[s].lastItem = k; B.S[s].ate = true; B.S[s].cheek = abilOf(s) === 'CHEEKPOUCH'; m.item = null; sl.pp = Math.min(D.MV[sl.id].pp || 10, 10); sfx('item'); yield* bmsg(__('{0} restored {1}\'s PP using its {2}!', nm, D.MV[sl.id].name, iname)); } return; }
  if (k === 'WHITEHERB' && B.S[s].st.some(v => v < 0)) { B.S[s].lastItem = k; B.S[s].ate = true; B.S[s].cheek = abilOf(s) === 'CHEEKPOUCH'; m.item = null; B.S[s].st = B.S[s].st.map(v => Math.max(0, v)); sfx('item'); yield* bmsg(__('{0} returned its stats to normal using its White Herb!', nm)); }
}
function* afterHitItems(us, md, done, c) {
  const B = B_(), user = sideMon(us), ts = 1 - us, tgt = sideMon(ts), uk = hItem(user), tk = hItem(tgt);
  if (uk === 'LIFEORB' && user.hp > 0 && !(c && c.sheer) && abilOf(us) !== 'MAGICGUARD') { user.hp = Math.max(0, user.hp - Math.max(1, Math.floor(user.maxhp / 10))); sprOf(us).shk = 10; yield* animHp(us, user.hp); yield* bmsg(__('{0} lost some of its HP!', mname(us))); }
  if (uk === 'SHELLBELL' && user.hp > 0 && done > 0) yield* healItem(us, Math.floor(done / 8), __('{0} restored a little HP using its Shell Bell!', mname(us)));
  if (tgt.hp > 0 && tk === 'ROCKYHELMET' && hasFlag(md, 'a') && user.hp > 0) { user.hp = Math.max(0, user.hp - Math.max(1, Math.floor(user.maxhp / 6))); sprOf(us).shk = 10; yield* animHp(us, user.hp); yield* bmsg(__('{0} was hurt by {1}\'s Rocky Helmet!', mname(us), mnameL(ts))); }
  if (tgt.hp > 0) {
    const t = md.type, bump = { ABSORBBULB: ['WATER', 4], CELLBATTERY: ['ELECTRIC', 1], LUMINOUSMOSS: ['WATER', 5], SNOWBALL: ['ICE', 1] }[tk];
    if (bump && bump[0] === t) { tgt.item = null; yield* bmsg(__('{0} used its {1}!', mname(ts), itemName(tk))); yield* changeStage(ts, bump[1], 1); }
    if ((uk === 'KINGSROCK' || uk === 'RAZORFANG') && rnd(10) === 0) B.S[ts].flinch = true;
  }
}

// calcDamage / useMove / doMove live in moves.js
function mname(s) { const B = B_(); return s === 1 ? (B.kind === 'wild' ? __('The wild {0}', pokeName(sideMon(s))) : __('The opposing {0}', pokeName(sideMon(s)))) : pokeName(sideMon(s)); }
function* changeStage(s, stat, delta, byFoe) {
  const st = B_().S[s].st, nm = mname(s);
  if (abilOf(s) === 'SIMPLE') delta *= 2;
  if (abilOf(s) === 'CONTRARY') delta = -delta;
  if (delta < 0 && byFoe && (yield* abilStatBlock(s, stat))) return;
  if (delta < 0 && byFoe && (B_().S[s].mist > 0 || team(s).mist > 0)) { yield* bmsg(__('{0} is protected by the mist!', nm)); return; }
  if (delta > 0 && st[stat] >= 6) { yield* bmsg(__('{0}\'s {1} won\'t go any higher!', nm, STAGE_NAMES[stat])); return; }
  if (delta < 0 && st[stat] <= -6) { yield* bmsg(__('{0}\'s {1} won\'t go any lower!', nm, STAGE_NAMES[stat])); return; }
  st[stat] = Math.max(-6, Math.min(6, st[stat] + delta));
  const sn = tr(STAGE_NAMES[stat]);
  if (window.ANIMS) yield* commonAnim(delta > 0 ? 'StatUp' : 'StatDown', s); else sfx(delta > 0 ? 'item' : 'buzzer');
  yield* bmsg(delta >= 3 ? __('{0}\'s {1} rose drastically!', nm, sn) : delta === 2 ? __('{0}\'s {1} rose sharply!', nm, sn) : delta === 1 ? __('{0}\'s {1} rose!', nm, sn) : delta === -1 ? __('{0}\'s {1} fell!', nm, sn) : delta === -2 ? __('{0}\'s {1} harshly fell!', nm, sn) : __('{0}\'s {1} severely fell!', nm, sn));
  if (delta < 0 && byFoe) yield* abilStatDropped(s);
}
function* inflict(s, status, self) {
  const mon = sideMon(s); const ty = pokeTypes(mon);
  if (mon.status || mon.hp <= 0) return false;
  if (status === 'FRZ' && wx() === 'SUN') return false;
  { const why = abilStatusBlock(s, status); if (why) { if (!self) yield* bmsg(why); return false; } }
  if (status === 'SLP' && (B_().S[0].uproar || B_().S[1].uproar)) return false;
  if (!self) {
    const F = field(), gr = isGrounded(s);
    if (team(s).safeguard > 0) { yield* bmsg(__('{0} is protected by Safeguard!', mname(s))); return false; }
    if (gr && F.terrain === 'MISTY') { yield* bmsg(__('{0} surrounds itself with a protective mist!', mname(s))); return false; }
    if (gr && F.terrain === 'ELECTRIC' && status === 'SLP') { yield* bmsg(__('{0} surrounds itself with electrified terrain!', mname(s))); return false; }
  }
  if ((status === 'PSN' && (ty.includes('POISON') || ty.includes('STEEL')) && !(B_().lastCtx && abilOf(B_().lastCtx.us) === 'CORROSION' && B_().lastCtx.ts === s)) || (status === 'BRN' && ty.includes('FIRE')) || (status === 'FRZ' && ty.includes('ICE')) || (status === 'PAR' && ty.includes('ELECTRIC'))) return false;
  mon.status = status; if (status === 'SLP') mon.sleep = 1 + rnd(3);
  if (window.ANIMS) yield* commonAnim({ PSN: 'Poison', BRN: 'Burn', PAR: 'Paralysis', SLP: 'Sleep', FRZ: 'Frozen' }[status], s);
  const nmS = mname(s);
  const t = { PSN: __('{0} was poisoned!', nmS), BRN: __('{0} was burned!', nmS), PAR: __('{0} is paralyzed! It may be unable to move!', nmS), SLP: __('{0} fell asleep!', nmS), FRZ: __('{0} was frozen solid!', nmS) }[status];
  yield* bmsg(t); yield* abilStatusGot(s, status); return true;
}
function addFx(type, s, kind) { B_().fx.push({ t: 0, life: 22, color: TYPE_COLORS[type] || '#fff', s, kind }); }
function* attackAnim(us, md, status) {
  const f = window.ANIMS && findAnim(md, us, !!status);
  if (f) { yield* playAnim(f.idx, us, (md.target === '10' || md.target === '20') ? us : 1 - us, f.opp); return; }   // self moves target the user, so the other battler is left alone
  const sp = sprOf(us); const dir = us === 0 ? 1 : -1;
  if (!status && md.cat === 'Physical') { yield* tween(sp, { dx: 44 * dir }, 5); addFx(md.type, 1 - us, 'hit'); yield* tween(sp, { dx: 0 }, 7); }
  else { addFx(md.type, status ? us : 1 - us, status ? 'aura' : 'burst'); yield* bwait(22); }
}

// ------------------------------------------------------------ end of turn / faint / exp
function* endOfTurn() {
  const B = B_();
  for (const s of [0, 1]) {
    const mon = sideMon(s); if (mon.hp <= 0) continue;
    if (mon.status === 'PSN' && abilOf(s) === 'POISONHEAL') { if (mon.hp < mon.maxhp) { yield* bmsg(__('{0}\'s Poison Heal!', mname(s)), { hold: 6 }); yield* healItem(s, Math.floor(mon.maxhp / 8), __('{0} restored a little HP!', mname(s))); } }
    else if ((mon.status === 'PSN' || mon.status === 'BRN') && abilOf(s) !== 'MAGICGUARD') {
      const d = Math.max(1, Math.floor(mon.maxhp / (mon.status === 'PSN' ? 8 : 16)));
      mon.hp = Math.max(0, mon.hp - d); sfx('hit'); sprOf(s).shk = 10; yield* animHp(s, mon.hp);
      yield* bmsg(__('{0} was hurt by its {1}!', mname(s), (mon.status === 'PSN' ? 'poisoning' : 'burn')));
    }
    const ik = hItem(mon);
    if (mon.hp > 0) {
      if (ik === 'LEFTOVERS') yield* healItem(s, Math.floor(mon.maxhp / 16), __('{0} restored a little HP using its Leftovers!', mname(s)));
      if (ik === 'BLACKSLUDGE') {
        if (pokeTypes(mon).includes('POISON')) yield* healItem(s, Math.floor(mon.maxhp / 16), __('{0} restored a little HP using its Black Sludge!', mname(s)));
        else { mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(mon.maxhp / 8))); sfx('hit'); sprOf(s).shk = 10; yield* animHp(s, mon.hp); yield* bmsg(__('{0} was hurt by its Black Sludge!', mname(s))); }
      }
      if ((ik === 'FLAMEORB' || ik === 'TOXICORB') && !mon.status) yield* inflict(s, ik === 'FLAMEORB' ? 'BRN' : 'PSN', true);
    }
    if (mon.hp > 0) yield* volatileEnd(s);
  }
  yield* fieldEnd(); yield* delayedEnd(); for (const s of [0, 1]) if (sideMon(s).hp > 0) yield* abilEndTurn(s);
  for (const s of [0, 1]) yield* checkItems(s);
  B.S.forEach(s => { s.protect = false; s.flinch = false; s.hurt = false; s.moved = false; s.lastHit = null; s.age++; s.coat = false; s.snatch = false; if (s.laserFocus > 0) s.laserFocus--; if (s.mist > 0) s.mist--; });
  if (B.scripted && B.foe.hp < 1) B.foe.hp = 1;
}
function* faint(s) {
  const B = B_(); const sp = sprOf(s);
  sfx('faint');
  for (let i = 1; i <= 18; i++) { const t = i / 18; sp.dy = t * 70; sp.a = 1 - t; yield; }
  sp.vis = false; sp.dy = 0; sp.a = 1; yield* tween(B.box, { [s === 0 ? 'me' : 'foe']: 0 }, 8);
  yield* bmsg(__('{0} fainted!', mname(s)));
}
function* giveExp(foe) {
  const B = B_(); const part = B.meParty.filter(p => p.hp > 0);       // Exp. Share is always on: the whole team gets Exp
  if (!part.length) return;
  const total = gainedExp(foe, B.kind === 'trainer');
  const half = Math.max(1, Math.floor(total / 2));
  const order = part.filter(p => B.participants.has(p)).concat(part.filter(p => !B.participants.has(p)));
  let told = false;
  for (const p of order) {
    const fought = B.participants.has(p), each = fought ? total : half;
    if (fought) yield* bmsg(__('{0} gained {1} Exp. Points!', pokeName(p), each), { hold: 8 });
    else if (!told) { told = true; yield* bmsg(__('The rest of the team gained {0} Exp. Points!', each), { hold: 8 }); }
    applyEvs(p, foe.sym);
    const active = p === B.me, from = expRatio(p);
    const levels = gainExp(p, each);
    if (active) { sfx('exp'); yield* animExp(from, levels.length ? 1 : expRatio(p)); }
    for (const lv of levels) {
      if (active) { B.meHp = p.hp; B.meExp = 0; }
      sfx('Pkmn_exp_full');
      yield* bmsg(__('{0} grew to Lv. {1}!', pokeName(p), lv.lvl), { pause: true });
      yield* levelUpBox(lv);
      for (const mv of lv.learn) yield* learnMove(p, mv);
      if (active) yield* animExp(0, expRatio(p));
    }
  }
}
function* levelUpBox(lv) {
  const B = B_(); const order = [0, 1, 2, 4, 5, 3], names = ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed'];
  for (let phase = 0; phase < 2; phase++) {
    B.lvBox = order.map((si, i) => [names[i], phase === 0 ? '+' + (lv.now[si] - lv.old[si]) : String(lv.now[si])]);
    yield; while (!pressed('ok')) yield; sfx('ok');
  }
  B.lvBox = null; B.meHp = B.me.hp;
}
function* learnMove(p, id) {
  const md = D.MV[id]; if (!md || p.moves.some(m => m.id === id)) return;
  if (p.moves.length < 4) { p.moves.push(newMoveSlot(id)); sfx('Pkmn_move_learnt'); yield* bmsg(__('{0} learned {1}!', pokeName(p), md.name), { pause: true }); return; }
  while (true) {
    yield* bmsg(__('{0} wants to learn {1}, but {2} already knows four moves.', pokeName(p), md.name, pokeName(p)), { pause: true });
    yield* bmsg(__('Delete a move to make room for {0}?', md.name), { hold: 0 });
    if (!(yield* battleYesNo())) { yield* bmsg(__('{0} did not learn {1}.', pokeName(p), md.name), { pause: true }); return; }
    const r = yield* forgetScreen(p, id);
    if (r < 0) continue;
    const old = D.MV[p.moves[r].id].name; p.moves[r] = newMoveSlot(id);
    yield* bmsg(__('1, 2, and... ... ... Poof!'), { pause: true });
    yield* bmsg(__('{0} forgot {1}. And...', pokeName(p), old), { pause: true });
    sfx('Pkmn_move_learnt'); yield* bmsg(__('{0} learned {1}!', pokeName(p), md.name), { pause: true }); return;
  }
}

// Essentials-style "forget a move" screen: the four known moves + the new one, with a detail panel (type, category, power, accuracy, PP, description)
function* forgetScreen(p, id) {
  const B = G.battle; const F = { p, id, idx: 0, fresh: newMoveSlot(id) };
  const loop = function* () {
    sfx('open');
    while (true) {
      yield;
      if (rep('up') && F.idx > 0) { F.idx--; sfx('cursor'); }
      if (rep('down') && F.idx < 4) { F.idx++; sfx('cursor'); }
      if (ok()) { sfx('ok'); return F.idx === 4 ? -1 : F.idx; }
      if (back()) { sfx('back'); return -1; }
    }
  };
  if (B) { B.msg = null; B.forget = F; const r = yield* loop(); B.forget = null; return r; }
  return yield* withDraw(() => { drawForget(F); drawUiMsg(); }, loop());   // outside battle (field)
}
function drawForget(F) {
  const p = F.p, all = p.moves.slice(0, 4).concat([F.fresh]), cur = all[F.idx], md = D.MV[cur.id];
  pic('summary/bg_movedetail', 0, 0);
  const L = (s, x, y, o = {}) => txt(s, x, y + 4, Object.assign({ base: '#f8f8f8', shadow: LIGHT_SH, size: 22 }, o));
  const Dk = (s, x, y, o = {}) => txt(s, x, y + 4, Object.assign({ base: '#404040', shadow: '#b0b0b0', size: 22 }, o));
  L('Forget which?', 14, 14, { size: 22 });
  drawTypeIcon(md.type, 8, 68); Dk(md.name, 82, 70);
  L('Category', 10, 120); ctx.drawImage(UI('category'), 0, ['Physical', 'Special', 'Status'].indexOf(md.cat) * 28, 64, 28, 168, 122, 64, 28);
  L('Power', 10, 152); Dk(md.pow > 1 ? md.pow : '---', 230, 152, { align: 'right' });
  L('Accuracy', 10, 184); Dk(md.acc > 0 ? md.acc : '---', 230, 184, { align: 'right' });
  wrap(md.desc, 224, 20).slice(0, 5).forEach((l, i) => Dk(l, 8, 224 + i * 24, { size: 20 }));
  const off = F.idx >= 4 ? 1 : 0;   // the list shows four rows at a time (same layout as the summary's moves page); scroll one row for the new move
  all.forEach((m, i) => {
    if (i < off || i >= off + 4) return;
    const y = 94 + (i - off) * 64, mm = D.MV[m.id];
    if (i === F.idx) ctx.drawImage(UI('summary/cursor_move'), 0, 0, 252, 74, 236, y - 4, 252, 74);
    drawTypeIcon(mm.type, 248, y + 4); Dk(mm.name, 320, y + 8, { size: 22 });
    if (i === 4) Dk('NEW', 460, y + 34, { align: 'right', size: 20, base: '#d83030' }); else { Dk('PP', 316, y + 34, { size: 20 }); Dk(m.pp + '/' + maxPP(m), 460, y + 34, { align: 'right', size: 20 }); }
  });
  if (off) txt('\u25B2', 470, 74, { base: '#f8f8f8', shadow: '#707070', size: 18 }); else txt('\u25BC', 470, 360, { base: '#f8f8f8', shadow: '#707070', size: 18 });
}

// ------------------------------------------------------------ choice menus
function* battleYesNo() {
  const B = B_(); B.menu = { type: 'yn', idx: 0 };
  while (true) { yield; const m = B.menu; if (rep('up') || rep('down')) { m.idx ^= 1; sfx('cursor'); } if (ok()) { sfx('ok'); B.menu = null; return m.idx === 0; } if (back()) { sfx('back'); B.menu = null; return false; } }
}
function* bchoose(labels, text, cols) {
  const B = B_(); B.msg = null; B.menuText = text;
  B.menu = { type: 'list', labels, idx: 0, cols: cols || 1 };
  while (true) {
    yield; const m = B.menu, c = m.cols;
    if (rep('up') && m.idx - c >= 0) { m.idx -= c; sfx('cursor'); }
    if (rep('down') && m.idx + c < labels.length) { m.idx += c; sfx('cursor'); }
    if (ok()) { sfx('ok'); B.menu = null; B.menuText = ''; return m.idx; }
    if (back()) { sfx('back'); B.menu = null; B.menuText = ''; return -1; }
  }
}
function* gridNav(m, n) {
  if (rep('left') && m.idx % 2 === 1) { m.idx--; sfx('cursor'); }
  if (rep('right') && m.idx % 2 === 0 && m.idx + 1 < n) { m.idx++; sfx('cursor'); }
  if (rep('up') && m.idx >= 2) { m.idx -= 2; sfx('cursor'); }
  if (rep('down') && m.idx + 2 < n) { m.idx += 2; sfx('cursor'); }
}

// ------------------------------------------------------------ player command phase
function* useBattleItem(key) {   // X items, Dire Hit, Guard Spec, Poké Doll
  const B = B_(), nm = itemName(key);
  if (key === 'POKEDOLL') {
    if (B.kind !== 'wild') { yield* bmsg(__('You can\'t run from a Trainer battle!'), { pause: true }); return false; }
    consume(key); sfx('run'); yield* bmsg(__('{0} used the {1}!', G.name, nm), { hold: 10 }); yield* bmsg(__('Got away safely!'), { pause: true }); B.result = 'ran'; return true;
  }
  consume(key); sfx('item'); yield* bmsg(__('{0} used the {1}!', G.name, nm), { hold: 10 });
  if (key === 'DIREHIT') { B.S[0].direHit = true; yield* bmsg(__('{0} is getting pumped!', pokeName(B.me))); }
  else if (key === 'GUARDSPEC') { B.S[0].mist = 5; yield* bmsg(__('Your team became shrouded in mist!')); }
  else yield* changeStage(0, BATTLE_ITEMS[key][0], 2);
  return true;
}
function* commandPhase() {
  const B = B_(); const me = B.me; let idx = B.lastCmd;
  if (window.__forceCmd) { const c = window.__forceCmd; window.__forceCmd = null; return c; }
  { const fm = forcedMove(0); if (fm != null && (B.S[0].twoTurn || B.S[0].lockMove)) return { type: 'move', idx: fm }; }
  while (true) {
    B.msg = null; B.menu = { type: 'cmd', idx }; B.menuText = __('What will {0} do?', pokeName(me));
    while (true) { yield; yield* gridNav(B.menu, 4); if (ok()) { sfx('ok'); idx = B.menu.idx; break; } }
    B.lastCmd = idx; B.menu = null;
    if (idx === 0) {
      if (!me.moves.some(m => m.pp > 0)) { yield* bmsg(__('{0} has no moves left!', pokeName(me)), { hold: 12 }); return { type: 'move', idx: -1 }; }
      let mi = Math.min(B.lastMove, me.moves.length - 1);
      while (true) {
        // Essentials: a Mega button sits above the move list (0 hidden, 1 shown, 2 pressed); the A key (Shift / C here) registers the Mega Evolution
        B.menu = { type: 'fight', idx: mi, mega: canMega(me) ? 1 : 0 }; let sel = -2;
        while (true) {
          yield; yield* gridNav(B.menu, me.moves.length); mi = B.menu.idx;
          if (B.menu.mega === 1 && (pressed('bike') || pressed('mega'))) { B.menu.mega = 2; sfx('ok'); keys.pressed.menu = false; }
          if (ok()) { sfx('ok'); sel = mi; break; } if (back()) { sfx('back'); sel = -1; break; }
        }
        const wantMega = B.menu.mega === 2; B.menu = null;
        if (sel === -1) break;
        if (me.moves[sel].pp <= 0) { sfx('buzzer'); yield* bmsg(__('There\'s no PP left for this move!'), { hold: 16 }); continue; }
        const lk = B.S[0].lock;
        if (isChoice(hItem(me)) && lk != null && lk !== sel && me.moves[lk] && me.moves[lk].pp > 0) { sfx('buzzer'); yield* bmsg(__('{0} only allows {1} to be used!', itemName(me.item), D.MV[me.moves[lk].id].name), { hold: 16 }); continue; }
        { const smd = D.MV[me.moves[sel].id]; if (hItem(me) === 'ASSAULTVEST' && (smd.cat === 'Status' || smd.pow === 0)) { sfx('buzzer'); yield* bmsg(__('The effects of the Assault Vest prevent status moves!'), { hold: 16 }); continue; } }
        { const why = moveBlockedReason(0, sel); if (why) { sfx('buzzer'); yield* bmsg(why, { hold: 16 }); continue; } }
        B.lastMove = sel; return { type: 'move', idx: sel, mega: wantMega };
      }
    } else if (idx === 1) {
      const key = yield* bagScreen({ mode: 'battle' });
      if (!key) continue;
      if (itemInfo(key).pocket === 3) {
        if (B.kind === 'trainer') { yield* bmsg(__('The Trainer blocked the Ball! Don\'t be a thief!'), { pause: true }); continue; }
        return { type: 'ball', key };
      }
      if (key in BATTLE_ITEMS) { if (yield* useBattleItem(key)) return { type: 'item' }; continue; }
      const r = yield* partyScreen({ mode: 'item', text: 'Use on which Pokémon?', use: (p, i, S) => useItemOn(key, p, S) });
      B.meHp = B.me.hp;
      if (r >= 0) return { type: 'item' };
    } else if (idx === 2) {
      if (isTrapped(0)) { yield* bmsg(__('{0} can\'t be switched out!', pokeName(me)), { pause: true }); continue; }
      const r = yield* partyScreen({ mode: 'battle', text: 'Choose a Pokémon.', activeIdx: B.meParty.indexOf(me) });
      if (r >= 0) return { type: 'switch', idx: r };
    } else if (idx === 3) {
      if (B.kind === 'trainer') { yield* bmsg(__('No! There\'s no running from a Trainer battle!'), { pause: true }); continue; }
      return { type: 'run' };
    }
  }
}

// ------------------------------------------------------------ AI
// ------------------------------------------------------------ Mega Evolution: Illya2 + Prisma Mega Stone + Key Stone
// holder species + stone -> Mega species (the Mega species must exist in pokemon.json with megaOf set)
const MEGA_STONES = { CHARIZARDITEX: [['ILLYA2', 'ILLYASUM2'], 'MEGAILLYA'], ALBIONSTONE: ['MELUSINE', 'MEGAMELUSINE'], SPACESTONE: [['ISHTAR', 'ISHTARSUM'], 'MEGAISHTAR'], ANUBISSTONE: ['NITOCRIS', 'MEGANITOCRIS'] };
function megaFor(p) { const m = p && MEGA_STONES[p.item]; return m && [].concat(m[0]).includes(p.sym) && D.SP[m[1]] ? m[1] : null; }
function canMega(p) { const B = B_(); return !!(megaFor(p) && G.items.KEYSTONE > 0 && !B.megaUsed); }
function* doMega(s = 0) {
  // same order as Essentials' pbMegaEvolve: message -> MegaEvolution common animation -> form change -> "has Mega Evolved" message
  const B = B_(), p = s === 0 ? B.me : B.foe, nm = s === 0 ? pokeName(p) : mname(1), owner = s === 0 ? G.name : B.trainer.name;
  yield* bmsg(__('{0}\'s {1} is reacting to {2}\'s Key Stone!', nm, itemName(p.item), owner), { hold: 20 });
  if (window.ANIMS && ANIMS.common && ANIMS.common.MegaEvolution != null) yield* commonAnim('MegaEvolution', s);
  const mg = megaFor(p); p.megaBase = p.sym; p.sym = mg; if (s === 0) B.megaUsed = true; else B.foeMegaUsed = true;
  refreshStats(p); B[s === 0 ? 'meHp' : 'foeHp'] = p.hp;
  if (ANIMS.common.MegaEvolution2 != null) yield* commonAnim('MegaEvolution2', s);   // not defined in this project's animation set
  yield* bmsg(__('{0} has Mega Evolved into {1}!', nm, D.SP[p.sym].name), { hold: 24 });
}
// trainers: a foe holding a matching Mega Stone Mega Evolves at the start of a turn (once per battle)
function canFoeMega() { const B = B_(); return B.kind === 'trainer' && !B.foeMegaUsed && !!megaFor(B.foe) && B.foe.hp > 0; }
function unMega(B) { new Set(G.party.concat(B && B.meParty || [])).forEach(p => { if (p && p.megaBase) { const hp0 = p.hp, old = p.maxhp; p.sym = p.megaBase; delete p.megaBase; refreshStats(p); p.hp = hp0 > 0 ? Math.max(1, Math.min(p.maxhp, hp0 - (old - p.maxhp))) : 0; } }); }
function pickFoeMove() {
  const B = B_(), foe = B.foe; const fm = forcedMove(1); if (fm != null) return fm;
  const opts = foe.moves.map((m, i) => ({ m, i })).filter(o => o.m.pp > 0 && !moveBlockedReason(1, o.i));
  if (!opts.length) return -1;
  if (isChoice(hItem(foe)) && B.S[1].lock != null && foe.moves[B.S[1].lock] && foe.moves[B.S[1].lock].pp > 0) return B.S[1].lock;
  const pool = [];
  for (const o of opts) {
    const md = D.MV[o.m.id]; let w = 2;
    if (md.pow > 0) { const e = moveTypeMul(md, B.me); w = e === 0 ? 0 : 4 * e; if (pokeTypes(foe).includes(md.type)) w *= 1.5; }
    for (let k = 0; k < Math.round(w); k++) pool.push(o.i);
  }
  return pool.length ? pool[rnd(pool.length)] : opts[0].i;
}

// ------------------------------------------------------------ catching
function* throwBall(key) {
  const B = B_(), foe = B.foe; const it = itemInfo(key);
  const mul = { POKEBALL: 1, GREATBALL: 1.5, ULTRABALL: 2, MASTERBALL: 255 }[key] || 1;
  consume(key);
  yield* bmsg(__('{0} threw one {1}!', G.name, it.name), { hold: 4 });
  const bid = { POKEBALL: 0, GREATBALL: 1, SAFARIBALL: 2, ULTRABALL: 3, MASTERBALL: 4 }[key] || 0;   // Essentials $BallTypes numbering (picture ball_0N)
  // ---- catch roll (kept as before) ----
  const sh = D.SP[foe.sym], stat = foe.status === 'SLP' || foe.status === 'FRZ' ? 2 : foe.status ? 1.5 : 1;
  const a = Math.min(255, ((3 * foe.maxhp - 2 * foe.hp) * sh.catch * mul) / (3 * foe.maxhp) * stat * 1.5);   // species catch rate (set per species by how early it is found: easy early, hard late); the x1.5 stays forgiving
  let shakes = 0;
  if (key === 'MASTERBALL' || a >= 255) shakes = 4;
  else { const bb = Math.floor(1048560 / Math.floor(Math.sqrt(Math.floor(Math.sqrt(16711680 / a))))); for (let i = 0; i < 4; i++) { if (rnd(65536) < bb) shakes++; else break; } }
  const caught = shakes === 4;
  // ---- animation: port of Essentials pokeballThrow (40 fps, 512x384) ----
  const sp = B.spr.foe, bottom = FOE_BASE.y + 8 + (sh.enemyY || 0);
  const cx = FOE_BASE.x, cy = bottom - 80, endY = bottom - 12;
  const b = B.spr.ball = { x: 10, y: 180, open: false, rot: 0, dx: 0, id: bid, a: 1 };
  const setSc = z => { sp.sc = z; sp.dy = 80 * (z - 1); };           // scale about the sprite's centre
  const lerpY = function* (to, n) { const y0 = b.y; for (let i = 1; i <= n; i++) { b.y = y0 + (to - y0) * i / n; yield; } };
  sfx('throw');
  const P = [[10, 180], [150, 70], [30 + SW / 2, 10], [cx, cy]];
  for (let i = 1; i <= 30; i++) {
    const t = i / 30, u = 1 - t;
    b.x = u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0];
    b.y = u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1];
    b.rot = t * 6 * Math.PI; yield;                                  // three clockwise spins
  }
  b.rot = 0; yield* bwait(4);
  sp.tintCol = '#ff2a10'; sp.tint = 0;                                // pokemon turns red
  for (let i = 1; i <= 10; i++) { sp.tint = 0.85 * i / 10; yield; }
  sfx('Battle_recall'); yield* bwait(4); b.open = true; yield;
  if (window.ANIMS && ANIMS.common && ANIMS.common['BallBurst' + bid] != null) yield* commonAnim('BallBurst' + bid, 1);
  // pokemon shrinks into the ball
  for (let i = 1; i <= 15; i++) { setSc(1 - i / 15); if (i === 10) sfx('Battle_jump_to_ball'); yield; }
  sp.vis = false; yield; yield; b.open = false;
  yield* bwait(6);
  // drop and bounce
  yield* lerpY(endY, 10); sfx('Battle_ball_drop');
  const bounce = function* (frac, n) { yield* bwait(2); yield* lerpY(endY - (endY - cy) * frac, n); yield* lerpY(endY, n); sfx('Battle_ball_drop'); };
  yield* bounce(1 / 2, 5); yield* bounce(1 / 4, 3); yield* bwait(2); yield* lerpY(endY - (endY - cy) / 8, 1); yield* lerpY(endY, 1); sfx('Battle_ball_drop');
  yield* bwait(18);
  // shakes (4 = captured)
  const n = Math.min(shakes, 3);
  for (let k = 0; k < n; k++) {
    sfx('Battle_ball_shake');
    for (let i = 1; i <= 3; i++) { b.dx = -8 * i / 3; b.rot = -20 * Math.PI / 180 * i / 3; yield; }
    for (let i = 1; i <= 6; i++) { b.dx = -8 + 16 * i / 6; b.rot = (-20 + 40 * i / 6) * Math.PI / 180; yield; }
    for (let i = 1; i <= 3; i++) { b.dx = 8 * (1 - i / 3); b.rot = 20 * Math.PI / 180 * (1 - i / 3); yield; }
    b.dx = 0; b.rot = 0; yield* bwait(18);
  }
  if (!caught) {
    sfx('Battle_recall'); b.open = true; sp.vis = true; sp.tintCol = '#fff'; sp.tint = 1; sp.a = 1; setSc(0);
    for (let i = 1; i <= 24; i++) {
      if (i <= 15) setSc(i / 15); sp.tint = 1 - i / 24;
      if (i === 10) b.vis = false; yield;
    }
    setSc(1); sp.dy = 0; sp.tint = 0; sp.tintCol = null; B.spr.ball = null;
    yield* bmsg(shakes === 0 ? __('Oh no! The Pokémon broke free!') : shakes === 1 ? __('Aww... It appeared to be caught!') : shakes === 2 ? __('Aargh! Almost had it!') : __('Gah! It was so close, too!'), { pause: true });
    return false;
  }
  // captured: ball goes dark and stays on the ground
  b.dark = true; playSE('Battle_ball_drop', 1); sp.dy = 0; sp.tintCol = null; sp.tint = 0;
  yield* bmsg(__('Gotcha! {0} was caught!', pokeName(foe)), { pause: true });
  stopBGM(); playME('frlg_pokemoncaught');
  foe.ot = G.name; foe.met = mapNameOf(G.mapId); foe.metLvl = foe.lvl; foe.ball = bid; G.owned = G.owned || {}; G.owned[foe.sym] = true;
  yield* bwait(140);
  for (let i = 0; i < 21; i++) { b.a = Math.max(0, 1 - i / 21); yield; }       // pbHideCaptureBall fade-out
  B.spr.ball = null;
  if (G.party.length < 6) { G.party.push(foe); yield* bmsg(__('{0} was added to your party.', pokeName(foe)), { hold: 20 }); } else { pcAdd(foe); yield* bmsg(__('{0} was sent to the PC.', pokeName(foe)), { hold: 20 }); }
  B.result = 'caught'; return true;
}
function* tryRun() {
  const B = B_(); B.runN++;
  if (isTrapped(0)) { yield* bmsg(__('Can\'t escape!'), { pause: true }); return false; }
  if (abilOf(0) === 'RUNAWAY' || hItem(B.me) === 'SMOKEBALL') { sfx('run'); yield* bmsg(__('Got away safely!'), { pause: true }); B.result = 'ran'; return true; }
  const a = effStat(0, 3), b = effStat(1, 3);
  if (a >= b || rnd(256) < Math.floor(a * 128 / Math.max(1, b)) + 30 * B.runN) { sfx('run'); yield* bmsg(__('Got away safely!'), { pause: true }); B.result = 'ran'; return true; }
  yield* bmsg(__('Can\'t escape!'), { pause: true }); return false;
}

// ------------------------------------------------------------ turn loop
function* doSwitch(idx) {
  const B = B_();
  if (yield* pursuitCheck()) return;
  yield* bmsg(__('{0}, that\'s enough! Come back!', pokeName(B.me)), { hold: 8 });
  yield* recall(0); B.me = B.meParty[idx];
  yield* bmsg(__('Go! {0}!', pokeName(B.me)), { hold: 6 }); yield* sendOut(0);
}
function* handleFaint(s) {
  const B = B_(); B.S[s].gone = true; (B.fainted = B.fainted || [])[s] = B.turn; btRestore(sideMon(s));
  yield* faint(s);
  if (s === 1) {
    if (B.kind === 'wild') { stopBGM(); playME('frlg_wildvictory'); }
    btRestoreStats(B.me); yield* giveExp(B.foe);
    const next = B.foeParty.find(p => p.hp > 0);
    if (!next) { B.result = 'win'; return; }
    B.foe = next; dexMarkSeen(next.sym);
    yield* bmsg(__('{0} is about to send out {1}!', B.trainer.name, pokeName(next)), { hold: 10 });
    yield* bmsg(__('Will {0} change Pokémon?', G.name), { hold: 0 });
    if ((yield* battleYesNo()) && B.meParty.filter(p => p.hp > 0).length > 1) {
      const r = yield* partyScreen({ mode: 'battle', text: 'Choose a Pokémon.', activeIdx: B.meParty.indexOf(B.me) });
      if (r >= 0 && B.meParty[r] !== B.me) { yield* recall(0); B.me = B.meParty[r]; yield* bmsg(__('Go! {0}!', pokeName(B.me)), { hold: 6 }); yield* sendOut(0); }
    }
    yield* bmsg(__('{0} sent out {1}!', B.trainer.name, pokeName(next)), { hold: 6 }); yield* sendOut(1);
  } else {
    if (!hasUsable(B.meParty)) { B.result = (B.scripted || B.softLose) ? 'scripted' : 'lose'; return; }
    B.msg = null;
    const r = yield* partyScreen({ mode: 'battle', text: 'Use which Pokémon next?', noCancel: true, activeIdx: -1 });
    B.me = B.meParty[r]; yield* bmsg(__('Go! {0}!', pokeName(B.me)), { hold: 6 }); yield* sendOut(0);
  }
}
function* resolveTurn(cmd) {
  const B = B_(); B.turn++;
  if (cmd.mega && canMega(B.me)) yield* doMega(0);
  if (canFoeMega()) yield* doMega(1);
  if (cmd.type === 'move') { const f = forcedMove(0); if (f != null) cmd.idx = f; }
  if (cmd.type === 'switch') yield* doSwitch(cmd.idx);
  else if (cmd.type === 'ball') { if (yield* throwBall(cmd.key)) return; }
  else if (cmd.type === 'run') { if (yield* tryRun()) return; }
  const actors = [];
  if (cmd.type === 'move') actors.push({ s: 0, mi: cmd.idx });
  if (!B.pursued) actors.push({ s: 1, mi: pickFoeMove() }); B.pursued = false;
  for (const a of actors) { const mv = a.mi === -1 ? { prio: 0 } : D.MV[sideMon(a.s).moves[a.mi].id]; a.prio = (mv.prio || 0) + abilPrio(a.s, mv); a.stall = abilOf(a.s) === 'STALL'; a.qc = hItem(sideMon(a.s)) === 'QUICKCLAW' && rnd(5) === 0; if (a.qc) a.prio += 0.5; a.spd = effStat(a.s, 3) + Math.random() * 0.5; a.mon = sideMon(a.s); }
  for (const a of actors) a.md = a.mi === -1 ? STRUGGLE : D.MV[a.mon.moves[a.mi].id];
  actors.sort((x, y) => (y.prio - x.prio) || ((x.stall ? 1 : 0) - (y.stall ? 1 : 0)) || (field().trickRoom > 0 ? x.spd - y.spd : y.spd - x.spd));
  B.queue = actors;
  for (const a of actors) {
    if (B.result) return;
    if (sideMon(a.s) !== a.mon || sideMon(a.s).hp <= 0) continue;   // fainted (and maybe replaced) before its turn: the queued move is lost
    if (a.qc) yield* bmsg(__('{0}\'s Quick Claw let it move first!', mname(a.s)), { hold: 8 });
    a.done = true;
    yield* useMove(a.s, a.mi);
    for (const s of [0, 1]) yield* checkItems(s);
    for (const s of [0, 1]) if (sideMon(s).hp <= 0 && !B.S[s].gone) { yield* handleFaint(s); if (B.result) return; }
    if (B.me.hp <= 0 || B.foe.hp <= 0) break;
  }
  if (B.result) return;
  yield* endOfTurn();
  for (const s of [0, 1]) if (!B.result && sideMon(s).hp <= 0 && !B.S[s].gone) yield* handleFaint(s);
}

function* battleMain(B) {
  const trainer = B.kind === 'trainer';
  B.spr.foeTr.vis = trainer; B.spr.meTr.vis = true; B.spr.foeTr.x = SW + 100; B.spr.meTr.x = -200;
  const g1 = tween(B.spr.foeTr, { x: FOE_BASE.x }, 26, easeOut), g2 = tween(B.spr.meTr, { x: ME_BASE.x }, 26, easeOut);
  for (let i = 0; i < 26; i++) { g1.next(); g2.next(); yield; }
  B.foe = B.foeParty.find(p => p.hp > 0); B.foeHp = B.foe.hp; dexMarkSeen(B.foe.sym);
  if (trainer) {
    yield* bmsg(__('{0} would like to battle!', B.trainer.name), { pause: true });
    yield* tween(B.spr.foeTr, { x: SW + 140 }, 14); B.spr.foeTr.vis = false;
    yield* bmsg(__('{0} sent out {1}!', B.trainer.name, pokeName(B.foe)), { hold: 6 });
    B.me = B.meParty.find(p => p.hp > 0); B.participants = new Set();
    yield* sendOut(1);
  } else {
    B.me = B.meParty.find(p => p.hp > 0);
    const sp = B.spr.foe; sp.vis = true; sp.a = 0;
    for (let i = 1; i <= 18; i++) { sp.a = i / 18; sp.dx = (1 - i / 18) * 120; yield; } sp.dx = 0;
    cry(B.foe.gender); yield* tween(B.box, { foe: 1 }, 10);
    yield* bmsg(__('A wild {0} appeared!', pokeName(B.foe)), { pause: true });
  }
  yield* bmsg(__('Go! {0}!', pokeName(B.me)), { hold: 6 });
  yield* tween(B.spr.meTr, { x: -220 }, 14); B.spr.meTr.vis = false;
  yield* sendOut(0);
  B.started = true;
  for (const s of [0, 1].sort((x, y) => effStat(y, 3) - effStat(x, 3))) if (sideMon(s) && sideMon(s).hp > 0) yield* abilSwitchIn(s);
  while (!B.result) {
    const cmd = yield* commandPhase();
    if (cmd.type === 'item') {
      if (B.result) continue;
      yield* useMove(1, pickFoeMove());
      if (B.me.hp <= 0 && !B.S[0].gone) yield* handleFaint(0);
      B.S.forEach(s => { s.protect = false; s.flinch = false; });
      continue;
    }
    yield* resolveTurn(cmd);
  }
  if (B.result === 'win' || B.result === 'caught') yield* abilAfterBattle();
  if (B.payday && (B.result === 'win' || B.result === 'caught')) { G.money += B.payday; yield* bmsg(__('{0} picked up ${1}!', G.name, B.payday), { pause: true }); }
  if (B.result === 'win' && trainer) {
    B.spr.foeTr.vis = true; B.spr.foeTr.x = SW + 100; yield* tween(B.spr.foeTr, { x: FOE_BASE.x }, 22, easeOut);
    stopBGM(); playME('frlg_trainervictory');
    yield* bmsg(__('{0} defeated {1}!', G.name, B.trainer.name), { pause: true });
    if (B.endText) yield* bmsg(B.trainer.name + ': ' + tr(B.endText), { pause: true });
    const money = B.trainer.money * Math.max(...B.foeParty.map(p => p.lvl)) * (B.happyHour ? 2 : 1);
    G.money += money; yield* bmsg(__('{0} got ${1} for winning!', G.name, money), { pause: true });
  } else if (B.result === 'scripted') {
    yield* bmsg(__('{0} is out of usable Pokémon!', G.name), { pause: true });
  } else if (B.result === 'lose') {
    yield* bmsg(__('{0} is out of usable Pokémon!', G.name), { pause: true });
    if (trainer) { const lost = Math.min(G.money, B.trainer.money * Math.max(...B.foeParty.map(p => p.lvl))); G.money -= lost; yield* bmsg(__('{0} paid ${1} to the winner...', G.name, lost), { pause: true }); }
    G.party.forEach(healMon);
  }
  yield* bwait(6);
  for (B.transOut = 1; B.transOut <= 30; B.transOut++) yield;
  G.fade = 1; G.fadeRelease = true;
}

function* runBattle(B) {
  const prev = G.bgm && G.bgm.name;
  playBGM(B.bgm || 'frlg_trainerbattle', 0.6);
  B.gen = battleMain(B);
  while (G.battle) yield;
  unMega(B); btRestoreAll(B);
  G.battleResult = (B.result === 'win' || B.result === 'caught') ? 'win' : B.result === 'ran' ? 'ran' : B.result === 'scripted' ? 'scripted' : 'lose';
  stopME(); stopBGM(); if (G.map && G.map.bgm) playBGM(G.map.bgm);
  G.keepDir = true;   // keep walking if a direction is still held when the battle ends
  if (G.battleResult !== 'lose') { const q = G.party.filter(p => p.evoCheck && p.hp >= 0 && evoTarget(p)); G.party.forEach(p => { p.evoCheck = false; }); if (q.length) { G.uiGen = evolveScene(q); yield; } }
}
function* evolveScene(list) {
  for (const p of list) {
    const to = p.forceEvo || evoTarget(p); if (!to) continue;
    const oldKey = sprKey(D.SP[p.sym]), newKey = sprKey(D.SP[to]);
    for (let w = 0; w < 120 && !(img('battlers', oldKey) && img('battlers', newKey)); w++) yield;   // sprites missing from the manifest load lazily: wait for them
    let oldIm = img('battlers', oldKey), newIm = img('battlers', newKey) || oldIm;
    const S = { k: 0, im: oldIm, white: 0 };
    const draw = () => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
      const im = S.im; if (im) { ctx.drawImage(im, SW / 2 - 96, 20, 192, 192); if (S.white > 0) { ctx.globalAlpha = S.white; ctx.drawImage(tintCanvas(im), SW / 2 - 96, 20, 192, 192); ctx.globalAlpha = 1; } }
      pic('battle/overlay_message', 0, SH - 96); drawUiMsg();
    };
    yield* withDraw(draw, (function* () {
      const oldName = pokeName(p);
      yield* uiMessage(__('What? {0} is evolving!', oldName));
      let cancelled = false;
      for (let f = 0; f < 180; f++) {
        yield;
        if (back()) { cancelled = true; break; }
        S.white = f < 60 ? f / 60 : 1; S.im = (f > 60 && Math.floor((f - 60) / Math.max(4, 24 - (f - 60) / 6)) % 2) ? newIm : oldIm;
      }
      if (cancelled) { stopBGM(); S.white = 0; S.im = oldIm; yield* uiMessage(__('Huh? {0} stopped evolving!', oldName)); return; }
      S.im = newIm; for (let f = 0; f < 30; f++) { S.white = 1 - f / 30; yield; } S.white = 0;
      stopBGM(); playME('frlg_fanfarepokemon');
      const hadNick = !!p.nick; p.sym = to; if (!hadNick) p.name = D.SP[to].name;
      const abl = D.SP[to].abilities.filter(Boolean); if (!abl.includes(p.ability)) p.ability = abl[0] || null;
      refreshStats(p); G.owned = G.owned || {}; G.owned[to] = true;
      yield* uiMessage(__('Congratulations! Your {0} evolved into {1}!', oldName, D.SP[to].name));
    })());
  }
}
// Battle music for story trainers: by trainer name (or by trainer class for the Rival / Champion). Anyone not listed keeps the default music.
const TRAINER_BGM = {
  'Tiagovski': 'hgss_gymbattle', 'Miss Mushrooms': 'hgss_gymbattle', 'Wuant': 'hgss_gymbattle', 'LegendBoy': 'hgss_gymbattle',
  'D4rkFrame': 'hgss_gymbattle', 'Feromonas': 'hgss_gymbattle', 'Nuno Agonia': 'hgss_gymbattle', 'SirKazzio': 'hgss_gymbattle',
  'Blue': 'PU-GymBattle', 'Lance': 'PU-GymBattle', 'Steven': 'PU-GymBattle', 'Cynthia': 'PU-GymBattle',
  'John Xina': 'bw2_neoplasmatheme', 'The Wok': 'bw2_neoplasmatheme', 'Da Wei': 'bw2_neoplasmatheme', 'Buffed Da Wei': 'bw2_neoplasmatheme',
  'Moreira': 'bdsp_palkiadialgatheme', 'Tiago': 'bw2_cynthiatheme', 'Goku': 'db_instinct', 'Nuno': 'ss_klaratheme',
  'Nel': 'hgss_trainerbattle', 'RicFazeres': 'oras_wallytheme', 'Uchikido': 'rs_trainerbattle',
};
const TRAINER_CLASS_BGM = { RIVAL2: 'bw_trainerbattle', GIGAGARDETE: 'bw_worldchampion' };
function* runTrainerBattle(script) {
  const m = script.match(/pbTrainerBattle\(PBTrainers::(\w+),"([^"]*)","((?:[^"\\]|\\.)*)",(?:true|false),(.+?)(?:,(?:true|false))?\)$/);
  let type = 'RIVAL2', name = 'Gardete', endText = '', vr = 0;
  if (m) {
    type = m[1]; name = m[2]; endText = m[3].replace(/\\"/g, '"');
    const ex = m[4].trim(), am = ex.match(/^\[([\d,\s]+)\]\[\$game_variables\[(\d+)\]\]$/);
    vr = am ? (am[1].split(',').map(Number)[G.vars[+am[2]] | 0] || 0) : (+ex || 0);
  }
  const tr = window.TRAINERS && TRAINERS[type + '|' + name + '|' + vr];
  if (!G.party.length) G.party.push(mkPoke('ILLYA', 5));
  const tt = (window.TTYPES && TTYPES[type]) || { id: 5, money: 48 };
  const rival = type === 'RIVAL2' ? (G.vars[12] || name) : name;
  let foeParty;
  if (tr) foeParty = tr.p.map(([sym, lvl, it, mv]) => { const q = mkPoke(sym, lvl, { moves: mv.filter(x => D.MV[x]).length ? mv.filter(x => D.MV[x]) : undefined, ot: rival }); if (it && D.IT && D.IT[it]) q.item = it; return q; });
  else { const sp = { 1: 'RORY', 2: 'HIZUNA', 3: 'ILLYA' }[G.vars[202] || 1]; foeParty = [mkPoke(sp, 5, { moves: ['TACKLE', 'GROWL'], ot: rival })]; }
  let savedParty = null;
  if (tr && tr.me) { savedParty = G.party; G.party = tr.me.map(([sym, lvl]) => mkPoke(sym, lvl, { ot: G.name })); }   // story fights where the player fights with a fixed team (e.g. Jorge himself)
  const B = mkBattle({ kind: 'trainer', foeParty, trainer: { name: __(rival), money: tt.money, sprite: tt.noSprite ? '' : 'trainer' + String(tt.sprite != null ? tt.sprite : tt.id).padStart(3, '0') }, bg: bgFor(G.mapId), endText, bgm: TRAINER_BGM[name] || TRAINER_CLASS_BGM[type] });
  if (tr && tr.scripted) B.scripted = true;
  if (tr && tr.softLose || /,\s*true\s*\)\s*$/.test(script)) B.softLose = true;   // losing does not black out: the event goes on (and may retry)
  try { yield* runBattle(B); } finally { if (savedParty) G.party = savedParty; }
}
function* runWildBattle(sym, lvl, bgm) {
  sym = symOf(sym);
  const B = mkBattle({ kind: 'wild', foeParty: [mkPoke(sym, lvl)], bg: bgFor(G.mapId), bgm: bgm || 'frlg_wildpoke' });
  yield* runBattle(B);
}
function updateBattle() {
  const B = G.battle; if (!B) return;
  if (B.transIn > 0) { B.transIn--; return; }
  if (B.intro > 0) { B.intro--; return; }
  if (B.flash > 0) B.flash = Math.max(0, B.flash - 0.08);
  for (const sp of [B.spr.me, B.spr.foe]) if (sp.shk > 0) sp.shk--;
  B.fx = B.fx.filter(f => ++f.t < f.life);
  const r = B.gen.next(); if (r.done) G.battle = null;
}

// ------------------------------------------------------------ drawing
const _tints = new Map();
function tintCanvas(im, col) {
  col = col || '#fff'; const key = col + '|'; let m = _tints.get(im); if (!m) _tints.set(im, m = {});
  let c = m[key]; if (c) return c;
  c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
  g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  m[key] = c; return c;
}
function drawSprite(sp, im, cx, bottom, size) {
  if (!sp.vis || !im) return;
  const w = size * sp.sc, h = size * sp.sc, shk = sp.shk > 0 ? (sp.shk % 4 < 2 ? 8 : -8) : 0;
  const x = cx - w / 2 + (sp.dx || 0) + shk, y = bottom - h + (sp.dy || 0), al = Math.max(0, Math.min(1, sp.a));
  ctx.globalAlpha = al; ctx.drawImage(im, x, y, w, h);
  if (sp.tint > 0) { ctx.globalAlpha = al * sp.tint; ctx.drawImage(tintCanvas(im, sp.tintCol), x, y, w, h); }
  ctx.globalAlpha = 1;
}
function drawDataBox(side) {
  const B = B_(); const mon = side === 0 ? B.me : B.foe; if (!mon) return;
  const bx = side === 0 ? BOX_ME : BOX_FOE; const t = side === 0 ? B.box.me : B.box.foe; if (t <= 0) return;
  const x = bx.x + (1 - easeOut(t)) * (side === 0 ? 300 : -300), y = bx.y, base = bx.base;
  pic(side === 0 ? 'battle/databox_normal' : 'battle/databox_normal_foe', x, y);
  txt(pokeName(mon), x + base + 12, y + 9, { size: 22 });
  if (mon.gender !== 2) txt(genderSym(mon.gender), x + base + 12 + Math.ceil(txtW(pokeName(mon), 22)) + 4, y + 9, { size: 22, col: genderCol(mon.gender) });
  pic('battle/overlay_lv', x + base + 148, y + 20); txt(mon.lvl, x + base + 172, y + 15, { size: 22 });
  const hp = side === 0 ? B.meHp : B.foeHp;
  const fw = Math.max(hp > 0 ? 2 : 0, Math.round(96 * hp / mon.maxhp));
  if (UI('battle/overlay_hp') && fw > 0) ctx.drawImage(UI('battle/overlay_hp'), 0, hpColorRow(hp, mon.maxhp) * 6, fw, 6, x + base + 102, y + 40, fw, 6);
  if (side === 0) {
    txt(Math.ceil(hp) + '/ ' + mon.maxhp, x + base + 202, y + 52, { size: 20, align: 'right' });
    const ex = Math.floor(192 * B.meExp); if (ex > 0) ctx.drawImage(UI('battle/overlay_exp'), 0, 0, ex, 4, x + base + 6, y + 76, ex, 4);
  } else if (B.kind === 'wild' && ownedSpecies(mon.sym)) pic('battle/icon_own', x + base + 6, y + 40);
  if (mon.status) drawStatus(mon.status, x + base + 6, y + 36);
  if (mon.megaBase && UI('battle/icon_mega')) pic('battle/icon_mega', x + base + 8, y + 34);   // Essentials: Mega icon on the databox
}
function drawBattleFx() {
  for (const f of B_().fx) {
    const base = f.s === 0 ? ME_BASE : FOE_BASE; const cx = base.x, cy = base.y - 50; const t = f.t / f.life;
    ctx.save(); ctx.globalAlpha = 1 - t * 0.8;
    if (f.kind === 'aura') { ctx.strokeStyle = f.color; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(cx, cy + 20, 40 + t * 50, 60 + t * 30, 0, 0, 7); ctx.stroke(); }
    else {
      ctx.fillStyle = f.color;
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + 0.3, r = 10 + t * 56; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, 12 * (1 - t) + 3, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, 14 + t * 44, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }
}
function ownedSpecies(sym) { return !!((G.owned && G.owned[sym]) || G.party.some(p => p.sym === sym) || pcAll().some(p => p.sym === sym)); }
const TRANS_N = 7;
// black cover for transition type t at progress k (0..1)
function transCover(t, k) {
  ctx.fillStyle = '#000'; const cx = SW / 2, cy = SH / 2;
  if (t === 0) { // alternating horizontal bars
    for (let i = 0; i < 12; i++) { const w = Math.max(0, Math.min(1, k * 1.7 - i * 0.05)) * SW; if (i % 2) ctx.fillRect(SW - w, i * 32, w, 32); else ctx.fillRect(0, i * 32, w, 32); }
  } else if (t === 1) { // iris closing
    const r = (1 - k) * Math.hypot(cx, cy); ctx.beginPath(); ctx.rect(0, 0, SW, SH); ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2, true); ctx.fill('evenodd');
  } else if (t === 2) { // vertical blinds
    for (let i = 0; i < 16; i++) { const h = Math.max(0, Math.min(1, k * 1.8 - (i % 8) * 0.07)) * SH; if (i % 2) ctx.fillRect(i * 32, SH - h, 32, h); else ctx.fillRect(i * 32, 0, 32, h); }
  } else if (t === 3) { // scattered squares
    for (let r = 0; r < 12; r++) for (let c = 0; c < 16; c++) { const d = ((c * 7 + r * 13) % 31) / 31; const sz = Math.max(0, Math.min(1, (k * 1.5 - d * 0.5) * 2)) * 32; ctx.fillRect(c * 32 + 16 - sz / 2, r * 32 + 16 - sz / 2, sz, sz); }
  } else if (t === 4) { // clock wipe
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 400, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.closePath(); ctx.fill();
  } else if (t === 5) { // doors closing from both sides + top/bottom
    const w = k * cx; ctx.fillRect(0, 0, w, SH); ctx.fillRect(SW - w, 0, w, SH);
  } else { // diagonal stripes sweeping
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, SW, SH); ctx.clip();
    for (let i = -12; i < 28; i++) { const prog = Math.max(0, Math.min(1, k * 1.6 - ((i + 12) / 40) * 0.6)); ctx.beginPath(); const x = i * 32; ctx.moveTo(x, 0); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 32 - SH * 0.5 * 0, 0); ctx.closePath();
      ctx.save(); ctx.translate(x, 0); ctx.transform(1, 0, -0.5, 1, 0, 0); ctx.fillRect(0, 0, 32 * prog + 1, SH); ctx.restore(); }
    ctx.restore();
  }
}
function drawTransIn(B) {
  const u = 1 - B.transIn / 56, t = B.transType || 0;
  if (B.snap) ctx.drawImage(B.snap, 0, 0); else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH); }
  if (u < 0.45) { const f = Math.abs(Math.sin(u / 0.45 * Math.PI * 2)); ctx.fillStyle = 'rgba(255,255,255,' + f * 0.85 + ')'; ctx.fillRect(0, 0, SW, SH); }
  else transCover(t, (u - 0.45) / 0.55);
}
function drawTransOut(B) { transCover(B.transType || 0, B.transOut / 30); }
function drawLineups(B) {
  if (B.kind !== 'trainer' || B.transIn > 0) return;
  const one = (party, foe) => {
    const n = Math.min(6, party.length), bw = 6 * 25 + 10, t = foe ? B.box.foe : B.box.me; if (t <= 0) return;
    const off = (1 - easeOut(t)) * (foe ? -300 : 300);
    const x0 = (foe ? 6 : SW - bw - 6) + off, y0 = foe ? BOX_FOE.y + 70 : BOX_ME.y - 18;
    const bar = UI('battle/overlay_lineup'); if (bar) ctx.drawImage(bar, 0, 0, bw, 8, x0, y0 + 20, bw, 8);
    for (let i = 0; i < 6; i++) {
      const p = party[i]; const nm = !p ? 'icon_ball_empty' : p.hp <= 0 ? 'icon_ball_faint' : p.status ? 'icon_ball_status' : 'icon_ball';
      const im = UI('battle/' + nm); if (im) ctx.drawImage(im, x0 + 5 + i * 25, y0 + 2, 24, 24);
    }
  };
  one(B.foeParty, true);
}
function drawBattle() {
  const B = G.battle; if (!B) return;
  if (B.transIn > 0) { drawTransIn(B); return; }
  const bg = img('battlebacks', 'battlebg' + B.bg), eb = img('battlebacks', 'enemybase' + B.bg), pb = img('battlebacks', 'playerbase' + B.bg);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
  if (bg) ctx.drawImage(bg, 0, 0);
  if (eb) ctx.drawImage(eb, FOE_BASE.x - 128, FOE_BASE.y - 78);
  if (pb) ctx.drawImage(pb, ME_BASE.x - 128 - 40, 288 - 64 + 4, 512, 64);
  const ftr = B.trainer && B.trainer.sprite && img('trainers', B.trainer.sprite);
  if (B.spr.foeTr.vis && ftr) { const sc = 1.3, w = ftr.width * sc, h = ftr.height * sc; ctx.drawImage(ftr, B.spr.foeTr.x - w / 2, FOE_BASE.y + 6 - h, w, h); }
  if (B.foe && !(B.anim && B.anim.cov[1])) { const sp = D.SP[B.foe.sym]; drawSprite(B.spr.foe, img('battlers', sprKey(sp)), FOE_BASE.x, FOE_BASE.y + 8 + (sp.enemyY || 0), 160); }
  const mtr = img('trainers', 'trback000');
  if (B.spr.meTr.vis && mtr) { const sc = 1.5, w = 128 * sc; ctx.drawImage(mtr, 0, 0, 128, 128, B.spr.meTr.x - w / 2, ME_BASE.y + 30 - w, w, w); }
  if (B.me && !(B.anim && B.anim.cov[0])) { const sp = D.SP[B.me.sym]; drawSprite(B.spr.me, img('battlers', sprKeyBack(sp)), ME_BASE.x, ME_BASE.y + 34 + (sp.playerY || 0), 160); }
  if (B.anim) drawAnim(B);
  drawBattleFx();
  if (B.spr.ball) { const b = B.spr.ball; const im = UI('battle/ball_0' + (b.id || 0) + (b.open ? '_open' : '')); if (im && b.vis !== false) { ctx.save(); ctx.globalAlpha = b.a === undefined ? 1 : b.a; if (b.dark) ctx.filter = 'brightness(0.55)'; ctx.translate(b.x + (b.dx || 0), b.y); ctx.rotate(b.rot || 0); ctx.drawImage(im, -16, -32); ctx.restore(); } }
  drawDataBox(1); drawDataBox(0);
  drawLineups(B);
  if (B.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + B.flash * 0.6 + ')'; ctx.fillRect(0, 0, SW, 288); }
  const m = B.menu;
  if (m && m.type === 'cmd') drawCmdMenu(B, m);
  else if (m && m.type === 'fight') drawFightMenu(B, m);
  else { pic('battle/overlay_message', 0, SH - 96); if (m && m.type === 'list') drawBList(B, m); else { drawBMsg(B); if (m && m.type === 'yn') drawBYesNo(m); } }
  if (B.lvBox) drawLevelBox(B.lvBox);
  if (B.intro > 0) { ctx.fillStyle = 'rgba(0,0,0,' + (B.intro / 28) + ')'; ctx.fillRect(0, 0, SW, SH); }
  if (B.forget) drawForget(B.forget);
  if (B.transOut > 0) drawTransOut(B);
}
const BTXT = { base: '#404040', shadow: '#b8b8b8', size: 26 };
function drawBMsg(B) {
  const m = B.msg;
  if (!m) { if (B.menuText) txt(B.menuText, 30, SH - 96 + 28, BTXT); return; }
  let left = m.shown;
  m.lines.forEach((ln, i) => { const s = ln.slice(0, Math.max(0, left)); left -= ln.length; if (s) txt(s, 30, SH - 96 + 28 + i * 32, BTXT); });
  if (m.wait && Math.floor(G.frame / 12) % 2 === 0) { ctx.fillStyle = '#d85048'; ctx.beginPath(); ctx.moveTo(480, SH - 26); ctx.lineTo(494, SH - 26); ctx.lineTo(487, SH - 16); ctx.fill(); }
}
function drawCmdMenu(B, m) {
  pic('battle/overlay_command', 0, SH - 96);
  const lines = wrap(B.menuText || '', 214, 26);
  lines.forEach((l, i) => txt(l, 20, SH - 96 + 28 + i * 30, BTXT));
  const rows = [0, 2, 1, 3];
  for (let i = 0; i < 4; i++) {
    const bx = 252 + (i % 2) * 130, by = SH - 96 + 2 + Math.floor(i / 2) * 46;
    ctx.drawImage(UI('battle/cursor_command'), i === m.idx ? 130 : 0, rows[i] * 46, 130, 46, bx, by, 130, 46);
  }
}
function drawFightMenu(B, m) {
  pic('battle/overlay_fight', 0, SH - 96);
  const me = B.me;
  if (m.mega > 0 && UI('battle/cursor_mega')) { ctx.drawImage(UI('battle/cursor_mega'), 0, (m.mega - 1) * 46, 96, 46, 146, SH - 96 - 46, 96, 46);
    if (m.mega === 1) { const k = (G.padOn || SET.touch) ? 'X' : 'C', lx = 146 + 66, ly = SH - 96 - 46 + 13; for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2]]) txt(k, lx + ox, ly + oy, { size: 24, align: 'center', base: '#101010', shadow: null }); txt(k, lx, ly, { size: 24, align: 'center', base: '#ffffff', shadow: null }); } }
  for (let i = 0; i < 4; i++) {
    const mv = me.moves[i]; if (!mv) continue;
    const x = 4 + (i % 2) * 192, y = SH - 96 + 2 + Math.floor(i / 2) * 46; const md = D.MV[mv.id];
    ctx.drawImage(UI('battle/cursor_fight'), i === m.idx ? 192 : 0, typeIndex(md.type) * 46, 192, 46, x, y, 192, 46);
    txt(md.name, x + 96, y + 12, { base: '#404040', shadow: '#c8c8c8', size: 22, align: 'center' });
  }
  const mv = me.moves[m.idx]; if (mv) {
    const md = D.MV[mv.id], mp = maxPP(mv);
    const col = mv.pp <= 0 ? '#e00808' : mv.pp <= mp / 4 ? '#e8a000' : '#404040';
    txt(__('PP'), 404, SH - 96 + 18, { base: col, shadow: '#c8c8c8', size: 22 }); txt(mv.pp + '/' + mp, 492, SH - 96 + 18, { base: col, shadow: '#c8c8c8', size: 22, align: 'right' });
    drawTypeIcon(md.type, 424, SH - 96 + 48);
  }
}
function drawBList(B, m) {
  txt(B.menuText || '', 30, SH - 96 + 28, BTXT);
  const h = m.labels.length * 30 + 28;
  skinBox('skin_choice_1', 270, SH - 96 - h + 10, 242, h);
  m.labels.forEach((l, i) => { const x = 308, y = SH - 96 - h + 10 + 14 + i * 30; txt(l, x, y, { size: 22 }); if (i === m.idx) pic('selarrow', x - 22, y); });
}
function drawBYesNo(m) {
  skinBox('skin_choice_1', SW - 120, SH - 96 - 80, 120, 80);
  ['YES', 'NO'].forEach((l, i) => { const y = SH - 96 - 80 + 14 + i * 28; txt(l, SW - 84, y, { size: 24 }); if (i === m.idx) pic('selarrow', SW - 106, y); });
}
function drawLevelBox(rows) {
  skinBox('skin_choice_1', SW - 200, 20, 200, 214);
  rows.forEach(([a, b], i) => { txt(a, SW - 180, 34 + i * 32, { size: 22 }); txt(b, SW - 20, 34 + i * 32, { size: 22, align: 'right' }); });
}
