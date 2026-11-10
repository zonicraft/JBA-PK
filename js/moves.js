'use strict';
// ===================================================================
//  Move effects. Loaded after battle.js: redefines calcDamage / useMove and adds the MFX table
//  (function code -> effect), the way Essentials keys PokeBattle_Move_XXX classes.
//  MFX entry keys:
//    acc 'never'|'ohko'   power(c,base,hit)   type(c)   fixed(c)       -> damage computation
//    atkFromTarget  atkStat  defStat  ignoreDefStages                  -> which stats are used
//    crit 'always'|n(extra stage)
//    fail(c) -> true to make the move fail          onMiss(c)
//    recoil (fraction of damage)  recoilMax (fraction of user max HP)  drain (fraction)
//    selfStat [[stat,delta]..]    suicide   cap1 (leave 1 HP)
//    after(c)   sec(c)  (generators run after the damage)   status(c) (non-damaging moves)
// ===================================================================
const MFX = {};
const HP_TYPES = ['FIGHTING', 'FLYING', 'POISON', 'GROUND', 'ROCK', 'BUG', 'GHOST', 'STEEL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'PSYCHIC', 'ICE', 'DRAGON', 'DARK'];
const STRUGGLE = { name: 'Struggle', type: 'QMARKS', cat: 'Physical', pow: 50, acc: 0, fn: '002', eff: 0, prio: 0, target: '00', flags: 'ab' };
const hasFlag = (md, f) => (md.flags || '').includes(f);
const sumPos = st => st.slice(1, 8).reduce((a, v) => a + Math.max(0, v), 0);
const weightOf = m => ((D.SP[m.sym] && D.SP[m.sym].weight) || 50) * (({ HEAVYMETAL: 2, LIGHTMETAL: 0.5 })[abilOfMon(m)] || 1);
const critStage = c => (abilOf(c.us) === 'SUPERLUCK' ? 1 : 0) + (hasFlag(c.md, 'h') ? 1 : 0) + (c.S.direHit ? 2 : 0) + (['SCOPELENS', 'RAZORCLAW'].includes(hItem(c.user)) ? 1 : 0) + (c.fx.crit > 0 ? c.fx.crit : 0);
const CRIT_DEN = [16, 8, 2, 1];
function mnameL(s) { const B = B_(); return s === 1 ? (B.kind === 'wild' ? __('the wild {0}', pokeName(sideMon(s))) : __('the opposing {0}', pokeName(sideMon(s)))) : pokeName(sideMon(s)); }   // for use mid-sentence
function effOf(c, type) {
  type = type || c.type; if (type === 'QMARKS') return 1;
  let ty = pokeTypes(c.tgt);
  if (type === 'GROUND') {
    if (!c.fx.hitsFlying && (c.T.magnetRise > 0 || c.T.telekinesis > 0 || tAb(c) === 'LEVITATE') && !(c.T.smackDown || field().gravity > 0)) return 0;
    if (c.fx.hitsFlying || isGrounded(c.ts)) ty = ty.filter(t => t !== 'FLYING');
  }
  if (c.fx.freezeDry && type === 'ICE' && ty.includes('WATER')) { const rest = ty.filter(t => t !== 'WATER'); return (rest.length ? typeMul('ICE', rest) : 1) * 2; }
  if ((c.T.foresight || abilOf(c.us) === 'SCRAPPY') && (type === 'NORMAL' || type === 'FIGHTING')) ty = ty.filter(t => t !== 'GHOST');
  if (c.T.miracle && type === 'DARK') ty = ty.filter(t => t !== 'PSYCHIC');
  let r0 = ty.length ? typeMul(type, ty) : 1;
  if (type === 'FIRE' && c.T.tarShot) r0 *= 2;
  if (c.md.fn === '144' && type === 'FIGHTING' && ty.length) r0 *= typeMul('FLYING', ty);
  return r0;
}
function* failMsg() { yield* bmsg(__('But it failed!')); }

// ---------------------------------------------------------------- damage
function calcDamage(c, crit) {
  const B = B_(), { us, ts, user, tgt, md, fx } = c;
  const phys = fx.cat ? fx.cat(c) === 'Physical' : md.cat === 'Physical';
  const aMon = fx.atkFromTarget ? tgt : user, aSide = fx.atkFromTarget ? ts : us;
  const aIdx = fx.atkStat !== undefined ? fx.atkStat : (phys ? 1 : 4), dIdx = fx.defStat !== undefined ? fx.defStat : (phys ? 2 : 5);
  let as = B.S[aSide].st[aIdx], ds = B.S[ts].st[dIdx];
  if (fx.ignoreDefStages || abilOf(us) === 'UNAWARE') ds = 0;
  if (tAb(c) === 'UNAWARE') as = 0;
  if (crit) { as = Math.max(0, as); ds = Math.min(0, ds); }
  const F = field(), tt = team(ts);
  const dI2 = F.wonderRoom > 0 && (dIdx === 2 || dIdx === 5) ? 7 - dIdx : dIdx;
  const a = aMon.stats[aIdx] * stageMul(as), d = tgt.stats[dI2] * stageMul(ds) * (dIdx === 5 && hItem(tgt) === 'ASSAULTVEST' ? 1.5 : 1) * (dIdx === 5 && F.weather === 'SAND' && pokeTypes(tgt).includes('ROCK') ? 1.5 : 1);
  let dmg = Math.floor(Math.floor(Math.floor(2 * user.lvl / 5 + 2) * c.pow * a / d) / 50) + 2;
  if (crit) dmg = Math.floor(dmg * 1.5);
  if (c.dbl) dmg *= 2;
  if (F.mudSport && c.type === 'ELECTRIC') dmg = Math.floor(dmg / 3);
  if (F.waterSport && c.type === 'FIRE') dmg = Math.floor(dmg / 3);
  dmg = Math.floor(dmg * (85 + rnd(16)) / 100);
  if (pokeTypes(user).includes(c.type)) dmg = Math.floor(dmg * (abilOf(us) === 'ADAPTABILITY' ? 2 : 1.5));
  if (wx() === 'SUN') { if (c.type === 'FIRE') dmg = Math.floor(dmg * 1.5); else if (c.type === 'WATER') dmg = Math.floor(dmg / 2); }
  else if (wx() === 'RAIN') { if (c.type === 'WATER') dmg = Math.floor(dmg * 1.5); else if (c.type === 'FIRE') dmg = Math.floor(dmg / 2); }
  if (F.terrain && isGrounded(c.us)) { if ((F.terrain === 'ELECTRIC' && c.type === 'ELECTRIC') || (F.terrain === 'GRASSY' && c.type === 'GRASS') || (F.terrain === 'PSYCHIC' && c.type === 'PSYCHIC')) dmg = Math.floor(dmg * 1.5); }
  if (F.terrain === 'MISTY' && c.type === 'DRAGON' && isGrounded(c.ts)) dmg = Math.floor(dmg / 2);
  if (F.terrain === 'GRASSY' && ['Earthquake', 'Bulldoze', 'Magnitude'].includes(md.name) && isGrounded(c.ts)) dmg = Math.floor(dmg / 2);
  const eff = effOf(c); dmg = Math.floor(dmg * eff);
  dmg = Math.floor(dmg * abilDmgMul(c, crit, eff, phys));
  const md2 = Object.assign({}, md, { type: c.type });
  const ai2 = atkItem(user, md2, eff); dmg = Math.floor(dmg * ai2.m);
  let berry = false; if (eff > 0 && RESIST_BERRY[hItem(tgt)] === c.type && (eff > 1 || c.type === 'NORMAL')) { dmg = Math.floor(dmg / 2); berry = true; }
  if (phys && user.status === 'BRN' && !fx.noBurnDrop && abilOf(us) !== 'GUTS') dmg = Math.floor(dmg / 2);
  if (!crit && !fx.ignoreScreens && abilOf(us) !== 'INFILTRATOR' && (tt.auroraVeil > 0 || (phys ? tt.reflect > 0 : tt.lightScreen > 0))) dmg = Math.floor(dmg / 2);
  return { dmg: eff === 0 ? 0 : Math.max(1, dmg), eff, gem: ai2.gem && eff > 0, berry };
}

// ---------------------------------------------------------------- the move pipeline
function* useMove(us, mi) {
  const B = B_(), user = sideMon(us), S = B.S[us];
  const slot = mi === -1 ? null : user.moves[mi];
  const md = slot ? D.MV[slot.id] : STRUGGLE;
  if (S.recharge) { S.recharge = false; yield* bmsg(__('{0} must recharge!', mname(us))); return; }
  if (abilOf(us) === 'TRUANT' && S.loaf) { S.loaf = false; yield* bmsg(__('{0} is loafing around!', mname(us))); return; }
  if (user.status === 'SLP') { user.sleep -= (abilOf(us) === 'EARLYBIRD' ? 2 : 1); if (user.sleep > 0) { if (!(MFX[md.fn] && MFX[md.fn].sleepOk)) { yield* bmsg(__('{0} is fast asleep.', mname(us))); return; } } else { user.status = null; yield* bmsg(__('{0} woke up!', mname(us))); } }
  if (user.status === 'FRZ') { if (rnd(5) === 0 || (md.type === 'FIRE' && md.cat !== 'Status')) { user.status = null; yield* bmsg(__('{0} thawed out!', mname(us))); } else { yield* bmsg(__('{0} is frozen solid!', mname(us))); return; } }
  if (S.flinch) { S.flinch = false; if (abilOf(us) !== 'INNERFOCUS') { yield* bmsg(__('{0} flinched and couldn\'t move!', mname(us))); if (abilOf(us) === 'STEADFAST') yield* changeStage(us, 3, 1); return; } }
  { const why = moveBlockedReason(us, mi); if (why) { yield* bmsg(why); return; } }
  if (S.confuse > 0) {
    S.confuse--;
    if (S.confuse === 0) yield* bmsg(__('{0} snapped out of its confusion!', mname(us)));
    else { yield* bmsg(__('{0} is confused!', mname(us))); if (rnd(3) === 0) { yield* confusionHit(us); return; } }
  }
  if (S.attract) { yield* bmsg(__('{0} is in love with {1}!', mname(us), mnameL(1 - us))); if (rnd(2) === 0) { yield* bmsg(__('{0} is immobilized by love!', mname(us))); return; } }
  if (user.status === 'PAR' && rnd(4) === 0) { yield* bmsg(__('{0} is fully paralyzed! It can\'t move!', mname(us))); return; }
  const cont = !!(S.twoTurn || S.lockMove);   // continuing a multi-turn move: no PP, no choice-lock change
  if (slot && !cont) slot.pp = Math.max(0, slot.pp - 1 - (abilOf(1 - us) === 'PRESSURE' && !['10', '40', '20', '80'].includes(md.target) ? 1 : 0));
  if (slot && !cont && isChoice(hItem(user)) && S.lock == null) S.lock = mi;
  S.moved = true; S.destiny = false; S.lastMoveKey = slot ? slot.id : null; if (slot) (S.used = S.used || {})[slot.id] = 1;
  if (md.fn !== '093') S.rage = false;
  if (!(MFX[md.fn] && MFX[md.fn].protectKind)) S.protectN = 0;
  if (md.fn !== '091') S.chain = 0; if (md.fn !== '092') S.echo = 0;
  yield* bmsg(__('{0} used {1}!', mname(us), md.name), { hold: 12 });
  if (S.powder && md.type === 'FIRE') { S.powder = false; user.hp = Math.max(0, user.hp - Math.max(1, Math.floor(user.maxhp / 4))); yield* animHp(us, user.hp); yield* bmsg(__('The powder exploded!')); return; }
  S.powder = false;
  const second = !!S.twoTurn; if (second) { S.twoTurn = null; S.invuln = null; }
  B.lastCtx = null; B.prevMoveKey = B.lastMoveKey; B.lastMoveKey = slot ? slot.id : B.lastMoveKey;
  yield* doMove(us, md, { slot, second, mi });
  S.lastFailed = !!(B.lastCtx && B.lastCtx.md.name === md.name && md.cat !== 'Status' && B.lastCtx.hits === 0);
  if (abilOf(us) === 'TRUANT') S.loaf = true;
  yield* abilDancer(us, md);
  yield* lockUpdate(us, md, mi);
}

function* doMove(us, md, o = {}) {
  if (abilOf(us) === 'SERENEGRACE' && md.eff > 0 && md.eff < 100) md = Object.assign({}, md, { eff: Math.min(100, md.eff * 2) });
  const B = B_(), user = sideMon(us), ts = 1 - us, tgt = sideMon(ts), S = B.S[us], T = B.S[ts];
  const fx = MFX[md.fn] || {};
  const c = { us, ts, user, tgt, S, T, md, fx, B, slot: o.slot || null, hits: 0, done: 0, eff: 1, pow: md.pow, o };
  B.lastCtx = c; c.second = !!o.second;
  c.sheer = abilOf(us) === 'SHEERFORCE' && hasSec(c);
  c.type = fx.type ? fx.type(c) : md.type;
  if (S.electrify && md.cat !== 'Status') { c.type = 'ELECTRIC'; } S.electrify = false;
  if (field().ion && c.type === 'NORMAL') c.type = 'ELECTRIC';
  c.type = abilType(c); c.sheer = false;
  yield* abilProtean(c);
  if (B.scripted && us === 1) {   // scripted loss: every attack the foe makes knocks out the target in one hit
    yield* attackAnim(us, md); tgt.hp = 0; sfx('hitsuper'); sprOf(ts).shk = 18; yield* animHp(ts, 0); return;
  }
  if (fx.protectKind) {
    if (fx.protectKind === 'mat' && S.age > 0) { S.protectN = 0; yield* failMsg(); return; }
    if (rnd(Math.pow(3, S.protectN)) === 0) {
      yield* attackAnim(us, md, true); S.protectN++;
      if (fx.protectKind === 'endure') { S.endure = true; yield* bmsg(__('{0} braced itself!', mname(us))); }
      else { S.protect = fx.protectKind; yield* bmsg(__('{0} protected itself!', mname(us))); }
    } else { S.protectN = 0; yield* failMsg(); }
    return;
  }
  const isStatus = md.cat === 'Status';
  if ((fx.suicide || md.fn === 'A04') && !o.second) {
    const dm = [0, 1].find(s => abilOf(s) === 'DAMP' && (s === us || abilOf(us) !== 'MOLDBREAKER'));
    if (dm !== undefined) { yield* bmsg(__('{0}\'s Damp prevents {1} from using {2}!', mname(dm), mnameL(us), md.name)); return; }
  }
  const sfxs = STAGE_FX[md.fn];
  const onSelf = isStatus && sfxs && sfxs[0] === 'u' || md.target === '10' || md.target === '40' || md.fn === '0D5' || md.fn === '0D6' || !!fx.selfOnly;
  if (fx.charge && !c.second) {
    const skip = (fx.charge.skip && fx.charge.skip(c)) || hItem(user) === 'POWERHERB';
    if (!skip) {
      yield* bmsg(mname(us) + fx.charge.msg); S.twoTurn = { mi: o.mi, md, slot: o.slot }; S.invuln = fx.charge.invuln || null;
      if (fx.charge.selfStat) for (const [stt, dl] of fx.charge.selfStat) yield* changeStage(us, stt, dl);
      return;
    }
    if (!(fx.charge.skip && fx.charge.skip(c))) { user.item = null; yield* bmsg(__('{0} became fully charged due to its Power Herb!', mname(us))); }
  }
  if (isStatus && onSelf && T.snatch && !fx.noSnatch && !o.called && (sfxs || fx.snatchable || md.fn === '0D5' || md.fn === '0D6')) { T.snatch = false; yield* bmsg(__('{0} snatched {1}\'s move!', mname(ts), mnameL(us))); yield* doMove(ts, md, { slot: null, mi: -1, called: true }); return; }
  if (isStatus && !onSelf && T.coat && !fx.noCoat && !o.coated) { T.coat = false; yield* bmsg(__('{0}\'s {1} was bounced back by Magic Coat!', mname(us), md.name)); yield* doMove(ts, md, { slot: null, mi: -1, called: true, coated: true }); return; }
  if (fx.custom) { yield* fx.custom(c); return; }
  if (fx.fail && fx.fail(c)) { if (fx.failText) yield* bmsg(mname(us) + fx.failText); else yield* failMsg(); return; }
  if (!onSelf) {
    if (T.protect && !fx.ignoresProtect) {
      const k = T.protect, blocked = k === 'quick' ? (md.prio || 0) > 0 : k === 'crafty' ? isStatus : k === 'mat' ? !isStatus : k === 'wide' ? (md.target === '04' || md.target === '08') : true;
      if (blocked) {
        yield* bmsg(__('{0} protected itself!', mname(ts)));
        if (hasFlag(md, 'a') && !isStatus) {
          if (k === 'king') yield* changeStage(us, 1, -2);
          else if (k === 'obstruct') yield* changeStage(us, 2, -2);
          else if (k === 'spiky') { user.hp = Math.max(0, user.hp - Math.max(1, Math.floor(user.maxhp / 8))); yield* animHp(us, user.hp); yield* bmsg(__('{0} was hurt by the spikes!', mname(us))); }
          else if (k === 'bunker') yield* inflict(us, 'PSN');
        }
        return;
      }
    } else if (T.protect && fx.ignoresProtect) { T.protect = false; yield* bmsg(__('{0} fell for the feint!', mname(ts))); }
    if (isStatus && T.sub > 0 && !fx.bypassSub && abilOf(us) !== 'INFILTRATOR') { yield* failMsg(); return; }
    if (yield* abilBlocks(c)) return;
    if (S.lockOn) { S.lockOn = false; c.lockedOn = true; }
    if (field().terrain === 'PSYCHIC' && (md.prio || 0) > 0 && isGrounded(ts)) { yield* bmsg(__('{0} surrounds itself with a mysterious aura!', mname(ts))); yield* failMsg(); return; }
    if (T.invuln && !c.lockedOn) {
      const can = (INVULN_HITS[T.invuln] || []).includes(md.name);
      if (!can) { yield* bmsg(__('{0} avoided the attack!', mname(ts))); return; }
      if ((INVULN_DBL[T.invuln] || []).includes(md.name)) c.dbl = true;
    }
    if (fx.acc === 'ohko') {
      if (user.lvl < tgt.lvl) { yield* failMsg(); return; }
      if (md.type === 'ICE' && pokeTypes(tgt).includes('ICE')) { yield* bmsg(__('It doesn\'t affect {0}...', mname(ts))); return; }
      if (rnd(100) >= 30 + user.lvl - tgt.lvl) { yield* bmsg(__('{0}\'s attack missed!', mname(us))); return; }
    } else if (md.acc > 0 && fx.acc !== 'never' && !c.lockedOn && !(abilOf(us) === 'NOGUARD' || abilOf(ts) === 'NOGUARD')) {
      const F0 = field(); let wacc = 1;
      if (['Thunder', 'Hurricane'].includes(md.name)) { if (wx() === 'RAIN') wacc = 100 / md.acc; else if (wx() === 'SUN') wacc = 50 / md.acc; }
      if (md.name === 'Blizzard' && wx() === 'HAIL') wacc = 100 / md.acc;
      if (F0.gravity > 0) wacc *= 5 / 3;
      const chance = abilAcc(c) * wacc * md.acc * accMul(tAb(c) === 'UNAWARE' ? 0 : S.st[6]) / accMul(abilOf(us) === 'UNAWARE' ? 0 : (T.foresight || T.miracle || abilOf(us) === 'KEENEYE') ? Math.min(0, T.st[7]) : T.st[7]) * (hItem(user) === 'WIDELENS' ? 1.1 : 1) * (hItem(tgt) === 'BRIGHTPOWDER' ? 0.9 : 1);
      if (rnd(100) >= chance) { yield* bmsg(__('{0}\'s attack missed!', mname(us))); if (fx.onMiss) yield* fx.onMiss(c); return; }
    }
  }
  if (!isStatus) {
    const nh = (fx.nhits ? fx.nhits(c) : 0) || { '0BD': 2, '0BE': 2, '0BF': 3 }[md.fn] || (md.fn === '0C0' ? (abilOf(us) === 'SKILLLINK' ? 5 : [2, 2, 2, 3, 3, 3, 4, 5][rnd(8)]) : 1);
    if (fx.intro && (yield* fx.intro(c)) === false) return;
    const before = tgt.hp; let eff1 = 1; c.before = before;
    for (let hi = 0; hi < nh && tgt.hp > 0; hi++) {
      c.pow = md.fn === '0BF' ? (md.pow || 10) * (hi + 1) : (fx.power ? Math.max(1, Math.floor(fx.power(c, md.pow, hi))) : md.pow);   // Triple Kick gets stronger each hit
      if (o.meFirst) c.pow = Math.floor(c.pow * 1.5);
      const cs = critStage(c), crit = !(team(ts).luckyChant > 0) && (fx.crit === 'always' || S.laserFocus > 0 || rnd(CRIT_DEN[Math.min(3, cs)]) === 0 || (abilOf(us) === 'MERCILESS' && tgt.status === 'PSN')) && !['SHELLARMOR', 'BATTLEARMOR'].includes(tAb(c));
      yield* attackAnim(us, md);
      let r;
      if (fx.fixed) {
        const e = effOf(c);
        r = { dmg: e === 0 ? 0 : Math.max(1, fx.fixed(c)), eff: e };
      } else r = calcDamage(c, crit);
      if (r.eff === 0) { yield* bmsg(__('It doesn\'t affect {0}...', mname(ts))); if (fx.onMiss) yield* fx.onMiss(c); return; }
      eff1 = r.eff; c.hits++; c.eff = r.eff; if (crit) c.crit = true;
      if (r.dmg > 0 && (yield* abilSurvive(c, r))) { /* Disguise / Sturdy adjusted r.dmg */ }
      let hang = null;
      if (fx.cap1 && r.dmg >= tgt.hp) r.dmg = tgt.hp - 1;
      if (!B.scripted && tgt.hp - r.dmg <= 0) {
        const tk = hItem(tgt);
        if (tk === 'FOCUSSASH' && tgt.hp === tgt.maxhp) { hang = ' hung on using its Focus Sash!'; tgt.item = null; r.dmg = tgt.hp - 1; }
        else if (tk === 'FOCUSBAND' && rnd(10) === 0) { hang = ' hung on using its Focus Band!'; r.dmg = tgt.hp - 1; }
      }
      if (T.endure && tgt.hp - r.dmg <= 0) { r.dmg = tgt.hp - 1; c.endured = true; }
      if (T.sub > 0 && !fx.bypassSub && !hasFlag(md, 'k') && abilOf(us) !== 'INFILTRATOR') {   // the substitute takes the hit
        const sd = Math.min(T.sub, r.dmg); T.sub -= sd; c.subDone = (c.subDone || 0) + sd; c.subHit = true; T.hurt = true;
        sfx('hit'); sprOf(ts).shk = 12;
        yield* bmsg(T.sub > 0 ? __('The substitute took damage for {0}!', mnameL(ts)) : __('{0}\'s substitute faded!', mname(ts)));
        continue;
      }
      const hp0 = tgt.hp;
      if (T.bide) T.bide.dmg += Math.min(r.dmg, tgt.hp);
      tgt.hp = B.scripted ? Math.max(1, tgt.hp - r.dmg) : Math.max(0, tgt.hp - r.dmg);
      T.hurt = true; T.lastHit = { dmg: hp0 - tgt.hp, phys: md.cat === 'Physical' };
      sfx(r.eff > 1 ? 'hitsuper' : r.eff < 1 ? 'hitweak' : 'hit'); sprOf(ts).shk = 18;
      yield* animHp(ts, tgt.hp);
      if (r.gem) { yield* bmsg(__('The {0} strengthened {1}\'s power!', itemName(user.item), md.name)); user.item = null; }
      if (r.berry) { yield* bmsg(__('The {0} weakened the damage to {1}!', itemName(tgt.item), mnameL(ts))); tgt.item = null; }
      if (hang) yield* bmsg(mname(ts) + hang);
      if (c.endured) { c.endured = false; yield* bmsg(__('{0} endured the hit!', mname(ts))); }
      if (tgt.hp <= 0 && T.destiny && user.hp > 0) { user.hp = 0; yield* animHp(us, 0); yield* bmsg(__('{0} took {1} down with it!', mname(ts), mnameL(us))); }
      if (tgt.hp <= 0 && T.grudge && c.slot) { c.slot.pp = 0; yield* bmsg(__('{0}\'s {1} lost all its PP due to the grudge!', mname(us), md.name)); }
      if (crit && !fx.fixed) yield* bmsg(__('A critical hit!'), { hold: 12 });
      if (c.type === 'FIRE' && tgt.status === 'FRZ' && tgt.hp > 0) { tgt.status = null; yield* bmsg(__('{0} thawed out!', mname(ts))); }
    }
    if (c.hits === 0) return;
    if (c.subHit && !c.done && tgt.hp === before) { /* only the substitute was hit */ }
    if (eff1 > 1) yield* bmsg(__('It\'s super effective!'), { hold: 12 }); else if (eff1 < 1) yield* bmsg(__('It\'s not very effective...'), { hold: 12 });
    if (fx.acc === 'ohko') yield* bmsg(__('It\'s a one-hit KO!'));
    if (nh > 1) yield* bmsg(__('Hit {0} time(s)!', c.hits), { hold: 12 });
    const done = c.done = before - tgt.hp + (c.subDone || 0);
    if (fx.drain && done > 0) { const amt = Math.max(1, Math.floor(done * fx.drain * (hItem(user) === 'BIGROOT' ? 1.3 : 1))); if (tAb(c) === 'LIQUIDOOZE') { user.hp = Math.max(0, user.hp - amt); yield* animHp(us, user.hp); yield* bmsg(__('{0} sucked up the liquid ooze!', mname(us))); } else { user.hp = Math.min(user.maxhp, user.hp + amt); yield* animHp(us, user.hp); yield* bmsg(__('{0} had its energy drained!', mname(ts))); } }
    let rec = 0; if (fx.recoil) rec = Math.max(1, Math.floor(done * fx.recoil)); if (fx.recoilMax) rec = Math.max(1, Math.floor(user.maxhp * fx.recoilMax));
    if (rec && user.hp > 0 && !['ROCKHEAD', 'MAGICGUARD'].includes(abilOf(us))) { user.hp = Math.max(0, user.hp - rec); sprOf(us).shk = 10; yield* animHp(us, user.hp); yield* bmsg(__('{0} is damaged by recoil!', mname(us))); }
    yield* afterHitItems(us, md, done, c);
    yield* abilAfterHit(c);
    if (T.rage && tgt.hp > 0 && done > 0) { yield* bmsg(__('{0}\'s rage is building!', mname(ts))); yield* changeStage(ts, 1, 1); }
    if (S.laserFocus > 0) S.laserFocus = 0;
    if (fx.selfStat && user.hp > 0) for (const [stt, dl] of fx.selfStat) yield* changeStage(us, stt, dl);
    if (fx.after) yield* fx.after(c);
    if (fx.suicide && user.hp > 0) { user.hp = 0; sprOf(us).shk = 10; yield* animHp(us, 0); }
    if (tgt.hp > 0 && !c.subHit) {
      const chance = md.eff || 0;
      if (c.sheer || tAb(c) === 'SHIELDDUST') { /* Sheer Force / Shield Dust: no additional effects */ }
      else if (fx.sec) yield* fx.sec(c);
      else if ((md.fn === '00F' || md.fn === '010') && rnd(100) < (chance || 30)) T.flinch = true;
      else if (STATUS_FX[md.fn] && rnd(100) < chance) yield* inflict(ts, STATUS_FX[md.fn]);
      else if (sfxs && chance && rnd(100) < chance) for (const [stt, dl] of sfxs[1]) yield* changeStage(sfxs[0] === 'u' ? us : ts, stt, dl, sfxs[0] !== 'u');
    }
  } else if (fx.status) {
    if (!(yield* fx.status(c))) return;
  } else if (sfxs) {
    yield* attackAnim(us, md, true);
    for (const [stt, dl] of sfxs[1]) yield* changeStage(sfxs[0] === 'u' ? us : ts, stt, dl, sfxs[0] !== 'u');
  } else if (STATUS_FX[md.fn]) {
    yield* attackAnim(us, md, true);
    if (!(yield* inflict(ts, STATUS_FX[md.fn]))) yield* failMsg();
  } else if (md.fn === '0D5' || md.fn === '0D6') {
    if (user.hp >= user.maxhp) { yield* bmsg(__('{0}\'s HP is full!', mname(us))); return; }
    if (window.ANIMS) yield* commonAnim('HealthUp', us); else sfx('item'); user.hp = Math.min(user.maxhp, user.hp + Math.floor(user.maxhp / 2)); yield* animHp(us, user.hp); yield* bmsg(__('{0} regained health!', mname(us)));
  } else { yield* attackAnim(us, md, true); yield* bmsg(__('But nothing happened!')); }
}

// ---------------------------------------------------------------- batch 1: damage variants
const Fx = (codes, def) => codes.split(' ').forEach(k => { MFX[k] = Object.assign(MFX[k] || {}, def); });
// accuracy
Fx('0A5', { acc: 'never' });
Fx('070', { acc: 'ohko', fixed: c => c.tgt.hp });
// crits / defence handling
Fx('0A0', { crit: 'always' });
Fx('0A9', { ignoreDefStages: true });
Fx('121', { atkFromTarget: true });
Fx('122', { defStat: 2 });
Fx('A13', { atkStat: 2 });
// drain, recoil, self drops
Fx('0DD', { drain: 0.5 });
Fx('0DE', { drain: 0.5, fail: c => c.tgt.status !== 'SLP' });
Fx('14F', { drain: 0.75 });
Fx('002', { recoilMax: 0.25 });
Fx('0FA', { recoil: 0.25 }); Fx('0FB', { recoil: 1 / 3 }); Fx('0FC', { recoil: 0.5 });
Fx('0FD', { recoil: 1 / 3 }); Fx('0FE', { recoil: 1 / 3 });
Fx('03F', { selfStat: [[4, -2]] }); Fx('03C', { selfStat: [[2, -1], [5, -1]] }); Fx('03B', { selfStat: [[1, -1], [2, -1]] });
Fx('03D', { selfStat: [[2, -1], [5, -1], [3, -1]] }); Fx('03E', { selfStat: [[3, -1]] });
Fx('0E0', { suicide: true });
Fx('0C2', { after: function* (c) { if (c.tgt.hp > 0) c.S.recharge = true; } });
Fx('0E9', { cap1: true });
Fx('10B', { onMiss: function* (c) { const d = Math.max(1, Math.floor(c.user.maxhp / 2)); c.user.hp = Math.max(0, c.user.hp - d); sprOf(c.us).shk = 10; yield* animHp(c.us, c.user.hp); yield* bmsg(__('{0} kept going and crashed!', mname(c.us))); } });
// fixed damage
Fx('06A', { fixed: () => 20 }); Fx('06B', { fixed: () => 40 });
Fx('06D', { fixed: c => c.user.lvl });
Fx('06F', { fixed: c => Math.max(1, Math.floor(c.user.lvl * (50 + rnd(101)) / 100)) });
Fx('06C', { fixed: c => Math.max(1, Math.floor(c.tgt.hp / 2)) });
Fx('06E', { fixed: c => Math.max(1, c.tgt.hp - c.user.hp), fail: c => c.tgt.hp <= c.user.hp });
const counterFx = (phys, mul) => ({ fixed: c => Math.max(1, Math.floor(c.S.lastHit.dmg * mul)), fail: c => !c.S.lastHit || (phys !== null && c.S.lastHit.phys !== phys) });
Fx('071', counterFx(true, 2)); Fx('072', counterFx(false, 2)); Fx('073', counterFx(null, 1.5));
// first-turn / conditional moves
Fx('012', { fail: c => c.S.age > 0, sec: function* (c) { c.T.flinch = true; } });
Fx('116', { fail: c => { const q = c.B.queue && c.B.queue.find(a => a.s === c.ts); return !q || q.done || q.md.cat === 'Status'; } });
Fx('115', { failText: ' lost its focus and couldn\'t move!', fail: c => { if (c.S.hurt) { c.B.focusLost = true; } return !!c.S.hurt; } });
// variable power
const dbl = (test, extra) => ({ power: (c, p) => test(c) ? p * 2 : p, after: extra });
Fx('08B', { power: c => Math.max(1, Math.floor(150 * c.user.hp / c.user.maxhp)) });
Fx('098', { power: c => { const p = Math.floor(48 * c.user.hp / c.user.maxhp); return p < 2 ? 200 : p < 5 ? 150 : p < 10 ? 100 : p < 17 ? 80 : p < 33 ? 40 : 20; } });
Fx('089', { power: c => Math.max(1, Math.floor((c.user.happy || 0) * 2 / 5)) });
Fx('08A', { power: c => Math.max(1, Math.floor((255 - (c.user.happy || 0)) * 2 / 5)) });
Fx('09A', { power: c => { const w = weightOf(c.tgt); return w < 10 ? 20 : w < 25 ? 40 : w < 50 ? 60 : w < 100 ? 80 : w < 200 ? 100 : 120; } });
Fx('09B', { power: c => { const r = weightOf(c.user) / weightOf(c.tgt); return r >= 5 ? 120 : r >= 4 ? 100 : r >= 3 ? 80 : r >= 2 ? 60 : 40; } });
Fx('099', { power: c => { const r = effStat(c.us, 3) / Math.max(1, effStat(c.ts, 3)); return r >= 4 ? 150 : r >= 3 ? 120 : r >= 2 ? 80 : r >= 1 ? 60 : 40; } });
Fx('08D', { power: c => Math.min(150, Math.floor(25 * effStat(c.ts, 3) / Math.max(1, effStat(c.us, 3))) + 1) });
Fx('08E', { power: c => 20 + 20 * sumPos(c.S.st) });
Fx('08F', { power: c => Math.min(200, 60 + 20 * sumPos(c.T.st)) });
Fx('08C', { power: c => 1 + Math.floor(120 * c.tgt.hp / c.tgt.maxhp) });
Fx('097', { power: c => { const pp = c.slot ? c.slot.pp : 0; return pp >= 5 ? 40 : pp === 4 ? 50 : pp === 3 ? 60 : pp === 2 ? 80 : 200; } });
Fx('07E', { power: (c, p) => ['PSN', 'PAR', 'BRN'].includes(c.user.status) ? p * 2 : p, noBurnDrop: true });
Fx('07F', { power: (c, p) => c.tgt.status ? p * 2 : p });
Fx('07B', { power: (c, p) => c.tgt.status === 'PSN' ? p * 2 : p });
Fx('080', { power: (c, p) => c.tgt.hp <= c.tgt.maxhp / 2 ? p * 2 : p });
Fx('07D', { power: (c, p) => c.tgt.status === 'SLP' ? p * 2 : p, after: function* (c) { if (c.tgt.status === 'SLP' && c.tgt.hp > 0) { c.tgt.status = null; yield* bmsg(__('{0} woke up!', mname(c.ts))); } } });
Fx('07C', { power: (c, p) => c.tgt.status === 'PAR' ? p * 2 : p, after: function* (c) { if (c.tgt.status === 'PAR' && c.tgt.hp > 0) { c.tgt.status = null; yield* bmsg(__('{0} was cured of paralysis!', mname(c.ts))); } } });
Fx('082', { power: (c, p) => c.T.hurt ? p * 2 : p });
Fx('084', { power: (c, p) => c.T.moved ? p * 2 : p });
Fx('081', { power: (c, p) => c.S.hurt ? p * 2 : p });
Fx('085', { power: (c, p) => c.B.fainted && c.B.fainted[c.us] === c.B.turn - 1 ? p * 2 : p });
Fx('086', { power: (c, p) => c.user.item ? p : p * 2 });
Fx('092', { power: (c, p) => p * Math.min(5, 1 + (c.S.echo || 0)), after: function* (c) { c.S.echo = (c.S.echo || 0) + 1; } });
Fx('091', { power: (c, p) => p * Math.pow(2, Math.min(4, c.S.chain || 0)), after: function* (c) { c.S.chain = (c.S.chain || 0) + 1; }, onMiss: function* (c) { c.S.chain = 0; } });
Fx('095', { power: c => [0, 0, 0, 0, 10, 30, 50, 70, 90, 110, 150][c.mag],
  intro: function* (c) { const r = rnd(100); c.mag = r < 5 ? 4 : r < 15 ? 5 : r < 35 ? 6 : r < 65 ? 7 : r < 85 ? 8 : r < 95 ? 9 : 10; yield* bmsg(__('Magnitude {0}!', c.mag)); } });
Fx('090', { type: c => { const iv = c.user.ivs; return HP_TYPES[Math.floor(((iv[0] & 1) + 2 * (iv[1] & 1) + 4 * (iv[2] & 1) + 8 * (iv[3] & 1) + 16 * (iv[4] & 1) + 32 * (iv[5] & 1)) * 15 / 63)]; } });
Fx('094', { intro: function* (c) {
    const r = rnd(100); c.presentPow = r < 40 ? 40 : r < 70 ? 80 : r < 80 ? 120 : 0;
    if (!c.presentPow) { yield* attackAnim(c.us, c.md, true); if (c.tgt.hp >= c.tgt.maxhp) { yield* bmsg(__('{0}\'s HP is full!', mname(c.ts))); return false; } c.tgt.hp = Math.min(c.tgt.maxhp, c.tgt.hp + Math.floor(c.tgt.maxhp / 4)); yield* animHp(c.ts, c.tgt.hp); yield* bmsg(__('{0} regained health!', mname(c.ts))); return false; }
  }, power: c => c.presentPow });
Fx('017', { sec: function* (c) { if (rnd(100) < 20) yield* inflict(c.ts, ['PAR', 'BRN', 'FRZ'][rnd(3)]); } });
STATUS_FX['0FD'] = 'PAR'; STATUS_FX['0FE'] = 'BRN'; STATUS_FX['0C5'] = 'PAR'; STATUS_FX['0C6'] = 'BRN';
// moves whose old code (recoil on 0EE/0F0) was wrong: Knock Off is handled here, U-turn in batch 5
Fx('0F0', { power: (c, p) => c.tgt.item && !/ITE$|STONE$/.test(c.tgt.item) ? p * 1.5 : p, after: function* (c) { if (c.tgt.hp > 0 && c.tgt.item && tAb(c) !== 'STICKYHOLD' && !/ITE$|STONE$/.test(c.tgt.item)) { const nm = itemName(c.tgt.item); noteItem(c.tgt); c.tgt.item = null; yield* bmsg(__('{0} knocked off {1}\'s {2}!', mname(c.us), mnameL(c.ts), nm)); } } });
Fx('0EE', {});

// ================================================================ batch 2: volatile statuses, traps, protection variants
function moveBlockedReason(s, mi) {   // why this side can't use move slot mi right now (null = fine)
  const B = B_(), S = B.S[s], user = sideMon(s), T = B.S[1 - s];
  if (mi < 0 || !user.moves[mi]) return null;
  const key = user.moves[mi].id, md = D.MV[key], nm = mname(s);
  if (S.throat > 0 && hasFlag(md, 'k')) return __('{0} can\'t use {1} because of the throat chop!', nm, md.name);
  if (S.taunt > 0 && md.cat === 'Status') return __('{0} can\'t use {1} after the taunt!', nm, md.name);
  if (S.disabled && S.disabled.key === key) return __('{0}\'s {1} is disabled!', nm, md.name);
  if (S.torment && S.lastMoveKey === key) return __('{0} can\'t use the same move twice in a row due to the torment!', nm);
  if (T.imprison && T.imprison.includes(key)) return __('{0} can\'t use the sealed {1}!', nm, md.name);
  if (S.healBlock > 0 && /^(0D5|0D6|0D8|0D9|0DF|0D7|114|159|CF2|A20|A27)$/.test(md.fn)) return __('{0} can\'t use {1} because of Heal Block!', nm, md.name);
  return null;
}
function* confusionHit(s) {
  const m = sideMon(s), B = B_(), st = B.S[s].st;
  let dmg = Math.floor(Math.floor(Math.floor(2 * m.lvl / 5 + 2) * 40 * m.stats[1] * stageMul(st[1]) / (m.stats[2] * stageMul(st[2])) / 50) + 2);
  dmg = Math.max(1, Math.floor(dmg * (85 + rnd(16)) / 100));
  m.hp = Math.max(0, m.hp - dmg); sfx('hit'); sprOf(s).shk = 18; yield* animHp(s, m.hp);
  yield* bmsg(__('It hurt itself in its confusion!'));
}
function* addConfuse(s, quiet) {
  if (['OWNTEMPO'].includes(abilOf(s)) || (abilOf(s) === 'TANGLEDFEET' && false)) { if (!quiet) yield* bmsg(__('{0}\'s Own Tempo prevents confusion!', mname(s))); return false; }   // returns true if the Pokémon became confused
  const B = B_(), m = sideMon(s), S = B.S[s];
  if (m.hp <= 0) return false;
  if (S.confuse > 0) { if (!quiet) yield* bmsg(__('{0} is already confused!', mname(s))); return false; }
  if (team(s).safeguard > 0) { if (!quiet) yield* bmsg(__('{0} is protected by Safeguard!', mname(s))); return false; }
  if (field().terrain === 'MISTY' && isGrounded(s)) { if (!quiet) yield* bmsg(__('{0} surrounds itself with a protective mist!', mname(s))); return false; }
  S.confuse = 2 + rnd(4); sfx('item'); yield* bmsg(__('{0} became confused!', mname(s))); return true;
}
function isTrapped(s) {
  const B = B_(), S = B.S[s], m = sideMon(s), foe = sideMon(1 - s);
  if (pokeTypes(m).includes('GHOST') && !S.ingrain) return false;
  if (S.ingrain || S.noRetreat || field().fairyLock > 0) return true;
  if (abilTrap(s)) return true;
  if (S.octo && S.octo === foe && foe.hp > 0) return true;
  if (S.bound && S.bound.src === foe && foe.hp > 0) return true;
  if (S.trapped && S.trapped === foe && foe.hp > 0) return true;
  return false;
}
// end-of-turn effects for side s (called from endOfTurn after poison / burn)
function* volatileEnd(s) {
  const B = B_(), S = B.S[s], m = sideMon(s), o = sideMon(1 - s); if (!m || m.hp <= 0) return;
  const hurt = function* (amt, msg) { if (abilOf(s) === 'MAGICGUARD') return; m.hp = Math.max(0, m.hp - Math.max(1, amt)); sfx('hit'); sprOf(s).shk = 10; yield* animHp(s, m.hp); yield* bmsg(msg); };
  if (S.seeded && o && o.hp > 0) {
    const d = Math.max(1, Math.floor(m.maxhp / 8)); yield* hurt(d, __('{0}\'s health is sapped by Leech Seed!', mname(s)));
    if (o.hp > 0 && o.hp < o.maxhp && !(B.S[1 - s].healBlock > 0)) { o.hp = Math.min(o.maxhp, o.hp + d); yield* animHp(1 - s, o.hp); }
    if (m.hp <= 0) return;
  }
  if (S.bound) {
    if (S.bound.src !== o || o.hp <= 0) S.bound = null;
    else { yield* hurt(Math.floor(m.maxhp / 8), __('{0} is hurt by {1}!', mname(s), S.bound.name)); if (m.hp <= 0) return; if (--S.bound.turns <= 0) { yield* bmsg(__('{0} was freed from {1}!', mname(s), S.bound.name)); S.bound = null; } }
  }
  if (S.trapped && (S.trapped !== o || o.hp <= 0)) S.trapped = null;
  if ((S.ingrain || S.aquaRing) && m.hp < m.maxhp && !(S.healBlock > 0)) { m.hp = Math.min(m.maxhp, m.hp + Math.max(1, Math.floor(m.maxhp / 16))); sfx('item'); yield* animHp(s, m.hp); yield* bmsg(mname(s) + (S.ingrain ? __(' absorbed nutrients with its roots!') : __(' restored a little HP using its Aqua Ring!'))); }
  if (S.cursed) { yield* hurt(Math.floor(m.maxhp / 4), __('{0} is afflicted by the curse!', mname(s))); if (m.hp <= 0) return; }
  if (S.nightmare) { if (m.status === 'SLP') { yield* hurt(Math.floor(m.maxhp / 4), __('{0} is locked in a nightmare!', mname(s))); if (m.hp <= 0) return; } else S.nightmare = false; }
  if (S.perish > 0) {
    S.perish--; yield* bmsg(__('{0}\'s perish count fell to {1}!', mname(s), S.perish));
    if (S.perish === 0) { m.hp = 0; yield* animHp(s, 0); return; }
  }
  if (m.status && abilOf(s) === 'SHEDSKIN' && rnd(3) === 0) { m.status = null; sfx('item'); yield* bmsg(__('{0}\'s Shed Skin cured its status problem!', mname(s))); }
  if (S.octo) { if (S.octo.hp > 0) { yield* changeStage(s, 2, -1, true); yield* changeStage(s, 5, -1, true); } else S.octo = null; }
  if (S.throat > 0) S.throat--;
  if (m.embargo > 0 && --m.embargo === 0) yield* bmsg(__('{0} can use items again!', mname(s)));
  if (S.taunt > 0 && --S.taunt === 0) yield* bmsg(__('{0}\'s taunt wore off!', mname(s)));
  if (S.disabled && --S.disabled.turns <= 0) { S.disabled = null; yield* bmsg(__('{0} is no longer disabled!', mname(s))); }
  if (S.encore && (--S.encore.turns <= 0)) { S.encore = null; yield* bmsg(__('{0}\'s encore ended!', mname(s))); }
  if (S.healBlock > 0 && --S.healBlock === 0) yield* bmsg(__('{0}\'s Heal Block wore off!', mname(s)));
}
// a side forced into a move (Encore); returns the move index or null
function forcedMove(s) {
  const B = B_(), S = B.S[s], m = sideMon(s);
  if (S.twoTurn) return S.twoTurn.mi;
  if (S.lockMove) { if (m.moves[S.lockMove.mi]) return S.lockMove.mi; S.lockMove = null; }
  if (S.encore) { const i = m.moves.findIndex(x => x.id === S.encore.key); if (i >= 0 && m.moves[i].pp > 0) return i; S.encore = null; }
  return null;
}

// ---- protection variants
Fx('0AA', { protectKind: 'normal' }); Fx('14B', { protectKind: 'king' }); Fx('14C', { protectKind: 'spiky' }); Fx('A00', { protectKind: 'bunker' });
Fx('A23', { protectKind: 'obstruct' }); Fx('0AB', { protectKind: 'quick' }); Fx('0AC', { protectKind: 'wide' }); Fx('149', { protectKind: 'mat' });
Fx('14A', { protectKind: 'crafty' }); Fx('0E8', { protectKind: 'endure' });
Fx('0AD', { ignoresProtect: true });
// ---- confusion family
const confuseTarget = function* (c) { if (yield* addConfuse(c.ts)) return true; return false; };
Fx('013', { sec: function* (c) { if (rnd(100) < (c.md.eff || 0)) yield* addConfuse(c.ts, true); },
  status: function* (c) { yield* attackAnim(c.us, c.md, true); if (!(yield* addConfuse(c.ts))) return false; return true; } });
Fx('015', { sec: function* (c) { if (rnd(100) < (c.md.eff || 30)) yield* addConfuse(c.ts, true); } });
Fx('014', { sec: function* (c) { yield* addConfuse(c.ts, true); } });
Fx('041', { status: function* (c) { yield* attackAnim(c.us, c.md, true); yield* changeStage(c.ts, 1, 2, true); yield* addConfuse(c.ts); return true; } });
Fx('040', { status: function* (c) { yield* attackAnim(c.us, c.md, true); yield* changeStage(c.ts, 4, 1, true); yield* addConfuse(c.ts); return true; } });
Fx('00E', { sec: function* (c) { if (rnd(10) === 0) c.T.flinch = true; if (rnd(10) === 0) yield* inflict(c.ts, 'FRZ'); } });
Fx('016', { status: function* (c) {
  const a = c.user.gender, b = c.tgt.gender;
  if (c.T.attract || a === 2 || b === 2 || a === b) { yield* failMsg(); return false; }
  yield* attackAnim(c.us, c.md, true); c.T.attract = true; yield* bmsg(__('{0} fell in love with {1}!', mname(c.ts), mnameL(c.us))); return true; } });
// ---- Leech Seed, Substitute, Ingrain, Aqua Ring, Curse, Nightmare, Perish Song, Destiny Bond, Grudge
Fx('0DC', { status: function* (c) {
  if (c.T.seeded || pokeTypes(c.tgt).includes('GRASS')) { yield* failMsg(); return false; }
  yield* attackAnim(c.us, c.md, true); c.T.seeded = true; yield* bmsg(__('{0} was seeded!', mname(c.ts))); return true; } });
Fx('10C', { selfOnly: true, status: function* (c) {
  const cost = Math.floor(c.user.maxhp / 4);
  if (c.S.sub > 0) { yield* bmsg(__('{0} already has a substitute!', mname(c.us))); return false; }
  if (c.user.hp <= cost) { yield* bmsg(__('But it does not have enough HP left to make a substitute!')); return false; }
  yield* attackAnim(c.us, c.md, true); c.user.hp -= cost; yield* animHp(c.us, c.user.hp); c.S.sub = cost; yield* bmsg(__('{0} put in a substitute!', mname(c.us))); return true; } });
Fx('0DB', { selfOnly: true, status: function* (c) { if (c.S.ingrain) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); c.S.ingrain = true; yield* bmsg(__('{0} planted its roots!', mname(c.us))); return true; } });
Fx('0DA', { selfOnly: true, status: function* (c) { if (c.S.aquaRing) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); c.S.aquaRing = true; yield* bmsg(__('{0} surrounded itself with a veil of water!', mname(c.us))); return true; } });
Fx('10D', { selfOnly: true, status: function* (c) {
  yield* attackAnim(c.us, c.md, true);
  if (pokeTypes(c.user).includes('GHOST')) {
    if (c.T.cursed) { yield* failMsg(); return false; }
    c.user.hp = Math.max(0, c.user.hp - Math.max(1, Math.floor(c.user.maxhp / 2))); yield* animHp(c.us, c.user.hp);
    c.T.cursed = true; yield* bmsg(__('{0} cut its own HP and laid a curse on {1}!', mname(c.us), mnameL(c.ts)));
  } else { yield* changeStage(c.us, 3, -1); yield* changeStage(c.us, 1, 1); yield* changeStage(c.us, 2, 1); }
  return true; } });
