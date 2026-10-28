'use strict';
// Boot: load assets, show a title card, start the intro on the first key press.
(async function boot() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
  ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Loading…', SW / 2, SH / 2); ctx.textAlign = 'left';
  await loadAssets();
  G.player = new PlayerChr();
  G.manual = new URLSearchParams(location.search).has('manual');
  const q = new URLSearchParams(location.search);
  try { await Promise.all(['24px PkmnEms', '24px PkmnFl'].map(f => document.fonts.load(f))); } catch (e) { }
  G.started = false;
  requestAnimationFrame(loop);
  if (q.has('autostart')) { G.started = true; enterMap(START.map, START.x, START.y, START.dir); keys.pressed = {}; return; }
  // Editor test hook: ?map=ID&x=X&y=Y&dir=2&vars=201:5,3:2&sw=12,14 jumps straight into a map.
  if (q.has('map')) {
    G.started = true; G.name = G.name || 'Jorge';
    (q.get('vars') || '').split(',').forEach(p => { const [k, v] = p.split(':'); if (k && v !== undefined && !isNaN(+k)) G.vars[+k] = +v; });
    (q.get('sw') || '').split(',').forEach(k => { if (k && !isNaN(+k)) G.switches[+k] = true; });
    enterMap(+q.get('map'), +q.get('x') || 0, +q.get('y') || 0, +q.get('dir') || 2); keys.pressed = {}; return;
  }
  startUI(titleScreen());
})();
// ---- test helpers (used by the automated playtests)
window.T = {
  press(k) { keys.pressed[k] = true; keys.held[k] = true; G.tick(1); keys.held[k] = false; },
  hold(k, n) { keys.held[k] = true; for (let i = 0; i < n; i++) G.tick(1); keys.held[k] = false; },
  tick(n) { G.tick(n); },
  busy() { return !!(G.main || G.msg || G.choice || G.battle || G.frozen || G.trans || G.player.forcing || G.modal || G.uiGen); },
  state() { return { map: G.mapId, x: G.player.x, y: G.player.y, dir: G.player.dir, stage: G.vars[201] || 0, msg: !!G.msg, choice: G.choice && G.choice.labels, main: !!G.main, battle: !!G.battle, name: G.name }; },
  // advance dialogue: confirm until nothing is pending (stops at choices / name prompts)
  path(tx, ty) {
    const probe = new Chr(); probe.isPlayer = true; const W = G.map.w, H = G.map.h; const start = [G.player.x, G.player.y];
    const key = (x, y) => x + ',' + y; const prev = { [key(...start)]: null }; const q = [start];
    while (q.length) {
      const [x, y] = q.shift(); if (x === tx && y === ty) break;
      for (const d of [2, 4, 6, 8]) {
        probe.x = x; probe.y = y; probe.dir = d; const [dx, dy] = dirVec[d]; const nx = x + dx, ny = y + dy;
        if (prev[key(nx, ny)] !== undefined) continue;
        if (!(nx === tx && ny === ty ? probe.canMove(d) || true : probe.canMove(d))) continue;
        if (!probe.canMove(d) && !(nx === tx && ny === ty)) continue;
        prev[key(nx, ny)] = [x, y, d]; q.push([nx, ny]);
      }
    }
    if (prev[key(tx, ty)] === undefined) return null;
    const ds = []; let c = key(tx, ty); while (prev[c]) { const [px, py, d] = prev[c]; ds.unshift(d); c = key(px, py); }
    return ds;
  },
  walkTo(tx, ty, maxFrames = 3000) {
    const ds = this.path(tx, ty); if (!ds) return 'nopath';
    const names = { 2: 'down', 4: 'left', 6: 'right', 8: 'up' };
    for (const d of ds) {
      if (G.main || G.msg || G.battle) return 'interrupted';
      const before = [G.player.x, G.player.y];
      keys.held[names[d]] = true; let n = 0;
      while (n++ < 60 && !G.main && !(G.player.x !== before[0] || G.player.y !== before[1])) G.tick(1);
      keys.held[names[d]] = false;
      while (G.player.moving) G.tick(1);
      if (G.mapId === 0) return 'err';
    }
    return 'ok';
  },
  face(d) { G.player.dir = d; },
  skip(max = 4000) { let n = 0; while (n++ < max && (G.main || G.msg || G.frozen || G.trans || G.player.forcing || G.battle) && !G.choice && !G.modal) { if (G.msg && G.msg.done || G.battle) keys.pressed.ok = true; G.tick(1); } return n; },
};

