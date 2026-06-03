/* ============================================================================
   SLIME VOLLEYBALL  —  part of SlimeScore
   Vanilla JS + Canvas 2D. Modes: 1P vs computer, 2P local.
   Volleyball physics: a net in the middle, the ball touching your floor scores
   for the other side. No catch/hold — a mid-air SMASH spikes the ball instead.
   First to 3 / 5 / 7 points. After 12s idle the serve drops automatically.
   Web Audio (synthesized). No binary assets needed.
   ============================================================================ */
'use strict';

/* ----------------------------------------------------------------------------
   0. Canvas + world constants
   ---------------------------------------------------------------------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = 1160, H = 600;                 // logical resolution
const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
ctx.scale(DPR, DPR);

const GROUND  = H - 52;                  // floor of the court (y)
const CENTER  = W / 2;
const SLIME_R = 58;                      // slime radius (half circle)
const BALL_R  = 15;

const NET_W   = 14;                      // net thickness
const NET_H   = 128;                     // net height above the floor (lower = classic slime-volley feel)
const NET_TOP = GROUND - NET_H;          // y of the net tape
const halfNet = NET_W / 2;

// physics tuning (per 60fps tick)
const SLIME_SPEED = 7.2;
const SLIME_JUMP  = 15.8;                // high enough to clear & attack over the net
const SLIME_GRAV  = 0.72;
const COYOTE_FRAMES = 6;
const JUMP_BUFFER_FRAMES = 4;
const BALL_GRAV = 0.21;                  // floatier, ~30% slower volleyball ball
const BALL_REST = 0.86;                  // wall/net damping
const BALL_MAX  = 16;                    // speed limit (~30% slower than before)

const SERVE_FRAMES = 12 * 60;            // 12s idle -> auto-serve
const POINT_FRAMES = 80;                 // pause after a point before the next serve

/* ----------------------------------------------------------------------------
   1. Teams  (top volleyball nations + Belgium & France; Netherlands featured)
   ---------------------------------------------------------------------------- */
const TEAMS = [
  { code:'NED', name:'Netherlands', color:'#ff7a18', trim:'#ffffff', strength:84, stripes:['#ae1c28','#ffffff','#21468b'], featured:true },
  { code:'POL', name:'Poland',      color:'#e9edf2', trim:'#d4213d', strength:95, stripes:['#ffffff','#ffffff','#d4213d'] },
  { code:'ITA', name:'Italy',       color:'#1f6fd6', trim:'#ffffff', strength:93, stripes:['#009246','#ffffff','#ce2b37'] },
  { code:'BRA', name:'Brazil',      color:'#ffd400', trim:'#1f8f3a', strength:92, stripes:['#1f8f3a','#ffd400','#2a47a8'] },
  { code:'FRA', name:'France',      color:'#2f5fc0', trim:'#ffffff', strength:90, stripes:['#0055a4','#ffffff','#ef4135'] },
  { code:'USA', name:'USA',         color:'#2a3a8c', trim:'#ffffff', strength:88, stripes:['#3c3b6e','#ffffff','#b22234'] },
  { code:'SVN', name:'Slovenia',    color:'#2bb673', trim:'#ffffff', strength:85, stripes:['#ffffff','#0000a0','#d50000'] },
  { code:'JPN', name:'Japan',       color:'#d21034', trim:'#ffffff', strength:84, stripes:['#ffffff','#bc002d','#ffffff'] },
  { code:'SRB', name:'Serbia',      color:'#c6363c', trim:'#ffffff', strength:86, stripes:['#c6363c','#0c4076','#ffffff'] },
  { code:'ARG', name:'Argentina',   color:'#7cc0ee', trim:'#ffffff', strength:83, stripes:['#74acdf','#ffffff','#74acdf'] },
  { code:'BEL', name:'Belgium',     color:'#e2231a', trim:'#f3d02f', strength:78, stripes:['#000000','#fdda24','#ef3340'] },
  { code:'IRN', name:'Iran',        color:'#179a4c', trim:'#ffffff', strength:82, stripes:['#239f40','#ffffff','#da0000'] },
];
const teamByCode = c => TEAMS.find(t => t.code === c) || TEAMS[0];

/* ----------------------------------------------------------------------------
   Accurate flags. Compact inline SVGs (viewBox 90x60, double-quoted attrs only
   so they encode cleanly into a data URI). Used both in the DOM (CSS background)
   and on the canvas HUD (rasterised, with the stripe bands as a fallback).
   ---------------------------------------------------------------------------- */
const _usaStripes = (()=>{ let s=''; for(let i=1;i<13;i+=2) s+='<rect y="'+(i*60/13).toFixed(2)+'" width="90" height="'+(60/13).toFixed(2)+'" fill="#fff"/>'; return s; })();
const _usaStars   = (()=>{ let s=''; for(let r=0;r<4;r++) for(let c=0;c<5;c++) s+='<circle cx="'+(6+c*7)+'" cy="'+(6+r*7.2).toFixed(1)+'" r="1.3" fill="#fff"/>'; return s; })();
const FLAG_SVG = {
  NED:'<rect width="90" height="60" fill="#fff"/><rect width="90" height="20" fill="#ae1c28"/><rect y="40" width="90" height="20" fill="#21468b"/>',
  POL:'<rect width="90" height="60" fill="#fff"/><rect y="30" width="90" height="30" fill="#d4213d"/>',
  ITA:'<rect width="90" height="60" fill="#fff"/><rect width="30" height="60" fill="#009246"/><rect x="60" width="30" height="60" fill="#ce2b37"/>',
  BRA:'<rect width="90" height="60" fill="#009c3b"/><polygon points="45,7 83,30 45,53 7,30" fill="#ffdf00"/><circle cx="45" cy="30" r="12" fill="#002776"/>',
  FRA:'<rect width="90" height="60" fill="#fff"/><rect width="30" height="60" fill="#0055a4"/><rect x="60" width="30" height="60" fill="#ef4135"/>',
  USA:'<rect width="90" height="60" fill="#b22234"/>'+_usaStripes+'<rect width="36" height="32.31" fill="#3c3b6e"/>'+_usaStars,
  SVN:'<rect width="90" height="60" fill="#fff"/><rect y="20" width="90" height="20" fill="#0000a0"/><rect y="40" width="90" height="20" fill="#d50000"/><path d="M14 12 L26 12 L20 27 Z" fill="#fff" stroke="#0000a0" stroke-width="1.6"/><path d="M16 19 L24 19" stroke="#0000a0" stroke-width="1.4"/>',
  JPN:'<rect width="90" height="60" fill="#fff"/><circle cx="45" cy="30" r="15" fill="#bc002d"/>',
  SRB:'<rect width="90" height="60" fill="#c6363c"/><rect y="20" width="90" height="20" fill="#0c4076"/><rect y="40" width="90" height="20" fill="#fff"/>',
  ARG:'<rect width="90" height="60" fill="#fff"/><rect width="90" height="20" fill="#74acdf"/><rect y="40" width="90" height="20" fill="#74acdf"/><circle cx="45" cy="30" r="6" fill="#f6b40e"/>',
  BEL:'<rect width="90" height="60" fill="#000"/><rect x="30" width="30" height="60" fill="#fdda24"/><rect x="60" width="30" height="60" fill="#ef3340"/>',
  IRN:'<rect width="90" height="60" fill="#fff"/><rect width="90" height="20" fill="#239f40"/><rect y="40" width="90" height="20" fill="#da0000"/><circle cx="45" cy="30" r="4.4" fill="none" stroke="#da0000" stroke-width="1.6"/>',
};
function flagSVG(code){ return '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="60" viewBox="0 0 90 60">'+(FLAG_SVG[code]||FLAG_SVG.NED)+'</svg>'; }
function flagDataURI(code){ return 'data:image/svg+xml,'+encodeURIComponent(flagSVG(code)); }
function flagBg(code){ return "url('"+flagDataURI(code)+"') center/100% 100% no-repeat"; }
const _flagImgCache = {};
function flagImage(code){ if (typeof Image==='undefined') return null;
  let i=_flagImgCache[code]; if(!i){ i=new Image(); i.src=flagDataURI(code); _flagImgCache[code]=i; } return i; }
TEAMS.forEach(tm => { tm.flag = flagBg(tm.code); });

/* ----------------------------------------------------------------------------
   2. AI levels
   ---------------------------------------------------------------------------- */
const AI_LEVELS = {
  easy:   { label:'Easy',   speed:0.62, react:13, jump:0.05, mistake:0.34, attack:0.05 },
  normal: { label:'Normal', speed:0.84, react:7,  jump:0.30, mistake:0.15, attack:0.30 },
  hard:   { label:'Hard',   speed:1.04, react:4,  jump:0.62, mistake:0.04, attack:0.66 },
  pro:    { label:'Pro',    speed:1.20, react:2,  jump:0.85, mistake:0.0,  attack:0.92 },
};
const DIFF_MIGRATE = { makkelijk:'easy', normaal:'normal', moeilijk:'hard', worldcup:'pro', wk:'pro' };
function normDiff(d){ return AI_LEVELS[d] ? d : (DIFF_MIGRATE[d] || 'normal'); }

/* ----------------------------------------------------------------------------
   3. Settings (localStorage)
   ---------------------------------------------------------------------------- */
const store = {
  load(k, d){ try { const v = localStorage.getItem('slimevolley_'+k); return v===null?d:JSON.parse(v); } catch(e){ return d; } },
  save(k, v){ try { localStorage.setItem('slimevolley_'+k, JSON.stringify(v)); } catch(e){} }
};
function clamp01(v){ v=+v; return isNaN(v)?0.7:(v<0?0:v>1?1:v); }
const settings = {
  sound:  store.load('sound', true),
  crt:    store.load('crt', false),
  toWin:  store.load('toWin', 5),                 // 3 | 5 | 7
  diff:   normDiff(store.load('diff', 'normal')),
  volume: clamp01(store.load('volume', 0.7)),
  lang:   store.load('lang', 'en'),               // 'en' | 'nl'
};
if ([3,5,7].indexOf(settings.toWin) < 0) settings.toWin = 5;

