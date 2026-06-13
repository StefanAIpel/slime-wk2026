/* ============================================================================
   SLIME WK 2026  —  retro slime soccer
   Vanilla JS + Canvas 2D. Modi: 1P vs AI, 2P lokaal, Online (P2P via PeerJS).
   Host-authoritative netcode. Web Audio (gesynthetiseerd). Geen assets nodig.
   ============================================================================ */
'use strict';

/* ----------------------------------------------------------------------------
   0. Canvas + wereldconstanten
   ---------------------------------------------------------------------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = 1160, H = 600;             // logical resolution (longer field; goals are edge-anchored so this is safe)
// Hi-DPI, display-matched backing store: the canvas renders at its on-screen size ×
// device pixel ratio, so the pitch, slime ART and HUD stay crisp at ANY field size
// (desktop 1×/1.5×/Fill, phones, tablets) instead of being CSS up/down-scaled.
function resizeCanvas(){
  if (typeof canvas.getBoundingClientRect !== 'function') return;       // headless/test stub
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const bw = Math.round(r.width * dpr), bh = Math.round(r.height * dpr);
  if (canvas.width  !== bw) canvas.width  = bw;
  if (canvas.height !== bh) canvas.height = bh;
  ctx.setTransform(bw / W, 0, 0, bh / H, 0, 0);                          // map logical 1160×600 onto the backing store
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';  // smooth slime art / flags when scaled
}
resizeCanvas();

const GROUND   = H - 52;             // ground level (y of the pitch surface)
const CENTER   = W / 2;
const SLIME_R  = 60;                 // slime radius (half circle)
const BALL_R   = 13;
const GOAL_H   = 172;                // goal mouth height
const GOAL_D   = 46;                 // depth/width of the goal net
const BAR_Y    = GROUND - GOAL_H;    // y of the crossbar
const BAR_TH   = 8;

// physics tuning (per 60fps tick)
const SLIME_SPEED = 7.6;             // ground speed (snappier traversal)
const SLIME_JUMP  = 14.4;
const SLIME_GRAV  = 0.72;
const COYOTE_FRAMES = 6;             // jump grace after leaving the ground (~100ms @60fps)
const JUMP_BUFFER_FRAMES = 4;        // tiny pre-land buffer (~67ms): a touch-early tap still fires on landing
const BALL_GRAV   = 0.34;
const BALL_REST   = 0.86;            // wall/bar damping
const BALL_MAX    = 22;              // speed limit

/* ----------------------------------------------------------------------------
   1. Teams  (24-country pool; Netherlands featured/default).
   stripes = mini-flag (horizontal bands top->bottom). strength = bracket-sim seed.
   A tournament randomly draws 16 of these (your pick + 15 others).
   ---------------------------------------------------------------------------- */
const TEAMS = [
  { code:'NED', name:'Netherlands', color:'#ff7a18', trim:'#ffffff', strength:86, stripes:['#ae1c28','#ffffff','#21468b'], featured:true,
    flag:'linear-gradient(#ae1c28 33%,#fff 33% 66%,#21468b 66%)',
    art:{ right:'assets/slimes/ned-right.webp', left:'assets/slimes/ned-left.webp' } },   // hand-drawn character art (Virgil)
  { code:'ARG', name:'Argentina',   color:'#7cc0ee', trim:'#ffffff', strength:92, stripes:['#74acdf','#ffffff','#74acdf'],
    flag:'linear-gradient(#74acdf 33%,#fff 33% 66%,#74acdf 66%)',
    art:{ right:'assets/slimes/arg-right.webp', left:'assets/slimes/arg-left.webp' } },
  { code:'BRA', name:'Brazil',      color:'#ffd400', trim:'#1f8f3a', strength:90, stripes:['#1f8f3a','#ffd400','#2a47a8'],
    flag:'linear-gradient(135deg,#1f8f3a 40%,#ffd400 40% 60%,#1f8f3a 60%)',
    art:{ right:'assets/slimes/bra-right.webp', left:'assets/slimes/bra-left.webp' } },
  { code:'FRA', name:'France',      color:'#3a6ec0', trim:'#ffffff', strength:91, stripes:['#0055a4','#ffffff','#ef4135'],
    flag:'linear-gradient(90deg,#0055a4 33%,#fff 33% 66%,#ef4135 66%)',
    art:{ right:'assets/slimes/fra-right.webp', left:'assets/slimes/fra-left.webp' } },
  { code:'ENG', name:'England',     color:'#ededed', trim:'#d52b1e', strength:87, stripes:['#ffffff','#d52b1e','#ffffff'],
    flag:'linear-gradient(#d52b1e,#d52b1e) center/100% 26% no-repeat, linear-gradient(#d52b1e,#d52b1e) center/26% 100% no-repeat, #fff',
    art:{ right:'assets/slimes/eng-right.webp', left:'assets/slimes/eng-left.webp' } },
  { code:'ESP', name:'Spain',       color:'#d52b1e', trim:'#ffd400', strength:88, stripes:['#aa151b','#f1bf00','#aa151b'],
    flag:'linear-gradient(#aa151b 25%,#f1bf00 25% 75%,#aa151b 75%)' },
  { code:'GER', name:'Germany',     color:'#edeef2', trim:'#16161c', strength:85, stripes:['#000000','#dd0000','#ffce00'],
    flag:'linear-gradient(#000 33%,#dd0000 33% 66%,#ffce00 66%)',
    art:{ right:'assets/slimes/ger-right.webp', left:'assets/slimes/ger-left.webp' } },
  { code:'POR', name:'Portugal',    color:'#c8102e', trim:'#0a5c2e', strength:86, stripes:['#006600','#006600','#ff0000'],
    flag:'linear-gradient(90deg,#006600 40%,#ff0000 40%)' },
  { code:'EGY', name:'Egypt',       color:'#d21034', trim:'#c8a45a', strength:78, stripes:['#ce1126','#ffffff','#000000'],
    flag:'linear-gradient(#ce1126 33%,#fff 33% 66%,#000 66%)',
    art:{ right:'assets/slimes/egy-right.webp', left:'assets/slimes/egy-left.webp' } },
  { code:'CRO', name:'Croatia',     color:'#d52b1e', trim:'#ffffff', strength:82, stripes:['#ff0000','#ffffff','#171796'],
    flag:'linear-gradient(#ff0000 50%,#171796 50%)',
    art:{ right:'assets/slimes/cro-right.webp', left:'assets/slimes/cro-left.webp' } },
  { code:'MAR', name:'Morocco',     color:'#c1272d', trim:'#1f8f3a', strength:80, stripes:['#c1272d','#c1272d','#006233'],
    flag:'linear-gradient(#c1272d,#c1272d)' },
  { code:'JPN', name:'Japan',       color:'#1f4fb0', trim:'#ffffff', strength:78, stripes:['#ffffff','#bc002d','#ffffff'],
    flag:'radial-gradient(circle at 50% 50%, #bc002d 22%, #fff 23%)',
    art:{ right:'assets/slimes/jpn-right.webp', left:'assets/slimes/jpn-left.webp' } },
  { code:'MEX', name:'Mexico',      color:'#1f8f3a', trim:'#ffffff', strength:76, stripes:['#006847','#ffffff','#ce1126'],
    flag:'linear-gradient(90deg,#006847 33%,#fff 33% 66%,#ce1126 66%)' },
  { code:'USA', name:'USA',         color:'#3a4ea8', trim:'#ffffff', strength:74, stripes:['#3c3b6e','#ffffff','#b22234'],
    flag:'linear-gradient(#b22234 50%,#3c3b6e 50%)' },
  { code:'CAN', name:'Canada',      color:'#d52b1e', trim:'#ffffff', strength:72, stripes:['#d80621','#ffffff','#d80621'],
    flag:'linear-gradient(90deg,#d80621 28%,#fff 28% 72%,#d80621 72%)',
    art:{ right:'assets/slimes/can-right.webp', left:'assets/slimes/can-left.webp' } },
  { code:'BEL', name:'Belgium',     color:'#e2231a', trim:'#f3d02f', strength:83, stripes:['#000000','#fdda24','#ef3340'],
    flag:'linear-gradient(90deg,#000 33%,#fdda24 33% 66%,#ef3340 66%)',
    art:{ right:'assets/slimes/bel-right.webp', left:'assets/slimes/bel-left.webp' } },   // hand-drawn character art (De Bruyne)
  { code:'URU', name:'Uruguay',     color:'#5aa0e0', trim:'#ffffff', strength:82, stripes:['#7bb0e0','#ffffff','#7bb0e0'],
    flag:'repeating-linear-gradient(#7bb0e0 0 11%, #fff 11% 22%)' },
  { code:'SEN', name:'Senegal',     color:'#1f8f3a', trim:'#ffce00', strength:79, stripes:['#00853f','#fdef42','#e31b23'],
    flag:'linear-gradient(90deg,#00853f 33%,#fdef42 33% 66%,#e31b23 66%)' },
  { code:'SUI', name:'Switzerland', color:'#d52b1e', trim:'#ffffff', strength:77, stripes:['#d52b1e','#ffffff','#d52b1e'],
    flag:'linear-gradient(#fff,#fff) center/100% 30% no-repeat, linear-gradient(#fff,#fff) center/30% 100% no-repeat, #d52b1e' },
  { code:'COL', name:'Colombia',    color:'#fcd116', trim:'#003893', strength:80, stripes:['#fcd116','#003893','#ce1126'],
    flag:'linear-gradient(#fcd116 50%,#003893 50% 75%,#ce1126 75%)',
    art:{ right:'assets/slimes/col-right.webp', left:'assets/slimes/col-left.webp' } },
  { code:'RSA', name:'South Africa', color:'#eef1ee', trim:'#138a43', strength:73, stripes:['#de3831','#007a4d','#002395'],
    flag:'linear-gradient(#de3831 0 33%,#007a4d 33% 66%,#002395 66%)' },
  { code:'SWE', name:'Sweden',      color:'#fecc00', trim:'#1f5fa6', strength:80, stripes:['#006aa7','#fecc00','#006aa7'],
    flag:'linear-gradient(#fecc00,#fecc00) center/100% 30% no-repeat, linear-gradient(#fecc00,#fecc00) 34% 50%/16% 100% no-repeat, #006aa7' },
  { code:'CUW', name:'Curaçao',     color:'#2a6fd6', trim:'#f7d417', strength:68, stripes:['#0b3fb5','#f9d90f','#ffffff'] },
  { code:'ALG', name:'Algeria',     color:'#0b5d34', trim:'#ffffff', strength:81, stripes:['#006233','#ffffff','#d21034'],
    art:{ right:'assets/slimes/alg-right.webp', left:'assets/slimes/alg-left.webp' } },
];
const teamByCode = c => TEAMS.find(t => t.code === c) || TEAMS[0];

/* ----------------------------------------------------------------------------
   Accurate flags. Compact inline SVGs (viewBox 90x60, double-quoted attrs only
   so they encode cleanly into a data URI). One source of truth, used everywhere:
   • DOM  -> each team's `flag` becomes a `url(data:…)` CSS background (so every
            existing `style="background:${t.flag}"` site keeps working as-is)
   • canvas HUD -> rasterised via flagImage(), with the stripe bands as fallback
   ---------------------------------------------------------------------------- */
const _usaStripes = (()=>{ let s=''; for(let i=1;i<13;i+=2) s+='<rect y="'+(i*60/13).toFixed(2)+'" width="90" height="'+(60/13).toFixed(2)+'" fill="#fff"/>'; return s; })();
const _usaStars = (()=>{ let s=''; for(let r=0;r<4;r++) for(let c=0;c<5;c++) s+='<circle cx="'+(6+c*7)+'" cy="'+(6+r*7.2).toFixed(1)+'" r="1.3" fill="#fff"/>'; return s; })();
const FLAG_SVG = {
  NED:'<rect width="90" height="60" fill="#fff"/><rect width="90" height="20" fill="#ae1c28"/><rect y="40" width="90" height="20" fill="#21468b"/>',
  ARG:'<rect width="90" height="60" fill="#fff"/><rect width="90" height="20" fill="#74acdf"/><rect y="40" width="90" height="20" fill="#74acdf"/><circle cx="45" cy="30" r="6" fill="#f6b40e"/>',
  BRA:'<rect width="90" height="60" fill="#009c3b"/><polygon points="45,7 83,30 45,53 7,30" fill="#ffdf00"/><circle cx="45" cy="30" r="12" fill="#002776"/>',
  FRA:'<rect width="90" height="60" fill="#fff"/><rect width="30" height="60" fill="#0055a4"/><rect x="60" width="30" height="60" fill="#ef4135"/>',
  ENG:'<rect width="90" height="60" fill="#fff"/><rect x="39" width="12" height="60" fill="#ce1124"/><rect y="24" width="90" height="12" fill="#ce1124"/>',
  ESP:'<rect width="90" height="60" fill="#aa151b"/><rect y="15" width="90" height="30" fill="#f1bf00"/>',
  GER:'<rect width="90" height="60" fill="#000"/><rect y="20" width="90" height="20" fill="#dd0000"/><rect y="40" width="90" height="20" fill="#ffce00"/>',
  POR:'<rect width="90" height="60" fill="#f00"/><rect width="36" height="60" fill="#006600"/><circle cx="36" cy="30" r="7" fill="#ffd700" stroke="#fff" stroke-width="1.2"/>',
  EGY:'<rect width="90" height="60" fill="#fff"/><rect width="90" height="20" fill="#ce1126"/><rect y="40" width="90" height="20" fill="#000"/><circle cx="45" cy="30" r="5" fill="#c09b3a"/>',
  CRO:'<rect width="90" height="60" fill="#fff"/><rect width="90" height="20" fill="#ff0000"/><rect y="40" width="90" height="20" fill="#171796"/><rect x="38" y="21" width="14" height="16" fill="#fff"/><rect x="38" y="21" width="3.5" height="4" fill="#d10000"/><rect x="45" y="21" width="3.5" height="4" fill="#d10000"/><rect x="41.5" y="25" width="3.5" height="4" fill="#d10000"/><rect x="48.5" y="25" width="3.5" height="4" fill="#d10000"/><rect x="38" y="29" width="3.5" height="4" fill="#d10000"/><rect x="45" y="29" width="3.5" height="4" fill="#d10000"/><rect x="41.5" y="33" width="3.5" height="4" fill="#d10000"/><rect x="48.5" y="33" width="3.5" height="4" fill="#d10000"/>',
  MAR:'<rect width="90" height="60" fill="#c1272d"/><polygon points="45,17 47.94,25.95 57.36,25.98 49.76,31.55 52.64,40.52 45,35 37.36,40.52 40.24,31.55 32.64,25.98 42.06,25.95" fill="none" stroke="#006233" stroke-width="2"/>',
  JPN:'<rect width="90" height="60" fill="#fff"/><circle cx="45" cy="30" r="15" fill="#bc002d"/>',
  MEX:'<rect width="90" height="60" fill="#fff"/><rect width="30" height="60" fill="#006847"/><rect x="60" width="30" height="60" fill="#ce1126"/><circle cx="45" cy="30" r="5" fill="#7a5b34"/>',
  USA:'<rect width="90" height="60" fill="#b22234"/>'+_usaStripes+'<rect width="36" height="32.31" fill="#3c3b6e"/>'+_usaStars,
  CAN:'<rect width="90" height="60" fill="#fff"/><rect width="22" height="60" fill="#d80621"/><rect x="68" width="22" height="60" fill="#d80621"/><polygon points="45,13 47,22 53,20 51,28 58,28 53,33 55,35 48,36 49,43 45,39 41,43 42,36 35,35 37,33 32,28 39,28 37,20 43,22" fill="#d80621"/>',
  BEL:'<rect width="90" height="60" fill="#000"/><rect x="30" width="30" height="60" fill="#fdda24"/><rect x="60" width="30" height="60" fill="#ef3340"/>',
  URU:'<rect width="90" height="60" fill="#fff"/><rect y="6.67" width="90" height="6.67" fill="#0038a8"/><rect y="20" width="90" height="6.67" fill="#0038a8"/><rect y="33.33" width="90" height="6.67" fill="#0038a8"/><rect y="46.67" width="90" height="6.67" fill="#0038a8"/><rect width="33" height="33" fill="#fff"/><line x1="22.5" y1="16.5" x2="25.5" y2="16.5" stroke="#f6b40e" stroke-width="1.3"/><line x1="20.74" y1="20.74" x2="22.86" y2="22.86" stroke="#f6b40e" stroke-width="1.3"/><line x1="16.5" y1="22.5" x2="16.5" y2="25.5" stroke="#f6b40e" stroke-width="1.3"/><line x1="12.26" y1="20.74" x2="10.14" y2="22.86" stroke="#f6b40e" stroke-width="1.3"/><line x1="10.5" y1="16.5" x2="7.5" y2="16.5" stroke="#f6b40e" stroke-width="1.3"/><line x1="12.26" y1="12.26" x2="10.14" y2="10.14" stroke="#f6b40e" stroke-width="1.3"/><line x1="16.5" y1="10.5" x2="16.5" y2="7.5" stroke="#f6b40e" stroke-width="1.3"/><line x1="20.74" y1="12.26" x2="22.86" y2="10.14" stroke="#f6b40e" stroke-width="1.3"/><circle cx="16.5" cy="16.5" r="5.5" fill="#f6b40e"/>',
  SEN:'<rect width="90" height="60" fill="#fdef42"/><rect width="30" height="60" fill="#00853f"/><rect x="60" width="30" height="60" fill="#e31b23"/><polygon points="45,20 47.35,26.76 54.51,26.91 48.8,31.24 50.88,38.09 45,34 39.12,38.09 41.2,31.24 35.49,26.91 42.65,26.76" fill="#00853f"/>',
  SUI:'<rect width="90" height="60" fill="#d52b1e"/><rect x="39.5" y="14" width="11" height="32" fill="#fff"/><rect x="29" y="24.5" width="32" height="11" fill="#fff"/>',
  COL:'<rect width="90" height="60" fill="#fcd116"/><rect y="30" width="90" height="15" fill="#003893"/><rect y="45" width="90" height="15" fill="#ce1126"/>',
  RSA:'<rect width="90" height="30" fill="#e03c31"/><rect y="30" width="90" height="30" fill="#002395"/><path d="M0,5 L33,30 L0,55 M33,30 L90,30" fill="none" stroke="#fff" stroke-width="18"/><path d="M0,5 L33,30 L0,55 M33,30 L90,30" fill="none" stroke="#007a4d" stroke-width="11"/><polygon points="0,3 30,30 0,57" fill="#ffb915"/><polygon points="0,9 23,30 0,51" fill="#000"/>',
  SWE:'<rect width="90" height="60" fill="#006aa7"/><rect x="27" width="11" height="60" fill="#fecc00"/><rect y="24.5" width="90" height="11" fill="#fecc00"/>',
  CUW:'<rect width="90" height="60" fill="#0b3fb5"/><rect y="39" width="90" height="8" fill="#f9d90f"/><polygon points="19,15 20.41,19.06 24.71,19.15 21.28,21.74 22.53,25.85 19,23.4 15.47,25.85 16.72,21.74 13.29,19.15 17.59,19.06" fill="#fff"/><polygon points="28,8 28.94,10.71 31.8,10.76 29.52,12.49 30.35,15.24 28,13.6 25.65,15.24 26.48,12.49 24.2,10.76 27.06,10.71" fill="#fff"/>',
  ALG:'<rect width="90" height="60" fill="#006233"/><rect x="45" width="45" height="60" fill="#fff"/><path d="M51 21.51 A11 11 0 1 1 51 38.49 A9 9 0 0 0 51 21.51 Z" fill="#d21034"/><polygon points="53,25.5 54.06,28.54 57.28,28.61 54.71,30.56 55.65,33.64 53,31.8 50.36,33.64 51.29,30.56 48.72,28.61 51.94,28.54" fill="#d21034"/>',
};
function flagSVG(code){ return '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="60" viewBox="0 0 90 60">'+(FLAG_SVG[code]||FLAG_SVG.NED)+'</svg>'; }
function flagDataURI(code){ return 'data:image/svg+xml,'+encodeURIComponent(flagSVG(code)); }
function flagBg(code){ return "url('"+flagDataURI(code)+"') center/100% 100% no-repeat"; }
const _flagImgCache={};
function flagImage(code){ if (typeof Image==='undefined') return null;   // non-DOM (headless logic test)
  let i=_flagImgCache[code]; if(!i){ i=new Image(); i.src=flagDataURI(code); _flagImgCache[code]=i; } return i; }
TEAMS.forEach(t=>{ t.flag = flagBg(t.code); });   // supersede the old gradient approximations

/* speed = run-speed multiplier vs the player (applied in updateSlime via speedMul).
   Easy/Normal ≈ the long-time live feel; Hard and especially World Cup are
   deliberately faster + sharper (Rising inherits these per round). */
const AI_LEVELS = {
  easy:     { label:'Easy',      speed:0.90, react:150, jump:0.012, predict:8,  mistake:0.42, smart:false, attack:0.00 },
  normal:   { label:'Normal',    speed:1.00, react:55,  jump:0.05,  predict:24, mistake:0.16, smart:false, attack:0.22 },
  hard:     { label:'Hard',      speed:1.16, react:8,   jump:0.26,  predict:70, mistake:0.010, smart:true, defend:0.48, attack:0.55, catch:0.16 },
  worldcup: { label:'World Cup', speed:1.32, react:3,   jump:0.36,  predict:110, mistake:0.0,  smart:true, defend:0.55, attack:0.60, catch:0.24 },
};
// migrate older saved difficulty keys (Dutch) -> English
const DIFF_MIGRATE = { makkelijk:'easy', normaal:'normal', moeilijk:'hard', wk:'worldcup' };
function normDiff(d){ return AI_LEVELS[d] ? d : (DIFF_MIGRATE[d] || 'normal'); }

/* ----------------------------------------------------------------------------
   2. Settings (localStorage)
   ---------------------------------------------------------------------------- */
const store = {
  load(k, d){ try { const v = localStorage.getItem('slimewk_'+k); return v===null?d:JSON.parse(v); } catch(e){ return d; } },
  save(k, v){ try { localStorage.setItem('slimewk_'+k, JSON.stringify(v)); } catch(e){} }
};
const settings = {
  sound:     store.load('sound', true),
  crt:       store.load('crt', false),            // retro scanlines OFF by default (toggle in settings)
  matchMode: store.load('matchMode', 'goals'),   // 'goals' | 'time'
  toWin:     store.load('toWin', 5),
  matchMin:  store.load('matchMin', 2),           // match length in minutes (time mode)
  diff:      normDiff(store.load('diff', 'normal')),
  volume:    clamp01(store.load('volume', 0.7)),   // master volume 0..1
  wkMin:     store.load('wkMin', 2),               // World Cup: minutes per match
  wkDiff:    store.load('wkDiff', 'rising'),        // World Cup: 'rising' | easy|normal|hard|worldcup
  lang:      store.load('lang', 'en'),             // UI language: 'en' | 'nl'
  powerups:  store.load('powerups', false),        // Friendly bonus mode: power-ups drop onto the pitch
  deskSize:  store.load('deskSize', 'm'),          // desktop play-field size: 'm' (1×) | 'l' (1.5×) | 'full'
};
function clamp01(v){ v=+v; return isNaN(v)?0.7:(v<0?0:v>1?1:v); }
// drop retired longest modes (8 min / 10 goals) from any older saved settings
if ([3,5,7].indexOf(settings.toWin)<0) settings.toWin=5;
if ([1,2,4].indexOf(settings.matchMin)<0) settings.matchMin=2;

/* ----------------------------------------------------------------------------
   i18n — English (default) + Dutch. The game name "Slime World Cup" and the
   event name "World Cup" stay English; everything else translates. Missing keys
   fall back to English so a coverage gap shows English text, never breaks.
   ---------------------------------------------------------------------------- */