Fx('10F', { status: function* (c) { if (c.tgt.status !== 'SLP' || c.T.nightmare) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); c.T.nightmare = true; yield* bmsg(__('{0} began having a nightmare!', mname(c.ts))); return true; } });
Fx('0E5', { selfOnly: true, status: function* (c) {
  if (c.S.perish > 0 && c.T.perish > 0) { yield* failMsg(); return false; }
  yield* attackAnim(c.us, c.md, true); yield* bmsg(__('All Pokémon that heard the song will faint in three turns!'));
  if (!(c.S.perish > 0)) c.S.perish = 4; if (!(c.T.perish > 0)) c.T.perish = 4; return true; } });
Fx('0E7', { selfOnly: true, status: function* (c) { yield* attackAnim(c.us, c.md, true); c.S.destiny = true; yield* bmsg(__('{0} is trying to take its foe down with it!', mname(c.us))); return true; } });
Fx('0E6', { selfOnly: true, status: function* (c) { yield* attackAnim(c.us, c.md, true); c.S.grudge = true; yield* bmsg(__('{0} wants its target to bear a grudge!', mname(c.us))); return true; } });
// ---- move restrictions: Taunt, Disable, Encore, Torment, Imprison, Spite, Heal Block
Fx('0BA', { status: function* (c) { if (c.T.taunt > 0) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); c.T.taunt = 3; yield* bmsg(__('{0} fell for the taunt!', mname(c.ts))); return true; } });
Fx('0B9', { status: function* (c) {
  const k = c.T.lastMoveKey; if (!k || c.T.disabled || !c.tgt.moves.some(m => m.id === k && m.pp > 0)) { yield* failMsg(); return false; }
  yield* attackAnim(c.us, c.md, true); c.T.disabled = { key: k, turns: 4 }; yield* bmsg(__('{0}\'s {1} was disabled!', mname(c.ts), D.MV[k].name)); return true; } });
