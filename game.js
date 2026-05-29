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

const W = 900, H = 520;              // logische resolutie
canvas.width = W; canvas.height = H;
ctx.imageSmoothingEnabled = false;

const GROUND   = H - 44;             // grondniveau (y van veld-oppervlak)
const CENTER   = W / 2;
const SLIME_R  = 62;                 // straal slime (halve cirkel) — kleiner = meer veld
const BALL_R   = 13;
const GOAL_H   = 150;                // hoogte doelmond
const GOAL_D   = 42;                 // diepte/breedte van het doel-net
const BAR_Y    = GROUND - GOAL_H;    // y van de lat
const BAR_TH   = 8;

// physics-afstemming (per 60fps tick)
const SLIME_SPEED = 6.3;
const SLIME_JUMP  = 14.4;
const SLIME_GRAV  = 0.72;
const BALL_GRAV   = 0.34;
const BALL_REST   = 0.86;            // demping bij muur/lat
const BALL_MAX    = 22;              // snelheidslimiet

/* ----------------------------------------------------------------------------
   1. Teams  (20-country pool; Netherlands featured/default).
   stripes = mini-flag (horizontal bands top->bottom). strength = bracket-sim seed.
   A tournament randomly draws 16 of these (your pick + 15 others).
   ---------------------------------------------------------------------------- */
const TEAMS = [
  { code:'NED', name:'Netherlands', color:'#ff7a18', trim:'#ffffff', strength:86, stripes:['#ae1c28','#ffffff','#21468b'], featured:true,
    flag:'linear-gradient(#ae1c28 33%,#fff 33% 66%,#21468b 66%)' },
  { code:'ARG', name:'Argentina',   color:'#7cc0ee', trim:'#ffffff', strength:92, stripes:['#74acdf','#ffffff','#74acdf'],
    flag:'linear-gradient(#74acdf 33%,#fff 33% 66%,#74acdf 66%)' },
  { code:'BRA', name:'Brazil',      color:'#ffd400', trim:'#1f8f3a', strength:90, stripes:['#1f8f3a','#ffd400','#2a47a8'],
    flag:'linear-gradient(135deg,#1f8f3a 40%,#ffd400 40% 60%,#1f8f3a 60%)' },
  { code:'FRA', name:'France',      color:'#3a6ec0', trim:'#ffffff', strength:91, stripes:['#0055a4','#ffffff','#ef4135'],
    flag:'linear-gradient(90deg,#0055a4 33%,#fff 33% 66%,#ef4135 66%)' },
  { code:'ENG', name:'England',     color:'#ededed', trim:'#d52b1e', strength:87, stripes:['#ffffff','#d52b1e','#ffffff'],
    flag:'linear-gradient(#d52b1e,#d52b1e) center/100% 26% no-repeat, linear-gradient(#d52b1e,#d52b1e) center/26% 100% no-repeat, #fff' },
  { code:'ESP', name:'Spain',       color:'#d52b1e', trim:'#ffd400', strength:88, stripes:['#aa151b','#f1bf00','#aa151b'],
    flag:'linear-gradient(#aa151b 25%,#f1bf00 25% 75%,#aa151b 75%)' },
  { code:'GER', name:'Germany',     color:'#222222', trim:'#ffce00', strength:85, stripes:['#000000','#dd0000','#ffce00'],
    flag:'linear-gradient(#000 33%,#dd0000 33% 66%,#ffce00 66%)' },
  { code:'POR', name:'Portugal',    color:'#1f8f3a', trim:'#d52b1e', strength:86, stripes:['#006600','#006600','#ff0000'],
    flag:'linear-gradient(90deg,#006600 40%,#ff0000 40%)' },
  { code:'ITA', name:'Italy',       color:'#1f7ae0', trim:'#ffffff', strength:83, stripes:['#009246','#ffffff','#ce2b37'],
    flag:'linear-gradient(90deg,#009246 33%,#fff 33% 66%,#ce2b37 66%)' },
  { code:'CRO', name:'Croatia',     color:'#d52b1e', trim:'#ffffff', strength:82, stripes:['#ff0000','#ffffff','#171796'],
    flag:'linear-gradient(#ff0000 50%,#171796 50%)' },
  { code:'MAR', name:'Morocco',     color:'#c1272d', trim:'#1f8f3a', strength:80, stripes:['#c1272d','#c1272d','#006233'],
    flag:'linear-gradient(#c1272d,#c1272d)' },
  { code:'JPN', name:'Japan',       color:'#ffffff', trim:'#bc002d', strength:78, stripes:['#ffffff','#bc002d','#ffffff'],
    flag:'radial-gradient(circle at 50% 50%, #bc002d 22%, #fff 23%)' },
  { code:'MEX', name:'Mexico',      color:'#1f8f3a', trim:'#ffffff', strength:76, stripes:['#006847','#ffffff','#ce1126'],
    flag:'linear-gradient(90deg,#006847 33%,#fff 33% 66%,#ce1126 66%)' },
  { code:'USA', name:'USA',         color:'#3a4ea8', trim:'#ffffff', strength:74, stripes:['#3c3b6e','#ffffff','#b22234'],
    flag:'linear-gradient(#b22234 50%,#3c3b6e 50%)' },
  { code:'CAN', name:'Canada',      color:'#d52b1e', trim:'#ffffff', strength:72, stripes:['#d80621','#ffffff','#d80621'],
    flag:'linear-gradient(90deg,#d80621 28%,#fff 28% 72%,#d80621 72%)' },
  { code:'BEL', name:'Belgium',     color:'#111111', trim:'#ffce00', strength:83, stripes:['#000000','#fdda24','#ef3340'],
    flag:'linear-gradient(90deg,#000 33%,#fdda24 33% 66%,#ef3340 66%)' },
  { code:'URU', name:'Uruguay',     color:'#5aa0e0', trim:'#ffffff', strength:82, stripes:['#7bb0e0','#ffffff','#7bb0e0'],
    flag:'repeating-linear-gradient(#7bb0e0 0 11%, #fff 11% 22%)' },
  { code:'SEN', name:'Senegal',     color:'#1f8f3a', trim:'#ffce00', strength:79, stripes:['#00853f','#fdef42','#e31b23'],
    flag:'linear-gradient(90deg,#00853f 33%,#fdef42 33% 66%,#e31b23 66%)' },
  { code:'SUI', name:'Switzerland', color:'#d52b1e', trim:'#ffffff', strength:77, stripes:['#d52b1e','#ffffff','#d52b1e'],
    flag:'linear-gradient(#fff,#fff) center/100% 30% no-repeat, linear-gradient(#fff,#fff) center/30% 100% no-repeat, #d52b1e' },
  { code:'COL', name:'Colombia',    color:'#fcd116', trim:'#003893', strength:80, stripes:['#fcd116','#003893','#ce1126'],
    flag:'linear-gradient(#fcd116 50%,#003893 50% 75%,#ce1126 75%)' },
];
const teamByCode = c => TEAMS.find(t => t.code === c) || TEAMS[0];