/* ----------------------------------------------------------------------------
   i18n — English (default) + Dutch. The name "Slime Volleyball" and "Slime
   Sports" stay English; everything else translates. Missing keys fall back to
   English so a gap shows English text, never breaks.
   ---------------------------------------------------------------------------- */
const I18N = {
  en: {
    teamLeft:'LEFT', teamRight:'RIGHT', tagline:'slime volleyball · indoor smash rally 🏐',
    grpPlay:'Play', grpPlayHtml:'Play <span>· keyboard or touch</span>',
    m1p:'🏐 1 Player · vs computer', m2p:'👥 2 Players · same device',
    mCup:'🏆 Tournament · knockout vs computer',
    setupTitleCup:'🏆 TOURNAMENT', setupSubCup:'Pick your level & match length — then win 3 rounds',
    cupQF:'Quarter-final', cupSF:'Semi-final', cupFinal:'Final',
    cupWon:'{round} WON! 🎉', cupNextSub:'Next up: <b>{round}</b> vs <b>{team}</b>',
    cupChampion:'🏆 CHAMPION!', cupChampSub:'You won the tournament with <b>{team}</b>!',
    cupEliminated:'ELIMINATED', cupOutSub:'Knocked out in the <b>{round}</b>.',
    cupNext:'▶ Next match', cupNew:'🔁 New tournament', cupBadge:'{round} · vs {team}',
    hallTag:'INDOOR ARENA · SLIMESCORE',
    pickYourCountry:'Pick <b>your</b> country', pickP1:'Player <b>1</b> (left): pick your country',
    pickP2:'Player <b>2</b> (right): pick your country', back:'‹ Back',
    setupTitle1p:'🏐 1 PLAYER', setupTitle2p:'👥 2 PLAYERS',
    setupSub:'Pick your level & how many points to win', setupSub2p:'Pick how many points to win',
    computerLevel:'Computer level', pointsToWin:'Points to win',
    continueTeams:'▶ Continue to teams', diffEasy:'Easy', diffNormal:'Normal', diffHard:'Hard', diffPro:'Pro',
    settings:'SETTINGS', sound:'Sound', volume:'Volume', crt:'CRT effect', firstTo:'First to',
    language:'Language', on:'ON', off:'OFF',
    youWin:'YOU WIN!', cpuWins:'COMPUTER WINS', playerWins:'PLAYER {n} WINS!',
    finalScore:'Final score: <b>{a} – {b}</b>',
    putName:'Put your name on the Slimescore:', yourName:'YOUR NAME', submit:'🏆 Submit',
    rematch:'🔁 Rematch', slimescore:'🏆 Slimescore', mainMenu:'🏠 Main menu',
    submitting:'Submitting…', submittedOk:'Submitted! 🏐', submitFail:'Failed (offline?)', submitted:'✓ Submitted',
    ssTitle:'🏆 SLIMESCORE', ssSub:'Best 1-player wins · points by level',
    loading:'loading…', lbNone:'No scores yet — be the first! 🏐', lbFail:'Could not load Slimescore (offline?).',
    lbNA:'Slimescore not available.', pts:'pts', yourPos:'🎯 Your position: #{n} · {p} pts',
    crossTitle:'Part of SlimeScore', playSoccer:'🥅 Play Slime Soccer →',
    soccerBlurb:'Like the rally? Try the football one — knockout World Cup, online & more.',
    paused:'PAUSED', pressEsc:'Press ESC to resume', resume:'▶️ Resume', quitMenu:'🏠 Quit to menu',
    pauseBtn:'⏸ Pause', quitBtn2:'✕ Quit',
    rotate:'Rotate your device to landscape<br>for the best rally 🏐',
    playHint:'<b>Player 1</b> A/D move · <b>W</b> jump · <b>S</b> smash (in the air) · ESC = pause',
    playHint2p:'<b>P1</b> A/D · W · S &nbsp;·&nbsp; <b>P2</b> ←/→ · ↑ · ↓ &nbsp;·&nbsp; ESC = pause',
    serveYou:'YOUR SERVE', serveCpu:'OPPONENT SERVE', servePlayer:'PLAYER {n} SERVE',
    serveHint:'tap ▲ to serve · auto in {n}s', pointFor:'{team} scores!',
    rulesTitle:'HOW TO PLAY', rulesControls:'Controls', rulesMoves:'Moves', rulesRules:'Rules', rulesModes:'Modes', rulesBtn:'❓ How to play',
    rulesControlsTxt:'<b>Player 1</b> — A/D move, W jump, S smash (or the touch buttons).<br><b>Player 2</b> — ←/→ move, ↑ jump, ↓ smash.',
    rulesMovesTxt:'<b>Double jump</b> — tap jump again in mid-air for an extra boost to reach high balls.<br><b>Smash</b> — hold smash while you hit the ball in the air, above net height, to spike it down hard. There is no catching the ball.',
    rulesRulesTxt:'<b>Floor = point</b> — if the ball touches the floor on your side, the other side scores.<br><b>Over the net</b> — you can\'t cross the net; play the ball back over it.<br><b>Serve</b> — the side that won the point serves next; if nobody serves within 12s it drops automatically.',
    rulesModesTxt:'<b>1 Player</b> — rally against the computer (Easy → Pro).<br><b>2 Players</b> — share one keyboard or phone.<br><b>Tournament</b> — a 3-round knockout vs the computer (quarter-final → semi-final → final); each round gets tougher.<br><b>First to 3 / 5 / 7</b> — pick the match length; first to that many points wins.',
  },
  nl: {
    teamLeft:'LINKS', teamRight:'RECHTS', tagline:'slime volleybal · zaalrally met smash 🏐',
    grpPlay:'Spelen', grpPlayHtml:'Spelen <span>· toetsenbord of touch</span>',
    m1p:'🏐 1 Speler · tegen computer', m2p:'👥 2 Spelers · zelfde toestel',
    mCup:'🏆 Toernooi · knock-out tegen computer',
    setupTitleCup:'🏆 TOERNOOI', setupSubCup:'Kies je niveau & lengte — win daarna 3 rondes',
    cupQF:'Kwartfinale', cupSF:'Halve finale', cupFinal:'Finale',
    cupWon:'{round} GEWONNEN! 🎉', cupNextSub:'Hierna: <b>{round}</b> tegen <b>{team}</b>',
    cupChampion:'🏆 KAMPIOEN!', cupChampSub:'Je won het toernooi met <b>{team}</b>!',
    cupEliminated:'UITGESCHAKELD', cupOutSub:'Uitgeschakeld in de <b>{round}</b>.',
    cupNext:'▶ Volgende wedstrijd', cupNew:'🔁 Nieuw toernooi', cupBadge:'{round} · tegen {team}',
    hallTag:'SPORTHAL · SLIMESCORE',
    pickYourCountry:'Kies <b>jouw</b> land', pickP1:'Speler <b>1</b> (links): kies je land',
    pickP2:'Speler <b>2</b> (rechts): kies je land', back:'‹ Terug',
    setupTitle1p:'🏐 1 SPELER', setupTitle2p:'👥 2 SPELERS',
    setupSub:'Kies je niveau & hoeveel punten je nodig hebt', setupSub2p:'Kies hoeveel punten je nodig hebt',
    computerLevel:'Computerniveau', pointsToWin:'Punten om te winnen',
    continueTeams:'▶ Verder naar teams', diffEasy:'Makkelijk', diffNormal:'Normaal', diffHard:'Moeilijk', diffPro:'Pro',
    settings:'INSTELLINGEN', sound:'Geluid', volume:'Volume', crt:'CRT-effect', firstTo:'Eerste tot',
    language:'Taal', on:'AAN', off:'UIT',
    youWin:'JIJ WINT!', cpuWins:'COMPUTER WINT', playerWins:'SPELER {n} WINT!',
    finalScore:'Eindstand: <b>{a} – {b}</b>',
    putName:'Zet je naam op de Slimescore:', yourName:'JOUW NAAM', submit:'🏆 Verstuur',
    rematch:'🔁 Opnieuw', slimescore:'🏆 Slimescore', mainMenu:'🏠 Hoofdmenu',
    submitting:'Versturen…', submittedOk:'Verstuurd! 🏐', submitFail:'Mislukt (offline?)', submitted:'✓ Verstuurd',
    ssTitle:'🏆 SLIMESCORE', ssSub:'Beste 1-speler-overwinningen · punten per niveau',
    loading:'laden…', lbNone:'Nog geen scores — wees de eerste! 🏐', lbFail:'Kan Slimescore niet laden (offline?).',
    lbNA:'Slimescore niet beschikbaar.', pts:'ptn', yourPos:'🎯 Jouw positie: #{n} · {p} ptn',
    crossTitle:'Onderdeel van SlimeScore', playSoccer:'🥅 Speel Slime Soccer →',
    soccerBlurb:'Leuk gerally’d? Probeer de voetbalversie — knock-out WK, online en meer.',
    paused:'GEPAUZEERD', pressEsc:'Druk ESC om door te gaan', resume:'▶️ Doorgaan', quitMenu:'🏠 Terug naar menu',
    pauseBtn:'⏸ Pauze', quitBtn2:'✕ Stoppen',
    rotate:'Draai je toestel horizontaal<br>voor de beste rally 🏐',
    playHint:'<b>Speler 1</b> A/D bewegen · <b>W</b> springen · <b>S</b> smashen (in de lucht) · ESC = pauze',
    playHint2p:'<b>S1</b> A/D · W · S &nbsp;·&nbsp; <b>S2</b> ←/→ · ↑ · ↓ &nbsp;·&nbsp; ESC = pauze',
    serveYou:'JOUW SERVE', serveCpu:'SERVE TEGENSTANDER', servePlayer:'SERVE SPELER {n}',
    serveHint:'tik ▲ om te serveren · automatisch over {n}s', pointFor:'punt voor {team}!',
    rulesTitle:'ZO SPEEL JE', rulesControls:'Besturing', rulesMoves:'Acties', rulesRules:'Regels', rulesModes:'Modi', rulesBtn:'❓ Zo speel je',
    rulesControlsTxt:'<b>Speler 1</b> — A/D bewegen, W springen, S smashen (of de touch-knoppen).<br><b>Speler 2</b> — ←/→ bewegen, ↑ springen, ↓ smashen.',
    rulesMovesTxt:'<b>Dubbele sprong</b> — tik in de lucht nogmaals op springen voor een extra zet naar hoge ballen.<br><b>Smash</b> — houd smash ingedrukt terwijl je de bal in de lucht boven nethoogte raakt om hem hard naar beneden te slaan. Vasthouden van de bal kan niet.',
    rulesRulesTxt:'<b>Vloer = punt</b> — raakt de bal de vloer aan jouw kant, dan scoort de tegenstander.<br><b>Over het net</b> — je mag het net niet over; speel de bal terug over het net.<br><b>Serveren</b> — wie het punt won mag serveren; serveert niemand binnen 12s, dan valt de bal vanzelf.',
    rulesModesTxt:'<b>1 Speler</b> — rally tegen de computer (Makkelijk → Pro).<br><b>2 Spelers</b> — deel één toetsenbord of telefoon.<br><b>Toernooi</b> — een knock-out van 3 rondes tegen de computer (kwartfinale → halve finale → finale); elke ronde wordt zwaarder.<br><b>Eerste tot 3 / 5 / 7</b> — kies de lengte; wie als eerste zoveel punten heeft, wint.',
  },
};
const NL_NAMES = { NED:'Nederland', POL:'Polen', ITA:'Italië', BRA:'Brazilië', FRA:'Frankrijk', USA:'USA',
  SVN:'Slovenië', JPN:'Japan', SRB:'Servië', ARG:'Argentinië', BEL:'België', IRN:'Iran' };
