// ============================================================ Trade codes (no server)
// "Send" removes a Pokémon from the save and turns it into an encrypted + signed text code; "Receive" decrypts a friend's code,
// validates every field and adds the Pokémon. Codes are AES-style stream-encrypted (HMAC-SHA256 keystream) and authenticated with an
// HMAC, so a code that was edited, forged or made up is rejected. The secret ships inside the game, so this stops casual forging, not a
// determined hacker. A code can only be accepted once per save (G.tradeSeen), and your own outbox codes can't be re-imported.

// ---- SHA-256 / HMAC (pure JS: works on file:// and plain http, where crypto.subtle isn't available)
const TR_K = (() => { const k = [], p = []; for (let n = 2; p.length < 64; n++) { let ok = true; for (const q of p) { if (q * q > n) break; if (n % q === 0) { ok = false; break; } } if (ok) p.push(n); } for (const n of p) k.push(Math.floor((Math.cbrt(n) % 1) * 4294967296)); return k; })();
const TR_H0 = (() => { const p = [2, 3, 5, 7, 11, 13, 17, 19]; return p.map(n => Math.floor((Math.sqrt(n) % 1) * 4294967296)); })();
function trSha256(msg) {
  const l = msg.length, nb = Math.ceil((l + 9) / 64), buf = new Uint8Array(nb * 64); buf.set(msg); buf[l] = 0x80;
  const dv = new DataView(buf.buffer); dv.setUint32(buf.length - 4, (l * 8) >>> 0); dv.setUint32(buf.length - 8, Math.floor(l * 8 / 4294967296));
  const H = TR_H0.slice(), w = new Uint32Array(64), rr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < buf.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rr(a, 7) ^ rr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rr(b, 17) ^ rr(b, 19) ^ (b >>> 10))) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + TR_K[i] + w[i]) >>> 0;
      const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) >>> 0; });
  }
  const out = new Uint8Array(32); const od = new DataView(out.buffer); H.forEach((v, i) => od.setUint32(i * 4, v)); return out;
}
function trCat(...a) { const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; }
function trHmac(key, msg) {
  if (key.length > 64) key = trSha256(key);
  const ip = new Uint8Array(64).fill(0x36), op = new Uint8Array(64).fill(0x5c); for (let i = 0; i < key.length; i++) { ip[i] ^= key[i]; op[i] ^= key[i]; }
  return trSha256(trCat(op, trSha256(trCat(ip, msg))));
}
const trUtf8 = s => new TextEncoder().encode(s), trStr = b => new TextDecoder().decode(b);
function trSecret() {      // assembled from pieces so the key isn't one greppable string
  const parts = [[74, 66, 65], [45, 116, 114, 97, 100, 101], [45, 80, 75, 77, 78], [45, 118, 49], [45, 55, 114, 51, 101, 45, 83, 97, 117, 110, 97]];
  return trUtf8(parts.map(p => String.fromCharCode(...p)).join('') + '|' + (0x5ec7 ^ 0x1a2b).toString(36));
}
const TR_KEYS = () => { const s = trSecret(); return { enc: trSha256(trCat(s, trUtf8('/enc'))), mac: trSha256(trCat(s, trUtf8('/mac'))) }; };
function trStream(key, nonce, n) {
  const out = new Uint8Array(n); let ctr = 0;
  for (let p = 0; p < n; p += 32, ctr++) { const blk = trHmac(key, trCat(nonce, new Uint8Array([ctr >>> 24, (ctr >>> 16) & 255, (ctr >>> 8) & 255, ctr & 255]))); out.set(blk.subarray(0, Math.min(32, n - p)), p); }
  return out;
}
const TR_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function trB64e(b) { let s = ''; for (let i = 0; i < b.length; i += 3) { const n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0); s += TR_B64[(n >> 18) & 63] + TR_B64[(n >> 12) & 63] + (i + 1 < b.length ? TR_B64[(n >> 6) & 63] : '') + (i + 2 < b.length ? TR_B64[n & 63] : ''); } return s; }
function trB64d(s) { const out = []; let acc = 0, bits = 0; for (const ch of s) { const v = TR_B64.indexOf(ch); if (v < 0) return null; acc = (acc << 6) | v; bits += 6; if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); acc &= (1 << bits) - 1; } } return new Uint8Array(out); }
function trRandBytes(n) { const b = new Uint8Array(n); if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b); else for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256); return b; }
const trHex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

