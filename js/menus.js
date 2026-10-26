'use strict';
// ===================================================================
//  Pause menu, Party screen, Summary screen (Pokémon Essentials style)
// ===================================================================
G.money = G.money ?? 3000; G.trainerId = G.trainerId || (10000 + rnd(55000)); G.playFrames = G.playFrames || 0;
const LIGHT_SH = '#686868';

// ------------------------------------------------------------ Party
const PANEL_X = [0, 256, 0, 256, 0, 256], PANEL_Y = [2, 18, 98, 114, 194, 210];
function drawPanel(p, i, sel, o) {
  const x = PANEL_X[i], y = PANEL_Y[i];
  if (!p) { pic('party/panel_blank', x, y); return; }
  const faint = p.hp <= 0, swap = o.swap === i, shape = i === 0 ? 'round' : 'rect';
  let name = 'party/panel_' + shape + (swap ? '_swap' : faint ? '_faint' : '') + (sel ? '_sel' : '');
  if (swap && sel) name = 'party/panel_' + shape + '_swap_sel';
  if (!UI(name)) name = 'party/panel_' + shape + (sel ? '_sel' : '');
  pic(name, x, y);
  // ball icon (animated when selected)
  const bi = UI(sel ? 'party/icon_ball_sel' : 'party/icon_ball');
  if (bi) ctx.drawImage(bi, 0, 0, 44, 28, x + 4, y - 4 + 0, 44, 28);
  drawIcon(p, x + 6, y + 4 + (sel && Math.floor(G.frame / 8) % 2 ? -2 : 0), !faint, 1);
  txt(pokeName(p), x + 96, y + 18, { col: COL.light, shadow: '#383838', size: 24 });
  if (p.gender !== 2) txt(genderSym(p.gender), x + 224, y + 18, { col: genderCol(p.gender), size: 24 });
  if (!faint) {
    pic('party/overlay_lv', x + 25, y + 66); txt(p.lvl, x + 47, y + 65, { col: COL.light, shadow: '#383838', size: 22 });
  }
  // HP
  pic(faint ? 'party/overlay_hp_back_faint' : swap ? 'party/overlay_hp_back_swap' : 'party/overlay_hp_back', x + 96, y + 50);
  if (p.hp > 0) drawHpFill('party/overlay_hp', 8, x + 128, y + 53, 96, p.hp, p.maxhp, 8);
  txt(p.hp + '/ ' + p.maxhp, x + 224, y + 66, { col: COL.light, shadow: '#383838', size: 22, align: 'right' });
  if (p.item) pic('party/icon_item', x + 62, y + 58);
  if (faint) ctx.drawImage(UI('statuses'), 0, 5 * 16, 44, 16, x + 20, y + 68, 44, 16);
  else if (p.status) drawStatus(p.status, x + 20, y + 68);
}
function drawPartyScreen(S) {
  pic('party/bg', 0, 0);
  for (let i = 0; i < 6; i++) drawPanel(S.party[i], i, S.idx === i, S);
  const cx = SW - 112 - 0, cy = SH - 48 - 0;
  const sel = S.idx === 6;
  const c = UI(sel ? 'party/icon_cancel_sel' : 'party/icon_cancel'); if (c) ctx.drawImage(c, cx, cy);
  txt('EXIT', cx + 56, cy + 12, { col: COL.light, shadow: '#383838', size: 26, align: 'center' });
  // message window
  txt(S.text || '', 42, SH - 64 + 2, { base: '#404040', shadow: '#b8b8b8', size: 26 });
}
function partyNav(S, k) {
  // indexes: 0..5 panels, 6 = cancel. columns: even = left, odd = right
  const n = S.party.length; let i = S.idx;
  if (k === 'down') { if (i === 6) return; if (i + 2 < n) i += 2; else i = 6; }
  else if (k === 'up') { if (i === 6) i = n - 1; else if (i >= 2) i -= 2; }
  else if (k === 'left') { if (i === 6) return; if (i % 2 === 1) i--; }
  else if (k === 'right') { if (i === 6) return; if (i % 2 === 0 && i + 1 < n) i++; }
  if (i !== S.idx) { S.idx = i; sfx('cursor'); }
}
// mode: 'menu' | 'choose' | 'battle' | 'item'
function* partyScreen(o = {}) {
  const S = { party: G.party, idx: o.start || 0, text: o.text || 'Choose a Pokémon.', swap: -1, mode: o.mode || 'menu' };
  const draw = () => { drawPartyScreen(S); drawPopup(); drawUiMsg(); };
  return yield* withDraw(draw, (function* () {
    while (true) {
      yield;
      for (const k of ['up', 'down', 'left', 'right']) if (rep(k)) partyNav(S, k);
      if (back()) {
        if (S.swap >= 0) { S.swap = -1; S.text = 'Choose a Pokémon.'; sfx('back'); continue; }
        if (o.noCancel) { sfx('buzzer'); continue; }
        sfx('back'); return -1;
      }
      if (!ok()) continue;
      if (S.idx === 6) { if (o.noCancel) { sfx('buzzer'); continue; } sfx('back'); return -1; }
      const p = S.party[S.idx];
      if (S.swap >= 0) {                      // finishing a switch
        if (S.swap !== S.idx) { const a = S.party[S.swap]; S.party[S.swap] = S.party[S.idx]; S.party[S.idx] = a; sfx('ok'); }
        S.swap = -1; S.text = 'Choose a Pokémon.'; continue;
      }
      sfx('ok');
      if (S.mode === 'choose') { if (o.valid && !o.valid(p)) { sfx('buzzer'); continue; } return S.idx; }
      if (S.mode === 'item') { const r = yield* o.use(p, S.idx, S); if (r) return S.idx; S.text = 'Choose a Pokémon.'; continue; }
      if (S.mode === 'battle') {
        const c = yield* choiceWindow(['SWITCH IN', 'SUMMARY', 'CANCEL'], { y: SH - 96 - 3 * 32 - 32 });
        if (c === 0) {
          if (p.hp <= 0) { yield* uiMessage('There\'s no energy left to battle with!'); continue; }
          if (o.activeIdx === S.idx) { yield* uiMessage(pokeName(p) + ' is already in battle!'); continue; }
          return S.idx;
        }
        if (c === 1) { const r = yield* summaryScreen(S.party, S.idx); S.idx = r; }
        continue;
      }
      // field menu
      const c = yield* choiceWindow(['SUMMARY', 'SWITCH', 'ITEM', 'CANCEL'], { y: SH - 96 - 4 * 32 - 32 });
      if (c === 0) { S.idx = yield* summaryScreen(S.party, S.idx); }
      else if (c === 1) { if (S.party.length > 1) { S.swap = S.idx; S.text = 'Move to where?'; } }
      else if (c === 2) {
        const ic = yield* choiceWindow(['USE', 'GIVE', 'TAKE', 'CANCEL'], { y: SH - 96 - 4 * 32 - 32 });
        if (ic === 1) {
          const key = yield* bagScreen({ mode: 'give' });
          if (key) {
            const old = p.item; p.item = key; G.items[key]--; if (!G.items[key]) delete G.items[key];
            if (old) G.items[old] = (G.items[old] || 0) + 1;
            yield* uiMessage(pokeName(p) + ' is now holding the ' + itemName(key) + '.');
          }
        } else if (ic === 2) {
          if (!p.item) yield* uiMessage(pokeName(p) + ' isn\'t holding anything.');
          else { G.items[p.item] = (G.items[p.item] || 0) + 1; yield* uiMessage('Received the ' + itemName(p.item) + ' from ' + pokeName(p) + '.'); p.item = null; }
        } else if (ic === 0) {
          const key = yield* bagScreen({ mode: 'party' });
          if (key) { yield* useItemOn(key, p, S); }
        }
      }
    }
  })());
}