function t(key, vars){
  let s = (I18N[settings.lang] && I18N[settings.lang][key]);
  if (s==null) s = I18N.en[key];
  if (s==null) s = key;
  if (vars) for (const k in vars) s = s.split('{'+k+'}').join(vars[k]);
  return s;
}
function teamName(tm){ return settings.lang==='nl' ? (NL_NAMES[tm.code]||tm.name) : tm.name; }
const _AI_KEY = { easy:'diffEasy', normal:'diffNormal', hard:'diffHard', pro:'diffPro' };
function aiLabel(d){ return t(_AI_KEY[d]||'diffNormal'); }
function applyStaticI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-html]').forEach(el=>{ el.innerHTML = t(el.getAttribute('data-i18n-html')); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{ el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  try{ document.documentElement.lang = settings.lang; }catch(_){}
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ----------------------------------------------------------------------------
   4. Audio — fully synthesized (Web Audio). Whistle on serve, bump on a touch,
   a meaty spike on a smash, a soft net tick, a crowd cheer on points/wins.
   ---------------------------------------------------------------------------- */
const Sound = (() => {
  let ac=null, master=null;
  function ensure(){
    if (ac) return ac;
    try { ac = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){ return null; }
    master = ac.createGain(); master.gain.value = settings.volume; master.connect(ac.destination);
    return ac;
  }
  function on(){ return settings.sound && ensure(); }
  function unlock(){ const c=ensure(); if (c && c.state==='suspended') c.resume(); }
  function setVol(v){ if (master) master.gain.value = v; }
  function blip(freq, dur, type, vol, slideTo){
    if (!on()) return;
    const o=ac.createOscillator(), g=ac.createGain();
    o.type=type||'sine'; o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40,slideTo), ac.currentTime+dur);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(vol||0.2, ac.currentTime+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime+dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime+dur+0.02);
  }
  function noise(dur, vol, lp){
    if (!on()) return;
    const n=Math.floor(ac.sampleRate*dur), buf=ac.createBuffer(1,n,ac.sampleRate), d=buf.getChannelData(0);
    for (let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const src=ac.createBufferSource(); src.buffer=buf;
    const f=ac.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lp||1800;
    const g=ac.createGain(); g.gain.value=vol||0.2;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  return {
    unlock, setVol,
    click(){ blip(420,0.05,'square',0.12,560); },
    bump(power){ const v=Math.min(0.28,0.10+power*0.012); blip(300+power*10,0.08,'triangle',v,180); },
    net(){ blip(220,0.06,'sine',0.10,150); },
    wall(){ blip(150,0.07,'sine',0.12,90); },
    jump(){ blip(330,0.10,'sine',0.10,520); },
    spike(){ noise(0.18,0.32,2600); blip(140,0.16,'sawtooth',0.20,60); },
    whistle(){ blip(2100,0.12,'square',0.12,2300); setTimeout(()=>blip(2300,0.10,'square',0.10,2100),90); },
    point(){ noise(0.5,0.18,1200); blip(523,0.18,'triangle',0.16,659); setTimeout(()=>blip(784,0.22,'triangle',0.16,880),120); },
    win(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>blip(f,0.3,'triangle',0.18),i*130)); noise(0.8,0.2,1400); },
  };
})();

/* ----------------------------------------------------------------------------
   5. Input — keyboard + touch buttons (L/R/Jump/Smash, per player)
   ---------------------------------------------------------------------------- */
const keys = {};
const blockKeys = new Set([' ','arrowup','arrowdown','arrowleft','arrowright']);
addEventListener('keydown', e=>{
  const k=e.key.toLowerCase(); keys[k]=true;
  if (blockKeys.has(k) && !/^(input|textarea)$/i.test((e.target&&e.target.tagName)||'')) e.preventDefault();
  if (k==='escape') togglePause();
});
addEventListener('keyup', e=>{ keys[e.key.toLowerCase()]=false; });
addEventListener('blur', ()=>{ for(const k in keys) keys[k]=false; });

const touch = { L:false,R:false,J:false,D:false, L2:false,R2:false,J2:false,D2:false };
const BTN_PROP = { btnL:'L', btnR:'R', btnJ:'J', btnP:'D', btn2L:'L2', btn2R:'R2', btn2J:'J2', btn2P:'D2' };
const activePointers = new Map();
const btnZones = [];
function refreshBtnZones(){
  btnZones.length = 0;
  for (const id in BTN_PROP){
    const el=document.getElementById(id); if(!el) continue;
    const r=el.getBoundingClientRect();
    if (r.width===0 || el.offsetParent===null) continue;
    const padX=Math.max(16,r.width*0.4), padY=Math.max(16,r.height*0.6);
    btnZones.push({ id, prop:BTN_PROP[id], x0:r.left-padX, x1:r.right+padX, y0:r.top-padY, y1:r.bottom+padY });
  }
}
function btnIdAt(x,y){ for(const z of btnZones){ if(x>=z.x0&&x<=z.x1&&y>=z.y0&&y<=z.y1) return z; } return null; }
function setBtn(id,on){ touch[BTN_PROP[id]]=on; const el=document.getElementById(id); if(el) el.classList.toggle('pressed',on); }
function routePointer(pid,zone){ const prev=activePointers.get(pid); if(prev&&prev!==zone.id) setBtn(prev,false);
  activePointers.set(pid,zone.id); setBtn(zone.id,true); if(zone.prop==='J'||zone.prop==='J2') Sound.unlock(); }
function clearPointer(pid){ const prev=activePointers.get(pid); if(prev) setBtn(prev,false); activePointers.delete(pid); }
function onPointer(e){
  if (e.pointerType==='mouse' && e.buttons===0 && e.type!=='pointerup' && e.type!=='pointercancel') return;
  const z=btnIdAt(e.clientX,e.clientY);
  if (e.type==='pointerdown'){ if(z){ e.preventDefault(); routePointer(e.pointerId,z);} }
  else if (e.type==='pointermove'){ if(activePointers.has(e.pointerId)){ if(z) routePointer(e.pointerId,z); else clearPointer(e.pointerId); } }
  else { clearPointer(e.pointerId); }
}
['pointerdown','pointermove','pointerup','pointercancel'].forEach(ev=>addEventListener(ev,onPointer,{passive:false}));

const IS_TOUCH = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
function p1KeyInput(){ return { left:!!keys['a']||touch.L, right:!!keys['d']||touch.R, jump:!!keys['w']||touch.J, down:!!keys['s']||touch.D }; }
function p2KeyInput(){ return { left:!!keys['arrowleft']||touch.L2, right:!!keys['arrowright']||touch.R2, jump:!!keys['arrowup']||touch.J2, down:!!keys['arrowdown']||touch.D2 }; }

/* ----------------------------------------------------------------------------
   6. Entities
   ---------------------------------------------------------------------------- */
function makeSlime(side, team){
  return {
    side, team,
    x: side==='left' ? W*0.25 : W*0.75,
    y: GROUND, vx:0, vy:0, onGround:true,
    eyeX:0, eyeY:0, squash:0,
    jumpWasDown:false, lastJumpFrame:-99, canDouble:false, coyote:0, jumpBuffer:0,
    aiReact:0, aiInput:{left:false,right:false,jump:false,down:false},
    input:{left:false,right:false,jump:false,down:false},
  };
}
function makeBall(){ return { x:CENTER, y:220, vx:0, vy:0, spin:0 }; }

/* ----------------------------------------------------------------------------
   7. Game state
   ---------------------------------------------------------------------------- */
const SCREEN = { MENU:'menu', SERVE:'serve', PLAY:'play', POINT:'point', OVER:'over' };
const G = {
  screen: SCREEN.MENU,
  mode: '1p',
  p1:null, p2:null, ball:null,
  score:[0,0], toWin: settings.toWin,
  server:0, serveTimer:SERVE_FRAMES, serveX:W*0.27, serveBaseY:220, _srvPrev:true,
  pointTimer:0, lastWinner:0, winner:0, _matchWon:false,
  attract:false, particles:[], shake:0, flash:0, frame:0, paused:false,
  cup:null,   // tournament progress when in knockout mode (see section 11b)
};

/* ----------------------------------------------------------------------------
   8. Particles
   ---------------------------------------------------------------------------- */
function spawnDust(x,y,n,col){
  for(let i=0;i<n;i++) G.particles.push({ x,y, vx:(Math.random()-0.5)*4, vy:-Math.random()*3-1,
    life:24+Math.random()*16, max:40, r:2+Math.random()*2, col, g:0.18 });
}
function spawnConfetti(){
  const cols=['#ff7a18','#ffd23b','#ffffff','#34d17a','#ff5470','#2b6fff'];
  for(let i=0;i<170;i++) G.particles.push({ x:Math.random()*W, y:-10-Math.random()*120,
    vx:(Math.random()-0.5)*3, vy:Math.random()*2+1, life:120+Math.random()*80, max:200,
    r:3+Math.random()*3, col:cols[(Math.random()*cols.length)|0], g:0.06, conf:true, rot:Math.random()*6 });
}
function updateParticles(){
  for(let i=G.particles.length-1;i>=0;i--){
    const p=G.particles[i]; p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.life--;
    if (p.conf) p.rot+=p.vx*0.1;
    if (p.life<=0 || p.y>H+20) G.particles.splice(i,1);
  }
}