const TR_PREFIX = 'JBA1-';
function trSeal(obj) {
  const k = TR_KEYS(), nonce = trRandBytes(12), plain = trUtf8(JSON.stringify(obj)), ks = trStream(k.enc, nonce, plain.length);
  const ct = plain.map((v, i) => v ^ ks[i]); const mac = trHmac(k.mac, trCat(trUtf8(TR_PREFIX), nonce, ct)).subarray(0, 16);
  return TR_PREFIX + trB64e(trCat(nonce, ct, mac));
}
function trOpen(code) {
  code = String(code || '').replace(/\s+/g, ''); if (!code.startsWith(TR_PREFIX)) return null;
  const raw = trB64d(code.slice(TR_PREFIX.length)); if (!raw || raw.length < 12 + 16 + 2) return null;
  const k = TR_KEYS(), nonce = raw.subarray(0, 12), ct = raw.subarray(12, raw.length - 16), mac = raw.subarray(raw.length - 16);
  const want = trHmac(k.mac, trCat(trUtf8(TR_PREFIX), nonce, ct)).subarray(0, 16); let diff = 0; for (let i = 0; i < 16; i++) diff |= want[i] ^ mac[i]; if (diff) return null;
  const ks = trStream(k.enc, nonce, ct.length); try { return JSON.parse(trStr(ct.map((v, i) => v ^ ks[i]))); } catch (e) { return null; }
}