Fx('0BC', { status: function* (c) {
  const k = c.T.lastMoveKey; if (!k || c.T.encore || !c.tgt.moves.some(m => m.id === k && m.pp > 0)) { yield* failMsg(); return false; }
  yield* attackAnim(c.us, c.md, true); c.T.encore = { key: k, turns: 3 }; yield* bmsg(__('{0} received an encore!', mname(c.ts))); return true; } });
Fx('0B7', { status: function* (c) { if (c.T.torment) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); c.T.torment = true; yield* bmsg(__('{0} was subjected to torment!', mname(c.ts))); return true; } });
Fx('0B8', { selfOnly: true, status: function* (c) { if (c.S.imprison) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); c.S.imprison = c.user.moves.map(m => m.id); yield* bmsg(__('{0} sealed any moves its target shares with it!', mname(c.us))); return true; } });
Fx('10E', { status: function* (c) {
  const k = c.T.lastMoveKey, sl = k && c.tgt.moves.find(m => m.id === k); if (!sl || sl.pp <= 0) { yield* failMsg(); return false; }
  yield* attackAnim(c.us, c.md, true); const cut = Math.min(4, sl.pp); sl.pp -= cut; yield* bmsg(__('It reduced the PP of {0}\'s {1} by {2}!', mnameL(c.ts), D.MV[k].name, cut)); return true; } });