const I18N = {
  en: {
    teamLeft:'LEFT TEAM', teamRight:'RIGHT TEAM', tagline:'slime soccer · a modern remake ⚽',
    grp1p:'1 Player', grp1pSub:'· keyboard or touch', grpMulti:'Multiplayer', grp1pHtml:'1 Player <span>· keyboard or touch</span>',
    mFriendly:'⚽ Friendly', mWorldCup:'🏆 World Cup 2026', m2p:'2 Players · same device', mOnline:'🌐 Online',
    tagHost:'WORLD CUP 2026 · USA · MEXICO · CANADA',
    pickYourCountry:'Pick <b>your</b> country', pickP1:'Player <b>1</b> (left): pick your country', pickOpp:'Pick the <b>opponent</b>',
    pickWC:'Pick <b>your</b> country · WORLD CUP 2026 🇺🇸🇲🇽🇨🇦', back:'‹ Back',
    online:'ONLINE', onlineSub:'P2P connection · no account needed',
    playFriend:'👥 Play a friend', quickMatch:'⚡ Quick match',
    onlineIntro:'⏱ <b>2-minute</b> timed matches — most goals wins.<br><b>👥 Play a friend</b> — share a code with someone you know.<br><b>⚡ Quick match</b> — get paired with a random online player.',
    lobbyCount:'🟢 {w} searching · {p} in a match', lobbyEmpty:'🟢 No one online right now',
    hostGame:'🎮 Host a game', enterCode:'🔑 Enter a code', codeForOpp:'Code for your opponent:',
    waShare:'📲 WhatsApp', copyLink:'🔗 Copy link', pickStart:'▶ Pick team & start',
    enterHostCode:'Enter the host’s code:', connect:'Connect', findingOpp:'⚡ Finding you an opponent…', cancel:'Cancel',
    peerWarn:'⚠ Online needs internet (PeerJS failed to load). Local modes still work.',
    hostOrJoin:'Host a game, or enter a friend’s code.', connLost:'Connection lost.',
    matchup:'MATCHUP', you:'YOU', opponent:'OPPONENT', startMatch:'▶ Start match',
    sidesRandom:'Sides are randomised — watch the kickoff! ⚽', bothChosen:'Both countries chosen — start when ready!',
    waitHostStart:'Waiting for the host to start…',
    setFriendly:'⚽ FRIENDLY', set2p:'👥 2 PLAYERS', setWC:'🏆 WORLD CUP',
    setSub:'Pick your level & match format', setSubWC:'Set up your tournament, then pick your country',
    computerLevel:'Computer level', matchFormat:'Match format', matchLength:'Match length',
    continueTeams:'▶ Continue to teams', continueCountry:'▶ Continue to country', goals:'Goals', timed:'Timed',
    diffEasy:'Easy', diffNormal:'Normal', diffHard:'Hard', diffWorldCup:'World Cup', diffWC:'WC', diffRising:'Rising ↑',
    keys1p:'⌨ <b>Player 1</b> — WASD: <b>A</b>/<b>D</b> move · <b>W</b> jump · <b>S</b> hold ball',
    keys2p:'⌨ <b>Player 1</b> WASD: A/D · W · S &nbsp;·&nbsp; <b>Player 2</b> arrows: ←/→ · ↑ · ↓',
    sure:'ARE YOU SURE?', yes:'Yes', endWC:'END WORLD CUP?', endWCmsg:'You’ll lose your tournament progress.',
    endTournament:'🏳️ End tournament', keepPlaying:'▶️ Keep playing',
    rematchTitle:'REMATCH', rematchMsg:'Keep the same teams or pick new ones?', newTeams:'🎲 New teams', sameTeams:'🔁 Same teams',
    settings:'SETTINGS', sound:'Sound', volume:'Volume', crt:'CRT effect', matchType:'Match type',
    firstTo:'First to', matchLenMin:'Match length (min)', language:'Language', on:'ON', off:'OFF', matchTime:'Match time',
    powerups:'Power-ups ⚡', powerupsHint:'Friendly only',
    powSpeed:'Super speed', powJump:'Super jump', powBig:'Bigger', powFreeze:'Freeze', powShot:'Power shot', powShrink:'You shrink',
    youWin:'YOU WIN!', cpuWins:'COMPUTER WINS', oppWins:'OPPONENT WINS', playerWins:'PLAYER {n} WINS!',
    waitHostRestart:'Waiting for the host to restart…', putName:'Put your name on the leaderboard:',
    yourName:'YOUR NAME', submit:'🏆 Submit', rematch:'🔁 Rematch', highScores:'🏆 High scores', mainMenu:'🏠 Main menu',
    hsTitle:'🏆 HIGH SCORES', hsSub:'World Cup runs · points by difficulty', loading:'loading…',
    lbNone:'No scores yet — be the first! ⚽', lbFail:'Could not load leaderboard (offline?).', lbNA:'Leaderboard not available.', pts:'pts',
    yourPos:'🎯 Your position: #{n} · {p} pts',
    wcTitle:'WORLD CUP', r16:'Round of 16', qf:'Quarter-final', sf:'Semi-final', final:'Final',
    youAre:'You:', playVs:'▶ Play vs {opp}', newTournament:'New tournament', champions:'🏆 WORLD CHAMPIONS 2026!',
    championsSub:'<b>{team}</b> are world champions — lifted in New York/New Jersey! ⚽🎉',
    knockedOut:'Knocked out', knockedOutSub:'You went out in the <b>{round}</b>.{champ} Try again!',
    championsTag:' Champions: <b>{name}</b>.', points:'points', submitPts:'🏆 Submit {n} pts', submitted:'✓ Submitted',
    submitting:'Submitting...', submittedOk:'Submitted! ⚽', submitFail:'Failed (offline?)',
    paused:'PAUSED', pressEsc:'Press ESC to resume', quitLeaves:'Quitting leaves the tournament',
    resume:'▶️ Resume', quitMenu:'🏠 Quit to menu', pauseBtn:'⏸ Pause', quitBtn2:'✕ Quit',
    rotate:'Rotate your device to landscape<br>for the best experience ⚽',
    playHint:'<b>Player 1</b> — WASD <b>or</b> arrows: ←/→ move · ↑/W/Space jump · ↓/S hold ball · double-tap jump = higher · ESC = pause',
    playHint2p:'<b>Player 1</b> WASD (A/D · W · S) &nbsp;·&nbsp; <b>Player 2</b> arrows (←/→ · ↑ · ↓) &nbsp;·&nbsp; ESC = pause',
    rulesTitle:'HOW TO PLAY', rulesControls:'Controls', rulesMoves:'Moves', rulesRules:'Rules', rulesModes:'Modes', rulesBtn:'❓ How to play',
    rulesControlsTxt:'<b>Player 1</b> — WASD: A/D move, W jump, S hold ball (or touch controls).<br><b>Player 2</b> — arrow keys: ←/→ move, ↑ jump, ↓ hold ball.',
    rulesMovesTxt:'<b>Double jump</b> — tap jump again in mid-air for an extra boost to reach high balls.<br><b>Catch &amp; throw</b> — hold the catch key by the ball to grab it (up to ~3s), then release to throw it upfield.',
    rulesRulesTxt:'<b>No goal-hanging</b> — lingering in your own goal area gets you sent out (mind the warning flash).<br><b>Golden goal</b> — a tied timed match goes to sudden death: the next goal wins.',
    rulesModesTxt:'<b>Friendly</b> — first to a set number of goals, or a timed match.<br><b>World Cup</b> — 16-team knockout; win 4 rounds to be champion and post your score.<br><b>Online</b> — 2-minute matches vs a friend (share a code) or a random opponent.<br><b>Power-ups ⚡</b> — Friendly bonus (tick it on setup): grab the drops — ⚡ super speed · 🌙 super jump · 💪 bigger · ❄️ freeze · 🔥 power shot · 🔻 you shrink (red — careful!).',
  },
  nl: {
    teamLeft:'TEAM LINKS', teamRight:'TEAM RECHTS', tagline:'slime voetbal · een moderne remake ⚽',
    grp1p:'1 Speler', grp1pSub:'· toetsenbord of touch', grpMulti:'Multiplayer', grp1pHtml:'1 Speler <span>· toetsenbord of touch</span>',
    mFriendly:'⚽ Oefenpotje', mWorldCup:'🏆 World Cup 2026', m2p:'2 Spelers · zelfde toestel', mOnline:'🌐 Online',
    tagHost:'WORLD CUP 2026 · USA · MEXICO · CANADA',
    pickYourCountry:'Kies <b>jouw</b> land', pickP1:'Speler <b>1</b> (links): kies je land', pickOpp:'Kies de <b>tegenstander</b>',
    pickWC:'Kies <b>jouw</b> land · WORLD CUP 2026 🇺🇸🇲🇽🇨🇦', back:'‹ Terug',
    online:'ONLINE', onlineSub:'P2P-verbinding · geen account nodig',
    playFriend:'👥 Tegen een vriend', quickMatch:'⚡ Snelle match',
    onlineIntro:'⏱ <b>2-minuten</b> wedstrijden — meeste goals wint.<br><b>👥 Tegen een vriend</b> — deel een code met iemand die je kent.<br><b>⚡ Snelle match</b> — speel tegen een willekeurige speler.',
    lobbyCount:'🟢 {w} zoeken · {p} in een wedstrijd', lobbyEmpty:'🟢 Niemand online op dit moment',
    hostGame:'🎮 Maak een spel', enterCode:'🔑 Voer code in', codeForOpp:'Code voor je tegenstander:',
    waShare:'📲 WhatsApp', copyLink:'🔗 Kopieer link', pickStart:'▶ Kies team & start',
    enterHostCode:'Voer de code van de host in:', connect:'Verbinden', findingOpp:'⚡ Tegenstander zoeken…', cancel:'Annuleren',
    peerWarn:'⚠ Online vereist internet (PeerJS niet geladen). Lokale modi werken wel.',
    hostOrJoin:'Maak een spel, of voer de code van een vriend in.', connLost:'Verbinding verbroken.',
    matchup:'WEDSTRIJD', you:'JIJ', opponent:'TEGENSTANDER', startMatch:'▶ Start wedstrijd',
    sidesRandom:'Kanten zijn willekeurig — let op de aftrap! ⚽', bothChosen:'Beide landen gekozen — start wanneer je klaar bent!',
    waitHostStart:'Wachten tot de host start…',
    setFriendly:'⚽ OEFENPOTJE', set2p:'👥 2 SPELERS', setWC:'🏆 WORLD CUP',
    setSub:'Kies je niveau & wedstrijdvorm', setSubWC:'Stel je toernooi in, kies daarna je land',
    computerLevel:'Computerniveau', matchFormat:'Wedstrijdvorm', matchLength:'Wedstrijdduur',
    continueTeams:'▶ Verder naar teams', continueCountry:'▶ Verder naar land', goals:'Goals', timed:'Tijd',
    diffEasy:'Makkelijk', diffNormal:'Normaal', diffHard:'Moeilijk', diffWorldCup:'World Cup', diffWC:'WC', diffRising:'Oplopend ↑',
    keys1p:'⌨ <b>Speler 1</b> — WASD: <b>A</b>/<b>D</b> bewegen · <b>W</b> springen · <b>S</b> bal vasthouden',
    keys2p:'⌨ <b>Speler 1</b> WASD: A/D · W · S &nbsp;·&nbsp; <b>Speler 2</b> pijlen: ←/→ · ↑ · ↓',
    sure:'WEET JE HET ZEKER?', yes:'Ja', endWC:'WORLD CUP STOPPEN?', endWCmsg:'Je verliest je toernooivoortgang.',
    endTournament:'🏳️ Toernooi stoppen', keepPlaying:'▶️ Doorspelen',
    rematchTitle:'REVANCHE', rematchMsg:'Zelfde teams of nieuwe kiezen?', newTeams:'🎲 Nieuwe teams', sameTeams:'🔁 Zelfde teams',
    settings:'INSTELLINGEN', sound:'Geluid', volume:'Volume', crt:'CRT-effect', matchType:'Wedstrijdtype',
    firstTo:'Eerste tot', matchLenMin:'Wedstrijdduur (min)', language:'Taal', on:'AAN', off:'UIT', matchTime:'Op tijd',
    powerups:'Power-ups ⚡', powerupsHint:'Alleen Oefenpotje',
    powSpeed:'Supersnelheid', powJump:'Supersprong', powBig:'Groter', powFreeze:'Bevriezen', powShot:'Powerschot', powShrink:'Jij krimpt',
    youWin:'JIJ WINT!', cpuWins:'COMPUTER WINT', oppWins:'TEGENSTANDER WINT', playerWins:'SPELER {n} WINT!',
    waitHostRestart:'Wachten tot de host herstart…', putName:'Zet je naam op de ranglijst:',
    yourName:'JOUW NAAM', submit:'🏆 Verstuur', rematch:'🔁 Opnieuw', highScores:'🏆 Toplijst', mainMenu:'🏠 Hoofdmenu',
    hsTitle:'🏆 TOPSCORES', hsSub:'World Cup-runs · punten per niveau', loading:'laden…',
    lbNone:'Nog geen scores — wees de eerste! ⚽', lbFail:'Kan ranglijst niet laden (offline?).', lbNA:'Ranglijst niet beschikbaar.', pts:'ptn',
    yourPos:'🎯 Jouw positie: #{n} · {p} ptn',
    wcTitle:'WORLD CUP', r16:'Achtste finale', qf:'Kwartfinale', sf:'Halve finale', final:'Finale',
    youAre:'Jij:', playVs:'▶ Speel tegen {opp}', newTournament:'Nieuw toernooi', champions:'🏆 WERELDKAMPIOEN 2026!',
    championsSub:'<b>{team}</b> is wereldkampioen — gehuldigd in New York/New Jersey! ⚽🎉',
    knockedOut:'Uitgeschakeld', knockedOutSub:'Je ging eruit in de <b>{round}</b>.{champ} Probeer opnieuw!',
    championsTag:' Kampioen: <b>{name}</b>.', points:'punten', submitPts:'🏆 Verstuur {n} ptn', submitted:'✓ Verstuurd',
    submitting:'Versturen...', submittedOk:'Verstuurd! ⚽', submitFail:'Mislukt (offline?)',
    paused:'GEPAUZEERD', pressEsc:'Druk ESC om door te gaan', quitLeaves:'Stoppen verlaat het toernooi',
    resume:'▶️ Doorgaan', quitMenu:'🏠 Terug naar menu', pauseBtn:'⏸ Pauze', quitBtn2:'✕ Stoppen',
    rotate:'Draai je toestel horizontaal<br>voor de beste ervaring ⚽',
    playHint:'<b>Speler 1</b> — WASD <b>of</b> pijltjes: ←/→ bewegen · ↑/W/Spatie springen · ↓/S bal vast · dubbeltik = hoger · ESC = pauze',
    playHint2p:'<b>Speler 1</b> WASD (A/D · W · S) &nbsp;·&nbsp; <b>Speler 2</b> pijlen (←/→ · ↑ · ↓) &nbsp;·&nbsp; ESC = pauze',
    rulesTitle:'ZO SPEEL JE', rulesControls:'Besturing', rulesMoves:'Acties', rulesRules:'Regels', rulesModes:'Modi', rulesBtn:'❓ Zo speel je',
    rulesControlsTxt:'<b>Speler 1</b> — WASD: A/D bewegen, W springen, S bal vasthouden (of touch).<br><b>Speler 2</b> — pijltjestoetsen: ←/→ bewegen, ↑ springen, ↓ bal vasthouden.',
    rulesMovesTxt:'<b>Dubbele sprong</b> — tik in de lucht nogmaals op springen voor een extra zet naar hoge ballen.<br><b>Vangen en gooien</b> — houd de vang-toets ingedrukt bij de bal om hem te pakken (max ~3s), laat los om hem naar voren te gooien.',
    rulesRulesTxt:'<b>Niet in je goal hangen</b> — te lang in je eigen doelgebied blijven stuurt je weg (let op de waarschuwing).<br><b>Golden goal</b> — een gelijke wedstrijd op tijd gaat naar sudden death: de volgende goal wint.',
    rulesModesTxt:'<b>Oefenpotje</b> — eerste bij een aantal goals, of op tijd.<br><b>World Cup</b> — knock-out met 16 landen; win 4 rondes om wereldkampioen te worden en je score te plaatsen.<br><b>Online</b> — wedstrijden van 2 minuten tegen een vriend (deel een code) of een willekeurige speler.<br><b>Power-ups ⚡</b> — bonus in het Oefenpotje (vink aan bij instellen): pak de drops — ⚡ supersnelheid · 🌙 supersprong · 💪 groter · ❄️ bevriezen · 🔥 powerschot · 🔻 jij krimpt (rood — pas op!).',
  },
};
const NL_NAMES = { NED:'Nederland', ARG:'Argentinië', BRA:'Brazilië', FRA:'Frankrijk', ENG:'Engeland', ESP:'Spanje',
  GER:'Duitsland', POR:'Portugal', EGY:'Egypte', CRO:'Kroatië', MAR:'Marokko', JPN:'Japan', MEX:'Mexico', USA:'USA',
  CAN:'Canada', BEL:'België', URU:'Uruguay', SEN:'Senegal', SUI:'Zwitserland', COL:'Colombia', RSA:'Zuid-Afrika', SWE:'Zweden',
  CUW:'Curaçao', ALG:'Algerije' };
function t(key, vars){
  let s = (I18N[settings.lang] && I18N[settings.lang][key]);
  if (s==null) s = I18N.en[key];
  if (s==null) s = key;
  if (vars) for (const k in vars) s = s.split('{'+k+'}').join(vars[k]);
  return s;
}
function teamName(tm){ return settings.lang==='nl' ? (NL_NAMES[tm.code]||tm.name) : tm.name; }
const _AI_KEY = { easy:'diffEasy', normal:'diffNormal', hard:'diffHard', worldcup:'diffWorldCup', rising:'diffRising' };
function aiLabel(d){ return t(_AI_KEY[d]||'diffNormal'); }   // translated difficulty label (for display)
function applyStaticI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-html]').forEach(el=>{ el.innerHTML = t(el.getAttribute('data-i18n-html')); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el=>{ el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{ el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  try{ document.documentElement.lang = settings.lang; }catch(_){}
}

/* ----------------------------------------------------------------------------
   3. Audio
   Background music = audio extracted from the uploaded mp4 (looping, HTML5 media).
   Cheering at goals/wins = synth crowd-swell + stadium horn (Web Audio).
   Final whistle at match end = uploaded mp3 stinger. Other match SFX removed.
   Everything stops when the tab/app is hidden or closed.
   ---------------------------------------------------------------------------- */
const Audio = (() => {
  let ac = null, master = null, crowd = null, crowdGain = null;
  let bgm = null, sfxWhistle = null, musicWanted = false;
  function ensure(){
    if (ac) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.6*settings.volume; master.connect(ac.destination);
      startCrowd();
    } catch(e){ ac = null; }
  }
  // HTML5 media elements: looping background track + final-whistle stinger
  function media(){
    try {
      if (bgm || typeof window==='undefined' || !window.Audio) return;
      bgm = new window.Audio('assets/audio/bg-music.mp3'); bgm.loop = true; bgm.preload = 'auto'; bgm.volume = 0.5*settings.volume;
      sfxWhistle = new window.Audio('assets/audio/whistle.mp3'); sfxWhistle.preload = 'auto'; sfxWhistle.volume = 0.9*settings.volume;
    } catch(e){ bgm = null; sfxWhistle = null; }
  }
  function playMusic(){ musicWanted = true; if (bgm && settings.sound){ bgm.play().catch(()=>{}); } }
  function pauseMusic(){ if (bgm){ try{ bgm.pause(); }catch(e){} } }
  function resumeMusic(){ if (bgm && musicWanted && settings.sound){ bgm.play().catch(()=>{}); } }
  function startCrowd(){
    // crowd-noise source kept ONLY for goal/win swells — no constant ambience (mp4 is the bg)
    const buf = ac.createBuffer(1, ac.sampleRate*2, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*0.5;
    crowd = ac.createBufferSource(); crowd.buffer = buf; crowd.loop = true;
    const bp = ac.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=520; bp.Q.value=0.6;
    crowdGain = ac.createGain(); crowdGain.gain.value = 0;        // silent until a goal/win swell
    crowd.connect(bp); bp.connect(crowdGain); crowdGain.connect(master);
    crowd.start();
  }
  function osc(type, f, t0, dur, vol, slideTo, filterHz){
    if (!ac) return;
    const o=ac.createOscillator(), g=ac.createGain();
    o.type=type; o.frequency.setValueAtTime(f,t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1,slideTo), t0+dur);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(vol,t0+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    if (filterHz){ const lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=filterHz; o.connect(lp); lp.connect(g); }
    else o.connect(g);
    g.connect(master); o.start(t0); o.stop(t0+dur+0.03);
  }
  function noiseHit(t0, dur, vol, type, hz){
    if (!ac) return;
    const n=Math.floor(ac.sampleRate*dur), buf=ac.createBuffer(1,n,ac.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const s=ac.createBufferSource(); s.buffer=buf;
    const f=ac.createBiquadFilter(); f.type=type||'lowpass'; f.frequency.value=hz||1000;
    const g=ac.createGain(); g.gain.value=vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(t0);
  }
  function hornNote(t0, f, dur, vol){
    osc('sawtooth', f, t0, dur, vol, null, 1100);
    osc('sawtooth', f*1.006, t0, dur, vol*0.65, null, 1100);   // detune = warmth
  }
  function crowdSwell(t, peak){
    if (!crowdGain) return;
    crowdGain.gain.cancelScheduledValues(t);
    crowdGain.gain.setValueAtTime(0.0001,t);
    crowdGain.gain.linearRampToValueAtTime(peak,t+0.18);
    crowdGain.gain.exponentialRampToValueAtTime(0.0001,t+2.6);
  }
  const NOOP = ()=>{};
  const api = {
    unlock(){ ensure(); media(); if (ac && ac.state==='suspended') ac.resume(); playMusic(); },
    // minor match SFX intentionally removed — background music + cheering only
    kick:NOOP, wall:NOOP, jump:NOOP, post:NOOP, count:NOOP, whistle:NOOP,
    // cheering at goals and at the win (synth crowd swell + stadium horn)
    goal(){
      if(!settings.sound||!ac) return; const t=ac.currentTime;
      hornNote(t,180,0.8,0.16); hornNote(t,226,0.8,0.13); hornNote(t+0.05,270,0.72,0.12);
      noiseHit(t,0.6,0.14,'bandpass',900);
      crowdSwell(t,0.6);
    },
    win(){ if(!settings.sound||!ac) return; const t=ac.currentTime;
      [[262,0],[330,0.2],[392,0.4],[523,0.6],[523,0.95]].forEach(([f,dt])=>hornNote(t+dt,f,0.55,0.14));
      noiseHit(t,1.0,0.14,'bandpass',900); crowdSwell(t,0.75); },
    // real final-whistle stinger (from the uploaded mp3)
    endWhistle(){ if(!settings.sound) return; if(!sfxWhistle) media(); if(sfxWhistle){ try{ sfxWhistle.currentTime=0; sfxWhistle.play().catch(()=>{}); }catch(e){} } },
    click(){ if(!ac||!settings.sound) return; const t=ac.currentTime; osc('sine',520,t,0.03,0.06,null,1400); },
    // rising 3-note chime when an online opponent connects ("matched!")
    matched(){ if(!ac||!settings.sound) return; const t=ac.currentTime;
      [[523,0],[659,0.10],[784,0.20]].forEach(([f,dt])=>osc('triangle',f,t+dt,0.12,0.16,null,2200)); },
    setSound(on){ if(on) resumeMusic(); else pauseMusic(); },
    setVolume(v){ if(master) master.gain.value = 0.6*v; if(bgm) bgm.volume = 0.5*v; if(sfxWhistle) sfxWhistle.volume = 0.9*v; },
    pause:pauseMusic, resume:resumeMusic,
    setCrowd:NOOP,                                  // kept for compatibility
  };
  return api;
})();
// background music stops when the tab/app is hidden and resumes when visible (and on close)
if (typeof document!=='undefined' && document.addEventListener){
  document.addEventListener('visibilitychange', ()=>{ if (document.hidden) Audio.pause(); else Audio.resume(); });
  addEventListener('pagehide', ()=>Audio.pause());
}
// light haptic feedback (mobile); no-op on desktop / unsupported
function haptic(p){ try { if (typeof navigator!=='undefined' && navigator.vibrate) navigator.vibrate(p); } catch(e){} }

/* ----------------------------------------------------------------------------
   4. Input  (toetsenbord + touch)
   ---------------------------------------------------------------------------- */
const keys = {};
const blockKeys = new Set([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.code) keys[e.code.toLowerCase()] = true;            // also track ShiftLeft/ShiftRight/Space by code
  if (blockKeys.has(e.key) || e.code==='Space') e.preventDefault();
  if (e.key === 'Escape') onEscape();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; if (e.code) keys[e.code.toLowerCase()] = false; });

