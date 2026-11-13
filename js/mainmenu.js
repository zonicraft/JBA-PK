'use strict';
// ===================================================================
//  Main menu (HTML overlay on top of the game canvas)
//    home  ->  save files / settings / controls
//  Mouse, touch, keyboard and gamepad all work. The game only starts once a save file is
//  opened or a new game is started in an empty slot (see titleScreen() at the bottom).
//  Settings are written to localStorage ('jba_settings') through saveSettings(), like the in-game Options.
// ===================================================================
const MM_RELEASES_API = 'https://api.github.com/repos/zonicraft/JBA-PK/releases/latest';   // the "Check for updates" button looks at the newest GitHub release
const MM_VERSION = () => (typeof GAME_VERSION !== 'undefined' ? String(GAME_VERSION) : '');   // js/version.js, written by dist-tools/set-version.js / prepare-www.js
function mmNewer(a, b) { const p = s => String(s).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0); const x = p(a), y = p(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }
const MM_BADGE_SWITCHES = [260, 261, 262, 263, 212, 980], MM_BADGE_PIPS = 8;
// The Android app is always fullscreen (system bars hidden), so its menu has no fullscreen buttons.
function mmNative() { const c = window.Capacitor; if (!c) return false; try { if (typeof c.isNativePlatform === 'function') return !!c.isNativePlatform(); } catch (e) { } return true; }
const MM_SVG = (d, extra = '') => '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + extra + '</svg>';
const MM_ICON = {
  play: MM_SVG('<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>'),
  back: MM_SVG('<path d="M15 5l-7 7 7 7"/>'),
  gear: MM_SVG('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  dex: MM_SVG('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h5.2M15.3 12h5.2"/><circle cx="12" cy="12" r="2.6"/>'),
  down: MM_SVG('<path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/>'),
  up: MM_SVG('<path d="M12 16V5m0 0l-4 4m4-4l4 4M5 20h14"/>'),
  trash: MM_SVG('<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>'),
  plus: MM_SVG('<path d="M12 5v14M5 12h14"/>'),
  full: MM_SVG('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  pad: MM_SVG('<rect x="2.5" y="7.5" width="19" height="10" rx="5"/><path d="M8 10.5v4M6 12.5h4"/>', '<circle cx="15.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="18" cy="13.5" r=".9" fill="currentColor"/>'),
  pin: MM_SVG('<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 10-13 0C5.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.2"/>'),
  clock: MM_SVG('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  cloud: MM_SVG('<path d="M7 18a4.5 4.5 0 01-.6-8.96A6 6 0 0118 9.5 4.2 4.2 0 0117.5 18z"/>'),
  warn: MM_SVG('<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.5v.01"/>'),
};
const MM_CSS = `
#mainMenu{--bg:#0a0f1f;--ink:#f4f6ff;--mut:#9aa6c8;--acc:#ffcb3d;--acc2:#3dd6c6;--danger:#ff5d73;--glass:rgba(255,255,255,.07);--line:rgba(255,255,255,.14);
  position:fixed;inset:0;z-index:20;color:var(--ink);background:var(--bg);overflow:hidden;font:500 16px/1.35 "Segoe UI",system-ui,-apple-system,Roboto,"Helvetica Neue",sans-serif;
  user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;transition:opacity .45s ease,transform .45s ease}
#mainMenu.leaving{opacity:0;transform:scale(1.04);pointer-events:none}
#mainMenu,#mainMenu *{box-sizing:border-box}
#mmQuit{--ink:#f4f6ff;--mut:#9aa6c8;--acc:#ffcb3d;--danger:#ff5d73;--line:rgba(255,255,255,.14);position:fixed;inset:0;z-index:40;color:var(--ink);font:500 16px/1.35 "Segoe UI",system-ui,sans-serif;user-select:none;-webkit-user-select:none}
#mmQuit,#mmQuit *{box-sizing:border-box}
:where(#mmQuit) button{font:inherit;color:inherit;cursor:pointer}
:where(#mainMenu) button{font:inherit;color:inherit;cursor:pointer}
:where(#mainMenu) svg{display:block}
/* background: city photo + shade + the character cut-out (assets/ui/menu_bg.jpg, menu_char.png) */
.mm-bg{position:absolute;inset:0;overflow:hidden;background:#0a0f1f}
.mm-v{scrollbar-width:none;-ms-overflow-style:none}.mm-v::-webkit-scrollbar{display:none;width:0;height:0}   /* the screens still scroll (wheel / touch / keys), the bar is just not drawn */
.mm-photo{position:absolute;inset:-3%;background:#0a0f1f url(assets/ui/menu_bg.jpg) center 62%/cover no-repeat;animation:mmzoom 40s ease-in-out infinite alternate}
@keyframes mmzoom{to{transform:scale(1.07) translateX(-1.2%)}}
.mm-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(6,10,24,.86) 0,rgba(6,10,24,.55) 42%,rgba(6,10,24,.08) 100%),linear-gradient(0deg,rgba(6,10,24,.55) 0,transparent 35%);transition:background .5s ease}
#mainMenu:not([data-view=home]) .mm-shade{background:linear-gradient(rgba(6,10,24,.8),rgba(6,10,24,.9));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.mm-char{position:absolute;right:-6vw;bottom:0;height:min(80vh,820px);width:auto;max-width:74vw;object-fit:contain;object-position:right bottom;pointer-events:none;user-select:none;filter:drop-shadow(0 18px 34px rgba(0,0,0,.55));transition:opacity .5s ease,transform .5s ease}
#mainMenu:not([data-view=home]) .mm-char{opacity:0;transform:translateX(60px)}
@media (max-aspect-ratio:5/4){.mm-char{display:none}.mm-shade{background:linear-gradient(rgba(6,10,24,.7),rgba(6,10,24,.82))}}
@media (min-aspect-ratio:5/4){
  .v-home .mm-mid{align-items:flex-start;padding-left:clamp(20px,9vw,160px)}
}
@keyframes mmorb{to{transform:translate(6vmax,4vmax) scale(1.15)}}
.mm-spark{position:absolute;bottom:-12px;width:6px;height:6px;border-radius:2px;background:#ffe9a6;opacity:0;animation:mmrise linear infinite;transform:rotate(45deg)}
@keyframes mmrise{0%{transform:translateY(0) rotate(45deg);opacity:0}10%{opacity:.7}100%{transform:translateY(-105vh) rotate(225deg);opacity:0}}
.v-home{animation:none!important}
@keyframes mmL{from{opacity:0;transform:translateX(-90px)}to{opacity:1;transform:none}}
@keyframes mmR{from{opacity:0;transform:translateX(90px)}to{opacity:1;transform:none}}
#mainMenu[data-view=home] .mm-stack>*{animation:mmL .6s cubic-bezier(.2,.8,.2,1) backwards}
#mainMenu[data-view=home] .mm-stack>:nth-child(2){animation-delay:.07s}#mainMenu[data-view=home] .mm-stack>:nth-child(3){animation-delay:.14s}#mainMenu[data-view=home] .mm-stack>:nth-child(4){animation-delay:.21s}#mainMenu[data-view=home] .mm-stack>:nth-child(5){animation-delay:.28s}
#mainMenu[data-view=home] .mm-char{animation:mmR .8s cubic-bezier(.2,.8,.2,1) backwards}
.mm-v{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;overflow-x:hidden;overflow-y:auto;padding:max(22px,env(safe-area-inset-top)) 16px max(22px,env(safe-area-inset-bottom));animation:mmin .38s ease both}
@keyframes mmin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
#mainMenu[data-view=home] .v-home,#mainMenu[data-view=slots] .v-slots,#mainMenu[data-view=settings] .v-settings,#mainMenu[data-view=controls] .v-controls,#mainMenu[data-view=cloud] .v-cloud{display:flex}
.mm-mid{margin:auto 0;width:100%;display:flex;flex-direction:column;align-items:center}
/* logo */
.mm-logo{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px;width:min(440px,100%);container-type:inline-size}
/* buttons */
.mm-logo-img{display:block;width:auto;height:auto;max-width:100%;max-height:min(31vh,300px);object-fit:contain;filter:drop-shadow(0 10px 22px rgba(0,0,0,.5));user-select:none;pointer-events:none}
.mm-stack{width:min(440px,100%);display:flex;flex-direction:column;gap:12px;margin-top:clamp(18px,4vmin,34px)}
.mm-btn{display:flex;align-items:center;gap:14px;width:100%;min-height:62px;padding:12px 20px;border-radius:18px;border:1px solid var(--line);background:var(--glass);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);text-align:left;font-weight:800;font-size:18px;letter-spacing:.08em;text-transform:uppercase;transition:transform .15s,box-shadow .15s,border-color .15s,background .15s}
.mm-btn .ic{font-size:24px;display:flex;color:var(--acc)}
.mm-btn small{display:block;font-weight:500;letter-spacing:.02em;text-transform:none;color:var(--mut);font-size:13px;margin-top:2px}
.mm-btn.primary{background:linear-gradient(135deg,#ffd45a,#ff9f1c);color:#1d1300;border-color:transparent;box-shadow:0 10px 30px rgba(255,159,28,.28)}
.mm-btn.primary .ic{color:#1d1300}.mm-btn.primary small{color:rgba(29,19,0,.7)}
[data-f].focus{border-color:var(--acc)!important;transform:translateY(-2px);box-shadow:0 0 0 3px rgba(255,203,61,.38),0 14px 34px rgba(0,0,0,.45)}
.mm-btn.primary.focus{box-shadow:0 0 0 3px rgba(255,255,255,.7),0 14px 34px rgba(255,159,28,.45)}
.mm-cont{align-items:center;padding:12px 16px}
.mm-cont .who{flex:1;min-width:0}
.mm-cont .nm{font-size:20px;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mm-cont .meta{font-weight:500;letter-spacing:0;text-transform:none;color:rgba(29,19,0,.75);font-size:13px;margin-top:3px;display:flex;gap:10px;flex-wrap:wrap}
.mm-cont .tag{font-size:11px;letter-spacing:.2em;opacity:.7}
.face{width:56px;height:56px;border-radius:16px;border:2px solid rgba(255,255,255,.55);background:#cfe3ff;image-rendering:pixelated;flex:none}
.mm-ctl{display:flex;align-items:center;gap:14px;width:100%;padding:12px 16px;border-radius:18px;border:1px solid var(--line);background:rgba(255,255,255,.04);cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s}
.mm-ctl .ic{font-size:24px;color:var(--acc2);display:flex}.mm-ctl .tx{flex:1;font-weight:700}.mm-ctl small{display:block;color:var(--mut);font-weight:500;font-size:12.5px;margin-top:2px}
.mm-sw{width:54px;height:32px;border-radius:99px;background:rgba(255,255,255,.2);position:relative;flex:none;transition:background .2s}
.mm-sw::after{content:"";position:absolute;top:4px;left:4px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.4);transition:transform .2s}
.mm-sw.on{background:var(--acc2)}.mm-sw.on::after{transform:translateX(22px)}
.mm-foot{margin-top:22px;color:var(--mut);font-size:12px;text-align:center;width:min(440px,100%)}
/* headers */
.mm-head{width:min(1040px,100%);display:flex;align-items:center;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.mm-head h2{margin:0;font-size:clamp(22px,4vmin,30px);letter-spacing:.04em}
.mm-head p{margin:2px 0 0;color:var(--mut);font-size:14px}
.mm-head .sp{flex:1}
.mm-round{width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:var(--glass);display:flex;align-items:center;justify-content:center;font-size:24px;transition:transform .15s,box-shadow .15s,border-color .15s}
.mm-head .mm-ctl{width:auto;min-width:270px;padding:8px 14px}
/* save slots */
.mm-slots{width:min(1040px,100%);display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.slot{position:relative;display:flex;flex-direction:column;border-radius:24px;background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);overflow:hidden;animation:mmin .4s ease both}
.slot-main{display:block;width:100%;flex:1;min-height:196px;padding:16px 16px 54px;text-align:left;background:none;border:2px solid transparent;border-radius:24px;transition:transform .15s,box-shadow .15s,border-color .15s,background .15s}
.slot-main.focus{background:rgba(255,203,61,.07);box-shadow:inset 0 0 0 1px var(--acc),0 0 36px rgba(255,203,61,.22)!important;transform:none}
.s-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.s-no{font-size:12px;font-weight:800;letter-spacing:.22em;color:var(--acc);background:rgba(255,203,61,.12);border-radius:99px;padding:4px 12px}
.s-time{display:flex;align-items:center;gap:6px;color:var(--mut);font-size:14px;font-weight:700}.s-time svg{font-size:16px}
.s-body{display:flex;gap:14px;align-items:center}
.s-info{min-width:0;flex:1}
.s-name{font-size:22px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.s-loc{display:flex;align-items:center;gap:6px;color:var(--mut);font-size:14px;margin-top:2px}.s-loc svg{font-size:16px;color:var(--acc2);flex:none}
.pips{display:flex;align-items:center;gap:5px;margin-top:9px}
.pip{width:14px;height:14px;border-radius:5px;transform:rotate(45deg) scale(.8);background:rgba(255,255,255,.14)}
.pip.on{background:linear-gradient(135deg,#ffe27a,#ff9f1c);box-shadow:0 0 10px rgba(255,170,30,.7)}
.party{display:flex;gap:2px;margin-top:12px;min-height:44px}
.pi{width:44px;height:44px;image-rendering:pixelated;border-radius:12px;background:rgba(255,255,255,.07)}
.s-last{position:absolute;left:18px;bottom:16px;right:112px;color:var(--mut);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.s-tools{position:absolute;right:10px;bottom:8px;display:flex;gap:6px}
.tool{width:40px;height:40px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:19px;transition:transform .15s,box-shadow .15s,border-color .15s}
.tool.danger{color:var(--danger)}
.slot.empty{border-style:dashed;background:rgba(255,255,255,.035)}
.slot.empty .slot-main{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px;color:var(--mut);padding-bottom:16px}
.slot.empty .s-top{width:100%;margin-bottom:6px}
.slot.empty .plus{width:60px;height:60px;border-radius:50%;border:2px dashed rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;font-size:28px;color:var(--ink);margin-bottom:4px}
.slot.empty b{color:var(--ink);letter-spacing:.14em;text-transform:uppercase;font-size:16px}
.slot.empty .s-tools{bottom:8px}
.slot.broken .s-name{color:var(--danger)}
/* cloud saves */
.cld-panel{width:min(900px,100%);display:flex;flex-direction:column;gap:12px}
.cld-acct{display:flex;align-items:center;gap:14px;flex-wrap:wrap;border-radius:22px;border:1px solid var(--line);background:var(--glass);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:14px 18px}
.cld-acct .ic{font-size:30px;color:var(--acc2)}.cld-acct .tx{flex:1;min-width:180px}.cld-acct .tx b{display:block}.cld-acct .tx small{color:var(--mut);font-size:13px}
.cld-btn{padding:10px 18px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.08);font-weight:700}
.cld-btn.pri{background:var(--acc);color:#1a1300;border-color:transparent}
.cld-btn:disabled{opacity:.5;pointer-events:none}
.cld-row{display:grid;grid-template-columns:70px 1fr 1fr auto;gap:12px;align-items:center;border-radius:20px;border:1px solid var(--line);background:var(--glass);padding:10px 14px}
.cld-n{font-size:12px;letter-spacing:.14em;color:var(--mut);font-weight:800}
.cld-c small{display:block;color:var(--mut);font-size:11px;letter-spacing:.12em;text-transform:uppercase}.cld-c b{display:block;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cld-c span{display:block;color:var(--mut);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cld-c.none b{color:var(--mut);font-weight:500}
.cld-b{display:flex;gap:6px}
.tool[disabled]{opacity:.28;pointer-events:none}
@media (max-width:640px){.cld-row{grid-template-columns:1fr 1fr;}.cld-n{grid-column:1/-1}.cld-b{grid-column:1/-1;justify-content:flex-end}}
/* dialog with text fields */
.dlg label{display:block;margin:10px 0 0;font-size:13px;color:var(--mut)}
.dlg input.mm-in{display:block;width:100%;margin:4px 0 0;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.08);color:var(--ink);font:inherit;font-size:14px;user-select:text;-webkit-user-select:text}
.dlg input.mm-in:focus{outline:2px solid var(--acc);outline-offset:1px}
.dlg p+label{margin-top:4px}.dlg .row{margin-top:16px}
/* controls */
.mm-cpanel{width:min(760px,100%);display:flex;flex-direction:column;gap:14px}
.cgrp{border-radius:22px;border:1px solid var(--line);background:var(--glass);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:16px 20px}
.cgrp h3{margin:0 0 8px;font-size:14px;letter-spacing:.16em;text-transform:uppercase;color:var(--acc);display:flex;gap:10px;align-items:center}.cgrp h3 svg{font-size:20px}
.cl{display:flex;align-items:center;gap:16px;padding:9px 0;border-top:1px solid rgba(255,255,255,.07)}.cl:first-of-type{border-top:0}
.cl .ks{display:flex;gap:6px;flex-wrap:wrap;width:210px;flex:none}
.cl b{min-width:34px;text-align:center;padding:3px 10px;border-radius:8px;background:rgba(255,255,255,.1);border:1px solid var(--line);box-shadow:0 2px 0 rgba(0,0,0,.35);font-size:13px;font-weight:800}
.cl span+span{color:var(--mut)}
.mm-cpanel>.mm-ctl{background:var(--glass)}
@media (max-width:560px){.cl{flex-direction:column;align-items:flex-start;gap:6px}.cl .ks{width:auto}}
/* settings */
.mm-panel{width:min(640px,100%);border-radius:24px;border:1px solid var(--line);background:var(--glass);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);padding:10px}
.set-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-radius:16px;border:1px solid transparent;cursor:default;transition:transform .15s,box-shadow .15s,border-color .15s}
.set-row+.set-row{margin-top:4px}
.set-row .lbl{font-weight:700}.set-row small{display:block;color:var(--mut);font-weight:500;font-size:12.5px;margin-top:2px}
.set-row .ctl{display:flex;align-items:center;gap:12px}
.set-row output{min-width:44px;text-align:right;font-weight:800;color:var(--acc);font-variant-numeric:tabular-nums}
#mainMenu input[type=range]{width:min(210px,38vw);height:32px;accent-color:var(--acc);cursor:pointer;background:transparent}
.seg{display:flex;gap:3px;padding:3px;border-radius:13px;background:rgba(255,255,255,.09)}
.seg button{min-width:48px;min-height:40px;padding:6px 12px;border-radius:10px;border:0;background:none;color:var(--mut);font-weight:800}
.seg button.on{background:var(--acc);color:#1d1300}
.mm-mini{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:6px 14px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.08);font-weight:800}
.mm-fs{position:absolute;top:max(14px,env(safe-area-inset-top));right:max(14px,env(safe-area-inset-right));z-index:3;opacity:.75}
.mm-fs:hover{opacity:1;border-color:var(--acc)}
/* dialog + toast */
.mm-dlg{position:absolute;inset:0;z-index:6;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(5,8,18,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.mm-dlg.open{display:flex;animation:mmin .2s ease both}
.dlg{width:min(420px,100%);border-radius:24px;padding:24px;background:#141d3a;border:1px solid var(--line);box-shadow:0 30px 80px rgba(0,0,0,.6)}
.dlg h3{margin:0 0 8px;font-size:20px;display:flex;align-items:center;gap:10px}.dlg h3 svg{color:var(--danger);font-size:24px}
.dlg p{margin:0 0 20px;color:var(--mut)}
.dlg .row{display:flex;gap:10px}.dlg .row button{flex:1;min-height:50px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.08);font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.dlg .row button.danger{background:var(--danger);border-color:transparent;color:#fff}
.mm-toast{position:absolute;left:50%;bottom:max(24px,env(safe-area-inset-bottom));transform:translate(-50%,30px);opacity:0;z-index:7;max-width:calc(100% - 32px);padding:12px 20px;border-radius:99px;background:#1b274d;border:1px solid var(--line);box-shadow:0 14px 40px rgba(0,0,0,.5);font-weight:700;pointer-events:none;transition:opacity .25s,transform .25s;text-align:center}
.mm-toast.show{opacity:1;transform:translate(-50%,0)}
@media (max-width:560px){.mm-head .mm-ctl{width:100%;min-width:0}.mm-slots{grid-template-columns:1fr}.mm-btn{font-size:16px}}
@media (prefers-reduced-motion:reduce){#mainMenu *{animation:none!important;transition:none!important}}
@media (prefers-reduced-motion:reduce){#mainMenu[data-view=home] .mm-stack>*{animation:mmL .6s cubic-bezier(.2,.8,.2,1) backwards!important}#mainMenu[data-view=home] .mm-char{animation:mmR .8s cubic-bezier(.2,.8,.2,1) backwards!important}}
/* ---- the original game boxes (grey / white frame, dark glass fill, corner highlights; blue + purple when selected), redrawn in CSS so they stay crisp at any size ---- */
.mm-btn,.mm-ctl,.slot,.slot.empty,.slot.broken,.mm-panel,.cgrp,.dlg,.mm-round,.tool,.dlg .row button,.set-row.focus{
  --pr1:#606060;--pr2:#e8e8e8;--pr3:#606060;--pst:rgba(44,44,44,.86);--pfill:rgba(24,24,24,.84);--ptri:rgba(80,80,80,.86);--u:2px;
  border:0;border-image:none;border-radius:0;-webkit-backdrop-filter:none;backdrop-filter:none;
  background:linear-gradient(135deg,var(--ptri) 0 50%,transparent 50%) no-repeat calc(var(--u)*9) calc(var(--u)*9)/calc(var(--u)*11) calc(var(--u)*11) border-box,
             linear-gradient(315deg,var(--ptri) 0 50%,transparent 50%) no-repeat calc(100% - var(--u)*9) calc(100% - var(--u)*9)/calc(var(--u)*11) calc(var(--u)*11) border-box,
             var(--pfill);
  box-shadow:inset 0 0 0 calc(var(--u)*2) var(--pr1),inset 0 0 0 calc(var(--u)*5) var(--pr2),inset 0 0 0 calc(var(--u)*7) var(--pr3),inset 0 0 0 calc(var(--u)*9) var(--pst)}
.mm-round,.tool,.dlg .row button,.set-row.focus{--u:1px}
.mm-btn.focus,.mm-ctl.focus,.slot:has(.slot-main.focus),.mm-round.focus,.mm-round:hover,.tool.focus,.dlg .row button.focus,.set-row.focus{--pr1:#003e92;--pr2:#0082ff;--pr3:#003e92;--pst:rgba(60,50,110,.92);--pfill:rgba(60,50,110,.92);--ptri:rgba(104,104,150,.92);transform:none}
.mm-btn[data-f].focus,.mm-ctl[data-f].focus,.slot [data-f].focus,.mm-round[data-f].focus,.tool[data-f].focus,.dlg .row button[data-f].focus,.set-row[data-f].focus,.slot:has(.slot-main.focus){transform:none;box-shadow:inset 0 0 0 calc(var(--u)*2) var(--pr1),inset 0 0 0 calc(var(--u)*5) var(--pr2),inset 0 0 0 calc(var(--u)*7) var(--pr3),inset 0 0 0 calc(var(--u)*9) var(--pst)!important}
.slot [data-f].focus{box-shadow:none!important}
.mm-btn,.mm-ctl{min-height:0;padding:14px 28px}
.mm-btn{font-family:PkmnEms,"Segoe UI",system-ui,sans-serif;font-weight:400;font-size:24px;letter-spacing:.03em;text-shadow:2px 2px 0 #383838}
.mm-btn small{font-family:"Segoe UI",system-ui,sans-serif;font-size:13px;letter-spacing:.01em;text-shadow:none;color:#b9c2d6}
.mm-btn .ic{color:#f8f8f8}
.mm-btn.primary,.mm-btn.primary.focus{color:var(--ink)}
.mm-btn.primary .ic{color:var(--acc)}.mm-btn.primary small{color:#b9c2d6}
.mm-btn.primary,.mm-btn.primary.focus{background:linear-gradient(135deg,var(--ptri) 0 50%,transparent 50%) no-repeat calc(var(--u)*9) calc(var(--u)*9)/calc(var(--u)*11) calc(var(--u)*11) border-box,linear-gradient(315deg,var(--ptri) 0 50%,transparent 50%) no-repeat calc(100% - var(--u)*9) calc(100% - var(--u)*9)/calc(var(--u)*11) calc(var(--u)*11) border-box,var(--pfill);box-shadow:inset 0 0 0 calc(var(--u)*2) var(--pr1),inset 0 0 0 calc(var(--u)*5) var(--pr2),inset 0 0 0 calc(var(--u)*7) var(--pr3),inset 0 0 0 calc(var(--u)*9) var(--pst);border:0}
.mm-btn.primary .ic,.mm-cont .meta,.mm-btn.primary small{color:#b9c2d6}.mm-btn.primary .ic{color:var(--acc)}
.mm-cont{padding:14px 28px}.mm-cont .nm{font-size:28px;text-shadow:2px 2px 0 #383838}.mm-cont .tag{color:var(--acc);opacity:1;font-family:"Segoe UI",system-ui,sans-serif;text-shadow:none}
.mm-cont .meta{color:#b9c2d6}
.mm-ctl{cursor:pointer}
.mm-head h2{font-family:PkmnEms,"Segoe UI",system-ui,sans-serif;font-weight:400;font-size:clamp(28px,4.6vmin,36px);letter-spacing:.03em;text-shadow:2px 2px 0 #383838}
.mm-round{width:50px;height:50px}.tool{width:46px;height:46px}.tool.danger{color:#ff8593}
.slot{overflow:visible;padding:20px 26px 18px}
.slot-main{border:0;border-radius:0;background:none;padding:0 0 46px;min-height:140px}
.slot-main.focus{background:none;box-shadow:none!important}
.slot.empty .slot-main{padding-bottom:10px}
.s-no{font-family:PkmnEms,"Segoe UI",system-ui,sans-serif;font-weight:400;font-size:19px;letter-spacing:.05em;color:var(--acc);background:rgba(0,0,0,.35);border-radius:0;padding:1px 10px;text-shadow:none}
.s-name{font-family:PkmnEms,"Segoe UI",system-ui,sans-serif;font-weight:400;font-size:28px;letter-spacing:.03em;text-shadow:2px 2px 0 #383838}
.s-last{left:28px;bottom:24px;right:120px}.s-tools{right:24px;bottom:18px}
.pi{border-radius:0;background:rgba(0,0,0,.25)}
.slot.empty b{font-family:PkmnEms,"Segoe UI",system-ui,sans-serif;font-weight:400;font-size:24px;letter-spacing:.04em;text-shadow:2px 2px 0 #383838}
.mm-panel{padding:20px 22px}
.set-row{border:0;border-radius:0;padding:8px 14px}
.set-row .lbl{font-family:PkmnEms,"Segoe UI",system-ui,sans-serif;font-weight:400;font-size:22px;letter-spacing:.03em;text-shadow:2px 2px 0 #383838}
.set-row small{font-family:"Segoe UI",system-ui,sans-serif;text-shadow:none;letter-spacing:0}
.cgrp{padding:20px 28px 14px}
.cgrp h3{font-family:PkmnEms,"Segoe UI",system-ui,sans-serif;font-weight:400;font-size:21px;letter-spacing:.05em;text-shadow:2px 2px 0 #383838}
.dlg{width:min(480px,100%);padding:26px 30px 24px}
.dlg h3{font-family:PkmnEms,"Segoe UI",system-ui,sans-serif;font-weight:400;font-size:24px;text-shadow:2px 2px 0 #383838}
.dlg .row button{padding:10px 14px;font-family:PkmnEms,"Segoe UI",system-ui,sans-serif;font-weight:400;font-size:22px;letter-spacing:.04em;text-shadow:2px 2px 0 #383838}
.dlg .row button.danger{color:#ff8593}
.mm-btn small,.mm-cont .tag,.mm-cont .meta,.s-last,.s-time,.s-loc,.slot small,.set-row small,.cgrp,.mm-head p,.mm-foot,.dlg p,.toast,#mainMenu input,#mainMenu .seg button{font-family:PkmnEms,"Segoe UI",system-ui,sans-serif!important}
#mainMenu,#mainMenu *{font-family:PkmnEms,"Segoe UI",system-ui,sans-serif!important;font-weight:400!important}
#mainMenu small,#mainMenu .meta,#mainMenu p,#mainMenu .s-last{letter-spacing:.02em;font-size:15px}
/* short screens (phones held sideways): shrink the menu panels so everything fits; --mmz is set from the window height */
#mainMenu .mm-stack,#mainMenu .v-slots,#mainMenu .v-settings,#mainMenu .v-controls,#mainMenu .v-cloud{zoom:var(--mmz,1)}
/* landscape layout is left-aligned and only .mm-stack is zoomed: give the logo and footer the stack's on-screen width so they share its centre */
@media (min-aspect-ratio:5/4){#mainMenu .v-home .mm-logo,#mainMenu .v-home .mm-foot{width:calc(min(440px,100%)*var(--mmz,1))}}
/* build version, bottom right of the main menu */
.mm-ver{position:absolute;right:max(14px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));z-index:2;display:none;color:var(--mut);font-size:15px;letter-spacing:.04em;opacity:.85;text-shadow:2px 2px 0 #383838;pointer-events:none;white-space:nowrap}
#mainMenu[data-view=home] .mm-ver{display:block}
`;

function mmEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
// same eight badge items as the trainer card (engine.js BADGE_ITEMS): an item in the bag, or its switch
const MM_BADGE_ITEMS = [['PAYSAFECARD'], ['ONLYFANSCARD'], ['S23NILOU'], ['MIXTAPE', 263], ['SURVIVALKNIFE', 212], ['FIREEXTINGUISHER'], ['SAPPHIRE'], ['PRIMOGEMS', 980]]   // badge order: Tiagovski, Miss Mushrooms, Nuno Agonia, Wuant, LegendBoy, D4rkFrame, SirKazzio, John Oyohim;
function mmBadges(save) { return MM_BADGE_ITEMS.filter(b => (save.items && save.items[b[0]] > 0) || (b[1] && save.switches && save.switches[b[1]])).length; }

// reads one slot: { n, empty } | { n, broken } | { n, save }
function mmSlot(n) {
  let raw = null; try { raw = localStorage.getItem(slotKey(n)); } catch (e) { }
  if (!raw) return { n, empty: true };
  let d = null; try { d = JSON.parse(raw); } catch (e) { }
  if (!validSaveData(d)) return { n, broken: true };
  try { migrateSyms(d); } catch (e) { }
  return { n, save: d };
}
function mmAllSlots() { const a = []; for (let n = 1; n <= SAVE_SLOTS; n++) a.push(mmSlot(n)); return a; }
// the signed-in Google account is shown masked (parazoni@gmail.com -> p*****i@gmail.com), so screenshots and streams do not leak it
function mmMaskEmail(e) { e = String(e || ''); const at = e.lastIndexOf('@'); if (at < 1) return ''; const u = e.slice(0, at); return (u.length > 1 ? u[0] + '*****' + u[u.length - 1] : u + '*****') + e.slice(at); }
function mmDate(t) { if (!t) return ''; try { return new Date(t).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }

class MainMenu {
  constructor() { this.view = 'home'; this.focused = null; this.result = null; this.done = false; this.dlg = null; this.toastT = 0; this.prevView = 'home'; }

  // ------------------------------------------------------------ build
  open() {
    if (!document.getElementById('mmStyle')) { const st = document.createElement('style'); st.id = 'mmStyle'; st.textContent = MM_CSS; document.head.appendChild(st); }
    const old = document.getElementById('mainMenu'); if (old) old.remove();
    const root = this.root = document.createElement('div'); root.id = 'mainMenu'; root.dataset.view = 'home';
    const fitMenu = () => { root.style.setProperty('--mmz', String(Math.max(0.5, Math.min(1, innerHeight / 820)))); };
    if (this._fit) removeEventListener('resize', this._fit); this._fit = fitMenu; addEventListener('resize', fitMenu); fitMenu();
    const sparks = Array.from({ length: 14 }, (_, i) => '<i class="mm-spark" style="left:' + ((i * 47) % 100) + '%;animation-duration:' + (9 + (i * 5) % 11) + 's;animation-delay:-' + ((i * 3) % 13) + 's;width:' + (4 + i % 4) + 'px;height:' + (4 + i % 4) + 'px"></i>').join('');
    const cl = (ks, d) => '<div class="cl"><span class="ks">' + ks.map(k => '<b>' + k + '</b>').join('') + '</span><span>' + d + '</span></div>';
    const ctl = (extra = '') => '<div class="mm-ctl" data-f data-act="toggle" data-k="touch" data-adj="touch" ' + extra + '><span class="ic">' + MM_ICON.pad + '</span><span class="tx">On-screen controller<small>Touch buttons for phones and tablets</small></span><span class="mm-sw" data-sw="touch"></span></div>';
    root.innerHTML =
      '<div class="mm-bg"><div class="mm-photo"></div><div class="mm-shade"></div><img class="mm-char" src="assets/ui/menu_char.png" alt="" draggable="false">' + sparks + '</div>' +
      (mmNative() ? '' : '<button class="mm-round mm-fs" data-act="fs" title="Fullscreen" aria-label="Fullscreen">' + MM_ICON.full + '</button>') +
      // home
      '<section class="mm-v v-home"><div class="mm-mid"><div class="mm-logo"><img class="mm-logo-img" src="assets/ui/menu_logo.png" alt="Pokémon JBA Version" draggable="false"></div>' +
      '<div class="mm-stack"><div class="home-cont"></div>' +
      '<button class="mm-btn" data-f data-act="play" data-main><span class="ic">' + MM_ICON.play + '</span><span>Save files<small>Open a save or start a new adventure</small></span></button>' +
      '<button class="mm-btn" data-f data-act="settings"><span class="ic">' + MM_ICON.gear + '</span><span>Settings<small>Volume, speed, display</small></span></button>' +
      '<button class="mm-btn" data-f data-act="dex"><span class="ic">' + MM_ICON.dex + '</span><span>Pokédex<small>Every Pokémon, where to find it, and your progress</small></span></button>' +
      '<button class="mm-btn" data-f data-act="cloud" data-cloudbtn><span class="ic">' + MM_ICON.cloud + '</span><span>Cloud saves<small>Back up and restore your saves with Google Drive</small></span></button>' +
      '<button class="mm-btn" data-f data-act="controls"><span class="ic">' + MM_ICON.pad + '</span><span>Controls<small>Keyboard, controller and touch screen</small></span></button></div>' +
      '<div class="mm-foot">Unofficial, non-commercial fan project. Pokémon is owned by Nintendo, Game Freak and The Pokémon Company.</div></div></section>' +
      // slots
      '<section class="mm-v v-slots"><div class="mm-head"><button class="mm-round" data-f data-act="back" aria-label="Back">' + MM_ICON.back + '</button><div><h2>Choose your save file</h2><p>Open a file to continue, or pick an empty slot to start a new game.</p></div></div>' +
      '<div class="mm-slots"></div></section>' +
      // cloud saves
      '<section class="mm-v v-cloud"><div class="mm-head" style="width:min(900px,100%)"><button class="mm-round" data-f data-act="back" aria-label="Back">' + MM_ICON.back + '</button><div><h2>Cloud saves</h2><p>Upload your saves to your own Google Drive and download them on any device.</p></div></div><div class="cld-panel"></div></section>' +
      // settings
      '<section class="mm-v v-settings"><div class="mm-head" style="width:min(640px,100%)"><button class="mm-round" data-f data-act="back" aria-label="Back">' + MM_ICON.back + '</button><div><h2>Settings</h2><p>Saved automatically in this browser.</p></div></div>' +
      '<div class="mm-panel">' +
      '<div class="set-row" data-f data-adj="music"><span class="lbl">Music volume</span><span class="ctl"><input type="range" min="0" max="20" step="1" data-range="music"><output data-out="music"></output></span></div>' +
      '<div class="set-row" data-f data-adj="sfx"><span class="lbl">Sound effects</span><span class="ctl"><input type="range" min="0" max="20" step="1" data-range="sfx"><output data-out="sfx"></output></span></div>' +
      '<div class="set-row" data-f data-adj="speed" data-act="cycle" data-k="speed"><span class="lbl">Game speed</span><span class="seg">' + (typeof SPEEDS !== 'undefined' ? SPEEDS : [1, 1.5, 2, 3]).map(v => '<button data-act="set" data-k="speed" data-v="' + v + '">' + v + 'x</button>').join('') + '</span></div>' +
      '<div class="set-row" data-f data-adj="bars" data-act="toggle" data-k="bars"><span class="lbl">Side bars<small>Backdrop image around the game screen</small></span><span class="seg"><button data-act="set" data-k="bars" data-v="1">Image</button><button data-act="set" data-k="bars" data-v="0">Black</button></span></div>' +
      '<div class="set-row" data-f data-adj="lang" data-act="lang"><span class="lbl">Language</span><span class="seg"><button data-act="lang" data-v="-1">◀</button><button class="on" data-langname data-act="lang" data-v="1"></button><button data-act="lang" data-v="1">▶</button></span></div>' +
      (mmNative() ? '' : '<div class="set-row" data-f data-act="fs"><span class="lbl">Fullscreen</span><span class="mm-mini">' + MM_ICON.full + ' Toggle</span></div>') +
      '<div class="set-row" data-f data-act="update"><span class="lbl">Updates<small data-upd>Optional. Looks for a newer release on GitHub (needs internet).</small></span><span class="mm-mini" data-updbtn>Check</span></div>' +
      '</div></section>' +
      // controls
      '<section class="mm-v v-controls"><div class="mm-head" style="width:min(760px,100%)"><button class="mm-round" data-f data-act="back" aria-label="Back">' + MM_ICON.back + '</button><div><h2>Controls</h2><p>How to play with each kind of input.</p></div></div>' +
      '<div class="mm-cpanel">' + ctl() +
      '<div class="cgrp"><h3>' + MM_ICON.pad + 'Keyboard &amp; mouse</h3>' +
        cl(['↑ ↓ ← →', 'W A S D'], 'Move') + cl(['Z', 'Enter', 'Space'], 'Confirm, talk, interact') + cl(['X'], 'Cancel (hold to run, once you have the sneakers)') + cl(['Shift'], 'Sprint') +
        cl(['Esc', 'M', 'Tab'], 'Open the menu, or go back') + cl(['C'], 'Skateboard · Mega Evolution in battle') + cl(['Mouse'], 'Click through the menus. In the game, click the on-screen controller buttons.') + '</div>' +
      '<div class="cgrp"><h3>' + MM_ICON.pad + 'Controller</h3>' +
        cl(['D-pad', 'Left stick'], 'Move') + cl(['A'], 'Confirm, talk, interact') + cl(['B'], 'Cancel (hold to run)') + cl(['X', 'Start', 'Select'], 'Open the menu · X is also Mega Evolution in battle') + cl(['LB', 'RB'], 'Skateboard') + cl(['Y'], 'Fullscreen') + '</div>' +
      '<div class="cgrp"><h3>' + MM_ICON.pad + 'Touch screen</h3>' +
        cl(['Stick'], 'Move (left side of the screen)') + cl(['A'], 'Confirm, talk, interact') + cl(['B'], 'Cancel (hold to run)') + cl(['X'], 'Open the menu · Mega Evolution in battle') + cl(['LB', 'RB'], 'Skateboard') + cl(['Y'], 'Fullscreen') + '</div>' +
      '</div></section>' +
      '<div class="mm-ver" data-ver></div><div class="mm-dlg"></div><div class="mm-toast"></div>';
    // Cloud saves are for the Windows and Android apps. In the browser they only show when js/cloud-config.js sets showInBrowser: true.
    { const m = CLOUD.mode(); if (!(m === 'desktop' || (m === 'web' && window.CLOUD_CFG && CLOUD_CFG.showInBrowser))) { const cb = root.querySelector('[data-cloudbtn]'); if (cb) cb.remove(); } }
    document.body.appendChild(root);
    this.bind(); this.sync(); this.go('home');
    try { playBGM('frlg_title', 0.6); } catch (e) { }   // if the browser blocks autoplay, the engine starts it on the first click / key press
  }

  bind() {
    const root = this.root;
    root.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el || !root.contains(el) || this.done) return; this.act(el); });
    root.addEventListener('pointerover', e => { const f = e.target.closest('[data-f]'); if (f && f !== this.focused && this.focusables().includes(f)) this.setFocus(f); });
    root.addEventListener('input', e => { const r = e.target.closest('[data-range]'); if (r) { this.setVol(r.dataset.range, (+r.value) / 20); } });
  }
  destroy() { if (this.root) this.root.remove(); }

  // ------------------------------------------------------------ views
  go(view, focusSel) {
    this.prevView = this.view; this.view = view; this.root.dataset.view = view;
    if (view === 'slots') this.renderSlots();
    if (view === 'home') this.renderHomeContinue();
    if (view === 'cloud') this.renderCloud();
    this.sync();
    const list = this.focusables(); let f = focusSel && list.find(el => el.matches(focusSel));
    if (!f) f = view === 'home' ? (list.find(el => el.dataset.act === 'continue') || list.find(el => el.hasAttribute('data-main'))) : view === 'settings' ? (list.find(el => el.classList.contains('set-row')) || list[0]) : list[0];
    this.setFocus(f || null);
    const sc = this.root.querySelector('.mm-v.v-' + view); if (sc) sc.scrollTop = 0;
  }
  renderHomeContinue() {
    const box = this.root.querySelector('.home-cont'); box.innerHTML = '';
    let best = null; for (const s of mmAllSlots()) if (s.save && (!best || (s.save.t || 0) > (best.save.t || 0))) best = s;
    if (!best) return;
    const sv = best.save;
    box.innerHTML = '<button class="mm-btn primary mm-cont" data-f data-act="continue" data-n="' + best.n + '"><span class="who"><span class="tag">' + mmEsc(__('CONTINUE · SLOT {0}', best.n)) + '</span><div class="nm">' + mmEsc(sv.name) + '</div><div class="meta"><span>' + mmEsc(mapNameOf(sv.map)) + '</span><span>' + fmtTime(sv.playFrames || 0) + ' h</span><span>' + mmEsc(mmBadges(sv) === 1 ? __('{0} badge', mmBadges(sv)) : __('{0} badges', mmBadges(sv))) + '</span></div></span><span class="ic">' + MM_ICON.play + '</span></button>';
    this.paint(box);
  }
  renderSlots() {
    const grid = this.root.querySelector('.mm-slots'); const keep = this.focused && this.focused.dataset.n && this.focused.dataset.act;
    const lastN = this.lastSlot();
    grid.innerHTML = mmAllSlots().map((s, i) => {
      const n = s.n, no = '<span class="s-no">SLOT ' + n + '</span>', st = ' style="animation-delay:' + (i * 45) + 'ms"';
      if (s.empty) return '<div class="slot empty"' + st + '><button class="slot-main" data-f data-act="new" data-n="' + n + '"><div class="s-top">' + no + '<span></span></div><span class="plus">' + MM_ICON.plus + '</span><b>New game</b><span>Empty slot</span></button><div class="s-tools"><button class="tool" data-f data-act="import" data-n="' + n + '" title="Import a save file" aria-label="Import a save file into slot ' + n + '">' + MM_ICON.up + '</button></div></div>';
      if (s.broken) return '<div class="slot broken"' + st + '><button class="slot-main" data-f data-act="none" data-n="' + n + '"><div class="s-top">' + no + '<span></span></div><div class="s-body"><span class="face" style="display:flex;align-items:center;justify-content:center;font-size:28px;color:var(--danger)">' + MM_ICON.warn + '</span><div class="s-info"><div class="s-name">Damaged file</div><div class="s-loc">This save could not be read.</div></div></div></button><div class="s-tools"><button class="tool danger" data-f data-act="delete" data-n="' + n + '" title="Delete" aria-label="Delete slot ' + n + '">' + MM_ICON.trash + '</button></div></div>';
      const sv = s.save, b = mmBadges(sv);
      const pips = Array.from({ length: MM_BADGE_PIPS }, (_, k) => '<i class="pip' + (k < b ? ' on' : '') + '"></i>').join('');
      const party = (sv.party || []).slice(0, 6).map(p => '<canvas class="pi" width="64" height="64" data-sym="' + mmEsc(p.sym) + '"></canvas>').join('');
      return '<div class="slot"' + st + '><button class="slot-main" data-f data-act="open" data-n="' + n + '"><div class="s-top">' + no + '<span class="s-time">' + MM_ICON.clock + fmtTime(sv.playFrames || 0) + '</span></div>' +
        '<div class="s-body"><div class="s-info"><div class="s-name">' + mmEsc(sv.name) + '</div><div class="s-loc">' + MM_ICON.pin + '<span>' + mmEsc(mapNameOf(sv.map)) + '</span></div><div class="pips" title="' + b + ' badges">' + pips + '</div></div></div>' +
        '<div class="party">' + party + '</div><div class="s-last">' + mmEsc(n === lastN ? __('Last played · {0}', mmDate(sv.t)) : __('Saved {0}', mmDate(sv.t))) + '</div></button>' +
        '<div class="s-tools"><button class="tool" data-f data-act="export" data-n="' + n + '" title="Export to a file" aria-label="Export slot ' + n + '">' + MM_ICON.down + '</button><button class="tool danger" data-f data-act="delete" data-n="' + n + '" title="Delete" aria-label="Delete slot ' + n + '">' + MM_ICON.trash + '</button></div></div>';
    }).join('');
    this.paint(grid);
    if (keep) { const f = grid.querySelector('[data-act="' + keep + '"][data-n="' + this.focused.dataset.n + '"]') || grid.querySelector('.slot-main'); if (f) this.setFocus(f); }
  }
  lastSlot() { let n = 0; try { n = parseInt(localStorage.getItem(LAST_SLOT_KEY), 10) || 0; } catch (e) { } return n; }
  // party icons are drawn straight from the game's images (no pixel reads, so this also works from file://).
  // Icons that were not preloaded are fetched on demand by img(), so keep retrying for a few seconds until they arrive.
  paint(scope, tries = 0) {
    let waiting = 0;
    scope.querySelectorAll('canvas[data-sym]').forEach(c => {
      if (c.dataset.done) return;
      const sym = c.dataset.sym, sp = D.SP[typeof symOf === 'function' ? symOf(sym) : sym];
      let im = sp ? img('battlersicons', 'icon' + sprKey(sp)) : null;
      if (sp && !im && tries < 24) { waiting++; return; }
      if (!im) im = img('battlersicons', 'icon000');
      if (!im) { waiting++; return; }
      const fw = im.width >= 128 ? im.width / 2 : im.width, fh = im.height, k = Math.min(1, 64 / fw, 64 / fh), w = fw * k, h = fh * k, g = c.getContext('2d');
      g.clearRect(0, 0, 64, 64); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, fw, fh, (64 - w) / 2, 64 - h, w, h); c.dataset.done = '1';
    });
    if (waiting && tries < 26 && scope.isConnected) setTimeout(() => this.paint(scope, tries + 1), 250);
  }

  // ------------------------------------------------------------ focus / navigation
  focusables() {
    const scope = this.dlg ? this.root.querySelector('.mm-dlg') : this.root.querySelector('.mm-v.v-' + this.view);
    return scope ? Array.from(scope.querySelectorAll('[data-f]')).filter(el => el.offsetParent !== null) : [];
  }
  setFocus(el) {
    if (this.focused) this.focused.classList.remove('focus');
    this.focused = el || null; if (el) { el.classList.add('focus'); try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { } }
  }
  nav(dir) {
    if (this.done) return;
    const list = this.focusables(); if (!list.length) return;
    let cur = this.focused; if (!cur || !list.includes(cur)) { this.setFocus(list[0]); return; }
    if ((dir === 'left' || dir === 'right') && cur.dataset.adj) { this.adjust(cur.dataset.adj, dir === 'left' ? -1 : 1); return; }
    const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let best = null, bs = 1e9;
    for (const el of list) {
      if (el === cur) continue; const b = el.getBoundingClientRect(), x = b.left + b.width / 2 - cx, y = b.top + b.height / 2 - cy;
      const main = dir === 'left' ? -x : dir === 'right' ? x : dir === 'up' ? -y : y, cross = dir === 'left' || dir === 'right' ? Math.abs(y) : Math.abs(x);
      if (main < 4) continue; const sc = main + cross * 2.2; if (sc < bs) { bs = sc; best = el; }
    }
    if (best) { this.setFocus(best); sfx('cursor'); }
    else if ((dir === 'up' || dir === 'down') && !this.dlg) {   // nothing to focus that way (e.g. the Controls page): scroll the page so the pad can read all of it
      const v = this.root.querySelector('.mm-v.v-' + this.view);
      if (v && v.scrollHeight > v.clientHeight + 2) { const before = v.scrollTop; v.scrollTop += (dir === 'up' ? -1 : 1) * Math.max(60, Math.round(v.clientHeight * 0.25)); if (v.scrollTop !== before) sfx('cursor'); }
    }
  }
  pump() {   // called every frame by titleScreen(): keyboard + gamepad go through the game's own input flags
    if (this.done) return;
    for (const k of ['up', 'down', 'left', 'right']) if (rep(k)) this.nav(k);
    if (ok()) { if (this.focused) this.act(this.focused); } else if (back()) this.goBack();
  }
  goBack() {
    if (this.dlg) { this.closeDlg(false); sfx('back'); return; }
    if (this.view === 'slots' || this.view === 'settings' || this.view === 'controls' || this.view === 'cloud') { sfx('back'); this.go('home', '[data-act="' + (this.view === 'slots' ? 'play' : this.view) + '"]'); }
  }

  // ------------------------------------------------------------ actions
  // Pokédex guide (POKEDEX.html). It reads the last save from the same browser storage, so it works next to the running game.
  //   Browser: opens in a new tab.  Windows app: a new window (dist-tools/desktop/main.js).
  //   Android app: on the second screen when the device has one (AYN Thor...), otherwise on top of the game (dist-tools/android-src/DexPlugin.java).
  openDex() {
    sfx('ok');
    try { jbaPlugin('Dex').open({}).then(r => { if (r && r.info) this.toast('Pokédex: ' + r.how + ' · ' + r.info); }, () => this.toast('The Pokédex could not be opened.')); return; } catch (e) { }
    const w = window.open('POKEDEX.html', 'jba_pokedex');
    if (!w) return this.toast('Allow pop-ups for this page to open the Pokédex.');
    try { w.focus(); } catch (e) { }
  }
  act(el) {
    const d = el.dataset, a = d.act;
    switch (a) {
      case 'continue': case 'open': { const s = mmSlot(+d.n); if (!s.save) return this.toast('That save could not be read.'); sfx('ok'); this.openSlot(s); break; }
      case 'new': sfx('ok'); this.choose({ type: 'new', slot: +d.n }); break;
      case 'play': sfx('ok'); this.go('slots', '.slot-main'); { const l = this.focusables(); const pick = l.find(e => e.dataset.n == this.lastSlot() && e.classList.contains('slot-main')) || l.find(e => e.dataset.act === 'new') || l[0]; this.setFocus(pick || null); } break;
      case 'settings': sfx('ok'); this.go('settings'); break;
      case 'dex': this.openDex(); break;
      case 'controls': sfx('ok'); this.go('controls'); break;
      case 'cloud': sfx('ok'); this.go('cloud'); break;
      case 'cl-in': this.clSignIn(); break;
      case 'cl-auto': CLOUD.setAuto(!CLOUD.autoOn()); sfx('ok'); this.clKeep = null; this.toast(CLOUD.autoOn() ? __('Automatic upload is ON.') : __('Automatic upload is OFF.')); this.renderCloud(); break;
      case 'cl-cfg': this.clCfg(); break;
      case 'cl-retry': this.renderCloud(); break;
      case 'cl-out': this.clSignOut(); break;
      case 'cl-up': this.clUp(+d.n); break;
      case 'cl-down': this.clDown(+d.n); break;
      case 'cl-del': this.clDel(+d.n); break;
      case 'back': this.goBack(); break;
      case 'fs': sfx('ok'); toggleFullscreen(); break;
      case 'update': this.checkUpdate(); break;
      case 'toggle': this.adjust(d.k, 0); break;
      case 'cycle': this.adjust('speed', 1); break;
      case 'lang': this.adjust('lang', d.v ? +d.v : 1); break;
      case 'set': this.setSetting(d.k, +d.v); break;
      case 'export': { const r = exportSaveFile(+d.n);
        if (r && typeof r.then === 'function') {   // Android app: saved by the native plugin, so the answer comes a moment later
          r.then(o => { sfx('ok'); this.toast(__('Saved {0} in your {1} folder', o.name, o.where)); }, e => { sfx('buzzer'); this.toast(/not implemented|not available/i.test(String((e && e.message) || e)) ? 'Update the app to export saves.' : 'Could not save the file: ' + String((e && e.message) || e).replace(/^Could not save the file: /, '')); });
          break;
        }
        sfx(r ? 'ok' : 'buzzer'); this.toast(r === null ? 'Nothing to export.' : r === false ? 'That save is damaged and could not be exported.' : __('Exported {0}', r)); break; }
      case 'import': sfx('ok'); this.importInto(+d.n); break;
      case 'delete': sfx('ok'); this.confirmDelete(+d.n); break;
      case 'dlg-yes': if (this.dlg && this.dlg.collect) this.dlg.vals = this.dlg.collect(); this.closeDlg(true); break;
      case 'dlg-no': sfx('back'); this.closeDlg(false); break;
    }
  }
  choose(r) { if (this.done) return; this.done = true; this.result = r; }
  // left/right (or tap) on a settings row. dir 0 = plain toggle
  adjust(k, dir) {
    if (k === 'music' || k === 'sfx') { this.setVol(k, Math.max(0, Math.min(20, Math.round(SET[k] * 20) + dir)) / 20); if (k === 'sfx') sfx('cursor'); }
    else if (k === 'speed') { const sp = typeof SPEEDS !== 'undefined' ? SPEEDS : [1, 1.5, 2, 3]; const i = sp.indexOf(SET.speed); this.setSetting('speed', sp[Math.max(0, Math.min(sp.length - 1, dir ? i + dir : (i + 1) % sp.length))]); }
    else if (k === 'bars' || k === 'touch') this.setSetting(k, SET[k] ? 0 : 1);
    else if (k === 'lang') { I18N.next(dir || 1); sfx('cursor'); this.sync(); this.renderHomeContinue(); }
  }
  setVol(k, v) { SET[k] = v; if (k === 'music') applyVolumes(); saveSettings(); this.sync(); }
  setSetting(k, v) {
    SET[k] = v; if (k === 'bars') applyBars(); if (k === 'touch') applyTouch();   // the controller itself stays hidden until the game starts
    saveSettings(); sfx('cursor'); this.sync();
  }
  // refresh every control from SET
  sync() {
    const r = this.root; if (!r) return;
    for (const k of ['music', 'sfx']) { const i = r.querySelector('[data-range="' + k + '"]'); if (i) i.value = Math.round(SET[k] * 20); const o = r.querySelector('[data-out="' + k + '"]'); if (o) o.textContent = Math.round(SET[k] * 100) + '%'; }
    r.querySelectorAll('.seg [data-k]').forEach(b => b.classList.toggle('on', +b.dataset.v === +SET[b.dataset.k]));
    r.querySelectorAll('[data-langname]').forEach(b => { b.textContent = I18N.name(I18N.cur); });
    r.querySelectorAll('[data-sw="touch"]').forEach(s => s.classList.toggle('on', !!SET.touch));
    r.querySelectorAll('[data-ver]').forEach(e => { const v = MM_VERSION(); e.textContent = v ? 'v' + v : ''; });
  }


  // ------------------------------------------------------------ cloud saves (Google Drive, see js/cloud.js)
  clHead(icon, title, sub, btn) {
    return '<div class="cld-acct"><span class="ic">' + MM_ICON.cloud + '</span><div class="tx"><b>' + mmEsc(title) + '</b><small>' + mmEsc(sub) + '</small></div>' + (btn || '') + '</div>';
  }
  async renderCloud() {
    const box = this.root.querySelector('.cld-panel'); if (!box) return;
    const tk = this.clTk = (this.clTk || 0) + 1, live = () => tk === this.clTk && this.view === 'cloud';
    const mode = CLOUD.mode();
    if (mode === 'none') { box.innerHTML = this.clHead('', __('Not available here'), /^https?:$/.test(location.protocol) ? __('Cloud saves work in the browser version (on a web address) and in the Windows app.') : __('You opened the game as a file. Open it from a web address (e.g. http://localhost:8000) to use cloud saves.')); return; }
    if (!(await CLOUD.configured())) { if (live()) { box.innerHTML = this.clHead('', __('Not set up yet'), __('The game needs the Client ID of a Google app first. See CLOUD_SETUP.md.'), '<button class="cld-btn pri" data-f data-act="cl-cfg">' + mmEsc(__('Set up')) + '</button>'); this.setFocus(box.querySelector('[data-act="cl-cfg"]')); } return; }
    const st = await CLOUD.status(); if (!live()) return;
    if (!st.signedIn) {
      box.innerHTML = this.clHead('', __('Not signed in'), __('Sign in with Google. The game can only see its own hidden folder, never your other files.'), '<button class="cld-btn pri" data-f data-act="cl-in">' + mmEsc(__('Sign in with Google')) + '</button>');
      this.setFocus(box.querySelector('[data-act="cl-in"]')); return;
    }
    box.innerHTML = this.clHead('', mmMaskEmail(st.email) || __('Signed in'), __('Loading your cloud saves…'), '<button class="cld-btn" data-f data-act="cl-out">' + mmEsc(__('Sign out')) + '</button>');
    let files; try { files = await CLOUD.list(); } catch (e) {
      if (!live()) return;
      if (e.code === 'auth') { box.innerHTML = this.clHead('', __('Not signed in'), e.message, '<button class="cld-btn pri" data-f data-act="cl-in">' + mmEsc(__('Sign in with Google')) + '</button>'); this.setFocus(box.querySelector('[data-act="cl-in"]')); return; }
      box.innerHTML = this.clHead('', mmMaskEmail(st.email) || __('Signed in'), e.message, '<button class="cld-btn" data-f data-act="cl-retry">' + mmEsc(__('Retry')) + '</button><button class="cld-btn" data-f data-act="cl-out">' + mmEsc(__('Sign out')) + '</button>'); return;
    }
    if (!live()) return;
    this.cl = { files };
    const rows = mmAllSlots().map(s => {
      const n = s.n, c = files[n], sv = s.save;
      const loc = sv ? '<div class="cld-c"><small>' + mmEsc(__('This device')) + '</small><b>' + mmEsc(sv.name) + '</b><span>' + mmEsc(mapNameOf(sv.map) + ' · ' + fmtTime(sv.playFrames || 0) + ' · ' + mmBadges(sv) + '★ · ' + mmDate(sv.t)) + '</span></div>' : '<div class="cld-c none"><small>' + mmEsc(__('This device')) + '</small><b>' + mmEsc(s.broken ? __('Damaged') : __('Empty')) + '</b></div>';
      const cl = c ? '<div class="cld-c"><small>' + mmEsc(__('Google Drive')) + '</small><b>' + mmEsc(c.name) + '</b><span>' + mmEsc(mapNameOf(c.m) + ' · ' + fmtTime(c.pf) + ' · ' + c.b + '★ · ' + mmDate(c.t)) + '</span></div>' : '<div class="cld-c none"><small>' + mmEsc(__('Google Drive')) + '</small><b>' + mmEsc(__('Nothing uploaded')) + '</b></div>';
      const bt = (act, ic, ok, tt, cls) => '<button class="tool' + (cls ? ' ' + cls : '') + '"' + (ok ? ' data-f data-act="' + act + '" data-n="' + n + '"' : ' disabled') + ' title="' + mmEsc(tt) + '" aria-label="' + mmEsc(tt + ' ' + n) + '">' + ic + '</button>';
      return '<div class="cld-row"><div class="cld-n">SLOT ' + n + '</div>' + loc + cl + '<div class="cld-b">' + bt('cl-up', MM_ICON.up, !!sv, __('Upload to Google Drive')) + bt('cl-down', MM_ICON.down, !!c, __('Download from Google Drive')) + bt('cl-del', MM_ICON.trash, !!c, __('Delete the cloud copy'), 'danger') + '</div></div>';
    }).join('');
    box.innerHTML = this.clHead('', mmMaskEmail(st.email) || __('Signed in'), __('Upload ↑ sends this device\'s save to Drive. Download ↓ replaces the save on this device.'), '<button class="cld-btn" data-f data-act="cl-out">' + mmEsc(__('Sign out')) + '</button>') + this.clAutoCard() + rows;
    const keep = this.clKeep; this.clKeep = null;
    this.setFocus((keep && box.querySelector('[data-act="' + keep.a + '"][data-n="' + keep.n + '"]')) || box.querySelector('[data-act="cl-up"]:not([disabled])') || box.querySelector('[data-f]'));
  }
  clErr(e) { sfx('buzzer'); this.toast(e && e.message ? e.message : __('Something went wrong.')); if (e && e.code === 'auth') this.renderCloud(); }
  // dialog with text fields: o = { title, text, yes, fields: [{ k, label, value, ph }] }; onOk gets { k: value }.
  // G.modal stops the game's own key handling while typing; Enter saves, Escape cancels.
  askFields(o, onOk) {
    this.dlgPrev = this.focused;
    this.dlg = { onYes: onOk, modal: true, collect: () => { const v = {}; this.root.querySelectorAll('.mm-dlg input.mm-in').forEach(i => { v[i.dataset.k] = i.value; }); return v; } };
    G.modal = true;
    const el = this.root.querySelector('.mm-dlg');
    el.innerHTML = '<div class="dlg" role="dialog"><h3>' + mmEsc(o.title) + '</h3><p>' + mmEsc(o.text || '') + '</p>' + o.fields.map(f => '<label>' + mmEsc(f.label) + '<input class="mm-in" data-k="' + f.k + '" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + mmEsc(f.ph || '') + '" value="' + mmEsc(f.value || '') + '"></label>').join('') + '<div class="row"><button data-f data-act="dlg-no">' + mmEsc(__('Cancel')) + '</button><button data-f data-act="dlg-yes">' + mmEsc(o.yes || 'OK') + '</button></div></div>';
    el.classList.add('open');
    el.querySelectorAll('input.mm-in').forEach(i => i.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); el.querySelector('[data-act="dlg-yes"]').click(); } else if (e.key === 'Escape') { e.preventDefault(); el.querySelector('[data-act="dlg-no"]').click(); }
    }));
    const first = el.querySelector('input.mm-in'); if (first) { first.focus(); first.select(); }
  }
  async clCfg() {
    const cur = await CLOUD.getConfig();
    this.askFields({
      title: __('Google app settings'),
      text: cur.secret ? __('Paste the Client ID and Client secret of your Google "Desktop app" OAuth client. See CLOUD_SETUP.md.') : __('Paste the Client ID of your Google "Web application" OAuth client. See CLOUD_SETUP.md.'),
      yes: __('Save'),
      fields: [{ k: 'id', label: __('Client ID'), value: cur.clientId, ph: '123456-abc.apps.googleusercontent.com' }].concat(cur.secret ? [{ k: 'secret', label: __('Client secret (leave empty to keep the current one)'), value: '', ph: 'GOCSPX-…' }] : [])
    }, async v => {
      const id = String((v && v.id) || '').trim();
      if (id && !/\.apps\.googleusercontent\.com$/i.test(id)) { sfx('buzzer'); return this.toast(__('That does not look like a Google Client ID (it ends in .apps.googleusercontent.com).')); }
      try { await CLOUD.setConfig(id, String((v && v.secret) || '').trim()); sfx('save'); this.toast(id ? __('Saved.') : __('Cleared.')); } catch (e) { return this.clErr(e); }
      if (this.view === 'cloud') this.renderCloud();
    });
  }
  // Opening a save: when a Google account is signed in (and the phone/PC is online), look for a newer copy on Drive first.
  // Never blocks for long (4 s) and never opens a sign-in window; any problem just opens the local save.
  async openSlot(s) {
    if (this.opening) return; this.opening = true;
    const play = sv => { this.opening = false; this.choose({ type: 'load', slot: s.n, save: sv || s.save }); };
    let c = null, slow = setTimeout(() => this.toast(__('Checking Google Drive…')), 700);
    try {
      if (await CLOUD.canQuiet()) {
        const files = await Promise.race([CLOUD.list(), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 4000))]);
        const f = files[s.n]; if (f && f.t > (s.save.t || 0) + 1000) c = f;
      }
    } catch (e) { c = null; }
    clearTimeout(slow);
    if (!c) return play();
    this.confirm({ title: __('A newer save is on Google Drive'), text: __('Slot {0} on Google Drive is newer than the one on this device ({1} vs {2}). Download it before playing?', s.n, mmDate(c.t), mmDate(s.save.t)), yes: __('Download newer save'), no: __("Play this device's save") },
      async () => {
        try {
          this.toast(__('Downloading…'));
          const data = JSON.parse(await CLOUD.download(c.id)); if (!validSaveData(data)) throw new Error(__('The cloud copy is damaged.'));
          localStorage.setItem(slotKey(s.n), JSON.stringify(data)); migrateSyms(data); play(data);
        } catch (e) { this.toast(e && e.message ? e.message : __('Something went wrong.')); play(); }
      }, () => play());
  }
  clAutoCard() {
    const on = CLOUD.autoOn(), la = CLOUD.lastAuto();
    const sub = !la ? __('Saves made in the game are sent to Google Drive by themselves.') : la.ok ? __('Last automatic upload: {0}', mmDate(la.t)) : __('Last automatic upload failed: {0}', la.msg || '?');
    return '<div class="cld-acct"><span class="ic">' + MM_ICON.up + '</span><div class="tx"><b>' + mmEsc(__('Upload automatically')) + '</b><small>' + mmEsc(sub) + '</small></div><button class="cld-btn' + (on ? ' pri' : '') + '" data-f data-act="cl-auto">' + mmEsc(on ? __('ON') : __('OFF')) + '</button></div>';
  }
  async clSignIn() {
    if (this.clBusy) return; this.clBusy = true; this.toast(__('Opening Google sign-in…'));
    try { await CLOUD.signIn(); sfx('ok'); } catch (e) { this.clErr(e); } finally { this.clBusy = false; }
    if (this.view === 'cloud') this.renderCloud();
  }
  async clSignOut() { try { await CLOUD.signOut(); } catch (e) { } sfx('back'); this.toast(__('Signed out.')); this.renderCloud(); }
  clSummary(sv) { return { name: sv.name, t: sv.t, pf: sv.playFrames || 0, b: mmBadges(sv), m: sv.map }; }
  clUp(n) {
    if (this.clBusy) return; const s = mmSlot(n); if (!s.save) return this.toast(__('Nothing to upload in this slot.'));
    const c = this.cl && this.cl.files[n];
    const go = async () => {
      this.clBusy = true; this.toast(__('Uploading…'));
      try { const raw = localStorage.getItem(slotKey(n)); await CLOUD.upload(n, raw, this.clSummary(s.save), c && c.id); sfx('save'); this.toast(__('Slot {0} uploaded.', n)); }
      catch (e) { this.clErr(e); } finally { this.clBusy = false; }
      this.clKeep = { a: 'cl-up', n }; if (this.view === 'cloud') this.renderCloud();
    };
    if (c) { const newer = c.t > (s.save.t || 0); this.confirm({ title: __('Replace the cloud copy?'), text: newer ? __('The copy on Google Drive is NEWER than the one on this device. Uploading replaces it.') : __('This replaces the copy of slot {0} on Google Drive.', n), yes: __('Upload'), danger: newer }, go); } else go();
  }
  clDown(n) {
    if (this.clBusy) return; const c = this.cl && this.cl.files[n]; if (!c) return;
    const s = mmSlot(n);
    const go = async () => {
      this.clBusy = true; this.toast(__('Downloading…'));
      try {
        const txt = await CLOUD.download(c.id); let data = null; try { data = JSON.parse(txt); } catch (e) { }
        if (!validSaveData(data)) throw new Error(__('The cloud copy is damaged.'));
        try { localStorage.setItem(slotKey(n), JSON.stringify(data)); } catch (e) { throw new Error(__('The save could not be stored in this browser.')); }
        sfx('save'); this.toast(__("{0}'s save downloaded into slot {1}.", data.name, n));
      } catch (e) { this.clErr(e); } finally { this.clBusy = false; }
      this.clKeep = { a: 'cl-down', n }; if (this.view === 'cloud') this.renderCloud();
    };
    if (s.save || s.broken) { const newer = s.save && (s.save.t || 0) > c.t; this.confirm({ title: __('Replace slot {0} on this device?', n), text: newer ? __('The save on THIS DEVICE is newer than the cloud copy. Downloading replaces it.') : __('Downloading replaces the save in slot {0} on this device.', n), yes: __('Download'), danger: !!newer }, go); } else go();
  }
  clDel(n) {
    if (this.clBusy) return; const c = this.cl && this.cl.files[n]; if (!c) return;
    this.confirm({ title: __('Delete the cloud copy?'), text: __('Deletes slot {0} from Google Drive for good. The save on this device stays.', n), yes: __('Delete'), danger: true }, async () => {
      this.clBusy = true;
      try { await CLOUD.remove(c.id); sfx('back'); this.toast(__('Cloud copy of slot {0} deleted.', n)); } catch (e) { this.clErr(e); } finally { this.clBusy = false; }
      this.clKeep = { a: 'cl-up', n }; if (this.view === 'cloud') this.renderCloud();
    });
  }

  // ------------------------------------------------------------ slot tools
  async importInto(n) {
    const text = await pickSaveFile(); if (text === null || this.done) return;
    let data = null; try { const j = JSON.parse(text); data = j && j.save ? j.save : j; } catch (e) { }
    if (!validSaveData(data)) { sfx('buzzer'); return this.toast("That file isn't a valid JBA Pokémon save."); }
    const put = () => { try { localStorage.setItem(slotKey(n), JSON.stringify(data)); } catch (e) { return this.toast('The save could not be stored in this browser.'); } sfx('save'); this.renderSlots(); this.setFocus(this.root.querySelector('.slot-main[data-n="' + n + '"]')); this.toast(__("{0}'s save imported into slot {1}.", data.name, n)); };
    if (hasSave(n)) this.confirm({ title: __('Replace slot {0}?', n), text: __('This slot already holds a save. Importing replaces it.'), yes: __('Replace'), danger: true }, put); else put();
  }
  confirmDelete(n) {
    const s = mmSlot(n), who = s.save ? s.save.name + "'s" : 'this';
    this.confirm({ title: __('Delete slot {0}?', n), text: __('Delete {0} save for good? Export it first if you want a backup.', who), yes: __('Delete'), danger: true }, () => {
      try { localStorage.removeItem(slotKey(n)); if (this.lastSlot() === n) localStorage.removeItem(LAST_SLOT_KEY); } catch (e) { }
      sfx('back'); this.renderSlots(); this.setFocus(this.root.querySelector('.slot-main[data-n="' + n + '"]')); this.toast(__('Slot {0} deleted.', n));
    });
  }
  confirm(o, onYes, onNo) {
    this.dlgPrev = this.focused; this.dlg = { onYes, onNo };
    const el = this.root.querySelector('.mm-dlg');
    el.innerHTML = '<div class="dlg" role="dialog"><h3>' + (o.danger ? MM_ICON.warn : '') + mmEsc(o.title) + '</h3><p>' + mmEsc(o.text) + '</p><div class="row"><button data-f data-act="dlg-no">' + mmEsc(o.no || 'Cancel') + '</button><button data-f data-act="dlg-yes"' + (o.danger ? ' class="danger"' : '') + '>' + mmEsc(o.yes || 'OK') + '</button></div></div>';
    el.classList.add('open'); this.setFocus(el.querySelector('[data-act="dlg-no"]'));
  }
  closeDlg(yes) {
    const d = this.dlg; this.dlg = null; if (d && d.modal) G.modal = false; const el = this.root.querySelector('.mm-dlg'); el.classList.remove('open'); el.innerHTML = '';
    this.setFocus(this.dlgPrev && this.dlgPrev.isConnected ? this.dlgPrev : null); if (yes && d && d.onYes) d.onYes(d.vals); else if (!yes && d && d.onNo) d.onNo();
  }
  // ---- Settings > Updates. Optional and manual: nothing here runs unless the player presses it, and nothing is installed unless they
  // confirm the dialog. Offline (or any error) only shows a message and play goes on; the installed game is never touched before the confirm.
  updSay(t, btn) {
    this.root.querySelectorAll('[data-upd]').forEach(e => { e.textContent = t; });
    if (btn) this.root.querySelectorAll('[data-updbtn]').forEach(e => { e.textContent = btn; });
  }
  async checkUpdate() {
    if (this.updBusy) return;
    sfx('ok');
    if (this.updRel) return this.askUpdate();   // a newer release was already found: ask again
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return this.updSay("You're offline. You can keep playing; check again when you're online.", 'Check');
    this.updBusy = true; this.updSay('Checking…', '…');
    let to = 0;
    try {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null; to = setTimeout(() => { if (ctl) ctl.abort(); }, 8000);
      const r = await fetch(MM_RELEASES_API, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' }, signal: ctl ? ctl.signal : undefined });
      if (!r.ok) throw new Error('http ' + r.status);
      const rel = await r.json(), tag = String(rel.tag_name || '').replace(/^v/i, '');
      if (!tag) throw new Error('no tag');
      if (MM_VERSION() && mmNewer(tag, MM_VERSION())) { this.updRel = rel; rel._tag = tag; this.updBusy = false; clearTimeout(to); this.updSay('Version ' + tag + ' is available (you have ' + MM_VERSION() + ').', 'Update'); return this.askUpdate(); }
      this.updSay('You have the latest version' + (MM_VERSION() ? ' (' + MM_VERSION() + ')' : '') + '.', 'Check');
    } catch (e) { this.updSay("Couldn't reach GitHub. You can keep playing; try again later.", 'Check'); }
    clearTimeout(to); this.updBusy = false;
  }
  // which file to download on this device: the .apk in the Android app, the setup / portable .exe in the Windows app; anything else opens the release page
  async updTarget(rel) {
    const find = re => (rel.assets || []).find(a => re.test(a.name || '') && a.browser_download_url);
    const cap = window.Capacitor;
    if (cap && typeof cap.getPlatform === 'function' && cap.getPlatform() === 'android') { const a = find(/\.apk$/i); if (a) return { kind: 'android', asset: a }; }
    else if (window.jbaUpdater) {
      try { const inf = await window.jbaUpdater.info(); if (inf && inf.packaged && inf.platform === 'win32') { const a = find(inf.portable ? /-portable\.exe$/i : /-setup\.exe$/i); if (a) return { kind: 'win', asset: a, portable: !!inf.portable }; } } catch (e) { }
    }
    return { kind: 'page' };
  }
  async askUpdate() {
    const rel = this.updRel; if (!rel || this.dlg) return;
    const t = await this.updTarget(rel), mb = t.asset && t.asset.size ? Math.round(t.asset.size / 1048576) : 0;
    this.confirm(t.kind === 'page'
      ? { title: __('Update to {0}?', rel._tag), text: __('Open the download page for version {0}.', rel._tag), yes: __('Open') }
      : { title: __('Update to {0}?', rel._tag), text: __('Download {0} and install it now. Your saves are not touched.', mb ? mb + ' MB' : 'the update') + (t.kind === 'win' ? ' ' + (t.portable ? __('The game will close and the new version will start.') : __('The game will close and the installer will open.')) : ''), yes: __('Update') },
      () => this.startUpdate(t));
  }
  async startUpdate(t) {
    const rel = this.updRel; if (!rel || this.updBusy) return;
    const page = () => { this.updSay('Opening the download page…', 'Update'); try { window.open(rel.html_url, '_blank', 'noopener'); } catch (e) { } };
    if (t.kind === 'page') return page();
    this.updBusy = true; this.updSay('Starting…', '…');
    try {
      if (t.kind === 'android') {
        const U = jbaPlugin('Updater');
        if (!(await U.canInstall()).allowed) {   // Android asks the player to allow installs from this app, once
          this.updSay('Allow "Install unknown apps" for JBA Pokemon on the screen that opens, come back, and press Update again.', 'Update');
          await U.openInstallSettings(); this.updBusy = false; return;
        }
        let h = null;   // the percentage is a nicety: if listening is not possible, the download still runs
        try { h = await U.addListener('progress', p => this.updSay(p && p.percent >= 0 ? 'Downloading… ' + p.percent + '%' : 'Downloading…', '…')); } catch (e) { }
        this.updSay('Downloading…', '…');
        try { await U.download({ url: t.asset.browser_download_url }); } finally { try { if (h && h.remove) h.remove(); } catch (e) { } }
        this.updSay('Downloaded. Tap Install on the screen that opens.', 'Update');
        await U.install();
      } else {   // win
        window.jbaUpdater.onProgress(p => this.updSay(p >= 0 ? 'Downloading… ' + p + '%' : 'Downloading…', '…'));
        await window.jbaUpdater.install(t.asset.browser_download_url);
        this.updSay('Starting the new version…', '…');
      }
    } catch (e) {
      const msg = String((e && e.message) || e || '');
      if (/not implemented|not available/i.test(msg)) return (this.updBusy = false, page());   // an app built before the updater existed: use the release page
      this.updSay('The update failed (' + msg.replace(/^Error invoking remote method '[^']*': (Error: )?/, '') + '). Press Update to try again.', 'Update');
    }
    this.updBusy = false;
  }
  toast(msg) {
    const t = this.root.querySelector('.mm-toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(this.toastT); this.toastT = setTimeout(() => t.classList.remove('show'), 3200);
  }
}

// ------------------------------------------------------------ Title screen entry point (replaces the old canvas title screen)
// Android with a second screen: the Pokédex opens there by itself once per app start (nothing happens on single-screen devices).
let MM_DEX_AUTO = false;
function mmAutoDex() { if (MM_DEX_AUTO) return; MM_DEX_AUTO = true; try { jbaPlugin('Dex').autoOpen({}).catch(() => { }); } catch (e) { } }
function* titleScreen() {
  stopME(); stopBGM(); G.fade = 0;
  const mm = new MainMenu();
  mmAutoDex();
  G.inMainMenu = true; applyTouch();   // hides the on-screen controller while the menu is open
  const res = yield* withDraw(() => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH); }, (function* () {
    G.loadImgs = ['assets/ui/loading_full.png', 'assets/ui/loading_empty.png'].map(u => { const im = new Image(); im.src = u; return im; });   // the loading bar's pokeballs
    // fetch the menu's own pictures first, so the slide-in animations play on screen instead of finishing unseen
    let pend = 0; for (const u of ['assets/ui/menu_bg.jpg', 'assets/ui/menu_char.png', 'assets/ui/menu_logo.png']) { pend++; const im = new Image(); im.onload = im.onerror = () => { pend--; }; im.src = u; }
    for (let i = 0; i < 240 && pend > 0; i++) yield;
    mm.open();
    { const pre = document.getElementById('mmPre'); if (pre) pre.remove(); }   // the menu now covers the same picture + shade
    let shown = 0;   // the game div stays hidden and starts loading in the background once the menu has settled
    while (!mm.result) { yield; mm.pump(); if (++shown === 70) G.loadGame(); }
    document.body.style.backgroundImage = 'none'; document.body.style.backgroundColor = '#000';   // so the menu fades out to black, not to the photo behind it
    mm.root.classList.add('leaving');
    for (let i = 0; i < 22; i++) yield;
    mm.destroy();
    return mm.result;
  })());
  G.inMainMenu = false; stopBGM();
  G.slot = res.slot; try { localStorage.setItem(LAST_SLOT_KEY, String(res.slot)); } catch (e) { }
  // Loading screen: the bar only reaches 100% once everything is really loaded (all pictures, the fonts, the map built
  // and the pictures it asked for), so nothing is left to wait for once it is full.
  G.loadGame(); G.loadExtra = 0; G.fade = 0;
  { const gw = document.getElementById('wrap'); if (gw) gw.style.visibility = 'visible'; }   // show the game div so the bar can be seen
  const pd = G.uiDraw;
  G.uiDraw = () => {   // black screen, a row of pokeballs that fill in left to right (no numbers)
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
    const p = Math.min(1, (G.loadTotal ? 0.9 * Math.min(1, G.loadDone / G.loadTotal) : 0) + 0.1 * G.loadExtra);
    const [full, empty] = G.loadImgs || [];
    if (!(full && empty && full.complete && empty.complete && full.width)) return;
    const w = 384, h = Math.round(w * full.height / full.width), x = Math.round((SW - w) / 2), y = Math.round(SH / 2 - h / 2);
    const cut = Math.round(w * p);   // one whole-pixel cut: red on the left of it, blue on the right, so the two never overlap or leave a fringe
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, cut, h); ctx.clip(); ctx.drawImage(full, x, y, w, h); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(x + cut, y, w - cut, h); ctx.clip(); ctx.drawImage(empty, x, y, w, h); ctx.restore();
  };
  while (!G.assetsReady) yield;                                                     // pictures + fonts
  if (res.type === 'load') loadSave(res.save); else enterMap(START.map, START.x, START.y, START.dir);   // build the map behind the bar
  G.loadExtra = 0.5;
  for (let i = 0; i < 3; i++) yield;                                                // let the first frames ask for the pictures they need
  for (let i = 0; i < 600 && Object.values(IMG_PENDING).some(v => v === 1); i++) yield;   // only pictures still in flight (a missing file counts as finished once its retries are over)
  G.loadExtra = 1; yield;                                                           // bar full: everything is in
  applyTouch();                                                                     // the controller shows up now, if the player left it on
  G.uiDraw = pd; G.fade = 1;
  yield* fadeTo(0, 18);                                                             // black fades straight onto the game
  G.started = true; keys.pressed = {}; try { canvas.focus(); } catch (e) { }
}
