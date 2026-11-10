'use strict';
// ===================================================================
//  Abilities. Hooks live in battle.js / moves.js:
//   abilOf / tAb / isMold           -> which ability is active (Gastro Acid, Skill Swap, Neutralizing Gas, Mold Breaker)
//   abilSwitchIn / abilSwitchOut    -> sendOut / recall            abilEndTurn   -> endOfTurn
//   abilBlocks / abilSurvive        -> immunities before / during damage
//   abilDmgMul / abilAcc / abilType -> damage, accuracy, move type    abilPrio / abilSpeedMul -> turn order
//   abilAfterHit                    -> contact + hit reactions          abilStatBlock / abilStatusBlock ...
// ===================================================================
const rawAb = s => { const S = B_().S[s]; return S.ability !== undefined ? S.ability : sideMon(s).ability; };
function abilOf(s) {
  const a = rawAb(s);
  if (a !== 'NEUTRALIZINGGAS' && (rawAb(0) === 'NEUTRALIZINGGAS' || rawAb(1) === 'NEUTRALIZINGGAS')) return null;
  return a;
}
function abilOfMon(m) { const B = G.battle; if (!B) return m.ability; return m === B.me ? abilOf(0) : m === B.foe ? abilOf(1) : m.ability; }
function isKlutz(m) { return !!(G.battle && m && (m === G.battle.me || m === G.battle.foe) && abilOfMon(m) === 'KLUTZ'); }
const isMold = s => ['MOLDBREAKER', 'TERAVOLT', 'TURBOBLAZE'].includes(abilOf(s));
const abName = a => (D.AB[a] && D.AB[a].name) || a;
const MB_IGNORED = new Set(['WATERABSORB', 'VOLTABSORB', 'DRYSKIN', 'LIGHTNINGROD', 'MOTORDRIVE', 'STORMDRAIN', 'SAPSIPPER', 'FLASHFIRE', 'LEVITATE', 'SOUNDPROOF', 'BULLETPROOF', 'WONDERGUARD', 'STURDY', 'DISGUISE', 'MAGICBOUNCE', 'SHELLARMOR', 'BATTLEARMOR', 'UNAWARE', 'DAMP', 'WATERVEIL', 'WATERBUBBLE', 'INNERFOCUS', 'OVERCOAT', 'INSOMNIA', 'VITALSPIRIT', 'SWEETVEIL', 'SIMPLE', 'THICKFAT', 'HEATPROOF', 'FURCOAT', 'FLUFFY', 'MULTISCALE', 'SHADOWSHIELD', 'FILTER', 'SOLIDROCK', 'PRISMARMOR', 'MARVELSCALE', 'GRASSPELT', 'CLEARBODY', 'WHITESMOKE', 'FULLMETALBODY', 'HYPERCUTTER', 'BIGPECKS', 'KEENEYE', 'SHIELDDUST', 'WONDERSKIN', 'SANDVEIL', 'SNOWCLOAK', 'TANGLEDFEET', 'STICKYHOLD', 'OBLIVIOUS', 'OWNTEMPO', 'AROMAVEIL', 'DAZZLING', 'QUEENLYMAJESTY', 'IMMUNITY', 'LIMBER', 'MAGMAARMOR', 'LEAFGUARD', 'SUCTIONCUPS', 'CONTRARY', 'FLOWERVEIL', 'COMATOSE']);
function tAb(c) { const a = abilOf(c.ts); return isMold(c.us) && MB_IGNORED.has(a) ? null : a; }   // the target's ability as this attacker sees it
function wx() { const F = field(); if (!F.weather) return null; if (['AIRLOCK', 'CLOUDNINE'].includes(abilOf(0)) || ['AIRLOCK', 'CLOUDNINE'].includes(abilOf(1))) return null; return F.weather; }
function hasSec(c) { return hasSec0(c); }