// touch-input flags (D / D2 = catch/hold-ball button)
const touch = { L:false, R:false, J:false, D:false, L2:false, R2:false, J2:false, D2:false };
const BTN_PROP = { btnL:'L', btnR:'R', btnJ:'J', btnC:'D', btn2L:'L2', btn2R:'R2', btn2J:'J2', btn2C:'D2' };
const activePointers = new Map();   // pointerId -> button-id
// Hit-testing is coordinate-based against ENLARGED zones (cached) instead of
// elementFromPoint, so a press just above/below/between buttons still registers
// — this is what made the slime feel unresponsive on touch.
let btnZones = [];
function refreshBtnZones(){
  btnZones = [];
  const layer = document.getElementById('touch');
  if (!layer || !layer.classList.contains('show')) return;
  const EG = 40, vw = window.innerWidth, vh = window.innerHeight, EGB = 30;   // bigger keep-out off the browser/iOS edge-swipe strips (sides + bottom home-indicator)
  layer.querySelectorAll('.pad').forEach(pad=>{
    if (pad.offsetParent === null) return;            // skip hidden pads (pad2 in 1P)
    pad.querySelectorAll('.tbtn').forEach(b=>{
      if (!BTN_PROP[b.id]) return;
      const r = b.getBoundingClientRect();
      if (!r.width) return;
      // forgiving tap zone — generous toward the pitch (up) but trimmed toward the
      // nearer screen edge so a thumb can't slide off the button into an edge-swipe.
      const padIn = Math.max(40, r.width*0.7), padOut = 18, padY = Math.max(96, r.height*1.9);
      const left = r.left < vw/2;                     // pad nearer the left edge?
      btnZones.push({ id:b.id,
                      l:Math.max(EG, r.left-(left?padOut:padIn)),
                      r:Math.min(vw-EG, r.right+(left?padIn:padOut)),
                      t:r.top-padY, b:Math.min(vh-EGB, r.bottom+padY),
                      cx:(r.left+r.right)/2, cy:(r.top+r.bottom)/2 });
    });
  });
}
function btnIdAt(x,y){
  let best=null, bestD=Infinity, near=null, nearD=Infinity;
  for (const z of btnZones){
    const dx=x-z.cx, dy=y-z.cy, d=dx*dx+dy*dy;
    if (x>=z.l && x<=z.r && y>=z.t && y<=z.b){ if (d<bestD){ bestD=d; best=z.id; } }   // nearest centre wins where zones overlap
    if (d<nearD){ nearD=d; near=z.id; }
  }
  if (best) return best;
  return nearD < 120*120 ? near : null;        // just-outside taps still grab the closest pad
}
function setBtn(id, on){
  const p = BTN_PROP[id]; if (p) touch[p] = on;
  const el = document.getElementById(id); if (el) el.classList.toggle('pressed', on);   // visual feedback
}
function routePointer(pid, id){
  const prev = activePointers.get(pid);
  if (prev === id) return;
  if (prev) setBtn(prev, false);
  if (id){ setBtn(id, true); activePointers.set(pid, id); }
  else activePointers.delete(pid);
}
function clearPointer(pid){ const prev = activePointers.get(pid); if (prev) setBtn(prev, false); activePointers.delete(pid); }
(function bindTouchRouter(){
  addEventListener('pointerdown', e=>{
    if (!btnZones.length) return;                      // only active while touch controls are shown
    const id = btnIdAt(e.clientX, e.clientY);
    if (!id) return;                                   // not near a button -> let the event pass
    e.preventDefault();
    routePointer(e.pointerId, id);
  }, { passive:false });
  // glijden tussen knoppen: hertarget op basis van vingerpositie
  addEventListener('pointermove', e=>{
    if (!activePointers.has(e.pointerId)) return;
    routePointer(e.pointerId, btnIdAt(e.clientX, e.clientY));
  });
  const end = e=>{ if (activePointers.has(e.pointerId)) clearPointer(e.pointerId); };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
})();

// Block phone gestures that interrupt play: the long-press context menu / loupe, and
// Safari's pinch-zoom. (The home-indicator swipe to the app switcher is an OS gesture
// the web can't override — standalone-PWA mode keeps it to a deliberate two-step swipe.)
addEventListener('contextmenu', e=>{ if (!/^(INPUT|TEXTAREA)$/.test((e.target&&e.target.tagName)||'')) e.preventDefault(); }, { passive:false });
['gesturestart','gesturechange','gestureend'].forEach(ev=>addEventListener(ev, e=>e.preventDefault(), { passive:false }));

const IS_TOUCH = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;

// read keyset -> {left,right,jump,down}.  Hold ball: P1 = Left Shift / S, P2 = Space / Right Shift / ↓
function wasdInput(){ return { left: !!keys['a'], right: !!keys['d'], jump: !!keys['w'], down: !!keys['s']||!!keys['shiftleft'] }; }
function arrowsInput(){ return { left: !!keys['arrowleft'], right: !!keys['arrowright'], jump: !!keys['arrowup'], down: !!keys['arrowdown']||!!keys['space']||!!keys['shiftright'] }; }
// primary human (1P / online): arrows or WASD move; jump = ↑/W/Space/RightShift; hold ball = ↓/S
function humanInput(){
  return {
    left:  !!keys['a'] || !!keys['arrowleft']  || touch.L,
    right: !!keys['d'] || !!keys['arrowright'] || touch.R,
    jump:  !!keys['w'] || !!keys['arrowup'] || !!keys['space'] || !!keys['shiftright'] || touch.J,
    down:  !!keys['s'] || !!keys['arrowdown'] || touch.D,
  };
}
// local 2P: player 1 = WASD (S = hold), player 2 = arrows (↓ = hold)
function p1KeyInput(){ return { left: !!keys['a']||touch.L, right: !!keys['d']||touch.R, jump: !!keys['w']||touch.J, down: !!keys['s']||touch.D }; }
function p2KeyInput(){ return { left: !!keys['arrowleft']||touch.L2, right: !!keys['arrowright']||touch.R2, jump: !!keys['arrowup']||touch.J2, down: !!keys['arrowdown']||touch.D2 }; }

/* ----------------------------------------------------------------------------
   5. Entities
   ---------------------------------------------------------------------------- */
function makeSlime(side, team){
  return {
    side, team,
    x: side==='left' ? W*0.25 : W*0.75,
    y: GROUND, vx:0, vy:0,
    onGround:true,
    eyeX:0, eyeY:0,        // pupil offset (looks at the ball)
    squash:0,              // landing/jump animation
    hang:0, penalty:0,     // anti-goal-camping timer + penalty flash
    holding:false, holdT:0, catchCD:0,   // ball-catch (hold down) state
    jumpWasDown:false, lastJumpFrame:-99, canDouble:false,   // double-tap = double jump
    coyote:0, jumpBuffer:0,                                   // jump grace (coyote + small pre-land buffer)
    aiCatchT:0,                          // AI hold-ball timer
    fx:null, frozen:0, powShot:0,        // power-ups: active effect {type,t,dur} · freeze frames · power-shot window
    input:{left:false,right:false,jump:false,down:false},
  };
}
function makeBall(){ return { x:CENTER, y:GROUND-260, vx:0, vy:0, spin:0, held:null }; }

/* ----------------------------------------------------------------------------
   6. Game-state
   ---------------------------------------------------------------------------- */
const SCREEN = { MENU:'menu', TEAM:'team', ONLINE:'online', COUNT:'count', PLAY:'play', GOAL:'goal', OVER:'over', PAUSE:'pause' };
const G = {
  screen: SCREEN.MENU,
  mode: '1p',              // '1p' | '2p' | 'host' | 'guest'
  p1: null, p2: null, ball: null,
  score:[0,0],
  toWin: settings.toWin,
  matchMode: settings.matchMode,   // 'goals' | 'time'
  matchMin: settings.matchMin,
  matchTime: 0,                    // resterende frames (tijd-modus)
  golden: false,                   // golden goal (sudden death) na gelijkspel op tijd
  wkMode: false,                   // World Cup tournament active
  wk: null,                        // tournament state
  powerMode: false,                // Friendly power-ups mode active this match
  pows: [],                        // falling/landed power-up pickups
  powTimer: 0,                     // frames until the next pickup drops
  attract: false,                  // menu "attract mode": two slimes idling on the pitch
  countdown: 0,            // frames
  goalTimer: 0,            // frames in GOAL-state
  lastScorer: 0,
  winner: 0,
  swap: false,             // online: teams swapped L/R this match
  mySlot: 1,               // online: which slot (1=left/p1, 2=right/p2) the local player controls
  shake: 0,
  flash: 0,
  particles: [],
  net: null,               // online controller
  paused:false,
  // online guest render-target
  netTarget: null,
  frame: 0,
};

/* ----------------------------------------------------------------------------
   7. Particles
   ---------------------------------------------------------------------------- */
function spawnDust(x,y,n,col){
  for(let i=0;i<n;i++) G.particles.push({
    x,y, vx:(Math.random()-0.5)*4, vy:-Math.random()*3-1,
    life:24+Math.random()*16, max:40, r:2+Math.random()*2, col, g:0.18
  });
}
function spawnConfetti(){
  const cols=['#ff7a18','#ffae3b','#ffffff','#34d17a','#ff5470','#7cc0ee'];
  for(let i=0;i<160;i++) G.particles.push({
    x:Math.random()*W, y:-10-Math.random()*120,
    vx:(Math.random()-0.5)*3, vy:Math.random()*2+1,
    life:120+Math.random()*80, max:200, r:3+Math.random()*3,
    col:cols[(Math.random()*cols.length)|0], g:0.06, conf:true, rot:Math.random()*6
  });
}
function updateParticles(){
  for(let i=G.particles.length-1;i>=0;i--){
    const p=G.particles[i];
    p.vy += p.g; p.x += p.vx; p.y += p.vy; p.life--;
    if (p.conf) p.rot += p.vx*0.1;
    if (p.life<=0 || p.y>H+20) G.particles.splice(i,1);
  }
}

/* ----------------------------------------------------------------------------
   8. Physics / simulatie
   ---------------------------------------------------------------------------- */
function clamp(v,a,b){ return v<a?a:v>b?b:v; }

/* ---- Power-ups (Friendly bonus mode): pickup types + per-slime effect helpers ---- */
const POWER_TYPES = {
  turbo:  { e:'⚡', c:'#ffd23b', dur:480, good:true },   // run 1.5x for 8s
  moon:   { e:'🌙', c:'#7cc0ee', dur:480, good:true },   // jump 1.33x for 8s
  mega:   { e:'💪', c:'#34d17a', dur:540, good:true },   // grow 1.38x for 9s
  freeze: { e:'❄️', c:'#9bd0f8', dur:150, good:true },   // opponent frozen 2.5s
  shot:   { e:'🔥', c:'#ff8a3c', dur:600, good:true },   // next ball contact 1.65x speed (10s window)
  shrink: { e:'🔻', c:'#ff4040', dur:420, bad:true  },   // NEGATIVE: YOU shrink to 0.62x for 7s
};
function fxType(s){ return s.fx ? s.fx.type : null; }
function slimeR(s){ const f=fxType(s); return SLIME_R * (f==='mega'?1.38 : f==='shrink'?0.62 : 1); }   // physics + drawing both use the live radius

function updateSlime(s){
  // power-up effect timers (only ticked here, i.e. during live play)
  if (s.fx && --s.fx.t <= 0) s.fx = null;
  if (s.powShot > 0) s.powShot--;
  if (s.frozen > 0) s.frozen--;
  const i = s.frozen>0 ? {left:false,right:false,jump:false,down:false} : s.input;
  if (s.catchCD>0) s.catchCD--;
  const sp = SLIME_SPEED * (s.speedMul || 1) * (fxType(s)==='turbo' ? 1.5 : 1);   // AI levels can run faster (speedMul); ⚡ turbo on top
  s.vx = (i.right?sp:0) - (i.left?sp:0);
  s.x += s.vx;
  // full-field movement (you can chase the opponent to steal a held ball)
  s.x = clamp(s.x, slimeR(s)*0.5, W - slimeR(s)*0.5);
  // jumping — double-tap = one mid-air boost; plus coyote grace + a tiny pre-land buffer
  const jm = fxType(s)==='moon' ? 1.33 : 1;                  // 🌙 moon-jump boost
  const edge = i.jump && !s.jumpWasDown;
  s.jumpWasDown = i.jump;
  if (s.onGround) s.coyote = COYOTE_FRAMES; else if (s.coyote>0) s.coyote--;
  if (s.jumpBuffer>0) s.jumpBuffer--;
  if (edge){
    if (s.onGround || s.coyote>0){
      s.vy = -SLIME_JUMP*jm; s.onGround=false; s.coyote=0; s.squash=-0.18; s.canDouble=true; s.lastJumpFrame=G.frame; Audio.jump();
    } else if (s.canDouble && (G.frame - s.lastJumpFrame) < 16){
      s.vy = -SLIME_JUMP * 1.05 * jm; s.canDouble=false; s.squash=-0.20; Audio.jump();   // double-jump boost
    } else {
      s.jumpBuffer = JUMP_BUFFER_FRAMES;   // pressed a touch early -> remember briefly
    }
  }
  s.vy += SLIME_GRAV; s.y += s.vy;
  if (s.y >= GROUND){
    if (!s.onGround) s.squash = 0.22;
    s.y = GROUND; s.vy = 0; s.onGround = true; s.canDouble=false;
    if (s.jumpBuffer>0){                    // buffered tap just before landing -> fire on touchdown
      s.jumpBuffer=0; s.coyote=0; s.vy=-SLIME_JUMP*jm; s.onGround=false; s.squash=-0.18; s.canDouble=true; s.lastJumpFrame=G.frame; Audio.jump();
    }
  }
  s.squash *= 0.82;
  // ogen volgen de bal
  const b = G.ball;
  const dx = b.x - s.x, dy = (b.y) - (s.y - SLIME_R*0.5);
  const d = Math.hypot(dx,dy) || 1;
  s.eyeX = dx/d; s.eyeY = dy/d;
}

function reflectOffSlime(b, s){
  // collision-cirkel zit op grondniveau; alleen bovenste helft telt
  const dx = b.x - s.x, dy = b.y - s.y;
  const dist = Math.hypot(dx,dy);
  const minD = slimeR(s) + BALL_R;            // 💪 mega slime has a bigger dome
  if (dist < minD && b.y <= s.y + 2 && dist > 0){
    const nx = dx/dist, ny = dy/dist;
    // bal op het oppervlak plaatsen
    b.x = s.x + nx*minD; b.y = s.y + ny*minD;
    // klassieke slime-bounce: bal vliegt langs de normaal, snelheid ~ inkomende snelheid
    const speed = Math.hypot(b.vx, b.vy);
    let out = Math.max(speed*0.92, 8.5);
    if (s.powShot > 0){                       // 🔥 power shot: this contact rockets away
      out *= 1.65; s.powShot = 0;
      spawnDust(b.x, b.y, 14, '#ff5470'); G.shake = Math.max(G.shake, 7);
    }
    b.vx = nx*out + s.vx*0.85;
    b.vy = ny*out + s.vy*0.55;
    // lichte opwaartse bias bij een bovenkant-treffer; een dalende slime mag wél smashen
    if (ny < -0.15 && b.vy > -2) b.vy = -2;
    // voorkom dat de slime de bal door muur/plafond/doellijn duwt
    if (b.x < BALL_R){ b.x = BALL_R; if (b.vx < 0) b.vx = -b.vx; }
    else if (b.x > W-BALL_R){ b.x = W-BALL_R; if (b.vx > 0) b.vx = -b.vx; }
    if (b.y < BALL_R){ b.y = BALL_R; if (b.vy < 0) b.vy = -b.vy; }
    Audio.kick(out);
    spawnDust(b.x, b.y, 6, '#ffffff');
    return true;
  }
  return false;
}

/* ---- Ball catch/hold (classic slime: hold the catch button to clamp the ball) ---- */
const HOLD_MAX = 180;   // max hold ~3s, then auto-release
function tryCatch(s){
  const b = G.ball;
  if (b.held || !s.input.down || s.catchCD>0 || s.frozen>0) return false;
  const dx=b.x-s.x, dy=b.y-s.y;
  if (Math.hypot(dx,dy) < slimeR(s)+BALL_R+12 && b.y <= s.y+2){   // touching the dome's top
    b.held=s; s.holding=true; s.holdT=0; b.vx=0; b.vy=0;
    return true;
  }
  return false;
}
function attackDir(s){ return s.side==='left' ? 1 : -1; }   // direction toward the opponent's goal
function holdBall(s){
  const b = G.ball;
  const other = (s===G.p1)?G.p2:G.p1;
  // a clamped ball can be STOLEN: jump into/through the holder to knock it loose
  if (other && Math.abs(s.x-other.x) < SLIME_R*1.25 && !other.onGround){
    b.held=null; s.holding=false; s.catchCD=14;
    b.vx=(Math.random()-0.5)*4; b.vy=-5; b.spin=0; spawnDust(b.x,b.y,8,'#ffffff');
    return;
  }
  if (!s.input.down || s.holdT>HOLD_MAX || G.screen!==SCREEN.PLAY){ releaseBall(s); return; }
  s.holdT++;
  const dir = attackDir(s);                          // perch on the dome, slightly forward
  b.x = clamp(s.x + dir*6, BALL_R, W-BALL_R);
  b.y = s.y - SLIME_R - BALL_R + 4;
  b.vx = s.vx; b.vy = s.vy; b.spin += 0.04;
}
function releaseBall(s){
  const b = G.ball;
  b.held=null; s.holding=false; s.catchCD=22;
  const dir = s.side==='left'?1:-1;                 // throw forward + up; jumping throws higher
  b.vx = s.vx*0.6 + dir*9.5;
  b.vy = Math.min(-7, s.vy - 7);
  spawnDust(b.x, b.y, 6, s.team.trim);
}

function updateBall(){
  const b = G.ball;
  // held ball sticks to the holder until DOWN is released (or the hold times out)
  if (b.held){ holdBall(b.held); return; }
  if (tryCatch(G.p1) || tryCatch(G.p2)){ holdBall(b.held); return; }
  b.vy += BALL_GRAV;
  // snelheidslimiet
  const sp = Math.hypot(b.vx,b.vy);
  if (sp > BALL_MAX){ b.vx*=BALL_MAX/sp; b.vy*=BALL_MAX/sp; }
  b.x += b.vx; b.y += b.vy;
  b.spin += b.vx*0.03;

  // slimes EERST: zo wordt een door de slime weggeduwde bal nog dezelfde tick
  // door de muur/doel-logica afgehandeld i.p.v. pas volgende tick (anti-tunnel).
  // returnwaarde voorkomt dubbele bounce bij overlap rond de middenlijn.
  if (!reflectOffSlime(b, G.p1)) reflectOffSlime(b, G.p2);

  // lat + paal (beide doelen)
  collideBar(b, true);   // links
  collideBar(b, false);  // rechts

  // plafond
  if (b.y < BALL_R){ b.y=BALL_R; b.vy=-b.vy*BALL_REST; Audio.wall(); }
  // grond
  if (b.y > GROUND-BALL_R){ b.y=GROUND-BALL_R; b.vy=-b.vy*BALL_REST; b.vx*=0.985; if(Math.abs(b.vy)>2) Audio.wall(); }

  // zijmuren / doelen
  // LINKS
  if (b.x < BALL_R){
    if (b.y > BAR_Y + BAR_TH){ score(1); return; }        // doelpunt voor rechts
    b.x=BALL_R; b.vx=-b.vx*BALL_REST; Audio.wall();
  }
  // RECHTS
  if (b.x > W-BALL_R){
    if (b.y > BAR_Y + BAR_TH){ score(0); return; }        // doelpunt voor links
    b.x=W-BALL_R; b.vx=-b.vx*BALL_REST; Audio.wall();
  }
}

function collideBar(b, left){
  const postX = left ? GOAL_D : W - GOAL_D;
  // de lat is de massieve balk [barTop,barBot] boven de doelmond; de doelmond
  // zelf (y > barBot) is open. inGoalX met BALL_R-marge dicht de naad bij de paal.
  const inGoalX = left ? (b.x < postX + BALL_R) : (b.x > postX - BALL_R);
  const barTop = BAR_Y - BAR_TH, barBot = BAR_Y;
  // lat: penetratie-resolutie (geen richtings-naad, vangt ook b.y == BAR_Y)
  if (inGoalX && b.y + BALL_R > barTop && b.y - BALL_R < barBot){
    if (b.y < (barTop + barBot) * 0.5){     // bal-midden boven de lat -> erbovenop
      b.y = barTop - BALL_R; if (b.vy > 0) b.vy = -b.vy * BALL_REST;
    } else {                                 // bal-midden onder de lat -> tegen onderkant
      b.y = barBot + BALL_R; if (b.vy < 0) b.vy = -b.vy * BALL_REST;
    }
    Audio.post();
  }
  // frame-hoek (waar lat en staander samenkomen) als cirkel; alleen kaatsen bij naderen
  const dx = b.x - postX, dy = b.y - BAR_Y, d = Math.hypot(dx, dy);
  if (d < BALL_R + 6 && d > 0){
    const nx = dx/d, ny = dy/d, dot = b.vx*nx + b.vy*ny;
    b.x = postX + nx*(BALL_R+6); b.y = BAR_Y + ny*(BALL_R+6);
    if (dot < 0){ b.vx = (b.vx - 2*dot*nx)*BALL_REST; b.vy = (b.vy - 2*dot*ny)*BALL_REST; Audio.post(); }
  }
}

/* ----------------------------------------------------------------------------
   9. AI
   ---------------------------------------------------------------------------- */
const aiState = { reactT:0, jumpHold:0, targetX:W*0.75 };
function predictBallX(frames){
  let x=G.ball.x, y=G.ball.y, vx=G.ball.vx, vy=G.ball.vy;
  for(let f=0;f<frames;f++){
    vy+=BALL_GRAV; x+=vx; y+=vy;
    if (x<BALL_R){x=BALL_R;vx=-vx*BALL_REST;}
    if (x>W-BALL_R){x=W-BALL_R;vx=-vx*BALL_REST;}
    if (y>GROUND-BALL_R){y=GROUND-BALL_R;vy=-vy*BALL_REST;}
  }
  return x;
}
// where a lobbed ball will first hit the ground — lets the AI retreat UNDER lobs (anti-lob defence)
function predictLandingX(maxF){
  let x=G.ball.x, y=G.ball.y, vx=G.ball.vx, vy=G.ball.vy;
  for(let f=0;f<maxF;f++){
    vy+=BALL_GRAV; x+=vx; y+=vy;
    if (x<BALL_R){x=BALL_R;vx=-vx*BALL_REST;}
    if (x>W-BALL_R){x=W-BALL_R;vx=-vx*BALL_REST;}
    if (y>=GROUND-BALL_R) return x;                 // first ground contact = landing spot
  }
  return x;
}
function effDiff(){ return (G.wkMode && G.wk) ? G.wk.diffs[G.wk.round] : settings.diff; }
// the HUMAN gets a small run-speed boost on Hard/World Cup (and Rising's harder rounds),
// so the higher levels feel faster for BOTH and the AI's edge is skill, not a big speed gap.
function playerSpeedMul(){ const d=effDiff(); return d==='worldcup' ? 1.22 : d==='hard' ? 1.10 : 1; }
function computeAI(s){
  const p = AI_LEVELS[effDiff()] || AI_LEVELS.normal;
  s.speedMul = p.speed || 1;                           // level speed actually applies (updateSlime)
  const b = G.ball;
  const attack = p.attack || 0, defend = p.defend || 0;
  const homeX = W*0.66;                                // defensive home — goal-biased, but forward enough to counter
  const oppHolds = b.held && b.held!==s;
  aiState.reactT--;
  if (aiState.reactT <= 0){
    aiState.reactT = (Math.random()*p.react)|0;
    let tx;
    if (oppHolds) tx = b.held.x;                       // chase the holder to steal
    else {
      const land = predictLandingX(Math.max(50, p.predict*1.6));   // read the lob; smarter levels see it sooner
      const ref  = Math.max(land, b.x);               // deepest threat: landing spot or the ball itself
      // KEY: stay goal-side of that point so a lob/drive can't drop in behind us
      const goalSide = ref + SLIME_R*(0.25 + defend*0.5);
      const incoming = b.x > CENTER || (b.vx > 0.3 && land > CENTER);   // on our half, or a lob dropping onto it
      if (incoming){
        // defend goal-side and clear it — but stay OUT of the 0.80 camp zone so the
        // anti-goal-hang rule never shoves us off the goal (no open nets)
        tx = Math.min(goalSide, W*0.79);
      } else {
        // ball staying on the OPPONENT'S half — hold a goal-biased line; press up only 'attack' much
        const press = Math.min(goalSide, CENTER + SLIME_R*1.5);
        tx = homeX + (press - homeX) * attack;
      }
      // only bail from deep defence to dodge the anti-camp penalty, and only when the ball isn't there
      if (p.smart && s.hang > CAMP_MAX*0.8 && b.x <= W*0.80) tx = Math.min(tx, W*0.66);
      // power-ups mode: smart levels grab a nearby GOOD pickup while the ball is safely on the other half
      if (G.powerMode && p.smart && b.x < CENTER*0.8){
        const pow = G.pows.find(q=>q.landed && !POWER_TYPES[q.type].bad && Math.abs(q.x-s.x)<320);
        if (pow) tx = pow.x;
      }
    }
    tx += (Math.random()-0.5) * (p.mistake*300);
    aiState.targetX = clamp(tx, SLIME_R*0.5, W-SLIME_R*0.5);
  }
  const inp = { left:false, right:false, jump:false, down:false };
  const dead = p.smart ? 6 : 10;                        // smart levels track their line more tightly
  if (s.x < aiState.targetX - dead) inp.right = true;
  else if (s.x > aiState.targetX + dead) inp.left = true;

  const horiz = Math.abs(b.x - s.x);
  const ballAbove = b.y < s.y - 70;
  const ballNear = horiz < SLIME_R+50;

  // CRITICAL: the ball inherits the slime's velocity on contact (reflectOffSlime: vx += s.vx*0.85).
  // When the ball is close on our goal-side, drive LEFT through it (clear toward the opponent) and
  // never push RIGHT into it — otherwise our own momentum knocks the ball into our own net.
  if (p.smart && (s.x - b.x) > SLIME_R*0.1 && horiz < SLIME_R+BALL_R+12 && b.y < s.y+SLIME_R && b.x > CENTER){
    inp.left = true; inp.right = false;
  }

  // smart levels: occasionally CLAMP the ball, then throw it toward the opponent's goal
  if (p.smart){
    if (s.aiCatchT<=0 && !b.held && s.catchCD<=0 && !inCampZone(s) && horiz<SLIME_R && b.y>s.y-SLIME_R-BALL_R-24 && b.y<=s.y+2 && Math.random()<(p.catch||0.05))
      s.aiCatchT = 24 + (Math.random()*46|0);
    if (s.aiCatchT>0 && (s.holding || (!b.held && s.catchCD<=0))){ inp.down=true; s.aiCatchT--; }
    else s.aiCatchT = 0;
  }

  // jump to reach the ball; smart levels are reliable headers when the ball drops onto their half
  if (s.onGround && ballAbove && ballNear && b.vy > -3){
    const clear = p.smart && b.x > CENTER && horiz < SLIME_R+20;   // surely head a ball dropping onto our half away
    if (clear || Math.random() < (p.jump+0.05)) inp.jump = true;
  }
  if (s.onGround && oppHolds && Math.abs(s.x-b.held.x) < SLIME_R*1.1 && Math.random() < p.jump+0.1) inp.jump = true;  // jump in to steal
  if (p.smart && !s.onGround && s.canDouble && ballAbove && b.y < s.y-150 && ballNear) inp.jump = !!(G.frame & 1);
  s.input = inp;
}

