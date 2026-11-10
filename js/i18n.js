'use strict';
// ===================================================================
//  Localization. Language files live in lang/<code>.js and fill window.LANG[code]:
//    LANG.pt = { name: 'Português',
//                text: { 'English text': 'Translated text', ... },     // dialogue, menus, battle messages, trainer names ...
//                data: { 'MV.ABSORB.name': 'Translated', ... } };     // Pokémon / move / item / ability / place names and descriptions
//  An empty or missing translation falls back to the English text.
//  Placeholders like {0} {1} stand for names or numbers filled in by the game: keep them in the translation.
//  Codes inside dialogue (\b \c[2] \PN \v[3] \n ...) must be kept as they are.
//  Debug: open the game with ?i18n=debug and call I18N.missing() in the console to list texts that were shown untranslated.
// ===================================================================
window.LANG = window.LANG || {};
const I18N = {
  cur: 'en', map: null, orig: {}, seen: new Set(), debug: false,
  list() { return ['en'].concat(Object.keys(window.LANG).filter(c => c !== 'en')); },
  name(c) { return c === 'en' ? 'English' : ((window.LANG[c] && window.LANG[c].name) || c); },
  set(code) {
    if (code !== 'en' && !window.LANG[code]) code = 'en';
    this.cur = code;
    try { localStorage.setItem('jba_lang', code); } catch (e) { }
    this.map = null;
    if (code !== 'en') {
      this.map = new Map();
      const t = (window.LANG[code] && window.LANG[code].text) || {};
      for (const k in t) if (typeof t[k] === 'string' && t[k] !== '') this.map.set(k, t[k]);
    }
    this.apply();
    document.documentElement.lang = code;
    this.domStart(); this.domAll();
  },
  next(dl) { const l = this.list(); this.set(l[(l.indexOf(this.cur) + l.length + dl) % l.length]); },
  // swap the translated names / descriptions into the data tables (the English originals are kept so the language can be switched back)
  apply() {
    const D = window.DATA; if (!D) return;
    const pack = (this.cur !== 'en' && window.LANG[this.cur] && window.LANG[this.cur].data) || {};
    const O = this.orig;
    const put = (obj, f, key) => {
      if (!obj || obj[f] === undefined) return;
      const ok = key;
      if (!(ok in O)) O[ok] = obj[f];
      const v = pack[ok];
      obj[f] = (typeof v === 'string' && v !== '') ? v : O[ok];
      if (f === 'name') obj.ename = O[ok];      // the English name never changes: the game logic compares moves by it
    };
    for (const k in D.SP) for (const f of ['name', 'kind', 'dex']) put(D.SP[k], f, 'SP.' + k + '.' + f);
    for (const k in D.MV) for (const f of ['name', 'desc']) put(D.MV[k], f, 'MV.' + k + '.' + f);
    for (const k in D.IT) for (const f of ['name', 'plural', 'desc']) put(D.IT[k], f, 'IT.' + k + '.' + f);
    for (const k in D.AB) for (const f of ['name', 'desc']) put(D.AB[k], f, 'AB.' + k + '.' + f);
    (D.TYPES || []).forEach(t => put(t, 'name', 'TYPE.' + t.key + '.name'));
    if (window.TTYPES) for (const k in TTYPES) put(TTYPES[k], 'name', 'TC.' + k + '.name');
  },

  // ---- HTML parts of the game (title screen, save slots, dialogs, name box ...) are translated in the page itself
  _obs: null,
  _attrs: ['title', 'placeholder', 'aria-label'],
  domNode(n) {
    if (n.nodeType === 3) {
      const p = n.parentNode && n.parentNode.nodeName; if (p === 'SCRIPT' || p === 'STYLE' || p === 'TEXTAREA') return;
      if (n.__t !== undefined && n.nodeValue === n.__t) { /* ours */ } else n.__o = n.nodeValue;
      const raw = n.__o, key = raw.trim(); let out = raw;
      if (key) { const t = this.map ? this.map.get(key) : undefined; if (t !== undefined) out = raw.replace(key, t); else if (this.map) this.note(key); }
      n.__t = out; if (n.nodeValue !== out) n.nodeValue = out;
    } else if (n.nodeType === 1) {
      if (n.nodeName === 'SCRIPT' || n.nodeName === 'STYLE') return;
      for (const a of this._attrs) {
        if (!n.hasAttribute(a)) continue;
        const o = n.__oa || (n.__oa = {}), cur = n.getAttribute(a);
        if (o[a] === undefined || o[a + '#'] !== cur) o[a] = cur;
        const t = this.map ? this.map.get(o[a]) : undefined; const out = t !== undefined ? t : o[a];
        o[a + '#'] = out; if (cur !== out) n.setAttribute(a, out);
      }
      for (let c = n.firstChild; c; c = c.nextSibling) this.domNode(c);
    }
  },
  domAll() { if (document.body) this.domNode(document.body); },
  domStart() {
    if (this._obs || !document.body || typeof MutationObserver === 'undefined') return;
    this._obs = new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'childList') m.addedNodes.forEach(n => this.domNode(n));
        else if (m.type === 'characterData') { if (m.target.__t === undefined || m.target.nodeValue !== m.target.__t) this.domNode(m.target); }
        else if (m.type === 'attributes') this.domNode(m.target.cloneNode ? m.target : m.target);
      }
    });
    this._obs.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: this._attrs });
  },
  note(s) { if (this.debug && this.cur !== 'en' && /[A-Za-z]{3}/.test(s) && !this.seen.has(s)) this.seen.add(s); },
  isTranslated(s) { if (!this._vals || this._vals.size !== this.map.size) this._vals = new Set(this.map.values()); return this._vals.has(s); },
  missing() { return [...this.seen].filter(s => !(this.map && (this.map.has(s) || this.isTranslated(s)))); },
};
// translate a whole text (lookup only): used by every place that shows text on screen
function tr(s) {
  if (I18N.map === null) return s;
  const t = I18N.map.get(s);
  if (t !== undefined) return t;
  I18N.note(s);
  return s;
}
// translate a text with placeholders:  __('{0} used {1}!', name, move)
function __(fmt, ...a) {
  let t = (I18N.map === null) ? fmt : (I18N.map.get(fmt) || fmt);
  if (I18N.map !== null && t === fmt) I18N.note(fmt);
  return a.length ? t.replace(/\{(\d+)\}/g, (m, i) => (+i < a.length ? String(a[+i]) : m)) : t;
}
(function () {
  const q = new URLSearchParams(location.search);
  I18N.debug = q.get('i18n') === 'debug';
  let want = q.get('lang'); if (!want) { try { want = localStorage.getItem('jba_lang'); } catch (e) { } }
  I18N.want = want || 'en';
})();