const POWDER_MOVES = ['Sleep Powder', 'Stun Spore', 'Poison Powder', 'Spore', 'Cotton Spore', 'Magic Powder', 'Powder'];
const BALL_MOVES = ['Acid Spray', 'Aura Sphere', 'Barrage', 'Bullet Seed', 'Egg Bomb', 'Electro Ball', 'Energy Ball', 'Focus Blast', 'Gyro Ball', 'Ice Ball', 'Magnet Bomb', 'Mist Ball', 'Mud Bomb', 'Octazooka', 'Rock Wrecker', 'Searing Shot', 'Seed Bomb', 'Shadow Ball', 'Sludge Bomb', 'Weather Ball', 'Zap Cannon', 'Pollen Puff', 'Beak Blast', 'Pyro Ball'];
const BITE_MOVES = ['Bite', 'Crunch', 'Fire Fang', 'Ice Fang', 'Thunder Fang', 'Poison Fang', 'Psychic Fangs', 'Hyper Fang', 'Jaw Lock', 'Fishious Rend'];
const PULSE_MOVES = ['Aura Sphere', 'Dark Pulse', 'Dragon Pulse', 'Heal Pulse', 'Origin Pulse', 'Water Pulse', 'Terrain Pulse'];
const DANCE_MOVES = ['Swords Dance', 'Dragon Dance', 'Quiver Dance', 'Feather Dance', 'Fiery Dance', 'Lunar Dance', 'Teeter Dance'];
const HEALING_FN = ['0D5', '0D6', '0D8', '0D9', '159', 'CF2', 'A20', '0DD', '0DE', '14F', '1BB'];
const UNTRACEABLE = ['MULTITYPE', 'ILLUSION', 'IMPOSTER', 'TRACE', 'STANCECHANGE', 'SCHOOLING', 'DISGUISE', 'COMATOSE', 'NEUTRALIZINGGAS', 'RKSSYSTEM', 'SHIELDSDOWN', 'ZENMODE', 'POWEROFALCHEMY', 'RECEIVER'];
const contactOf = c => hasFlag(c.md, 'a') && abilOf(c.us) !== 'LONGREACH';
const say = (s, a) => bmsg(mname(s) + '\'s ' + abName(a) + '!', { hold: 8 });

// ---------------------------------------------------------------- move type / priority / speed / accuracy
function abilType(c) {
  const ua = abilOf(c.us), md = c.md; let t = c.type; c.abBoost = false;
  if (md.type === 'QMARKS' || t === 'QMARKS') return t;
  if (ua === 'NORMALIZE') { t = 'NORMAL'; if (md.cat !== 'Status') c.abBoost = true; }
  else if (t === 'NORMAL' && { PIXILATE: 'FAIRY', REFRIGERATE: 'ICE', AERILATE: 'FLYING', GALVANIZE: 'ELECTRIC' }[ua]) { t = { PIXILATE: 'FAIRY', REFRIGERATE: 'ICE', AERILATE: 'FLYING', GALVANIZE: 'ELECTRIC' }[ua]; if (md.cat !== 'Status') c.abBoost = true; }
  else if (ua === 'LIQUIDVOICE' && hasFlag(md, 'k')) t = 'WATER';
  return t;
}
function* abilProtean(c) {
  const ua = abilOf(c.us); if (ua !== 'PROTEAN' || c.o.called || c.type === 'QMARKS') return;
  const t = pokeTypes(c.user); if (t.length === 1 && t[0] === c.type) return;
  c.user.btTypes = [c.type]; yield* bmsg(mname(c.us) + '\'s Protean made it the ' + c.type + ' type!', { hold: 8 });
}
function abilPrio(s, md) {
  const a = abilOf(s); if (!a) return 0;
  if (a === 'PRANKSTER' && md.cat === 'Status') return 1;
  if (a === 'GALEWINGS' && md.type === 'FLYING' && sideMon(s).hp >= sideMon(s).maxhp) return 1;
  if (a === 'TRIAGE' && HEALING_FN.includes(md.fn)) return 3;
  return 0;
}
function abilSpeedMul(s) {
  const a = abilOf(s), m = sideMon(s), S = B_().S[s], w = wx(); let v = 1;
  if ((a === 'CHLOROPHYLL' && w === 'SUN') || (a === 'SWIFTSWIM' && w === 'RAIN') || (a === 'SANDRUSH' && w === 'SAND') || (a === 'SLUSHRUSH' && w === 'HAIL')) v *= 2;
  if (a === 'QUICKFEET' && m.status) v *= 1.5;
  if (a === 'UNBURDEN' && S.hadItem && !m.item) v *= 2;
  if (a === 'SLOWSTART' && S.age < 5) v *= 0.5;
  return v;
}
function abilAcc(c) {
  const ua = abilOf(c.us), ta = tAb(c), md = c.md; let f = 1;
  if (ua === 'COMPOUNDEYES') f *= 1.3;
  if (ua === 'HUSTLE' && md.cat === 'Physical') f *= 0.8;
  if (ua === 'VICTORYSTAR') f *= 1.1;
  if (ta === 'SANDVEIL' && wx() === 'SAND') f *= 0.8;
  if (ta === 'SNOWCLOAK' && wx() === 'HAIL') f *= 0.8;
  if (ta === 'TANGLEDFEET' && c.T.confuse > 0) f *= 0.5;
  if (ta === 'WONDERSKIN' && md.cat === 'Status' && md.acc < 100) f *= 50 / md.acc;
  return f;
}
function abilTrap(s) {   // is side s held in place by the foe's Arena Trap / Shadow Tag / Magnet Pull?
  const fa = abilOf(1 - s), m = sideMon(s); if (!fa || sideMon(1 - s).hp <= 0) return false;
  return (fa === 'ARENATRAP' && isGrounded(s)) || (fa === 'SHADOWTAG' && abilOf(s) !== 'SHADOWTAG') || (fa === 'MAGNETPULL' && pokeTypes(m).includes('STEEL'));
}
function abilWeatherImmune(s, w) {
  const a = abilOf(s); if (!wx()) return true;
  return ['MAGICGUARD', 'OVERCOAT'].includes(a) || (w === 'SAND' && ['SANDVEIL', 'SANDFORCE', 'SANDRUSH'].includes(a)) || (w === 'HAIL' && ['SNOWCLOAK', 'ICEBODY', 'SLUSHRUSH'].includes(a));
}