// ---- Pokémon <-> payload
function trPack(p) {
  return { s: p.sym, l: p.lvl, x: p.exp, i: p.ivs.slice(), e: p.evs.slice(), n: p.nature, h: p.hp, st: p.status || null, sl: p.sleep || 0, it: null, b: p.ball || 0, ha: p.happy, o: p.ot, oi: p.otid, me: p.met, ml: p.metLvl, sh: p.shiny ? 1 : 0, ni: p.nick || null, a: p.ability || null, g: p.gender, m: (p.moves || []).map(m => [m.id, m.pp, m.ppup || 0]) };
}
const trInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const trTxt = (v, max) => typeof v === 'string' && v.length <= max && !/[\u0000-\u001f]/.test(v);
function trFamilyMoves(sym) {      // level-up moves of the species and everything it evolved from (a move learned as a pre-evolution stays)
  const out = [], seen = new Set(); let cur = [sym];
  while (cur.length) {
    const nxt = [];
    for (const k of cur) {
      if (seen.has(k)) continue; seen.add(k); const sp = D.SP[k]; if (sp) (sp.moves || []).forEach(q => out.push(q[1]));
      for (const j of Object.keys(D.SP)) { const e = (D.SP[j].evo || '').split(',').map(x => x.trim()); for (let i = 0; i + 2 < e.length; i += 3) if (e[i] === k) nxt.push(j); }
    }
    cur = nxt;
  }
  return out;
}
function trUnpack(d) {      // validates everything; returns a fresh Pokémon object or an error string
  if (!d || typeof d !== 'object') return 'bad data';
  const sp = D.SP[d.s]; if (!sp || (typeof dexHidden === 'function' && dexHidden(d.s))) return 'unknown Pokémon';
  if (!trInt(d.l, 1, MAXLEVEL)) return 'bad level';
  if (!Array.isArray(d.i) || d.i.length !== 6 || !d.i.every(v => trInt(v, 0, 31))) return 'bad IVs';
  if (!Array.isArray(d.e) || d.e.length !== 6 || !d.e.every(v => trInt(v, 0, 255)) || d.e.reduce((a, b) => a + b, 0) > 510) return 'bad EVs';
  if (!trInt(d.n, 0, 24)) return 'bad nature';
  if (!trInt(d.x, 0, 2000000000) || d.x < expFor(sp.growth, d.l) || (d.l < MAXLEVEL && d.x >= expFor(sp.growth, d.l + 1))) return 'bad experience';
  if (!trInt(d.ha, 0, 255) || !trInt(d.b, 0, 40) || !trInt(d.ml, 1, MAXLEVEL) || !trInt(d.g, 0, 2) || !trInt(d.sh, 0, 1) || !trInt(d.sl, 0, 10)) return 'bad values';
  const ab = sp.abilities.filter(Boolean).concat(sp.hidden ? [sp.hidden] : []); if (d.a !== null && !ab.includes(d.a)) return 'bad ability'; if (d.a === null && sp.abilities.some(Boolean)) return 'bad ability';
  if (d.it !== null) return 'held items cannot be traded';
  if (d.st !== null && !['PAR', 'BRN', 'PSN', 'TOX', 'SLP', 'FRZ'].includes(d.st)) return 'bad status';
  if (!trTxt(d.o, 16) || !d.o || !trInt(d.oi, 0, 4294967295) || !trTxt(d.me, 40)) return 'bad trainer data';
  if (d.ni !== null && !(trTxt(d.ni, 14) && d.ni.length)) return 'bad nickname';
  if (!Array.isArray(d.m) || d.m.length < 1 || d.m.length > 4) return 'bad moves';
  for (const q of d.m) {
    if (!Array.isArray(q) || q.length !== 3 || !trTxt(q[0], 40) || !D.MV[q[0]] || !trInt(q[2], 0, 3) || !trInt(q[1], 0, 99)) return 'bad moves';
    // (no check on where the move came from: forms like the Summer stones swap the species, so any move that exists in the game is accepted)
  }
  if (new Set(d.m.map(q => q[0])).size !== d.m.length) return 'bad moves';
  const p = {
    sym: d.s, name: sp.name, lvl: d.l, exp: d.x, ivs: d.i.slice(), evs: d.e.slice(), nature: d.n, hp: 1, maxhp: 0, status: d.st, sleep: d.sl, item: d.it, ball: d.b, happy: d.ha,
    ot: d.o, otid: d.oi, met: d.me, metLvl: d.ml, shiny: !!d.sh, nick: d.ni, ability: d.a, gender: d.g, moves: d.m.map(q => ({ id: q[0], pp: Math.min(q[1], maxPP({ id: q[0], ppup: q[2] })), ppup: q[2] })), traded: true,
  };
  refreshStats(p); p.hp = Math.max(0, Math.min(p.maxhp, trInt(d.h, 0, 100000) ? d.h : p.maxhp)); return p;
}

