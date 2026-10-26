// Berry plants - port of Essentials' PField_BerryPlants (Gen 3 mechanics, NEWBERRYPLANTS=false).
// Data per plant: [stage(0-5), berry, wateredThisStage, timeOfLastStage(sec), totalWaterings, replants]
window.BERRYDATA = {"CHERIBERRY":[6,15,4,12],"CHESTOBERRY":[6,15,4,12],"PECHABERRY":[6,15,4,12],"RAWSTBERRY":[6,15,4,12],"ASPEARBERRY":[6,15,4,12],"LEPPABERRY":[6,15,4,12],"ORANBERRY":[6,15,4,12],"PERSIMBERRY":[6,15,4,12],"LUMBERRY":[12,8,4,10],"SITRUSBERRY":[12,7,5,15],"FIGYBERRY":[6,10,3,9],"WIKIBERRY":[6,10,3,9],"MAGOBERRY":[6,10,3,9],"AGUAVBERRY":[6,10,3,9],"IAPAPABERRY":[6,10,3,9],"RAZZBERRY":[6,35,4,12],"BLUKBERRY":[6,35,4,12],"NANABBERRY":[6,35,4,12],"WEPEARBERRY":[6,35,4,12],"PINAPBERRY":[6,35,4,12],"POMEGBERRY":[12,8,5,14],"KELPSYBERRY":[12,8,5,14],"QUALOTBERRY":[12,8,5,14],"HONDEWBERRY":[12,8,5,14],"GREPABERRY":[12,8,5,14],"TAMATOBERRY":[12,8,5,14],"CORNNBERRY":[6,10,3,9],"MAGOSTBERRY":[6,10,3,9],"RABUTABERRY":[6,10,3,9],"NOMELBERRY":[6,10,3,9],"SPELONBERRY":[6,8,3,9],"PAMTREBERRY":[6,8,3,9],"WATMELBERRY":[6,8,3,9],"DURINBERRY":[6,8,3,9],"BELUEBERRY":[6,8,3,9],"OCCABERRY":[12,6,2,6],"PASSHOBERRY":[12,6,2,6],"WACANBERRY":[12,6,2,6],"RINDOBERRY":[12,6,2,6],"YACHEBERRY":[12,6,2,6],"CHOPLEBERRY":[12,6,2,6],"KEBIABERRY":[12,6,2,6],"SHUCABERRY":[12,6,2,6],"COBABERRY":[12,6,2,6],"PAYAPABERRY":[12,6,2,6],"TANGABERRY":[12,6,2,6],"CHARTIBERRY":[12,6,2,6],"KASIBBERRY":[12,6,2,6],"HABANBERRY":[12,6,2,6],"COLBURBERRY":[12,6,2,6],"BABIRIBERRY":[12,6,2,6],"CHILANBERRY":[12,6,2,6],"LIECHIBERRY":[18,4,2,8],"GANLONBERRY":[18,4,2,8],"SALACBERRY":[18,4,2,8],"PETAYABERRY":[18,4,2,8],"APICOTBERRY":[18,4,2,8],"LANSATBERRY":[18,4,2,4],"STARFBERRY":[18,4,2,4],"ENIGMABERRY":[18,7,2,8],"MICLEBERRY":[18,7,2,8],"CUSTAPBERRY":[18,7,2,8],"JABOCABERRY":[18,7,2,8],"ROWAPBERRY":[18,7,2,8],"ROSELIBERRY":[12,6,2,6],"KEEBERRY":[18,4,2,8],"MARANGABERRY":[18,4,2,8]};   // [hours per stage, drying/hour, min yield, max yield]
const BERRY_REPLANTS = 9;
const BERRY_WATERERS = ['SPRAYDUCK', 'SQUIRTBOTTLE', 'WAILMERPAIL', 'SPRINKLOTAD'];
function berryVals(k) { return BERRYDATA[k] || [3, 15, 2, 5]; }
function berryKey(mapId, evId) { return mapId + ':' + evId; }
function berryGet(ev) { G.berries = G.berries || {}; return G.berries[berryKey(G.mapId, ev.id)] || null; }
function berrySet(ev, d) { G.berries = G.berries || {}; G.berries[berryKey(G.mapId, ev.id)] = d; }
function berryUpdate(d) {
  if (!d || d[0] === 0) return d;
  const tps = berryVals(d[1])[0] * 3600, now = Math.floor(Date.now() / 1000);
  for (let guard = 0; guard < 60; guard++) {
    if (d[0] > 0 && d[0] < 5) {
      const td = now - d[3]; let levels = 0;
      for (let i = 1; i <= 4; i++) if (td >= tps * i) levels = i;
      levels = Math.min(levels, 5 - d[0]);
      if (levels === 0) break;
      d[2] = false; d[3] += levels * tps; d[0] = Math.min(5, d[0] + levels);
    }
    if (d[0] >= 5) {
      if (now - d[3] >= tps * 4) {                           // ripe for 4 stages' time, then it replants itself
        d[0] = 2; d[2] = false; d[3] += tps * 4; d[4] = 0; d[5]++;
        if (d[5] > BERRY_REPLANTS) { d = [0, 0, false, 0, 0, 0]; break; }
      } else break;
    }
  }
  return d;
}
// keep every BerryPlant event's graphic in sync with its plant (called from Event.update)
function berrySync(ev) {
  const pg = ev.page;
  if (!pg || !pg.list.some(c => c[0] === 355 && c[2][0] === 'pbBerryPlant')) return;
  let d = berryGet(ev); if (!d || d[0] === 0) return;
  d = berryUpdate(d); berrySet(ev, d);
  if (d[0] === 0) return;
  let name = 'berrytreeplanted', dir = 2;
  if (d[0] > 1) {
    name = 'berrytree' + d[1];
    if (!img('characters', name)) name = 'Object ball';
    dir = { 2: 2, 3: 4, 4: 6, 5: 8 }[d[0]];
  }
  ev.gfx = name; ev.dir = dir; ev.dirFix = true; ev.opacity = 255; ev.transparent = false;
}
function* berryChoose(pred, text) {
  let r = null;
  G.uiGen = (function* () { r = yield* bagScreen({ mode: 'berrypick', pocket: 4, filter: pred }); })();
  yield; while (G.uiGen) yield;
  return r;
}
function* confirmMsg(text) { yield* showMessage(text, { noWait: true }); const i = yield* showChoices(['Yes', 'No'], 2); return i === 0; }
function* berryPlantScript(it) {
  const ev = it.ev; if (!ev) return;
  let d = berryGet(ev) || [0, 0, false, 0, 0, 0];
  d = berryUpdate(d); berrySet(ev, d); berrySync(ev);
  const nm = k => itemInfo(k).name, berry = d[1];
  switch (d[0]) {
    case 0: {
      if (!(yield* confirmMsg("It's soft, loamy soil.\nPlant a berry?"))) return;
      const k = yield* berryChoose(x => itemInfo(x).pocket === 5);
      if (!k) return;
      G.items[k]--; if (G.items[k] <= 0) delete G.items[k];
      berrySet(ev, [1, k, false, Math.floor(Date.now() / 1000), 0, 0]); berrySync(ev);
      yield* showMessage('\\PN planted a ' + nm(k) + ' in the soft loamy soil.');
      return;
    }
    case 1: yield* showMessage('A ' + nm(berry) + ' was planted here.'); break;
    case 2: yield* showMessage('The ' + nm(berry) + ' has sprouted.'); break;
    case 3: yield* showMessage('The ' + nm(berry) + ' plant is growing bigger.'); break;
    case 4: yield* showMessage('This ' + nm(berry) + ' plant is ' + ['in bloom!', 'blooming cutely!', 'blooming prettily!', 'blooming very beautifully!', 'in fabulous bloom!'][Math.min(4, d[4])]); break;
    case 5: {
      const v = berryVals(berry); let n = v[2];
      if (d[4] > 0) n = Math.floor(((v[3] - v[2]) * (d[4] - 1) + Math.floor(Math.random() * (1 + v[3] - v[2]))) / 4) + v[2];
      const inf = itemInfo(berry), iname = n > 1 ? inf.plural : inf.name;
      const msg = n > 1 ? 'There are ' + n + ' \\c[1]' + iname + '\\c[0]!\nWant to pick them?' : 'There is 1 \\c[1]' + iname + '\\c[0]!\nWant to pick it?';
      if (!(yield* confirmMsg(msg))) return;
      G.items[berry] = (G.items[berry] || 0) + n; playME('frlg_berry');
      yield* showMessage(n > 1 ? 'You picked the ' + n + ' \\c[1]' + iname + '\\c[0].' : 'You picked the \\c[1]' + iname + '\\c[0].');
      yield* showMessage('\\PN put the \\c[1]' + iname + '\\c[0]\nin the \\c[1]Berries\\c[0] Pocket.');
      yield* showMessage('The soil returned to its soft and loamy state.');
      berrySet(ev, [0, 0, false, 0, 0, 0]); ev.gfx = ev.page ? ev.page.gfx.name : ''; ev.dirFix = ev.page ? ev.page.dirfix : false;
      return;
    }
  }
  if (d[0] >= 1 && d[0] <= 4) {
    const can = BERRY_WATERERS.find(k => (G.items[k] || 0) > 0);
    if (can && (yield* confirmMsg('Want to sprinkle some water with the ' + nm(can) + '?'))) {
      if (d[2] === false) { d[4]++; d[2] = true; }
      berrySet(ev, d); berrySync(ev);
      yield* showMessage('\\PN watered the plant.');
      yield* showMessage('The plant seemed to be delighted.');
    }
  }
}