/* ----------------------------------------------------------------------------
   10. Match-flow
   ---------------------------------------------------------------------------- */
function resetPositions(){
  G.p1.x = W*0.25; G.p1.y=GROUND; G.p1.vx=G.p1.vy=0; G.p1.onGround=true;
  G.p2.x = W*0.75; G.p2.y=GROUND; G.p2.vx=G.p2.vy=0; G.p2.onGround=true;
  G.p1.holding=G.p2.holding=false; G.p1.holdT=G.p2.holdT=0; G.p1.catchCD=G.p2.catchCD=0;
  [G.p1,G.p2].forEach(s=>{ s.fx=null; s.frozen=0; s.powShot=0; });   // fresh kickoff: power effects reset
  clearPows();
  G.ball = makeBall();
  // the team that CONCEDED kicks off: drop the ball on their side (lastScorer 0 = left scored -> ball to right)
  G.ball.x = G.lastScorer===0 ? W*0.68 : W*0.32;
}
// keep the two slimes from overlapping now that they share the whole pitch
function separateSlimes(){
  const a=G.p1, b=G.p2, min=(slimeR(a)+slimeR(b))*0.59, dx=b.x-a.x, gap=Math.abs(dx);
  if (gap < min && gap > 0.0001){
    const push=(min-gap)/2, dir=dx>0?1:-1;
    a.x=clamp(a.x-dir*push, slimeR(a)*0.5, W-slimeR(a)*0.5);
    b.x=clamp(b.x+dir*push, slimeR(b)*0.5, W-slimeR(b)*0.5);
  }
}
/* ---- Menu attract mode (two CPU slimes knock the ball about; no scoring) ---- */
function startAttract(){
  const home = TEAMS.find(t=>t.featured) || TEAMS[0];
  const away = shuffleArr(TEAMS.filter(t=>t!==home))[0] || TEAMS[1];
  G.p1 = makeSlime('left', home); G.p2 = makeSlime('right', away); G.ball = makeBall();
  G.attract = true;
}
function attractAI(s){
  const b=G.ball, left=s.side==='left';
  const onSide = left ? b.x < CENTER+50 : b.x > CENTER-50;
  const target = onSide ? b.x : (left ? W*0.25 : W*0.75);
  const inp={left:false,right:false,jump:false};
  if (s.x < target-14) inp.right=true; else if (s.x > target+14) inp.left=true;
  const horiz=Math.abs(b.x-s.x), ballAbove=b.y < s.y-70;
  if (s.onGround && ballAbove && horiz<SLIME_R+40 && b.vy>-2 && Math.random()<0.06) inp.jump=true;
  s.input=inp;
}
function attractBall(){
  const b=G.ball;
  b.vy+=BALL_GRAV;
  const sp=Math.hypot(b.vx,b.vy); if(sp>BALL_MAX){ b.vx*=BALL_MAX/sp; b.vy*=BALL_MAX/sp; }
  b.x+=b.vx; b.y+=b.vy; b.spin+=b.vx*0.03;
  if(!reflectOffSlime(b,G.p1)) reflectOffSlime(b,G.p2);
  collideBar(b,true); collideBar(b,false);
  if(b.y<BALL_R){ b.y=BALL_R; b.vy=-b.vy*BALL_REST; }
  if(b.y>GROUND-BALL_R){ b.y=GROUND-BALL_R; b.vy=-b.vy*BALL_REST; b.vx*=0.985; }
  if(b.x<BALL_R){ b.x=BALL_R; b.vx=-b.vx*BALL_REST; }            // bounce off side walls — no goals in attract
  if(b.x>W-BALL_R){ b.x=W-BALL_R; b.vx=-b.vx*BALL_REST; }
  if(Math.hypot(b.vx,b.vy)<0.6 && b.y>GROUND-BALL_R-2){ b.vx=(Math.random()-0.5)*8; b.vy=-9-Math.random()*4; }  // re-serve if it stalls
}

function startMatch(){
  G.attract=false;
  G.score=[0,0]; G.winner=0; G.particles=[]; G.lastScorer=0;
  // Friendly bonus mode only — never World Cup (leaderboard fairness) or Online (no netcode for it)
  G.powerMode = settings.powerups && !G.wkMode && (G.mode==='1p' || G.mode==='2p');
  clearPows();
  if (G.wkMode){ G.matchMode='time'; G.matchMin=(G.wk && G.wk.min) || settings.wkMin || 2; }   // World Cup: time mode, chosen length
  else if (G.mode==='host'){ G.matchMode='time'; G.matchMin=2; }   // online: standard 2-minute timed games
  else { G.matchMode=settings.matchMode; G.matchMin=settings.matchMin; }
  G.toWin = settings.toWin;
  G.golden = false;
  G.matchTime = G.matchMin * 3600;                        // minuten * 60s * 60fps
  if (G.p1){ G.p1.hang=0; G.p1.penalty=0; } if (G.p2){ G.p2.hang=0; G.p2.penalty=0; }
  resetPositions();
  G.shake=0; G.flash=0;
  beginCountdown();
}
function beginCountdown(){
  G.screen = SCREEN.COUNT;
  G.countdown = 180;        // 3s @60
  Audio.whistle();
  hideAllOverlays();
  updateTouchVisibility();
}
function score(who){
  if (G.screen!==SCREEN.PLAY) return;
  G.score[who]++;
  G.lastScorer = who;
  G.flash = 16; G.shake = 16;
  spawnConfetti();
  Audio.goal();
  haptic(35);                                                           // light buzz on every goal
  if (G.golden){ endMatch(); }                                          // golden goal: eerste doelpunt beslist
  else if (G.matchMode==='goals' && (G.score[0]>=G.toWin || G.score[1]>=G.toWin)){ endMatch(); }
  else { G.screen = SCREEN.GOAL; G.goalTimer = 130; }
  // kritieke transitie meteen sturen (niet afhankelijk van de 30Hz-throttle):
  // anders mist de guest ~50% van de tijd het GOAL/OVER-signaal.
  if (G.mode==='host' && G.net) G.net.sendState();
}
function endMatch(){
  G.winner = G.score[0]===G.score[1] ? 1 : (G.score[0]>G.score[1] ? 1 : 2);  // tie can't happen here (golden goal)
  clearPows();
  G.screen = SCREEN.OVER;
  Audio.endWhistle(); Audio.win();
  haptic([60,40,120]);                                                  // celebratory buzz at full time
  if (G.mode==='host' && G.net) G.net.sendState();
  if (G.wkMode) wkMatchEnd(G.winner===1);
  else showGameOver();
}

/* ----------------------------------------------------------------------------
   11. Per-tick update (60Hz vaste stap)
   ---------------------------------------------------------------------------- */
function tick(){
  G.frame++;
  if (G.shake>0) G.shake*=0.9;
  if (G.flash>0) G.flash--;
  updateParticles();

  // ---- MENU attract mode: two slimes knock the ball about behind the menu ----
  if (G.screen===SCREEN.MENU){
    if (G.attract && G.p1 && G.p2 && G.ball){ attractAI(G.p1); attractAI(G.p2); updateSlime(G.p1); updateSlime(G.p2); attractBall(); }
    return;
  }

  if (G.paused) return;   // local pause: everything frozen (online has no pause)

  // ---- ONLINE keepalive + watchdog (vangt ook harde drops zonder 'close') ----
  if ((G.mode==='host'||G.mode==='guest') && G.net && G.net.connected){
    // host stuurt periodiek state (ook tijdens OVER/aftrap) zodat de guest weet dat host leeft
    if (G.mode==='host' && G.p1 && G.frame % 20 === 0) G.net.sendState();
    const active = [SCREEN.COUNT,SCREEN.PLAY,SCREEN.GOAL,SCREEN.OVER].indexOf(G.screen) >= 0;
    if (active && performance.now() - G.net._lastRecvT > 3000) G.net.lostConnection = true;
  }
  // ---- ONLINE: verbinding verbroken tijdens een potje ----
  if ((G.mode==='host'||G.mode==='guest') && G.net && G.net.lostConnection){ onConnectionLost(); return; }

  // ---- ONLINE GUEST: alleen input sturen + interpoleren naar net-state ----
  if (G.mode==='guest'){
    if (G.net) G.net.sendInput(humanInput());
    if (G.netTarget){
      const t=G.netTarget;
      lerpEntity(G.p1, t.p1); lerpEntity(G.p2, t.p2); lerpBall(G.ball, t.ball);
      G.score = t.score.slice(); G.screen = t.screen; G.winner=t.winner||0;
      if (typeof t.cd==='number') G.countdown = t.cd;             // synchrone aftelling
      if (typeof t.lastScorer==='number') G.lastScorer = t.lastScorer;
      if (typeof t.mt==='number') G.matchTime = t.mt;             // synchrone speelklok
      G.golden = !!t.golden;
      faceBall(G.p1); faceBall(G.p2);
    }
    if (G.screen===SCREEN.OVER && !overShown){ showGameOver(); }
    else if (G.screen!==SCREEN.OVER && overShown){ overShown=false; hideAllOverlays(); updateTouchVisibility(); }
    return;
  }

  // ---- COUNTDOWN ----
  if (G.screen===SCREEN.COUNT){
    if (G.countdown%60===0 && G.countdown>0 && G.countdown<=180) Audio.count();
    G.countdown--;
    // input al uitlezen zodat de ogen bewegen; physics volledig bevroren tijdens de aftelling
    assignInputs(true);
    faceBall(G.p1); faceBall(G.p2);
    if (G.countdown<=0){ G.screen=SCREEN.PLAY; }
    sendStateMaybe();
    return;
  }

  // ---- GOAL pauze ----
  if (G.screen===SCREEN.GOAL){
    G.goalTimer--;
    if (G.goalTimer<=0){ resetPositions(); beginCountdown(); }
    sendStateMaybe();
    return;
  }

  // ---- PLAY ----
  if (G.screen===SCREEN.PLAY){
    assignInputs(false);
    updateSlime(G.p1); updateSlime(G.p2);   // slimes pass THROUGH each other (jump into a holder to steal)
    updateBall();
    if (G.screen===SCREEN.PLAY){ updateMatchTimer(); updateAntiCamp(); powerTick(); }   // updateBall kan al scoren
    sendStateMaybe();
  }
}

// tijd-modus: speelklok; op 0 -> einde, of golden goal bij gelijkspel
function updateMatchTimer(){
  if (G.matchMode!=='time' || G.golden) return;
  G.matchTime--;
  if (G.matchTime <= 0){
    G.matchTime = 0;
    if (G.score[0] === G.score[1]){ G.golden = true; G.flash = 12; Audio.whistle(); }
    else endMatch();
  }
}

// anti-goal-hangen: blijf je te lang in je eigen doelgebied -> weggestuurd + waarschuwing
const CAMP_WARN = 150, CAMP_MAX = 264;     // ~2.5s waarschuwing, ~4.4s straf
function inCampZone(s){ return s.side==='left' ? s.x < W*0.20 : s.x > W*0.80; }
function updateAntiCamp(){
  [G.p1, G.p2].forEach(s=>{
    if (inCampZone(s)) s.hang++; else s.hang = Math.max(0, s.hang - 3);
    if (s.hang >= CAMP_MAX){
      s.hang = 0; s.penalty = 70;
      s.x = s.side==='left' ? W*0.42 : W*0.58;     // hard penalty: shoved almost to mid-field
      s.vx = (s.side==='left'?1:-1) * 7;
      s.vy = -SLIME_JUMP*0.5; s.onGround = false;
      Audio.whistle();
    }
    if (s.penalty > 0) s.penalty--;
  });
}

/* ----------------------------------------------------------------------------
   10b. Power-ups (Friendly bonus mode) — pickups drop from the sky; touch to
   collect. Effects: ⚡ turbo · 🌙 moon jump · 💪 mega slime · ❄️ freeze · 🔥 power shot.
   Friendly (1P/2P local) only — never World Cup or Online, so leaderboard runs
   and netplay stay pure.
   ---------------------------------------------------------------------------- */
function powSpawn(type){
  const keys = Object.keys(POWER_TYPES);
  const pow = {
    type: type || keys[(Math.random()*keys.length)|0],
    x: W*(0.15 + Math.random()*0.70), y: -24,
    vy: 1.5 + Math.random()*0.8, sway: Math.random()*6.28,
    landed: false, t: 900,                       // ~15s on the pitch before fading out
  };
  G.pows.push(pow);
  return pow;
}
function applyPow(s, type){
  const opp = s===G.p1 ? G.p2 : G.p1;
  if (type==='freeze'){ opp.frozen = POWER_TYPES.freeze.dur; opp.fx = null; }
  else if (type==='shot'){ s.powShot = POWER_TYPES.shot.dur; }
  else { s.fx = { type, t: POWER_TYPES[type].dur, dur: POWER_TYPES[type].dur }; }   // turbo/moon/mega/shrink
  spawnDust(s.x, s.y - SLIME_R, 12, POWER_TYPES[type].c);
  if (POWER_TYPES[type].bad){ G.shake = Math.max(G.shake, 6); Audio.whistle(); }    // negative pickup: a little sting
  else Audio.click();
}
function powerTick(){
  if (!G.powerMode) return;
  if (--G.powTimer <= 0 && G.pows.length < 2){
    powSpawn();
    G.powTimer = 420 + (Math.random()*360|0);    // next drop in 7–13s
  }
  for (let i=G.pows.length-1; i>=0; i--){
    const p = G.pows[i];
    if (!p.landed){
      p.y += p.vy; p.sway += 0.05;
      p.x = clamp(p.x + Math.sin(p.sway)*0.8, 30, W-30);   // gentle drift on the way down
      if (p.y >= GROUND-24){ p.y = GROUND-24; p.landed = true; }
    } else if (--p.t <= 0){ G.pows.splice(i,1); continue; }
    // collect on touch (generous radius)
    for (const s of [G.p1, G.p2]){
      if (Math.hypot(p.x-s.x, p.y-(s.y-slimeR(s)*0.5)) < slimeR(s)+22){
        applyPow(s, p.type); G.pows.splice(i,1); break;
      }
    }
  }
}
function clearPows(){ G.pows.length = 0; G.powTimer = 300 + (Math.random()*240|0); }

function assignInputs(frozen){
  if (G.mode==='1p'){
    G.p1.input = humanInput();
    G.p1.speedMul = playerSpeedMul();                     // human boost on Hard/WC (AI sets its own in computeAI)
    if (frozen){ G.p2.input={left:false,right:false,jump:false}; } else computeAI(G.p2);
    if (frozen) G.p1.input={left:false,right:false,jump:false};
  } else if (G.mode==='2p'){
    G.p1.speedMul = G.p2.speedMul = 1;                    // local 2P: both at the same player speed
    G.p1.input = frozen?{left:false,right:false,jump:false}:p1KeyInput();
    G.p2.input = frozen?{left:false,right:false,jump:false}:p2KeyInput();
  } else if (G.mode==='host'){
    const FZ={left:false,right:false,jump:false,down:false};
    const me  = frozen?FZ:humanInput();
    const opp = frozen?FZ:(G.net?G.net.guestInput:FZ);
    // mySlot=2 means the host plays the RIGHT slime (random sides); route inputs accordingly
    if (G.mySlot===2){ G.p2.input=me; G.p1.input=opp; }
    else { G.p1.input=me; G.p2.input=opp; }
  }
}
// Online: p1 is always the LEFT slime, p2 the RIGHT (keeps the engine invariant);
// the random `swap` only decides which team sits on which side.
function buildOnlineSlimes(hostTeam, guestTeam, swap){
  G.p1 = makeSlime('left',  swap ? guestTeam : hostTeam);
  G.p2 = makeSlime('right', swap ? hostTeam  : guestTeam);
  G.ball = makeBall();
}

function faceBall(s){
  const b=G.ball; const dx=b.x-s.x, dy=b.y-(s.y-SLIME_R*0.5); const d=Math.hypot(dx,dy)||1;
  s.eyeX=dx/d; s.eyeY=dy/d;
}
function lerpEntity(e,t){ if(!t)return; e.x+=(t.x-e.x)*0.5; e.y+=(t.y-e.y)*0.5; e.vx=t.vx; e.vy=t.vy; e.onGround=t.onGround; e.squash=t.squash||0; }
function lerpBall(e,t){ if(!t)return; e.x+=(t.x-e.x)*0.5; e.y+=(t.y-e.y)*0.5; e.vx=t.vx; e.vy=t.vy; e.spin=t.spin; }

/* ----------------------------------------------------------------------------
   12. Online netcode  (PeerJS, host-authoritative)
   ---------------------------------------------------------------------------- */
/* WebRTC ICE servers. STUN alone fails when both players sit behind symmetric
   NAT (common on mobile data / CGNAT), so a TURN relay is required for reliable
   cross-network play — e.g. iOS on cellular <-> Android on Wi-Fi.
   Public anonymous TURN is best-effort and may be rate-limited/down. For
   guaranteed mobile play, get a FREE TURN account (metered.ca = 20GB/mo, or
   expressturn.com = 1000GB/mo) and either edit TURN_SERVERS below, or — with no
   redeploy — paste your servers in the browser console and reconnect:
     store.save('ice', [{urls:'turn:HOST:PORT', username:'U', credential:'C'}]) */
const TURN_SERVERS = [
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:0.peerjs.com:3478', username: 'peerjs', credential: 'peerjsp' },   // PeerJS default relay
];
// Cloudflare TURN: short-lived creds minted server-side by the slime-turn edge
// function (the CF API token stays out of the client). Fetched once per session
// when entering the Online screen; falls back to the best-effort relays below.
const TURN_API = 'https://eymkdhdmekcxbapmyask.supabase.co/functions/v1/slime-turn';
const SB_ANON  = 'sb_publishable_Iizoz0duFVLID2xYpphhGw_kUPUuXUI';
let _iceTried = false, _iceServer = null;
async function refreshIce(){
  if (_iceTried) return; _iceTried = true;
  try {
    const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 4500);
    const res = await fetch(TURN_API, { method:'POST', headers:{ apikey:SB_ANON, Authorization:'Bearer '+SB_ANON }, signal:ctrl.signal });
    clearTimeout(t);
    if (res.ok){ const j = await res.json(); if (j && Array.isArray(j.iceServers) && j.iceServers.length) _iceServer = j.iceServers; }
  } catch(_){}
}
function iceServers(){
  const override = store.load('ice', null);              // manual runtime override always wins
  if (Array.isArray(override) && override.length)
    return [{ urls:['stun:stun.l.google.com:19302'] }, ...override];
  if (_iceServer) return _iceServer;                     // Cloudflare TURN (includes its own STUN)
  return [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ...TURN_SERVERS,                                      // best-effort fallback until CF is configured
  ];
}
function peerOpts(){ return { debug:1, config:{ iceServers: iceServers() } }; }

function makeNet(){
  return {
    peer:null, conn:null, isHost:false, code:'',
    guestInput:{left:false,right:false,jump:false,down:false},
    connected:false, lostConnection:false,
    _closed:false, _retryT:null, _joinT:null, _retries:0, _sendT:0, _lastRecvT:0,
    host(onCode, onStatus, onStart){
      this.isHost=true;
      // reuse this device's code so you can host again later with the same code
      const code = this.code || store.load('hostcode', null) || randomCode();
      this.code = code;
      try { this.peer = new Peer('SLWK'+code, peerOpts()); }
      catch(e){ onStatus('PeerJS not loaded — check your internet', true); return; }
      this.peer.on('open', ()=>{ store.save('hostcode', this.code); onCode(this.code); });
      this.peer.on('error', err=>{
        // PeerJS reports a busy id as type 'unavailable-id' / message 'ID "..." is taken'
        const taken = (err && err.type==='unavailable-id') || /is taken|unavailable/i.test(String((err&&err.message)||err));
        if (taken) {
          if ((this._retries=(this._retries||0)+1) > 6){ onStatus('Could not get a free code — please try again.', true); return; }
          onStatus('Code taken, getting a new one…', true);
          store.save('hostcode','');               // stop reusing the stale code on next launch
          this.code = randomCode();
          try{ this.peer.destroy(); }catch(_){}
          this._retryT = setTimeout(()=>{ if(this._closed) return; this.host(onCode,onStatus,onStart); }, 300);
        } else onStatus('Error: '+((err&&err.message)||err), true);
      });
      this.peer.on('connection', c=>{
        if (this.conn){ try{ c.close(); }catch(_){} return; }   // max. 1 tegenstander
        this.conn=c;
        c.on('open', ()=>{ this.connected=true; this._lastRecvT=performance.now(); onStatus('Opponent connected!', false); });
        c.on('data', d=>this._recv(d));
        c.on('close', ()=>{ this.connected=false; this.lostConnection=true; onStatus('Connection lost', true); });
        c.on('iceStateChanged', s=>{ console.log('[net] ICE(host)', s); if (s==='failed' && !this.connected) onStatus('Could not link up (NAT/firewall) — a TURN server is needed.', true); });
      });
      this._onStart = onStart;
    },
    join(code, onStatus, onStart){
      this.isHost=false;
      try { this.peer = new Peer(peerOpts()); }
      catch(e){ onStatus('PeerJS not loaded — check your internet', true); return; }
      this.peer.on('open', ()=>{
        onStatus('Connecting…', false);
        this.conn = this.peer.connect('SLWK'+code, { reliable:true });
        // don't hang on "Connecting…" forever if the host isn't there
        this._joinT = setTimeout(()=>{
          if (this.connected || this._closed) return;
          onStatus('Couldn’t link up — check the code, try the same Wi-Fi, or set up a TURN server.', true);
          try{ this.conn&&this.conn.close(); }catch(_){}
        }, 15000);
        this.conn.on('open', ()=>{ clearTimeout(this._joinT); this.connected=true; this._lastRecvT=performance.now(); onStatus('Connected! Waiting for host…', false); });
        this.conn.on('data', d=>this._recv(d));
        this.conn.on('close', ()=>{ this.connected=false; this.lostConnection=true; onStatus('Connection lost', true); });
        this.conn.on('iceStateChanged', s=>{ console.log('[net] ICE(join)', s); if (s==='failed' && !this.connected){ clearTimeout(this._joinT); onStatus('Could not link up (NAT/firewall) — a TURN server is needed.', true); } });
      });
      this.peer.on('error', err=>{
        if (err && err.type==='peer-unavailable'){ clearTimeout(this._joinT); onStatus('No game found with code '+code+' — check it and try again.', true); }
        else onStatus('Cannot connect: '+((err&&err.message)||err), true);
      });
      this._onStart = onStart;
    },
    _recv(d){
      this._lastRecvT = performance.now();   // watchdog-hartslag
      if (d.t==='start'){ if(this._onStart) this._onStart(d); }
      else if (d.t==='state'){ applyNetState(d); }
      else if (d.t==='input'){ this.guestInput = d.i; }
    },
    startGame(payload){ if (this.conn && this.connected) this.conn.send(Object.assign({t:'start'},payload)); },
    sendInput(i){ if (this.conn && this.connected) this.conn.send({t:'input', i:{left:i.left,right:i.right,jump:i.jump,down:i.down}}); },
    sendState(){
      if (!this.conn || !this.connected) return;
      this.conn.send({ t:'state',
        p1:packEnt(G.p1), p2:packEnt(G.p2), ball:packBall(G.ball),
        score:G.score, screen:G.screen, winner:G.winner, cd:G.countdown, lastScorer:G.lastScorer, mt:G.matchTime, golden:G.golden });
    },
    close(){ this._closed=true; clearTimeout(this._retryT); clearTimeout(this._joinT); try{ this.conn&&this.conn.close(); this.peer&&this.peer.destroy(); }catch(e){} }
  };
}
function randomCode(){ const a='ACDEFHJKLMNPRTUVWXY3479'; let s=''; for(let i=0;i<4;i++) s+=a[(Math.random()*a.length)|0]; return s; }
function packEnt(e){ return {x:e.x,y:e.y,vx:e.vx,vy:e.vy,onGround:e.onGround,squash:e.squash}; }
function packBall(b){ return {x:b.x,y:b.y,vx:b.vx,vy:b.vy,spin:b.spin}; }
function sendStateMaybe(){ if (G.mode==='host' && G.net){ G.net._sendT++; if (G.net._sendT%2===0) G.net.sendState(); } }