// ---------------------------------------------------------------- damage
function abilDmgMul(c, crit, eff, phys) {
  const { us, user, tgt, md, fx } = c, B = B_(), ua = abilOf(us), ta = tAb(c), t = c.type, hpf = user.hp / user.maxhp, contact = contactOf(c); let m = 1;
  const low = ty => { if (t === ty && hpf <= 1 / 3) m *= 1.5; };
  switch (ua) {
    case 'RIVALRY': if (user.gender !== 2 && tgt.gender !== 2) m *= user.gender === tgt.gender ? 1.25 : 0.75; break;
    case 'SHEERFORCE': if (c.sheer) m *= 1.3; break;
    case 'TORRENT': low('WATER'); break; case 'BLAZE': low('FIRE'); break; case 'OVERGROW': low('GRASS'); break; case 'SWARM': low('BUG'); break;
    case 'GUTS': if (user.status && phys) m *= 1.5; break;
    case 'HUSTLE': if (phys) m *= 1.5; break;
    case 'HUGEPOWER': case 'PUREPOWER': if (phys) m *= 2; break;
    case 'TECHNICIAN': if (c.pow <= 60) m *= 1.5; break;
    case 'IRONFIST': if (hasFlag(md, 'j')) m *= 1.2; break;
    case 'TOUGHCLAWS': if (contact) m *= 1.3; break;
    case 'STRONGJAW': if (BITE_MOVES.includes(md.name)) m *= 1.5; break;
    case 'MEGALAUNCHER': if (PULSE_MOVES.includes(md.name)) m *= 1.5; break;
    case 'RECKLESS': if ((fx.recoil || fx.recoilMax || md.fn === '10B') && md.name !== 'Struggle') m *= 1.2; break;
    case 'SANDFORCE': if (wx() === 'SAND' && ['ROCK', 'GROUND', 'STEEL'].includes(t)) m *= 1.3; break;
    case 'SOLARPOWER': if (wx() === 'SUN' && !phys) m *= 1.5; break;
    case 'FLAREBOOST': if (user.status === 'BRN' && !phys) m *= 1.5; break;
    case 'TOXICBOOST': if (user.status === 'PSN' && phys) m *= 1.5; break;
    case 'DEFEATIST': if (hpf <= 0.5) m *= 0.5; break;
    case 'SLOWSTART': if (phys && B.S[us].age < 5) m *= 0.5; break;
    case 'ANALYTIC': if (c.T.moved) m *= 1.3; break;
    case 'TINTEDLENS': if (eff < 1) m *= 2; break;
    case 'SNIPER': if (crit) m *= 1.5; break;
    case 'STEELWORKER': if (t === 'STEEL') m *= 1.5; break;
    case 'FLOWERGIFT': if (wx() === 'SUN' && phys) m *= 1.5; break;
    case 'STAKEOUT': if (B.S[c.ts].age === 0) m *= 2; break;
    case 'WATERBUBBLE': if (t === 'WATER') m *= 2; break;
  }
  if (c.abBoost) m *= 1.2;
  const aura = [0, 1].map(s => abilOf(s)), brk = aura.includes('AURABREAK');
  if (aura.includes('DARKAURA') && t === 'DARK') m *= brk ? 0.75 : 4 / 3;
  if (aura.includes('FAIRYAURA') && t === 'FAIRY') m *= brk ? 0.75 : 4 / 3;
  switch (ta) {
    case 'THICKFAT': if (t === 'FIRE' || t === 'ICE') m *= 0.5; break;
    case 'HEATPROOF': case 'WATERBUBBLE': if (t === 'FIRE') m *= 0.5; break;
    case 'DRYSKIN': if (t === 'FIRE') m *= 1.25; break;
    case 'FURCOAT': if (phys) m *= 0.5; break;
    case 'FLUFFY': if (contact) m *= 0.5; if (t === 'FIRE') m *= 2; break;
    case 'MULTISCALE': case 'SHADOWSHIELD': if (tgt.hp >= tgt.maxhp) m *= 0.5; break;
    case 'FILTER': case 'SOLIDROCK': case 'PRISMARMOR': if (eff > 1) m *= 0.75; break;
    case 'MARVELSCALE': if (tgt.status && phys) m *= 2 / 3; break;
    case 'GRASSPELT': if (field().terrain === 'GRASSY' && phys) m *= 2 / 3; break;
    case 'FLOWERGIFT': if (wx() === 'SUN' && !phys) m *= 2 / 3; break;
  }
  return m;
}

