'use strict';
// ===================================================================
//  Species data. pokemon_editor.html saves BOTH pokemon.json (master) and
//  data/pokemon.js (a copy as a script, so the game also runs when index.html
//  is opened straight from disk). data/pokemon.js is used when present; if it
//  is missing the game falls back to reading pokemon.json (needs http).
// ===================================================================
(function () {
  const D = window.DATA; const ORDER = ['HP', 'Attack', 'Defense', 'Speed', 'SpAtk', 'SpDef'];
  function toSpecies(j, old) {
    const o = Object.assign({}, old || {});
    if (j.dexNumber != null) o.id = j.dexNumber;
    if (j.name != null) o.name = j.name;
    if (j.types) o.types = j.types.slice();
    if (j.baseStats) o.base = ORDER.map(k => j.baseStats[k] != null ? j.baseStats[k] : 1);
    if (j.gender != null) o.gender = j.gender;
    if (j.growthRate != null) o.growth = j.growthRate;
    if (j.baseExp != null) o.baseexp = j.baseExp;
    if (j.catchRate != null) o.catch = j.catchRate;
    if (j.baseHappiness != null) o.happy = j.baseHappiness;
    if (j.evYield) o.ev = ORDER.map(k => j.evYield[k] || 0);
    if (j.abilities) o.abilities = j.abilities.slice();
    if (j.hiddenAbility !== undefined) o.hidden = j.hiddenAbility;
    if (j.levelUpMoves) o.moves = j.levelUpMoves.map(m => [m.level, m.move]);
    for (const k of ['kind', 'dex', 'height', 'weight', 'playerY', 'enemyY', 'evo', 'sprite', 'megaOf']) if (j[k] !== undefined) o[k] = j[k];
    return o;
  }
  function apply(src, tag) {
    let n = 0;
    for (const k of Object.keys(src)) { const j = src[k]; if (!j || typeof j !== 'object') continue; D.SP[k] = toSpecies(j, D.SP[k]); n++; }
    console.log('[pokemon.json] ' + n + ' species loaded from ' + tag);
  }
  window.applyPokemonJson = apply;
  let ok = false;
  if (window.POKEMON_DATA && typeof window.POKEMON_DATA === 'object') { apply(window.POKEMON_DATA, 'data/pokemon.js'); ok = true; }
  else {
    try {
      const x = new XMLHttpRequest(); x.open('GET', 'pokemon.json?' + Date.now(), false); x.send();
      if (x.status === 200) { apply(JSON.parse(x.responseText), 'pokemon.json'); ok = true; }
      else console.error('[pokemon] data/pokemon.js missing and pokemon.json could not be loaded (HTTP ' + x.status + ')');
    } catch (e) { console.error('[pokemon] data/pokemon.js is missing - save once in pokemon_editor.html to generate it. (' + e.message + ')'); }
  }
  window.POKEMON_JSON_LOADED = ok;
})();
