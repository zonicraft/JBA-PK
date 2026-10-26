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

function newSide() { return { st: [0, 0, 0, 0, 0, 0, 0, 0], protect: false, protectN: 0, flinch: false, gone: false }; }
function bgFor(mapId) {
  const m = window.MAPS && MAPS[mapId], ts = m ? m.tileset : 1;
  if ([7, 87, 100].includes(mapId)) return 'City';
  if (mapId === 48) return 'Forest';
  if (ts === 6) return 'Cave';
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
  if (s === 0) { B.participants.add(mon); B.meExp = expRatio(mon); } else B.participants = new Set(B.me ? [B.me] : []);
  B[s === 0 ? 'meHp' : 'foeHp'] = mon.hp;
  const sx = s === 0 ? 70 : SW - 90, sy = s === 0 ? 200 : 110;
  const ball = B.spr.ball = { x: sx, y: sy, open: false, rot: 0, dx: 0, id: mon.ball || 0 };
  sfx('throw');
  const tx = base.x, ty = base.y - 30;
  for (let i = 1; i <= 20; i++) { const t = i / 20; ball.x = sx + (tx - sx) * t; ball.y = sy + (ty - sy) * t - Math.sin(t * Math.PI) * 60; ball.rot += 0.5; yield; }
  ball.open = true; ball.rot = 0; sfx('ballopen'); cry(D.SP[mon.sym].id); sp.vis = true; sp.a = 0; sp.sc = 0.1; sp.tint = 1; sp.dx = 0; sp.dy = 0; B.flash = 1;
  for (let i = 1; i <= 16; i++) { const t = i / 16; sp.a = Math.min(1, t * 2); sp.sc = 0.1 + 0.9 * easeOut(t); sp.tint = 1 - t; if (i === 6) B.spr.ball = null; yield; }
  sp.sc = 1; sp.a = 1; sp.tint = 0; B.spr.ball = null;
  yield* tween(B.box, { [s === 0 ? 'me' : 'foe']: 1 }, 10);
}
function* recall(s) {
  const B = B_(); const sp = sprOf(s);
  sfx('recall');
  for (let i = 1; i <= 14; i++) { const t = i / 14; sp.tint = t; sp.sc = 1 - 0.9 * t; sp.a = 1 - t; yield; }
  sp.vis = false; sp.tint = 0; sp.sc = 1; sp.a = 1;
  yield* tween(B.box, { [s === 0 ? 'me' : 'foe']: 0 }, 8);
}