// ---------------------------------------------------------------- immunities / blocks before a move lands
function* abilBlocks(c) {
  const { us, ts, md, fx, user, tgt, T, S } = c, ta = tAb(c), ua = abilOf(us), isSt = md.cat === 'Status';
  const imm = function* (msg) { yield* bmsg(msg || 'It doesn\'t affect ' + mnameL(ts) + '...'); return true; };
  if ((ta === 'DAZZLING' || ta === 'QUEENLYMAJESTY') && (md.prio || 0) + abilPrio(us, md) > 0) { yield* bmsg(mname(ts) + '\'s ' + abName(ta) + ' blocked ' + md.name + '!'); return true; }
  if (ua === 'PRANKSTER' && isSt && pokeTypes(tgt).includes('DARK')) return yield* imm();
  if (isSt && ['016', '0BA', '0BC', '0B7', '0B9', '0BB'].includes(md.fn) && (ta === 'AROMAVEIL' || (ta === 'OBLIVIOUS' && ['016', '0BA'].includes(md.fn)))) { yield* bmsg(mname(ts) + '\'s ' + abName(ta) + ' prevents it!'); return true; }
  if (isSt && ta === 'MAGICBOUNCE' && !c.o.coated && !fx.noCoat) { yield* bmsg(mname(ts) + '\'s Magic Bounce bounced ' + md.name + ' back!'); yield* doMove(ts, md, { slot: null, mi: -1, called: true, coated: true }); return true; }
  const t = c.type; if (t === 'QMARKS') return false;
  const heal = (msg) => function* () { if (tgt.hp < tgt.maxhp) yield* healItem(ts, Math.floor(tgt.maxhp / 4), mname(ts) + ' restored its HP!'); };
  const ABS = { WATERABSORB: ['WATER', 'heal'], DRYSKIN: ['WATER', 'heal'], VOLTABSORB: ['ELECTRIC', 'heal'], LIGHTNINGROD: ['ELECTRIC', [4, 1]], MOTORDRIVE: ['ELECTRIC', [3, 1]], STORMDRAIN: ['WATER', [4, 1]], SAPSIPPER: ['GRASS', [1, 1]], FLASHFIRE: ['FIRE', 'flash'] };
  const ab = ABS[ta];
  if (ab && ab[0] === t) {
    yield* bmsg(mname(ts) + '\'s ' + abName(ta) + ' made ' + md.name + ' useless!');
    if (ab[1] === 'heal') { if (tgt.hp < tgt.maxhp) yield* healItem(ts, Math.floor(tgt.maxhp / 4), mname(ts) + ' restored its HP!'); }
    else if (ab[1] === 'flash') { T.flashFire = true; yield* bmsg(mname(ts) + '\'s Fire-type moves are powered up!'); }
    else yield* changeStage(ts, ab[1][0], ab[1][1]);
    return true;
  }
  if (ta === 'SOUNDPROOF' && hasFlag(md, 'k')) { yield* bmsg(mname(ts) + '\'s Soundproof blocks ' + md.name + '!'); return true; }
  if (ta === 'BULLETPROOF' && BALL_MOVES.includes(md.name)) { yield* bmsg(mname(ts) + '\'s Bulletproof blocks ' + md.name + '!'); return true; }
  if (ta === 'OVERCOAT' && POWDER_MOVES.includes(md.name)) return yield* imm();
  if (!isSt && ta === 'WONDERGUARD' && effOf(c) <= 1 && !fx.fixed) { yield* bmsg(mname(ts) + '\'s Wonder Guard protects it!'); return true; }
  if (fx.acc === 'ohko' && ta === 'STURDY') { yield* bmsg(mname(ts) + ' was protected by Sturdy!'); return true; }
  return false;
}
function* abilSurvive(c, r) {   // Disguise / Sturdy while damage is being dealt
  const { ts, tgt } = c, ta = tAb(c);
  if (ta === 'DISGUISE' && !tgt.dgBroken) { tgt.dgBroken = true; r.dmg = Math.max(1, Math.floor(tgt.maxhp / 8)); yield* bmsg(mname(ts) + '\'s disguise served it as a decoy!'); return true; }
  if (ta === 'STURDY' && tgt.hp >= tgt.maxhp && r.dmg >= tgt.hp) { r.dmg = tgt.hp - 1; yield* bmsg(mname(ts) + ' endured the hit using Sturdy!'); return true; }
  return false;
}