/* ----------------------------------------------------------------------------
   9. Physics / simulation
   ---------------------------------------------------------------------------- */
function clamp(v,a,b){ return v<a?a:v>b?b:v; }

function updateSlime(s){
  const i=s.input;
  s.vx=(i.right?SLIME_SPEED:0)-(i.left?SLIME_SPEED:0);
  s.x+=s.vx;
  // stay on your own half (can't cross the net)
  if (s.side==='left') s.x=clamp(s.x, SLIME_R*0.4, CENTER-halfNet-SLIME_R);
  else                 s.x=clamp(s.x, CENTER+halfNet+SLIME_R, W-SLIME_R*0.4);
  // jump — double-tap = one mid-air boost; coyote grace + small pre-land buffer
  const edge=i.jump && !s.jumpWasDown; s.jumpWasDown=i.jump;
  if (s.onGround) s.coyote=COYOTE_FRAMES; else if (s.coyote>0) s.coyote--;
  if (s.jumpBuffer>0) s.jumpBuffer--;
  if (edge){
    if (s.onGround || s.coyote>0){ s.vy=-SLIME_JUMP; s.onGround=false; s.coyote=0; s.squash=-0.18; s.canDouble=true; s.lastJumpFrame=G.frame; Sound.jump(); }
    else if (s.canDouble && (G.frame-s.lastJumpFrame)<16){ s.vy=-SLIME_JUMP*1.04; s.canDouble=false; s.squash=-0.20; Sound.jump(); }
    else s.jumpBuffer=JUMP_BUFFER_FRAMES;
  }
  s.vy+=SLIME_GRAV; s.y+=s.vy;
  if (s.y>=GROUND){
    if (!s.onGround) s.squash=0.22;
    s.y=GROUND; s.vy=0; s.onGround=true; s.canDouble=false;
    if (s.jumpBuffer>0){ s.jumpBuffer=0; s.coyote=0; s.vy=-SLIME_JUMP; s.onGround=false; s.squash=-0.18; s.canDouble=true; s.lastJumpFrame=G.frame; Sound.jump(); }
  }
  s.squash*=0.82;
  const b=G.ball, dx=b.x-s.x, dy=b.y-(s.y-SLIME_R*0.5), d=Math.hypot(dx,dy)||1;
  s.eyeX=dx/d; s.eyeY=dy/d;
}

function reflectOffSlime(b,s){
  const dx=b.x-s.x, dy=b.y-s.y, dist=Math.hypot(dx,dy), minD=SLIME_R+BALL_R;
  if (dist<minD && b.y<=s.y+2 && dist>0){
    const nx=dx/dist, ny=dy/dist;
    b.x=s.x+nx*minD; b.y=s.y+ny*minD;
    const speed=Math.hypot(b.vx,b.vy), out=Math.max(speed*0.85, 7);
    b.vx=nx*out + s.vx*0.9;
    b.vy=ny*out + s.vy*0.5;
    const smashing=s.input.down && !s.onGround, high=b.y < NET_TOP+34;
    if (smashing && high){
      const dir=s.side==='left'?1:-1;
      // drive it straight across, not steeply down — just a touch of dip
      b.vx=dir*Math.max(12, out*0.95) + s.vx*0.5;
      b.vy=Math.max(1.5, out*0.18) + s.vy*0.3;
      Sound.spike(); spawnDust(b.x,b.y,11,'#ffffff'); if (G.screen===SCREEN.PLAY) G.shake=Math.max(G.shake,6);
    } else {
      if (ny<-0.2 && b.vy>-3) b.vy=-3;     // keep top-side touches airborne so rallies sustain
      Sound.bump(out); spawnDust(b.x,b.y,5,'#ffffff');
    }
    if (b.x<BALL_R){ b.x=BALL_R; if(b.vx<0) b.vx=-b.vx; }
    else if (b.x>W-BALL_R){ b.x=W-BALL_R; if(b.vx>0) b.vx=-b.vx; }
    if (b.y<BALL_R){ b.y=BALL_R; if(b.vy<0) b.vy=-b.vy; }
    return true;
  }
  return false;
}

function collideNet(b){
  // rounded top cap (net cord): lets net-cord dribblers happen
  const dx=b.x-CENTER, dy=b.y-NET_TOP, d=Math.hypot(dx,dy);
  if (b.y<NET_TOP && d<BALL_R+halfNet && d>0){
    const nx=dx/d, ny=dy/d, dot=b.vx*nx+b.vy*ny;
    b.x=CENTER+nx*(BALL_R+halfNet); b.y=NET_TOP+ny*(BALL_R+halfNet);
    if (dot<0){ b.vx=(b.vx-2*dot*nx)*0.7; b.vy=(b.vy-2*dot*ny)*0.7; Sound.net(); }
    return;
  }
  // solid body from the tape down to the floor
  if (b.y+BALL_R>NET_TOP && b.x+BALL_R>CENTER-halfNet && b.x-BALL_R<CENTER+halfNet){
    if (b.x<CENTER){ b.x=CENTER-halfNet-BALL_R; b.vx=-Math.abs(b.vx)*BALL_REST; }
    else           { b.x=CENTER+halfNet+BALL_R; b.vx= Math.abs(b.vx)*BALL_REST; }
    Sound.net();
  }
}

function stepBall(b, scoring){
  b.vy+=BALL_GRAV;
  const sp=Math.hypot(b.vx,b.vy); if (sp>BALL_MAX){ b.vx*=BALL_MAX/sp; b.vy*=BALL_MAX/sp; }
  b.x+=b.vx; b.y+=b.vy; b.spin+=b.vx*0.03;
  if (!reflectOffSlime(b,G.p1)) reflectOffSlime(b,G.p2);
  collideNet(b);
  if (b.y<BALL_R){ b.y=BALL_R; b.vy=-b.vy*BALL_REST; Sound.wall(); }
  if (b.x<BALL_R){ b.x=BALL_R; b.vx=-b.vx*BALL_REST; Sound.wall(); }
  if (b.x>W-BALL_R){ b.x=W-BALL_R; b.vx=-b.vx*BALL_REST; Sound.wall(); }
  if (b.y>GROUND-BALL_R){
    b.y=GROUND-BALL_R;
    if (scoring){ scorePoint(b.x<CENTER ? 1 : 0); }     // landed left -> right scores
    else { b.vy=-b.vy*BALL_REST*0.7; b.vx*=0.96; }       // attract: bounce, no score
  }
}

/* ----------------------------------------------------------------------------
   10. AI
   ---------------------------------------------------------------------------- */
function predictLanding(){
  let x=G.ball.x,y=G.ball.y,vx=G.ball.vx,vy=G.ball.vy;
  for(let f=0;f<200;f++){
    vy+=BALL_GRAV; if(vy>BALL_MAX)vy=BALL_MAX; x+=vx; y+=vy;
    if(x<BALL_R){x=BALL_R;vx=-vx*BALL_REST;}
    if(x>W-BALL_R){x=W-BALL_R;vx=-vx*BALL_REST;}
    if(y>NET_TOP && Math.abs(x-CENTER)<halfNet+BALL_R){ if(x<CENTER){x=CENTER-halfNet-BALL_R; vx=-Math.abs(vx)*BALL_REST;} else {x=CENTER+halfNet+BALL_R; vx=Math.abs(vx)*BALL_REST;} }
    if(y>GROUND-BALL_R) return { x, frames:f, side:x<CENTER?'left':'right' };
  }
  return { x, frames:200, side:x<CENTER?'left':'right' };
}
function effDiff(){ return G.attract ? 'normal' : (G.cup ? G.cup.diff : settings.diff); }
function computeAI(s){
  const lv=AI_LEVELS[effDiff()]||AI_LEVELS.normal, b=G.ball, left=s.side==='left';
  const myMin=left?SLIME_R*0.4:CENTER+halfNet+SLIME_R;
  const myMax=left?CENTER-halfNet-SLIME_R:W-SLIME_R*0.4;
  if ((s.aiReact=(s.aiReact||0)-1)>0) return s.aiInput;
  s.aiReact=lv.react;
  const onMySide=left?b.x<CENTER:b.x>CENTER;
  const land=predictLanding();
  const readyX=left?CENTER-NET_H*0.95:CENTER+NET_H*0.95;
  let target=readyX;
  if (land.side===(left?'left':'right')) target=land.x;
  else if (onMySide) target=b.x;
  if (lv.mistake) target+=(Math.random()-0.5)*230*lv.mistake;
  target=clamp(target,myMin,myMax);
  const dx=target-s.x;
  const inp={ left:dx<-9, right:dx>9, jump:false, down:false };
  const near=Math.abs(b.x-s.x)<SLIME_R+48;
  const strike=b.y>s.y-SLIME_R-78 && b.y<s.y-SLIME_R*0.2;
  if (onMySide && near && strike && s.onGround && Math.random()<0.55+lv.jump) inp.jump=true;
  const towardNet=left?(CENTER-b.x):(b.x-CENTER);
  if (!s.onGround && b.y<NET_TOP+22 && towardNet>0 && towardNet<250 && Math.random()<lv.attack) inp.down=true;
  s.aiInput=inp; return inp;
}
function assignInputs(){
  if (G.attract){ G.p1.input=computeAI(G.p1); G.p2.input=computeAI(G.p2); return; }
  G.p1.input=p1KeyInput();
  G.p2.input=(G.mode==='2p')?p2KeyInput():computeAI(G.p2);
}

/* ----------------------------------------------------------------------------
   11. Match flow
   ---------------------------------------------------------------------------- */
