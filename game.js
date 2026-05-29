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

const GROUND   = H - 46;             // grondniveau (y van veld-oppervlak)
const CENTER   = W / 2;
const SLIME_R  = 74;                 // straal slime (halve cirkel)
const BALL_R   = 14;
const GOAL_H   = 186;                // hoogte doelmond
const GOAL_D   = 50;                 // diepte/breedte van het doel-net
const BAR_Y    = GROUND - GOAL_H;    // y van de lat
const BAR_TH   = 9;

// physics-afstemming (per 60fps tick)
const SLIME_SPEED = 6.4;
const SLIME_JUMP  = 15.2;
const SLIME_GRAV  = 0.74;
const BALL_GRAV   = 0.34;
const BALL_REST   = 0.86;            // demping bij muur/lat
const BALL_MAX    = 22;              // snelheidslimiet

/* ----------------------------------------------------------------------------
   1. Teams  (Nederland voorop). stripes = mini-vlag (horizontaal, boven->onder)
   ---------------------------------------------------------------------------- */
const TEAMS = [
  { code:'NED', name:'Nederland',  color:'#ff7a18', trim:'#ffffff', stripes:['#ae1c28','#ffffff','#21468b'], featured:true,
    flag:'linear-gradient(#ae1c28 33%,#fff 33% 66%,#21468b 66%)' },
  { code:'ARG', name:'Argentinië', color:'#7cc0ee', trim:'#ffffff', stripes:['#74acdf','#ffffff','#74acdf'],
    flag:'linear-gradient(#74acdf 33%,#fff 33% 66%,#74acdf 66%)' },
  { code:'BRA', name:'Brazilië',   color:'#ffd400', trim:'#1f8f3a', stripes:['#1f8f3a','#ffd400','#2a47a8'],
    flag:'linear-gradient(135deg,#1f8f3a 40%,#ffd400 40% 60%,#1f8f3a 60%)' },
  { code:'FRA', name:'Frankrijk',  color:'#3a6ec0', trim:'#ffffff', stripes:['#0055a4','#ffffff','#ef4135'],
    flag:'linear-gradient(90deg,#0055a4 33%,#fff 33% 66%,#ef4135 66%)' },
  { code:'ENG', name:'Engeland',   color:'#ededed', trim:'#d52b1e', stripes:['#ffffff','#d52b1e','#ffffff'],
    flag:'linear-gradient(#d52b1e,#d52b1e) center/100% 26% no-repeat, linear-gradient(#d52b1e,#d52b1e) center/26% 100% no-repeat, #fff' },
  { code:'ESP', name:'Spanje',     color:'#d52b1e', trim:'#ffd400', stripes:['#aa151b','#f1bf00','#aa151b'],
    flag:'linear-gradient(#aa151b 25%,#f1bf00 25% 75%,#aa151b 75%)' },
  { code:'GER', name:'Duitsland',  color:'#222222', trim:'#ffce00', stripes:['#000000','#dd0000','#ffce00'],
    flag:'linear-gradient(#000 33%,#dd0000 33% 66%,#ffce00 66%)' },
  { code:'POR', name:'Portugal',   color:'#1f8f3a', trim:'#d52b1e', stripes:['#006600','#006600','#ff0000'],
    flag:'linear-gradient(90deg,#006600 40%,#ff0000 40%)' },
  { code:'ITA', name:'Italië',     color:'#1f7ae0', trim:'#ffffff', stripes:['#009246','#ffffff','#ce2b37'],
    flag:'linear-gradient(90deg,#009246 33%,#fff 33% 66%,#ce2b37 66%)' },
  { code:'CRO', name:'Kroatië',    color:'#d52b1e', trim:'#ffffff', stripes:['#ff0000','#ffffff','#171796'],
    flag:'linear-gradient(#ff0000 50%,#171796 50%)' },
  { code:'MAR', name:'Marokko',    color:'#c1272d', trim:'#1f8f3a', stripes:['#c1272d','#c1272d','#006233'],
    flag:'linear-gradient(#c1272d,#c1272d)' },
  { code:'JPN', name:'Japan',      color:'#ffffff', trim:'#bc002d', stripes:['#ffffff','#bc002d','#ffffff'],
    flag:'radial-gradient(circle at 50% 50%, #bc002d 22%, #fff 23%)' },
  { code:'MEX', name:'Mexico',     color:'#1f8f3a', trim:'#ffffff', stripes:['#006847','#ffffff','#ce1126'],
    flag:'linear-gradient(90deg,#006847 33%,#fff 33% 66%,#ce1126 66%)' },
  { code:'USA', name:'V.S.',       color:'#3a4ea8', trim:'#ffffff', stripes:['#3c3b6e','#ffffff','#b22234'],
    flag:'linear-gradient(#b22234 50%,#3c3b6e 50%)' },
  { code:'CAN', name:'Canada',     color:'#d52b1e', trim:'#ffffff', stripes:['#d80621','#ffffff','#d80621'],
    flag:'linear-gradient(90deg,#d80621 28%,#fff 28% 72%,#d80621 72%)' },
  { code:'BEL', name:'België',     color:'#111111', trim:'#ffce00', stripes:['#000000','#fdda24','#ef3340'],
    flag:'linear-gradient(90deg,#000 33%,#fdda24 33% 66%,#ef3340 66%)' },
];
const teamByCode = c => TEAMS.find(t => t.code === c) || TEAMS[0];

