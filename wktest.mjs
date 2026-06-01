import { chromium } from 'playwright';
const PAGE_URL = (process.env.BASE_URL ? process.env.BASE_URL.replace(/\/+$/,'') + '/index.html' : new globalThis.URL('./index.html', import.meta.url).href) + '?debug=1';
const errors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => errors.push('pageerror: '+e.message));
page.on('console', m => { if (m.type()==='error') errors.push('console: '+m.text()); });
async function poll(fn, ms=8000, label=''){ const t0=Date.now(); while(Date.now()-t0<ms){ if(await page.evaluate(fn)) return true; await page.waitForTimeout(120);} throw new Error('timeout: '+label); }
await page.goto(PAGE_URL, { waitUntil:'load' });
await page.waitForTimeout(600);

// ===== World Cup knockout: real 16-team bracket, win 4 rounds = champion =====
await page.click('#btnWK'); await page.waitForTimeout(300);
await page.click('#setupPlay'); await page.waitForTimeout(250);   // WC setup (length + level) -> pick country
await page.click('#teamGrid .team:first-child');   // Netherlands
await poll(()=>document.getElementById('wkScreen').classList.contains('show'), 6000, 'wk-stage0');
const draw = await page.evaluate(()=>({
  rounds: window.__G.wk.rounds.length,
  r16: window.__G.wk.rounds[0].length,
  teams: new Set(window.__G.wk.rounds[0].flatMap(m=>[m.a.code,m.b.code])).size,
  userMatches: window.__G.wk.rounds[0].filter(m=>m.user).length,
}));
console.log('WK_DRAW=' + JSON.stringify(draw) + ' (expect r16=8, teams=16, userMatches=1)');

for (let r=1; r<=4; r++){
  await page.click('#wkPlay');
  await poll(()=>window.__G.screen==='play', 9000, 'wk-play r'+r);
  // force a win in time mode: leading score + clock near 0
  await page.evaluate(()=>{ const G=window.__G; G.score=[1,0]; G.matchTime=1; });
  await poll(()=>document.getElementById('wkScreen').classList.contains('show'), 6000, 'wk-after r'+r);
  const t = await page.evaluate(()=>document.getElementById('wkTitle').textContent);
  console.log('  after round '+r+': ' + t);
}
const champ = await page.evaluate(()=>document.getElementById('wkTitle').textContent);
console.log('WK_RESULT=' + JSON.stringify(champ) + ' (expect 🏆 CHAMPIONS!)');

// ===== Time mode + golden goal (local 1p) =====
await page.click('#wkHome'); await page.waitForTimeout(200);
await page.click('#btnSettings'); await page.waitForTimeout(150);
await page.click('#tMode');   // -> Match time
await page.waitForTimeout(100);
const modeVal = await page.evaluate(()=>document.querySelector('#tMode .val').textContent);
console.log('MODE_TOGGLE=' + modeVal);
await page.click('#setBack'); await page.waitForTimeout(100);
await page.click('#btn1p'); await page.waitForTimeout(200);
await page.click('#setupPlay'); await page.waitForTimeout(200);
await page.click('#teamGrid .team:first-child');
await poll(()=>window.__G.screen==='play', 9000, 'time-play');
// draw + clock to 0 -> golden goal
await page.evaluate(()=>{ const G=window.__G; G.score=[2,2]; G.matchTime=1; });
await poll(()=>window.__G.golden===true, 5000, 'golden');
console.log('GOLDEN_GOAL=' + await page.evaluate(()=>window.__G.golden));
// golden goal: next goal decides
await page.evaluate(()=>{ const G=window.__G; G.ball.x=W-5; G.ball.y=400; G.ball.vx=8; });
await poll(()=>window.__G.screen==='over', 5000, 'golden-over');
console.log('GOLDEN_OVER screen=' + await page.evaluate(()=>window.__G.screen) + ' winner=' + await page.evaluate(()=>window.__G.winner));

// ===== Pause / quit =====
await page.click('#overMenu'); await page.waitForTimeout(150);
await page.click('#btn1p'); await page.waitForTimeout(150);
await page.click('#setupPlay'); await page.waitForTimeout(150);
await page.click('#teamGrid .team:first-child');
await poll(()=>window.__G.screen==='play', 9000, 'pause-play');
await page.click('#stagePause'); await page.waitForTimeout(150);   // desktop pause button (replaces the floating ☰)
console.log('PAUSE paused=' + await page.evaluate(()=>window.__G.paused) + ' overlay=' + await page.evaluate(()=>document.getElementById('pauseScreen').classList.contains('show')));
await page.click('#pauseQuit'); await page.waitForTimeout(150);
console.log('QUIT screen=' + await page.evaluate(()=>window.__G.screen) + ' wkMode=' + await page.evaluate(()=>window.__G.wkMode));

console.log('--- ERRORS ('+errors.length+') ---'); errors.forEach(e=>console.log(e));
await browser.close();
process.exit(errors.length?1:0);