// ---------------------------------------------------------------- stat changes / status
function* abilStatBlock(s, stat) {
  const ab = abilOf(s), B = B_(), mb = B.lastCtx && B.lastCtx.us !== s && isMold(B.lastCtx.us);
  if (mb || !ab) return false;
  const blocked = ['CLEARBODY', 'WHITESMOKE', 'FULLMETALBODY'].includes(ab) || (ab === 'HYPERCUTTER' && stat === 1) || (ab === 'BIGPECKS' && stat === 2) || (ab === 'KEENEYE' && stat === 6) || (ab === 'FLOWERVEIL' && pokeTypes(sideMon(s)).includes('GRASS'));
  if (blocked) { yield* bmsg(mname(s) + '\'s ' + abName(ab) + ' prevents stat loss!'); return true; }
  return false;
}
function* abilStatDropped(s) {
  const ab = abilOf(s); if (sideMon(s).hp <= 0) return;
  if (ab === 'DEFIANT') { yield* say(s, ab); yield* changeStage(s, 1, 2); }
  else if (ab === 'COMPETITIVE') { yield* say(s, ab); yield* changeStage(s, 4, 2); }
}
function abilStatusBlock(s, status) {
  const ab = abilOf(s); if (!ab) return null; const B = B_();
  if (B.lastCtx && B.lastCtx.ts === s && isMold(B.lastCtx.us) && MB_IGNORED.has(ab)) return null;
  const word = { PSN: 'poisoning', PAR: 'paralysis', SLP: 'sleep', FRZ: 'freezing', BRN: 'burns' }[status];
  const own = { PSN: ['IMMUNITY'], PAR: ['LIMBER'], SLP: ['INSOMNIA', 'VITALSPIRIT', 'SWEETVEIL'], FRZ: ['MAGMAARMOR'], BRN: ['WATERVEIL', 'WATERBUBBLE'] }[status] || [];
  if (own.includes(ab) || (ab === 'LEAFGUARD' && wx() === 'SUN') || (ab === 'FLOWERVEIL' && pokeTypes(sideMon(s)).includes('GRASS'))) return mname(s) + '\'s ' + abName(ab) + ' prevents ' + word + '!';
  if (ab === 'COMATOSE') return 'It doesn\'t affect ' + mnameL(s) + '...';
  return null;
}
function* abilStatusGot(s, status) {
  const B = B_(), o = 1 - s;
  if (abilOf(s) === 'SYNCHRONIZE' && ['BRN', 'PSN', 'PAR'].includes(status) && !B.inSync && B.lastCtx && B.lastCtx.us === o && sideMon(o).hp > 0) {
    B.inSync = true; yield* say(s, 'SYNCHRONIZE'); yield* inflict(o, status); B.inSync = false;
  }
}

