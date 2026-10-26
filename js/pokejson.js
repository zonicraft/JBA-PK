'use strict';
// ===================================================================
//  pokemon.json is the data source for species. This merges it over the
//  built-in table (js/data.js). Sources, in order:
//    1. data/pokemon.js  (window.POKEMON, generated from pokemon.json by
//       update_pokemon_data.bat – works when opening index.html directly)
//    2. pokemon.json itself, read live when the game is served over http(s)
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
    for (const k of ['kind', 'dex', 'height', 'weight', 'playerY', 'enemyY', 'evo']) if (j[k] !== undefined) o[k] = j[k];
    return o;
  }
  function apply(src, tag) {
    let n = 0;
    for (const k of Object.keys(src)) { const j = src[k]; if (!j || typeof j !== 'object') continue; D.SP[k] = toSpecies(j, D.SP[k]); n++; }
    console.log('[pokemon.json] ' + n + ' species loaded from ' + tag);
  }
  window.applyPokemonJson = apply;
  if (window.POKEMON) apply(window.POKEMON, 'data/pokemon.js');
  if (/^https?:/.test(location.protocol)) {
    try { const x = new XMLHttpRequest(); x.open('GET', 'pokemon.json?' + Date.now(), false); x.send(); if (x.status === 200) apply(JSON.parse(x.responseText), 'pokemon.json'); } catch (e) { }
  }
})();