const AI_LEVELS = {
  easy:     { label:'Easy',      speed:0.62, react:120, jump:0.018, predict:14, mistake:0.30 },
  normal:   { label:'Normal',    speed:0.82, react:60,  jump:0.05,  predict:24, mistake:0.14 },
  hard:     { label:'Hard',      speed:0.96, react:28,  jump:0.10,  predict:34, mistake:0.05 },
  worldcup: { label:'World Cup', speed:1.06, react:10,  jump:0.16,  predict:46, mistake:0.0  },
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
  crt:       store.load('crt', true),
  matchMode: store.load('matchMode', 'goals'),   // 'goals' | 'time'
  toWin:     store.load('toWin', 5),
  matchMin:  store.load('matchMin', 2),           // match length in minutes (time mode)
  diff:      normDiff(store.load('diff', 'normal')),
};

/* ----------------------------------------------------------------------------
   3. Audio  (Web Audio, volledig gesynthetiseerd)
   ---------------------------------------------------------------------------- */
const Audio = (() => {
  let ac = null, master = null, crowd = null, crowdGain = null;
  function ensure(){
    if (ac) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.42; master.connect(ac.destination);
      startCrowd();
    } catch(e){ ac = null; }
  }
  function startCrowd(){
    // zacht stadiongeroezemoes: ruis door bandpass
    const buf = ac.createBuffer(1, ac.sampleRate*2, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*0.5;
    crowd = ac.createBufferSource(); crowd.buffer = buf; crowd.loop = true;
    const bp = ac.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=520; bp.Q.value=0.6;
    crowdGain = ac.createGain(); crowdGain.gain.value = settings.sound ? 0.04 : 0;
    crowd.connect(bp); bp.connect(crowdGain); crowdGain.connect(master);
    crowd.start();
  }
  // --- bouwstenen (zacht, met lowpass tegen schelheid) ---
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
  // trap = lage sinus-thump + korte contact-klik (voetbal-feel, geen piep)
  function kickThump(t0, f, vol){
    osc('sine', f, t0, 0.17, vol, f*0.55, 700);
    osc('triangle', f*2, t0, 0.06, vol*0.3, f, 1100);
    noiseHit(t0, 0.03, vol*0.45, 'highpass', 1600);
  }
  function hornNote(t0, f, dur, vol){
    osc('sawtooth', f, t0, dur, vol, null, 1100);
    osc('sawtooth', f*1.006, t0, dur, vol*0.65, null, 1100);   // detune = warmte
  }
  function crowdSwell(t, peak){
    if (!crowdGain) return; const base=settings.sound?0.04:0;
    crowdGain.gain.cancelScheduledValues(t);
    crowdGain.gain.setValueAtTime(Math.max(0.0001,base),t);
    crowdGain.gain.linearRampToValueAtTime(peak,t+0.18);
    crowdGain.gain.exponentialRampToValueAtTime(Math.max(0.0001,base),t+2.6);
  }
  const api = {
    unlock(){ ensure(); if (ac && ac.state==='suspended') ac.resume(); },
    kick(power){ if(!settings.sound||!ac) return; const t=ac.currentTime; const f=115+Math.min(120,power*6); kickThump(t,f, Math.min(0.5, 0.3+power*0.012)); },
    wall(){ if(!settings.sound||!ac) return; const t=ac.currentTime; osc('sine',125,t,0.1,0.18,80,500); noiseHit(t,0.02,0.06,'lowpass',800); },
    jump(){ if(!settings.sound||!ac) return; const t=ac.currentTime; osc('sine',150,t,0.13,0.12,95,500); },
    post(){ if(!settings.sound||!ac) return; const t=ac.currentTime; osc('triangle',196,t,0.24,0.26,150,1400); osc('sine',300,t,0.12,0.12,180,1400); noiseHit(t,0.03,0.12,'highpass',1400); },
    whistle(){ if(!settings.sound||!ac) return; const t=ac.currentTime;     // scheidsrechtersfluit-triller
      for(let k=0;k<4;k++){ const tk=t+k*0.045; osc('triangle', k%2?2050:2250, tk, 0.04, 0.10, null, 3200); }
      noiseHit(t,0.18,0.04,'highpass',2600); },
    count(){ if(!settings.sound||!ac) return; const t=ac.currentTime; osc('sine',740,t,0.09,0.16,640,900); },
    goal(){
      if(!settings.sound||!ac) return; const t=ac.currentTime;
      hornNote(t,180,0.8,0.13); hornNote(t,226,0.8,0.11); hornNote(t+0.05,270,0.72,0.10);   // stadionhoorn
      noiseHit(t,0.55,0.10,'bandpass',850);                                                  // gejuich
      crowdSwell(t,0.4);
    },
    win(){ if(!settings.sound||!ac) return; const t=ac.currentTime;
      [[262,0],[330,0.2],[392,0.4],[523,0.6],[523,0.95]].forEach(([f,dt])=>hornNote(t+dt,f,0.55,0.12));
      noiseHit(t,1.0,0.11,'bandpass',850); crowdSwell(t,0.46); },
    click(){ if(!ac) return; const t=ac.currentTime; osc('sine',520,t,0.03,0.07,null,1400); },
    setCrowd(on){ if (crowdGain) crowdGain.gain.value = on ? 0.04 : 0; },
  };
  return api;
})();

/* ----------------------------------------------------------------------------
   4. Input  (toetsenbord + touch)
   ---------------------------------------------------------------------------- */