// ------------------------------------------------------------ Summary
function drawSummary(S) {
  const p = S.party[S.idx], sp = D.SP[p.sym];
  if (S.page === 4 && S.detail) { drawMoveDetail(p, S); return; }
  pic('summary/bg_' + S.page, 0, 0);
  const B = COL.light[0], SHD = LIGHT_SH;
  const L = (s, x, y, o = {}) => txt(s, x, y + 4, Object.assign({ base: '#f8f8f8', shadow: SHD, size: 24 }, o));
  const Dk = (s, x, y, o = {}) => txt(s, x, y + 4, Object.assign({ base: '#404040', shadow: '#b0b0b0', size: 24 }, o));
  // header
  L(['POKéMON INFO', 'TRAINER MEMO', 'SKILLS', 'KNOWN MOVES'][S.page - 1], 26, 14);
  // left column
  Dk(pokeName(p), 46, 68, { base: '#f8f8f8', shadow: SHD });
  if (p.gender !== 2) txt(genderSym(p.gender), 178, 68, { col: genderCol(p.gender) });
  Dk(p.lvl, 46, 95, { base: '#404040', shadow: '#b0b0b0' });
  const ball = UI('summary/icon_ball_' + String(p.ball).padStart(2, '0')); if (ball) ctx.drawImage(ball, 14, 60);
  // sprite
  const im = img('battlers', String(sp.id).padStart(3, '0')); if (im) drawFitted(im, 6, 130, 196, 154, String(sp.id));
  if (p.item) { drawItemIcon(p.item, 8, 290 - 4); Dk(itemName(p.item), 66, 324, { size: 22 }); } else Dk('None', 66, 324, { size: 22 });
  if (p.status) drawStatus(p.status, 4, 116);
  if (p.hp <= 0) ctx.drawImage(UI('statuses'), 0, 5 * 16, 44, 16, 4, 116, 44, 16);
  const rows = (labels, x, y0, step = 32) => labels.forEach((l, i) => L(l, x, y0 + i * step));
  if (S.page === 1) {
    rows(['Dex No.', 'Species', 'Type', 'OT', 'ID No.'], 238, 86);
    Dk(String(sp.id).padStart(3, '0'), 435, 86, { align: 'center' }); Dk(sp.name.toUpperCase(), 435, 118, { align: 'center' });
    sp.types.forEach((t, i) => drawTypeIcon(t, 402 + i * 66 - (sp.types.length === 1 ? 0 : 36), 146));
    txt(p.ot, 435, 182, { align: 'center', col: ['#3858f8', '#b0b8f8'] }); Dk(String(p.ot === G.name ? G.trainerId : p.otid).padStart(5, '0'), 435, 214, { align: 'center' });
    L('Exp. Points', 238, 246); Dk(String(p.exp), 488, 278, { align: 'right' });
    L('To Next Lv.', 238, 310); Dk(String(expToNext(p)), 488, 342, { align: 'right' });
    const g = D.SP[p.sym].growth, a = expFor(g, p.lvl), b = expFor(g, p.lvl + 1);
    const w = p.lvl >= MAXLEVEL ? 128 : Math.floor(128 * (p.exp - a) / Math.max(1, b - a));
    if (UI('summary/overlay_exp')) ctx.drawImage(UI('summary/overlay_exp'), 0, 0, w, 6, 362, 372, w, 6);
  } else if (S.page === 2) {
    const nat = NATURES[p.nature][0];
    const lines = [];
    lines.push(`<c1>${nat}</c1> nature.`);
    lines.push(`Met at Lv. ${p.metLvl}.`); lines.push(`${p.met}.`);
    const text = [`${nat.toUpperCase()}`, 'nature.', `Met at Lv. ${p.metLvl}.`, p.met + '.'];
    Dk(nat + ' nature.', 238, 112 + 6, { size: 24 }); Dk('Met at Lv. ' + p.metLvl + ' at', 238, 144 + 6, { size: 24 }); Dk(p.met + '.', 238, 176 + 6, { size: 24 });
    const hp = p.happy; wrap(hp > 200 ? 'It adores its Trainer!' : hp > 100 ? 'It seems to like you.' : 'It is still getting used to you.', 222, 22).forEach((l, i) => Dk(l, 238, 240 + 6 + i * 32, { size: 22 }));
  } else if (S.page === 3) {
    // HP + stats
    const names = ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed'], idxs = [0, 1, 2, 4, 5, 3];
    const nat = NATURES[p.nature];
    L('HP', 248, 75, { size: 22 }); Dk(p.hp + '/' + p.maxhp, 462, 75, { align: 'right', size: 22 });
    if (UI('summary/overlay_hp')) { const w = Math.round(96 * p.hp / p.maxhp); ctx.drawImage(UI('summary/overlay_hp'), 0, hpColorRow(p.hp, p.maxhp) * 6, w, 6, 360, 104, w, 6); }
    for (let i = 1; i < 6; i++) {
      const si = idxs[i]; const col = nat[1] === si ? '#e8605c' : nat[2] === si ? '#5890f0' : '#f8f8f8';
      L(names[i], 248, 114 + (i - 1) * 32 + 4 - 0, { base: col, size: 22 }); Dk(String(p.stats[si]), 456, 114 + (i - 1) * 32 + 4, { align: 'right', size: 22 });
    }
    L('Ability', 224, 282, { size: 22 }); const ab = D.AB[p.ability] || { name: p.ability || '-', desc: '' };
    Dk(ab.name, 362, 282, { size: 22 });
    wrap(ab.desc, 270, 20).slice(0, 2).forEach((l, i) => Dk(l, 224, 316 + i * 24, { size: 20 }));
  } else {
    drawMovesList(p, S, Dk);
  }
}
function drawMovesList(p, S, Dk) {
  for (let i = 0; i < 4; i++) {
    const y = 94 + i * 64, m = p.moves[i];
    if (S.swap === i) ctx.drawImage(UI('summary/cursor_move'), 0, 74, 252, 74, 236, y - 4, 252, 74);
    if (S.msel === i) ctx.drawImage(UI('summary/cursor_move'), 0, 0, 252, 74, 236, y - 4, 252, 74);
    if (!m) { Dk('-', 316, y + 8, { size: 22 }); Dk('--', 460, y + 34, { align: 'right', size: 20 }); continue; }
    const md = D.MV[m.id]; drawTypeIcon(md.type, 248, y + 4);
    Dk(md.name, 320, y + 8, { size: 22 });
    Dk('PP', 316, y + 34, { size: 20 }); Dk(m.pp + '/' + maxPP(m), 460, y + 34, { align: 'right', size: 20 });
  }
}
function drawMoveDetail(p, S) {
  const m = p.moves[S.msel]; if (!m) return; const md = D.MV[m.id];
  pic('summary/bg_movedetail', 0, 0);
  const L = (s, x, y, o = {}) => txt(s, x, y + 4, Object.assign({ base: '#f8f8f8', shadow: LIGHT_SH, size: 22 }, o));
  const Dk = (s, x, y, o = {}) => txt(s, x, y + 4, Object.assign({ base: '#404040', shadow: '#b0b0b0', size: 22 }, o));
  L('MOVES', 26, 14, { size: 24 });
  drawMovesList(p, S, Dk);
  drawTypeIcon(md.type, 8, 68); Dk(md.name, 82, 70);
  L('Category', 10, 120); ctx.drawImage(UI('category'), 0, ['Physical', 'Special', 'Status'].indexOf(md.cat) * 28, 64, 28, 168, 122, 64, 28);
  L('Power', 10, 152); Dk(md.pow > 1 ? md.pow : '---', 230, 152, { align: 'right' });
  L('Accuracy', 10, 184); Dk(md.acc > 0 ? md.acc : '---', 230, 184, { align: 'right' });
  wrap(md.desc, 224, 20).slice(0, 5).forEach((l, i) => Dk(l, 8, 222 + i * 32 - 4, { size: 20 }));
}
function* summaryScreen(party, idx) {
  const S = { party, idx, page: 1, msel: -1, detail: false, swap: -1 };
  return yield* withDraw(() => drawSummary(S), (function* () {
    sfx('open');
    while (true) {
      yield;
      if (S.detail) {
        const n = party[S.idx].moves.length;
        if (rep('up') && S.msel > 0) { S.msel--; sfx('cursor'); }
        if (rep('down') && S.msel < n - 1) { S.msel++; sfx('cursor'); }
        if (ok()) {
          if (S.swap < 0) { S.swap = S.msel; sfx('ok'); }
          else { if (S.swap !== S.msel) { const mv = party[S.idx].moves; const t = mv[S.swap]; mv[S.swap] = mv[S.msel]; mv[S.msel] = t; } S.swap = -1; sfx('ok'); }
        } else if (back()) { if (S.swap >= 0) S.swap = -1; else S.detail = false; sfx('back'); }
        continue;
      }
      if (back()) { sfx('back'); return S.idx; }
      if (rep('left')) { if (S.page > 1) { S.page--; sfx('cursor'); S.msel = -1; } }
      if (rep('right')) { if (S.page < 4) { S.page++; sfx('cursor'); S.msel = S.page === 4 ? 0 : -1; } }
      if (S.page === 4 && S.msel < 0) S.msel = 0;
      if (rep('up')) { if (S.page === 4 && S.msel > 0) { S.msel--; } else if (S.idx > 0) { S.idx--; S.msel = S.page === 4 ? 0 : -1; } sfx('cursor'); }
      if (rep('down')) { if (S.page === 4 && S.msel < Math.min(3, party[S.idx].moves.length - 1)) { S.msel++; } else if (S.idx < party.length - 1) { S.idx++; S.msel = S.page === 4 ? 0 : -1; } sfx('cursor'); }
      if (ok() && S.page === 4) { S.detail = true; sfx('ok'); }
    }
  })());
}