// ---- UI
const TR_LIFE = 60000;
const TR_CAPS = [20, 27, 35, 43, 47, 57, 60, 65, 100];      // highest level you can receive, by number of badges (index = badges earned)
const trCap = () => TR_CAPS[Math.min(TR_CAPS.length - 1, typeof badgeCount === 'function' ? badgeCount() : 0)];
function trClockOk() {      // refuses trades if the device clock was moved back (it would let old codes work again)
  let last = 0; for (const x of (G.tradeLog || [])) last = Math.max(last, x.t || 0); if (G.tradePending) last = Math.max(last, G.tradePending.t || 0);
  return Date.now() >= last - 5 * 60000;
}
const trClock = t => { const d = new Date(t), z = n => String(n).padStart(2, '0'); return z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()); };
function trInit() { G.tradePending = G.tradePending || null; G.tradeOut = G.tradeOut || []; G.tradeSeen = G.tradeSeen || {}; G.tradeLog = G.tradeLog || []; }
const trSay = m => withDraw(drawUiMsg, uiMessage(m));
function* trPick(labels, o = {}) {
  const r = yield* withDraw(() => { drawUiMsg(); drawPopup(); }, choiceWindow(labels, Object.assign({ x: 8, y: 8, w: 400, max: 8 }, o)));
  G.uiPopup = null; return r;
}
function* trYes(text) { const r = yield* withDraw(() => { drawUiMsg(); drawPopup(); }, (function* () { yield* uiMessage(text, { noWait: true }); const y = yield* yesNo(); G.uiMsg = null; return y; })()); G.uiPopup = null; return r; }
function trCopy(code) { try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).catch(() => { }); } catch (e) { } }
// text box in the same style as the name entry (re-uses #nameBox). opts.readonly shows a code to copy; otherwise returns the typed/pasted text, or null if cancelled
function* trText(label, def, opts = {}) {
  G.modal = true;
  const box = document.getElementById('nameBox'), inp = document.getElementById('nameInput'), okb = document.getElementById('nameOk');
  const old = { w: inp.style.width, fs: inp.style.fontSize, ta: inp.style.textAlign, ml: inp.maxLength };
  document.getElementById('nameLabel').textContent = tr(label); inp.value = def || ''; inp.maxLength = 4000; inp.readOnly = !!opts.readonly;
  inp.style.width = '92%'; inp.style.minWidth = '300px'; inp.style.fontSize = '15px'; inp.style.textAlign = 'left'; inp.placeholder = opts.placeholder || '';
  const card = box.querySelector('.card'); const extra = [];
  let res = 0;   // 0 waiting, 1 ok, 2 cancel
  const mk = (t, fn) => { const bt = document.createElement('button'); bt.textContent = t; bt.style.marginLeft = '8px'; bt.onclick = fn; card.appendChild(bt); extra.push(bt); return bt; };
  okb.textContent = opts.readonly ? 'Done' : 'OK'; okb.onclick = () => { res = 1; };
  if (opts.readonly) mk('Copy', () => { inp.focus(); inp.select(); try { document.execCommand('copy'); } catch (e) { } trCopy(inp.value); });
  else { mk('Paste', () => { try { navigator.clipboard.readText().then(t => { inp.value = t; }).catch(() => inp.focus()); } catch (e) { inp.focus(); } }); mk('Cancel', () => { res = 2; }); }
  inp.onkeydown = e => { if (e.key === 'Enter') res = 1; if (e.key === 'Escape') res = 2; e.stopPropagation(); };
  box.style.display = 'flex'; setTimeout(() => { inp.focus(); if (opts.readonly) inp.select(); }, 30);
  keys.pressed = {}; let wait = 20;
  while (!res) { yield; if (wait > 0) wait--; }
  const val = inp.value; box.style.display = 'none'; extra.forEach(x => x.remove());
  inp.readOnly = false; inp.placeholder = ''; inp.style.width = old.w; inp.style.minWidth = ''; inp.style.fontSize = old.fs; inp.style.textAlign = old.ta; inp.maxLength = old.ml; okb.textContent = 'OK';
  G.modal = false; canvas.focus(); keys.pressed = {}; keys.held = {};
  return res === 1 ? val : null;
}
const trLabel = p => pokeName(p) + '  Lv.' + p.lvl + (p.shiny ? ' *' : '');

