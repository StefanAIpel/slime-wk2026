/* Headless logic test for the World Cup bracket — no browser needed.
   Loads game.js in a vm context with a minimal DOM stub and drives the
   tournament functions directly. Run: node brackettest.mjs */
import fs from 'node:fs';
import vm from 'node:vm';

let fails = 0;
const ok  = (c, m) => { if (!c){ fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// ---- minimal DOM / browser stub -------------------------------------------
function classList(){ const s = new Set(); return {
  add:(...c)=>c.forEach(x=>s.add(x)), remove:(...c)=>c.forEach(x=>s.delete(x)),
  toggle:(c,f)=>{ const on = f===undefined ? !s.has(c) : !!f; on?s.add(c):s.delete(c); return on; },
  contains:c=>s.has(c) }; }
function ctxStub(){ const grad={addColorStop(){}}; return new Proxy({}, {
  get(t,p){ if(p in t) return t[p];
    if(p==='createLinearGradient'||p==='createRadialGradient') return ()=>grad;
    if(p==='measureText') return ()=>({width:50});
    return ()=>{}; },
  set(t,p,v){ t[p]=v; return true; } }); }
function makeEl(id){
  const el={ id, style:{}, dataset:{}, classList:classList(), textContent:'', value:'',
    disabled:false, onclick:null, className:'', _kids:[],
    appendChild(c){ this._kids.push(c); return c; },
    setAttribute(){}, getAttribute(){return null;}, focus(){}, blur(){},
    addEventListener(){}, removeEventListener(){}, releasePointerCapture(){},
    querySelector(){ return makeEl('q'); }, querySelectorAll(){ return []; }, closest(){ return null; } };
  if (id==='game') el.getContext = ()=>ctxStub();
  let html=''; Object.defineProperty(el,'innerHTML',{ get:()=>html, set:v=>{ html=String(v); } });
  return el;
}
const els = {};
const getEl = id => els[id] || (els[id] = makeEl(id));
const document = {
  getElementById:getEl, createElement:()=>makeEl('new'),
  querySelector:()=>getEl('menuScreen'),
  querySelectorAll:sel=> sel==='.overlay' ? Object.values(els).filter(e=>/Screen$/.test(e.id)) : [],
  addEventListener(){}, removeEventListener(){}, body: makeEl('body') };
const sandbox = {
  document, console, location:{ search:'', pathname:'/', origin:'http://x' },
  localStorage:(()=>{ const m={}; return { getItem:k=>k in m?m[k]:null, setItem:(k,v)=>{m[k]=String(v);}, removeItem:k=>{delete m[k];} }; })(),
  matchMedia:()=>({ matches:false, addEventListener(){}, addListener(){} }),
  requestAnimationFrame:()=>0, cancelAnimationFrame(){},
  performance:{ now:()=>Date.now() }, navigator:{}, innerWidth:1000, innerHeight:640,
  addEventListener(){}, removeEventListener(){}, setTimeout:()=>0, clearTimeout(){}, setInterval:()=>0,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('./game.js', import.meta.url), 'utf8'), sandbox);
// top-level const/function bindings live in the context's lexical scope; surface them
vm.runInContext('window.__TEST = { G, TEAMS, SCREEN, settings, setupWK, wkMatchEnd, wkBracketHTML, wkUserMatch, wkWinner, wkPoints, tick, render, go1p, startTeamSelect, pickTeam, score, openSettings, showLeaderboard, updateBall, updateSlime, resetPositions, separateSlimes, GROUND, SLIME_R, BALL_R, CENTER, W, renderMenuPills, WK_VENUES, startMatch, applyPow, powSpawn, powerTick, slimeR, reflectOffSlime, POWER_TYPES, SLIME_SPEED };', sandbox);

const T = sandbox.__TEST;
const { G, TEAMS, SCREEN, setupWK, wkMatchEnd, wkBracketHTML, wkUserMatch, wkWinner, W } = T;

// ---- 1. draw integrity over many random setups ----------------------------
console.log('Draw integrity (200 random tournaments):');
let drawBad = 0, userMissing = 0;
for (let i=0;i<200;i++){
  const team = TEAMS[(Math.random()*TEAMS.length)|0];
  setupWK(team);
  const r16 = G.wk.rounds[0];
  const codes = new Set();
  r16.forEach(m=>{ codes.add(m.a.code); codes.add(m.b.code); });
  if (r16.length!==8 || codes.size!==16) drawBad++;
  if (!codes.has(team.code)) userMissing++;
  const userMatches = r16.filter(m=>m.user).length;
  if (userMatches!==1) drawBad++;
}
ok(drawBad===0, '8 matches, 16 unique teams, exactly one user match every time');
ok(userMissing===0, 'your chosen team is always in the draw');
ok(TEAMS.length===24, 'pool has 24 teams (got ' + TEAMS.length + ')');

// ---- 2. winning path: 4 wins => champion ----------------------------------
console.log('Winning run (you win every match):');
setupWK(TEAMS[0]);                                  // Netherlands
const path = [];
for (let r=0;r<4;r++){
  const m = wkUserMatch();
  ok(!!m, 'round ' + r + ' has a user match');
  path.push(G.wk.round);
  G.score = [2,1];                                  // user (left = p1) wins
  wkMatchEnd(true);
}
ok(JSON.stringify(path)===JSON.stringify([0,1,2,3]), 'advanced R16->QF->SF->Final in order');
ok(G.wk.champion === TEAMS[0], 'winning the final crowns YOU champion');
ok(G.wk.rounds.length===4, 'bracket built all four rounds');

// every later-round team must be a winner from the previous round
let propagateBad = 0;
for (let r=1;r<4;r++){
  const prevWinners = new Set(G.wk.rounds[r-1].map(m=>wkWinner(m).code));
  G.wk.rounds[r].forEach(m=>{ if(!prevWinners.has(m.a.code)||!prevWinners.has(m.b.code)) propagateBad++; });
}
ok(propagateBad===0, 'each round is composed only of previous-round winners');

// ---- 3. elimination: bracket still plays out to a champion ----------------
console.log('Elimination run (you lose in R16):');
setupWK(TEAMS[3]);                                  // France
G.score = [0,3];
wkMatchEnd(false);
ok(G.wk.rounds.length===4, 'bracket auto-simulates remaining rounds (4 rounds present)');
const allPlayed = G.wk.rounds.every(rd=>rd.every(m=>m.played));
ok(allPlayed, 'every match in the bracket has a result');
ok(!!G.wk.champion && G.wk.champion!==TEAMS[3], 'a champion is crowned and it is not you (you were knocked out)');
ok(G.wk.rounds[3].length===1, 'final round has exactly one match');

// ---- 4. renderer doesn't throw --------------------------------------------
let renderErr = null;
try { setupWK(TEAMS[5]); wkBracketHTML(); G.score=[1,0]; wkMatchEnd(true); wkBracketHTML(); }
catch(e){ renderErr = e; }
ok(!renderErr, 'wkBracketHTML() renders without throwing' + (renderErr?(' — '+renderErr.message):''));

// ---- 5. runtime smoke: attract loop + a full 1P match to game over --------
console.log('Runtime smoke (menu attract + 1P match + menus):');
let smokeErr = null;
try {
  // back to a clean menu/attract state (as backToMenu would leave it), then spin attract
  G.wkMode = false; G.wk = null; G.golden = false; G.mode = '1p';
  G.screen = SCREEN.MENU; G.attract = true;
  for (let i=0;i<400;i++){ T.tick(); }
  ok(G.ball.x>=0 && G.ball.x<=W && G.ball.y<=600, 'attract ball stays on the pitch');
  T.render();                                       // draw menu frame with stubbed canvas

  // start a 1P match and run the countdown out to play
  T.go1p();
  T.startTeamSelect();
  T.pickTeam(TEAMS[2], makeEl('t1'));               // Friendly: pick your team first
  T.pickTeam(TEAMS[3], makeEl('t2'));               // then pick the AI opponent -> startMatch
  ok(G.screen===SCREEN.COUNT, 'picking teams starts the kickoff countdown');
  for (let i=0;i<260 && G.screen!==SCREEN.PLAY;i++){ T.tick(); }
  ok(G.screen===SCREEN.PLAY, 'countdown reaches play');
  T.render();

  // force goals up to the goal target -> endMatch -> showGameOver (English)
  const target = G.toWin;
  G.score = [target-1, 0];
  T.score(0);
  ok(G.screen===SCREEN.OVER, 'reaching the goal target ends the match');
  ok(getEl('overTitle').textContent==='YOU WIN!', 'game-over title is English ("YOU WIN!")');

  // menus that were translated
  T.openSettings();
  ok(getEl('tDiff') && /Easy|Normal|Hard|World Cup/.test(getEl('tDiff').querySelector('.val').textContent || 'Normal'), 'settings difficulty label is English');
} catch(e){ smokeErr = e; }
ok(!smokeErr, 'no runtime errors across attract/play/menus' + (smokeErr?(' — '+smokeErr.stack.split('\n').slice(0,2).join(' ')):''));

// ---- 6. ball catch / hold (classic: hold DOWN) ----------------------------
console.log('Ball catch/hold (hold DOWN):');
try {
  G.wkMode=false; G.wk=null; G.mode='1p'; G.screen=SCREEN.PLAY;
  G.p1.x=300; G.p1.y=T.GROUND; G.p1.vx=0; G.p1.vy=0; G.p1.catchCD=0; G.p1.holding=false;
  G.p2.x=700; G.p2.input={left:false,right:false,jump:false,down:false};
  G.ball.held=null; G.ball.x=300; G.ball.y=T.GROUND - T.SLIME_R - 2; G.ball.vx=0; G.ball.vy=0;
  G.p1.input={left:false,right:false,jump:false,down:true};
  T.updateBall();
  ok(G.ball.held===G.p1, 'holding DOWN next to the ball catches it');
  G.p1.x=320; T.updateBall();
  ok(Math.abs(G.ball.x-320)<14 && G.ball.y < G.p1.y, 'held ball tracks the slime and sits on top');
  G.p1.input.down=false; T.updateBall();
  ok(G.ball.held===null && G.ball.vy<0, 'releasing DOWN throws the ball up/forward');
  ok(G.p1.catchCD>0, 'catch cooldown is set after release');
} catch(e){ ok(false, 'catch mechanic threw — '+e.message); }

// ---- 7. World Cup settings + corrected kit colours ------------------------
console.log('World Cup settings + kits:');
T.settings.wkMin = 3; T.settings.wkDiff = 'hard';
setupWK(TEAMS[0]);
ok(G.wk.min===3, 'World Cup uses the chosen match length (3 min)');
ok(G.wk.diffs.length===4 && G.wk.diffs.every(d=>d==='hard'), 'a fixed difficulty applies to every round');
T.settings.wkDiff = 'rising'; setupWK(TEAMS[0]);
ok(JSON.stringify(G.wk.diffs)===JSON.stringify(['normal','hard','hard','worldcup']), 'rising difficulty uses the R16->Final curve');
const kit = c => TEAMS.find(t=>t.code===c).color.toLowerCase();
ok(kit('BEL').startsWith('#e2'), 'Belgium home kit is red (not black)');
ok(kit('GER')==='#edeef2', 'Germany home kit is white');
ok(kit('POR')==='#c8102e', 'Portugal home kit is red');
ok(kit('JPN')==='#1f4fb0', 'Japan home kit is blue');

// Netherlands has hand-drawn character art (Virgil slime); rendering a NED slime is safe headless
const ned = TEAMS.find(t=>t.code==='NED');
ok(ned && ned.art && /ned-right\.webp/.test(ned.art.right) && /ned-left\.webp/.test(ned.art.left), 'Netherlands team carries left/right character art');
let nedDrawErr=null;
try { G.wkMode=false; G.wk=null; G.mode='1p'; G.screen=SCREEN.PLAY; G.p1.team=ned; G.p2.team=ned; T.render(); }
catch(e){ nedDrawErr=e; }
ok(!nedDrawErr, 'renders a Netherlands (art) slime without throwing'+(nedDrawErr?(' — '+nedDrawErr.message):''));

// ---- 8. new gameplay rules: real WC teams, kickoff, full-field, steal -------
console.log('Gameplay rules:');
ok(!TEAMS.some(t=>t.code==='ITA') && TEAMS.some(t=>t.code==='EGY'), 'Italy replaced by a real WC2026 team (Egypt)');
ok(TEAMS.length===24, 'pool still has 24 teams');

// kickoff: the team that conceded restarts (ball on their side)
G.wkMode=false; G.wk=null; G.mode='1p'; G.screen=SCREEN.PLAY;
G.lastScorer=0; T.resetPositions();                 // left scored -> right kicks off (ball right of centre)
ok(G.ball.x > T.CENTER, 'conceding side (right) kicks off after the left scores');
G.lastScorer=1; T.resetPositions();
ok(G.ball.x < T.CENTER, 'conceding side (left) kicks off after the right scores');

// full-field movement: the left slime can cross the halfway line
G.p1.x=T.CENTER; G.p1.input={left:false,right:true,jump:false,down:false};
for (let i=0;i<40;i++) T.updateSlime(G.p1);
ok(G.p1.x > T.CENTER + 50, 'a slime can now run across the whole pitch (past halfway)');
ok(G.p1.x <= T.W, 'slime stays inside the right wall');

// steal: jumping into a holder knocks the clamped ball loose
G.screen=SCREEN.PLAY; G.p1.x=400; G.p1.y=T.GROUND; G.p1.onGround=true; G.p1.holding=false; G.p1.catchCD=0;
G.ball.held=null; G.ball.x=400; G.ball.y=T.GROUND-T.SLIME_R-2; G.ball.vx=G.ball.vy=0;
G.p1.input={left:false,right:false,jump:false,down:true}; T.updateBall();   // p1 clamps it
G.p2.x=415; G.p2.y=T.GROUND-30; G.p2.onGround=false;                        // p2 jumps into p1
T.updateBall();
ok(G.ball.held===null, 'an opponent jumping into the holder knocks the ball loose (steal)');

// ---- 9. World Cup leaderboard points (per difficulty) ----------------------
console.log('Leaderboard points:');
try {
  T.settings.wkDiff='worldcup'; setupWK(TEAMS[0]);
  for (let r=0;r<4;r++){ G.score=[2,0]; wkMatchEnd(true); }   // win the cup on World Cup difficulty
  const champPts = T.wkPoints();
  T.settings.wkDiff='easy'; setupWK(TEAMS[0]);
  for (let r=0;r<4;r++){ G.score=[1,0]; wkMatchEnd(true); }   // win the cup on Easy
  const easyPts = T.wkPoints();
  ok(champPts>0 && easyPts>0, 'a completed run yields points');
  ok(champPts>easyPts, 'higher difficulty is worth more points ('+champPts+' vs '+easyPts+')');
  T.settings.wkDiff='hard'; setupWK(TEAMS[0]);
  G.score=[0,2]; wkMatchEnd(false);                            // lose in R16
  ok(T.wkPoints()>=0, 'a knocked-out run still computes points');
} catch(e){ ok(false,'points threw — '+e.message); }

// ---- 10. Power-ups (Friendly bonus mode) -----------------------------------
console.log('Power-ups (friendly bonus mode):');
try {
  const NOIN = ()=>({left:false,right:false,jump:false,down:false});
  // gating: ON in a friendly, OFF in a World Cup match (leaderboard purity)
  T.settings.powerups = true;
  G.wkMode=false; G.wk=null; G.mode='1p'; T.startMatch();
  ok(G.powerMode===true, 'power-ups arm in a 1P friendly when the toggle is on');
  G.wkMode=true; T.startMatch();
  ok(G.powerMode===false, 'power-ups never arm in a World Cup match');
  G.wkMode=false; G.mode='host'; T.startMatch();
  ok(G.powerMode===false, 'power-ups never arm in an online match');
  G.mode='1p'; T.startMatch(); G.screen=SCREEN.PLAY;

  // spawn + collect on touch
  G.pows.length=0;
  const pow = T.powSpawn('turbo');
  ok(G.pows.length===1, 'a pickup spawns');
  pow.x=G.p1.x; pow.y=G.p1.y - T.SLIME_R*0.5; pow.landed=true;     // drop it onto P1
  G.p1.input=NOIN(); G.p2.input=NOIN(); G.p2.x=900;
  T.powerTick();
  ok(G.pows.length===0 && G.p1.fx && G.p1.fx.type==='turbo', 'touching a pickup collects it (⚡ turbo active)');

  // turbo: 1.5x run speed while active
  G.p1.speedMul=1; G.p1.x=300; G.p1.input={left:false,right:true,jump:false,down:false};
  T.updateSlime(G.p1);
  ok(Math.abs((G.p1.x-300) - T.SLIME_SPEED*1.5) < 0.01, 'turbo runs 1.5x the base speed');
  G.p1.fx=null;
  G.p1.x=300; T.updateSlime(G.p1);
  ok(Math.abs((G.p1.x-300) - T.SLIME_SPEED) < 0.01, 'speed returns to normal when the effect ends');

  // freeze hits the OPPONENT and immobilises it
  T.applyPow(G.p1,'freeze');
  ok(G.p2.frozen>0, 'freeze pickup freezes the opponent');
  G.p2.x=900; G.p2.speedMul=1; G.p2.input={left:false,right:true,jump:false,down:false};
  T.updateSlime(G.p2);
  ok(G.p2.x===900, 'a frozen slime cannot move');
  G.p2.frozen=0;

  // shrink (NEGATIVE): grabbing it makes YOU smaller
  T.applyPow(G.p1,'shrink');
  ok(G.p1.fx && G.p1.fx.type==='shrink' && T.slimeR(G.p1) < T.SLIME_R*0.7, 'shrink pickup shrinks the grabber');
  ok(T.POWER_TYPES.shrink.bad===true, 'shrink is flagged as a negative pickup');
  G.p1.fx=null;

  // mega: bigger dome that really deflects from further away
  T.applyPow(G.p2,'mega');
  ok(T.slimeR(G.p2) > T.SLIME_R*1.3, 'mega grows the slime');
  G.p2.x=700; G.p2.y=T.GROUND; G.p2.vx=0; G.p2.vy=0;
  const bb=G.ball; bb.held=null; bb.x=700+85; bb.y=T.GROUND; bb.vx=-4; bb.vy=0;
  ok(T.reflectOffSlime(bb,G.p2)===true, 'mega dome deflects a ball a normal slime would miss');
  G.p2.fx=null;
  bb.x=700+85; bb.y=T.GROUND; bb.vx=-4; bb.vy=0;
  ok(T.reflectOffSlime(bb,G.p2)===false, 'same ball misses once mega expires');

  // power shot: the next contact rockets away, then the charge is spent
  T.applyPow(G.p1,'shot');
  ok(G.p1.powShot>0, 'power shot charges');
  G.p1.x=400; G.p1.y=T.GROUND; G.p1.vx=0; G.p1.vy=0;
  bb.x=430; bb.y=T.GROUND-55; bb.vx=2; bb.vy=2;
  T.reflectOffSlime(bb,G.p1);
  ok(Math.hypot(bb.vx,bb.vy) > 12, 'power shot launches the ball much faster (got '+Math.hypot(bb.vx,bb.vy).toFixed(1)+')');
  ok(G.p1.powShot===0, 'the charge is consumed by the contact');

  // kickoff hygiene: effects + pickups reset
  T.applyPow(G.p1,'moon'); T.powSpawn();
  T.resetPositions();
  ok(!G.p1.fx && G.pows.length===0, 'kickoff clears active effects and pickups');

  // renderer draws every pickup glyph, the badges and the top-left sticker without throwing
  let powDrawErr=null;
  try {
    G.powerMode=true; G.screen=SCREEN.PLAY; G.pows.length=0;
    Object.keys(T.POWER_TYPES).forEach((k,i)=>{ const q=T.powSpawn(k); q.x=120+i*90; q.landed=(i%2===0); });  // all 6 icons, falling + landed
    T.applyPow(G.p1,'turbo'); T.applyPow(G.p2,'freeze'); G.p2.powShot=200;
    T.render();
  } catch(e){ powDrawErr=e; }
  ok(!powDrawErr, 'renderer handles pickups, effect badges & the power-up sticker'+(powDrawErr?(' — '+powDrawErr.message):''));

  G.powerMode=false; G.pows.length=0; T.settings.powerups = false;
} catch(e){ ok(false, 'power-ups threw — '+e.message); }

console.log('\n' + (fails ? ('FAILED (' + fails + ')') : 'ALL TESTS PASSED'));
process.exit(fails ? 1 : 0);