// ---------------------------------------------------------------- reactions to being hit (and to hitting)
function* abilAfterHit(c) {
  const { us, ts, user, tgt, md, T, S } = c, B = B_();
  if (!c.hits || c.subHit) return;
  const ta = abilOf(ts), ua = abilOf(us), contact = contactOf(c), dmg = c.done > 0;
  if (tgt.hp <= 0) {
    if (ua === 'MOXIE' && user.hp > 0) { yield* say(us, ua); yield* changeStage(us, 1, 1); }
    if (ua === 'BEASTBOOST' && user.hp > 0) { let bi = 1; for (let i = 2; i <= 5; i++) if (user.stats[i] > user.stats[bi]) bi = i; yield* say(us, ua); yield* changeStage(us, bi, 1); }
    for (const s of [0, 1]) if (abilOf(s) === 'SOULHEART' && sideMon(s).hp > 0) { yield* say(s, 'SOULHEART'); yield* changeStage(s, 4, 1); }
    const damp = [0, 1].some(s => abilOf(s) === 'DAMP');
    if (ta === 'AFTERMATH' && contact && !damp && user.hp > 0 && abilOf(us) !== 'MAGICGUARD') { user.hp = Math.max(0, user.hp - Math.max(1, Math.floor(user.maxhp / 4))); yield* animHp(us, user.hp); yield* bmsg(mname(us) + ' was hurt by ' + mnameL(ts) + '\'s Aftermath!'); }
    if (ta === 'INNARDSOUT' && user.hp > 0 && abilOf(us) !== 'MAGICGUARD') { user.hp = Math.max(0, user.hp - c.done); yield* animHp(us, user.hp); yield* bmsg(mname(us) + ' was hurt by ' + mnameL(ts) + '\'s Innards Out!'); }
    return;
  }
  if (contact && user.hp > 0) {
    if (ta === 'STATIC' && rnd(100) < 30 && !user.status) { yield* say(ts, ta); yield* inflict(us, 'PAR'); }
    else if (ta === 'POISONPOINT' && rnd(100) < 30 && !user.status) { yield* say(ts, ta); yield* inflict(us, 'PSN'); }
    else if (ta === 'FLAMEBODY' && rnd(100) < 30 && !user.status) { yield* say(ts, ta); yield* inflict(us, 'BRN'); }
    else if (ta === 'EFFECTSPORE' && rnd(100) < 30 && !user.status && !pokeTypes(user).includes('GRASS') && ua !== 'OVERCOAT') { yield* say(ts, ta); yield* inflict(us, ['PSN', 'PAR', 'SLP'][rnd(3)]); }
    else if (ta === 'CUTECHARM' && rnd(100) < 30 && !S.attract && user.gender !== 2 && tgt.gender !== 2 && user.gender !== tgt.gender) { yield* say(ts, ta); S.attract = true; yield* bmsg(mname(us) + ' fell in love with ' + mnameL(ts) + '!'); }
    if ((ta === 'ROUGHSKIN' || ta === 'IRONBARBS') && abilOf(us) !== 'MAGICGUARD') { yield* say(ts, ta); user.hp = Math.max(0, user.hp - Math.max(1, Math.floor(user.maxhp / 8))); yield* animHp(us, user.hp); }
    if (ta === 'GOOEY') { yield* say(ts, ta); yield* changeStage(us, 3, -1, true); }
    if (ta === 'MUMMY' && ua !== 'MUMMY') { S.ability = 'MUMMY'; yield* bmsg(mname(us) + '\'s ability became Mummy!'); }
    if (ta === 'PICKPOCKET' && !tgt.item && user.item && abilOf(us) !== 'STICKYHOLD') { noteItem(user); tgt.item = user.item; user.item = null; yield* bmsg(mname(ts) + ' stole ' + mnameL(us) + '\'s ' + itemName(tgt.item) + '!'); }
    if (ua === 'POISONTOUCH' && rnd(100) < 30 && !tgt.status && !c.sheer) yield* inflict(ts, 'PSN');
  }
  if (ua === 'MAGICIAN' && !user.item && tgt.item && abilOf(ts) !== 'STICKYHOLD' && !c.o.called) { noteItem(tgt); user.item = tgt.item; tgt.item = null; yield* bmsg(mname(us) + ' stole ' + mnameL(ts) + '\'s ' + itemName(user.item) + '!'); }
  if (ua === 'STENCH' && !hasSec(c) && !c.sheer && rnd(10) === 0) T.flinch = true;
  if (ta === 'CURSEDBODY' && rnd(100) < 30 && c.slot && !S.disabled) { S.disabled = { key: c.slot.id, turns: 4 }; yield* say(ts, ta); yield* bmsg(mname(us) + '\'s ' + md.name + ' was disabled!'); }
  if (!dmg) return;
  if (ta === 'STAMINA') { yield* say(ts, ta); yield* changeStage(ts, 2, 1); }
  if (ta === 'WEAKARMOR' && md.cat === 'Physical') { yield* say(ts, ta); yield* changeStage(ts, 2, -1); yield* changeStage(ts, 3, 2); }
  if (ta === 'WATERCOMPACTION' && c.type === 'WATER') { yield* say(ts, ta); yield* changeStage(ts, 2, 2); }
  if (ta === 'ANGERPOINT' && c.crit && T.st[1] < 6) { yield* say(ts, ta); T.st[1] = 6; yield* bmsg(mname(ts) + ' maxed its Attack!'); }
  if (ta === 'JUSTIFIED' && c.type === 'DARK') { yield* say(ts, ta); yield* changeStage(ts, 1, 1); }
  if (ta === 'RATTLED' && ['BUG', 'GHOST', 'DARK'].includes(c.type)) { yield* say(ts, ta); yield* changeStage(ts, 3, 1); }
  if (ta === 'COTTONDOWN') { yield* say(ts, ta); yield* changeStage(us, 3, -1, true); }
  if (ta === 'COLORCHANGE' && c.type !== 'QMARKS' && pokeTypes(tgt).join() !== c.type) { tgt.btTypes = [c.type]; yield* bmsg(mname(ts) + '\'s Color Change made it the ' + c.type + ' type!'); }
  if (c.before > tgt.maxhp / 2 && tgt.hp <= tgt.maxhp / 2) {
    if (ta === 'BERSERK') { yield* say(ts, ta); yield* changeStage(ts, 4, 1); }
    if ((ta === 'EMERGENCYEXIT' || ta === 'WIMPOUT') && livingOthers(ts).length && B.kind !== 'wild' || (ts === 0 && (ta === 'EMERGENCYEXIT' || ta === 'WIMPOUT') && livingOthers(ts).length)) { yield* bmsg(mname(ts) + '\'s ' + abName(ta) + ' activated!'); yield* switchOut(ts); }
  }
}