// ------------------------------------------------------------ damage / effects
function effStat(s, idx) { const mon = sideMon(s); let v = mon.stats[idx] * stageMul(B_().S[s].st[idx]); if (idx === 3 && mon.status === 'PAR') v *= 0.5; return v; }
function moveTypeMul(md, tgt) { return md.type === 'QMARKS' ? 1 : typeMul(md.type, pokeTypes(tgt)); }
function calcDamage(us, md, crit) {
  const B = B_(), user = sideMon(us), tgt = sideMon(1 - us), ts = 1 - us;
  const phys = md.cat === 'Physical'; const ai = phys ? 1 : 4, di = phys ? 2 : 5;
  let as = B.S[us].st[ai], ds = B.S[ts].st[di];
  if (crit) { as = Math.max(0, as); ds = Math.min(0, ds); }
  const a = user.stats[ai] * stageMul(as), d = tgt.stats[di] * stageMul(ds);
  let dmg = Math.floor(Math.floor(Math.floor(2 * user.lvl / 5 + 2) * md.pow * a / d) / 50) + 2;
  if (crit) dmg = Math.floor(dmg * 1.5);
  dmg = Math.floor(dmg * (85 + rnd(16)) / 100);
  if (pokeTypes(user).includes(md.type)) dmg = Math.floor(dmg * 1.5);
  const eff = moveTypeMul(md, tgt); dmg = Math.floor(dmg * eff);
  if (phys && user.status === 'BRN') dmg = Math.floor(dmg / 2);
  return { dmg: eff === 0 ? 0 : Math.max(1, dmg), eff };
}
function mname(s) { const B = B_(); return (s === 1 ? (B.kind === 'wild' ? 'The wild ' : 'The opposing ') : '') + pokeName(sideMon(s)); }
function* changeStage(s, stat, delta) {
  const st = B_().S[s].st, nm = mname(s);
  if (delta > 0 && st[stat] >= 6) { yield* bmsg(nm + '\'s ' + STAGE_NAMES[stat] + ' won\'t go any higher!'); return; }
  if (delta < 0 && st[stat] <= -6) { yield* bmsg(nm + '\'s ' + STAGE_NAMES[stat] + ' won\'t go any lower!'); return; }
  st[stat] = Math.max(-6, Math.min(6, st[stat] + delta));
  const word = delta >= 3 ? 'rose drastically' : delta === 2 ? 'rose sharply' : delta === 1 ? 'rose' : delta === -1 ? 'fell' : delta === -2 ? 'harshly fell' : 'severely fell';
  if (window.ANIMS) yield* commonAnim(delta > 0 ? 'StatUp' : 'StatDown', s); else sfx(delta > 0 ? 'item' : 'buzzer');
  yield* bmsg(nm + '\'s ' + STAGE_NAMES[stat] + ' ' + word + '!');
}
function* inflict(s, status) {
  const mon = sideMon(s); const ty = pokeTypes(mon);
  if (mon.status || mon.hp <= 0) return false;
  if ((status === 'PSN' && (ty.includes('POISON') || ty.includes('STEEL'))) || (status === 'BRN' && ty.includes('FIRE')) || (status === 'FRZ' && ty.includes('ICE')) || (status === 'PAR' && ty.includes('ELECTRIC'))) return false;
  mon.status = status; if (status === 'SLP') mon.sleep = 1 + rnd(3);
  if (window.ANIMS) yield* commonAnim({ PSN: 'Poison', BRN: 'Burn', PAR: 'Paralysis', SLP: 'Sleep', FRZ: 'Frozen' }[status], s);
  const t = { PSN: ' was poisoned!', BRN: ' was burned!', PAR: ' is paralyzed! It may be unable to move!', SLP: ' fell asleep!', FRZ: ' was frozen solid!' }[status];
  yield* bmsg(mname(s) + t); return true;
}
function addFx(type, s, kind) { B_().fx.push({ t: 0, life: 22, color: TYPE_COLORS[type] || '#fff', s, kind }); }
function* attackAnim(us, md, status) {
  const f = window.ANIMS && findAnim(md, us, !!status);
  if (f) { yield* playAnim(f.idx, us, (md.target === '10' || md.target === '20') ? us : 1 - us, f.opp); return; }   // self moves target the user, so the other battler is left alone
  const sp = sprOf(us); const dir = us === 0 ? 1 : -1;
  if (!status && md.cat === 'Physical') { yield* tween(sp, { dx: 44 * dir }, 5); addFx(md.type, 1 - us, 'hit'); yield* tween(sp, { dx: 0 }, 7); }
  else { addFx(md.type, status ? us : 1 - us, status ? 'aura' : 'burst'); yield* bwait(22); }
}