// draws the visible (non-transparent) part of a sprite scaled to fit inside a rectangle, so it never overlaps anything
// (bounding boxes are precomputed because canvas pixel reads are blocked when running from file://)
const SPRITE_BOX = {"609": [30, 0, 88, 125], "194": [45, 0, 70, 160], "194b": [26, 7, 91, 153], "609b": [1, 39, 159, 121], "366": [12, 0, 138, 157], "366b": [3, 14, 153, 146], "31": [34, 1, 87, 158], "31b": [2, 23, 156, 137], "160": [56, 1, 58, 157], "160b": [19, 0, 111, 160], "412": [33, 2, 94, 154], "412b": [22, 31, 109, 129], "640": [39, 4, 85, 155], "640b": [4, 17, 148, 143], "765": [45, 3, 74, 155], "765b": [22, 14, 134, 146]};
function drawFitted(im, rx, ry, rw, rh, key) {
  const a = SPRITE_BOX[key] || [0, 0, im.width, im.height], b = { x: a[0], y: a[1], w: a[2], h: a[3] };
  const s = Math.min(rw / b.w, rh / b.h), w = b.w * s, h = b.h * s;
  ctx.drawImage(im, b.x, b.y, b.w, b.h, rx + (rw - w) / 2, ry + rh - h, w, h);
}