// ---------------------------------------------------------------- switch in / out, end of turn
const SETTERS = { DROUGHT: 'SUN', DRIZZLE: 'RAIN', SANDSTREAM: 'SAND', SNOWWARNING: 'HAIL' };
const SURGES = { ELECTRICSURGE: 'ELECTRIC', GRASSYSURGE: 'GRASSY', MISTYSURGE: 'MISTY', PSYCHICSURGE: 'PSYCHIC' };
function* transformInto(us, ts) {
  const user = sideMon(us), tgt = sideMon(ts), S = B_().S[us], T = B_().S[ts];
  if (user.tfBak || tgt.tfBak) return false;
  saveStats(user); user.tfBak = { moves: user.moves }; user.stats = [user.stats[0], ...tgt.stats.slice(1)];
  user.moves = tgt.moves.map(m => Object.assign({}, m, { pp: Math.min(5, D.MV[m.id].pp || 5), ppup: 0 })); user.btTypes = pokeTypes(tgt).slice(); S.st = T.st.slice(); S.lock = null; S.ability = abilOf(ts);
  yield* bmsg(mname(us) + ' transformed into ' + mnameL(ts) + '!'); return true;
}
function* abilSwitchIn(s) {
  const B = B_(), m = sideMon(s), S = B.S[s], foe = 1 - s, fm = sideMon(foe), ab = abilOf(s); S.hadItem = !!m.item;
  if (!ab) return;
  const F = field();
  if (ab === 'FORECAST') { const t = { SUN: 'FIRE', RAIN: 'WATER', HAIL: 'ICE' }[wx()] || 'NORMAL'; m.btTypes = [t]; }
  if (ab === 'MULTITYPE') { const t = PLATE[m.item]; if (t) m.btTypes = [t]; }
  if (ab === 'RKSSYSTEM') { const k = /^(.*)MEMORY$/.exec(m.item || ''); if (k && ALL_TYPES.includes(k[1])) m.btTypes = [k[1]]; }
  if (SETTERS[ab]) { const w = SETTERS[ab]; if (F.weather !== w) { yield* say(s, ab); F.weather = w; F.wTurns = hItem(m) === WEATHER[w][3] ? 8 : 5; yield* bmsg(WEATHER[w][0]); } return; }
  if (SURGES[ab]) { const t = SURGES[ab]; if (F.terrain !== t) { yield* say(s, ab); F.terrain = t; F.tTurns = hItem(m) === 'TERRAINEXTENDER' ? 8 : 5; yield* bmsg(TERRAIN[t][0]); } return; }
  if (fm.hp <= 0) return;
  switch (ab) {
    case 'INTIMIDATE':
      yield* say(s, ab);
      if (B.S[foe].sub > 0) break;
      if (['INNERFOCUS', 'OBLIVIOUS', 'OWNTEMPO', 'SCRAPPY'].includes(abilOf(foe))) { yield* bmsg(mname(foe) + '\'s ' + abName(abilOf(foe)) + ' prevents it from being intimidated!'); break; }
      yield* changeStage(foe, 1, -1, true); break;
    case 'DOWNLOAD': yield* say(s, ab); yield* changeStage(s, fm.stats[2] * stageMul(B.S[foe].st[2]) < fm.stats[5] * stageMul(B.S[foe].st[5]) ? 1 : 4, 1); break;
    case 'TRACE': { const fa = abilOf(foe); if (fa && !UNTRACEABLE.includes(fa) && !S.traced) { S.traced = true; S.ability = fa; yield* bmsg(mname(s) + ' traced ' + mnameL(foe) + '\'s ' + abName(fa) + '!'); yield* abilSwitchIn(s); } break; }
    case 'IMPOSTER': yield* transformInto(s, foe); break;
    case 'FOREWARN': { const mv = fm.moves.map(x => D.MV[x.id]).sort((a, b) => (b.pow || 0) - (a.pow || 0))[0]; if (mv) yield* bmsg(mname(s) + '\'s Forewarn alerted it to ' + mnameL(foe) + '\'s ' + mv.name + '!'); break; }
    case 'FRISK': if (fm.item) yield* bmsg(mname(s) + ' frisked ' + mnameL(foe) + ' and found its ' + itemName(fm.item) + '!'); break;
    case 'ANTICIPATION': if (fm.moves.some(x => { const d = D.MV[x.id]; return d.pow > 0 && (typeMul(d.type, pokeTypes(m)) > 1 || d.fn === '070'); })) yield* bmsg(mname(s) + ' shuddered!'); break;
    case 'PRESSURE': yield* bmsg(mname(s) + ' is exerting its pressure!'); break;
    case 'UNNERVE': yield* bmsg(mname(foe) + ' is too nervous to eat Berries!'); break;
    case 'MOLDBREAKER': yield* bmsg(mname(s) + ' breaks the mold!'); break;
    case 'TERAVOLT': yield* bmsg(mname(s) + ' is radiating a bursting aura!'); break;
    case 'TURBOBLAZE': yield* bmsg(mname(s) + ' is radiating a blazing aura!'); break;
    case 'DARKAURA': yield* bmsg(mname(s) + ' is radiating a dark aura!'); break;
    case 'FAIRYAURA': yield* bmsg(mname(s) + ' is radiating a fairy aura!'); break;
    case 'AURABREAK': yield* bmsg(mname(s) + ' reversed all other Pokémon\'s auras!'); break;
    case 'AIRLOCK': case 'CLOUDNINE': yield* bmsg('The effects of the weather disappeared.'); break;
    case 'NEUTRALIZINGGAS': yield* bmsg('Neutralizing gas filled the area!'); break;
    case 'SLOWSTART': yield* bmsg(mname(s) + ' can\'t get it going!'); break;
    case 'COMATOSE': yield* bmsg(mname(s) + ' is drowsing!'); break;
  }
}
function* abilSwitchOut(s) {
  const m = sideMon(s), ab = abilOf(s); if (!m || m.hp <= 0 || !ab) return;
  if (ab === 'NATURALCURE' && m.status) m.status = null;
  if (ab === 'REGENERATOR' && m.hp < m.maxhp) { m.hp = Math.min(m.maxhp, m.hp + Math.floor(m.maxhp / 3)); if (s === 0) B_().meHp = m.hp; }
}
function* abilEndTurn(s) {
  const B = B_(), m = sideMon(s), S = B.S[s], ab = abilOf(s), w = wx(), o = sideMon(1 - s); if (!ab || m.hp <= 0) return;
  const heal = function* (frac, msg) { if (m.hp < m.maxhp && !(S.healBlock > 0)) yield* healItem(s, Math.floor(m.maxhp * frac), msg); };
  const hurt = function* (frac, msg) { if (abilOf(s) === 'MAGICGUARD') return; m.hp = Math.max(0, m.hp - Math.max(1, Math.floor(m.maxhp * frac))); sfx('hit'); sprOf(s).shk = 10; yield* animHp(s, m.hp); yield* bmsg(msg); };
  switch (ab) {
    case 'SPEEDBOOST': if (S.age > 0 || true) { yield* say(s, ab); yield* changeStage(s, 3, 1); } break;
    case 'RAINDISH': if (w === 'RAIN') yield* heal(1 / 16, mname(s) + '\'s Rain Dish restored a little HP!'); break;
    case 'ICEBODY': if (w === 'HAIL') yield* heal(1 / 16, mname(s) + '\'s Ice Body restored a little HP!'); break;
    case 'DRYSKIN': if (w === 'RAIN') yield* heal(1 / 8, mname(s) + '\'s Dry Skin restored a little HP!'); else if (w === 'SUN') yield* hurt(1 / 8, mname(s) + ' was hurt by its Dry Skin!'); break;
    case 'SOLARPOWER': if (w === 'SUN') yield* hurt(1 / 8, mname(s) + ' was hurt by its Solar Power!'); break;
    case 'HYDRATION': if (w === 'RAIN' && m.status) { m.status = null; yield* bmsg(mname(s) + '\'s Hydration cured its status problem!'); } break;
    case 'BADDREAMS': if (o.hp > 0 && o.status === 'SLP' && abilOf(1 - s) !== 'MAGICGUARD') { o.hp = Math.max(0, o.hp - Math.max(1, Math.floor(o.maxhp / 8))); yield* animHp(1 - s, o.hp); yield* bmsg(mname(1 - s) + ' is tormented by the Bad Dreams!'); } break;
    case 'MOODY': { const up = []; for (let i = 1; i <= 7; i++) if (S.st[i] < 6) up.push(i); if (up.length) { const u = up[rnd(up.length)]; yield* say(s, ab); yield* changeStage(s, u, 2); const dn = []; for (let i = 1; i <= 5; i++) if (i !== u && S.st[i] > -6) dn.push(i); if (dn.length) yield* changeStage(s, dn[rnd(dn.length)], -1); } break; }
    case 'HARVEST': if (!m.item && isBerry(S.lastItem) && (w === 'SUN' || rnd(2) === 0)) { m.item = S.lastItem; S.lastItem = null; yield* bmsg(mname(s) + ' harvested one ' + itemName(m.item) + '!'); } break;
    case 'SLOWSTART': if (S.age === 4) yield* bmsg(mname(s) + ' got its act together!'); break;
    case 'FORECAST': m.btTypes = [{ SUN: 'FIRE', RAIN: 'WATER', HAIL: 'ICE' }[w] || 'NORMAL']; break;
  }
}
function* abilDancer(us, md) {
  const t = 1 - us; if (!DANCE_MOVES.includes(md.name) || abilOf(t) !== 'DANCER' || sideMon(t).hp <= 0 || sideMon(us).hp <= 0) return;
  yield* say(t, 'DANCER'); yield* doMove(t, md, { slot: null, mi: -1, called: true });
}
function* abilAfterBattle() {   // Pickup / Honey Gather: found items after a won battle
  for (const p of G.party) {
    if (!p || p.hp <= 0 || p.item) continue;
    if (p.ability === 'PICKUP' && rnd(10) === 0) { const pool = ['POTION', 'ANTIDOTE', 'PARALYZEHEAL', 'AWAKENING', 'ORANBERRY', 'SUPERPOTION', 'REPEL', 'ETHER'].filter(k => D.IT[k]); if (pool.length) { const k = pool[rnd(pool.length)]; p.item = k; yield* bmsg(pokeName(p) + ' picked up one ' + itemName(k) + '!', { pause: true }); } }
    else if (p.ability === 'HONEYGATHER' && rnd(20) === 0 && D.IT.HONEY) { p.item = 'HONEY'; yield* bmsg(pokeName(p) + ' gathered some Honey!', { pause: true }); }
  }
}