function resetPositions(){
  if(!G.p1||!G.p2) return;
  G.p1.x=W*0.25; G.p1.y=GROUND; G.p1.vy=0; G.p1.onGround=true; G.p1.squash=0;
  G.p2.x=W*0.75; G.p2.y=GROUND; G.p2.vy=0; G.p2.onGround=true; G.p2.squash=0;
}
function setupServe(server){
  G.server=server;
  G.serveX=server===0?W*0.27:W*0.73;
  G.serveBaseY=216;
  G.serveTimer=SERVE_FRAMES; G._srvPrev=true;
  resetPositions();
  G.ball.x=G.serveX; G.ball.y=G.serveBaseY; G.ball.vx=0; G.ball.vy=0; G.ball.spin=0;
  G.screen=SCREEN.SERVE; refreshUI();
}
function startMatch(){
  Sound.unlock();
  G.toWin=settings.toWin; G.score=[0,0]; G._matchWon=false; G.winner=0; G.attract=false;
  hideAllOverlays();
  setupServe(Math.random()<0.5?0:1);
}
function serveTick(){
  assignInputs(); updateSlime(G.p1); updateSlime(G.p2);
  const srv=G.server===0?G.p1:G.p2;
  const human=!G.attract && (G.server===0 || G.mode==='2p');
  const jumpNow=srv.input.jump;
  let serve=false;
  if (G.serveTimer<=0) serve=true;
  else if (human && jumpNow && !G._srvPrev) serve=true;
  else if (!human && (SERVE_FRAMES-G.serveTimer)>42) serve=true;
  G._srvPrev=jumpNow;
  G.ball.x=G.serveX; G.ball.y=G.serveBaseY+Math.sin(G.frame*0.06)*7; G.ball.vx=0; G.ball.vy=0;
  G.serveTimer--;
  if (serve){ G.screen=SCREEN.PLAY; G.ball.vy=2.4; G.ball.vx=G.server===0?0.6:-0.6; Sound.whistle(); spawnDust(G.ball.x,G.ball.y,7,'#fff'); }
}
function scorePoint(winner){
  G.score[winner]++; G.lastWinner=winner;
  G.flash=14; G.shake=Math.max(G.shake,7);
  spawnDust(G.ball.x,GROUND,16, winner===0?G.p1.team.color:G.p2.team.color);
  Sound.point();
  G._matchWon = G.score[winner] >= G.toWin;
  if (G._matchWon){ spawnConfetti(); Sound.win(); }
  G.screen=SCREEN.POINT; G.pointTimer=POINT_FRAMES;
}
function pointTick(){
  const b=G.ball; b.vx*=0.8; b.vy=0; b.y=GROUND-BALL_R;
  if (--G.pointTimer<=0){ if (G._matchWon) endMatch(); else setupServe(G.lastWinner); }
}
function endMatch(){
  G.winner=G.lastWinner; G.screen=SCREEN.OVER;
  if (G.cup){ advanceCup(); return; }
  showGameOver();
}

/* ----------------------------------------------------------------------------
   11b. Tournament (1-player knockout): quarter-final → semi-final → final,
   each round tougher. Plays out as a sequence of normal matches; the cup
   object tracks progress and the game-over screen shows next/win/out.
   ---------------------------------------------------------------------------- */
const CUP_ROUNDS = 3;
function ladderDiff(base, r){ const L=['easy','normal','hard','pro']; return L[clamp(L.indexOf(base)+r,0,L.length-1)]; }
function cupRoundName(r){ return t(['cupQF','cupSF','cupFinal'][r]||'cupFinal'); }
function startCup(){
  // pick 3 distinct opponents (not the player's team), seeded weakest → strongest
  const pool=TEAMS.filter(x=>x!==pickP1);
  for(let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const tmp=pool[i]; pool[i]=pool[j]; pool[j]=tmp; }
  const opp=pool.slice(0,CUP_ROUNDS).sort((a,b)=>a.strength-b.strength);
  G.cup={ base:settings.diff, diff:settings.diff, opp, round:0, playedRound:0, done:false, champ:false, _confetti:false };
  cupNextMatch();
}
function cupNextMatch(){
  const opp=G.cup.opp[G.cup.round];
  G.cup.diff=ladderDiff(G.cup.base, G.cup.round);
  pickP2=opp;
  G.p1=makeSlime('left',pickP1); G.p2=makeSlime('right',opp); G.ball=makeBall();
  startMatch();
}
function advanceCup(){
  const c=G.cup, won=(G.winner===0);
  c.playedRound=c.round;
  if (won) c.round++;
  c.champ = won && c.round>=CUP_ROUNDS;
  c.done  = (!won) || c.champ;
  showCupResult(won);
}
function showCupResult(won){
  const c=G.cup;
  $('lbSubmit').style.display='none';
  let title, sub;
  if (c.champ){
    title=t('cupChampion'); sub=t('cupChampSub',{team:teamName(pickP1)});
    if(!c._confetti){ spawnConfetti(); c._confetti=true; }
  } else if (!won){
    title=t('cupEliminated'); sub=t('cupOutSub',{round:cupRoundName(c.playedRound)});
  } else {
    title=t('cupWon',{round:cupRoundName(c.playedRound)});
    sub=t('cupNextSub',{round:cupRoundName(c.round), team:teamName(c.opp[c.round])});
  }
  $('overTitle').textContent=title;
  $('overSub').innerHTML=t('finalScore',{a:G.score[0],b:G.score[1]})+'<br>'+sub;
  $('overRematch').textContent = c.done ? t('cupNew') : t('cupNext');
  showOverlay('overScreen'); refreshUI();
}

function tick(){
  G.frame++;
  G.shake = G.shake>0.3 ? G.shake*0.86 : 0;
  if (G.flash>0) G.flash--;
  if (!G.paused){
    switch (G.screen){
      case SCREEN.MENU:  if (G.attract) attractTick(); break;
      case SCREEN.SERVE: serveTick(); break;
      case SCREEN.PLAY:  assignInputs(); updateSlime(G.p1); updateSlime(G.p2); stepBall(G.ball, true); break;
      case SCREEN.POINT: assignInputs(); updateSlime(G.p1); updateSlime(G.p2); pointTick(); break;
    }
  }
  updateParticles();
}

/* attract mode — two computers rally behind the menu */
function attractServe(){ const left=Math.random()<0.5; G.ball.x=left?W*0.28:W*0.72; G.ball.y=200; G.ball.vx=0; G.ball.vy=2; }
function attractTick(){
  assignInputs(); updateSlime(G.p1); updateSlime(G.p2);
  stepBall(G.ball, false);
  if (G.ball.y>=GROUND-BALL_R-1 && Math.abs(G.ball.vy)<2) attractServe();
}

/* ----------------------------------------------------------------------------
   12. Render
   ---------------------------------------------------------------------------- */
const crowdSeed=(()=>{ const a=[]; for(let i=0;i<300;i++) a.push({x:Math.random(), y:Math.random(), f:Math.random()*6.28, c:(Math.random()*6)|0}); return a; })();
const confettiSeed=(()=>{ const a=[]; for(let i=0;i<40;i++) a.push({x:Math.random(), y:Math.random(), sp:0.15+Math.random()*0.4, sw:0.4+Math.random()*1.2, c:(Math.random()*6)|0, r:Math.random()*6.28}); return a; })();
function FONT(px,w){ return (w||800)+' '+px+"px Rubik, system-ui, -apple-system, sans-serif"; }
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function lighten(hex,amt){ return shade(hex,amt); }
function darken(hex,amt){ return shade(hex,-amt); }
function shade(hex,amt){ const n=parseInt(hex.slice(1),16);
  let r=clamp((n>>16)+amt,0,255), g=clamp(((n>>8)&255)+amt,0,255), b=clamp((n&255)+amt,0,255);
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1); }

function render(){
  ctx.save();
  if (G.shake>0.5) ctx.translate((Math.random()-0.5)*G.shake,(Math.random()-0.5)*G.shake);
  drawArena();
  drawCourt();
  drawNet();
  if (G.ball) drawBall(G.ball);
  if (G.p1) drawSlime(G.p1);
  if (G.p2) drawSlime(G.p2);
  drawParticles();
  const inMatch=(G.screen===SCREEN.SERVE||G.screen===SCREEN.PLAY||G.screen===SCREEN.POINT||G.screen===SCREEN.OVER);
  if (inMatch && G.p1 && G.p2) drawScoreboard();
  if (G.screen===SCREEN.SERVE) drawServePrompt();
  if (G.screen===SCREEN.POINT) drawPointText();
  if (G.paused) drawPaused();
  ctx.restore();
  if (G.flash>0){ ctx.fillStyle=`rgba(255,255,255,${G.flash/16*0.45})`; ctx.fillRect(0,0,W,H); }
  if (settings.crt) drawCRT();
}