// The trade: pick a Pokémon on the storage screen, then a menu with its OUTGOING code (made once, the Pokémon leaves your save) and the
// INCOMING code (your friend's). The incoming code can only be entered once your outgoing code exists, so a trade is always a swap.
function trLocate(mon) {      // where is it right now? (identity, so it survives moves)
  const pi = G.party.indexOf(mon); if (pi >= 0) return { party: true, remove: () => G.party.splice(pi, 1), undo: () => G.party.splice(pi, 0, mon) };
  for (const b of G.pc.boxes) { const k = b.mons.indexOf(mon); if (k >= 0) return { party: false, remove: () => { b.mons[k] = null; }, undo: () => { b.mons[k] = mon; } }; }
  return null;
}
function* trStart() {      // returns the chosen Pokémon or null
  pcInit(); yield* fadeTo(1, 8); const pick = yield* pcStorageScreen(3); yield* fadeTo(0, 8);
  if (!pick || !pick.mon) return null; const m = pick.mon;
  if (m.cheat) { yield* trSay("This Pokémon was made with cheats and can't be traded."); return null; }
  if (m.item) { yield* trSay(__('{0} is holding an item. Take the item first - only Pokémon without a held item can be traded.', pokeName(m))); return null; }
  if (typeof dexHidden === 'function' && dexHidden(m.sym)) { yield* trSay("This Pokémon can't be traded."); return null; }
  if (pick.where === 'party' && (G.party.length <= 1 || G.party.filter(q => q !== m && q.hp > 0).length < 1)) { yield* trSay('You need at least one other healthy Pokémon in your party.'); return null; }
  return m;
}
function* trOutgoing(m) {      // makes (or re-shows) the outgoing code
  if (!G.tradePending) {
    if (m.cheat) { yield* trSay("This Pokémon was made with cheats and can't be traded."); return false; }
    if (m.item) { yield* trSay(__('{0} is holding an item. Take the item first.', pokeName(m))); return false; }
    if (!trClockOk()) { yield* trSay("Your device's clock seems to have been set back. Fix the clock to trade."); return false; }
    const loc = trLocate(m); if (!loc) { yield* trSay('That Pokémon is no longer available.'); return false; }
    if (loc.party && (G.party.length <= 1 || G.party.filter(q => q !== m && q.hp > 0).length < 1)) { yield* trSay('You need at least one other healthy Pokémon in your party.'); return false; }
    if (!(yield* trYes(__('Make the outgoing code for {0}? It leaves your save now and you cannot take it back.', trLabel(m))))) return false;
    const prev = G.tradePending; loc.remove(); G.tradePending = { tid: trHex(trRandBytes(10)), p: trPack(m), name: trLabel(m), t: Date.now() };
    let saved = false; try { saved = writeSave() !== false; } catch (e) { }
    if (!saved) { loc.undo(); G.tradePending = prev; yield* trSay("The game couldn't be saved, so the trade was cancelled and nothing was lost. Free some browser storage and try again."); return false; }
  }
  const pd = G.tradePending, now = Date.now();      // every time it is shown the code is sealed again with the current time, and it is valid for TR_LIFE ms
  const code = pd.p ? trSeal({ v: 1, t: pd.tid, f: G.name || '???', d: now, p: pd.p }) : pd.code;
  trCopy(code);
  yield* trText(__('Outgoing code (made at {0}, valid for 1 minute - copied, send it now)', trClock(now)), code, { readonly: true });
  return true;
}
function* trIncoming() {
  const pend = G.tradePending; if (!pend) { yield* trSay('You need your outgoing code first. Make it, then enter your friend\'s code.'); return false; }
  const raw = yield* trText("Incoming code (your friend's code)", '', { placeholder: 'JBA1-...' }); if (!raw || !raw.trim()) return false;
  const d = trOpen(raw); if (!d || d.v !== 1 || !d.t || typeof d.t !== 'string') { yield* trSay("This code isn't valid. It may be mistyped, cut short, or edited."); return false; }
  if (typeof d.d !== 'number' || Date.now() - d.d > TR_LIFE || d.d - Date.now() > TR_LIFE) { yield* trSay(__('This code has expired{0}. Codes only last 1 minute. Ask your friend to show a new one.', (typeof d.d === 'number' ? ' (made at ' + trClock(d.d) + ')' : ''))); return false; }
  if (d.t === pend.tid) { yield* trSay("That's your own outgoing code! Enter your friend's code."); return false; }
  if (G.tradeSeen[d.t]) { yield* trSay('This code was already used on this save.'); return false; }
  const mon = trUnpack(d.p); if (typeof mon === 'string') { yield* trSay(__('This code isn\'t valid ({0}).', mon)); return false; }
  const cap = trCap(); if (mon.lvl > cap) { yield* trSay(__('This Pokémon is too strong for your badges (max Lv. {0}). Try again after your next badge.', cap)); return false; }
  const from = trTxt(d.f, 16) && d.f ? d.f : 'someone';
  if (!(yield* trYes(__('Trade {0} for {1} from {2}?', pend.name, trLabel(mon), from)))) return false;
  if (Date.now() - d.d > TR_LIFE) { yield* trSay('This code expired while you were deciding. Ask your friend to show a new one.'); return false; }
  const wasOwned = G.owned && G.owned[mon.sym], wasSeen = G.seen && G.seen[mon.sym];
  let where = 'party';
  if (G.party.length < 6) G.party.push(mon); else if (pcAdd(mon)) where = 'PC'; else { yield* trSay('There is no room for another Pokémon!'); return false; }
  G.tradeSeen[d.t] = 1; G.tradeSeen[pend.tid] = 1; G.tradePending = null;
  G.tradeLog.push({ out: pend.name, in: pokeName(mon), who: from, t: Date.now() });
  G.owned = G.owned || {}; G.owned[mon.sym] = true; G.seen = G.seen || {}; G.seen[mon.sym] = true;
  G.tradeLog = G.tradeLog.slice(-50);
  let saved = false; try { saved = writeSave() !== false; } catch (e) { }
  if (!saved) {      // couldn't save: undo everything so a reload can't lose the Pokémon
    if (where === 'party') G.party.splice(G.party.indexOf(mon), 1); else for (const b of G.pc.boxes) { const k = b.mons.indexOf(mon); if (k >= 0) b.mons[k] = null; }
    delete G.tradeSeen[d.t]; delete G.tradeSeen[pend.tid]; G.tradePending = pend; G.tradeLog.pop(); if (!wasOwned) delete G.owned[mon.sym]; if (!wasSeen) delete G.seen[mon.sym];
    yield* trSay("The game couldn't be saved, so the trade was cancelled. Free some browser storage and try again."); return false;
  }
  try { playME('Item_get'); } catch (e) { }
  yield* trSay(__('The trade is complete! You received {0} from {1}. It was added to your {2}.', pokeName(mon), from, where));
  return true;
}
function* trMenu(m) {      // m: the Pokémon chosen (null when resuming a trade whose outgoing code already exists)
  let cmd = 0;
  while (true) {
    const pend = G.tradePending, what = pend ? pend.name : trLabel(m);
    const labels = ['Outgoing code', 'Incoming code', pend ? 'Give up trade' : 'Back'];
    cmd = yield* pcMenuList(labels, [
      pend ? 'Show the code to send to your friend.' : __('Make the code that sends {0} to your friend.', what),
      pend ? "Enter your friend's code to finish the trade." : 'Needs your outgoing code first.',
      pend ? __('Stop waiting. {0} is already gone, so only do this if your friend has it.', what) : 'Choose another Pokémon.'], Math.max(cmd, 0));
    if (cmd < 0 || (cmd === 2 && !pend)) return;
    if (cmd === 0) { yield* trOutgoing(m); }
    else if (cmd === 1) { if (yield* trIncoming()) return; }
    else if (yield* trYes(__('Give up this trade? {0} will not come back.', what))) { G.tradeSeen[pend.tid] = 1; G.tradePending = null; try { writeSave(); } catch (e) { } return; }
  }
}
function* pcTrade() {
  trInit(); let cmd = 0;
  while (true) {
    const pend = G.tradePending;
    cmd = yield* pcMenuList([pend ? 'Continue trade' : 'Start trade', 'Exit'],
      [pend ? __('Your trade of {0} is waiting for your friend\'s code.', pend.name) : 'Pick a Pokémon, then swap trade codes with a friend.', 'Go back to the previous menu.'], Math.max(cmd, 0));
    if (cmd < 0 || cmd === 1) break;
    if (pend) yield* trMenu(null); else { const m = yield* trStart(); if (m) yield* trMenu(m); }
  }
}