Fx('0BB', { status: function* (c) { if (c.T.healBlock > 0) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); c.T.healBlock = 5; yield* bmsg(__('{0} was prevented from healing!', mname(c.ts))); return true; } });
// ---- trapping
const bindFx = { sec: function* (c) {
  if (c.T.bound || pokeTypes(c.tgt).includes('GHOST')) return;
  c.T.bound = { src: c.user, name: c.md.name, turns: 4 + rnd(2) }; yield* bmsg(__('{0} was trapped by {1}!', mname(c.ts), c.md.name)); } };
Fx('0CF', bindFx); Fx('0D0', bindFx);
const trapFx = { sec: function* (c) { if (!c.T.trapped && !pokeTypes(c.tgt).includes('GHOST')) { c.T.trapped = c.user; yield* bmsg(__('{0} can no longer escape!', mname(c.ts))); } },
  status: function* (c) {
    if (c.T.trapped || pokeTypes(c.tgt).includes('GHOST')) { yield* failMsg(); return false; }
    yield* attackAnim(c.us, c.md, true); c.T.trapped = c.user; yield* bmsg(__('{0} can no longer escape!', mname(c.ts))); return true; } };
Fx('0EF', trapFx);
// ---- lock-on / foresight family
Fx('0A6', { status: function* (c) { yield* attackAnim(c.us, c.md, true); c.S.lockOn = true; yield* bmsg(__('{0} took aim at {1}!', mname(c.us), mnameL(c.ts))); return true; } });
Fx('0A7', { status: function* (c) { yield* attackAnim(c.us, c.md, true); c.T.foresight = true; yield* bmsg(__('{0} identified {1}!', mname(c.us), mnameL(c.ts))); return true; } });
Fx('0A8', { status: function* (c) { yield* attackAnim(c.us, c.md, true); c.T.miracle = true; yield* bmsg(__('{0} identified {1}!', mname(c.us), mnameL(c.ts))); return true; } });
Fx('0DF', { status: function* (c) {
  if (c.tgt.hp >= c.tgt.maxhp) { yield* bmsg(__('{0}\'s HP is full!', mname(c.ts))); return false; }
  yield* attackAnim(c.us, c.md, true); c.tgt.hp = Math.min(c.tgt.maxhp, c.tgt.hp + Math.floor(c.tgt.maxhp / 2)); yield* animHp(c.ts, c.tgt.hp); yield* bmsg(__('{0} regained health!', mname(c.ts))); return true; } });
Fx('148', { status: function* (c) { yield* attackAnim(c.us, c.md, true); c.T.powder = true; yield* bmsg(__('{0} is covered in powder!', mname(c.ts))); return true; } });
Fx('145', { status: function* (c) { yield* attackAnim(c.us, c.md, true); c.T.electrify = true; yield* bmsg(__('{0}\'s moves have been electrified!', mname(c.ts))); return true; } });
Fx('0A4', { sec: function* (c) { if (rnd(100) < 30) yield* inflict(c.ts, 'PAR'); } });
Fx('011', { fail: c => c.user.status !== 'SLP', sleepOk: true, sec: function* (c) { if (rnd(100) < 30) c.T.flinch = true; } });

// ================================================================ batch 3: weather, terrain, screens, hazards
function team(s) { const B = B_(); if (!B.team) B.team = [{}, {}]; return B.team[s]; }
function field() { const B = B_(); return B.field || (B.field = {}); }
function isGrounded(s) {
  const B = B_(), m = sideMon(s), S = B.S[s], F = field();
  if (F.gravity > 0 || S.smackDown || S.ingrain) return true;
  if (S.magnetRise > 0 || S.telekinesis > 0 || hItem(m) === 'AIRBALLOON' || abilOf(s) === 'LEVITATE') return false;
  return !pokeTypes(m).includes('FLYING');
}
const WEATHER = {
  SUN: ['The sunlight turned harsh!', 'The sunlight is strong.', 'The sunlight faded.', 'HEATROCK'],
  RAIN: ['It started to rain!', 'Rain continues to fall.', 'The rain stopped.', 'DAMPROCK'],
  SAND: ['A sandstorm kicked up!', 'The sandstorm rages.', 'The sandstorm subsided.', 'SMOOTHROCK'],
  HAIL: ['It started to hail!', 'Hail continues to fall.', 'The hail stopped.', 'ICYROCK'],
};
const TERRAIN = { ELECTRIC: ['An electric current runs across the battlefield!', 'The electric terrain disappeared.'], GRASSY: ['Grass grew to cover the battlefield!', 'The grassy terrain disappeared.'],
  MISTY: ['Mist swirled around the battlefield!', 'The misty terrain disappeared.'], PSYCHIC: ['The battlefield got weird!', 'The psychic terrain disappeared.'] };
const weatherFx = w => ({ selfOnly: true, status: function* (c) {
  const F = field(); if (F.weather === w) { yield* failMsg(); return false; }
  yield* attackAnim(c.us, c.md, true); F.weather = w; F.wTurns = hItem(c.user) === WEATHER[w][3] ? 8 : 5; yield* bmsg(WEATHER[w][0]); return true; } });
Fx('0FF', weatherFx('SUN')); Fx('100', weatherFx('RAIN')); Fx('101', weatherFx('SAND')); Fx('102', weatherFx('HAIL'));
const terrainFx = t => ({ selfOnly: true, status: function* (c) {
  const F = field(); if (F.terrain === t) { yield* failMsg(); return false; }
  yield* attackAnim(c.us, c.md, true); F.terrain = t; F.tTurns = hItem(c.user) === 'TERRAINEXTENDER' ? 8 : 5; yield* bmsg(TERRAIN[t][0]); return true; } });
Fx('154', terrainFx('ELECTRIC')); Fx('155', terrainFx('GRASSY')); Fx('156', terrainFx('MISTY')); Fx('15D', terrainFx('PSYCHIC'));
Fx('11F', { selfOnly: true, status: function* (c) {
  const F = field(); yield* attackAnim(c.us, c.md, true);
  if (F.trickRoom > 0) { F.trickRoom = 0; yield* bmsg(__('The twisted dimensions returned to normal!')); } else { F.trickRoom = 5; yield* bmsg(__('{0} twisted the dimensions!', mname(c.us))); } return true; } });
Fx('118', { selfOnly: true, status: function* (c) { const F = field(); if (F.gravity > 0) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); F.gravity = 5; yield* bmsg(__('Gravity intensified!')); return true; } });
const sideFx = (key, turns, msg, extra) => ({ selfOnly: true, status: function* (c) {
  const t = team(c.us); if (t[key] > 0 || (extra && extra.fail && extra.fail(c))) { yield* failMsg(); return false; }
  yield* attackAnim(c.us, c.md, true); t[key] = (extra && extra.lc && hItem(c.user) === 'LIGHTCLAY') ? 8 : turns; yield* bmsg(msg(c)); return true; } });
Fx('05B', sideFx('tailwind', 4, c => __('The tailwind blew from behind {0}!', mnameL(c.us))));
Fx('0A2', sideFx('reflect', 5, c => __('Reflect made {0} stronger against physical moves!', mnameL(c.us)), { lc: true }));
Fx('0A3', sideFx('lightScreen', 5, c => __('Light Screen made {0} stronger against special moves!', mnameL(c.us)), { lc: true }));
Fx('CF6', sideFx('auroraVeil', 5, c => __('Aurora Veil made {0} stronger against all moves!', mnameL(c.us)), { lc: true, fail: () => field().weather !== 'HAIL' }));
Fx('01A', sideFx('safeguard', 5, c => __('{0} is cloaked in a mystical veil!', mname(c.us))));
Fx('056', sideFx('mist', 5, c => __('{0} is shrouded in mist!', mname(c.us))));
Fx('0A1', sideFx('luckyChant', 5, c => __('The Lucky Chant shielded {0} from critical hits!', mnameL(c.us))));
// hazards: stored on the side that will be hurt (the opponent of the user)
Fx('103', { selfOnly: true, status: function* (c) { const t = team(c.ts); if ((t.spikes || 0) >= 3) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); t.spikes = (t.spikes || 0) + 1; yield* bmsg(__('Spikes were scattered all around the feet of the opposing team!')); return true; } });
Fx('104', { selfOnly: true, status: function* (c) { const t = team(c.ts); if ((t.tspikes || 0) >= 2) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); t.tspikes = (t.tspikes || 0) + 1; yield* bmsg(__('Poison spikes were scattered all around the feet of the opposing team!')); return true; } });
Fx('105', { selfOnly: true, status: function* (c) { const t = team(c.ts); if (t.rocks) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); t.rocks = true; yield* bmsg(__('Pointed stones float in the air around the opposing team!')); return true; } });
Fx('153', { selfOnly: true, status: function* (c) { const t = team(c.ts); if (t.web) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); t.web = true; yield* bmsg(__('A sticky web has been laid out on the ground around the opposing team!')); return true; } });
const clearHazards = t => { const had = !!(t.spikes || t.tspikes || t.rocks || t.web); t.spikes = 0; t.tspikes = 0; t.rocks = false; t.web = false; return had; };
Fx('110', { selfStat: [[3, 1]], after: function* (c) {
  const t = team(c.us); if (clearHazards(t)) yield* bmsg(__('{0} blew away the hazards!', mname(c.us)));
  if (c.S.bound) { c.S.bound = null; } if (c.S.seeded) { c.S.seeded = false; yield* bmsg(__('{0} shed Leech Seed!', mname(c.us))); } } });