function drawArena(){
  const g=ctx.createLinearGradient(0,0,0,GROUND);
  g.addColorStop(0,'#f3f8ff'); g.addColorStop(0.45,'#dfeaf8'); g.addColorStop(1,'#bcd4ec'); // bright hall
  ctx.fillStyle=g; ctx.fillRect(0,0,W,GROUND+6);
  // ceiling trusses
  ctx.strokeStyle='rgba(120,140,170,0.30)'; ctx.lineWidth=3;
  for(let i=0;i<4;i++){ const y=20+i*9; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y-5); ctx.stroke(); }
  // hanging light panels + soft glow
  for(let i=0;i<6;i++){ const x=70+i*178;
    ctx.fillStyle='rgba(255,255,242,0.95)'; roundRect(x,10,92,15,6); ctx.fill();
    const gl=ctx.createRadialGradient(x+46,28,4,x+46,28,120); gl.addColorStop(0,'rgba(255,255,220,0.28)'); gl.addColorStop(1,'rgba(255,255,220,0)');
    ctx.fillStyle=gl; ctx.beginPath(); ctx.arc(x+46,28,120,0,7); ctx.fill(); }
  // stands — SlimeScore royal blue, with depth gradient
  const standTop=GROUND*0.30, standH=GROUND*0.40;
  const sg=ctx.createLinearGradient(0,standTop,0,standTop+standH);
  sg.addColorStop(0,'#34509f'); sg.addColorStop(1,'#1f2f6e');
  ctx.fillStyle=sg; ctx.fillRect(0,standTop,W,standH);
  ctx.fillStyle='#1a2a66'; ctx.fillRect(0,standTop,W,5);
  // tier step lines
  ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=1;
  for(let k=1;k<5;k++){ const y=standTop+standH*k/5; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  // audience (brand twinkle: orange/gold lead, blue/white/red/green pops)
  const tw=G.frame*0.05, cols=['#ff8a1e','#ffd23b','#ffffff','#2b6fff','#e63b2e','#34d17a'];
  for(const s of crowdSeed){ const cx=s.x*W, cy=standTop+8+s.y*(standH-16), a=0.65+0.35*Math.sin(tw+s.f);
    ctx.globalAlpha=a; ctx.fillStyle=cols[s.c]; ctx.fillRect(cx,cy,5,5); }
  ctx.globalAlpha=1;
  // sponsor board (scrolling), under the stands
  const boardY=standTop+standH, boardH=26;
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,boardY,W,boardH);
  ctx.fillStyle='#dfe7f1'; ctx.fillRect(0,boardY+boardH-3,W,3);
  ctx.save(); ctx.beginPath(); ctx.rect(0,boardY,W,boardH); ctx.clip();
  ctx.font=FONT(13,800); ctx.textAlign='left'; ctx.textBaseline='middle';
  const msg='SLIMESCORE   •   VOLLEYBALL   •   INDOOR RALLY   •   ';
  const mw=ctx.measureText(msg).width||1, scroll=(G.frame*1.0)%mw;
  const bcols=['#ff8a1e','#2b6fff','#ffc400','#e63b2e']; let bi=0;
  for(let x=-scroll;x<W;x+=mw){ ctx.fillStyle=bcols[bi++%bcols.length]; ctx.fillText(msg,x,boardY+boardH/2); }
  ctx.restore();
  // lower wall
  ctx.fillStyle='#bccde0'; ctx.fillRect(0,boardY+boardH,W,GROUND-(boardY+boardH));
  // drifting confetti over the hall (matches the SlimeScore vibe)
  const ccols=['#ff8a1e','#ffd23b','#ffffff','#2b6fff','#e63b2e','#34d17a'];
  for(const c of confettiSeed){
    const cy=((c.y + (G.frame*c.sp)/GROUND) % 1)*standTop, cx=(c.x*W + Math.sin(G.frame*0.02+c.r)*16);
    const w=4*c.sw, h=7*c.sw, rot=c.r+G.frame*0.03;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot); ctx.globalAlpha=0.85;
    ctx.fillStyle=ccols[c.c]; ctx.fillRect(-w/2,-h/2,w,h); ctx.restore();
  }
  ctx.globalAlpha=1;
  // soft vignette for depth
  const vg=ctx.createRadialGradient(CENTER,GROUND*0.5,GROUND*0.3,CENTER,GROUND*0.5,W*0.62);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(8,16,40,0.18)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,W,GROUND+6);
}

function drawCourt(){
  // taraflex floor: warm orange playing area + royal-blue free-zone edges (SlimeScore)
  ctx.fillStyle='#234aa0'; ctx.fillRect(0,GROUND,W,H-GROUND);
  const edge=W*0.05;
  ctx.fillStyle='#e06a32'; ctx.fillRect(edge,GROUND,W-edge*2,H-GROUND);
  ctx.fillStyle='rgba(0,0,0,0.14)'; ctx.fillRect(0,GROUND,W,4);
  // lines
  ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(CENTER,GROUND); ctx.lineTo(CENTER,H); ctx.stroke();           // centre line
  [CENTER-W*0.17, CENTER+W*0.17].forEach(x=>{ ctx.beginPath(); ctx.moveTo(x,GROUND); ctx.lineTo(x,H); ctx.stroke(); }); // attack lines
  ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=2;
  ctx.strokeRect(edge,GROUND+2,W-edge*2,H-GROUND-4);
}

function drawNet(){
  const x=CENTER, top=NET_TOP;
  // ground shadow under the net so it reads clearly
  ctx.fillStyle='rgba(0,0,0,0.10)'; ctx.beginPath(); ctx.ellipse(x,GROUND+5,NET_W*1.6,7,0,0,7); ctx.fill();
  // posts: solid navy uprights flanking the mesh — gives the net a clear silhouette
  ctx.fillStyle='#1f2d52';
  ctx.fillRect(x-halfNet-3,top-6,3,NET_H+6);
  ctx.fillRect(x+halfNet,   top-6,3,NET_H+6);
  // dark backing panel so the mesh contrasts against the bright hall
  ctx.fillStyle='rgba(22,34,66,0.16)'; ctx.fillRect(x-halfNet,top,NET_W,NET_H);
  // mesh — darker, denser, high-contrast
  ctx.save(); ctx.strokeStyle='rgba(18,28,58,0.55)'; ctx.lineWidth=1.2;
  for(let yy=top+5;yy<=GROUND;yy+=6){ ctx.beginPath(); ctx.moveTo(x-halfNet,yy); ctx.lineTo(x+halfNet,yy); ctx.stroke(); }
  for(let xx=-halfNet+2;xx<=halfNet;xx+=3.5){ ctx.beginPath(); ctx.moveTo(x+xx,top+4); ctx.lineTo(x+xx,GROUND); ctx.stroke(); }
  ctx.restore();
  // bold white tape on top (the bit you aim over)
  ctx.fillStyle='#ffffff'; ctx.fillRect(x-halfNet-4,top-9,NET_W+8,9);
  ctx.strokeStyle='#9fb0c6'; ctx.lineWidth=1.5; ctx.strokeRect(x-halfNet-4,top-9,NET_W+8,9);
  // antenna (red/white) rising from the tape
  for(let k=0;k<5;k++){ ctx.fillStyle=k%2?'#ffffff':'#e23b2e'; ctx.fillRect(x-1.5,top-46+k*9,3,9); }
  // base anchor
  ctx.fillStyle='#1f2d52'; ctx.fillRect(x-halfNet-4,GROUND-4,NET_W+8,6);
}

function drawSlime(s){
  const r=SLIME_R, sx=1+s.squash*0.6, sy=1-s.squash*0.6;
  ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(s.x,GROUND+5,r*0.85,9,0,0,7); ctx.fill();
  ctx.save(); ctx.translate(s.x,s.y); ctx.scale(sx,sy);
  const g=ctx.createRadialGradient(-r*0.32,-r*0.55,r*0.12, 0,-r*0.10,r*1.18);
  g.addColorStop(0,lighten(s.team.color,55)); g.addColorStop(0.45,s.team.color); g.addColorStop(1,darken(s.team.color,44));
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,r,Math.PI,0); ctx.closePath(); ctx.fill();
  ctx.fillStyle=s.team.trim; ctx.globalAlpha=0.92;
  ctx.beginPath(); ctx.arc(0,0,r-3,Math.PI,0); ctx.arc(0,0,r-8,0,Math.PI,true); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
  ctx.lineJoin='round'; ctx.strokeStyle=darken(s.team.color,52); ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(0,0,r-1.2,Math.PI,0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r+1,0); ctx.lineTo(r-1,0); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-r*0.38,-r*0.54,r*0.19,r*0.10,-0.6,0,7); ctx.fill();
  ctx.restore();
  const eyeY=s.y-r*0.55, eyeX=s.x+(s.side==='left'?14:-14);
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(eyeX,eyeY,12,0,7); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(eyeX,eyeY,12,0,7); ctx.stroke();
  const px=eyeX+s.eyeX*5, py=eyeY+s.eyeY*5;
  ctx.fillStyle='#0a0a16'; ctx.beginPath(); ctx.arc(px,py,6,0,7); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(px-2,py-2,1.8,0,7); ctx.fill();
}

function drawBall(b){
  const sh=clamp(1-(GROUND-b.y)/360,0.12,1);
  ctx.fillStyle=`rgba(0,0,0,${0.24*sh})`; ctx.beginPath(); ctx.ellipse(b.x,GROUND+4,BALL_R*sh,5*sh,0,0,7); ctx.fill();
  ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.spin);
  ctx.fillStyle='#fbfbfb'; ctx.beginPath(); ctx.arc(0,0,BALL_R,0,7); ctx.fill();
  // Mikasa-style panels: blue + yellow curved bands
  ctx.save(); ctx.beginPath(); ctx.arc(0,0,BALL_R,0,7); ctx.clip();
  ctx.lineWidth=BALL_R*0.5; ctx.lineCap='round';
  ctx.strokeStyle='#1f6fd6'; ctx.beginPath(); ctx.arc(-BALL_R*0.9,-BALL_R*0.2,BALL_R*1.1,-0.4,1.2); ctx.stroke();
  ctx.strokeStyle='#ffd23b'; ctx.beginPath(); ctx.arc(BALL_R*0.9,BALL_R*0.3,BALL_R*1.1,2.0,3.8); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle='#cdcdcd'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(0,0,BALL_R,0,7); ctx.stroke();
  ctx.strokeStyle='rgba(120,120,120,0.5)'; ctx.beginPath(); ctx.arc(0,0,BALL_R*0.55,-0.6,2.4); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-BALL_R*0.35,-BALL_R*0.4,BALL_R*0.18,0,7); ctx.fill();
  ctx.restore();
}

function drawParticles(){
  for(const p of G.particles){ const a=clamp(p.life/p.max,0,1); ctx.globalAlpha=a; ctx.fillStyle=p.col;
    if (p.conf){ ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillRect(-p.r,-p.r*0.6,p.r*2,p.r*1.2); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); } }
  ctx.globalAlpha=1;
}

