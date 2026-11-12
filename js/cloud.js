'use strict';
// ===================================================================
//  Cloud saves through Google Drive (hidden "appDataFolder": only this game can see it, nothing clutters the player's Drive).
//    Browser : Google Identity Services token flow (needs CLOUD_CFG.webClientId, see js/cloud-config.js)
//    Windows : sign-in + API calls run in the app's main process (dist-tools/desktop/cloud.js, exposed as window.jbaCloud)
//  One file per slot: jba_slot_N.json, with a small summary in appProperties so the list needs a single request.
// ===================================================================
const CLOUD = (() => {
  const SCOPE = 'openid email https://www.googleapis.com/auth/drive.appdata';
  const API = 'https://www.googleapis.com/';
  const LS = 'jba_cloud_auth', WEBCFG = 'jba_cloud_cfg';
  // browser: the client ID typed in the game (Cloud saves > Set up) wins over js/cloud-config.js
  const webId = () => { try { const o = JSON.parse(localStorage.getItem(WEBCFG) || 'null'); if (o && o.clientId) return o.clientId; } catch (e) { } return (window.CLOUD_CFG && CLOUD_CFG.webClientId) || ''; };
  // Windows app: window.jbaCloud (dist-tools/desktop/preload.js). Android app: the native "Cloud" plugin (dist-tools/android-src/CloudPlugin.java), wrapped to the same shape.
  const native = () => {
    if (window.jbaCloud) return window.jbaCloud;
    try { if (typeof jbaPlugin === 'function' && window.Capacitor) { const P = jbaPlugin('Cloud'); return { status: () => P.status(), signIn: () => P.signIn(), signOut: () => P.signOut(), api: o => P.api(o), setConfig: o => P.setConfig(o) }; } } catch (e) { }
    return null;
  };
  const desktop = () => !!native();
  const err = (m, code) => { const e = new Error(m); e.code = code; return e; };
  let tok = null, exp = 0, email = '', gisP = null, cfgDesk = null;
  try { const o = JSON.parse(localStorage.getItem(LS) || 'null'); if (o) { tok = o.tok; exp = o.exp || 0; email = o.email || ''; } } catch (e) { }
  const keep = () => { try { if (tok || email) localStorage.setItem(LS, JSON.stringify({ tok, exp, email })); else localStorage.removeItem(LS); } catch (e) { } };

  function loadGIS() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    return gisP = gisP || new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => res(); s.onerror = () => { gisP = null; rej(err('Could not reach Google. Check your connection.', 'net')); };
      document.head.appendChild(s);
    });
  }
  async function webToken(prompt) {
    if (tok && Date.now() < exp - 30000) return tok;
    await loadGIS();
    const r = await new Promise((res, rej) => {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: webId(), scope: SCOPE,
        callback: r => r && r.access_token ? res(r) : rej(err((r && (r.error_description || r.error)) || 'Sign-in failed.', 'auth')),
        error_callback: e => rej(err(e && e.type === 'popup_failed_to_open' ? 'Allow pop-ups for this page to sign in with Google.' : e && e.type === 'popup_closed' ? 'Sign-in was cancelled.' : 'Sign-in failed.', 'auth'))
      });
      tc.requestAccessToken({ prompt: prompt || '' });
    });
    tok = r.access_token; exp = Date.now() + (+r.expires_in || 3600) * 1000;
    if (!email) { try { const u = await fetch(API + 'oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + tok } }).then(x => x.json()); email = u.email || ''; } catch (e) { } }
    keep(); return tok;
  }
  async function req(method, url, o = {}) {
    if (desktop()) { try { return await native().api({ method, url, headers: o.headers || {}, body: o.body == null ? null : o.body }); } catch (e) { throw err(/sign in/i.test(String(e && e.message)) ? 'Sign in again.' : 'Could not reach Google.', /sign in/i.test(String(e && e.message)) ? 'auth' : 'net'); } }
    const t = await webToken('');
    let r; try { r = await fetch(url, { method, headers: Object.assign({ Authorization: 'Bearer ' + t }, o.headers || {}), body: o.body == null ? undefined : o.body }); } catch (e) { throw err('Could not reach Google. Check your connection.', 'net'); }
    return { status: r.status, text: await r.text() };
  }
  async function drive(method, url, o) {
    const r = await req(method, url, o);
    if (r.status === 401) { tok = null; exp = 0; keep(); throw err('Your Google sign-in expired. Sign in again.', 'auth'); }
    if (r.status < 200 || r.status >= 300) {
      let m = ''; try { m = JSON.parse(r.text).error.message; } catch (e) { }
      throw err(r.status === 403 ? 'Google refused access: ' + (m || 'check the API / consent settings.') : r.status === 429 ? 'Google says to slow down. Try again in a minute.' : (m || 'Google answered ' + r.status + '.'), r.status);
    }
    return r.text;
  }
  const fname = n => 'jba_slot_' + n + '.json';
  const AUTO = 'jba_cloud_auto', AUTOLAST = 'jba_cloud_autolast';
  let autoBusy = false, autoPending = 0;

  return {
    // 'desktop' | 'web' | 'none' (Android app, or opened from file://)
    mode() { return desktop() ? 'desktop' : !/^https?:$/.test(location.protocol) || (typeof mmNative === 'function' && mmNative()) ? 'none' : 'web'; },
    async configured() {
      const m = this.mode(); if (m === 'none') return false;
      if (m === 'desktop') { try { return !!(await native().status()).configured; } catch (e) { return false; } }
      return !!webId();
    },
    // what the "Set up" dialog shows: { clientId, secret } (secret = this build also needs a client secret)
    async getConfig() {
      if (desktop()) { try { const s = await native().status(); return { clientId: s.clientId || '', secret: true }; } catch (e) { return { clientId: '', secret: true }; } }
      return { clientId: webId(), secret: false };
    },
    async setConfig(clientId, clientSecret) {
      if (desktop()) { await native().setConfig({ clientId, clientSecret }); return; }
      try { if (clientId) localStorage.setItem(WEBCFG, JSON.stringify({ clientId })); else localStorage.removeItem(WEBCFG); } catch (e) { }
      tok = null; exp = 0; email = ''; keep();
    },
    // ---- background use (checking for a newer cloud save, automatic upload): never opens a sign-in window
    async canQuiet() {
      if (!(await this.configured())) return false;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
      if (desktop()) { try { return !!(await native().status()).signedIn; } catch (e) { return false; } }
      return !!(tok && Date.now() < exp - 30000);
    },
    autoOn() { try { return localStorage.getItem(AUTO) === '1'; } catch (e) { return false; } },
    setAuto(v) { try { if (v) localStorage.setItem(AUTO, '1'); else localStorage.removeItem(AUTO); } catch (e) { } },
    lastAuto() { try { return JSON.parse(localStorage.getItem(AUTOLAST) || 'null'); } catch (e) { return null; } },
    // called after every in-game save (writeSave in menus2.js); sends that slot to Drive when the setting is on
    async autoUpload(n) {
      if (!this.autoOn()) return;
      if (autoBusy) { autoPending = n; return; }
      autoBusy = true;
      const mark = (ok, msg) => { try { localStorage.setItem(AUTOLAST, JSON.stringify({ ok, t: Date.now(), msg: msg || '', n })); } catch (e) { } };
      try {
        if (!(await this.canQuiet())) return mark(false, 'Not signed in or offline.');
        const raw = localStorage.getItem(slotKey(n)), d = JSON.parse(raw);
        const files = await this.list();
        await this.upload(n, raw, { name: d.name, t: d.t, pf: d.playFrames || 0, b: typeof mmBadges === 'function' ? mmBadges(d) : 0, m: d.map }, files[n] && files[n].id);
        mark(true);
      } catch (e) { mark(false, e && e.message); }
      finally { autoBusy = false; if (autoPending) { const q = autoPending; autoPending = 0; this.autoUpload(q); } }
    },
    async status() {
      if (desktop()) { try { const s = await native().status(); return { signedIn: !!s.signedIn, email: s.email || '' }; } catch (e) { return { signedIn: false, email: '' }; } }
      return { signedIn: !!(tok && Date.now() < exp) || !!email, email };
    },
    async signIn() {
      if (desktop()) { const s = await native().signIn(); return { signedIn: true, email: s.email || '' }; }
      await webToken('select_account'); return { signedIn: true, email };
    },
    async signOut() {
      if (desktop()) { try { await native().signOut(); } catch (e) { } return; }
      try { if (tok && window.google && google.accounts) google.accounts.oauth2.revoke(tok, () => { }); } catch (e) { }
      tok = null; exp = 0; email = ''; keep();
    },
    // -> { [slot]: { id, name, t, pf, b, m } }
    async list() {
      const txt = await drive('GET', API + 'drive/v3/files?spaces=appDataFolder&pageSize=100&fields=' + encodeURIComponent('files(id,name,modifiedTime,appProperties)'));
      const out = {};
      for (const f of (JSON.parse(txt).files || [])) {
        const m = /^jba_slot_(\d+)\.json$/.exec(f.name); if (!m) continue;
        const p = f.appProperties || {}; out[+m[1]] = { id: f.id, name: p.name || '?', t: +p.t || Date.parse(f.modifiedTime) || 0, pf: +p.pf || 0, b: +p.b || 0, m: +p.m || 0 };
      }
      return out;
    },
    // raw = the save's JSON text, sum = { name, t, pf, b, m }; existingId = id of the cloud file to replace (if any)
    async upload(n, raw, sum, existingId) {
      const props = { name: String(sum.name || '').slice(0, 40), t: String(sum.t || 0), pf: String(sum.pf || 0), b: String(sum.b || 0), m: String(sum.m || 0) };
      const meta = existingId ? { appProperties: props } : { name: fname(n), parents: ['appDataFolder'], appProperties: props };
      const B = 'jbaboundary' + Math.random().toString(36).slice(2);
      const body = '--' + B + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + B + '\r\nContent-Type: application/json\r\n\r\n' + raw + '\r\n--' + B + '--';
      await drive(existingId ? 'PATCH' : 'POST', API + 'upload/drive/v3/files' + (existingId ? '/' + existingId : '') + '?uploadType=multipart&fields=id', { headers: { 'Content-Type': 'multipart/related; boundary=' + B }, body });
    },
    async download(id) { return drive('GET', API + 'drive/v3/files/' + encodeURIComponent(id) + '?alt=media'); },
    async remove(id) { await drive('DELETE', API + 'drive/v3/files/' + encodeURIComponent(id)); }
  };
})();