Fx('049', { status: function* (c) {
  yield* attackAnim(c.us, c.md, true); yield* changeStage(c.ts, 7, -1, true);
  const a = clearHazards(team(c.us)), b = clearHazards(team(c.ts)), t = team(c.ts); let scr = false;
  for (const k of ['reflect', 'lightScreen', 'auroraVeil', 'safeguard', 'mist']) if (t[k] > 0) { t[k] = 0; scr = true; }
  if (a || b || scr) yield* bmsg(__('{0} blew away the hazards and barriers!', mname(c.us))); return true; } });
Fx('10A', { ignoreScreens: false, intro: function* (c) {
  const t = team(c.ts); let broke = false; for (const k of ['reflect', 'lightScreen', 'auroraVeil']) if (t[k] > 0) { t[k] = 0; broke = true; }
  if (broke) yield* bmsg(__('The wall shattered!')); } });
// weather-driven moves
Fx('087', { type: c => ({ SUN: 'FIRE', RAIN: 'WATER', SAND: 'ROCK', HAIL: 'ICE' })[wx()] || 'NORMAL', power: (c, p) => field().weather ? p * 2 : p });
const healFrac = { SUN: 2 / 3, RAIN: 0.25, SAND: 0.25, HAIL: 0.25 };
Fx('0D8', { selfOnly: true, status: function* (c) {
  if (c.user.hp >= c.user.maxhp) { yield* bmsg(__('{0}\'s HP is full!', mname(c.us))); return false; }
  if (c.S.healBlock > 0) { yield* failMsg(); return false; }
  yield* attackAnim(c.us, c.md, true); const f = healFrac[wx()] || 0.5;
  c.user.hp = Math.min(c.user.maxhp, c.user.hp + Math.max(1, Math.floor(c.user.maxhp * f))); yield* animHp(c.us, c.user.hp); yield* bmsg(__('{0} regained health!', mname(c.us))); return true; } });
Fx('0D9', { selfOnly: true, status: function* (c) {
  if (c.user.hp >= c.user.maxhp || c.user.status === 'SLP') { yield* failMsg(); return false; }
  yield* attackAnim(c.us, c.md, true); c.user.status = 'SLP'; c.user.sleep = 3; c.user.hp = c.user.maxhp; yield* animHp(c.us, c.user.hp);
  yield* bmsg(__('{0} slept and became healthy!', mname(c.us))); return true; } });
Fx('119', { selfOnly: true, status: function* (c) { if (c.S.magnetRise > 0) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); c.S.magnetRise = 5; yield* bmsg(__('{0} levitated with electromagnetism!', mname(c.us))); return true; } });
Fx('11A', { status: function* (c) { if (c.T.telekinesis > 0) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); c.T.telekinesis = 3; yield* bmsg(__('{0} was hurled into the air!', mname(c.ts))); return true; } });
Fx('11C', { hitsFlying: true, after: function* (c) { if (c.tgt.hp > 0 && !c.T.smackDown && pokeTypes(c.tgt).includes('FLYING') || c.T.magnetRise > 0) { c.T.smackDown = true; c.T.magnetRise = 0; c.T.telekinesis = 0; yield* bmsg(__('{0} fell straight down!', mname(c.ts))); } } });
Fx('135', { freezeDry: true });
Fx('15C', { sec: function* (c) { if (c.tgt.status === 'BRN') { c.tgt.status = null; yield* bmsg(__('{0}\'s burn was healed!', mname(c.ts))); } } });
// end of turn: weather, terrain, field and team timers (called from endOfTurn)
function* fieldEnd() {
  const B = B_(), F = field();
  if (F.weather) {
    const w = F.weather, W = WEATHER[w];
    if (--F.wTurns <= 0) { F.weather = null; yield* bmsg(W[2]); }
    else {
      yield* bmsg(W[1]);
      if (w === 'SAND' || w === 'HAIL') for (const s of [0, 1]) {
        const m = sideMon(s), ty = pokeTypes(m); if (m.hp <= 0 || abilWeatherImmune(s, w)) continue;
        if (w === 'SAND' ? ty.some(t => ['ROCK', 'GROUND', 'STEEL'].includes(t)) : ty.includes('ICE')) continue;
        m.hp = Math.max(0, m.hp - Math.max(1, Math.floor(m.maxhp / 16))); sfx('hit'); sprOf(s).shk = 10; yield* animHp(s, m.hp);
        yield* bmsg(__('{0} is buffeted by the {1}!', mname(s), (w === 'SAND' ? 'sandstorm' : 'hail')));
      }
    }
  }
  if (F.terrain) {
    if (F.terrain === 'GRASSY') for (const s of [0, 1]) { const m = sideMon(s); if (m.hp > 0 && m.hp < m.maxhp && isGrounded(s) && !(B.S[s].healBlock > 0)) { m.hp = Math.min(m.maxhp, m.hp + Math.max(1, Math.floor(m.maxhp / 16))); yield* animHp(s, m.hp); yield* bmsg(__('{0}\'s HP was restored.', mname(s))); } }
    if (--F.tTurns <= 0) { const t = F.terrain; F.terrain = null; yield* bmsg(TERRAIN[t][1]); }
  }
  if (F.trickRoom > 0 && --F.trickRoom === 0) yield* bmsg(__('The twisted dimensions returned to normal!'));
  if (F.gravity > 0 && --F.gravity === 0) yield* bmsg(__('Gravity returned to normal!'));
  if (F.magicRoom > 0 && --F.magicRoom === 0) yield* bmsg(__('Magic Room wore off, and held items\' effects returned to normal!'));
  if (F.wonderRoom > 0 && --F.wonderRoom === 0) yield* bmsg(__('Wonder Room wore off, and Defense and Sp. Def stats returned to normal!'));
  if (F.fairyLock > 0) F.fairyLock--;
  F.ion = false;
  if (F.mudSport > 0 && --F.mudSport === 0) yield* bmsg(__('The effects of Mud Sport wore off.'));
  if (F.waterSport > 0 && --F.waterSport === 0) yield* bmsg(__('The effects of Water Sport wore off.'));
  const names = { reflect: 'Reflect', lightScreen: 'Light Screen', auroraVeil: 'Aurora Veil', safeguard: 'Safeguard', mist: 'Mist', luckyChant: 'Lucky Chant', tailwind: 'The tailwind' };
  for (const s of [0, 1]) {
    const t = team(s);
    for (const k of Object.keys(names)) if (t[k] > 0 && --t[k] === 0) yield* bmsg(k === 'tailwind' ? __('The tailwind petered out!') : __('{0} team\'s {1} wore off!', (s === 0 ? 'Your' : 'The opposing'), names[k]));
    const S = B.S[s];
    if (S.magnetRise > 0 && --S.magnetRise === 0) yield* bmsg(__('{0}\'s electromagnetism wore off!', mname(s)));
    if (S.telekinesis > 0 && --S.telekinesis === 0) yield* bmsg(__('{0} was freed from the telekinesis!', mname(s)));
  }
}
// entry hazards on switch-in
function* applyHazards(s) {
  const B = B_(), m = sideMon(s), t = team(s); if (!m || m.hp <= 0) return;
  const hurt = function* (frac, msg) { if (abilOf(s) === 'MAGICGUARD') return; m.hp = Math.max(0, m.hp - Math.max(1, Math.floor(m.maxhp * frac))); sfx('hit'); sprOf(s).shk = 10; yield* animHp(s, m.hp); yield* bmsg(msg); };
  const g = isGrounded(s);
  if (t.rocks) { const e = typeMul('ROCK', pokeTypes(m)); yield* hurt(e / 8, __('Pointed stones dug into {0}!', mnameL(s))); if (m.hp <= 0) return; }
  if (t.spikes && g) { yield* hurt([0, 1 / 8, 1 / 6, 1 / 4][t.spikes], __('{0} was hurt by the spikes!', mname(s))); if (m.hp <= 0) return; }
  if (t.tspikes && g) {
    if (pokeTypes(m).includes('POISON')) { t.tspikes = 0; yield* bmsg(__('{0} absorbed the poison spikes!', mname(s))); }
    else if (!pokeTypes(m).includes('STEEL')) yield* inflict(s, 'PSN', true);
  }
  if (t.web && g) { yield* bmsg(__('{0} was caught in a sticky web!', mname(s))); yield* changeStage(s, 3, -1); }
}

// ================================================================ batch 4: two-turn, multi-turn and delayed moves
const INVULN_HITS = { fly: ['Gust', 'Twister', 'Thunder', 'Sky Uppercut', 'Hurricane', 'Smack Down', 'Thousand Arrows'], dig: ['Earthquake', 'Magnitude', 'Fissure'], dive: ['Surf', 'Whirlpool'], shadow: [] };
const INVULN_DBL = { fly: ['Gust', 'Twister'], dig: ['Earthquake', 'Magnitude'], dive: ['Surf', 'Whirlpool'] };
const chargeFx = (msg, o = {}) => Object.assign({ charge: Object.assign({ msg }, o.charge || {}) }, o.fx || {});
Fx('0C3', chargeFx(' whipped up a whirlwind!', { fx: { crit: 1 } }));
Fx('0C4', chargeFx(' absorbed light!', { charge: { skip: c => wx() === 'SUN' }, fx: { power: (c, p) => ['RAIN', 'SAND', 'HAIL'].includes(field().weather) ? p / 2 : p } }));
Fx('0C5', chargeFx(' became cloaked in a freezing light!'));
Fx('0C6', chargeFx(' became cloaked in freezing air!'));
Fx('0C7', chargeFx(' became cloaked in a harsh light!', { fx: { crit: 1 } }));
Fx('0C8', chargeFx(' tucked in its head!', { charge: { selfStat: [[2, 1]] } }));
Fx('0C9', chargeFx(' flew up high!', { charge: { invuln: 'fly' } }));
Fx('0CA', chargeFx(' burrowed its way under the ground!', { charge: { invuln: 'dig' } }));
Fx('0CB', chargeFx(' hid underwater!', { charge: { invuln: 'dive' } }));
Fx('0CC', chargeFx(' sprang up!', { charge: { invuln: 'fly' } }));
Fx('0CD', chargeFx(' vanished instantly!', { charge: { invuln: 'shadow' }, fx: { ignoresProtect: true } }));
Fx('14D', chargeFx(' vanished instantly!', { charge: { invuln: 'shadow' }, fx: { ignoresProtect: true } }));
Fx('0CE', chargeFx(' took the foe into the sky!', { charge: { invuln: 'fly' }, fx: { fail: c => pokeTypes(c.tgt).includes('FLYING') } }));
Fx('14E', Object.assign(chargeFx(' is absorbing power!'), { selfOnly: true, status: function* (c) {
  for (const [stt, dl] of [[4, 2], [5, 2], [3, 2]]) yield* changeStage(c.us, stt, dl); return true; } }));
// ---- locked multi-turn moves
Fx('0D2', { rampage: true }); Fx('0D3', { rollout: true, power: (c, p) => p * Math.pow(2, (c.S.lockMove ? c.S.lockMove.n : 0)) * (c.S.curled ? 2 : 1) });
Fx('0D1', { uproar: true });
function* lockUpdate(us, md, mi) {
  const B = B_(), S = B.S[us], c = B.lastCtx, fx = MFX[md.fn] || {};
  if (!c) return;
  if (fx.rampage) {
    if (!S.lockMove) { if (c.hits > 0) S.lockMove = { kind: 'rampage', mi, turns: 1 + rnd(2) }; }
    else if (c.hits === 0) S.lockMove = null;
    else if (--S.lockMove.turns <= 0) { S.lockMove = null; if (sideMon(us).hp > 0) { yield* bmsg(__('{0} became confused due to fatigue!', mname(us)), { hold: 8 }); yield* addConfuse(us, true); } }
  } else if (fx.rollout) {
    if (!S.lockMove) { if (c.hits > 0) S.lockMove = { kind: 'rollout', mi, n: 1 }; }
    else if (c.hits === 0 || ++S.lockMove.n >= 5) S.lockMove = null;
  } else if (fx.uproar) {
    if (!S.lockMove) { if (c.hits > 0) { S.lockMove = { kind: 'uproar', mi, turns: 1 + rnd(3) }; S.uproar = true; } }
    else if (c.hits === 0 || --S.lockMove.turns <= 0) { S.lockMove = null; S.uproar = false; yield* bmsg(__('{0} calmed down.', mname(us))); }
  }
}
// ---- Bide
// ---- delayed: Future Sight / Doom Desire, Wish, Healing Wish / Lunar Dance
Fx('111', { custom: function* (c) {
  const B = c.B; B.future = B.future || [];
  if (B.future.some(f => f.tgtSide === c.ts)) { yield* failMsg(); return; }
  yield* attackAnim(c.us, c.md, true); B.future.push({ src: c.user, srcSide: c.us, tgtSide: c.ts, md: c.md, turns: 3 });
  yield* bmsg(mname(c.us) + (c.md.name === 'Future Sight' ? __(' foresaw an attack!') : __(' chose Doom Desire as its destiny!'))); } });
Fx('0D7', { selfOnly: true, status: function* (c) { const t = team(c.us); if (t.wish) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); t.wish = { turns: 2, amt: Math.floor(c.user.maxhp / 2) }; yield* bmsg(__('{0} made a wish!', mname(c.us))); return true; } });
const hwFx = lunar => ({ selfOnly: true, status: function* (c) {
  if (c.B.meParty.length < 2 && c.us === 0 || (c.us === 1 && c.B.foeParty.filter(p => p.hp > 0).length < 2)) { yield* failMsg(); return false; }
  yield* attackAnim(c.us, c.md, true); team(c.us).healWish = lunar ? 2 : 1; c.user.hp = 0; yield* animHp(c.us, 0); return true; } });