function drawMiniFlag(team,x,y,w,h){
  const img=flagImage(team.code);
  if (img && img.complete && img.naturalWidth){ ctx.drawImage(img,x,y,w,h); }
  else { const st=team.stripes; for(let i=0;i<st.length;i++){ ctx.fillStyle=st[i]; ctx.fillRect(x,y+i*(h/st.length),w,h/st.length+0.5); } }
  ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h);
}
function drawScoreboard(){
  const SC=2, w=232*SC, h=54*SC, x=CENTER-w/2, y=12;
  ctx.fillStyle='rgba(9,16,48,0.88)'; roundRect(x,y,w,h,10*SC); ctx.fill();
  ctx.strokeStyle='#3a52aa'; ctx.lineWidth=2; roundRect(x,y,w,h,10*SC); ctx.stroke();
  drawMiniFlag(G.p1.team, x+10*SC, y+11*SC, 40*SC, 27*SC);
  drawMiniFlag(G.p2.team, x+w-50*SC, y+11*SC, 40*SC, 27*SC);
  ctx.textBaseline='alphabetic'; ctx.font=FONT(12*SC,800); ctx.textAlign='center';
  ctx.fillStyle=G.p1.team.color; ctx.fillText(G.p1.team.code, x+30*SC, y+50*SC);
  ctx.fillStyle=G.p2.team.color; ctx.fillText(G.p2.team.code, x+w-30*SC, y+50*SC);
  // serve dot next to the serving side
  if (G.screen===SCREEN.SERVE){ ctx.fillStyle='#ffd23b';
    ctx.beginPath(); ctx.arc(G.server===0?x+54*SC:x+w-54*SC, y+20*SC, 3.5*SC, 0,7); ctx.fill(); }
  ctx.fillStyle='#fff'; ctx.font=FONT(28*SC,900);
  ctx.fillText(G.score[0]+' - '+G.score[1], CENTER, y+38*SC);
  ctx.font=FONT(11*SC,700); ctx.fillStyle='#ffd23b';
  const sbSub=(G.cup?cupRoundName(G.cup.round).toUpperCase()+' · ':'')+t('firstTo').toUpperCase()+' '+G.toWin;
  ctx.fillText(sbSub, CENTER, y+h+13*SC);
}
function drawServePrompt(){
  const who = G.attract ? '' : (G.mode==='2p' ? t('servePlayer',{n:G.server+1}) : (G.server===0?t('serveYou'):t('serveCpu')));
  if (!who) return;
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.fillStyle='#13315c'; ctx.font=FONT(20,900); ctx.fillText(who, G.serveX, G.serveBaseY-44);
  const secs=Math.ceil(G.serveTimer/60);
  ctx.fillStyle='rgba(20,40,70,0.8)'; ctx.font=FONT(12,700);
  ctx.fillText(t('serveHint',{n:secs}), G.serveX, G.serveBaseY-26);
}
function drawPointText(){
  const tm=G.lastWinner===0?G.p1.team:G.p2.team;
  ctx.textAlign='center'; const wob=Math.sin(G.frame*0.4)*5;
  ctx.save(); ctx.translate(CENTER,H*0.34); ctx.rotate(wob*0.004);
  ctx.fillStyle=tm.color; ctx.font=FONT(46,900);
  ctx.fillText(t('pointFor',{team:teamName(tm).toUpperCase()}),0,wob);
  ctx.restore();
}
function drawPaused(){
  ctx.fillStyle='rgba(8,12,24,0.55)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font=FONT(42,900); ctx.fillText(t('paused'),CENTER,H*0.42);
  ctx.font=FONT(13,700); ctx.fillStyle='#cdd8ec'; ctx.fillText('ESC',CENTER,H*0.52);
}
function drawCRT(){
  ctx.globalAlpha=0.08; ctx.fillStyle='#000';
  for(let y=0;y<H;y+=3) ctx.fillRect(0,y,W,1);
  ctx.globalAlpha=1;
}

/* ----------------------------------------------------------------------------
   13. Main loop (fixed timestep)
   ---------------------------------------------------------------------------- */