let overShown=false;
function applyNetState(d){
  G.netTarget = { p1:d.p1, p2:d.p2, ball:d.ball, score:d.score, screen:d.screen, winner:d.winner, cd:d.cd, lastScorer:d.lastScorer, mt:d.mt, golden:d.golden };
  if (d.screen!==SCREEN.OVER) overShown=false;
}

/* ----------------------------------------------------------------------------
   13. Rendering
   ---------------------------------------------------------------------------- */
let crowdSeed = [];
for (let i=0;i<430;i++) crowdSeed.push({ x:Math.random(), y:Math.random(), c:(Math.random()*6)|0, f:Math.random()*6.28 });

// modern in-canvas type (sporty broadcast look) — replaces the old pixel font
function FONT(px, w){ return (w||800)+' '+px+"px Rubik, system-ui, -apple-system, sans-serif"; }

function render(){
  ctx.save();
  // screen shake
  if (G.shake>0.5){ ctx.translate((Math.random()-0.5)*G.shake, (Math.random()-0.5)*G.shake); }

  drawStadium();
  drawPitch();
  if (G.p1 && G.p2 && (G.screen===SCREEN.PLAY||G.screen===SCREEN.COUNT||G.screen===SCREEN.GOAL)) drawCampZones();
  drawGoal(true);
  drawGoal(false);
  if (G.powerMode && G.pows.length) drawPows();
  if (G.ball) drawBall(G.ball);
  if (G.p1) drawSlime(G.p1);
  if (G.p2) drawSlime(G.p2);
  drawParticles();
  if (G.powerMode && (G.screen===SCREEN.PLAY||G.screen===SCREEN.COUNT||G.screen===SCREEN.GOAL)) drawPowerSticker();
  if (G.p1 && G.p2 && G.screen!==SCREEN.MENU) drawScoreboard();

  if (G.screen===SCREEN.COUNT) drawCountdown();
  if (G.screen===SCREEN.GOAL)  drawGoalText();
  if (G.paused) drawPaused();

  ctx.restore();

  // goal-flash
  if (G.flash>0){ ctx.fillStyle=`rgba(255,255,255,${G.flash/16*0.5})`; ctx.fillRect(0,0,W,H); }
  if (settings.crt) drawCRT();
}

// Pitchside advertisers shown on the scrolling boards (decorative only — not links).
const AD_BOARDS = [
  { t:'SLIMESCORE.COM',  c:'#ffd23b' },
  { t:'SLIME SOCCER',    c:'#ff7a18' },
  { t:'SLIME VOLLEYBALL', c:'#1f6fff' },
  { t:'FELIRO.NL',       c:'#00a64a' },
];

function drawStadium(){
  // sky — blue-hour gradient
  const sky = ctx.createLinearGradient(0,0,0,GROUND);
  sky.addColorStop(0,'#1a2a60'); sky.addColorStop(0.5,'#2f478e'); sky.addColorStop(1,'#5a72b6');
  ctx.fillStyle=sky; ctx.fillRect(0,0,W,GROUND+6);

  // distant floodlight haze high over the bowl
  const haze=ctx.createRadialGradient(CENTER,-30,40,CENTER,-30,W*0.7);
  haze.addColorStop(0,'rgba(150,185,255,0.16)'); haze.addColorStop(1,'rgba(150,185,255,0)');
  ctx.fillStyle=haze; ctx.fillRect(0,0,W,GROUND*0.6);

  // stadium bowl: two curved tiers, vertically shaded for depth
  const band=(yEdge,yMid,h,c0,c1)=>{ const g=ctx.createLinearGradient(0,yEdge,0,yEdge+h);
    g.addColorStop(0,c0); g.addColorStop(1,c1); ctx.fillStyle=g; ctx.beginPath();
    ctx.moveTo(0,yEdge); ctx.quadraticCurveTo(CENTER,yMid,W,yEdge);
    ctx.lineTo(W,yEdge+h); ctx.quadraticCurveTo(CENTER,yMid+h,0,yEdge+h); ctx.closePath(); ctx.fill(); };
  band(62,138, GROUND*0.42, '#26407f','#1a2b58');                 // upper tier
  band(GROUND*0.50, GROUND*0.585, GROUND*0.46, '#1d3168','#101d44'); // lower tier (closer/darker)

  // soft team-colour tifo glow washing the stands (subtle, not smudgy)
  const tifo=(yC,rad,col,a)=>{ ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=col;
    ctx.beginPath(); ctx.ellipse(CENTER,yC,W*0.5,rad,0,0,7); ctx.fill(); ctx.restore(); };
  tifo(GROUND*0.34,70,'#e4002b',0.05); tifo(GROUND*0.44,58,'#2b6fff',0.06); tifo(GROUND*0.55,50,'#00a64a',0.05);

  // crowd seated in the bowl — denser lower, calm twinkle, gangway gaps between tiers
  const t=G.frame*0.045;
  const cols=['#6f87c6','#8ba1dd','#ff9b4d','#46c98a','#ff7088','#eef2ff'];
  for (const s of crowdSeed){
    if (Math.abs(s.y-0.50)<0.02 || Math.abs(s.y-0.80)<0.018) continue;   // gangways between tiers
    const cx=s.x*W, cy=66 + s.y*(GROUND-150);
    const tw=0.58+0.26*Math.sin(t+s.f)+s.y*0.16;
    ctx.globalAlpha=Math.min(1,tw); ctx.fillStyle=cols[s.c]; ctx.fillRect(cx,cy,4,4);
  }
  ctx.globalAlpha=1;

  // roof rim + tier gangway line
  ctx.save(); ctx.lineWidth=2; ctx.strokeStyle='rgba(140,170,235,0.42)';
  ctx.beginPath(); ctx.moveTo(0,62); ctx.quadraticCurveTo(CENTER,138,W,62); ctx.stroke();
  ctx.strokeStyle='rgba(90,120,190,0.30)';
  ctx.beginPath(); ctx.moveTo(0,GROUND*0.50); ctx.quadraticCurveTo(CENTER,GROUND*0.585,W,GROUND*0.50); ctx.stroke();
  ctx.restore();

  // one soft camera flash at a time in the stands (subtle, not strobey)
  const fwin=34, ff=1-(G.frame%fwin)/fwin;
  if (ff>0.04){ const s=crowdSeed[((G.frame/fwin|0)*53)%crowdSeed.length];
    const cx=s.x*W, cy=66+s.y*(GROUND-150);
    const fg=ctx.createRadialGradient(cx,cy,0,cx,cy,13);
    fg.addColorStop(0,`rgba(255,255,255,${0.7*ff})`); fg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(cx,cy,13,0,7); ctx.fill();
  }

  // slow searchlight beams (very subtle)
  for (const [bx,ph] of [[W*0.20,0],[W*0.80,2.1]]){
    const ang=Math.sin(G.frame*0.004+ph)*0.30+(bx<CENTER?-0.18:0.18);
    ctx.save(); ctx.translate(bx,GROUND*0.60); ctx.rotate(ang);
    const bg=ctx.createLinearGradient(0,0,0,-GROUND*0.66);
    bg.addColorStop(0,'rgba(220,235,255,0.08)'); bg.addColorStop(1,'rgba(220,235,255,0)');
    ctx.fillStyle=bg; ctx.beginPath();
    ctx.moveTo(-6,0); ctx.lineTo(6,0); ctx.lineTo(32,-GROUND*0.66); ctx.lineTo(-32,-GROUND*0.66);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  // floodlights: a slim pylon + an angled lamp bank (grid of lit cells) casting a soft glow cone
  for (const fx of [W*0.10, W*0.90]){
    const inward = fx<CENTER ? 1 : -1;          // tilt the lamp head toward the pitch
    const headY = 16, poleH = GROUND*0.42, gx = fx+inward*8;
    const fl = 0.92 + 0.08*Math.sin(G.frame*0.21 + fx);
    const g=ctx.createRadialGradient(gx,headY+4,6,gx,headY+4,260);
    g.addColorStop(0,`rgba(228,240,255,${0.55*fl})`); g.addColorStop(0.5,`rgba(175,208,255,${0.14*fl})`); g.addColorStop(1,'rgba(175,208,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(gx,headY+4,260,0,7); ctx.fill();
    ctx.fillStyle='#454b69'; ctx.fillRect(fx-3, headY, 6, poleH);
    ctx.fillStyle='#2c3048'; ctx.fillRect(fx+(inward>0?1:-3), headY, 2, poleH);
    ctx.save(); ctx.translate(fx, headY); ctx.rotate(inward*0.20);
    ctx.fillStyle='#9aa2bd'; ctx.fillRect(-27,-13,54,20);
    ctx.fillStyle='#6c7290'; ctx.fillRect(-27,-13,54,3);
    for (let i=0;i<4;i++) for (let j=0;j<2;j++){
      const lx=-19+i*12.7, ly=-6+j*10;
      ctx.fillStyle='rgba(255,250,224,0.96)'; ctx.beginPath(); ctx.arc(lx,ly,4,0,7); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(lx-0.6,ly-0.6,1.6,0,7); ctx.fill();
    }
    ctx.restore();
  }

  // lit front rail (bright curved line with a soft glow)
  ctx.save(); ctx.strokeStyle='rgba(150,200,255,0.85)'; ctx.lineWidth=2.5; ctx.shadowColor='rgba(120,180,255,0.9)'; ctx.shadowBlur=10;
  ctx.beginPath(); ctx.moveTo(0,GROUND*0.50); ctx.quadraticCurveTo(CENTER,GROUND*0.585,W,GROUND*0.50); ctx.stroke(); ctx.restore();

  // pitchside LED ad boards — polished board (top highlight + bottom shade) with scrolling text
  const adY=GROUND-24, adH=24;
  const adg=ctx.createLinearGradient(0,adY,0,adY+adH); adg.addColorStop(0,'#1a254f'); adg.addColorStop(1,'#0a1130');
  ctx.fillStyle=adg; ctx.fillRect(0,adY,W,adH);
  ctx.fillStyle='rgba(255,255,255,0.14)'; ctx.fillRect(0,adY,W,1.5);
  ctx.fillStyle='rgba(0,0,0,0.40)'; ctx.fillRect(0,adY+adH-2,W,2);
  ctx.font=FONT(13,800); ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  const sep='   •   ';
  let unit=0; const widths=AD_BOARDS.map(b=>{ const w=ctx.measureText(b.t+sep).width; unit+=w; return w; });
  const scroll=(G.frame*1.1)%unit;
  for (let x=-scroll; x<W; ){
    for (let i=0;i<AD_BOARDS.length && x<W;i++){
      const b=AD_BOARDS[i], w=widths[i];
      ctx.fillStyle=b.c; ctx.fillText(b.t+sep, x, adY+adH-8);
      x+=w;
    }
  }

  // broadcast vignette to frame the backdrop (behind the pitch + players)
  const vig=ctx.createRadialGradient(CENTER,GROUND*0.64,GROUND*0.46,CENTER,GROUND*0.64,W*0.66);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(5,7,20,0.42)');
  ctx.fillStyle=vig; ctx.fillRect(0,0,W,GROUND+6);
}

function drawPitch(){
  // grass with mow stripes
  for (let i=0;i<14;i++){ ctx.fillStyle = i%2? '#2aa64b' : '#23973f'; ctx.fillRect(i*(W/14), GROUND, W/14+1, H-GROUND); }
  // top-lit sheen + a soft spotlight pool so the play area pops (broadcast look)
  const lit=ctx.createLinearGradient(0,GROUND,0,H); lit.addColorStop(0,'rgba(255,255,235,0.16)'); lit.addColorStop(0.5,'rgba(255,255,235,0)');
  ctx.fillStyle=lit; ctx.fillRect(0,GROUND,W,H-GROUND);
  const spot=ctx.createRadialGradient(CENTER,GROUND,20,CENTER,GROUND,W*0.55);
  spot.addColorStop(0,'rgba(255,255,225,0.10)'); spot.addColorStop(1,'rgba(255,255,225,0)');
  ctx.fillStyle=spot; ctx.fillRect(0,GROUND-30,W,H-GROUND+30);
  // contact shadow where the stands meet the grass
  ctx.fillStyle='rgba(0,0,0,0.16)'; ctx.fillRect(0,GROUND,W,3);
  // pitch markings — halfway line, perspective centre circle + spot, goal-area arcs
  const my=GROUND+(H-GROUND)*0.55;
  ctx.strokeStyle='rgba(255,255,255,0.62)'; ctx.lineWidth=3; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(CENTER,GROUND); ctx.lineTo(CENTER,H); ctx.stroke();             // halfway line
  ctx.beginPath(); ctx.ellipse(CENTER,my,86,18,0,0,7); ctx.stroke();                           // centre circle (flattened)
  ctx.fillStyle='rgba(255,255,255,0.62)'; ctx.beginPath(); ctx.ellipse(CENTER,my,3.4,1.7,0,0,7); ctx.fill();   // centre spot
  ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.ellipse(GOAL_D+6, my, 58, 14, 0, -0.62, 0.62); ctx.stroke();            // left goal-area arc
  ctx.beginPath(); ctx.ellipse(W-GOAL_D-6, my, 58, 14, 0, Math.PI-0.62, Math.PI+0.62); ctx.stroke();  // right goal-area arc
}

function drawGoal(left){
  const x = left ? 0 : W-GOAL_D;
  ctx.save();
  // net
  ctx.strokeStyle='rgba(255,255,255,0.36)'; ctx.lineWidth=1;
  for (let i=0;i<=GOAL_D;i+=8){ ctx.beginPath(); ctx.moveTo(x+i,BAR_Y); ctx.lineTo(x+i,GROUND); ctx.stroke(); }
  for (let j=BAR_Y;j<=GROUND;j+=8){ ctx.beginPath(); ctx.moveTo(x,j); ctx.lineTo(x+GOAL_D,j); ctx.stroke(); }
  // palen
  const postX = left ? GOAL_D : W-GOAL_D;
  ctx.fillStyle='#ffffff';
  ctx.fillRect(postX-3, BAR_Y, 6, GOAL_H);              // staander
  ctx.fillRect(left?0:postX-3, BAR_Y-BAR_TH, left?GOAL_D+3:GOAL_D+3, BAR_TH); // lat
  ctx.restore();
}

// lazy image cache for slime character art (and any other in-canvas images)
const _imgCache = {};
function gameImg(src){
  if (typeof Image==='undefined') return { complete:false };     // headless/test: fall back to procedural
  let im=_imgCache[src]; if(!im){ im=new Image(); im.decoding='async'; im.src=src; _imgCache[src]=im; } return im;
}

function drawSlime(s){
  const r = slimeR(s);                                  // 💪 mega power-up grows the dome
  const sx = 1 + s.squash*0.6, sy = 1 - s.squash*0.6;
  // schaduw
  ctx.fillStyle='rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(s.x, GROUND+5, r*0.85, 9, 0, 0, 7); ctx.fill();

  // hand-drawn character art (per team), if present — all sprites are uniformly normalised
  // (512×512, fixed character width, baseline at the bottom) so every country renders the SAME size
  if (s.team.art){
    const art = gameImg(s.side==='left' ? s.team.art.right : s.team.art.left);   // face toward the centre
    if (art.complete && art.naturalWidth){
      const w = r*2.98, h = w;                          // square sprite; character width ≈ 2.5·r
      ctx.save(); ctx.translate(s.x, s.y); ctx.scale(sx, sy);
      ctx.drawImage(art, -w/2, -h*0.977, w, h);         // baseline (0.977 of the sprite) sits on the foot
      ctx.restore();
      drawSlimeFx(s, r);
      return;
    }
  }

  ctx.save();
  ctx.translate(s.x, s.y); ctx.scale(sx,sy);
  // body: radial gradient lit from upper-left → rounder, sharper read
  const g=ctx.createRadialGradient(-r*0.32,-r*0.55,r*0.12, 0,-r*0.10,r*1.18);
  g.addColorStop(0,   lighten(s.team.color,55));
  g.addColorStop(0.45, s.team.color);
  g.addColorStop(1,   darken(s.team.color,44));
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.arc(0,0,r,Math.PI,0); ctx.closePath(); ctx.fill();
  // trim ring
  ctx.fillStyle=s.team.trim; ctx.globalAlpha=0.92;
  ctx.beginPath(); ctx.arc(0,0,r-3,Math.PI,0); ctx.arc(0,0,r-8,0,Math.PI,true); ctx.closePath(); ctx.fill();
  ctx.globalAlpha=1;
  // crisp rim outline (darker team shade) for definition
  ctx.lineJoin='round'; ctx.strokeStyle=darken(s.team.color,52); ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(0,0,r-1.2,Math.PI,0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r+1,0); ctx.lineTo(r-1,0); ctx.stroke();    // base edge
  // glossy specular (sharp dot + soft sheen)
  ctx.fillStyle='rgba(255,255,255,0.45)';
  ctx.beginPath(); ctx.ellipse(-r*0.38,-r*0.54,r*0.19,r*0.10,-0.6,0,7); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.14)';
  ctx.beginPath(); ctx.ellipse(-r*0.10,-r*0.30,r*0.46,r*0.22,-0.5,0,7); ctx.fill();
  ctx.restore();

  // eye (fixed screen position, not squashed): white + thin rim + pupil + catchlight
  const eyeYBase = s.y - r*0.55;
  const eyeX = s.x + (s.side==='left'?14:-14);
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(eyeX, eyeYBase, 12, 0, 7); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(eyeX, eyeYBase, 12, 0, 7); ctx.stroke();
  const px=eyeX + s.eyeX*5, py=eyeYBase + s.eyeY*5;
  ctx.fillStyle='#0a0a16'; ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(px-2, py-2, 1.8, 0, 7); ctx.fill();
  // (the no-camping warning is drawn on the ground via drawCampZones, like the original)

  drawSlimeFx(s, r);
}

// power-up state drawn on top of a slime (procedural OR character art): icy shell when
// frozen, plus active-effect icon + remaining-time bars floating above.
function drawSlimeFx(s, r){
  if (s.frozen > 0){
    ctx.fillStyle='rgba(155,208,248,0.42)';
    ctx.beginPath(); ctx.arc(s.x, s.y, r+3, Math.PI, 0); ctx.closePath(); ctx.fill();
  }
  const badges = [];
  if (s.fx)        badges.push({ k:s.fx.type, c:POWER_TYPES[s.fx.type].c, f:s.fx.t/s.fx.dur });
  if (s.powShot>0) badges.push({ k:'shot',    c:POWER_TYPES.shot.c,       f:s.powShot/POWER_TYPES.shot.dur });
  if (s.frozen>0)  badges.push({ k:'freeze',  c:POWER_TYPES.freeze.c,     f:s.frozen/POWER_TYPES.freeze.dur });
  if (!badges.length) return;
  const by = s.y - r - 28;
  badges.forEach((b,i)=>{
    const bx = s.x + (i - (badges.length-1)/2) * 34;
    ctx.fillStyle='rgba(8,10,24,0.78)'; roundRect(bx-15, by-15, 30, 30, 8); ctx.fill();
    ctx.strokeStyle=b.c; ctx.lineWidth=2; roundRect(bx-15, by-15, 30, 30, 8); ctx.stroke();
    drawPowGlyph(b.k, bx, by-1, 8, b.c);
    ctx.fillStyle='rgba(8,10,24,0.7)'; ctx.fillRect(bx-13, by+12, 26, 4);
    ctx.fillStyle=b.c;                 ctx.fillRect(bx-13, by+12, 26*Math.max(0,Math.min(1,b.f)), 4);
  });
}

// recognisable vector icon for each power-up, centred at (x,y), drawn in `col`
function drawPowGlyph(type, x, y, r, col){
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle=col; ctx.strokeStyle=col; ctx.lineWidth=Math.max(2, r*0.30);
  ctx.lineJoin='round'; ctx.lineCap='round';
  if (type==='turbo'){                                   // lightning bolt
    ctx.beginPath();
    ctx.moveTo(r*0.20,-r); ctx.lineTo(-r*0.55,r*0.18); ctx.lineTo(-r*0.06,r*0.18);
    ctx.lineTo(-r*0.22,r); ctx.lineTo(r*0.55,-r*0.20); ctx.lineTo(r*0.04,-r*0.20);
    ctx.closePath(); ctx.fill();
  } else if (type==='moon'){                             // crescent moon
    ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.fill();
    ctx.globalCompositeOperation='destination-out';
    ctx.beginPath(); ctx.arc(r*0.45,-r*0.20,r*0.86,0,7); ctx.fill();
    ctx.globalCompositeOperation='source-over';
  } else if (type==='mega'){                             // GROW: up double-chevron
    for (const dy of [r*0.20,-r*0.42]){
      ctx.beginPath(); ctx.moveTo(-r*0.72,dy+r*0.48); ctx.lineTo(0,dy-r*0.30); ctx.lineTo(r*0.72,dy+r*0.48); ctx.stroke();
    }
  } else if (type==='shrink'){                           // SHRINK: down double-chevron (opposite of mega)
    for (const dy of [-r*0.20,r*0.42]){
      ctx.beginPath(); ctx.moveTo(-r*0.72,dy-r*0.48); ctx.lineTo(0,dy+r*0.30); ctx.lineTo(r*0.72,dy-r*0.48); ctx.stroke();
    }
  } else if (type==='freeze'){                           // snowflake: 3 spokes + tips
    for (let k=0;k<3;k++){
      ctx.save(); ctx.rotate(k*Math.PI/3);
      ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(0,r); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(-r*0.32,-r*0.64); ctx.moveTo(0,-r); ctx.lineTo(r*0.32,-r*0.64);
                       ctx.moveTo(0, r); ctx.lineTo(-r*0.32, r*0.64); ctx.moveTo(0, r); ctx.lineTo(r*0.32, r*0.64); ctx.stroke();
      ctx.restore();
    }
  } else if (type==='shot'){                             // flame
    ctx.beginPath(); ctx.moveTo(0,r);
    ctx.bezierCurveTo(-r*0.95,r*0.45,-r*0.5,-r*0.35,0,-r);
    ctx.bezierCurveTo(r*0.18,-r*0.45,r*0.16,-r*0.10,r*0.36,r*0.04);
    ctx.bezierCurveTo(r*0.95,r*0.5,r*0.5,r,0,r);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// power-up pickups: parachute while falling, glowing disc + vector icon, bob once landed
function drawPows(){
  for (const p of G.pows){
    if (p.landed && p.t < 120 && (G.frame>>3 & 1)) continue;     // blink when about to fade
    const def = POWER_TYPES[p.type];
    const y = p.y + (p.landed ? Math.sin(G.frame*0.1)*3 : 0);
    const pulse = 1 + 0.08*Math.sin(G.frame*0.15);
    if (!p.landed){                                              // little parachute on the way down
      ctx.strokeStyle=def.c; ctx.fillStyle=def.c+'cc'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(p.x, y-30, 20, Math.PI, 0); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p.x-19,y-30); ctx.lineTo(p.x-5,y-16); ctx.moveTo(p.x,y-50); ctx.lineTo(p.x,y-16); ctx.moveTo(p.x+19,y-30); ctx.lineTo(p.x+5,y-16);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(p.x, y, 4, p.x, y, 36);
    g.addColorStop(0, def.c+'77'); g.addColorStop(1, def.c+'00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, y, 36, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath(); ctx.arc(p.x, y, 17*pulse, 0, 7); ctx.fill();
    ctx.strokeStyle = def.c; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(p.x, y, 17*pulse, 0, 7); ctx.stroke();
    drawPowGlyph(p.type, p.x, y, 9.5*pulse, def.c);
  }
}

// big top-left play-screen panel telling you power-ups are live (label row + icon row)
function drawPowerSticker(){
  const ic = Object.keys(POWER_TYPES), pad=16, x=16, y=104, gap=32;
  ctx.save();
  ctx.font=FONT(18,900);
  const tw = ctx.measureText('POWER-UPS').width;
  const w = pad*2 + Math.max(tw + 24, ic.length*gap);
  const h = 66;
  roundRect(x,y,w,h,13); ctx.fillStyle='rgba(10,14,30,0.9)'; ctx.fill();
  ctx.lineWidth=3; ctx.strokeStyle='rgba(255,210,90,0.95)'; roundRect(x,y,w,h,13); ctx.stroke();
  // label row: a bolt + "POWER-UPS"
  drawPowGlyph('turbo', x+pad+9, y+21, 10, '#ffd23b');
  ctx.fillStyle='#ffd23b'; ctx.font=FONT(18,900); ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText('POWER-UPS', x+pad+24, y+22);
  // icon row: every power, larger
  let gx = x+pad+16;
  for (const k of ic){ drawPowGlyph(k, gx, y+48, 12, POWER_TYPES[k].c); gx+=gap; }
  ctx.textBaseline='alphabetic';
  ctx.restore();
}

// goal-hanging zones marked on the pitch near each goal; they light up when a slime camps
function drawCampZones(){
  if (!G.p1 || !G.p2) return;
  const zw = W*0.20, gh = H-GROUND;     // matches inCampZone() boundary
  [[G.p1, 0, true], [G.p2, W-zw, false]].forEach(([s, zx, isLeft])=>{
    let col='255,235,160', a=0.16;                       // idle: clearly visible warning strip on the grass
    if (s.penalty>0){ col='255,84,112'; a=(G.frame>>2&1)?0.55:0.22; }
    else if (s.hang>CAMP_WARN){ const f=Math.min(1,(s.hang-CAMP_WARN)/(CAMP_MAX-CAMP_WARN)); col='255,174,59'; a=0.22+0.40*f; }
    ctx.fillStyle=`rgba(${col},${a})`; ctx.fillRect(zx, GROUND, zw, gh);
    // hazard hatching (clipped to the zone) so the no-hang area reads even when idle
    ctx.save();
    ctx.beginPath(); ctx.rect(zx, GROUND, zw, gh); ctx.clip();
    ctx.strokeStyle=`rgba(${col},${Math.min(0.95,a+0.30)})`; ctx.lineWidth=3;
    for (let x=zx; x<zx+zw+gh; x+=16){ ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x-gh, H); ctx.stroke(); }
    ctx.restore();
    // bright boundary line at the inner edge of the zone
    const bx = isLeft ? zx+zw : zx;
    ctx.strokeStyle=`rgba(${col},${Math.min(1,a+0.55)})`; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(bx, GROUND); ctx.lineTo(bx, H); ctx.stroke();
    // build-up meter above the slime so the penalty is telegraphed
    if (s.hang > 8 || s.penalty > 0){
      const mw=72, mh=7, mx=s.x-mw/2, my=s.y-SLIME_R-30;
      const f = s.penalty>0 ? 1 : Math.min(1, s.hang/CAMP_MAX);
      ctx.fillStyle='rgba(8,10,24,0.8)'; ctx.fillRect(mx-2,my-2,mw+4,mh+4);
      ctx.fillStyle = f>0.75?'#ff5470':(f>0.45?'#ffae3b':'#7cc0ee'); ctx.fillRect(mx,my,mw*f,mh);
    }
  });
}

function drawBall(b){
  // shadow
  const sh = clamp(1-(GROUND-b.y)/300,0.15,1);
  ctx.fillStyle=`rgba(0,0,0,${0.28*sh})`;
  ctx.beginPath(); ctx.ellipse(b.x, GROUND+5, BALL_R*sh, 5*sh, 0,0,7); ctx.fill();

  ctx.save();
  ctx.translate(b.x,b.y); ctx.rotate(b.spin);
  // white ball
  ctx.fillStyle='#f7f7f7'; ctx.beginPath(); ctx.arc(0,0,BALL_R,0,7); ctx.fill();
  // subtle WC 2026 swirl accents (red/blue/green), clipped to the ball
  ctx.save(); ctx.beginPath(); ctx.arc(0,0,BALL_R,0,7); ctx.clip();
  ctx.lineWidth=3; ctx.globalAlpha=0.5; ctx.lineCap='round';
  ctx.strokeStyle='#1f6fff'; ctx.beginPath(); ctx.arc(-BALL_R*0.2,-BALL_R*0.1, BALL_R*0.95, -0.5, 1.5); ctx.stroke();
  ctx.strokeStyle='#e4002b'; ctx.beginPath(); ctx.arc( BALL_R*0.45, BALL_R*0.25, BALL_R*0.75, 2.1, 4.1); ctx.stroke();
  ctx.strokeStyle='#00a64a'; ctx.beginPath(); ctx.arc( BALL_R*0.5, -BALL_R*0.45, BALL_R*0.55, 1.2, 3.4); ctx.stroke();
  ctx.globalAlpha=1; ctx.restore();
  // rim + panel dots (mostly dark for grip, a couple coloured)
  ctx.strokeStyle='#cfcfcf'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(0,0,BALL_R,0,7); ctx.stroke();
  ctx.fillStyle='#16161e'; ctx.beginPath(); ctx.arc(0,0,BALL_R*0.26,0,7); ctx.fill();
  const dot=['#16161e','#1f6fff','#16161e','#e4002b','#00a64a'];
  for (let i=0;i<5;i++){ const a=i/5*Math.PI*2; ctx.fillStyle=dot[i];
    ctx.beginPath(); ctx.arc(Math.cos(a)*BALL_R*0.62, Math.sin(a)*BALL_R*0.62, BALL_R*0.13, 0,7); ctx.fill(); }
  ctx.restore();
}

function drawParticles(){
  for (const p of G.particles){
    const a = clamp(p.life/p.max,0,1);
    ctx.globalAlpha=a; ctx.fillStyle=p.col;
    if (p.conf){ ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillRect(-p.r,-p.r*0.6,p.r*2,p.r*1.2); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); }
  }
  ctx.globalAlpha=1;
}

function drawScoreboard(){
  const SC=2;                                       // ~2x bigger HUD (flags + score)
  const w=244*SC, h=54*SC, x=CENTER-w/2, y=12;
  ctx.fillStyle='rgba(6,6,16,0.85)'; roundRect(x,y,w,h,10*SC); ctx.fill();
  ctx.strokeStyle='#2c2c55'; ctx.lineWidth=2; roundRect(x,y,w,h,10*SC); ctx.stroke();
  // flags
  drawMiniFlag(G.p1.team, x+10*SC, y+11*SC, 40*SC, 27*SC);
  drawMiniFlag(G.p2.team, x+w-50*SC, y+11*SC, 40*SC, 27*SC);
  // codes
  ctx.textBaseline='alphabetic';
  ctx.font=FONT(12*SC,800); ctx.textAlign='center';
  ctx.fillStyle=G.p1.team.color; ctx.fillText(G.p1.team.code, x+30*SC, y+50*SC);
  ctx.fillStyle=G.p2.team.color; ctx.fillText(G.p2.team.code, x+w-30*SC, y+50*SC);
  // score
  ctx.fillStyle='#fff'; ctx.font=FONT(28*SC,900);
  ctx.fillText(G.score[0]+' - '+G.score[1], CENTER, y+38*SC);
  // sub-line: match clock (time mode) or goal target
  ctx.textAlign='center';
  if (G.matchMode==='time'){
    if (G.golden){
      ctx.font=FONT(12*SC,800); ctx.fillStyle = (G.frame>>4&1)?'#ffae3b':'#ff5470';
      ctx.fillText('GOLDEN GOAL', CENTER, y+h+14*SC);
    } else {
      const sec=Math.max(0,Math.ceil(G.matchTime/60));
      const txt=(sec/60|0)+':'+String(sec%60).padStart(2,'0');
      ctx.font=FONT(16*SC,800); ctx.fillStyle = sec<=10 ? '#ff5470' : '#ffae3b';
      ctx.fillText(txt, CENTER, y+h+15*SC);
    }
  } else {
    ctx.font=FONT(11*SC,700); ctx.fillStyle='#9a9ad0';
    ctx.fillText('FIRST TO '+G.toWin, CENTER, y+h+13*SC);
  }
}

function drawMiniFlag(team, x,y,w,h){
  const img=flagImage(team.code);
  if (img && img.complete && img.naturalWidth){ ctx.drawImage(img, x, y, w, h); }
  else { const st=team.stripes;                         // stripe bands until the SVG decodes
    for (let i=0;i<st.length;i++){ ctx.fillStyle=st[i]; ctx.fillRect(x, y+i*(h/st.length), w, h/st.length+0.5); } }
  ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h);
}

function drawCountdown(){
  const n = Math.ceil(G.countdown/60);
  ctx.textAlign='center';
  if (n>0){
    const s = 1 + (1-(G.countdown%60)/60)*0.6;
    ctx.save(); ctx.translate(CENTER,H*0.42); ctx.scale(s,s);
    ctx.fillStyle='#ff7a18'; ctx.font=FONT(78,900);
    ctx.fillText(String(n),0,0);
    ctx.restore();
  } else {
    ctx.fillStyle='#34d17a'; ctx.font=FONT(64,900);
    ctx.fillText('GO!',CENTER,H*0.42);
  }
}
function drawGoalText(){
  ctx.textAlign='center';
  const wob=Math.sin(G.frame*0.4)*6;
  ctx.save(); ctx.translate(CENTER,H*0.4); ctx.rotate(wob*0.004);
  ctx.fillStyle='#fff'; ctx.font=FONT(66,900);
  ctx.fillText('GOAL!',0,wob);
  const scorerTeam = G.lastScorer===0?G.p1.team:G.p2.team;
  ctx.fillStyle='#fff'; ctx.font=FONT(20,800);
  ctx.fillText(teamName(scorerTeam).toUpperCase()+' SCORES', 0, 42);
  ctx.restore();
}
function drawPaused(){
  ctx.fillStyle='rgba(6,6,16,0.6)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font=FONT(42,900);
  ctx.fillText('PAUSED',CENTER,H*0.42);
  ctx.font=FONT(13,700); ctx.fillStyle='#9a9ad0';
  ctx.fillText('ESC to resume',CENTER,H*0.52);
}

function drawCRT(){
  ctx.globalAlpha=0.07; ctx.fillStyle='#000';
  for (let y=0;y<H;y+=3) ctx.fillRect(0,y,W,1);
  ctx.globalAlpha=1;
  const v=ctx.createRadialGradient(CENTER,H/2,H*0.3,CENTER,H/2,H*0.8);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,0.30)');
  ctx.fillStyle=v; ctx.fillRect(0,0,W,H);
}