Fx('0E3', hwFx(false)); Fx('0E4', hwFx(true));
function* delayedEnd() {   // Future Sight hits, Wish heals; called from fieldEnd
  const B = B_();
  for (const f of (B.future || [])) {
    if (--f.turns > 0) continue;
    const tgt = sideMon(f.tgtSide); if (!tgt || tgt.hp <= 0) continue;
    const c = { us: f.srcSide, ts: f.tgtSide, user: f.src, tgt, S: B.S[f.srcSide], T: B.S[f.tgtSide], md: f.md, fx: MFX[f.md.fn] || {}, B, hits: 0, done: 0, pow: f.md.pow, type: f.md.type, o: {} };
    const r = calcDamage(c, false);
    yield* bmsg(__('{0} took the {1} attack!', mname(f.tgtSide), f.md.name));
    if (r.eff === 0) { yield* bmsg(__('It doesn\'t affect {0}...', mname(f.tgtSide))); continue; }
    tgt.hp = Math.max(0, tgt.hp - r.dmg); sfx(r.eff > 1 ? 'hitsuper' : 'hit'); sprOf(f.tgtSide).shk = 18; yield* animHp(f.tgtSide, tgt.hp);
    if (r.eff > 1) yield* bmsg(__('It\'s super effective!')); else if (r.eff < 1) yield* bmsg(__('It\'s not very effective...'));
  }
  B.future = (B.future || []).filter(f => f.turns > 0);
  for (const s of [0, 1]) {
    const t = team(s); if (!t.wish) continue;
    if (--t.wish.turns > 0) continue;
    const m = sideMon(s), amt = t.wish.amt; t.wish = null;
    if (m && m.hp > 0 && m.hp < m.maxhp && !(B.S[s].healBlock > 0)) { m.hp = Math.min(m.maxhp, m.hp + amt); sfx('item'); yield* animHp(s, m.hp); yield* bmsg(__('{0}\'s wish came true!', mname(s))); }
    else if (m && m.hp > 0) yield* bmsg(__('{0}\'s wish came true!', mname(s)));
  }
}
function* healingWishIn(s) {   // called when a replacement is sent in
  const t = team(s); if (!t.healWish) return; const m = sideMon(s), lunar = t.healWish === 2; t.healWish = 0;
  m.hp = m.maxhp; m.status = null; m.sleep = 0; if (lunar) m.moves.forEach(x => x.pp = maxPP(x));
  sfx('item'); yield* animHp(s, m.hp); yield* bmsg(lunar ? __('The lunar dance healed {0}!', mnameL(s)) : __('The healing wish came true for {0}!', mnameL(s)));
}
// ---- Stockpile / Spit Up / Swallow
Fx('112', { selfOnly: true, status: function* (c) {
  if ((c.S.stock || 0) >= 3) { yield* failMsg(); return false; }
  yield* attackAnim(c.us, c.md, true); c.S.stock = (c.S.stock || 0) + 1; yield* bmsg(__('{0} stockpiled {1}!', mname(c.us), c.S.stock));
  yield* changeStage(c.us, 2, 1); yield* changeStage(c.us, 5, 1); c.S.stockBoost = (c.S.stockBoost || 0) + 1; return true; } });
const clearStock = function* (c) {
  const n = c.S.stockBoost || 0; c.S.stock = 0; c.S.stockBoost = 0;
  if (n) { yield* changeStage(c.us, 2, -n); yield* changeStage(c.us, 5, -n); yield* bmsg(__('{0}\'s stockpiled effect wore off!', mname(c.us))); } };
Fx('113', { fail: c => !(c.S.stock > 0), power: c => 100 * c.S.stock, after: clearStock });
Fx('114', { selfOnly: true, status: function* (c) {
  const n = c.S.stock || 0; if (!n) { yield* failMsg(); return false; }
  if (c.user.hp >= c.user.maxhp || c.S.healBlock > 0) { yield* clearStock(c); yield* failMsg(); return false; }
  yield* attackAnim(c.us, c.md, true); c.user.hp = Math.min(c.user.maxhp, c.user.hp + Math.floor(c.user.maxhp * [0, 0.25, 0.5, 1][n])); yield* animHp(c.us, c.user.hp);
  yield* bmsg(__('{0} regained health!', mname(c.us))); yield* clearStock(c); return true; } });
// ---- fainting moves & Beat Up
Fx('0E1', { fixed: c => c.user.hp, suicide: true });
Fx('0E2', { sec: undefined, status: function* (c) { yield* attackAnim(c.us, c.md, true); c.user.hp = 0; yield* animHp(c.us, 0); yield* changeStage(c.ts, 1, -2, true); yield* changeStage(c.ts, 4, -2, true); return true; } });
Fx('0C1', { nhits: c => (c.us === 0 ? c.B.meParty : c.B.foeParty).filter(p => p.hp > 0 && !p.status).length || 1, power: (c, p, hi) => { const l = (c.us === 0 ? c.B.meParty : c.B.foeParty).filter(x => x.hp > 0 && !x.status); const m = l[hi] || c.user; return 5 + Math.floor(D.SP[m.sym].base[1] / 10); } });
Fx('193', { fail: c => !(c.S.lastHit && c.S.lastHit.phys), failText: '\'s shell trap didn\'t work!' });
STATUS_FX['0BE'] = 'PSN';

// ---- Bide
Fx('0D4', { custom: function* (c) {
  const S = c.S, us = c.us;
  if (!S.bide) { S.bide = { n: 0, dmg: 0 }; S.lockMove = { kind: 'bide', mi: c.o.mi }; }
  S.bide.n++;
  if (S.bide.n < 3) { yield* bmsg(__('{0} is storing energy!', mname(us))); return; }
  const dmg = S.bide.dmg * 2; S.bide = null; S.lockMove = null;
  yield* bmsg(__('{0} unleashed energy!', mname(us)));
  if (!dmg) { yield* failMsg(); return; }
  c.tgt.hp = Math.max(0, c.tgt.hp - dmg); c.hits = 1; sfx('hit'); sprOf(c.ts).shk = 18; yield* animHp(c.ts, c.tgt.hp);
} });

// ===================================================================
//  BATCH 5: stats, items, copy moves, type changers, switching, odds and ends
// ===================================================================
function pokeTypes(p) { return p.btTypes || D.SP[p.sym].types; }       // battle-only type overrides live in p.btTypes
const ALL_TYPES = Object.keys(TYPE_COLORS).filter(t => t !== 'QMARKS');
function noteItem(p) { if (p && !p.itemBak) p.itemBak = { v: p.item || null }; }     // item goes back to its owner after the battle
function saveStats(p) { if (!p.statBak) p.statBak = p.stats.slice(); p.stats = p.stats.slice(); }
function btRestoreStats(p) { if (p && p.statBak) { p.stats = p.statBak; p.statBak = null; } }
function btRestore(p) {
  if (!p) return; p.dgBroken = false;
  btRestoreStats(p); delete p.btTypes; p.embargo = 0;
  if (p.mimBak) { p.mimBak.slot.id = p.mimBak.id; p.mimBak.slot.pp = Math.min(p.mimBak.pp, maxPP(p.mimBak.slot)); p.mimBak = null; }
  if (p.tfBak) { p.moves = p.tfBak.moves; p.tfBak = null; }
}
function btRestoreAll(B) {
  for (const p of [...(B.meParty || []), ...(B.foeParty || [])]) { btRestore(p); if (p.itemBak) { p.item = p.itemBak.v; p.itemBak = null; } }
}
const isBerry = k => /BERRY$/.test(k || '');
function* eatBerry(s, k) {
  const m = sideMon(s), nm = mname(s), iname = itemName(k); B_().S[s].ate = true;
  if (k === 'SITRUSBERRY') yield* healItem(s, Math.floor(m.maxhp / 4), __('{0} restored its health using its {1}!', nm, iname));
  else if (k === 'ORANBERRY') yield* healItem(s, 10, __('{0} restored its health using its {1}!', nm, iname));
  else if (PINCH_HEAL.includes(k)) yield* healItem(s, Math.floor(m.maxhp / 3), __('{0} restored its health using its {1}!', nm, iname));
  else if (PINCH_STAT[k]) { yield* bmsg(__('{0} ate the {1}!', nm, iname)); yield* changeStage(s, PINCH_STAT[k], 1); }
  else if (k === 'LEPPABERRY') { const sl = m.moves.find(x => x.pp < (D.MV[x.id].pp || 10)); if (sl) { sl.pp = Math.min(maxPP(sl), sl.pp + 10); yield* bmsg(__('{0} restored {1}\'s PP using its {2}!', nm, D.MV[sl.id].name, iname)); } else yield* bmsg(__('{0} ate the {1}!', nm, iname)); }
  else if ((k === 'LUMBERRY' && m.status) || (STATUS_BERRY[k] && m.status === STATUS_BERRY[k])) { m.status = null; sfx('item'); yield* bmsg(__('{0}\'s {1} cured its status problem!', nm, iname)); }
  else yield* bmsg(__('{0} ate the {1}!', nm, iname));
}
const statusMove = (fn, self) => Object.assign(self ? { selfOnly: true } : {}, { status: function* (c) { if (fn(c) === false) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); yield* fn.run(c); return true; } });
// helper to declare a plain status handler: test(c) -> fail?, run(c) generator
const SM = (self, test, run) => Object.assign(self ? { selfOnly: true } : {}, { status: function* (c) { if (test && test(c)) { yield* failMsg(); return false; } yield* attackAnim(c.us, c.md, true); yield* run(c); return true; } });
const selfStages = list => SM(true, null, function* (c) { for (const [s, d] of list) yield* changeStage(c.us, s, d); });
const foeStages = list => SM(false, null, function* (c) { for (const [s, d] of list) yield* changeStage(c.ts, s, d, true); });
const livingOthers = s => { const B = B_(), party = s === 0 ? B.meParty : B.foeParty, cur = sideMon(s); return party.filter(p => p !== cur && p.hp > 0); };

// ---- abilities (every ability the roster uses is handled by the hooks above / in battle.js)
function hasSec0(c) { const { md, fx } = c; if (md.cat === 'Status') return false; return (!!fx.sec && fx.sec !== bindFx.sec && fx.sec !== trapFx.sec) || ((md.eff || 0) > 0 && !!(STATUS_FX[md.fn] || STAGE_FX[md.fn] || md.fn === '00F' || md.fn === '010')); }
function* abilAfterHitOld(c) {   // abilities that react to being hit
  const { us, ts, user, tgt, md } = c; if (tgt.hp <= 0 || c.subHit || !c.hits) return;
  const ta = abilOf(ts);
  if (hasFlag(md, 'a') && user.hp > 0 && rnd(100) < 30) {
    if (ta === 'POISONPOINT' && !user.status) { yield* bmsg(__('{0}\'s Poison Point!', mname(ts))); yield* inflict(us, 'PSN'); }
    else if (ta === 'FLAMEBODY' && !user.status) { yield* bmsg(__('{0}\'s Flame Body!', mname(ts))); yield* inflict(us, 'BRN'); }
  }
  if (ta === 'RATTLED' && ['BUG', 'GHOST', 'DARK'].includes(c.type)) { yield* bmsg(__('{0}\'s Rattled!', mname(ts))); yield* changeStage(ts, 3, 1); }
  if (ta === 'JUSTIFIED' && c.type === 'DARK') { yield* bmsg(__('{0}\'s Justified!', mname(ts))); yield* changeStage(ts, 1, 1); }
}
Fx('194', SM(false, c => !callable(c.T.lastMoveKey || ''), function* (c) { yield* bmsg(__('{0} followed {1}\'s instructions!', mname(c.ts), mnameL(c.us))); yield* doMove(c.ts, D.MV[c.T.lastMoveKey], { slot: null, mi: -1, called: true }); }));

// ---- stat manipulation
Fx('023', SM(true, c => c.S.direHit, function* (c) { c.S.direHit = true; yield* bmsg(__('{0} is getting pumped!', mname(c.us))); }));
Fx('035', selfStages([[2, -1], [5, -1], [1, 2], [4, 2], [3, 2]]));
Fx('036', selfStages([[1, 1], [3, 2]]));
Fx('037', SM(true, c => ![1, 2, 3, 4, 5, 6, 7].some(i => c.S.st[i] < 6), function* (c) { const o = [1, 2, 3, 4, 5, 6, 7].filter(i => c.S.st[i] < 6); yield* changeStage(c.us, o[rnd(o.length)], 2); }));
Fx('038', selfStages([[2, 3]])); Fx('039', selfStages([[4, 3]]));
Fx('03A', SM(true, c => c.user.hp <= Math.floor(c.user.maxhp / 2) || c.S.st[1] >= 6, function* (c) { c.user.hp -= Math.floor(c.user.maxhp / 2); yield* animHp(c.us, c.user.hp); c.S.st[1] = 6; yield* bmsg(__('{0} cut its own HP and maximized its Attack!', mname(c.us))); }));
Fx('04A', foeStages([[1, -1], [2, -1]]));
Fx('13A', foeStages([[1, -1], [4, -1]]));
Fx('139', foeStages([[1, -1]])); Fx('13C', foeStages([[4, -1]])); Fx('13D', foeStages([[4, -2]]));
Fx('140', SM(false, c => c.tgt.status !== 'PSN', function* (c) { for (const [s, d] of [[1, -1], [4, -1], [3, -1]]) yield* changeStage(c.ts, s, d, true); }));
Fx('A29', selfStages([[1, 1]]));
Fx('A15', SM(true, c => c.user.hp <= Math.floor(c.user.maxhp / 3), function* (c) { c.user.hp -= Math.floor(c.user.maxhp / 3); yield* animHp(c.us, c.user.hp); for (const s of [1, 2, 3, 4, 5]) yield* changeStage(c.us, s, 1); }));
Fx('A22', SM(true, c => c.S.noRetreat, function* (c) { c.S.noRetreat = true; for (const s of [1, 2, 3, 4, 5]) yield* changeStage(c.us, s, 1); yield* bmsg(__('{0} can no longer escape!', mname(c.us))); }));
Fx('A24', SM(false, c => c.T.octo, function* (c) { c.T.octo = c.user; yield* bmsg(__('{0} can no longer escape because of the octolock!', mname(c.ts))); }));
Fx('A26', SM(false, c => c.T.tarShot, function* (c) { yield* changeStage(c.ts, 3, -1, true); c.T.tarShot = true; yield* bmsg(__('{0} became weaker to fire!', mname(c.ts))); }));
Fx('A17', SM(false, null, function* (c) { yield* changeStage(c.ts, 1, 2); yield* changeStage(c.ts, 4, 2); }));
Fx('A07', SM(false, c => c.T.st[1] <= -6, function* (c) {
  const amt = Math.max(1, Math.floor(c.tgt.stats[1] * stageMul(c.T.st[1])));
  yield* changeStage(c.ts, 1, -1, true);
  if (c.user.hp < c.user.maxhp && !(c.S.healBlock > 0)) yield* healItem(c.us, amt, __('{0} had its HP restored!', mname(c.us))); }));
Fx('13F', SM(true, c => ![0, 1].some(s => pokeTypes(sideMon(s)).includes('GRASS')), function* (c) { for (const s of [0, 1]) if (pokeTypes(sideMon(s)).includes('GRASS')) yield* changeStage(s, 2, 1, s !== c.us); }));
Fx('13E', SM(true, c => ![0, 1].some(s => pokeTypes(sideMon(s)).includes('GRASS') && isGrounded(s)), function* (c) { for (const s of [0, 1]) if (pokeTypes(sideMon(s)).includes('GRASS') && isGrounded(s)) { yield* changeStage(s, 1, 1); yield* changeStage(s, 4, 1); } }));
Fx('051', SM(true, null, function* (c) { B_().S.forEach(S => S.st.fill(0)); yield* bmsg(__('All stat changes were eliminated!')); }));
const swapStages = (idx, msg) => SM(false, null, function* (c) { for (const i of idx) { const t = c.S.st[i]; c.S.st[i] = c.T.st[i]; c.T.st[i] = t; } yield* bmsg(mname(c.us) + ' ' + msg); });
Fx('052', swapStages([1, 4], 'switched all changes to its Attack and Sp. Atk with the target!'));
Fx('053', swapStages([2, 5], 'switched all changes to its Defense and Sp. Def with the target!'));
Fx('054', swapStages([1, 2, 3, 4, 5, 6, 7], 'switched stat changes with the target!'));
Fx('055', SM(false, null, function* (c) { c.S.st = c.T.st.slice(); yield* bmsg(__('{0} copied {1}\'s stat changes!', mname(c.us), mnameL(c.ts))); }));
Fx('141', SM(false, c => !c.T.st.some(v => v), function* (c) { c.T.st = c.T.st.map(v => -v); yield* bmsg(__('{0}\'s stat changes were all reversed!', mname(c.ts))); }));
Fx('057', SM(true, null, function* (c) { saveStats(c.user); const s = c.user.stats; [s[1], s[2]] = [s[2], s[1]]; yield* bmsg(__('{0} switched its Attack and Defense!', mname(c.us))); }));
const splitFx = (idx, msg) => SM(false, null, function* (c) { saveStats(c.user); saveStats(c.tgt); for (const i of idx) { const a = Math.floor((c.user.stats[i] + c.tgt.stats[i]) / 2); c.user.stats[i] = a; c.tgt.stats[i] = a; } yield* bmsg(__('{0} shared its {1} with its target!', mname(c.us), msg)); });
Fx('058', splitFx([1, 4], 'power')); Fx('059', splitFx([2, 5], 'guard'));
Fx('1B7', SM(false, null, function* (c) { saveStats(c.user); saveStats(c.tgt); const t = c.user.stats[3]; c.user.stats[3] = c.tgt.stats[3]; c.tgt.stats[3] = t; yield* bmsg(__('{0} exchanged Speed stats with its target!', mname(c.us))); }));
Fx('05A', SM(false, null, function* (c) { const a = Math.floor((c.user.hp + c.tgt.hp) / 2); c.user.hp = Math.min(c.user.maxhp, a); c.tgt.hp = Math.min(c.tgt.maxhp, a); yield* animHp(c.us, c.user.hp); yield* animHp(c.ts, c.tgt.hp); yield* bmsg(__('The battlers shared their pain!')); }));