let acc=0, last=0; const STEP=1000/60;
function frame(ts){
  if (!last) last=ts;
  acc+=ts-last; last=ts; if (acc>250) acc=250;
  let steps=0; while (acc>=STEP && steps<5){ tick(); acc-=STEP; steps++; }
  render(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ----------------------------------------------------------------------------
   14. UI / screen management (DOM overlays)
   ---------------------------------------------------------------------------- */
const $ = id => document.getElementById(id);
function hideAllOverlays(){ document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show')); }
function showOverlay(id){ hideAllOverlays(); const el=$(id); if(el) el.classList.add('show'); }
function refreshUI(){
  const inMatch=(G.screen===SCREEN.SERVE||G.screen===SCREEN.PLAY||G.screen===SCREEN.POINT) && !G.paused;
  document.body.classList.toggle('deskgame', !IS_TOUCH && (G.screen===SCREEN.SERVE||G.screen===SCREEN.PLAY||G.screen===SCREEN.POINT));
  $('touch').classList.toggle('show', IS_TOUCH && inMatch);
  $('pad2').style.display=(G.mode==='2p')?'flex':'none';
  document.body.classList.toggle('m2p', G.mode==='2p');
  refreshBtnZones();
  const hint=$('playHint');
  hint.innerHTML=(G.mode==='2p')?t('playHint2p'):t('playHint');
  hint.style.display=(inMatch && !IS_TOUCH)?'block':'none';
  $('quitBtn').classList.toggle('show', inMatch);
  $('muteBtn').classList.toggle('show', inMatch);
  $('rulesBtn').classList.toggle('show', inMatch);
  updateRotateHint();
}
function updateRotateHint(){
  const portrait=matchMedia('(orientation:portrait)').matches, small=Math.min(innerWidth,innerHeight)<760;
  const inMatch=(G.screen===SCREEN.SERVE||G.screen===SCREEN.PLAY||G.screen===SCREEN.POINT);
  $('rotate').classList.toggle('show', portrait && small && inMatch);
}
addEventListener('resize', ()=>{ refreshBtnZones(); updateRotateHint(); });
addEventListener('orientationchange', ()=>setTimeout(()=>{ refreshBtnZones(); updateRotateHint(); },120));

/* ---- Pause ---- */
function togglePause(){
  if (!(G.screen===SCREEN.SERVE||G.screen===SCREEN.PLAY||G.screen===SCREEN.POINT)) return;
  G.paused=!G.paused;
  if (G.paused) showOverlay('pauseScreen'); else hideAllOverlays();
  refreshUI();
}
function quitToMenu(){
  G.paused=false; G.attract=true; G.screen=SCREEN.MENU; G.cup=null;
  initAttract();
  showOverlay('menuScreen'); refreshUI();
}

/* ---- Team select ---- */
let pickStage=0, pickP1=null, pickP2=null;
function buildTeamGrid(){
  const grid=$('teamGrid'); grid.innerHTML='';
  TEAMS.slice().sort((a,b)=>teamName(a).localeCompare(teamName(b), settings.lang)).forEach(tm=>{
    const el=document.createElement('div');
    el.className='team'+(tm.featured?' featured':'');
    el.dataset.code=tm.code;
    el.innerHTML=`<div class="flag" style="background:${tm.flag}"></div><div class="code">${tm.code}</div>`;
    el.onclick=()=>pickTeam(tm,el);
    grid.appendChild(el);
  });
}
function pickTeam(tm,el){
  if (el && el.classList.contains('taken')) return;
  Sound.click();
  document.querySelectorAll('.team').forEach(e=>e.classList.remove('sel'));
  el.classList.add('sel');
  if (pickStage===0){
    pickP1=tm;
    if (G.mode==='cup'){
      startCup();
    } else if (G.mode==='1p'){
      const others=TEAMS.filter(x=>x!==tm); pickP2=others[(Math.random()*others.length)|0];
      launchLocal();
    } else {
      pickStage=1; $('pickLabel').innerHTML=t('pickP2'); el.classList.add('taken');
      setTimeout(()=>document.querySelectorAll('.team').forEach(e=>{ if(!e.classList.contains('taken')) e.classList.remove('sel'); }),120);
    }
  } else {
    if (tm===pickP1) return;
    pickP2=tm; launchLocal();
  }
}
function launchLocal(){
  G.p1=makeSlime('left',pickP1); G.p2=makeSlime('right',pickP2); G.ball=makeBall();
  startMatch();
}
function goTeam(){
  pickStage=0; pickP1=null; pickP2=null;
  $('pickLabel').innerHTML = G.mode==='2p' ? t('pickP1') : t('pickYourCountry');
  buildTeamGrid(); showOverlay('teamScreen');
}

/* ---- Match setup (level + points-to-win) ---- */
function openSetup(mode){
  G.cup=null; G.mode=mode; Sound.click();
  $('setupTitle').textContent = mode==='2p' ? t('setupTitle2p') : mode==='cup' ? t('setupTitleCup') : t('setupTitle1p');
  $('setupSub').textContent   = mode==='2p' ? t('setupSub2p')   : mode==='cup' ? t('setupSubCup')   : t('setupSub');
  $('setupDiffWrap').style.display = mode==='2p' ? 'none' : 'flex';
  buildSetupRows();
  showOverlay('setupScreen');
}
function buildSetupRows(){
  const diffs=['easy','normal','hard','pro'];
  $('setupDiffRow').innerHTML = diffs.map(d=>`<button class="pill mode${d===settings.diff?' active':''}" data-d="${d}">${aiLabel(d)}</button>`).join('');
  $('setupDiffRow').querySelectorAll('button').forEach(b=>b.onclick=()=>{ settings.diff=b.dataset.d; store.save('diff',settings.diff); buildSetupRows(); Sound.click(); });
  const wins=[3,5,7];
  $('setupWinRow').innerHTML = wins.map(n=>`<button class="pill mode${n===settings.toWin?' active':''}" data-n="${n}">${n}</button>`).join('');
  $('setupWinRow').querySelectorAll('button').forEach(b=>b.onclick=()=>{ settings.toWin=+b.dataset.n; store.save('toWin',settings.toWin); buildSetupRows(); Sound.click(); });
}

/* ---- Settings ---- */
function updateSettingsUI(){
  $('tSound').querySelector('.val').textContent = settings.sound?t('on'):t('off');
  $('tCrt').querySelector('.val').textContent   = settings.crt?t('on'):t('off');
  $('tWin').querySelector('.val').textContent   = String(settings.toWin);
  $('tDiff').querySelector('.val').textContent  = aiLabel(settings.diff);
  $('tLang').querySelector('.val').textContent  = settings.lang.toUpperCase();
  $('tSound').querySelector('.lbl').textContent = t('sound');
  $('tCrt').querySelector('.lbl').textContent   = t('crt');
  $('tWin').querySelector('.lbl').textContent   = t('firstTo');
  $('tDiff').querySelector('.lbl').textContent  = t('computerLevel');
  $('tLang').querySelector('.lbl').textContent  = t('language');
  $('volRange').value = Math.round(settings.volume*100);
  $('muteBtn').textContent = settings.sound?'🔊':'🔇';
  $('btnSound').textContent = settings.sound?'🔊':'🔇';
}

/* ---- Game over + Slimescore ---- */
let lastRun=null;
function showGameOver(){
  const left=G.score[0], right=G.score[1], youWon=(G.mode!=='2p' && G.winner===0);
  let title;
  if (G.mode==='2p') title=t('playerWins',{n:G.winner+1});
  else title=G.winner===0 ? t('youWin') : t('cpuWins');
  $('overRematch').textContent=t('rematch');
  $('overTitle').textContent=title;
  $('overSub').innerHTML=t('finalScore',{a:left,b:right});
  // leaderboard submit only for a 1-player win
  const canSubmit = youWon && window.Leaderboard && window.Leaderboard.enabled;
  $('lbSubmit').style.display = canSubmit ? 'flex' : 'none';
  if (canSubmit){
    lastRun={ team:G.p1.team.code, diff:settings.diff, toWin:G.toWin, sf:left, sa:right,
              points: volleyPoints(settings.diff,G.toWin,left,right) };
    $('lbName').value = store.load('name','') || '';
    $('lbStatus').textContent='';
    $('lbSend').disabled=false;
    $('lbSend').textContent=t('submit');
  } else { lastRun=null; }
  showOverlay('overScreen'); refreshUI();
}
// client-side mirror of the server points formula (server recomputes on submit)
function volleyPoints(diff,toWin,sf,sa){
  const base={easy:5,normal:12,hard:22,pro:36}[diff]||12;
  return clamp(Math.round(base*toWin + Math.max(0,sf-sa)*4), 0, 99999);
}
async function submitScore(){
  if (!lastRun || !window.Leaderboard) return;
  const name=($('lbName').value||'').trim().slice(0,20)||'Anonymous';
  store.save('name', name);
  $('lbSend').disabled=true; $('lbStatus').textContent=t('submitting'); $('lbStatus').className='status';
  const pts=await window.Leaderboard.submit({ name, team:lastRun.team, diff:lastRun.diff, toWin:lastRun.toWin, sf:lastRun.sf, sa:lastRun.sa });
  if (pts==null){ $('lbStatus').textContent=t('submitFail'); $('lbStatus').className='status err'; $('lbSend').disabled=false; return; }
  $('lbStatus').textContent=t('submittedOk'); $('lbStatus').className='status ok';
  $('lbSend').textContent=t('submitted');
  showSlimescore(name, pts);
}
async function showSlimescore(youName, youPts){
  showOverlay('lbScreen');
  const box=$('lbList'); box.innerHTML=t('loading');
  await ensureLeaderboard();
  if (!window.Leaderboard || !window.Leaderboard.enabled){ box.innerHTML=`<div class="status">${t('lbNA')}</div>`; return; }
  let rows=null, rank=null;
  try { rows=await window.Leaderboard.top(12); } catch(e){}
  if (youPts!=null){ try { rank=await window.Leaderboard.rank(youPts); } catch(e){} }
  if (rows==null){ box.innerHTML=`<div class="status err">${t('lbFail')}</div>`; return; }
  if (!rows.length){ box.innerHTML=`<div class="status">${t('lbNone')}</div>`; return; }
  let html='';
  if (youPts!=null && rank!=null) html+=`<div class="lb-you">${t('yourPos',{n:rank,p:youPts})}</div>`;
  rows.forEach((r,i)=>{
    const tm=teamByCode(r.team), you=(youName!=null && r.name===youName && r.points===youPts && rank===i+1);
    html+=`<div class="lb-row${i===0?' top':''}${you?' you':''}">`+
      `<span class="rank">#${i+1}</span>`+
      `<span class="who">${escapeHtml(r.name||'?')} <span class="tcode">${escapeHtml(teamName(tm))}</span></span>`+
      `<span class="sc">${r.points} ${t('pts')}</span></div>`;
  });
  box.innerHTML=html;
}

/* ---- Rules ---- */
let rulesFrom='menu';
function openRules(from){ rulesFrom=from||'menu'; Sound.click(); if (from==='game'){ if(!G.paused) togglePause(); } showOverlay('rulesScreen'); }
function closeRules(){ if (rulesFrom==='game'){ showOverlay('pauseScreen'); } else { showOverlay('menuScreen'); } }

/* ---- Share ---- */
function shareGame(){
  Sound.click();
  const url=location.origin+location.pathname, title='Slime Volleyball 🏐';
  if (navigator.share){ navigator.share({title, text:title, url}).catch(()=>{}); }
  else { try { navigator.clipboard.writeText(url); $('shareMsg') && ($('shareMsg').textContent='copied!'); } catch(e){} }
}

/* ---- Attract (menu backdrop) ---- */
function initAttract(){
  const a=TEAMS[(Math.random()*TEAMS.length)|0];
  let b=a; while(b===a) b=TEAMS[(Math.random()*TEAMS.length)|0];
  G.p1=makeSlime('left',a); G.p2=makeSlime('right',b); G.ball=makeBall();
  G.attract=true; G.screen=SCREEN.MENU; attractServe();
}

/* ----------------------------------------------------------------------------
   15. Wire up the DOM
   ---------------------------------------------------------------------------- */
function bind(id, fn){ const el=$(id); if(el) el.addEventListener('click', fn); }
function boot(){
  applyStaticI18n(); updateSettingsUI();
  // menu
  bind('btn1p', ()=>{ Sound.unlock(); openSetup('1p'); });
  bind('btn2p', ()=>{ Sound.unlock(); openSetup('2p'); });
  bind('btnCup', ()=>{ Sound.unlock(); openSetup('cup'); });
  bind('btnSound', ()=>{ settings.sound=!settings.sound; store.save('sound',settings.sound); Sound.unlock(); updateSettingsUI(); });
  bind('btnShare', shareGame);
  bind('btnLeaders', ()=>{ Sound.click(); ensureLeaderboard(); showSlimescore(null,null); });
  bind('btnRules', ()=>openRules('menu'));
  bind('btnSettings', ()=>{ Sound.click(); updateSettingsUI(); showOverlay('setScreen'); });
  // setup
  bind('setupPlay', ()=>{ Sound.click(); goTeam(); });
  bind('setupBack', ()=>{ Sound.click(); showOverlay('menuScreen'); });
  $('setupPlay').textContent=t('continueTeams');
  // team
  bind('teamBack', ()=>{ Sound.click(); showOverlay('setupScreen'); });
  // settings toggles
  bind('tSound', ()=>{ settings.sound=!settings.sound; store.save('sound',settings.sound); Sound.unlock(); updateSettingsUI(); });
  bind('tCrt',   ()=>{ settings.crt=!settings.crt; store.save('crt',settings.crt); updateSettingsUI(); });
  bind('tWin',   ()=>{ const o=[3,5,7]; settings.toWin=o[(o.indexOf(settings.toWin)+1)%o.length]; store.save('toWin',settings.toWin); updateSettingsUI(); });
  bind('tDiff',  ()=>{ const o=['easy','normal','hard','pro']; settings.diff=o[(o.indexOf(settings.diff)+1)%o.length]; store.save('diff',settings.diff); updateSettingsUI(); });
  bind('tLang',  ()=>{ settings.lang=settings.lang==='nl'?'en':'nl'; store.save('lang',settings.lang); applyStaticI18n(); updateSettingsUI(); $('setupPlay').textContent=t('continueTeams'); });
  $('volRange').addEventListener('input', e=>{ settings.volume=clamp01(e.target.value/100); store.save('volume',settings.volume); Sound.setVol(settings.volume); });
  bind('setBack', ()=>{ Sound.click(); showOverlay('menuScreen'); });
  // over
  bind('overRematch', ()=>{ Sound.click();
    if (G.cup){ if (G.cup.done) startCup(); else cupNextMatch(); }
    else if (G.mode==='2p'){ launchLocal(); }
    else { goTeam(); }
  });
  bind('overLeaders', ()=>{ Sound.click(); ensureLeaderboard(); showSlimescore(null,null); });
  bind('overMenu', ()=>{ Sound.click(); quitToMenu(); });
  bind('lbSend', submitScore);
  // slimescore cross-promo
  bind('lbBack', ()=>{ Sound.click(); showOverlay(G.screen===SCREEN.OVER?'overScreen':'menuScreen'); });
  bind('crossSoccer', ()=>Sound.click());
  // rules
  bind('rulesBack', ()=>{ Sound.click(); closeRules(); });
  // pause
  bind('pauseResume', ()=>{ Sound.click(); togglePause(); });
  bind('pauseQuit', ()=>{ Sound.click(); quitToMenu(); });
  bind('quitBtn', ()=>togglePause());
  bind('stagePause', ()=>togglePause());
  bind('stageQuit', ()=>quitToMenu());
  bind('muteBtn', ()=>{ settings.sound=!settings.sound; store.save('sound',settings.sound); Sound.unlock(); updateSettingsUI(); });
  bind('rulesBtn', ()=>openRules('game'));
  // start on the menu with a live rally behind it
  initAttract();
  showOverlay('menuScreen'); refreshUI();
}

/* lazily load leaderboard.js the first time the Slimescore is opened (kept off the
   initial render path). Returns a promise that resolves once window.Leaderboard exists. */
let _lbPromise=null;
function ensureLeaderboard(){
  if (window.Leaderboard) return Promise.resolve();
  if (!_lbPromise) _lbPromise=new Promise(res=>{
    const s=document.createElement('script'); s.src='leaderboard.js'; s.async=true;
    s.onload=()=>res(); s.onerror=()=>res(); document.head.appendChild(s);
  });
  return _lbPromise;
}

if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();

/* ----------------------------------------------------------------------------
   16. Test/debug hooks (localhost or ?debug=1 only)
   ---------------------------------------------------------------------------- */
if (typeof location!=='undefined' && (location.hostname==='localhost' || location.hostname==='127.0.0.1' || (location.search||'').includes('debug=1'))){
  window.__G=G; window.__TEAMS=TEAMS;
  window.__TEST={ startMatch, setupServe, scorePoint, volleyPoints, predictLanding, computeAI, startCup, cupNextMatch, advanceCup, ladderDiff, SCREEN, settings, G };
}