function* useMove(us, mi) {
  const B = B_(), user = sideMon(us), tgt = sideMon(1 - us), ts = 1 - us, S = B.S[us];
  const slot = mi === -1 ? null : user.moves[mi];
  const md = !slot ? { name: 'Struggle', type: 'QMARKS', cat: 'Physical', pow: 50, acc: 0, fn: '0EE', eff: 0, prio: 0, target: '00' } : D.MV[slot.id];
  if (user.status === 'SLP') { user.sleep--; if (user.sleep > 0) { yield* bmsg(mname(us) + ' is fast asleep.'); return; } user.status = null; yield* bmsg(mname(us) + ' woke up!'); }
  if (user.status === 'FRZ') { if (rnd(5) === 0) { user.status = null; yield* bmsg(mname(us) + ' thawed out!'); } else { yield* bmsg(mname(us) + ' is frozen solid!'); return; } }
  if (S.flinch) { S.flinch = false; yield* bmsg(mname(us) + ' flinched and couldn\'t move!'); return; }
  if (user.status === 'PAR' && rnd(4) === 0) { yield* bmsg(mname(us) + ' is fully paralyzed! It can\'t move!'); return; }
  if (slot) slot.pp = Math.max(0, slot.pp - 1);
  yield* bmsg(mname(us) + ' used ' + md.name + '!', { hold: 12 });
  if (md.fn === '0AA') {
    if (rnd(Math.pow(3, S.protectN)) === 0) { yield* attackAnim(us, md, true); S.protect = true; S.protectN++; yield* bmsg(mname(us) + ' protected itself!'); } else { S.protectN = 0; yield* bmsg('But it failed!'); }
    return;
  }
  const isStatus = md.cat === 'Status' || md.pow === 0;
  const fx = STAGE_FX[md.fn];
  const onSelf = isStatus && fx && fx[0] === 'u' || md.target === '10' || md.target === '40' || md.fn === '0D5' || md.fn === '0D6';
  if (!onSelf) {
    if (B.S[ts].protect) { yield* bmsg(mname(ts) + ' protected itself!'); return; }
    if (md.acc > 0) { const chance = md.acc * accMul(S.st[6]) / accMul(B.S[ts].st[7]); if (rnd(100) >= chance) { yield* bmsg(mname(us) + '\'s attack missed!'); return; } }
  }
  if (!isStatus) {
    const nh = { '0BD': 2, '0BE': 2, '0BF': 3 }[md.fn] || (md.fn === '0C0' ? [2, 2, 2, 3, 3, 3, 4, 5][rnd(8)] : 1);
    const before = tgt.hp; let hits = 0, eff1 = 1;
    for (let hi = 0; hi < nh && tgt.hp > 0; hi++) {
      const hmd = md.fn === '0BF' ? Object.assign({}, md, { pow: (md.pow || 10) * (hi + 1) }) : md;   // Triple Kick gets stronger each hit
      const crit = rnd(16) === 0; const r = calcDamage(us, hmd, crit);
      yield* attackAnim(us, md);
      if (r.eff === 0) { yield* bmsg('It doesn\'t affect ' + mname(ts) + '...'); return; }
      eff1 = r.eff; hits++;
      tgt.hp = Math.max(0, tgt.hp - r.dmg);
      sfx(r.eff > 1 ? 'hitsuper' : r.eff < 1 ? 'hitweak' : 'hit'); sprOf(ts).shk = 18;
      yield* animHp(ts, tgt.hp);
      if (crit) yield* bmsg('A critical hit!', { hold: 12 });
    }
    if (eff1 > 1) yield* bmsg('It\'s super effective!', { hold: 12 }); else if (eff1 < 1) yield* bmsg('It\'s not very effective...', { hold: 12 });
    if (nh > 1) yield* bmsg('Hit ' + hits + ' time(s)!', { hold: 12 });
    const done = before - tgt.hp;
    if (md.fn === '0DD' || md.fn === '0DE') { user.hp = Math.min(user.maxhp, user.hp + Math.max(1, Math.floor(done / 2))); yield* animHp(us, user.hp); yield* bmsg(mname(ts) + ' had its energy drained!'); }
    if (md.fn === '0EE' || md.fn === '0F0' || md.fn === '0FA') { const rec = Math.max(1, Math.floor((md.fn === '0EE' ? user.maxhp : done) / 4)); user.hp = Math.max(0, user.hp - rec); sprOf(us).shk = 10; yield* animHp(us, user.hp); yield* bmsg(mname(us) + ' is damaged by recoil!'); }
    if (tgt.hp > 0) {
      const chance = md.eff || 0;
      if ((md.fn === '00F' || md.fn === '010') && rnd(100) < (chance || 30)) B.S[ts].flinch = true;
      else if (STATUS_FX[md.fn] && rnd(100) < chance) yield* inflict(ts, STATUS_FX[md.fn]);
      else if (fx && chance && rnd(100) < chance) for (const [stt, dl] of fx[1]) yield* changeStage(fx[0] === 'u' ? us : ts, stt, dl);
    }
  } else if (fx) {
    yield* attackAnim(us, md, true);
    for (const [stt, dl] of fx[1]) yield* changeStage(fx[0] === 'u' ? us : ts, stt, dl);
  } else if (STATUS_FX[md.fn]) {
    yield* attackAnim(us, md, true);
    if (!(yield* inflict(ts, STATUS_FX[md.fn]))) yield* bmsg('But it failed!');
  } else if (md.fn === '0D5' || md.fn === '0D6') {
    if (user.hp >= user.maxhp) { yield* bmsg(mname(us) + '\'s HP is full!'); return; }
    if (window.ANIMS) yield* commonAnim('HealthUp', us); else sfx('item'); user.hp = Math.min(user.maxhp, user.hp + Math.floor(user.maxhp / 2)); yield* animHp(us, user.hp); yield* bmsg(mname(us) + ' regained health!');
  } else { yield* attackAnim(us, md, true); yield* bmsg('But nothing happened!'); }
}