// ---- healing / cures
Fx('018', SM(true, c => !['PAR', 'BRN', 'PSN'].includes(c.user.status), function* (c) { c.user.status = null; sfx('item'); yield* bmsg(__('{0} cured its status problem!', mname(c.us))); }));
Fx('019', SM(true, null, function* (c) { const party = c.us === 0 ? B_().meParty : B_().foeParty; party.forEach(p => { if (p.hp > 0) p.status = null; }); yield* bmsg(c.md.name === 'Heal Bell' ? __('A bell chimed!') : __('A soothing aroma wafted through the air!')); yield* bmsg(__('All status problems in the party were healed!')); }));
Fx('01B', SM(false, c => !c.user.status || c.tgt.status, function* (c) { c.tgt.status = c.user.status; c.tgt.sleep = c.user.sleep; c.tgt.toxic = c.user.toxic; c.user.status = null; yield* bmsg(__('{0} was given the status problem!', mname(c.ts))); }));
Fx('159', SM(true, c => c.user.hp >= c.user.maxhp, function* (c) { yield* healItem(c.us, Math.floor(c.user.maxhp * (wx() === 'SAND' ? 2 / 3 : 0.5)), __('{0} regained health!', mname(c.us))); }));
Fx('A20', SM(true, c => c.user.hp >= c.user.maxhp, function* (c) { yield* healItem(c.us, Math.floor(c.user.maxhp / 4), __('{0} regained health!', mname(c.us))); }));
Fx('CF2', SM(false, c => c.tgt.hp >= c.tgt.maxhp, function* (c) { yield* healItem(c.ts, Math.floor(c.tgt.maxhp * (field().terrain === 'MISTY' ? 2 / 3 : 0.5)), __('{0} regained health!', mname(c.ts))); }));
Fx('1BB', SM(false, c => !c.tgt.status, function* (c) { c.tgt.status = null; yield* bmsg(__('{0} had its status problem cured!', mname(c.ts))); yield* healItem(c.us, Math.floor(c.user.maxhp / 2), __('{0} regained health!', mname(c.us))); }));
Fx('1BA', SM(false, null, function* (c) { yield* inflict(c.ts, 'PSN'); yield* changeStage(c.ts, 3, -1, true); }));
const eatCheck = c => !(isBerry(hItem(c.user)));
Fx('A25', SM(true, eatCheck, function* (c) { const k = hItem(c.user); c.user.item = null; yield* eatBerry(c.us, k); yield* changeStage(c.us, 2, 2); }));
Fx('A27', SM(true, null, function* (c) { yield* bmsg(__('It\'s teatime! Everyone dug in to their Berries!')); for (const s of [0, 1]) { const m = sideMon(s), k = hItem(m); if (isBerry(k)) { m.item = null; yield* eatBerry(s, k); } } }));

// ---- field-wide / team odds and ends
Fx('09D', SM(true, c => field().mudSport, function* (c) { field().mudSport = 5; yield* bmsg(__('Electricity\'s power was weakened!')); }));
Fx('09E', SM(true, c => field().waterSport, function* (c) { field().waterSport = 5; yield* bmsg(__('Fire\'s power was weakened!')); }));
Fx('146', Object.assign(SM(true, null, function* (c) { field().ion = true; yield* bmsg(__('A deluge of ions showered the battlefield!')); }), { after: function* (c) { field().ion = true; } }));
Fx('F9 0F9', {});
Fx('0F9', SM(true, null, function* (c) { const F = field(); if (F.magicRoom > 0) { F.magicRoom = 0; yield* bmsg(__('Magic Room wore off, and held items\' effects returned to normal!')); } else { F.magicRoom = 5; yield* bmsg(__('{0} created a bizarre area in which Pokémon\'s held items lose their effects!', mname(c.us))); } }));
Fx('124', SM(true, null, function* (c) { const F = field(); if (F.wonderRoom > 0) { F.wonderRoom = 0; yield* bmsg(__('Wonder Room wore off, and the Defense and Sp. Def stats returned to normal!')); } else { F.wonderRoom = 5; yield* bmsg(__('{0} created a bizarre area in which Defense and Sp. Def stats are swapped!', mname(c.us))); } }));
Fx('152', SM(true, c => field().fairyLock > 0, function* (c) { field().fairyLock = 2; yield* bmsg(__('No one will be able to run away during the next turn!')); }));
Fx('157', SM(true, null, function* (c) { B_().happyHour = true; yield* bmsg(__('Everyone is overjoyed!')); }));
Fx('134', SM(true, null, function* (c) { yield* bmsg(__('Congratulations, {0}!', (c.us === 0 ? G.name : 'trainer'))); }));
Fx('109', { after: function* (c) { if (c.us === 0) { const B = B_(); B.payday = (B.payday || 0) + 5 * c.user.lvl; yield* bmsg(__('Coins were scattered everywhere!')); } } });
Fx('A16', SM(false, null, function* (c) {
  const keys = ['spikes', 'tspikes', 'rocks', 'web', 'reflect', 'lightScreen', 'auroraVeil', 'tailwind', 'safeguard', 'mist', 'luckyChant'];
  const a = team(0), b = team(1); for (const k of keys) { const t = a[k]; a[k] = b[k]; b[k] = t; }
  yield* bmsg(__('{0} swapped the battle effects affecting each side of the field!', mname(c.us))); }));
Fx('0B1', SM(true, null, function* (c) { c.S.coat = true; yield* bmsg(__('{0} shrouded itself with Magic Coat!', mname(c.us))); }));
Fx('0B2', SM(true, null, function* (c) { c.S.snatch = true; yield* bmsg(__('{0} waits for a target to make a move!', mname(c.us))); }));
Fx('0F8', SM(false, c => c.tgt.embargo > 0, function* (c) { c.tgt.embargo = 5; yield* bmsg(__('{0} can\'t use items anymore!', mname(c.ts))); }));
Fx('CF18', SM(true, null, function* (c) { c.S.laserFocus = 2; yield* bmsg(__('{0} concentrated intensely!', mname(c.us))); }));

// ---- abilities (they have no battle effect yet, but the changes are tracked per battler)
const abilName = a => a ? a.charAt(0) + a.slice(1).toLowerCase() : 'nothing';
Fx('063', SM(false, c => abilOf(c.ts) === 'SIMPLE', function* (c) { c.T.ability = 'SIMPLE'; yield* bmsg(__('{0} acquired Simple!', mname(c.ts))); }));
Fx('064', SM(false, c => abilOf(c.ts) === 'INSOMNIA', function* (c) { c.T.ability = 'INSOMNIA'; yield* bmsg(__('{0} acquired Insomnia!', mname(c.ts))); }));
Fx('065', SM(false, c => !abilOf(c.ts), function* (c) { c.S.ability = abilOf(c.ts); yield* bmsg(__('{0} copied {1}\'s {2}!', mname(c.us), mnameL(c.ts), abilName(c.S.ability))); }));
Fx('066', SM(false, c => !abilOf(c.us), function* (c) { c.T.ability = abilOf(c.us); yield* bmsg(__('{0} acquired {1}!', mname(c.ts), abilName(c.T.ability))); }));
Fx('067', SM(false, null, function* (c) { const a = abilOf(c.us), b = abilOf(c.ts); c.S.ability = b; c.T.ability = a; yield* bmsg(__('{0} swapped Abilities with its target!', mname(c.us))); }));
Fx('068', SM(false, null, function* (c) { c.T.ability = null; yield* bmsg(__('{0}\'s Ability was suppressed!', mname(c.ts))); }));

// ---- type changers
const setTypes = (s, t) => { sideMon(s).btTypes = t; };
Fx('05E', SM(true, c => { const t = c.user.moves.map(m => D.MV[m.id].type).find(t => t !== 'QMARKS' && !pokeTypes(c.user).includes(t)); c._t = t; return !t; }, function* (c) { setTypes(c.us, [c._t]); yield* bmsg(__('{0} transformed into the {1} type!', mname(c.us), c._t)); }));
Fx('05F', SM(false, c => { const k = c.T.lastMoveKey, ty = k && D.MV[k].type; if (!ty || ty === 'QMARKS') return true; const o = ALL_TYPES.filter(t => typeMul(ty, [t]) < 1 && !(pokeTypes(c.user).length === 1 && pokeTypes(c.user)[0] === t)); c._t = o[rnd(o.length)]; return !c._t; }, function* (c) { setTypes(c.us, [c._t]); yield* bmsg(__('{0} transformed into the {1} type!', mname(c.us), c._t)); }));
Fx('060', SM(true, null, function* (c) { const t = { ELECTRIC: 'ELECTRIC', GRASSY: 'GRASS', MISTY: 'FAIRY', PSYCHIC: 'PSYCHIC' }[field().terrain] || 'NORMAL'; setTypes(c.us, [t]); yield* bmsg(__('{0}\'s type changed to {1}!', mname(c.us), t)); }));
Fx('061', SM(false, c => pokeTypes(c.tgt).join() === 'WATER', function* (c) { setTypes(c.ts, ['WATER']); yield* bmsg(__('{0} transformed into the WATER type!', mname(c.ts))); }));
Fx('062', SM(false, null, function* (c) { setTypes(c.us, pokeTypes(c.tgt).slice()); yield* bmsg(__('{0}\'s type changed to match {1}\'s!', mname(c.us), mnameL(c.ts))); }));
Fx('142', SM(false, c => pokeTypes(c.tgt).includes('GHOST'), function* (c) { setTypes(c.ts, [...pokeTypes(c.tgt), 'GHOST']); yield* bmsg(__('Ghost type was added to {0}!', mnameL(c.ts))); }));
Fx('143', SM(false, c => pokeTypes(c.tgt).includes('GRASS'), function* (c) { setTypes(c.ts, [...pokeTypes(c.tgt), 'GRASS']); yield* bmsg(__('Grass type was added to {0}!', mnameL(c.ts))); }));
Fx('A21', SM(false, c => pokeTypes(c.tgt).join() === 'PSYCHIC', function* (c) { setTypes(c.ts, ['PSYCHIC']); yield* bmsg(__('{0}\'s type changed to PSYCHIC!', mname(c.ts))); }));
Fx('1B9', { fail: c => !pokeTypes(c.user).includes('FIRE'), after: function* (c) { setTypes(c.us, pokeTypes(c.user).filter(t => t !== 'FIRE')); yield* bmsg(__('{0} burned itself out!', mname(c.us))); } });
Fx('192', { type: c => pokeTypes(c.user)[0] || 'NORMAL' });
const PLATE = { FLAMEPLATE: 'FIRE', SPLASHPLATE: 'WATER', ZAPPLATE: 'ELECTRIC', MEADOWPLATE: 'GRASS', ICICLEPLATE: 'ICE', FISTPLATE: 'FIGHTING', TOXICPLATE: 'POISON', EARTHPLATE: 'GROUND', SKYPLATE: 'FLYING', MINDPLATE: 'PSYCHIC', INSECTPLATE: 'BUG', STONEPLATE: 'ROCK', SPOOKYPLATE: 'GHOST', DRACOPLATE: 'DRAGON', DREADPLATE: 'DARK', IRONPLATE: 'STEEL', PIXIEPLATE: 'FAIRY' };
const DRIVE = { SHOCKDRIVE: 'ELECTRIC', BURNDRIVE: 'FIRE', CHILLDRIVE: 'ICE', DOUSEDRIVE: 'WATER' };
Fx('09F', { type: c => { const k = hItem(c.user); if (c.md.name === 'Judgment') return PLATE[k] || 'NORMAL'; if (c.md.name === 'Techno Blast') return DRIVE[k] || 'NORMAL'; const m = /^(.*)MEMORY$/.exec(k); return m && ALL_TYPES.includes(m[1]) ? m[1] : 'NORMAL'; } });

// ---- item moves
const stealable = k => k && !/ITE$|STONE$/.test(k);
Fx('0F2', SM(false, c => tAb(c) === 'STICKYHOLD' || (!c.user.item && !c.tgt.item) || !stealable(c.user.item || 'X') && c.user.item || !stealable(c.tgt.item || 'X') && c.tgt.item, function* (c) {
  noteItem(c.user); noteItem(c.tgt); const t = c.user.item || null; c.user.item = c.tgt.item || null; c.tgt.item = t;
  yield* bmsg(__('{0} switched items with its target!', mname(c.us)));
  if (c.user.item) yield* bmsg(__('{0} obtained one {1}.', mname(c.us), itemName(c.user.item))); if (c.tgt.item) yield* bmsg(__('{0} obtained one {1}.', mname(c.ts), itemName(c.tgt.item))); }));
Fx('0F1', { after: function* (c) {
  if (tAb(c) === 'STICKYHOLD' || c.user.item || !c.tgt.item || !stealable(c.tgt.item) || c.us === 1 && false) return;
  if (c.us === 1) noteItem(c.tgt);   // a foe's theft is undone after the battle
  const k = c.tgt.item; c.tgt.item = null; c.user.item = k; yield* bmsg(__('{0} stole {1}\'s {2}!', mname(c.us), mnameL(c.ts), itemName(k))); } });