// helpers
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function lighten(hex,amt){ return shade(hex,amt); }
function darken(hex,amt){ return shade(hex,-amt); }
function shade(hex,amt){
  const n=parseInt(hex.slice(1),16);
  let r=(n>>16)+amt, g=((n>>8)&255)+amt, b=(n&255)+amt;
  r=clamp(r,0,255); g=clamp(g,0,255); b=clamp(b,0,255);
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}

/* ----------------------------------------------------------------------------
   14. Main loop  (vaste tijdstap)
   ---------------------------------------------------------------------------- */
let acc=0, last=0;
const STEP=1000/60;
function frame(t){
  if (!last) last=t;
  acc += t-last; last=t;
  if (acc>250) acc=250;            // tab terug uit achtergrond
  let steps=0;
  while (acc>=STEP && steps<5){ tick(); acc-=STEP; steps++; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* The pitchside ad boards are decorative only — intentionally NOT clickable links,
   so a tap during play never navigates away from the game. */

/* ----------------------------------------------------------------------------
   15. UI / schermbeheer  (DOM overlays)
   ---------------------------------------------------------------------------- */
const $ = id => document.getElementById(id);
function hideAllOverlays(){ document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show')); }
function showOverlay(id){ hideAllOverlays(); $(id).classList.add('show'); }
/* desktop play-field size: 1× → 1.5× → Fill (Fill also requests browser fullscreen) */
function applyDeskSize(){
  const m = settings.deskSize || 'm';
  document.body.classList.toggle('dsize-l', m==='l');
  document.body.classList.toggle('dsize-full', m==='full');
  const b=$('stageSize'); if (b) b.textContent = m==='full' ? '🗗' : '⤢';
  requestAnimationFrame(resizeCanvas);                 // field size changed → re-match the backing store
}
function cycleStageSize(){
  const o=['m','l','full']; settings.deskSize = o[(o.indexOf(settings.deskSize||'m')+1)%o.length];
  store.save('deskSize', settings.deskSize); applyDeskSize();
  try {
    const el=document.documentElement;
    if (settings.deskSize==='full'){ if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(()=>{}); }
    else if (document.fullscreenElement && document.exitFullscreen){ document.exitFullscreen().catch(()=>{}); }
  } catch(e){}
}
document.addEventListener('fullscreenchange', ()=>{   // leaving fullscreen (Esc) drops back to the 1.5× window
  if (!document.fullscreenElement && settings.deskSize==='full'){ settings.deskSize='l'; store.save('deskSize','l'); applyDeskSize(); }
});
function updateTouchVisibility(){
  const inGame = (G.screen===SCREEN.PLAY||G.screen===SCREEN.COUNT||G.screen===SCREEN.GOAL) && !G.paused;
  // desktop: windowed play frame (title + pitch + Pause/Quit) while a match is on screen
  document.body.classList.toggle('deskgame', !IS_TOUCH && (G.screen===SCREEN.PLAY||G.screen===SCREEN.COUNT||G.screen===SCREEN.GOAL));
  applyDeskSize();
  $('touch').classList.toggle('show', IS_TOUCH && inGame);
  $('pad2').style.display = (G.mode==='2p') ? 'flex' : 'none';
  document.body.classList.toggle('m2p', G.mode==='2p');
  refreshBtnZones();                                   // recompute enlarged tap zones for this layout
  const hintTxt = (G.mode==='2p') ? t('playHint2p') : t('playHint');
  const hint = $('playHint'); hint.innerHTML = hintTxt; hint.style.display = 'none';   // desktop shows it under the pitch via #stageHint
  const sh = $('stageHint'); if (sh) sh.innerHTML = hintTxt;
  $('quitBtn').classList.toggle('show', inGame);
  $('muteBtn').classList.toggle('show', inGame);
  $('rulesBtn').classList.toggle('show', inGame);
  updateRotateHint();
}
function updateRotateHint(){
  const portrait = matchMedia('(orientation:portrait)').matches;
  const small = Math.min(innerWidth, innerHeight) < 760;
  const inGame = [SCREEN.PLAY,SCREEN.COUNT,SCREEN.GOAL].indexOf(G.screen) >= 0;
  $('rotate').classList.toggle('show', portrait && small && inGame);
}

// team-select state
let pickStage=0, pickP1=null, pickP2=null, wkPending=false;
function buildTeamGrid(){
  const grid=$('teamGrid'); grid.innerHTML='';
  // alphabetical by the displayed (localized) country name
  TEAMS.slice().sort((a,b)=>teamName(a).localeCompare(teamName(b), settings.lang)).forEach(t=>{
    const el=document.createElement('div');
    el.className='team'+(t.featured?' featured':'');
    el.dataset.code=t.code;
    el.innerHTML=`<div class="flag" style="background:${t.flag}"></div><div class="code">${t.code}</div>`;
    el.onclick=()=>pickTeam(t,el);
    grid.appendChild(el);
  });
}
function pickTeam(t,el){
  if (el && el.classList.contains('taken')) return;        // already taken by player 1 (2P)
  Audio.click();
  if (wkPending){ wkPending=false; setupWK(t); return; }   // World Cup: your country chosen
  if (G.mode==='guest' && guestPickSent) return;     // don't send twice (touch double-tap)
  document.querySelectorAll('.team').forEach(e=>e.classList.remove('sel'));
  el.classList.add('sel');
  if (G.mode==='guest'){ pickP2=t; guestPickSent=true; sendGuestTeamAndWait(); return; }
  if (pickStage===0){
    pickP1=t;
    if (G.mode==='1p'){
      // Friendly: you also choose the opponent — pick a second country (it plays the AI)
      pickStage=1; el.classList.add('taken');
      $('pickLabel').innerHTML=(I18N[settings.lang]&&I18N[settings.lang].pickOpp)||I18N.en.pickOpp;
      setTimeout(()=>document.querySelectorAll('.team').forEach(e=>{ if(!e.classList.contains('taken')) e.classList.remove('sel'); }),120);
    } else if (G.mode==='host'){
      // host picks own team, guest picks later
      pickP2=null; waitForGuestTeam();
    } else { // 2p — player 1 done; lock that team so player 2 can't pick the same one
      pickStage=1; $('pickLabel').innerHTML='Player <b>2</b> (right): pick your country';
      el.classList.add('taken');
      setTimeout(()=>document.querySelectorAll('.team').forEach(e=>{ if(!e.classList.contains('taken')) e.classList.remove('sel'); }),120);
    }
  } else { // 2p second pick
    if (t===pickP1) return;                                // same team not allowed
    pickP2=t; launchLocal();
  }
}
function launchLocal(){
  G.p1=makeSlime('left', pickP1); G.p2=makeSlime('right', pickP2); G.ball=makeBall();
  startMatch();
}

/* ---- World Cup knockout — real, randomly-seeded 16-team bracket --------------
   Each tournament randomly draws 16 of the 20 pool teams (your pick + 15 others)
   and seeds them into the bracket — so the draw is never fixed in advance. You
   play your own match every round; the other matches are auto-simulated from team
   strength, so right after your match you see who advanced and who you face next.
   Win 4 rounds (R16 -> QF -> SF -> Final) to be crowned champion. 2-min matches.
   ------------------------------------------------------------------------------ */
const WK_ROUNDS = ['Round of 16','Quarter-final','Semi-final','Final'];   // English keys for logic/DB
const _WK_RKEY = ['r16','qf','sf','final'];
function wkRoundName(i){ return t(_WK_RKEY[i] || 'final'); }              // translated round name (display)
const WK_HEAD   = ['R16','QF','SF','FINAL'];          // compact bracket column heads
const WK_DIFFS  = ['normal','hard','hard','worldcup'];// AI level per round
const WK_DIFF_MULT = { easy:1, normal:2, hard:3.5, worldcup:5, rising:3 };  // leaderboard points multiplier (mirrors slime_submit_score)
const WK_COUNTS = [8,4,2,1];                          // matches per round
// real 2026 host cities; your run is played across them, with the final in New York/New Jersey
const WK_VENUES = ['Los Angeles','Dallas','Atlanta','Houston','Kansas City','Seattle','Bay Area','Philadelphia','Miami','Boston','Mexico City','Guadalajara','Monterrey','Toronto','Vancouver'];
const WK_FINAL_VENUE = 'New York/New Jersey';

function shuffleArr(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function goWK(){ Audio.unlock(); ensureLeaderboard(); openMatchSetup('wk'); }   // setup (length + level) → pick country → bracket

// a match = { a, b, sa, sb, winner:0|1|null, played, user }
function newMatch(a,b){ return { a, b, sa:0, sb:0, winner:null, played:false, user:(a===G.wk.team||b===G.wk.team) }; }
function wkDiffsFor(mode){ return mode==='rising' ? WK_DIFFS.slice() : [mode,mode,mode,mode]; }
function wkLevelLabel(mode){ return mode==='rising' ? 'Rising' : (AI_LEVELS[mode] ? AI_LEVELS[mode].label : 'Rising'); }
function setupWK(team){
  G.wkMode = true;
  const diffMode = settings.wkDiff || 'rising';
  const venues = shuffleArr(WK_VENUES.slice()).slice(0,3).concat([WK_FINAL_VENUE]);   // your road to the final
  G.wk = { team, round:0, min: settings.wkMin||2, diffMode, diffs: wkDiffsFor(diffMode), venues, rounds:[], champion:null };
  const others = shuffleArr(TEAMS.filter(x=>x!==team)).slice(0,15);
  const field  = shuffleArr([team, ...others]);       // 16 teams, fully random seeding
  const r16=[]; for (let i=0;i<16;i+=2) r16.push(newMatch(field[i], field[i+1]));
  G.wk.rounds=[r16];
  showWKStage();
}
function wkUserMatch(){ const r=G.wk.rounds[G.wk.round]; return r ? r.find(m=>m.user) : null; }
function wkOppOf(m){ return m.a===G.wk.team ? m.b : m.a; }
function wkWinner(m){ return m.winner===0 ? m.a : m.b; }

// simulate an AI-vs-AI knockout result from team strength (no draws — golden goal decides)
function wkSim(a,b){
  const pa=(a.strength||75)/((a.strength||75)+(b.strength||75));
  let ga=0, gb=0, shots=4+((Math.random()*4)|0);
  for (let i=0;i<shots;i++){ if (Math.random()<pa*0.55) ga++; if (Math.random()<(1-pa)*0.55) gb++; }
  if (ga===gb){ if (Math.random()<pa) ga++; else gb++; }
  return [ga,gb];
}
function wkPlayOut(m){ if (m.played) return; const [ga,gb]=wkSim(m.a,m.b); m.sa=ga; m.sb=gb; m.winner=ga>gb?0:1; m.played=true; }
function wkBuildNextRound(r){
  const cur=G.wk.rounds[r], next=[];
  for (let i=0;i<cur.length;i+=2) next.push(newMatch(wkWinner(cur[i]), wkWinner(cur[i+1])));
  G.wk.rounds[r+1]=next;
}

// ---- bracket rendering (responsive columns, horizontally scrollable on mobile) ----
function wkRow(team, score, win, lose){
  if (!team) return `<div class="bk-team"><span class="flag" style="background:#15152e"></span><span class="nm bk-tbd">TBD</span></div>`;
  const you=team===G.wk.team;
  const cls='bk-team'+(win?' win':'')+(lose?' lose':'')+(you?' you':'');
  const sc=(score==null)?'':`<span class="sc">${score}</span>`;
  return `<div class="${cls}"><span class="flag" style="background:${team.flag}"></span>`+
         `<span class="nm">${escapeHtml(team.name)}${you?' (you)':''}</span>${sc}</div>`;
}
function wkMatchHTML(m, isNow){
  if (!m) return `<div class="bk-match">${wkRow(null)}${wkRow(null)}</div>`;
  const aWin=m.played&&m.winner===0, bWin=m.played&&m.winner===1;
  const cls='bk-match'+(m.user?' user':'')+(isNow?' now':'');
  return `<div class="${cls}">`+
    wkRow(m.a, m.played?m.sa:null, aWin, m.played&&!aWin)+
    wkRow(m.b, m.played?m.sb:null, bWin, m.played&&!bWin)+
  `</div>`;
}
function wkBracketHTML(){
  const wk=G.wk; let cols='';
  for (let r=0;r<4;r++){
    const round=wk.rounds[r], n=round?round.length:WK_COUNTS[r];
    const nowCol=(r===wk.round && !wk.champion);
    let cells='';
    for (let i=0;i<n;i++){
      const m=round?round[i]:null;
      cells+=`<div class="bk-cell">${wkMatchHTML(m, nowCol && m && m.user && !m.played)}</div>`;   // cell keeps later rounds centred on their feeders
    }
    cols+=`<div class="bk-col"><div class="bk-head">${WK_HEAD[r]}</div>${cells}</div>`;
  }
  if (wk.champion){
    const c=wk.champion;
    cols+=`<div class="bk-col"><div class="bk-head">🏆</div><div class="bk-cell">`+
      `<div class="bk-match user"><div class="bk-team win${c===wk.team?' you':''}">`+
      `<span class="flag" style="background:${c.flag}"></span><span class="nm">${escapeHtml(c.name)}</span></div></div></div></div>`;
  }
  return `<div class="bracket">${cols}</div>`;
}

function showWKStage(){
  const wk=G.wk; const m=wkUserMatch(); const opp=m?wkOppOf(m):null;
  $('wkTitle').textContent = wkRoundName(wk.round);
  const lvl = aiLabel(wk.diffMode);
  const venue = (wk.venues && wk.venues[wk.round]) || '';
  $('wkSub').innerHTML =
    `<div class="wk-bar"></div>`+
    `<span class="wk-host">🇺🇸🇲🇽🇨🇦 WORLD CUP 2026</span><br>`+
    `${t('youAre')} <b>${escapeHtml(teamName(wk.team))}</b> ⚽ · ${wk.min}-min · ${escapeHtml(lvl)}`+
    (venue ? `<br><span class="wk-venue">📍 ${escapeHtml(venue)} — ${wkRoundName(wk.round)}</span>` : '');
  $('wkOpts').innerHTML = '';   // length + level are now chosen on the setup screen before the draw
  $('wkBracket').innerHTML = wkBracketHTML();
  $('wkBtns').innerHTML = `<button id="wkPlay" class="btn">${t('playVs',{opp: opp?escapeHtml(teamName(opp)):'?'})}</button>`+
                          `<button id="wkQuit" class="btn secondary">${t('mainMenu')}</button>`;
  $('wkPlay').onclick = ()=>{ Audio.click(); wkStartMatch(); };
  $('wkQuit').onclick = ()=>{ Audio.click(); askEndWK(backToMenu, showWKStage); };
  showOverlay('wkScreen');
}
function wkStartMatch(){
  const m=wkUserMatch(); if(!m){ wkResolveAndAdvance(true); return; }
  G.mode='1p';
  pickP1=G.wk.team; pickP2=wkOppOf(m);                 // you always play the LEFT slime
  G.p1=makeSlime('left', pickP1); G.p2=makeSlime('right', pickP2); G.ball=makeBall();
  startMatch();   // wkMode -> 2-min time mode
}
function wkMatchEnd(won){
  const wk=G.wk; if(!wk){ showGameOver(); return; }
  const m=wkUserMatch();
  if (m){                                              // record from the user's view (G.p1 = you)
    const uf=G.score[0], ua=G.score[1];
    if (m.a===wk.team){ m.sa=uf; m.sb=ua; m.winner=won?0:1; }
    else              { m.sb=uf; m.sa=ua; m.winner=won?1:0; }
    m.played=true;
  }
  wkResolveAndAdvance(won);
}
// after your match: simulate the rest of the round, then continue or finish the tournament
function wkResolveAndAdvance(userWon){
  const wk=G.wk;
  wk.rounds[wk.round].forEach(wkPlayOut);              // play out the other matches this round
  if (userWon){
    if (wk.round >= WK_ROUNDS.length-1){ wk.champion=wk.team; wkShowResult(true); return; }
    wkBuildNextRound(wk.round); wk.round++;
    showWKStage();                                     // shows who advanced + your next opponent
  } else {
    let r=wk.round;                                    // eliminated: play the bracket out to a champion
    while (r < WK_ROUNDS.length-1){ wkBuildNextRound(r); wk.rounds[r+1].forEach(wkPlayOut); r++; }
    wk.champion = wkWinner(wk.rounds[WK_ROUNDS.length-1][0]);
    wkShowResult(false);
  }
}
// Leaderboard points for a World Cup run (granular, so scores are near-unique):
//   base per round survived  +  (goals_for − goals_against)         ... gameplay
//   all × difficulty factor  ×  win/loss factor (champion vs knocked out)
function wkGoals(){   // the user's aggregate goals for/against across every match they played
  const wk=G.wk; let gf=0, ga=0;
  wk.rounds.forEach(rd=>rd.forEach(m=>{ if(m.user && m.played){
    const uf=m.a===wk.team?m.sa:m.sb, ua=m.a===wk.team?m.sb:m.sa; gf+=uf; ga+=ua;
  }}));
  return { gf, ga };
}
function wkPoints(){
  const wk=G.wk; const champ = wk.champion===wk.team;
  const mult = (WK_DIFF_MULT[wk.diffMode]||2);
  const roundsWon = champ ? 4 : wk.round;
  const { gf, ga } = wkGoals();
  const winFactor = champ ? 1.5 : (roundsWon>0 ? 1.0 : 0.6);     // win/loss bonus
  const base = roundsWon*8 + (champ?40:0);                        // reward progress + the title
  const goalPts = (gf - ga)*4;                                    // goal difference matters
  const floor = Math.floor(gf*mult);                              // participation floor: goals always pay a little (trunc = server parity)
  return Math.max(floor, Math.round((base + goalPts) * mult * winFactor / 2));
}
function wkShowResult(champion){
  const wk=G.wk; const pts=wkPoints(); wk._pts=pts;
  if (champion){
    spawnConfetti(); Audio.win();
    $('wkTitle').textContent=t('champions');
    $('wkSub').innerHTML='<span class="wk-host">🇺🇸🇲🇽🇨🇦 WORLD CUP 2026</span><br>'+t('championsSub',{team:escapeHtml(teamName(wk.team))});
  } else {
    $('wkTitle').textContent=t('knockedOut');
    const champTxt = wk.champion ? t('championsTag',{name:escapeHtml(teamName(wk.champion))}) : '';
    $('wkSub').innerHTML='<span class="wk-host">🇺🇸🇲🇽🇨🇦 WORLD CUP 2026</span><br>'+t('knockedOutSub',{round:wkRoundName(wk.round),champ:champTxt});
  }
  // Score + save panel goes ABOVE the bracket (in wkOpts) so it's visible without
  // scrolling on a short landscape phone — the bracket below is just a reference.
  const panel = `<div class="wk-result">
      <div class="wk-result-team"><span class="flag" style="background:${wk.team.flag}"></span><b>${escapeHtml(teamName(wk.team))}</b></div>
      <div class="wk-score">⭐ ${pts} ${t('points')} · ${escapeHtml(aiLabel(wk.diffMode))}</div>
      <div class="wk-save">
        <input id="wkName" class="code-input" maxlength="20" placeholder="${t('yourName')}" value="${escapeHtml(store.load('lbname',''))}">
        <button id="wkSubmit" class="btn small">${t('submitPts',{n:pts})}</button>
        <div class="status" id="wkStatus"></div>
      </div>
    </div>`;
  $('wkOpts').innerHTML = panel;
  $('wkBracket').innerHTML = wkBracketHTML();
  $('wkBtns').innerHTML = `<button id="wkAgain" class="btn">${t('newTournament')}</button>`+
                          `<button id="wkHome" class="btn secondary">${t('mainMenu')}</button>`;
  $('wkAgain').onclick=()=>{ Audio.click(); setupWK(wk.team); };
  $('wkHome').onclick=()=>{ Audio.click(); backToMenu(); };
  const sb=$('wkSubmit'); if (sb) sb.onclick=submitWKRun;
  showOverlay('wkScreen');
}
async function submitWKRun(){
  await ensureLeaderboard();
  if (!window.Leaderboard) return;
  const wk=G.wk;
  const name=($('wkName').value||'').trim()||'Anonymous';
  store.save('lbname', name);
  $('wkSubmit').disabled=true; $('wkStatus').textContent=t('submitting'); $('wkStatus').className='status';
  // send the match FACTS; the server recomputes the points (anti-cheat — client can't inflate)
  const g=wkGoals();
  const pts=await window.Leaderboard.submit({ name, team:wk.team.code, diff:wk.diffMode,
    rounds:wk.round, champion:(wk.champion===wk.team), gf:g.gf, ga:g.ga });
  const ok = pts!=null;
  $('wkStatus').textContent = ok?t('submittedOk'):t('submitFail'); $('wkStatus').className='status '+(ok?'ok':'err');
  $('wkSubmit').textContent = ok?t('submitted'):t('submit'); if(!ok) $('wkSubmit').disabled=false;
  if (ok){ const you={ name, points: pts|0 }; setTimeout(()=>showLeaderboard('wk', you), 850); }   // link to the high scores + show your position
}
// ---- menu knoppen ----
let setupKind='1p';   // which flavour of the shared setup screen: '1p' | '2p' | 'wk'
function go1p(){ Audio.unlock(); G.mode='1p'; openMatchSetup('1p'); }
function go2p(){ Audio.unlock(); G.mode='2p'; pickStage=0; openMatchSetup('2p'); }
// shared setup screen (difficulty + format) used by Friendly, 2 Players AND World Cup
function openMatchSetup(kind){
  setupKind = kind;
  const titles = { '1p':t('setFriendly'), '2p':t('set2p'), 'wk':t('setWC') };
  $('setupTitle').textContent = titles[kind] || titles['1p'];
  $('setupSub').textContent = kind==='wk' ? t('setSubWC') : t('setSub');
  $('setupDiffWrap').style.display = kind==='2p' ? 'none' : '';          // no AI difficulty in 2P
  $('setupFmtLabel').textContent = kind==='wk' ? t('matchLength') : t('matchFormat');
  $('setupPlay').innerHTML = kind==='wk' ? t('continueCountry') : t('continueTeams');
  // desktop: show which keys to use before the match (esp. for 2 players)
  const sk=$('setupKeys');
  if (sk){
    sk.style.display = IS_TOUCH ? 'none' : 'block';
    sk.innerHTML = kind==='2p' ? t('keys2p') : t('keys1p');
  }
  renderSetupPills();
  G.screen=SCREEN.TEAM;
  showOverlay('setupScreen');
}
function startTeamSelect(){
  if (setupKind==='wk'){ wkPending=true; openTeamSelect(t('pickWC')); return; }
  if (G.mode==='2p'){ pickStage=0; openTeamSelect(t('pickP1')); }
  else openTeamSelect(t('pickYourCountry'));
}
function renderSetupPills(){
  // Power-ups toggle: Friendly (1P) + 2 Players only — never World Cup (leaderboard fairness)
  const pw=$('setupPowerWrap');
  if (pw){
    const show = setupKind!=='wk';
    pw.style.display = show ? '' : 'none';
    if (show){
      const tg=$('setupPowerToggle');
      if (tg){
        tg.setAttribute('aria-pressed', settings.powerups?'true':'false');
        const txt=tg.querySelector('.pt-text'); if(txt) txt.textContent = settings.powerups?t('on'):t('off');
      }
      const lg=$('setupPowerLegend');
      if (lg){
        const good=[['⚡',t('powSpeed')],['🌙',t('powJump')],['💪',t('powBig')],['❄️',t('powFreeze')],['🔥',t('powShot')]];
        lg.innerHTML = good.map(([e,l])=>`<span class="pchip"><span class="pe">${e}</span>${l}</span>`).join('')
          + `<span class="pchip bad"><span class="pe">🔻</span>${t('powShrink')}</span>`;
        lg.style.opacity = settings.powerups ? '1' : '.45';
      }
    }
  }
  if (setupKind==='wk'){
    // World Cup: AI level (Rising ramps up each round, default) + match length — always timed
    const dr=$('setupDiffRow');
    dr.innerHTML=[['easy',t('diffEasy')],['normal',t('diffNormal')],['hard',t('diffHard')],['worldcup',t('diffWC')],['rising',t('diffRising')]]
      .map(([k,l])=>`<button class="pill${(settings.wkDiff||'rising')===k?' active':''}" data-d="${k}">${l}</button>`).join('');
    dr.querySelectorAll('.pill').forEach(p=>p.onclick=()=>{ Audio.click(); settings.wkDiff=p.dataset.d; store.save('wkDiff',settings.wkDiff); renderSetupPills(); });
    const fr=$('setupFmtRow');
    fr.innerHTML=[1,2,3,4].map(n=>`<button class="pill${(settings.wkMin||2)===n?' active':''}" data-min="${n}">${n}m</button>`).join('');
    fr.querySelectorAll('.pill').forEach(p=>p.onclick=()=>{ Audio.click(); settings.wkMin=+p.dataset.min; store.save('wkMin',settings.wkMin); renderSetupPills(); });
    return;
  }
  if (G.mode==='1p'){
    const dr=$('setupDiffRow');
    dr.innerHTML=[['easy',t('diffEasy')],['normal',t('diffNormal')],['hard',t('diffHard')],['worldcup',t('diffWorldCup')]]
      .map(([k,l])=>`<button class="pill${settings.diff===k?' active':''}" data-d="${k}">${l}</button>`).join('');
    dr.querySelectorAll('.pill').forEach(p=>p.onclick=()=>{ Audio.click(); settings.diff=p.dataset.d; store.save('diff',settings.diff); renderSetupPills(); });
  }
  const isGoals=settings.matchMode!=='time';
  const fr=$('setupFmtRow');
  fr.innerHTML=`<button class="pill mode${isGoals?' active':''}" data-set="goals">${t('goals')}</button>`+
               `<button class="pill mode${!isGoals?' active':''}" data-set="time">${t('timed')}</button>`+
               `<span class="pill-sep"></span>`+
               (isGoals?[3,5,7].map(n=>`<button class="pill${settings.toWin===n?' active':''}" data-win="${n}">${n}</button>`).join('')
                       :[1,2,4].map(n=>`<button class="pill${settings.matchMin===n?' active':''}" data-min="${n}">${n}m</button>`).join(''));
  fr.querySelectorAll('.pill').forEach(p=>p.onclick=()=>{ Audio.click();
    if(p.dataset.set==='goals'){ settings.matchMode='goals'; store.save('matchMode','goals'); }
    else if(p.dataset.set==='time'){ settings.matchMode='time'; store.save('matchMode','time'); }
    else if(p.dataset.win){ settings.toWin=+p.dataset.win; store.save('toWin',settings.toWin); G.toWin=settings.toWin; }
    else if(p.dataset.min){ settings.matchMin=+p.dataset.min; store.save('matchMin',settings.matchMin); }
    renderSetupPills();
  });
}
function openTeamSelect(label){ pickStage=0; pickP1=pickP2=null; G.screen=SCREEN.TEAM; $('pickLabel').innerHTML=label; buildTeamGrid(); showOverlay('teamScreen'); }

/* ---- Lazy script loading (keep PeerJS + leaderboard out of the initial render path) ---- */
const _scriptP = {};
function loadScript(src){
  if (_scriptP[src]) return _scriptP[src];
  return _scriptP[src] = new Promise((res,rej)=>{
    const s=document.createElement('script'); s.src=src; s.async=true;
    s.onload=()=>res(true);
    s.onerror=()=>{ _scriptP[src]=null; rej(new Error('failed to load '+src)); };
    document.head.appendChild(s);
  });
}
async function ensurePeer(){
  if (typeof Peer!=='undefined') return true;
  try { await loadScript('https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'); return typeof Peer!=='undefined'; }
  catch(e){ return false; }
}
function ensureLeaderboard(){
  if (window.Leaderboard) return Promise.resolve(true);
  return loadScript('leaderboard.js').then(()=>!!window.Leaderboard).catch(()=>false);
}
function peerUnavailable(){ const f=$('btnModeFriend'),q=$('btnModeQuick'); if(f)f.disabled=true; if(q)q.disabled=true; $('onlinePeerWarn').style.display='block'; }

async function goOnline(){
  Audio.unlock(); G.screen=SCREEN.ONLINE; showOverlay('onlineScreen');
  endQuick();                                              // clear any prior quick-match state
  showOnlineModes();                                       // step 1: pick a mode
  $('btnModeFriend').disabled=true; $('btnModeQuick').disabled=true;
  $('onlineStatus').textContent='Loading online…'; $('onlineStatus').className='status';
  const [ok] = await Promise.all([ensurePeer(), refreshIce()]);   // warm TURN creds alongside PeerJS
  if (ok){ $('btnModeFriend').disabled=false; $('btnModeQuick').disabled=false; $('onlineStatus').textContent=''; }
  else { peerUnavailable(); $('onlineStatus').textContent=''; }
  ensureLobby().then(hasLobby=>{ if (hasLobby) startOnlineCount(); });   // live quick-match lobby count
}
let onlineCountT=null;
function updateOnlineCount(){
  const el=$('onlineCount'); if(!el) return;
  if (!window.Lobby || !window.Lobby.count){ el.textContent=''; return; }
  window.Lobby.count().then(c=>{
    if (G.screen!==SCREEN.ONLINE || !el) return;
    if (!c){ el.textContent=''; return; }
    el.innerHTML = (c.waiting + c.playing === 0) ? t('lobbyEmpty') : t('lobbyCount', { w:c.waiting, p:c.playing });
  }).catch(()=>{});
}
function startOnlineCount(){
  updateOnlineCount();
  if (onlineCountT) clearInterval(onlineCountT);
  onlineCountT = setInterval(()=>{
    if (G.screen!==SCREEN.ONLINE){ clearInterval(onlineCountT); onlineCountT=null; return; }   // self-clear when we leave online
    updateOnlineCount();
  }, 8000);
}
function showOnlineModes(){
  $('onlineModes').style.display='flex';
  $('onlineIntro').style.display='block';
  $('onlineCount').style.display='block';
  $('friendPanel').style.display='none'; $('quickArea').style.display='none';
  $('hostArea').style.display='none'; $('joinArea').style.display='none';
  $('onlinePeerWarn').style.display='none'; $('onlineSubBack').style.display='none';
  $('onlineBack').style.display='inline-block';
  olStatus('');
}
function showFriendPanel(){
  Audio.click();
  $('onlineModes').style.display='none'; $('onlineIntro').style.display='none'; $('quickArea').style.display='none';
  $('onlineCount').style.display='none';
  $('friendPanel').style.display='block';
  $('hostArea').style.display='none'; $('joinArea').style.display='none';
  $('onlineSubBack').style.display='inline-block'; $('onlineBack').style.display='none';
  olStatus(t('hostOrJoin'));
}
function startQuickMode(){
  $('onlineModes').style.display='none'; $('onlineIntro').style.display='none'; $('friendPanel').style.display='none';
  $('onlineSubBack').style.display='inline-block'; $('onlineBack').style.display='none';
  quickMatch();
}
function backToOnlineModes(){
  Audio.click();
  cancelQuickSearch();                 // release any lobby slot + close the peer
  endQuick();
  showOnlineModes();
}

/* ---- Quick Match: server-matchmade opponent via the Supabase lobby ---- */
function olStatus(msg, cls){ $('onlineStatus').textContent = msg; $('onlineStatus').className = 'status' + (cls ? ' '+cls : ''); }
function ensureLobby(){ return ensureLeaderboard().then(()=> !!window.Lobby); }
let quickActive=false, quickT=null, quickCode='';
function endQuick(){ quickActive=false; if(quickT){clearInterval(quickT); quickT=null;} quickCode=''; }
function quickReset(){ endQuick(); $('quickArea').style.display='none'; showOnlineModes(); }
function cancelQuickSearch(){
  if (quickCode && window.Lobby){ try{ window.Lobby.cancel(quickCode); }catch(_){} }
  try{ G.net && G.net.close(); }catch(_){} G.net=null;
}
function cancelQuick(){ backToOnlineModes(); }
async function quickMatch(){
  Audio.unlock();
  $('quickArea').style.display='block'; $('onlinePeerWarn').style.display='none';
  olStatus('Loading…');
  const [okP, okL] = await Promise.all([ensurePeer(), ensureLobby(), refreshIce()]);
  if (!okP){ peerUnavailable(); olStatus('Online unavailable (offline?).','err'); quickReset(); return; }
  if (!okL || !window.Lobby){ olStatus('Matchmaking unavailable (offline?).','err'); quickReset(); return; }
  quickActive=true; quickCode='';
  G.mode='host'; G.net=makeNet(); G.net.code=randomCode();   // fresh ephemeral code (not the stored host code)
  olStatus('Connecting to server…');
  G.net.host(onQuickOpen, onQuickHostStatus, null);
}
async function onQuickOpen(code){
  if (!quickActive) return;
  quickCode = code;                                          // the code our peer is registered under
  let m=null; try{ m = await window.Lobby.findOrWait(code, store.load('lbname','')); }catch(_){}
  if (!quickActive) return;
  if (!m){ olStatus('Matchmaking error — try again.','err'); cancelQuickSearch(); quickReset(); return; }
  if (m.role==='guest' && m.host_code){
    // an opponent was already waiting -> drop our host peer and join them
    try{ G.net.close(); }catch(_){}
    quickActive=false; if(quickT){clearInterval(quickT);quickT=null;} quickCode='';
    olStatus('Opponent found! Connecting…','ok');
    G.mode='guest'; G.net=makeNet();
    G.net.join(m.host_code, (msg,err)=>olStatus(msg, err?'err':'ok'), null);
    patchNetForTeams();
  } else {
    // we're the waiting host now — wait up to 2 min for someone to join, with a countdown
    let left = 120;
    const showWait = ()=>olStatus('⚡ Searching for an opponent… '+(left/60|0)+':'+String(left%60).padStart(2,'0'),'waiting');
    showWait();
    quickT = setInterval(()=>{
      if(!quickActive){ clearInterval(quickT); quickT=null; return; }
      if(--left <= 0){ clearInterval(quickT); quickT=null; cancelQuickSearch(); olStatus('No opponents in 2 min — try again, or use a code.','err'); quickReset(); return; }
      showWait();
    }, 1000);
  }
}
function onQuickHostStatus(msg, err){
  if (/connected/i.test(msg)){                 // a guest joined our hosted game
    quickActive=false; if(quickT){clearInterval(quickT);quickT=null;}
    if (quickCode && window.Lobby){ try{ window.Lobby.cancel(quickCode); }catch(_){} } quickCode='';
    $('quickArea').style.display='none';
    Audio.matched(); olStatus('✅ Opponent found!','ok');
    openOnlineTeamPick();                        // straight into team pick (same flow as the code host)
    return;
  }
  olStatus(msg, err ? 'err' : (/waiting|searching/i.test(msg) ? 'waiting' : ''));
}

function showGameOver(){
  overShown=true;
  const winTeam = G.winner===1?G.p1.team:G.p2.team;
  let who;
  if (G.mode==='1p') who = G.winner===1?t('youWin'):t('cpuWins');
  else if (G.mode==='2p') who = t('playerWins',{n:G.winner});
  else { const meWon = G.winner===(G.mySlot||(G.mode==='host'?1:2)); who = meWon?t('youWin'):t('oppWins'); }
  $('overTitle').textContent=who;
  let sub=`<div class="flag" style="width:90px;height:60px;margin:10px auto;border-radius:6px;border:2px solid #000;background:${winTeam.flag}"></div>${escapeHtml(teamName(winTeam))} — ${G.score[0]} : ${G.score[1]}`;
  // online: only the host can start a rematch
  if (G.mode==='guest'){ $('overRematch').style.display='none'; sub+='<div class="status">'+t('waitHostRestart')+'</div>'; }
  else { $('overRematch').style.display=''; }
  $('overSub').innerHTML=sub;
  setupLbSubmit();
  { const ol=$('overLeaders'); if(ol) ol.style.display='none'; }   // high scores are World Cup-only — not after a friendly/2P/online match
  showOverlay('overScreen');
  updateTouchVisibility();
}

// ---- leaderboard is World Cup-only: no submit on the regular game-over screen ----
// (only winning the World Cup is a real achievement worth posting; see submitWKRun)
function setupLbSubmit(){
  const box=$('lbSubmit'); if(box) box.style.display='none';
  G._lbEntry=null;
}
async function submitScore(){
  if (!G._lbEntry || !window.Leaderboard) return;
  const name=($('lbName').value||'').trim() || 'Anonymous';
  store.save('lbname', name);
  $('lbSend').disabled=true; $('lbStatus').textContent='Submitting...'; $('lbStatus').className='status';
  const ok = await window.Leaderboard.submit(Object.assign({name}, G._lbEntry));
  if (ok){ $('lbStatus').textContent='Submitted! ⚽'; $('lbStatus').className='status ok'; $('lbSend').textContent='✓ Submitted'; }
  else { $('lbStatus').textContent='Failed (offline?)'; $('lbStatus').className='status err'; $('lbSend').disabled=false; }
}
let lbFrom='menu';
async function showLeaderboard(from, you){
  lbFrom = from || 'menu';
  showOverlay('lbScreen');
  const list=$('lbList'); list.innerHTML=t('loading');
  await ensureLeaderboard();
  if (!window.Leaderboard){ list.textContent=t('lbNA'); return; }
  const rows = await window.Leaderboard.top(12);
  if (!rows){ list.innerHTML='<div class="status err">'+t('lbFail')+'</div>'; return; }
  // after a submit: find the player's row, show their position, highlight + scroll to it
  let youIdx=-1, banner='';
  if (you){
    for (let i=0;i<rows.length;i++){ if (rows[i].name===you.name && (rows[i].points|0)===(you.points|0)){ youIdx=i; break; } }
    const n = youIdx>=0 ? youIdx+1 : (window.Leaderboard.rank ? await window.Leaderboard.rank(you.points) : null);
    banner = `<div class="lb-you">${t('yourPos', { n:(n||'?'), p:(you.points|0) })}</div>`;
  }
  if (!rows.length){ list.innerHTML = banner + '<div class="status">'+t('lbNone')+'</div>'; return; }
  list.innerHTML = banner + rows.map((r,i)=>{
    const tm=teamByCode(r.team);
    return `<div class="lb-row${i<3?' top':''}${i===youIdx?' you':''}">
      <span class="rank">${i+1}</span>
      <span class="who">${escapeHtml(r.name)} <span class="tcode">${tm.code}</span><span class="when">${escapeHtml(r.difficulty||r.mode||'')} · ${fmtDate(r.created_at)}</span></span>
      <span class="sc">${(r.points|0)} ${t('pts')}</span>
    </div>`;
  }).join('');
  const el = list.querySelector('.lb-row.you'); if (el && el.scrollIntoView) el.scrollIntoView({ block:'center' });
}
function fmtDate(s){ if(!s) return ''; const d=new Date(s); if(isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], {day:'2-digit',month:'short'}) + ' · ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function lbBack(){ if (lbFrom==='over'){ showOverlay('overScreen'); } else if (lbFrom==='wk'){ showOverlay('wkScreen'); } else { showOverlay('menuScreen'); } }
// How-to-play: from the menu, or from a live match (auto-pause, then resume on back)
let rulesFrom='menu';
function openRules(from){
  rulesFrom = from || 'menu';
  if (rulesFrom==='game'){ Audio.unlock(); G.paused=true; updateTouchVisibility(); }
  showOverlay('rulesScreen');
}
function rulesBack(){ if (rulesFrom==='game') resumeGame(); else showOverlay('menuScreen'); }

// lightweight confirm dialog (used to guard quitting an in-progress World Cup)
let _cfYes=null, _cfNo=null;
function askConfirm(o){
  $('confirmTitle').textContent = o.title||t('sure');
  $('confirmMsg').textContent   = o.msg||'';
  const y=$('confirmYes'), n=$('confirmNo');
  y.textContent = o.yes||t('yes'); y.className = 'btn ' + (o.yesClass||'secondary');
  n.textContent = o.no ||t('cancel'); n.className = 'btn ' + (o.noClass||'');
  _cfYes=o.onYes||null; _cfNo=o.onNo||null;
  showOverlay('confirmScreen');
}
function wkInProgress(){ return G.wkMode && G.wk && !G.wk.champion; }
function askEndWK(onYes, onNo){
  if (!wkInProgress()){ onYes(); return; }                      // nothing to lose -> no nag
  askConfirm({ title:t('endWC'), msg:t('endWCmsg'),
    yes:t('endTournament'), no:t('keepPlaying'), yesClass:'danger', noClass:'green', onYes, onNo });
}
function backToMenu(){
  if (quickCode && window.Lobby){ try{ window.Lobby.cancel(quickCode); }catch(_){} }   // release any waiting lobby slot
  quickActive=false; if(quickT){clearTimeout(quickT);quickT=null;} quickCode='';
  if (G.net){ G.net.close(); G.net=null; }
  G.mode='1p'; G.screen=SCREEN.MENU; G.paused=false; overShown=false;
  G.wkMode=false; G.wk=null; G.golden=false;
  guestMatchId=-1; guestPickSent=false;
  G.particles=[];
  startAttract();
  refreshMenuPills();
  showOverlay('menuScreen'); updateTouchVisibility();
}
function onConnectionLost(){
  if (G.net){ try{ G.net.close(); }catch(e){} G.net=null; }
  G.mode='1p'; G.screen=SCREEN.ONLINE; G.paused=false; overShown=false;
  guestMatchId=-1; guestPickSent=false; G.particles=[];
  $('hostArea').style.display='none'; $('joinArea').style.display='none';
  const hs=$('hostStart'); if(hs) hs.style.display='none';
  showOverlay('onlineScreen');
  $('onlineStatus').textContent=t('connLost'); $('onlineStatus').className='status err';
  updateTouchVisibility();
}
function rematch(){
  if (G.mode==='host' && G.net){
    if (!G.net.connected){ onConnectionLost(); return; }   // tegenstander weg
    hostMatchId++;
    G.swap = Math.random()<0.5;                // re-roll sides each rematch
    G.mySlot = G.swap ? 2 : 1;
    buildOnlineSlimes(pickP1, pickP2, G.swap);
    startMatch();
    G.net.startGame(startPayload());
  } else if (G.mode==='guest'){ /* alleen de host herstart; knop is verborgen */ }
  else startMatch();
  updateTouchVisibility();
}
// after a match: Friendly/2P can keep OR re-pick teams. Online keeps the proven
// same-teams rematch for now — the online "new teams" handshake is deferred until
// it can be checked on two devices.
function askRematch(){
  if (G.mode==='host' && G.net){
    if (!G.net.connected){ onConnectionLost(); return; }
    rematch();                                 // online: straight same-teams rematch (no dialog yet)
    return;
  }
  askConfirm({ title:t('rematchTitle'), msg:t('rematchMsg'),
    yes:t('newTeams'), no:t('sameTeams'), yesClass:'blue', noClass:'',   // Same teams = primary orange, New teams = blue
    onYes:rematchNewTeams, onNo:rematch });
}
function rematchNewTeams(){
  if (G.mode==='host' && G.net){
    if (!G.net.connected){ onConnectionLost(); return; }
    openOnlineTeamPick();                       // re-run the host→guest team handshake (guest re-picks on needTeam)
  } else {
    openMatchSetup();                           // local: back to setup + team select, same mode
  }
}

function onEscape(){
  // actief (online) potje of online-overlay: terug naar menu (geen pauze online)
  if (G.mode==='host' || G.mode==='guest'){ backToMenu(); return; }
  if (G.paused){ resumeGame(); return; }
  // lokaal spel: pauzemenu openen
  if (G.screen===SCREEN.PLAY || G.screen===SCREEN.COUNT || G.screen===SCREEN.GOAL){ openPause(); return; }
  // open submenu-overlay (team/online/settings/topscores) -> terug naar menu
  const open=document.querySelector('.overlay.show');
  if (open && open.id!=='menuScreen' && open.id!=='overScreen') backToMenu();
}
function openPause(){
  if (G.mode==='host'||G.mode==='guest') return;
  G.paused=true;
  $('pauseSub').textContent = G.wkMode ? t('quitLeaves') : t('pressEsc');
  showOverlay('pauseScreen'); updateTouchVisibility();
}
function resumeGame(){ G.paused=false; hideAllOverlays(); updateTouchVisibility(); }
function quitButton(){
  Audio.unlock();
  if (G.mode==='host'||G.mode==='guest'){ backToMenu(); return; }   // online: direct opgeven
  if (G.paused) resumeGame(); else openPause();
}

/* ---- Online flow ---- */
let hostMatchId=0, guestMatchId=-1, guestPickSent=false;
function startPayload(){ return { p1:pickP1.code, p2:pickP2.code, swap:G.swap?1:0, toWin:settings.toWin, matchMode:G.matchMode, matchMin:G.matchMin, mid:hostMatchId }; }

async function hostGame(){
  Audio.unlock();
  $('quickArea').style.display='none';
  if (!(await ensurePeer())){ peerUnavailable(); return; }
  G.mode='host'; G.net=makeNet();
  $('hostArea').style.display='block'; $('joinArea').style.display='none';
  $('hostCode').textContent='...';
  $('onlineStatus').textContent='Connecting to server...'; $('onlineStatus').className='status';
  G.net.host(
    code=>{ $('hostCode').textContent=code; $('onlineStatus').textContent='⏳ Waiting for your opponent to join — share the code or link below.'; $('onlineStatus').className='status waiting'; setupShare(code); },
    (msg,err)=>{ const conn=/connected/i.test(msg); if(conn){ Audio.matched(); msg='✅ Opponent connected! Tap “Pick team & start”.'; }
      $('onlineStatus').textContent=msg; $('onlineStatus').className='status '+(err?'err':(conn?'ok':'waiting')); if(!err) $('hostStart').style.display='inline-block'; },
    null
  );
  $('hostStart').style.display='none';
  $('shareRow').style.display='none';
}
function shareLink(code){ return `${location.origin}${location.pathname}?j=${code}`; }
function setupShare(code){
  const link = shareLink(code);
  $('shareRow').style.display='flex';
  $('waShare').onclick = ()=>{ Audio.click();
    const txt = encodeURIComponent(`Challenge me in World Cup Slime! ⚽ Open this link: ${link}`);
    window.open('https://wa.me/?text='+txt, '_blank'); };
  $('copyLink').onclick = async ()=>{ Audio.click();
    try { await navigator.clipboard.writeText(link); $('onlineStatus').textContent='Link copied — paste it in WhatsApp.'; $('onlineStatus').className='status ok'; }
    catch(e){ $('onlineStatus').textContent=link; } };
}
// open via uitnodig-link ?j=CODE -> direct naar join
function initFromURL(){
  const m = (location.search||'').match(/[?&]j=([A-Za-z0-9]{4,6})/);
  if (!m) return;
  const code = m[1].toUpperCase();
  try { history.replaceState(null,'',location.pathname); } catch(e){}
  goOnline(); showFriendPanel(); joinGame(); $('joinCode').value = code;
  setTimeout(()=>{ try{ joinConnect(); }catch(e){} }, 500);
}
function hostStartMatch(){
  if (!G.net || !G.net.connected){ $('onlineStatus').textContent='No opponent connected yet.'; $('onlineStatus').className='status err'; return; }
  // host picks their own country, then asks the guest to pick (waitForGuestTeam)
  openOnlineTeamPick();
}
function openOnlineTeamPick(){
  G.mode='host'; G.screen=SCREEN.TEAM;
  $('pickLabel').innerHTML='Host: pick <b>your</b> country';   // sides are randomised at kickoff
  buildTeamGrid(); showOverlay('teamScreen');
}
function waitForGuestTeam(){
  $('pickLabel').innerHTML='Waiting for opponent to pick a country…';
  G.net.conn.send({t:'needTeam', host:pickP1.code});           // tell the guest your team
  G.net._onGuestTeam = (code)=>{ pickP2=teamByCode(code); showMatchup(true); };   // both known -> confirm screen
  patchNetForTeams();
}
function patchNetForTeams(){
  const net=G.net; if (!net || net._teamsPatched) return; net._teamsPatched=true;   // idempotent: a rematch re-uses the same patched net
  const origRecv=net._recv.bind(net);
  net._recv=(d)=>{
    if (d.t==='pick'){ if (net._onGuestTeam) net._onGuestTeam(d.code); return; }
    if (d.t==='needTeam'){ if (d.host) pickP1=teamByCode(d.host); showGuestTeamPick(); return; }
    if (d.t==='start'){ onGuestStart(d); return; }
    origRecv(d);
  };
}
// color-coded confirm: you vs opponent, then the host starts the match
function teamCardHTML(tm){ return `<div class="mc-flag" style="background:${tm.flag}"></div><div class="mc-name">${escapeHtml(teamName(tm))}</div>`; }
function showMatchup(isHost){
  const you = isHost ? pickP1 : pickP2;
  const opp = isHost ? pickP2 : pickP1;
  G.mode = isHost ? 'host' : 'guest'; G.screen = SCREEN.ONLINE;
  $('matchYou').innerHTML = teamCardHTML(you);
  $('matchOpp').innerHTML = teamCardHTML(opp);
  $('matchSide').textContent = t('sidesRandom');
  if (isHost){
    $('matchStart').style.display=''; $('matchStatus').textContent=t('bothChosen');
    $('matchStart').onclick = ()=>{ Audio.click(); beginOnlineMatch(); };
  } else {
    $('matchStart').style.display='none'; $('matchStatus').textContent=t('waitHostStart'); $('matchStatus').className='status waiting';
  }
  showOverlay('matchupScreen');
}
function beginOnlineMatch(){
  if (G.net) G.net._onGuestTeam=null;        // voorkom dubbele start door 2e 'pick'
  G.mode='host';
  hostMatchId++;
  G.swap = Math.random()<0.5;                // random sides: who plays left/right
  G.mySlot = G.swap ? 2 : 1;                 // host drives p2 (right) when swapped
  buildOnlineSlimes(pickP1, pickP2, G.swap);  // pickP1=host team, pickP2=guest team
  startMatch();
  G.net.startGame(startPayload());           // mid in payload dedupe't aan gastzijde
}
function joinGame(){
  Audio.unlock(); G.mode='guest'; G.net=makeNet();
  $('hostArea').style.display='none'; $('quickArea').style.display='none'; $('joinArea').style.display='block';
}
async function joinConnect(){
  const code=$('joinCode').value.trim().toUpperCase();
  if (code.length<4){ $('onlineStatus').textContent='Enter the 4-letter code.'; $('onlineStatus').className='status err'; return; }
  $('onlineStatus').textContent='Connecting...'; $('onlineStatus').className='status';
  if (!(await ensurePeer())){ peerUnavailable(); $('onlineStatus').textContent='Online unavailable (offline?).'; $('onlineStatus').className='status err'; return; }
  G.net.join(code, (msg,err)=>{ const conn=/connected/i.test(msg); if(conn) Audio.matched();
    $('onlineStatus').textContent=conn?'✅ '+msg:msg; $('onlineStatus').className='status '+(err?'err':'ok'); }, null);
  patchNetForTeams();
}
function showGuestTeamPick(){
  G.mode='guest'; G.screen=SCREEN.TEAM; guestPickSent=false;
  // show which country the host took, then prompt for yours
  const host = pickP1 ? `<span class="mc-flag tiny" style="background:${pickP1.flag}"></span>${escapeHtml(pickP1.name)}` : 'the host';
  $('pickLabel').innerHTML=`Opponent picked ${host}.<br>Now pick <b>your</b> country`;
  buildTeamGrid();
  if (pickP1) document.querySelectorAll('#teamGrid .team').forEach(el=>{ if(el.dataset.code===pickP1.code) el.classList.add('opppick'); });  // mark host's team (non-blocking)
  showOverlay('teamScreen');
}
function sendGuestTeamAndWait(){
  G.net.conn.send({t:'pick', code:pickP2.code});
  showMatchup(false);                                         // show the color-coded matchup, wait for host
}
function onGuestStart(d){
  if (typeof d.mid==='number'){ if (d.mid===guestMatchId) return; guestMatchId=d.mid; }  // negeer dubbele 'start'
  pickP1=teamByCode(d.p1); pickP2=teamByCode(d.p2);
  G.swap = !!d.swap;
  G.mySlot = G.swap ? 1 : 2;                  // guest plays the side the host didn't take
  G.toWin=d.toWin||5;                         // niet de lokale settings muteren
  G.matchMode=d.matchMode||'goals'; G.matchMin=d.matchMin||2;
  G.matchTime=G.matchMin*3600; G.golden=false;
  buildOnlineSlimes(pickP1, pickP2, G.swap);  // same side assignment as the host
  G.score=[0,0]; G.winner=0; G.lastScorer=0; overShown=false;
  G.netTarget=null;                           // stale OVER-state weg (fix online revanche)
  G.countdown=180; G.screen=SCREEN.COUNT;     // aftelling tonen i.p.v. PLAY-flits
  hideAllOverlays(); updateTouchVisibility();
}

/* ---- Settings ---- */
function openSettings(){ refreshToggles(); showOverlay('setScreen'); }
function refreshToggles(){
  const setT=(id,lbl,val)=>{ const el=$(id); if(!el) return; const l=el.querySelector('.lbl'), v=el.querySelector('.val'); if(l) l.textContent=lbl; if(v) v.textContent=val; };
  setT('tSound', t('sound'), settings.sound?t('on'):t('off'));
  setT('tCrt',   t('crt'),   settings.crt?t('on'):t('off'));
  setT('tMode',  t('matchType'), settings.matchMode==='time'?t('matchTime'):t('goals'));
  setT('tWin',   settings.matchMode==='time'?t('matchLenMin'):t('firstTo'), settings.matchMode==='time'?settings.matchMin:settings.toWin);
  setT('tPower', t('powerups'), settings.powerups?t('on'):t('off'));
  setT('tDiff',  t('computerLevel'), aiLabel(settings.diff));
  setT('tLang',  t('language'), settings.lang==='nl'?'NL':'EN');
  const vr=$('volRange'); if(vr) vr.value=Math.round(settings.volume*100);
}
function cycleLang(){ settings.lang = settings.lang==='nl'?'en':'nl'; store.save('lang',settings.lang); applyStaticI18n(); refreshToggles(); renderMenuPills(); }
function updateSoundBtn(){ const i = settings.sound?'🔊':'🔇'; const b=$('btnSound'); if(b) b.textContent=i; const m=$('muteBtn'); if(m) m.textContent=i; const sm=$('stageMute'); if(sm) sm.textContent=i; }
function toggleSound(){ settings.sound=!settings.sound; store.save('sound',settings.sound); if(settings.sound)Audio.unlock(); Audio.setSound(settings.sound); updateSoundBtn(); refreshToggles(); }
function setupVolume(){
  const r=$('volRange'); if(!r) return;
  r.value=Math.round(settings.volume*100);
  r.oninput=()=>{ settings.volume=clamp01(r.value/100); store.save('volume',settings.volume); Audio.setVolume(settings.volume); if(settings.volume>0 && !settings.sound){ /* leave sound switch as-is */ } };
}
function shareGame(){
  const url = location.origin + location.pathname;        // clean URL (no ?j= invite code)
  if (navigator.share){ navigator.share({ title:'World Cup Slime', text:'Play World Cup Slime ⚽', url }).catch(()=>{}); return; }
  const b=$('btnShare'), done=()=>{ if(b){ const t=b.dataset.t||b.textContent; b.dataset.t=t; b.textContent='✓ Copied'; setTimeout(()=>{ b.textContent=t; }, 1500); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(()=>prompt('Copy this link:', url));
  else prompt('Copy this link:', url);
}
function toggleCrt(){ settings.crt=!settings.crt; store.save('crt',settings.crt); refreshToggles(); }
function togglePower(){ settings.powerups=!settings.powerups; store.save('powerups',settings.powerups); refreshToggles(); renderMenuPills(); }
function toggleMode(){ settings.matchMode = settings.matchMode==='time'?'goals':'time'; store.save('matchMode',settings.matchMode); refreshToggles(); }
function cycleWin(){
  if (settings.matchMode==='time'){ const o=[1,2,4,8]; settings.matchMin=o[(o.indexOf(settings.matchMin)+1)%o.length]; store.save('matchMin',settings.matchMin); }
  else { const o=[3,5,7]; settings.toWin=o[(o.indexOf(settings.toWin)+1)%o.length]; store.save('toWin',settings.toWin); G.toWin=settings.toWin; }
  refreshToggles();
}
function cycleDiff(){ const opts=Object.keys(AI_LEVELS); settings.diff=opts[(opts.indexOf(settings.diff)+1)%opts.length]; store.save('diff',settings.diff); refreshToggles(); }

/* ---- Menu match-length pills (mirror the original's 1/2/4/8 + Goals) ---- */
// Match-type pills: choose Goals (first to 3/5/7/10) or Timed (1/2/4/8 min) right from the menu
function renderMenuPills(){
  const row=$('lenRow'); if(!row) return;
  const isGoals = settings.matchMode!=='time';
  let html = `<button class="pill mode${isGoals?' active':''}" data-set="goals">${t('goals')}</button>`+
             `<button class="pill mode${!isGoals?' active':''}" data-set="time">${t('timed')}</button>`+
             `<span class="pill-sep"></span>`;
  if (isGoals) html += [3,5,7].map(n=>`<button class="pill${settings.toWin===n?' active':''}" data-win="${n}">${n}</button>`).join('');
  else         html += [1,2,4].map(n=>`<button class="pill${settings.matchMin===n?' active':''}" data-min="${n}">${n}m</button>`).join('');
  html += `<span class="pill-sep"></span>`+
          `<button class="pill${settings.powerups?' active':''}" data-pow="1" title="${t('powerupsHint')}">⚡</button>`;
  row.innerHTML = html;
  row.querySelectorAll('.pill').forEach(p=>{
    p.onclick=()=>{ Audio.unlock(); Audio.click();
      if (p.dataset.set==='goals'){ settings.matchMode='goals'; store.save('matchMode','goals'); }
      else if (p.dataset.set==='time'){ settings.matchMode='time'; store.save('matchMode','time'); }
      else if (p.dataset.win){ settings.toWin=+p.dataset.win; store.save('toWin',settings.toWin); G.toWin=settings.toWin; }
      else if (p.dataset.min){ settings.matchMin=+p.dataset.min; store.save('matchMin',settings.matchMin); }
      else if (p.dataset.pow){ settings.powerups=!settings.powerups; store.save('powerups',settings.powerups); }
      renderMenuPills();
    };
  });
}
function refreshMenuPills(){ renderMenuPills(); }
function setupMenuPills(){ renderMenuPills(); }

/* ----------------------------------------------------------------------------
   16. Knoppen koppelen + init
   ---------------------------------------------------------------------------- */
function wire(id, fn){ const el=$(id); if(el) el.onclick=()=>{ Audio.click(); fn(); }; }
wire('btnWK', goWK);
wire('btn1p', go1p);
wire('btn2p', go2p);
wire('btnOnline', goOnline);
wire('btnSettings', openSettings);
wire('pauseResume', resumeGame);
wire('pauseQuit', ()=>askEndWK(backToMenu, ()=>showOverlay('pauseScreen')));   // confirm before abandoning a WC run
wire('setupPlay', startTeamSelect);
wire('stageSize', cycleStageSize);
wire('setupPowerToggle', ()=>{ settings.powerups=!settings.powerups; store.save('powerups',settings.powerups); Audio.click(); renderSetupPills(); refreshToggles(); });
wire('setupBack', backToMenu);
wire('btnRules', ()=>openRules('menu'));
wire('rulesBtn', ()=>openRules('game'));   // in-game ❓ : pause + show the rules
wire('rulesBack', rulesBack);
wire('stagePause', quitButton);
wire('stageQuit', ()=>askEndWK(backToMenu, ()=>{}));   // desktop frame: quit to menu (guarded mid-tournament)
wire('stageRules', ()=>openRules('game'));              // desktop frame: top-right ❓
{ const sm=$('stageMute'); if (sm) sm.onclick = ()=>{ toggleSound(); }; }   // desktop frame: top-right sound
wire('confirmYes', ()=>{ const f=_cfYes; _cfYes=_cfNo=null; if(f) f(); });
wire('confirmNo',  ()=>{ const f=_cfNo;  _cfYes=_cfNo=null; if(f) f(); else backToMenu(); });
wire('tMode', toggleMode);
wire('tLang', cycleLang);
{ const qb=$('quitBtn'); if (qb) qb.onclick = quitButton; }
{ const mb=$('muteBtn'); if (mb) mb.onclick = ()=>{ toggleSound(); }; }
wire('teamBack', backToMenu);
wire('onlineBack', backToMenu);
wire('matchCancel', backToMenu);
wire('setBack', ()=>{ refreshMenuPills(); showOverlay('menuScreen'); });
wire('btnModeFriend', showFriendPanel);
wire('btnModeQuick', startQuickMode);
wire('btnHost', hostGame);
wire('btnJoin', joinGame);
wire('quickCancel', cancelQuick);
wire('onlineSubBack', backToOnlineModes);
wire('hostStart', hostStartMatch);
wire('joinGo', joinConnect);
wire('overRematch', askRematch);
wire('overMenu', backToMenu);
wire('btnSound', toggleSound);
wire('btnShare', shareGame);
wire('btnLeaders', ()=>showLeaderboard('menu'));
wire('overLeaders', ()=>showLeaderboard('over'));
wire('lbBack', lbBack);
wire('lbSend', submitScore);
wire('tSound', toggleSound);
wire('tCrt', toggleCrt);
wire('tWin', cycleWin);
wire('tPower', togglePower);
wire('tDiff', cycleDiff);

// PeerJS aanwezig?
// PeerJS now loads on demand (see ensurePeer/goOnline); no eager presence check needed.

// start the background music on the very first user interaction (autoplay-safe)
function firstGesture(){ Audio.unlock(); removeEventListener('pointerdown', firstGesture); removeEventListener('keydown', firstGesture); }
addEventListener('pointerdown', firstGesture); addEventListener('keydown', firstGesture);

// init
applyStaticI18n();                 // translate static UI to the saved language
buildTeamGrid();
setupMenuPills();
setupVolume();
updateSoundBtn();
// "2 Players · same device" needs two keyboard sets — desktop only
if (IS_TOUCH){ const b=$('btn2p'); if(b){ b.style.display='none'; } }
startAttract();
showOverlay('menuScreen');
updateTouchVisibility();
addEventListener('resize', ()=>{ resizeCanvas(); updateRotateHint(); refreshBtnZones(); });
addEventListener('orientationchange', ()=>setTimeout(()=>{ resizeCanvas(); updateRotateHint(); refreshBtnZones(); }, 200));
initFromURL();   // invite link ?j=CODE (PeerJS lazy-loads on demand)

// expose for debugging / tests — only on localhost or with ?debug=1 (keeps prod clean)
if (location.hostname==='localhost' || location.hostname==='127.0.0.1' || /[?&]debug=1\b/.test(location.search)){
  window.__G = G;
  window.__TEAMS = TEAMS;
  window.__demoMatchup = (a,b,host)=>{ pickP1=teamByCode(a); pickP2=teamByCode(b); showMatchup(!!host); };
}