// ------------------------------------------------------------ end of turn / faint / exp
function* endOfTurn() {
  const B = B_();
  for (const s of [0, 1]) {
    const mon = sideMon(s); if (mon.hp <= 0) continue;
    if (mon.status === 'PSN' || mon.status === 'BRN') {
      const d = Math.max(1, Math.floor(mon.maxhp / (mon.status === 'PSN' ? 8 : 16)));
      mon.hp = Math.max(0, mon.hp - d); sfx('hit'); sprOf(s).shk = 10; yield* animHp(s, mon.hp);
      yield* bmsg(mname(s) + ' was hurt by its ' + (mon.status === 'PSN' ? 'poisoning' : 'burn') + '!');
    }
  }
  B.S.forEach(s => { s.protect = false; s.flinch = false; });
}
function* faint(s) {
  const B = B_(); const sp = sprOf(s);
  sfx('faint');
  for (let i = 1; i <= 18; i++) { const t = i / 18; sp.dy = t * 70; sp.a = 1 - t; yield; }
  sp.vis = false; sp.dy = 0; sp.a = 1; yield* tween(B.box, { [s === 0 ? 'me' : 'foe']: 0 }, 8);
  yield* bmsg(mname(s) + ' fainted!');
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
    if (fought) yield* bmsg(pokeName(p) + ' gained ' + each + ' Exp. Points!', { hold: 8 });
    else if (!told) { told = true; yield* bmsg('The rest of the team gained ' + each + ' Exp. Points!', { hold: 8 }); }
    applyEvs(p, foe.sym);
    const active = p === B.me, from = expRatio(p);
    const levels = gainExp(p, each);
    if (active) { sfx('exp'); yield* animExp(from, levels.length ? 1 : expRatio(p)); }
    for (const lv of levels) {
      if (active) { B.meHp = p.hp; B.meExp = 0; }
      sfx('Pkmn_exp_full');
      yield* bmsg(pokeName(p) + ' grew to Lv. ' + lv.lvl + '!', { pause: true });
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
  if (p.moves.length < 4) { p.moves.push(newMoveSlot(id)); sfx('Pkmn_move_learnt'); yield* bmsg(pokeName(p) + ' learned ' + md.name + '!', { pause: true }); return; }
  while (true) {
    yield* bmsg(pokeName(p) + ' wants to learn ' + md.name + ', but ' + pokeName(p) + ' already knows four moves.', { pause: true });
    yield* bmsg('Delete a move to make room for ' + md.name + '?', { hold: 0 });
    if (!(yield* battleYesNo())) { yield* bmsg(pokeName(p) + ' did not learn ' + md.name + '.', { pause: true }); return; }
    const r = yield* forgetScreen(p, id);
    if (r < 0) continue;
    const old = D.MV[p.moves[r].id].name; p.moves[r] = newMoveSlot(id);
    yield* bmsg('1, 2, and... ... ... Poof!', { pause: true });
    yield* bmsg(pokeName(p) + ' forgot ' + old + '. And...', { pause: true });
    sfx('Pkmn_move_learnt'); yield* bmsg(pokeName(p) + ' learned ' + md.name + '!', { pause: true }); return;
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
  wrap(md.desc, 224, 20).slice(0, 4).forEach((l, i) => Dk(l, 8, 230 + i * 28, { size: 20 }));
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
function* commandPhase() {
  const B = B_(); const me = B.me; let idx = B.lastCmd;
  if (window.__forceCmd) { const c = window.__forceCmd; window.__forceCmd = null; return c; }
  while (true) {
    B.msg = null; B.menu = { type: 'cmd', idx }; B.menuText = 'What will ' + pokeName(me) + ' do?';
    while (true) { yield; yield* gridNav(B.menu, 4); if (ok()) { sfx('ok'); idx = B.menu.idx; break; } }
    B.lastCmd = idx; B.menu = null;
    if (idx === 0) {
      if (!me.moves.some(m => m.pp > 0)) { yield* bmsg(pokeName(me) + ' has no moves left!', { hold: 12 }); return { type: 'move', idx: -1 }; }
      let mi = Math.min(B.lastMove, me.moves.length - 1);
      while (true) {
        B.menu = { type: 'fight', idx: mi }; let sel = -2;
        while (true) { yield; yield* gridNav(B.menu, me.moves.length); mi = B.menu.idx; if (ok()) { sfx('ok'); sel = mi; break; } if (back()) { sfx('back'); sel = -1; break; } }
        B.menu = null;
        if (sel === -1) break;
        if (me.moves[sel].pp <= 0) { sfx('buzzer'); yield* bmsg('There\'s no PP left for this move!', { hold: 16 }); continue; }
        B.lastMove = sel; return { type: 'move', idx: sel };
      }
    } else if (idx === 1) {
      const key = yield* bagScreen({ mode: 'battle' });
      if (!key) continue;
      if (itemInfo(key).pocket === 3) {
        if (B.kind === 'trainer') { yield* bmsg('The Trainer blocked the Ball! Don\'t be a thief!', { pause: true }); continue; }
        return { type: 'ball', key };
      }
      const r = yield* partyScreen({ mode: 'item', text: 'Use on which Pokémon?', use: (p, i, S) => useItemOn(key, p, S) });
      B.meHp = B.me.hp;
      if (r >= 0) return { type: 'item' };
    } else if (idx === 2) {
      const r = yield* partyScreen({ mode: 'battle', text: 'Choose a Pokémon.', activeIdx: B.meParty.indexOf(me) });
      if (r >= 0) return { type: 'switch', idx: r };
    } else if (idx === 3) {
      if (B.kind === 'trainer') { yield* bmsg('No! There\'s no running from a Trainer battle!', { pause: true }); continue; }
      return { type: 'run' };
    }
  }
}

// ------------------------------------------------------------ AI
function pickFoeMove() {
  const B = B_(), foe = B.foe; const opts = foe.moves.map((m, i) => ({ m, i })).filter(o => o.m.pp > 0);
  if (!opts.length) return -1;
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
  yield* bmsg(G.name + ' threw one ' + it.name + '!', { hold: 4 });
  const bid = { POKEBALL: 0, GREATBALL: 1, ULTRABALL: 2, MASTERBALL: 3 }[key] || 0;
  // ---- catch roll (kept as before) ----
  const sh = D.SP[foe.sym], stat = foe.status === 'SLP' || foe.status === 'FRZ' ? 2 : foe.status ? 1.5 : 1;
  const a = Math.min(255, ((3 * foe.maxhp - 2 * foe.hp) * Math.max(sh.catch, 120) * mul) / (3 * foe.maxhp) * stat * 1.5);   // forgiving catch rate
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
    yield* bmsg(shakes === 0 ? 'Oh no! The Pokémon broke free!' : shakes === 1 ? 'Aww... It appeared to be caught!' : shakes === 2 ? 'Aargh! Almost had it!' : 'Gah! It was so close, too!', { pause: true });
    return false;
  }
  // captured: ball goes dark and stays on the ground
  b.dark = true; playSE('Battle_ball_drop', 1); sp.dy = 0; sp.tintCol = null; sp.tint = 0;
  yield* bmsg('Gotcha! ' + pokeName(foe) + ' was caught!', { pause: true });
  stopBGM(); playME('frlg_pokemoncaught');
  foe.ot = G.name; foe.met = mapNameOf(G.mapId); foe.metLvl = foe.lvl; foe.ball = bid; G.owned = G.owned || {}; G.owned[foe.sym] = true;
  yield* bwait(140);
  for (let i = 0; i < 21; i++) { b.a = Math.max(0, 1 - i / 21); yield; }       // pbHideCaptureBall fade-out
  B.spr.ball = null;
  if (G.party.length < 6) { G.party.push(foe); yield* bmsg(pokeName(foe) + ' was added to your party.', { hold: 20 }); } else { pcAdd(foe); yield* bmsg(pokeName(foe) + ' was sent to the PC.', { hold: 20 }); }
  B.result = 'caught'; return true;
}
function* tryRun() {
  const B = B_(); B.runN++;
  const a = effStat(0, 3), b = effStat(1, 3);
  if (a >= b || rnd(256) < Math.floor(a * 128 / Math.max(1, b)) + 30 * B.runN) { sfx('run'); yield* bmsg('Got away safely!', { pause: true }); B.result = 'ran'; return true; }
  yield* bmsg('Can\'t escape!', { pause: true }); return false;
}

// ------------------------------------------------------------ turn loop
function* doSwitch(idx) {
  const B = B_();
  yield* bmsg(pokeName(B.me) + ', that\'s enough! Come back!', { hold: 8 });
  yield* recall(0); B.me = B.meParty[idx];
  yield* bmsg('Go! ' + pokeName(B.me) + '!', { hold: 6 }); yield* sendOut(0);
}
function* handleFaint(s) {
  const B = B_(); B.S[s].gone = true;
  yield* faint(s);
  if (s === 1) {
    if (B.kind === 'wild') { stopBGM(); playME('frlg_wildvictory'); }
    yield* giveExp(B.foe);
    const next = B.foeParty.find(p => p.hp > 0);
    if (!next) { B.result = 'win'; return; }
    B.foe = next; dexMarkSeen(next.sym);
    yield* bmsg(B.trainer.name + ' is about to send out ' + pokeName(next) + '!', { hold: 10 });
    yield* bmsg('Will ' + G.name + ' change Pokémon?', { hold: 0 });
    if ((yield* battleYesNo()) && B.meParty.filter(p => p.hp > 0).length > 1) {
      const r = yield* partyScreen({ mode: 'battle', text: 'Choose a Pokémon.', activeIdx: B.meParty.indexOf(B.me) });
      if (r >= 0 && B.meParty[r] !== B.me) { yield* recall(0); B.me = B.meParty[r]; yield* bmsg('Go! ' + pokeName(B.me) + '!', { hold: 6 }); yield* sendOut(0); }
    }
    yield* bmsg(B.trainer.name + ' sent out ' + pokeName(next) + '!', { hold: 6 }); yield* sendOut(1);
  } else {
    if (!hasUsable(B.meParty)) { B.result = 'lose'; return; }
    B.msg = null;
    const r = yield* partyScreen({ mode: 'battle', text: 'Use which Pokémon next?', noCancel: true, activeIdx: -1 });
    B.me = B.meParty[r]; yield* bmsg('Go! ' + pokeName(B.me) + '!', { hold: 6 }); yield* sendOut(0);
  }
}
function* resolveTurn(cmd) {
  const B = B_(); B.turn++;
  if (cmd.type === 'switch') yield* doSwitch(cmd.idx);
  else if (cmd.type === 'ball') { if (yield* throwBall(cmd.key)) return; }
  else if (cmd.type === 'run') { if (yield* tryRun()) return; }
  const actors = [];
  if (cmd.type === 'move') actors.push({ s: 0, mi: cmd.idx });
  actors.push({ s: 1, mi: pickFoeMove() });
  for (const a of actors) { const mv = a.mi === -1 ? { prio: 0 } : D.MV[sideMon(a.s).moves[a.mi].id]; a.prio = mv.prio || 0; a.spd = effStat(a.s, 3) + Math.random() * 0.5; a.mon = sideMon(a.s); }
  actors.sort((x, y) => (y.prio - x.prio) || (y.spd - x.spd));
  for (const a of actors) {
    if (B.result) return;
    if (sideMon(a.s) !== a.mon || sideMon(a.s).hp <= 0) continue;   // fainted (and maybe replaced) before its turn: the queued move is lost
    yield* useMove(a.s, a.mi);
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
    yield* bmsg(B.trainer.name + ' would like to battle!', { pause: true });
    yield* tween(B.spr.foeTr, { x: SW + 140 }, 14); B.spr.foeTr.vis = false;
    yield* bmsg(B.trainer.name + ' sent out ' + pokeName(B.foe) + '!', { hold: 6 });
    B.me = B.meParty.find(p => p.hp > 0); B.participants = new Set();
    yield* sendOut(1);
  } else {
    B.me = B.meParty.find(p => p.hp > 0);
    const sp = B.spr.foe; sp.vis = true; sp.a = 0;
    for (let i = 1; i <= 18; i++) { sp.a = i / 18; sp.dx = (1 - i / 18) * 120; yield; } sp.dx = 0;
    cry(D.SP[B.foe.sym].id); yield* tween(B.box, { foe: 1 }, 10);
    yield* bmsg('A wild ' + pokeName(B.foe) + ' appeared!', { pause: true });
  }
  yield* bmsg('Go! ' + pokeName(B.me) + '!', { hold: 6 });
  yield* tween(B.spr.meTr, { x: -220 }, 14); B.spr.meTr.vis = false;
  yield* sendOut(0);
  while (!B.result) {
    const cmd = yield* commandPhase();
    if (cmd.type === 'item') {
      yield* useMove(1, pickFoeMove());
      if (B.me.hp <= 0 && !B.S[0].gone) yield* handleFaint(0);
      B.S.forEach(s => { s.protect = false; s.flinch = false; });
      continue;
    }
    yield* resolveTurn(cmd);
  }
  if (B.result === 'win' && trainer) {
    B.spr.foeTr.vis = true; B.spr.foeTr.x = SW + 100; yield* tween(B.spr.foeTr, { x: FOE_BASE.x }, 22, easeOut);
    stopBGM(); playME('frlg_trainervictory');
    yield* bmsg(G.name + ' defeated ' + B.trainer.name + '!', { pause: true });
    if (B.endText) yield* bmsg(B.trainer.name + ': ' + B.endText, { pause: true });
    const money = B.trainer.money * Math.max(...B.foeParty.map(p => p.lvl));
    G.money += money; yield* bmsg(G.name + ' got $' + money + ' for winning!', { pause: true });
  } else if (B.result === 'lose') {
    yield* bmsg(G.name + ' is out of usable Pokémon!', { pause: true });
    if (trainer) { const lost = Math.min(G.money, B.trainer.money * Math.max(...B.foeParty.map(p => p.lvl))); G.money -= lost; yield* bmsg(G.name + ' paid $' + lost + ' to the winner...', { pause: true }); }
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
  G.battleResult = (B.result === 'win' || B.result === 'caught') ? 'win' : B.result === 'ran' ? 'ran' : 'lose';
  stopME(); stopBGM(); if (G.map && G.map.bgm) playBGM(G.map.bgm);
  G.keepDir = true;   // keep walking if a direction is still held when the battle ends
  if (G.battleResult !== 'lose') { const q = G.party.filter(p => p.evoCheck && p.hp >= 0 && evoTarget(p)); G.party.forEach(p => { p.evoCheck = false; }); if (q.length) { G.uiGen = evolveScene(q); yield; } }
}
function* evolveScene(list) {
  for (const p of list) {
    const to = evoTarget(p); if (!to) continue;
    const oldKey = String(D.SP[p.sym].id).padStart(3, '0'), newKey = String(D.SP[to].id).padStart(3, '0');
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
      yield* uiMessage('What? ' + oldName + ' is evolving!');
      let cancelled = false;
      for (let f = 0; f < 180; f++) {
        yield;
        if (back()) { cancelled = true; break; }
        S.white = f < 60 ? f / 60 : 1; S.im = (f > 60 && Math.floor((f - 60) / Math.max(4, 24 - (f - 60) / 6)) % 2) ? newIm : oldIm;
      }
      if (cancelled) { stopBGM(); S.white = 0; S.im = oldIm; yield* uiMessage('Huh? ' + oldName + ' stopped evolving!'); return; }
      S.im = newIm; for (let f = 0; f < 30; f++) { S.white = 1 - f / 30; yield; } S.white = 0;
      stopBGM(); playME('frlg_fanfarepokemon');
      const hadNick = !!p.nick; p.sym = to; if (!hadNick) p.name = D.SP[to].name;
      const abl = D.SP[to].abilities.filter(Boolean); if (!abl.includes(p.ability)) p.ability = abl[0] || null;
      refreshStats(p); G.owned = G.owned || {}; G.owned[to] = true;
      yield* uiMessage('Congratulations! Your ' + oldName + ' evolved into ' + D.SP[to].name + '!');
    })());
  }
}
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
  if (tr) foeParty = tr.p.map(([sym, lvl, , mv]) => mkPoke(sym, lvl, { moves: mv.filter(x => D.MV[x]).length ? mv.filter(x => D.MV[x]) : undefined, ot: rival }));
  else { const sp = { 1: 'RORY', 2: 'HIZUNA', 3: 'ILLYA' }[G.vars[202] || 1]; foeParty = [mkPoke(sp, 5, { moves: ['TACKLE', 'GROWL'], ot: rival })]; }
  const B = mkBattle({ kind: 'trainer', foeParty, trainer: { name: rival, money: tt.money, sprite: 'trainer' + String(tt.id).padStart(3, '0') }, bg: bgFor(G.mapId), endText });
  yield* runBattle(B);
}
function* runWildBattle(sym, lvl) {
  sym = symOf(sym);
  const B = mkBattle({ kind: 'wild', foeParty: [mkPoke(sym, lvl)], bg: bgFor(G.mapId), bgm: 'frlg_wildpoke' });
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
  const ftr = B.trainer && img('trainers', B.trainer.sprite);
  if (B.spr.foeTr.vis && ftr) { const sc = 1.3, w = ftr.width * sc, h = ftr.height * sc; ctx.drawImage(ftr, B.spr.foeTr.x - w / 2, FOE_BASE.y + 6 - h, w, h); }
  if (B.foe && !(B.anim && B.anim.cov[1])) { const sp = D.SP[B.foe.sym]; drawSprite(B.spr.foe, img('battlers', String(sp.id).padStart(3, '0')), FOE_BASE.x, FOE_BASE.y + 8 + (sp.enemyY || 0), 160); }
  const mtr = img('trainers', 'trback000');
  if (B.spr.meTr.vis && mtr) { const sc = 1.5, w = 128 * sc; ctx.drawImage(mtr, 0, 0, 128, 128, B.spr.meTr.x - w / 2, ME_BASE.y + 30 - w, w, w); }
  if (B.me && !(B.anim && B.anim.cov[0])) { const sp = D.SP[B.me.sym]; drawSprite(B.spr.me, img('battlers', String(sp.id).padStart(3, '0') + 'b'), ME_BASE.x, ME_BASE.y + 34 + (sp.playerY || 0), 160); }
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
  for (let i = 0; i < 4; i++) {
    const mv = me.moves[i]; if (!mv) continue;
    const x = 4 + (i % 2) * 192, y = SH - 96 + 2 + Math.floor(i / 2) * 46; const md = D.MV[mv.id];
    ctx.drawImage(UI('battle/cursor_fight'), i === m.idx ? 192 : 0, typeIndex(md.type) * 46, 192, 46, x, y, 192, 46);
    txt(md.name, x + 96, y + 12, { base: '#404040', shadow: '#c8c8c8', size: 22, align: 'center' });
  }
  const mv = me.moves[m.idx]; if (mv) {
    const md = D.MV[mv.id], mp = maxPP(mv);
    const col = mv.pp <= 0 ? '#e00808' : mv.pp <= mp / 4 ? '#e8a000' : '#404040';
    txt('PP', 404, SH - 96 + 18, { base: col, shadow: '#c8c8c8', size: 22 }); txt(mv.pp + '/' + mp, 492, SH - 96 + 18, { base: col, shadow: '#c8c8c8', size: 22, align: 'right' });
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