Fx('0F3', SM(false, c => !c.user.item || c.tgt.item || !stealable(c.user.item), function* (c) { noteItem(c.user); const k = c.user.item; c.user.item = null; c.tgt.item = k; yield* bmsg(__('{0} received {1} from {2}!', mname(c.ts), itemName(k), mnameL(c.us))); }));
Fx('0F4', { after: function* (c) { const k = c.tgt.item; if (tAb(c) === 'STICKYHOLD' || !isBerry(k) || c.tgt.hp <= 0 && false) return; noteItem(c.tgt); c.tgt.item = null; yield* bmsg(__('{0} stole and ate {1}\'s {2}!', mname(c.us), mnameL(c.ts), itemName(k))); yield* eatBerry(c.us, k); } });
Fx('0F5', { after: function* (c) { const k = c.tgt.item; if (!k || !(isBerry(k) || /GEM$/.test(k))) return; noteItem(c.tgt); c.tgt.item = null; yield* bmsg(__('{0}\'s {1} was burned up!', mname(c.ts), itemName(k))); } });
Fx('0F6', SM(true, c => c.user.item || !c.S.lastItem, function* (c) { c.user.item = c.S.lastItem; c.S.lastItem = null; yield* bmsg(__('{0} found one {1}!', mname(c.us), itemName(c.user.item))); }));
const FLING = { IRONBALL: 130, HARDSTONE: 100, RAREBONE: 100, LEFTOVERS: 10, QUICKCLAW: 80, KINGSROCK: 30, RAZORFANG: 30, LIGHTBALL: 30, FLAMEORB: 30, TOXICORB: 30, CHOICEBAND: 10, CHOICESPECS: 10, CHOICESCARF: 10, LIFEORB: 30, EXPERTBELT: 10, SCOPELENS: 30, RAZORCLAW: 80, ASSAULTVEST: 80, FOCUSSASH: 10, WHITEHERB: 10, ROCKYHELMET: 60, BIGROOT: 10, SHELLBELL: 30, BLACKSLUDGE: 30, MUSCLEBAND: 10, WISEGLASSES: 10, WIDELENS: 10, BRIGHTPOWDER: 10 };
Fx('0F7', { power: (c, p) => FLING[hItem(c.user)] || 30, fail: c => !hItem(c.user) || /ITE$/.test(hItem(c.user)),
  after: function* (c) {
    const k = c.user.item; if (!k) return; noteItem(c.user); c.user.item = null; yield* bmsg(__('{0} flung its {1}!', mname(c.us), itemName(k)));
    if (c.tgt.hp <= 0) return;
    if (k === 'FLAMEORB') yield* inflict(c.ts, 'BRN'); else if (k === 'TOXICORB') yield* inflict(c.ts, 'PSN'); else if (k === 'LIGHTBALL') yield* inflict(c.ts, 'PAR');
    else if (k === 'KINGSROCK' || k === 'RAZORFANG') c.T.flinch = true;
    else if (k === 'WHITEHERB') c.T.st = c.T.st.map(v => Math.max(0, v));
    else if (isBerry(k)) yield* eatBerry(c.ts, k); } });
const BERRY_TYPE = { CHERIBERRY: 'FIRE', CHESTOBERRY: 'WATER', PECHABERRY: 'ELECTRIC', RAWSTBERRY: 'GRASS', ASPEARBERRY: 'ICE', LEPPABERRY: 'FIGHTING', ORANBERRY: 'POISON', PERSIMBERRY: 'GROUND', LUMBERRY: 'FLYING', SITRUSBERRY: 'PSYCHIC', FIGYBERRY: 'BUG', WIKIBERRY: 'ROCK', MAGOBERRY: 'GHOST', AGUAVBERRY: 'DRAGON', IAPAPABERRY: 'DARK' };
const gift = k => RESIST_BERRY[k] || BERRY_TYPE[k] || null;
Fx('096', { type: c => gift(hItem(c.user)) || 'NORMAL', power: () => 80, fail: c => !isBerry(hItem(c.user)) || !gift(hItem(c.user)), after: function* (c) { const k = c.user.item; noteItem(c.user); c.user.item = null; c.S.lastItem = k; yield* bmsg(__('{0}\'s {1} was used up!', mname(c.us), itemName(k))); } });

// ---- smaller damaging moves
Fx('088', { power: (c, p) => c.T.switching ? p * 2 : p });
Fx('093', { after: function* (c) { c.S.rage = true; } });
Fx('125', { fail: c => !c.slot || c.user.moves.length < 2 || c.user.moves.some(m => m !== c.slot && !(c.S.used && c.S.used[m.id])) });
Fx('123', { fail: c => !pokeTypes(c.tgt).some(t => pokeTypes(c.user).includes(t)) });
Fx('136', { after: function* (c) { if (rnd(2) === 0 && c.user.hp > 0) yield* changeStage(c.us, 2, 2); } });
Fx('13B', { selfStat: [[2, -1]], ignoresProtect: true });
Fx('147', { ignoresProtect: true });
Fx('150', { after: function* (c) { if (c.tgt.hp <= 0) yield* changeStage(c.us, 1, 3); } });
Fx('158', { fail: c => !c.S.ate });
Fx('1A1', { intro: function* (c) { let any = false; for (let i = 1; i <= 7; i++) if (c.T.st[i] > 0) { c.S.st[i] = Math.min(6, c.S.st[i] + c.T.st[i]); c.T.st[i] = 0; any = true; } if (any) yield* bmsg(__('{0} stole {1}\'s stat boosts!', mname(c.us), mnameL(c.ts))); } });
Fx('A01', { selfStat: [[2, -1]] });
Fx('A03', { fail: c => c.S.age > 0 });
Fx('A04 A30', { recoilMax: 0.5 });
Fx('A06', { cat: c => c.user.stats[1] * stageMul(c.S.st[1]) > c.user.stats[4] * stageMul(c.S.st[4]) ? 'Physical' : 'Special' });
Fx('A31', { cat: c => c.user.stats[1] * stageMul(c.S.st[1]) / (c.tgt.stats[2] * stageMul(c.T.st[2])) >= c.user.stats[4] * stageMul(c.S.st[4]) / (c.tgt.stats[5] * stageMul(c.T.st[5])) ? 'Physical' : 'Special' });
Fx('A09', { power: (c, p) => c.S.lastFailed ? p * 2 : p });
Fx('A10', { nhits: () => 2, sec: function* (c) { if (rnd(100) < 30) c.T.flinch = true; } });
Fx('A11', { sec: function* (c) { yield* changeStage(c.us, 3, 1); } });
Fx('A14', { power: (c, p) => !c.T.moved ? p * 2 : p });
Fx('A18', { nhits: () => 2 });
Fx('A19', { sec: function* (c) { if (!c.T.trapped && !c.S.trapped) { c.T.trapped = c.user; c.S.trapped = c.tgt; yield* bmsg(__('Neither Pokémon can run away!')); } } });
Fx('A28', { power: (c, p) => field().gravity > 0 ? Math.floor(p * 1.5) : p, sec: function* (c) { yield* changeStage(c.ts, 2, -1, true); } });
Fx('CF15', { sec: function* (c) { c.T.throat = 2; } });

// ---- copy / called moves
const NOCALL = new Set(['METRONOME', 'STRUGGLE', 'COUNTER', 'MIRRORCOAT', 'PROTECT', 'DETECT', 'ENDURE', 'FOCUSPUNCH', 'SLEEPTALK', 'ASSIST', 'COPYCAT', 'MIMIC', 'SKETCH', 'TRANSFORM', 'MEFIRST', 'MIRRORMOVE', 'NATUREPOWER', 'BIDE', 'DESTINYBOND', 'SNATCH', 'THIEF', 'COVET', 'TRICK', 'SWITCHEROO', 'HELPINGHAND', 'FOLLOWME', 'RAGEPOWDER', 'SPOTLIGHT', 'BELCH', 'SHELLTRAP', 'BEAKBLAST', 'KINGSSHIELD', 'SPIKYSHIELD', 'BANEFULBUNKER', 'OBSTRUCT', 'CRAFTYSHIELD', 'MATBLOCK', 'QUICKGUARD', 'WIDEGUARD', 'SKYDROP', 'METALBURST', 'BESTOW', 'CELEBRATE', 'HOLDHANDS', 'UPROAR', 'MAGICCOAT', 'INSTRUCT', 'AFTERYOU', 'QUASH', 'FLING', 'CHATTER', 'FOCUSENERGY']);
function callable(key) { const md = D.MV[key]; if (!md || NOCALL.has(key) || md.type === 'QMARKS') return false; const fx = MFX[md.fn] || {}; return !(fx.charge || fx.protectKind || fx.rampage || fx.rollout || fx.uproar || fx.lockMove); }
function* callMove(c, key, extra) {
  const md = D.MV[key]; yield* bmsg(__('{0} used {1}!', mname(c.us), md.name), { hold: 12 });
  yield* doMove(c.us, md, Object.assign({ slot: null, mi: -1, called: true }, extra));
}
Fx('0B6', SM(true, null, function* (c) { const ks = Object.keys(D.MV).filter(callable); yield* callMove(c, ks[rnd(ks.length)]); }));
Fx('0AE', SM(false, c => !callable(c.T.lastMoveKey || ''), function* (c) { yield* callMove(c, c.T.lastMoveKey); }));
Fx('0AF', SM(true, c => !callable(B_().prevMoveKey || ''), function* (c) { yield* callMove(c, B_().prevMoveKey); }));
Fx('0B3', SM(true, null, function* (c) { const k = { ELECTRIC: 'THUNDERBOLT', GRASSY: 'ENERGYBALL', MISTY: 'MOONBLAST', PSYCHIC: 'PSYCHIC' }[field().terrain] || 'TRIATTACK'; yield* callMove(c, k); }));
Fx('0B4', Object.assign(SM(true, c => c.user.status !== 'SLP' || !c.user.moves.some(m => callable(m.id) && m !== c.slot), function* (c) { const o = c.user.moves.filter(m => callable(m.id) && m !== c.slot); yield* callMove(c, o[rnd(o.length)].id); }), { sleepOk: true }));
Fx('0B5', SM(true, c => { const party = c.us === 0 ? B_().meParty : B_().foeParty; c._a = []; for (const p of party) if (p !== c.user) for (const m of p.moves) if (callable(m.id)) c._a.push(m.id); return !c._a.length; }, function* (c) { yield* callMove(c, c._a[rnd(c._a.length)]); }));
Fx('0B0', SM(false, c => { const e = (B_().queue || []).find(a => a.s === c.ts && !a.done); c._e = e; return !e || !e.md || !(e.md.pow > 0) || !callable(Object.keys(D.MV).find(k => D.MV[k] === e.md)); }, function* (c) { yield* callMove(c, Object.keys(D.MV).find(k => D.MV[k] === c._e.md), { meFirst: true }); }));
Fx('05C', SM(false, c => { const k = c.T.lastMoveKey; return !c.slot || !k || ['MIMIC', 'SKETCH', 'TRANSFORM', 'METRONOME', 'STRUGGLE', 'CHATTER'].includes(k) || c.user.moves.some(m => m.id === k) || c.user.mimBak; }, function* (c) {
  const k = c.T.lastMoveKey; c.user.mimBak = { slot: c.slot, id: c.slot.id, pp: c.slot.pp }; c.slot.id = k; c.slot.pp = Math.min(5, D.MV[k].pp); yield* bmsg(__('{0} learned {1}!', mname(c.us), D.MV[k].name)); }));
Fx('05D', SM(false, c => { const k = c.T.lastMoveKey; return !c.slot || !k || ['SKETCH', 'STRUGGLE', 'CHATTER'].includes(k) || c.user.moves.some(m => m.id === k) || c.user.tfBak; }, function* (c) {
  const k = c.T.lastMoveKey; c.slot.id = k; c.slot.pp = D.MV[k].pp; c.slot.ppup = 0; yield* bmsg(__('{0} sketched {1}!', mname(c.us), D.MV[k].name)); }));
Fx('069', SM(false, c => c.user.tfBak || c.tgt.tfBak || c.user.btTypes === undefined && false, function* (c) {
  saveStats(c.user); c.user.tfBak = { moves: c.user.moves }; c.user.stats = [c.user.stats[0], ...c.tgt.stats.slice(1)];
  c.user.moves = c.tgt.moves.map(m => Object.assign({}, m, { pp: Math.min(5, D.MV[m.id].pp || 5), ppup: 0 })); c.user.btTypes = pokeTypes(c.tgt).slice(); c.S.st = c.T.st.slice(); c.S.lock = null; c.S.ability = abilOf(c.ts);
  yield* bmsg(__('{0} transformed into {1}!', mname(c.us), mnameL(c.ts))); }));

// ---- switching: U-turn, Baton Pass, Parting Shot, Teleport, Roar, Dragon Tail
function* switchOut(s, baton) {
  const B = B_(), cur = sideMon(s), others = livingOthers(s); if (!others.length) return false;
  let next;
  if (s === 0) { B.msg = null; const r = yield* partyScreen({ mode: 'battle', text: 'Choose a Pokémon.', noCancel: true, activeIdx: B.meParty.indexOf(cur) }); next = B.meParty[r]; if (!next || next === cur || next.hp <= 0) next = others[0]; }
  else next = others[rnd(others.length)];
  if (baton) { const o = B.S[s]; B.pass = { s, d: { st: o.st.slice(), direHit: o.direHit, sub: o.sub, confuse: o.confuse, seeded: o.seeded, ingrain: o.ingrain, aquaRing: o.aquaRing, cursed: o.cursed, perish: o.perish, lockOn: o.lockOn, magnetRise: o.magnetRise, telekinesis: o.telekinesis, mist: o.mist, noRetreat: o.noRetreat, octo: undefined } }; }
  if (s === 0) { yield* bmsg(__('{0}, that\'s enough! Come back!', pokeName(cur)), { hold: 8 }); yield* recall(0); B.me = next; yield* bmsg(__('Go! {0}!', pokeName(next)), { hold: 6 }); yield* sendOut(0); }
  else { yield* bmsg(__('{0} withdrew {1}!', B.trainer.name, pokeName(cur)), { hold: 8 }); yield* recall(1); B.foe = next; dexMarkSeen(next.sym); yield* bmsg(__('{0} sent out {1}!', B.trainer.name, pokeName(next)), { hold: 6 }); yield* sendOut(1); }
  return true;
}
function* dragOut(c) {   // Roar / Whirlwind / Dragon Tail: force the target to switch
  const B = B_(), ts = c.ts, others = livingOthers(ts);
  if (c.T.ingrain || !others.length || abilOf(ts) === 'SUCTIONCUPS') { if (abilOf(ts) === 'SUCTIONCUPS') yield* bmsg(__('{0} anchors itself with Suction Cups!', mname(ts))); return false; }
  const next = others[rnd(others.length)], old = sideMon(ts);
  yield* recall(ts);
  if (ts === 0) B.me = next; else { B.foe = next; dexMarkSeen(next.sym); }
  yield* bmsg(__('{0} was dragged out!', pokeName(next)), { hold: 8 }); yield* sendOut(ts);
  return true;
}
Fx('0EE', { after: function* (c) { if (c.user.hp > 0 && livingOthers(c.us).length) yield* switchOut(c.us); } });
Fx('0ED', SM(true, c => !livingOthers(c.us).length, function* (c) { yield* switchOut(c.us, true); }));
Fx('151', SM(false, c => false, function* (c) { yield* changeStage(c.ts, 1, -1, true); yield* changeStage(c.ts, 4, -1, true); if (c.user.hp > 0 && livingOthers(c.us).length) yield* switchOut(c.us); }));
Fx('0EA', SM(true, c => B_().kind !== 'wild', function* (c) {
  const B = B_();
  yield* bmsg(__('{0} fled!', mname(c.us))); B.result = 'ran'; }));
const roarFx = { fail: c => c.T.ingrain || (B_().kind === 'wild' ? false : !livingOthers(c.ts).length) };
Fx('0EB', SM(false, c => c.T.ingrain || (B_().kind !== 'wild' || c.us === 1) && !livingOthers(c.ts).length, function* (c) {
  const B = B_();
  if (B.kind === 'wild' && c.us === 0) { yield* bmsg(__('{0} was blown away!', mname(c.ts))); B.result = 'ran'; return; }
  yield* dragOut(c); }));
Fx('0EC', { after: function* (c) { if (c.tgt.hp > 0 && !c.subHit) { const B = B_(); if (B.kind === 'wild' && c.us === 0) { yield* bmsg(__('{0} was blown away!', mname(c.ts))); B.result = 'ran'; } else yield* dragOut(c); } } });
function* pursuitCheck() {   // the foe hits a Pokémon that is switching out with Pursuit
  const B = B_(), foe = B.foe, i = foe.moves.findIndex(m => m.id === 'PURSUIT' && m.pp > 0);
  if (i < 0 || foe.hp <= 0 || ['SLP', 'FRZ'].includes(foe.status) || rnd(100) >= 70 || forcedMove(1) != null) return false;
  B.pursued = true; B.S[0].switching = true; yield* useMove(1, i); B.S[0].switching = false;
  if (B.me.hp <= 0) { yield* handleFaint(0); return true; }
  return !!B.result;
}