const AI_LEVELS = {
  makkelijk: { label:'Makkelijk', speed:0.62, react:120, jump:0.018, predict:14, mistake:0.30 },
  normaal:   { label:'Normaal',   speed:0.82, react:60,  jump:0.05,  predict:24, mistake:0.14 },
  moeilijk:  { label:'Moeilijk',  speed:0.96, react:28,  jump:0.10,  predict:34, mistake:0.05 },
  wk:        { label:'WK-niveau', speed:1.06, react:10,  jump:0.16,  predict:46, mistake:0.0  },
};

/* ----------------------------------------------------------------------------
   2. Settings (localStorage)
   ---------------------------------------------------------------------------- */
const store = {
  load(k, d){ try { const v = localStorage.getItem('slimewk_'+k); return v===null?d:JSON.parse(v); } catch(e){ return d; } },
  save(k, v){ try { localStorage.setItem('slimewk_'+k, JSON.stringify(v)); } catch(e){} }
};
const settings = {
  sound:  store.load('sound', true),
  crt:    store.load('crt', true),
  toWin:  store.load('toWin', 5),
  diff:   store.load('diff', 'normaal'),
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
      master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
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
    crowdGain = ac.createGain(); crowdGain.gain.value = 0.04;
    crowd.connect(bp); bp.connect(crowdGain); crowdGain.connect(master);
    crowd.start();
  }
  function tone(freq, t0, dur, type='square', vol=0.3, slideTo=null){
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0+dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0+dur+0.02);
  }
  function noise(t0, dur, vol=0.3){
    if (!ac) return;
    const n = Math.floor(ac.sampleRate*dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const s = ac.createBufferSource(); s.buffer = buf;
    const g = ac.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(master); s.start(t0);
  }
  const api = {
    unlock(){ ensure(); if (ac && ac.state==='suspended') ac.resume(); },
    kick(power){ if(!settings.sound||!ac) return; const t=ac.currentTime; const f=180+Math.min(360,power*16); tone(f,t,0.08,'square',0.32,f*0.6); },
    wall(){ if(!settings.sound||!ac) return; const t=ac.currentTime; tone(150,t,0.06,'triangle',0.22,90); },
    jump(){ if(!settings.sound||!ac) return; const t=ac.currentTime; tone(300,t,0.12,'square',0.16,560); },
    post(){ if(!settings.sound||!ac) return; const t=ac.currentTime; tone(420,t,0.1,'square',0.28,200); noise(t,0.05,0.15); },
    whistle(){ if(!settings.sound||!ac) return; const t=ac.currentTime; tone(2100,t,0.12,'square',0.18); tone(2300,t+0.13,0.16,'square',0.18); },
    count(){ if(!settings.sound||!ac) return; const t=ac.currentTime; tone(660,t,0.1,'square',0.25); },
    goal(){
      if(!settings.sound||!ac) return; const t=ac.currentTime;
      const seq=[523,659,784,1047,1319]; seq.forEach((f,i)=>tone(f,t+i*0.09,0.16,'square',0.3));
      if (crowdGain){ crowdGain.gain.cancelScheduledValues(t);
        crowdGain.gain.setValueAtTime(0.04,t);
        crowdGain.gain.linearRampToValueAtTime(0.34,t+0.15);
        crowdGain.gain.exponentialRampToValueAtTime(0.04,t+2.4); }
    },
    win(){ if(!settings.sound||!ac) return; const t=ac.currentTime;
      const seq=[523,523,523,659,784,659,784,1047]; seq.forEach((f,i)=>tone(f,t+i*0.14,0.22,'square',0.28)); },
    click(){ if(!ac) return; const t=ac.currentTime; tone(880,t,0.04,'square',0.12); },
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
function bindTouch(id, prop){
  const el = document.getElementById(id);
  if (!el) return;
  const on  = e => { e.preventDefault(); touch[prop] = true;  };
  const off = e => { e.preventDefault(); touch[prop] = false; };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointerleave', off);
  el.addEventListener('pointercancel', off);
}
['btnL:L','btnR:R','btnJ:J','btn2L:L2','btn2R:R2','btn2J:J2'].forEach(s=>{ const [id,p]=s.split(':'); bindTouch(id,p); });

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
    if (b.vy > -2) b.vy = -2;            // altijd ietsje omhoog
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

  // lat + paal (beide doelen)
  collideBar(b, true);   // links
  collideBar(b, false);  // rechts

  // slimes
  reflectOffSlime(b, G.p1);
  reflectOffSlime(b, G.p2);
}

function collideBar(b, left){
  const postX = left ? GOAL_D : W - GOAL_D;     // voorkant van de lat (paal-tip)
  // bovenkant van de lat: horizontale balk van wand tot postX op hoogte BAR_Y
  const inX = left ? (b.x < postX) : (b.x > postX);
  if (inX && b.y - BALL_R < BAR_Y + BAR_TH && b.y + BALL_R > BAR_Y - 2){
    // botsing met onder/boven van de lat
    if (b.vy < 0 && b.y > BAR_Y){          // van onderaf tegen de lat
      b.y = BAR_Y + BAR_TH + BALL_R; b.vy = -b.vy*BALL_REST; Audio.post();
    } else if (b.vy > 0 && b.y < BAR_Y){   // bovenop de lat
      b.y = BAR_Y - BALL_R; b.vy = -b.vy*BALL_REST; Audio.post();
    }
  }
  // paal-tip als cirkel
  const dx = b.x - postX, dy = b.y - BAR_Y;
  const d = Math.hypot(dx,dy);
  if (d < BALL_R+5 && d>0){
    const nx=dx/d, ny=dy/d; b.x=postX+nx*(BALL_R+5); b.y=BAR_Y+ny*(BALL_R+5);
    const dot=b.vx*nx+b.vy*ny; b.vx=(b.vx-2*dot*nx)*BALL_REST; b.vy=(b.vy-2*dot*ny)*BALL_REST; Audio.post();
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
function computeAI(s){
  const p = AI_LEVELS[settings.diff] || AI_LEVELS.normaal;
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
function startMatch(){
  G.score=[0,0]; G.winner=0; G.particles=[]; G.lastScorer=0;
  G.toWin = settings.toWin;
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
  if (G.score[who] >= G.toWin){
    G.winner = who+1;
    G.screen = SCREEN.OVER;
    Audio.win();
    showGameOver();
  } else {
    G.screen = SCREEN.GOAL;
    G.goalTimer = 130;
  }
}

/* ----------------------------------------------------------------------------
   11. Per-tick update (60Hz vaste stap)
   ---------------------------------------------------------------------------- */
function tick(){
  G.frame++;
  if (G.shake>0) G.shake*=0.9;
  if (G.flash>0) G.flash--;
  updateParticles();

  // ---- ONLINE GUEST: alleen input sturen + interpoleren naar net-state ----
  if (G.mode==='guest'){
    if (G.net) G.net.sendInput(humanInput());
    if (G.netTarget){
      const t=G.netTarget;
      lerpEntity(G.p1, t.p1); lerpEntity(G.p2, t.p2); lerpBall(G.ball, t.ball);
      G.score = t.score.slice(); G.screen = t.screen; G.winner=t.winner||0;
      // ogen
      faceBall(G.p1); faceBall(G.p2);
    }
    if (G.screen===SCREEN.OVER && !overShown){ showGameOver(); }
    return;
  }

  // ---- COUNTDOWN ----
  if (G.screen===SCREEN.COUNT){
    if (G.countdown%60===0 && G.countdown>0 && G.countdown<=180) Audio.count();
    G.countdown--;
    // input al uitlezen zodat ogen bewegen; physics bevroren behalve val van bal
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
  if (G.screen===SCREEN.PLAY && !G.paused){
    assignInputs(false);
    updateSlime(G.p1); updateSlime(G.p2);
    updateBall();
    sendStateMaybe();
  }
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
    connected:false,
    _sendT:0,
    host(onCode, onStatus, onStart){
      this.isHost=true;
      const code = randomCode();
      this.code = code;
      try { this.peer = new Peer('SLWK'+code, { debug:1 }); }
      catch(e){ onStatus('PeerJS niet geladen — check internet', true); return; }
      this.peer.on('open', ()=> onCode(code));
      this.peer.on('error', err=>{
        if (String(err).includes('unavailable')) { onStatus('Code bezet, nieuwe code...', true); this.code=randomCode(); this.peer.destroy(); setTimeout(()=>this.host(onCode,onStatus,onStart),300); }
        else onStatus('Fout: '+err, true);
      });
      this.peer.on('connection', c=>{
        this.conn=c;
        c.on('open', ()=>{ this.connected=true; onStatus('Tegenstander verbonden!', false); });
        c.on('data', d=>this._recv(d));
        c.on('close', ()=>{ this.connected=false; onStatus('Verbinding verbroken', true); });
      });
      this._onStart = onStart;
    },
    join(code, onStatus, onStart){
      this.isHost=false;
      try { this.peer = new Peer({ debug:1 }); }
      catch(e){ onStatus('PeerJS niet geladen — check internet', true); return; }
      this.peer.on('open', ()=>{
        onStatus('Verbinden...', false);
        this.conn = this.peer.connect('SLWK'+code, { reliable:true });
        this.conn.on('open', ()=>{ this.connected=true; onStatus('Verbonden! Wacht op host...', false); });
        this.conn.on('data', d=>this._recv(d));
        this.conn.on('close', ()=>{ this.connected=false; onStatus('Verbinding verbroken', true); });
      });
      this.peer.on('error', err=> onStatus('Kan niet verbinden: '+err, true));
      this._onStart = onStart;
    },
    _recv(d){
      if (d.t==='start'){ if(this._onStart) this._onStart(d); }
      else if (d.t==='state'){ applyNetState(d); }
      else if (d.t==='input'){ this.guestInput = d.i; }
    },
    startGame(payload){ if (this.conn) this.conn.send(Object.assign({t:'start'},payload)); },
    sendInput(i){ if (this.conn && this.connected) this.conn.send({t:'input', i:{left:i.left,right:i.right,jump:i.jump}}); },
    sendState(){
      if (!this.conn || !this.connected) return;
      this.conn.send({ t:'state',
        p1:packEnt(G.p1), p2:packEnt(G.p2), ball:packBall(G.ball),
        score:G.score, screen:G.screen, winner:G.winner, cd:G.countdown });
    },
    close(){ try{ this.conn&&this.conn.close(); this.peer&&this.peer.destroy(); }catch(e){} }
  };
}
function randomCode(){ const a='ACDEFHJKLMNPRTUVWXY3479'; let s=''; for(let i=0;i<4;i++) s+=a[(Math.random()*a.length)|0]; return s; }
function packEnt(e){ return {x:e.x,y:e.y,vx:e.vx,vy:e.vy,onGround:e.onGround,squash:e.squash}; }
function packBall(b){ return {x:b.x,y:b.y,vx:b.vx,vy:b.vy,spin:b.spin}; }
function sendStateMaybe(){ if (G.mode==='host' && G.net){ G.net._sendT++; if (G.net._sendT%2===0) G.net.sendState(); } }

let overShown=false;
function applyNetState(d){
  G.netTarget = { p1:d.p1, p2:d.p2, ball:d.ball, score:d.score, screen:d.screen, winner:d.winner };
  if (d.screen!==SCREEN.OVER) overShown=false;
}

/* ----------------------------------------------------------------------------
   13. Rendering
   ---------------------------------------------------------------------------- */
let crowdSeed = [];
for (let i=0;i<160;i++) crowdSeed.push({ x:Math.random(), y:Math.random(), c:(Math.random()*6)|0, f:Math.random()*6.28 });

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
  if (G.p1 && G.p2) drawScoreboard();

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

  // banner "WK 2026"
  ctx.fillStyle='#06060f'; ctx.fillRect(0,GROUND-22,W,22);
  ctx.fillStyle='#ff7a18'; ctx.font="10px 'Press Start 2P', monospace"; ctx.textAlign='left';
  const msg='* WK 2026 * SLIME WORLD CUP * NEDERLAND * ';
  const scroll=(G.frame*1.2)%(msg.length*12);
  ctx.fillText((msg+msg+msg).slice(0), 20-scroll, GROUND-7);
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
  const w=232, h=52, x=CENTER-w/2, y=14;
  ctx.fillStyle='rgba(6,6,16,0.85)'; roundRect(x,y,w,h,8); ctx.fill();
  ctx.strokeStyle='#2c2c55'; ctx.lineWidth=2; roundRect(x,y,w,h,8); ctx.stroke();
  // vlaggen
  drawMiniFlag(G.p1.team, x+10, y+12, 40, 28);
  drawMiniFlag(G.p2.team, x+w-50, y+12, 40, 28);
  // codes
  ctx.font="8px 'Press Start 2P', monospace"; ctx.textAlign='center';
  ctx.fillStyle=G.p1.team.color; ctx.fillText(G.p1.team.code, x+30, y+50);
  ctx.fillStyle=G.p2.team.color; ctx.fillText(G.p2.team.code, x+w-30, y+50);
  // score
  ctx.fillStyle='#fff'; ctx.font="22px 'Press Start 2P', monospace";
  ctx.fillText(G.score[0]+' - '+G.score[1], CENTER, y+36);
  ctx.font="7px 'Press Start 2P', monospace"; ctx.fillStyle='#9a9ad0';
  ctx.fillText('eerste bij '+G.toWin, CENTER, y+h+12);
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
    ctx.fillStyle='#ff7a18'; ctx.font="64px 'Press Start 2P', monospace";
    ctx.fillText(String(n),0,0);
    ctx.restore();
  } else {
    ctx.fillStyle='#34d17a'; ctx.font="54px 'Press Start 2P', monospace";
    ctx.fillText('GO!',CENTER,H*0.42);
  }
}
function drawGoalText(){
  ctx.textAlign='center';
  const wob=Math.sin(G.frame*0.4)*6;
  ctx.save(); ctx.translate(CENTER,H*0.4); ctx.rotate(wob*0.004);
  ctx.fillStyle='#fff'; ctx.font="58px 'Press Start 2P', monospace";
  ctx.fillText('GOAL!',0,wob);
  const scorerTeam = G.lastScorer===0?G.p1.team:G.p2.team;
  ctx.fillStyle=scorerTeam.color; ctx.font="14px 'Press Start 2P', monospace";
  ctx.fillText(scorerTeam.name.toUpperCase()+' SCOORT', 0, 40);
  ctx.restore();
}
function drawPaused(){
  ctx.fillStyle='rgba(6,6,16,0.6)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font="34px 'Press Start 2P', monospace";
  ctx.fillText('PAUZE',CENTER,H*0.42);
  ctx.font="9px 'Press Start 2P', monospace"; ctx.fillStyle='#9a9ad0';
  ctx.fillText('ESC = verder',CENTER,H*0.52);
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
  const showTouch = IS_TOUCH && (G.screen===SCREEN.PLAY||G.screen===SCREEN.COUNT||G.screen===SCREEN.GOAL);
  $('touch').classList.toggle('show', showTouch);
  $('pad2').style.display = (G.mode==='2p') ? 'flex' : 'none';
  $('playHint').style.display = (G.screen===SCREEN.PLAY && !IS_TOUCH) ? 'block' : 'none';
}

// team-select state
let pickStage=0, pickP1=null, pickP2=null;
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
  document.querySelectorAll('.team').forEach(e=>e.classList.remove('sel'));
  el.classList.add('sel');
  if (G.mode==='guest'){ pickP2=t; sendGuestTeamAndWait(); return; }
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
      pickStage=1; $('pickLabel').innerHTML='Speler <b>2</b> (rechts): kies je land';
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

// ---- menu knoppen ----
function go1p(){ Audio.unlock(); G.mode='1p'; openTeamSelect('Kies <b>jouw</b> land'); }
function go2p(){ Audio.unlock(); G.mode='2p'; pickStage=0; openTeamSelect('Speler <b>1</b> (links): kies je land'); }
function openTeamSelect(label){ pickStage=0; pickP1=pickP2=null; $('pickLabel').innerHTML=label; buildTeamGrid(); showOverlay('teamScreen'); }

function goOnline(){ Audio.unlock(); showOverlay('onlineScreen'); $('onlineStatus').textContent=''; $('hostArea').style.display='none'; $('joinArea').style.display='none'; }

let overShownFlag=false;
function showGameOver(){
  overShown=true;
  const winTeam = G.winner===1?G.p1.team:G.p2.team;
  let who;
  if (G.mode==='1p') who = G.winner===1?'JIJ WINT!':'COMPUTER WINT';
  else if (G.mode==='2p') who = 'SPELER '+G.winner+' WINT!';
  else { const meWon = (G.mode==='host' && G.winner===1)||(G.mode==='guest' && G.winner===2); who = meWon?'JIJ WINT!':'TEGENSTANDER WINT'; }
  $('overTitle').textContent=who;
  $('overSub').innerHTML=`<div class="flag" style="width:90px;height:60px;margin:10px auto;border-radius:6px;border:2px solid #000;background:${winTeam.flag}"></div>${winTeam.name} — ${G.score[0]} : ${G.score[1]}`;
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
  $('lbSend').disabled=false; $('lbSend').textContent='🏆 Plaatsen';
  box.style.display='flex';
}
async function submitScore(){
  if (!G._lbEntry || !window.Leaderboard) return;
  const name=($('lbName').value||'').trim() || 'Anoniem';
  store.save('lbname', name);
  $('lbSend').disabled=true; $('lbStatus').textContent='Versturen...'; $('lbStatus').className='status';
  const ok = await window.Leaderboard.submit(Object.assign({name}, G._lbEntry));
  if (ok){ $('lbStatus').textContent='Geplaatst! 🟧'; $('lbStatus').className='status ok'; $('lbSend').textContent='✓ Geplaatst'; }
  else { $('lbStatus').textContent='Mislukt (offline?)'; $('lbStatus').className='status err'; $('lbSend').disabled=false; }
}
let lbFrom='menu';
async function showLeaderboard(from){
  lbFrom = from || 'menu';
  showOverlay('lbScreen');
  const list=$('lbList'); list.innerHTML='laden…';
  if (!window.Leaderboard){ list.textContent='Leaderboard niet beschikbaar.'; return; }
  const rows = await window.Leaderboard.top(12);
  if (!rows){ list.innerHTML='<div class="status err">Kon ranglijst niet laden (offline?).</div>'; return; }
  if (!rows.length){ list.innerHTML='<div class="status">Nog geen scores — wees de eerste! 🟧</div>'; return; }
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
  G.particles=[];
  showOverlay('menuScreen'); updateTouchVisibility();
}
function rematch(){
  if (G.mode==='host' && G.net){ // host herstart en seint
    startMatch(); G.net.startGame(startPayload());
  } else if (G.mode==='guest'){ /* host bestuurt herstart */ }
  else startMatch();
  updateTouchVisibility();
}

function onEscape(){
  if (G.screen===SCREEN.PLAY || G.paused){
    if (G.mode==='host'||G.mode==='guest') return;   // geen pauze online
    G.paused=!G.paused;
  } else if (G.screen===SCREEN.TEAM || G.screen===SCREEN.ONLINE){ backToMenu(); }
}

/* ---- Online flow ---- */
function startPayload(){ return { p1:pickP1.code, p2:pickP2.code, toWin:settings.toWin }; }

function hostGame(){
  Audio.unlock(); G.mode='host'; G.net=makeNet();
  $('hostArea').style.display='block'; $('joinArea').style.display='none';
  $('hostCode').textContent='...';
  $('onlineStatus').textContent='Server verbinden...'; $('onlineStatus').className='status';
  G.net.host(
    code=>{ $('hostCode').textContent=code; $('onlineStatus').textContent='Wacht op tegenstander. Deel de code.'; },
    (msg,err)=>{ $('onlineStatus').textContent=msg; $('onlineStatus').className='status '+(err?'err':'ok'); if(!err) $('hostStart').style.display='inline-block'; },
    null
  );
  $('hostStart').style.display='none';
}
function hostStartMatch(){
  if (!G.net || !G.net.connected){ $('onlineStatus').textContent='Nog geen tegenstander verbonden.'; $('onlineStatus').className='status err'; return; }
  // host kiest team via mini-select; voor nu: host = NED, gast = random tot teamkeuze toegevoegd
  openOnlineTeamPick();
}
function openOnlineTeamPick(){
  G.mode='host';
  $('pickLabel').innerHTML='Host: kies <b>jouw</b> land (links)';
  buildTeamGrid(); showOverlay('teamScreen');
}
function waitForGuestTeam(){
  $('pickLabel').innerHTML='Wacht op landkeuze tegenstander...';
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
  G.mode='host';
  G.p1=makeSlime('left', pickP1); G.p2=makeSlime('right', pickP2); G.ball=makeBall();
  G.net.startGame(startPayload());
  startMatch();
}
function joinGame(){
  Audio.unlock(); G.mode='guest'; G.net=makeNet();
  $('hostArea').style.display='none'; $('joinArea').style.display='block';
}
function joinConnect(){
  const code=$('joinCode').value.trim().toUpperCase();
  if (code.length<4){ $('onlineStatus').textContent='Voer de 4-letter code in.'; $('onlineStatus').className='status err'; return; }
  $('onlineStatus').textContent='Verbinden...'; $('onlineStatus').className='status';
  G.net.join(code, (msg,err)=>{ $('onlineStatus').textContent=msg; $('onlineStatus').className='status '+(err?'err':'ok'); }, null);
  patchNetForTeams();
}
function showGuestTeamPick(){
  G.mode='guest';
  $('pickLabel').innerHTML='Kies <b>jouw</b> land (rechts)';
  buildTeamGrid(); showOverlay('teamScreen');
}
function sendGuestTeamAndWait(){
  G.net.conn.send({t:'pick', code:pickP2.code});
  $('pickLabel').innerHTML='Verstuurd! Wacht op host...';
}
function onGuestStart(d){
  pickP1=teamByCode(d.p1); pickP2=teamByCode(d.p2);
  settings.toWin=d.toWin||5; G.toWin=settings.toWin;
  G.p1=makeSlime('left', pickP1); G.p2=makeSlime('right', pickP2); G.ball=makeBall();
  G.score=[0,0]; G.winner=0; overShown=false;
  hideAllOverlays(); G.screen=SCREEN.PLAY; updateTouchVisibility();
}

/* ---- Settings ---- */
function openSettings(){ refreshToggles(); showOverlay('setScreen'); }
function refreshToggles(){
  $('tSound').querySelector('.val').textContent = settings.sound?'AAN':'UIT';
  $('tCrt').querySelector('.val').textContent   = settings.crt?'AAN':'UIT';
  $('tWin').querySelector('.val').textContent   = settings.toWin;
  $('tDiff').querySelector('.val').textContent  = AI_LEVELS[settings.diff].label;
}
function toggleSound(){ settings.sound=!settings.sound; store.save('sound',settings.sound); if(settings.sound)Audio.unlock(); refreshToggles(); }
function toggleCrt(){ settings.crt=!settings.crt; store.save('crt',settings.crt); refreshToggles(); }
function cycleWin(){ const opts=[3,5,7,10]; settings.toWin=opts[(opts.indexOf(settings.toWin)+1)%opts.length]; store.save('toWin',settings.toWin); G.toWin=settings.toWin; refreshToggles(); }
function cycleDiff(){ const opts=Object.keys(AI_LEVELS); settings.diff=opts[(opts.indexOf(settings.diff)+1)%opts.length]; store.save('diff',settings.diff); refreshToggles(); }

/* ----------------------------------------------------------------------------
   16. Knoppen koppelen + init
   ---------------------------------------------------------------------------- */
function wire(id, fn){ const el=$(id); if(el) el.onclick=()=>{ Audio.click(); fn(); }; }
wire('btn1p', go1p);
wire('btn2p', go2p);
wire('btnOnline', goOnline);
wire('btnSettings', openSettings);
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
showOverlay('menuScreen');
updateTouchVisibility();
$('rotate').classList.add('armed');
setTimeout(checkPeer, 1500);

// expose voor debug
window.__G = G;