const keys = {};
const blockKeys = new Set([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (blockKeys.has(e.key)) e.preventDefault();
  if (e.key === 'Escape') onEscape();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

// touch-input vlaggen (voor de menselijke speler)
const touch = { L:false, R:false, J:false, L2:false, R2:false, J2:false };
const BTN_PROP = { btnL:'L', btnR:'R', btnJ:'J', btn2L:'L2', btn2R:'R2', btn2J:'J2' };
const activePointers = new Map();   // pointerId -> button-id
function btnIdAt(x,y){
  const el = document.elementFromPoint(x,y);
  const b = el && el.closest ? el.closest('.tbtn') : null;
  return b && BTN_PROP[b.id] ? b.id : null;
}
function setBtn(id, on){ const p = BTN_PROP[id]; if (p) touch[p] = on; }
function routePointer(pid, id){
  const prev = activePointers.get(pid);
  if (prev === id) return;
  if (prev) setBtn(prev, false);
  if (id){ setBtn(id, true); activePointers.set(pid, id); }
  else activePointers.delete(pid);
}
function clearPointer(pid){ const prev = activePointers.get(pid); if (prev) setBtn(prev, false); activePointers.delete(pid); }
(function bindTouchRouter(){
  const pad = document.getElementById('touch');
  if (!pad) return;
  pad.addEventListener('pointerdown', e=>{
    if (!e.target.closest || !e.target.closest('.tbtn')) return;
    e.preventDefault();
    try { e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId); } catch(_){}
    routePointer(e.pointerId, btnIdAt(e.clientX, e.clientY));
  });
  // glijden tussen knoppen: hertarget op basis van vingerpositie
  window.addEventListener('pointermove', e=>{
    if (!activePointers.has(e.pointerId)) return;
    routePointer(e.pointerId, btnIdAt(e.clientX, e.clientY));
  });
  const end = e=>{ if (activePointers.has(e.pointerId)) clearPointer(e.pointerId); };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
})();

const IS_TOUCH = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;

// lees keyset -> {left,right,jump}
function wasdInput(){ return { left: !!keys['a'], right: !!keys['d'], jump: !!keys['w'] }; }
function arrowsInput(){ return { left: !!keys['arrowleft'], right: !!keys['arrowright'], jump: !!keys['arrowup'] || !!keys[' '] }; }
// primaire mens (1P / online): alles samen + touchpad 1
function humanInput(){
  return {
    left:  !!keys['a'] || !!keys['arrowleft']  || touch.L,
    right: !!keys['d'] || !!keys['arrowright'] || touch.R,
    jump:  !!keys['w'] || !!keys['arrowup'] || !!keys[' '] || touch.J,
  };
}
function p2KeyInput(){ return { left: !!keys['arrowleft']||touch.L2, right: !!keys['arrowright']||touch.R2, jump: !!keys['arrowup']||touch.J2 }; }
function p1KeyInput(){ return { left: !!keys['a']||touch.L, right: !!keys['d']||touch.R, jump: !!keys['w']||touch.J }; }

/* ----------------------------------------------------------------------------
   5. Entities
   ---------------------------------------------------------------------------- */
function makeSlime(side, team){
  return {
    side, team,
    x: side==='left' ? W*0.25 : W*0.75,
    y: GROUND, vx:0, vy:0,
    onGround:true,
    eyeX:0, eyeY:0,        // pupil-offset (kijkt naar bal)
    squash:0,              // animatie bij landen/springen
    hang:0, penalty:0,     // anti-goal-hangen timer + straf-flash
    input:{left:false,right:false,jump:false},
  };
}
function makeBall(){ return { x:CENTER, y:GROUND-260, vx:0, vy:0, spin:0 }; }

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
  attract: false,                  // menu "attract mode": two slimes idling on the pitch
  countdown: 0,            // frames
  goalTimer: 0,            // frames in GOAL-state
  lastScorer: 0,
  winner: 0,
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

function updateSlime(s){
  const i = s.input;
  s.vx = (i.right?SLIME_SPEED:0) - (i.left?SLIME_SPEED:0);
  s.x += s.vx;
  // half-veld begrenzing (klein gaatje bij de middenlijn)
  if (s.side==='left')  s.x = clamp(s.x, SLIME_R*0.5, CENTER - 6);
  else                  s.x = clamp(s.x, CENTER + 6, W - SLIME_R*0.5);
  // springen
  if (i.jump && s.onGround){ s.vy = -SLIME_JUMP; s.onGround=false; s.squash=-0.18; Audio.jump(); }
  s.vy += SLIME_GRAV; s.y += s.vy;
  if (s.y >= GROUND){
    if (!s.onGround) s.squash = 0.22;
    s.y = GROUND; s.vy = 0; s.onGround = true;
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
  const minD = SLIME_R + BALL_R;
  if (dist < minD && b.y <= s.y + 2 && dist > 0){
    const nx = dx/dist, ny = dy/dist;
    // bal op het oppervlak plaatsen
    b.x = s.x + nx*minD; b.y = s.y + ny*minD;
    // klassieke slime-bounce: bal vliegt langs de normaal, snelheid ~ inkomende snelheid
    const speed = Math.hypot(b.vx, b.vy);
    const out = Math.max(speed*0.92, 8.5);
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

function updateBall(){
  const b = G.ball;
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
function effDiff(){ return (G.wkMode && G.wk) ? G.wk.diffs[G.wk.round] : settings.diff; }
function computeAI(s){
  const p = AI_LEVELS[effDiff()] || AI_LEVELS.normal;
  const b = G.ball;
  const onMySide = b.x > CENTER - 30;
  aiState.reactT--;
  if (aiState.reactT <= 0){
    aiState.reactT = (Math.random()*p.react)|0;
    const pred = predictBallX(p.predict);
    let tx = onMySide ? pred : (W*0.72);
    tx += (Math.random()-0.5) * (p.mistake*260);
    aiState.targetX = clamp(tx, CENTER+10, W-SLIME_R*0.5);
  }
  const inp = { left:false, right:false, jump:false };
  const dead = 10;
  if (s.x < aiState.targetX - dead) inp.right = true;
  else if (s.x > aiState.targetX + dead) inp.left = true;

  // springen: bal boven en binnen bereik
  const horiz = Math.abs(b.x - s.x);
  const ballAbove = b.y < s.y - 70;
  const wantClear = onMySide && b.x > s.x - 30 && b.y < GROUND-40;
  if (s.onGround && ballAbove && horiz < SLIME_R+46 && b.vy > -3 && Math.random() < (p.jump+0.04)) inp.jump = true;
  if (s.onGround && wantClear && horiz < SLIME_R+10 && Math.random() < p.jump) inp.jump = true;
  s.input = inp;
}

/* ----------------------------------------------------------------------------
   10. Match-flow
   ---------------------------------------------------------------------------- */
function resetPositions(){
  G.p1.x = W*0.25; G.p1.y=GROUND; G.p1.vx=G.p1.vy=0; G.p1.onGround=true;
  G.p2.x = W*0.75; G.p2.y=GROUND; G.p2.vx=G.p2.vy=0; G.p2.onGround=true;
  G.ball = makeBall();
  // bal richting de speler die net tegen kreeg
  G.ball.x = G.lastScorer===0 ? W*0.32 : W*0.68;
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
  if (G.wkMode){ G.matchMode='time'; G.matchMin=2; }     // World Cup = always 2 min
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
  if (G.golden){ endMatch(); }                                          // golden goal: eerste doelpunt beslist
  else if (G.matchMode==='goals' && (G.score[0]>=G.toWin || G.score[1]>=G.toWin)){ endMatch(); }
  else { G.screen = SCREEN.GOAL; G.goalTimer = 130; }
  // kritieke transitie meteen sturen (niet afhankelijk van de 30Hz-throttle):
  // anders mist de guest ~50% van de tijd het GOAL/OVER-signaal.
  if (G.mode==='host' && G.net) G.net.sendState();
}
function endMatch(){
  G.winner = G.score[0]===G.score[1] ? 1 : (G.score[0]>G.score[1] ? 1 : 2);  // gelijk komt hier niet voor (golden goal)
  G.screen = SCREEN.OVER;
  Audio.win();
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
    updateSlime(G.p1); updateSlime(G.p2);
    updateBall();
    if (G.screen===SCREEN.PLAY){ updateMatchTimer(); updateAntiCamp(); }   // updateBall kan al scoren
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
      s.x = s.side==='left' ? W*0.30 : W*0.70;     // weggestuurd naar eigen helft-midden
      s.vy = -SLIME_JUMP*0.5; s.onGround = false;   // klein sprongetje
      Audio.whistle();
    }
    if (s.penalty > 0) s.penalty--;
  });
}

function assignInputs(frozen){
  if (G.mode==='1p'){
    G.p1.input = humanInput();
    if (frozen){ G.p2.input={left:false,right:false,jump:false}; } else computeAI(G.p2);
    if (frozen) G.p1.input={left:false,right:false,jump:false};
  } else if (G.mode==='2p'){
    G.p1.input = frozen?{left:false,right:false,jump:false}:p1KeyInput();
    G.p2.input = frozen?{left:false,right:false,jump:false}:p2KeyInput();
  } else if (G.mode==='host'){
    G.p1.input = frozen?{left:false,right:false,jump:false}:humanInput();
    G.p2.input = frozen?{left:false,right:false,jump:false}:(G.net?G.net.guestInput:{left:false,right:false,jump:false});
  }
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
function makeNet(){
  return {
    peer:null, conn:null, isHost:false, code:'',
    guestInput:{left:false,right:false,jump:false},
    connected:false, lostConnection:false,
    _closed:false, _retryT:null, _sendT:0, _lastRecvT:0,
    host(onCode, onStatus, onStart){
      this.isHost=true;
      const code = randomCode();
      this.code = code;
      try { this.peer = new Peer('SLWK'+code, { debug:1 }); }
      catch(e){ onStatus('PeerJS not loaded — check your internet', true); return; }
      this.peer.on('open', ()=> onCode(code));
      this.peer.on('error', err=>{
        if (String(err).includes('unavailable')) { onStatus('Code taken, getting a new one...', true); this.code=randomCode(); this.peer.destroy(); this._retryT=setTimeout(()=>{ if(this._closed) return; this.host(onCode,onStatus,onStart); },300); }
        else onStatus('Error: '+err, true);
      });
      this.peer.on('connection', c=>{
        if (this.conn){ try{ c.close(); }catch(_){} return; }   // max. 1 tegenstander
        this.conn=c;
        c.on('open', ()=>{ this.connected=true; this._lastRecvT=performance.now(); onStatus('Opponent connected!', false); });
        c.on('data', d=>this._recv(d));
        c.on('close', ()=>{ this.connected=false; this.lostConnection=true; onStatus('Connection lost', true); });
      });
      this._onStart = onStart;
    },
    join(code, onStatus, onStart){
      this.isHost=false;
      try { this.peer = new Peer({ debug:1 }); }
      catch(e){ onStatus('PeerJS not loaded — check your internet', true); return; }
      this.peer.on('open', ()=>{
        onStatus('Connecting...', false);
        this.conn = this.peer.connect('SLWK'+code, { reliable:true });
        this.conn.on('open', ()=>{ this.connected=true; this._lastRecvT=performance.now(); onStatus('Connected! Waiting for host...', false); });
        this.conn.on('data', d=>this._recv(d));
        this.conn.on('close', ()=>{ this.connected=false; this.lostConnection=true; onStatus('Connection lost', true); });
      });
      this.peer.on('error', err=> onStatus('Cannot connect: '+err, true));
      this._onStart = onStart;
    },
    _recv(d){
      this._lastRecvT = performance.now();   // watchdog-hartslag
      if (d.t==='start'){ if(this._onStart) this._onStart(d); }
      else if (d.t==='state'){ applyNetState(d); }
      else if (d.t==='input'){ this.guestInput = d.i; }
    },
    startGame(payload){ if (this.conn && this.connected) this.conn.send(Object.assign({t:'start'},payload)); },
    sendInput(i){ if (this.conn && this.connected) this.conn.send({t:'input', i:{left:i.left,right:i.right,jump:i.jump}}); },
    sendState(){
      if (!this.conn || !this.connected) return;
      this.conn.send({ t:'state',
        p1:packEnt(G.p1), p2:packEnt(G.p2), ball:packBall(G.ball),
        score:G.score, screen:G.screen, winner:G.winner, cd:G.countdown, lastScorer:G.lastScorer, mt:G.matchTime, golden:G.golden });
    },
    close(){ this._closed=true; clearTimeout(this._retryT); try{ this.conn&&this.conn.close(); this.peer&&this.peer.destroy(); }catch(e){} }
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
for (let i=0;i<160;i++) crowdSeed.push({ x:Math.random(), y:Math.random(), c:(Math.random()*6)|0, f:Math.random()*6.28 });

// modern in-canvas type (sporty broadcast look) — replaces the old pixel font
function FONT(px, w){ return (w||800)+' '+px+"px Rubik, system-ui, -apple-system, sans-serif"; }

function render(){
  ctx.save();
  // screen shake
  if (G.shake>0.5){ ctx.translate((Math.random()-0.5)*G.shake, (Math.random()-0.5)*G.shake); }

  drawStadium();
  drawPitch();
  drawGoal(true);
  drawGoal(false);
  if (G.ball) drawBall(G.ball);
  if (G.p1) drawSlime(G.p1);
  if (G.p2) drawSlime(G.p2);
  drawParticles();
  if (G.p1 && G.p2 && G.screen!==SCREEN.MENU) drawScoreboard();

  if (G.screen===SCREEN.COUNT) drawCountdown();
  if (G.screen===SCREEN.GOAL)  drawGoalText();
  if (G.paused) drawPaused();

  ctx.restore();

  // goal-flash
  if (G.flash>0){ ctx.fillStyle=`rgba(255,255,255,${G.flash/16*0.5})`; ctx.fillRect(0,0,W,H); }
  if (settings.crt) drawCRT();
}

function drawStadium(){
  // avondlucht
  const sky = ctx.createLinearGradient(0,0,0,GROUND);
  sky.addColorStop(0,'#0d1b3a'); sky.addColorStop(0.6,'#1d2e5e'); sky.addColorStop(1,'#34406e');
  ctx.fillStyle=sky; ctx.fillRect(0,0,W,GROUND+6);

  // tribunes
  ctx.fillStyle='#11162e'; ctx.fillRect(0,60,W,GROUND-60);
  // crowd dots
  const t=G.frame*0.05;
  const cols=['#ff7a18','#ffae3b','#ffffff','#34d17a','#7cc0ee','#ff5470'];
  for (const s of crowdSeed){
    const cx=s.x*W, cy=70 + s.y*(GROUND-150);
    const tw=0.7+0.3*Math.sin(t+s.f);
    ctx.globalAlpha=tw; ctx.fillStyle=cols[s.c]; ctx.fillRect(cx,cy,4,4);
  }
  ctx.globalAlpha=1;

  // floodlights
  for (const fx of [W*0.12, W*0.88]){
    const g=ctx.createRadialGradient(fx,30,4,fx,30,160);
    g.addColorStop(0,'rgba(255,255,220,0.5)'); g.addColorStop(1,'rgba(255,255,220,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(fx,30,160,0,7); ctx.fill();
    ctx.fillStyle='#cfcfe0'; ctx.fillRect(fx-22,8,44,10);
    ctx.fillStyle='#2a2a44'; ctx.fillRect(fx-3,18,6,46);
  }

  // scrolling banner (tiled by measured width so the loop is seamless in any font)
  ctx.fillStyle='#06060f'; ctx.fillRect(0,GROUND-22,W,22);
  ctx.fillStyle='#ff7a18'; ctx.font=FONT(13,800); ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  const msg='WORLD CUP SLIME   •   KNOCKOUT 2026   •   USA · MEXICO · CANADA   •   ';
  const mw=ctx.measureText(msg).width || 1;
  const scroll=(G.frame*1.1)%mw;
  for (let x=-scroll; x<W; x+=mw) ctx.fillText(msg, x, GROUND-7);
}

function drawPitch(){
  // gras met maaibanen
  for (let i=0;i<14;i++){
    ctx.fillStyle = i%2? '#1f8f3a' : '#1b8235';
    ctx.fillRect(i*(W/14), GROUND, W/14+1, H-GROUND);
  }
  ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(0,GROUND,W,4);
  // lijnen
  ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(CENTER,GROUND); ctx.lineTo(CENTER,H); ctx.stroke();
  ctx.beginPath(); ctx.arc(CENTER,H+6,46,Math.PI,0,true); ctx.stroke();
}

function drawGoal(left){
  const x = left ? 0 : W-GOAL_D;
  ctx.save();
  // net
  ctx.strokeStyle='rgba(255,255,255,0.28)'; ctx.lineWidth=1;
  for (let i=0;i<=GOAL_D;i+=8){ ctx.beginPath(); ctx.moveTo(x+i,BAR_Y); ctx.lineTo(x+i,GROUND); ctx.stroke(); }
  for (let j=BAR_Y;j<=GROUND;j+=8){ ctx.beginPath(); ctx.moveTo(x,j); ctx.lineTo(x+GOAL_D,j); ctx.stroke(); }
  // palen
  const postX = left ? GOAL_D : W-GOAL_D;
  ctx.fillStyle='#ffffff';
  ctx.fillRect(postX-3, BAR_Y, 6, GOAL_H);              // staander
  ctx.fillRect(left?0:postX-3, BAR_Y-BAR_TH, left?GOAL_D+3:GOAL_D+3, BAR_TH); // lat
  ctx.restore();
}

function drawSlime(s){
  const r = SLIME_R;
  const sx = 1 + s.squash*0.6, sy = 1 - s.squash*0.6;
  // schaduw
  ctx.fillStyle='rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(s.x, GROUND+5, r*0.85, 9, 0, 0, 7); ctx.fill();

  ctx.save();
  ctx.translate(s.x, s.y); ctx.scale(sx,sy);
  // body (halve cirkel) met gradient
  const g=ctx.createLinearGradient(0,-r,0,0);
  g.addColorStop(0, lighten(s.team.color,40));
  g.addColorStop(0.5, s.team.color);
  g.addColorStop(1, darken(s.team.color,30));
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.arc(0,0,r,Math.PI,0); ctx.closePath(); ctx.fill();
  // trim-streep
  ctx.fillStyle=s.team.trim; ctx.globalAlpha=0.9;
  ctx.beginPath(); ctx.arc(0,0,r,Math.PI,0); ctx.arc(0,0,r-7,0,Math.PI,true); ctx.closePath(); ctx.fill();
  ctx.globalAlpha=1;
  // highlight
  ctx.fillStyle='rgba(255,255,255,0.22)';
  ctx.beginPath(); ctx.ellipse(-r*0.35,-r*0.5,r*0.22,r*0.12,-0.5,0,7); ctx.fill();
  ctx.restore();

  // oog (op vaste schermpositie, niet meegeschaald)
  const eyeYBase = s.y - r*0.55;
  const eyeX = s.x + (s.side==='left'?14:-14);
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(eyeX, eyeYBase, 13, 0, 7); ctx.fill();
  ctx.fillStyle='#0a0a16';
  ctx.beginPath(); ctx.arc(eyeX + s.eyeX*5, eyeYBase + s.eyeY*5, 6, 0, 7); ctx.fill();

  // anti-goal-camping: warning bar + penalty message
  if (s.penalty > 0){
    ctx.fillStyle = (G.frame>>2&1)?'#ff5470':'#ffae3b';
    ctx.font=FONT(12,800); ctx.textAlign='center';
    ctx.fillText('NO CAMPING!', s.x, s.y - r - 14);
  } else if (s.hang > CAMP_WARN){
    const frac = (s.hang - CAMP_WARN) / (CAMP_MAX - CAMP_WARN);
    const bw = 54, by = s.y - r - 16;
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(s.x-bw/2, by, bw, 6);
    ctx.fillStyle = frac>0.6 ? '#ff5470' : '#ffae3b';
    ctx.fillRect(s.x-bw/2, by, bw*Math.min(1,frac), 6);
  }
}

function drawBall(b){
  // schaduw
  const sh = clamp(1-(GROUND-b.y)/300,0.15,1);
  ctx.fillStyle=`rgba(0,0,0,${0.28*sh})`;
  ctx.beginPath(); ctx.ellipse(b.x, GROUND+5, BALL_R*sh, 5*sh, 0,0,7); ctx.fill();

  ctx.save();
  ctx.translate(b.x,b.y); ctx.rotate(b.spin);
  ctx.fillStyle='#f7f7f7'; ctx.beginPath(); ctx.arc(0,0,BALL_R,0,7); ctx.fill();
  ctx.strokeStyle='#cfcfcf'; ctx.lineWidth=1; ctx.stroke();
  // pentagons
  ctx.fillStyle='#16161e';
  ctx.beginPath(); ctx.arc(0,0,BALL_R*0.34,0,7); ctx.fill();
  for (let i=0;i<5;i++){
    const a=i/5*Math.PI*2;
    ctx.beginPath(); ctx.arc(Math.cos(a)*BALL_R*0.62, Math.sin(a)*BALL_R*0.62, BALL_R*0.14, 0,7); ctx.fill();
  }
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
  const w=244, h=54, x=CENTER-w/2, y=14;
  ctx.fillStyle='rgba(6,6,16,0.85)'; roundRect(x,y,w,h,10); ctx.fill();
  ctx.strokeStyle='#2c2c55'; ctx.lineWidth=2; roundRect(x,y,w,h,10); ctx.stroke();
  // flags
  drawMiniFlag(G.p1.team, x+10, y+11, 40, 27);
  drawMiniFlag(G.p2.team, x+w-50, y+11, 40, 27);
  // codes
  ctx.textBaseline='alphabetic';
  ctx.font=FONT(12,800); ctx.textAlign='center';
  ctx.fillStyle=G.p1.team.color; ctx.fillText(G.p1.team.code, x+30, y+50);
  ctx.fillStyle=G.p2.team.color; ctx.fillText(G.p2.team.code, x+w-30, y+50);
  // score
  ctx.fillStyle='#fff'; ctx.font=FONT(28,900);
  ctx.fillText(G.score[0]+' - '+G.score[1], CENTER, y+38);
  // sub-line: match clock (time mode) or goal target
  ctx.textAlign='center';
  if (G.matchMode==='time'){
    if (G.golden){
      ctx.font=FONT(12,800); ctx.fillStyle = (G.frame>>4&1)?'#ffae3b':'#ff5470';
      ctx.fillText('GOLDEN GOAL', CENTER, y+h+14);
    } else {
      const sec=Math.max(0,Math.ceil(G.matchTime/60));
      const txt=(sec/60|0)+':'+String(sec%60).padStart(2,'0');
      ctx.font=FONT(16,800); ctx.fillStyle = sec<=10 ? '#ff5470' : '#ffae3b';
      ctx.fillText(txt, CENTER, y+h+15);
    }
  } else {
    ctx.font=FONT(11,700); ctx.fillStyle='#9a9ad0';
    ctx.fillText('FIRST TO '+G.toWin, CENTER, y+h+13);
  }
}

function drawMiniFlag(team, x,y,w,h){
  const st=team.stripes;
  for (let i=0;i<st.length;i++){ ctx.fillStyle=st[i]; ctx.fillRect(x, y+i*(h/st.length), w, h/st.length+0.5); }
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
  ctx.fillStyle=scorerTeam.color; ctx.font=FONT(18,800);
  ctx.fillText(scorerTeam.name.toUpperCase()+' SCORES', 0, 42);
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
  ctx.globalAlpha=0.10; ctx.fillStyle='#000';
  for (let y=0;y<H;y+=3) ctx.fillRect(0,y,W,1);
  ctx.globalAlpha=1;
  const v=ctx.createRadialGradient(CENTER,H/2,H*0.3,CENTER,H/2,H*0.8);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,0.45)');
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

/* ----------------------------------------------------------------------------
   15. UI / schermbeheer  (DOM overlays)
   ---------------------------------------------------------------------------- */
const $ = id => document.getElementById(id);
function hideAllOverlays(){ document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show')); }
function showOverlay(id){ hideAllOverlays(); $(id).classList.add('show'); }
function updateTouchVisibility(){
  const inGame = (G.screen===SCREEN.PLAY||G.screen===SCREEN.COUNT||G.screen===SCREEN.GOAL) && !G.paused;
  $('touch').classList.toggle('show', IS_TOUCH && inGame);
  $('pad2').style.display = (G.mode==='2p') ? 'flex' : 'none';
  $('playHint').style.display = (G.screen===SCREEN.PLAY && !IS_TOUCH && !G.paused) ? 'block' : 'none';
  $('quitBtn').classList.toggle('show', inGame);
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
  TEAMS.forEach(t=>{
    const el=document.createElement('div');
    el.className='team'+(t.featured?' featured':'');
    el.innerHTML=`<div class="flag" style="background:${t.flag}"></div>
                  <div class="code">${t.code}</div><div class="name">${t.name}</div>`;
    el.onclick=()=>pickTeam(t,el);
    grid.appendChild(el);
  });
}
function pickTeam(t,el){
  Audio.click();
  if (wkPending){ wkPending=false; setupWK(t); return; }   // WK-toernooi: jouw land gekozen
  if (G.mode==='guest' && guestPickSent) return;     // niet 2x sturen (touch double-tap)
  document.querySelectorAll('.team').forEach(e=>e.classList.remove('sel'));
  el.classList.add('sel');
  if (G.mode==='guest'){ pickP2=t; guestPickSent=true; sendGuestTeamAndWait(); return; }
  if (pickStage===0){
    pickP1=t;
    if (G.mode==='1p'){
      // AI kiest willekeurig ander team
      const others=TEAMS.filter(x=>x!==t); pickP2=others[(Math.random()*others.length)|0];
      launchLocal();
    } else if (G.mode==='host'){
      // host kiest eigen team, gast kiest later
      pickP2=null; waitForGuestTeam();
    } else { // 2p
      pickStage=1; $('pickLabel').innerHTML='Player <b>2</b> (right): pick your country';
      setTimeout(()=>document.querySelectorAll('.team').forEach(e=>e.classList.remove('sel')),120);
    }
  } else { // 2p tweede keuze
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
const WK_ROUNDS = ['Round of 16','Quarter-final','Semi-final','Final'];
const WK_HEAD   = ['R16','QF','SF','FINAL'];          // compact bracket column heads
const WK_DIFFS  = ['normal','hard','hard','worldcup'];// AI level per round
const WK_COUNTS = [8,4,2,1];                          // matches per round

function shuffleArr(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function goWK(){ Audio.unlock(); wkPending=true; openTeamSelect('Pick <b>your</b> country for the World Cup ⚽'); }

// a match = { a, b, sa, sb, winner:0|1|null, played, user }
function newMatch(a,b){ return { a, b, sa:0, sb:0, winner:null, played:false, user:(a===G.wk.team||b===G.wk.team) }; }
function setupWK(team){
  G.wkMode = true;
  G.wk = { team, round:0, diffs: WK_DIFFS.slice(), rounds:[], champion:null };
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
    let matches='';
    for (let i=0;i<n;i++){
      const m=round?round[i]:null;
      matches+=wkMatchHTML(m, nowCol && m && m.user && !m.played);
    }
    cols+=`<div class="bk-col"><div class="bk-head">${WK_HEAD[r]}</div>${matches}</div>`;
  }
  if (wk.champion){
    const c=wk.champion;
    cols+=`<div class="bk-col"><div class="bk-head">🏆</div>`+
      `<div class="bk-match user"><div class="bk-team win${c===wk.team?' you':''}">`+
      `<span class="flag" style="background:${c.flag}"></span><span class="nm">${escapeHtml(c.name)}</span></div></div></div>`;
  }
  return `<div class="bracket">${cols}</div>`;
}

function showWKStage(){
  const wk=G.wk; const m=wkUserMatch(); const opp=m?wkOppOf(m):null;
  $('wkTitle').textContent = WK_ROUNDS[wk.round];
  $('wkSub').innerHTML = `You: <b>${escapeHtml(wk.team.name)}</b> ⚽ · 2-min matches · win 4 rounds to lift the cup`;
  $('wkBracket').innerHTML = wkBracketHTML();
  $('wkBtns').innerHTML = `<button id="wkPlay" class="btn">▶ Play vs ${opp?escapeHtml(opp.name):'?'}</button>`+
                          `<button id="wkQuit" class="btn secondary">Main menu</button>`;
  $('wkPlay').onclick = ()=>{ Audio.click(); wkStartMatch(); };
  $('wkQuit').onclick = ()=>{ Audio.click(); backToMenu(); };
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
function wkShowResult(champion){
  const wk=G.wk; let extra='';
  if (champion){
    spawnConfetti(); Audio.win();
    $('wkTitle').textContent='🏆 CHAMPIONS!';
    $('wkSub').innerHTML=`<b>${escapeHtml(wk.team.name)}</b> win the World Cup! ⚽🎉`;
    if (window.Leaderboard && window.Leaderboard.enabled){
      extra = `<div style="margin:12px auto 0; display:flex; flex-direction:column; gap:8px; max-width:320px;">
        <input id="wkName" class="code-input" maxlength="20" placeholder="YOUR NAME" value="${escapeHtml(store.load('lbname',''))}">
        <button id="wkSubmit" class="btn small">🏆 Submit to leaderboard</button>
        <div class="status" id="wkStatus"></div></div>`;
    }
  } else {
    $('wkTitle').textContent='Knocked out';
    const champTxt = wk.champion ? ` Champions: <b>${escapeHtml(wk.champion.name)}</b>.` : '';
    $('wkSub').innerHTML=`You went out in the <b>${WK_ROUNDS[wk.round]}</b>.${champTxt} Try again!`;
  }
  $('wkBracket').innerHTML = wkBracketHTML() + extra;
  $('wkBtns').innerHTML = `<button id="wkAgain" class="btn">New tournament</button>`+
                          `<button id="wkHome" class="btn secondary">Main menu</button>`;
  $('wkAgain').onclick=()=>{ Audio.click(); setupWK(wk.team); };
  $('wkHome').onclick=()=>{ Audio.click(); backToMenu(); };
  const sb=$('wkSubmit'); if (sb) sb.onclick=submitWKChampion;
  showOverlay('wkScreen');
}
async function submitWKChampion(){
  if (!window.Leaderboard) return;
  const wk=G.wk;
  const name=($('wkName').value||'').trim()||'Anonymous';
  store.save('lbname', name);
  $('wkSubmit').disabled=true; $('wkStatus').textContent='Submitting...'; $('wkStatus').className='status';
  const fm=(wk.rounds[WK_ROUNDS.length-1]||[]).find(x=>x.user) || {a:wk.team, sa:0, sb:0};
  const uf=(fm.a===wk.team)?fm.sa:fm.sb, ua=(fm.a===wk.team)?fm.sb:fm.sa;
  const ok=await window.Leaderboard.submit({ name, team:wk.team.code, score_for:uf, score_against:ua, mode:'1p', difficulty:'World Cup' });
  $('wkStatus').textContent = ok?'Submitted! ⚽':'Failed (offline?)'; $('wkStatus').className='status '+(ok?'ok':'err');
  $('wkSubmit').textContent = ok?'✓ Submitted':'🏆 Submit to leaderboard'; if(!ok) $('wkSubmit').disabled=false;
}

// ---- menu knoppen ----
function go1p(){ Audio.unlock(); G.mode='1p'; openTeamSelect('Pick <b>your</b> country'); }
function go2p(){ Audio.unlock(); G.mode='2p'; pickStage=0; openTeamSelect('Player <b>1</b> (left): pick your country'); }
function openTeamSelect(label){ pickStage=0; pickP1=pickP2=null; G.screen=SCREEN.TEAM; $('pickLabel').innerHTML=label; buildTeamGrid(); showOverlay('teamScreen'); }

function goOnline(){ Audio.unlock(); G.screen=SCREEN.ONLINE; showOverlay('onlineScreen'); $('onlineStatus').textContent=''; $('hostArea').style.display='none'; $('joinArea').style.display='none'; }

function showGameOver(){
  overShown=true;
  const winTeam = G.winner===1?G.p1.team:G.p2.team;
  let who;
  if (G.mode==='1p') who = G.winner===1?'YOU WIN!':'COMPUTER WINS';
  else if (G.mode==='2p') who = 'PLAYER '+G.winner+' WINS!';
  else { const meWon = (G.mode==='host' && G.winner===1)||(G.mode==='guest' && G.winner===2); who = meWon?'YOU WIN!':'OPPONENT WINS'; }
  $('overTitle').textContent=who;
  let sub=`<div class="flag" style="width:90px;height:60px;margin:10px auto;border-radius:6px;border:2px solid #000;background:${winTeam.flag}"></div>${escapeHtml(winTeam.name)} — ${G.score[0]} : ${G.score[1]}`;
  // online: only the host can start a rematch
  if (G.mode==='guest'){ $('overRematch').style.display='none'; sub+='<div class="status">Waiting for the host to restart…</div>'; }
  else { $('overRematch').style.display=''; }
  $('overSub').innerHTML=sub;
  setupLbSubmit();
  showOverlay('overScreen');
  updateTouchVisibility();
}

// ---- leaderboard: submit-blok op het game-over scherm ----
function setupLbSubmit(){
  const box=$('lbSubmit'); if(!box) return;
  const humanWon = (G.mode==='1p'&&G.winner===1) || (G.mode==='host'&&G.winner===1) || (G.mode==='guest'&&G.winner===2);
  const lbOk = window.Leaderboard && window.Leaderboard.enabled;
  if (!humanWon || !lbOk){ box.style.display='none'; G._lbEntry=null; return; }
  const meIdx = (G.mode==='guest') ? 1 : 0;
  const winTeam = G.winner===1?G.p1.team:G.p2.team;
  G._lbEntry = {
    team: winTeam.code,
    score_for: G.score[meIdx],
    score_against: G.score[1-meIdx],
    mode: (G.mode==='host'||G.mode==='guest') ? 'online' : G.mode,
    difficulty: G.mode==='1p' ? settings.diff : '',
  };
  $('lbName').value = store.load('lbname','');
  $('lbStatus').textContent=''; $('lbStatus').className='status';
  $('lbSend').disabled=false; $('lbSend').textContent='🏆 Submit';
  box.style.display='flex';
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
async function showLeaderboard(from){
  lbFrom = from || 'menu';
  showOverlay('lbScreen');
  const list=$('lbList'); list.innerHTML='loading…';
  if (!window.Leaderboard){ list.textContent='Leaderboard not available.'; return; }
  const rows = await window.Leaderboard.top(12);
  if (!rows){ list.innerHTML='<div class="status err">Could not load leaderboard (offline?).</div>'; return; }
  if (!rows.length){ list.innerHTML='<div class="status">No scores yet — be the first! ⚽</div>'; return; }
  list.innerHTML = rows.map((r,i)=>{
    const t=teamByCode(r.team);
    return `<div class="lb-row${i<3?' top':''}">
      <span class="rank">${i+1}</span>
      <span class="who">${escapeHtml(r.name)} <span class="tcode">${t.code}</span></span>
      <span class="sc">${r.score_for}-${r.score_against}</span>
      <span class="tcode">${r.difficulty||r.mode||''}</span>
    </div>`;
  }).join('');
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function lbBack(){ if (lbFrom==='over'){ showOverlay('overScreen'); } else { showOverlay('menuScreen'); } }

function backToMenu(){
  if (G.net){ G.net.close(); G.net=null; }
  G.mode='1p'; G.screen=SCREEN.MENU; G.paused=false; overShown=false;
  G.wkMode=false; G.wk=null; G.golden=false;
  guestMatchId=-1; guestPickSent=false;
  G.particles=[];
  startAttract();
  showOverlay('menuScreen'); updateTouchVisibility();
}
function onConnectionLost(){
  if (G.net){ try{ G.net.close(); }catch(e){} G.net=null; }
  G.mode='1p'; G.screen=SCREEN.ONLINE; G.paused=false; overShown=false;
  guestMatchId=-1; guestPickSent=false; G.particles=[];
  $('hostArea').style.display='none'; $('joinArea').style.display='none';
  const hs=$('hostStart'); if(hs) hs.style.display='none';
  showOverlay('onlineScreen');
  $('onlineStatus').textContent='Connection lost.'; $('onlineStatus').className='status err';
  updateTouchVisibility();
}
function rematch(){
  if (G.mode==='host' && G.net){
    if (!G.net.connected){ onConnectionLost(); return; }   // tegenstander weg
    hostMatchId++;
    startMatch();
    G.net.startGame(startPayload());
  } else if (G.mode==='guest'){ /* alleen de host herstart; knop is verborgen */ }
  else startMatch();
  updateTouchVisibility();
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
  $('pauseSub').textContent = G.wkMode ? 'Quitting leaves the tournament' : 'Press ESC to resume';
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
function startPayload(){ return { p1:pickP1.code, p2:pickP2.code, toWin:settings.toWin, matchMode:G.matchMode, matchMin:G.matchMin, mid:hostMatchId }; }

function hostGame(){
  Audio.unlock(); G.mode='host'; G.net=makeNet();
  $('hostArea').style.display='block'; $('joinArea').style.display='none';
  $('hostCode').textContent='...';
  $('onlineStatus').textContent='Connecting to server...'; $('onlineStatus').className='status';
  G.net.host(
    code=>{ $('hostCode').textContent=code; $('onlineStatus').textContent='Waiting for an opponent. Share the code or link.'; setupShare(code); },
    (msg,err)=>{ $('onlineStatus').textContent=msg; $('onlineStatus').className='status '+(err?'err':'ok'); if(!err) $('hostStart').style.display='inline-block'; },
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
  goOnline(); joinGame(); $('joinCode').value = code;
  setTimeout(()=>{ try{ joinConnect(); }catch(e){} }, 500);
}
function hostStartMatch(){
  if (!G.net || !G.net.connected){ $('onlineStatus').textContent='No opponent connected yet.'; $('onlineStatus').className='status err'; return; }
  // host picks their own country, then asks the guest to pick (waitForGuestTeam)
  openOnlineTeamPick();
}
function openOnlineTeamPick(){
  G.mode='host'; G.screen=SCREEN.TEAM;
  $('pickLabel').innerHTML='Host: pick <b>your</b> country (left)';
  buildTeamGrid(); showOverlay('teamScreen');
}
function waitForGuestTeam(){
  $('pickLabel').innerHTML='Waiting for opponent to pick a country...';
  // vraag gast om team; gast stuurt 'pick'
  // host: zodra gast team stuurt -> start
  G.net.conn.send({t:'needTeam'});
  G.net._onGuestTeam = (code)=>{ pickP2=teamByCode(code); beginOnlineMatch(); };
  // tijdelijke handler in _recv: breid uit
  patchNetForTeams();
}
function patchNetForTeams(){
  const net=G.net; const origRecv=net._recv.bind(net);
  net._recv=(d)=>{
    if (d.t==='pick'){ if (net._onGuestTeam) net._onGuestTeam(d.code); return; }
    if (d.t==='needTeam'){ showGuestTeamPick(); return; }
    if (d.t==='start'){ onGuestStart(d); return; }
    origRecv(d);
  };
}
function beginOnlineMatch(){
  if (G.net) G.net._onGuestTeam=null;        // voorkom dubbele start door 2e 'pick'
  G.mode='host';
  hostMatchId++;
  G.p1=makeSlime('left', pickP1); G.p2=makeSlime('right', pickP2); G.ball=makeBall();
  startMatch();
  G.net.startGame(startPayload());           // mid in payload dedupe't aan gastzijde
}
function joinGame(){
  Audio.unlock(); G.mode='guest'; G.net=makeNet();
  $('hostArea').style.display='none'; $('joinArea').style.display='block';
}
function joinConnect(){
  const code=$('joinCode').value.trim().toUpperCase();
  if (code.length<4){ $('onlineStatus').textContent='Enter the 4-letter code.'; $('onlineStatus').className='status err'; return; }
  $('onlineStatus').textContent='Connecting...'; $('onlineStatus').className='status';
  G.net.join(code, (msg,err)=>{ $('onlineStatus').textContent=msg; $('onlineStatus').className='status '+(err?'err':'ok'); }, null);
  patchNetForTeams();
}
function showGuestTeamPick(){
  G.mode='guest'; G.screen=SCREEN.TEAM; guestPickSent=false;
  $('pickLabel').innerHTML='Pick <b>your</b> country (right)';
  buildTeamGrid(); showOverlay('teamScreen');
}
function sendGuestTeamAndWait(){
  G.net.conn.send({t:'pick', code:pickP2.code});
  $('pickLabel').innerHTML='Sent! Waiting for host...';
}
function onGuestStart(d){
  if (typeof d.mid==='number'){ if (d.mid===guestMatchId) return; guestMatchId=d.mid; }  // negeer dubbele 'start'
  pickP1=teamByCode(d.p1); pickP2=teamByCode(d.p2);
  G.toWin=d.toWin||5;                         // niet de lokale settings muteren
  G.matchMode=d.matchMode||'goals'; G.matchMin=d.matchMin||2;
  G.matchTime=G.matchMin*3600; G.golden=false;
  G.p1=makeSlime('left', pickP1); G.p2=makeSlime('right', pickP2); G.ball=makeBall();
  G.score=[0,0]; G.winner=0; G.lastScorer=0; overShown=false;
  G.netTarget=null;                           // stale OVER-state weg (fix online revanche)
  G.countdown=180; G.screen=SCREEN.COUNT;     // aftelling tonen i.p.v. PLAY-flits
  hideAllOverlays(); updateTouchVisibility();
}

/* ---- Settings ---- */
function openSettings(){ refreshToggles(); showOverlay('setScreen'); }
function refreshToggles(){
  $('tSound').querySelector('.val').textContent = settings.sound?'ON':'OFF';
  $('tCrt').querySelector('.val').textContent   = settings.crt?'ON':'OFF';
  $('tMode').querySelector('.val').textContent  = settings.matchMode==='time'?'Match time':'Goals';
  $('tWin').querySelector('.lbl').textContent   = settings.matchMode==='time'?'Match length (min)':'First to';
  $('tWin').querySelector('.val').textContent   = settings.matchMode==='time'?settings.matchMin:settings.toWin;
  $('tDiff').querySelector('.val').textContent  = AI_LEVELS[settings.diff].label;
}
function toggleSound(){ settings.sound=!settings.sound; store.save('sound',settings.sound); if(settings.sound)Audio.unlock(); Audio.setCrowd(settings.sound); refreshToggles(); }
function toggleCrt(){ settings.crt=!settings.crt; store.save('crt',settings.crt); refreshToggles(); }
function toggleMode(){ settings.matchMode = settings.matchMode==='time'?'goals':'time'; store.save('matchMode',settings.matchMode); refreshToggles(); }
function cycleWin(){
  if (settings.matchMode==='time'){ const o=[1,2,5]; settings.matchMin=o[(o.indexOf(settings.matchMin)+1)%o.length]; store.save('matchMin',settings.matchMin); }
  else { const o=[3,5,7,10]; settings.toWin=o[(o.indexOf(settings.toWin)+1)%o.length]; store.save('toWin',settings.toWin); G.toWin=settings.toWin; }
  refreshToggles();
}
function cycleDiff(){ const opts=Object.keys(AI_LEVELS); settings.diff=opts[(opts.indexOf(settings.diff)+1)%opts.length]; store.save('diff',settings.diff); refreshToggles(); }

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
wire('pauseQuit', backToMenu);
wire('tMode', toggleMode);
{ const qb=$('quitBtn'); if (qb) qb.onclick = quitButton; }
wire('teamBack', backToMenu);
wire('onlineBack', backToMenu);
wire('setBack', ()=>showOverlay('menuScreen'));
wire('btnHost', hostGame);
wire('btnJoin', joinGame);
wire('hostStart', hostStartMatch);
wire('joinGo', joinConnect);
wire('overRematch', rematch);
wire('overMenu', backToMenu);
wire('btnLeaders', ()=>showLeaderboard('menu'));
wire('overLeaders', ()=>showLeaderboard('over'));
wire('lbBack', lbBack);
wire('lbSend', submitScore);
wire('tSound', toggleSound);
wire('tCrt', toggleCrt);
wire('tWin', cycleWin);
wire('tDiff', cycleDiff);

// PeerJS aanwezig?
function checkPeer(){
  if (typeof Peer==='undefined'){
    $('btnHost').disabled=true; $('btnJoin').disabled=true;
    $('onlinePeerWarn').style.display='block';
  }
}

// init
buildTeamGrid();
startAttract();
showOverlay('menuScreen');
updateTouchVisibility();
addEventListener('resize', updateRotateHint);
addEventListener('orientationchange', ()=>setTimeout(updateRotateHint, 200));
setTimeout(checkPeer, 1500);
initFromURL();   // invite link ?j=CODE

// expose for debugging / tests
window.__G = G;
