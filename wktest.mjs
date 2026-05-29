import pw from '/Users/appel/node_modules/playwright/index.js';
const { chromium } = pw;
const URL = 'file:///Users/appel/Projects/slime-wk2026/index.html';
const errors = [];
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => errors.push('pageerror: '+e.message));
page.on('console', m => { if (m.type()==='error') errors.push('console: '+m.text()); });
async function poll(fn, ms=8000, label=''){ const t0=Date.now(); while(Date.now()-t0<ms){ if(await page.evaluate(fn)) return true; await page.waitForTimeout(120);} throw new Error('timeout: '+label); }
await page.goto(URL, { waitUntil:'load' });
await page.waitForTimeout(600);

// ===== WK-toernooi: 4x winnen = kampioen =====
await page.click('#btnWK'); await page.waitForTimeout(300);
await page.click('#teamGrid .team:first-child');   // NED
await poll(()=>document.getElementById('wkScreen').classList.contains('show'), 6000, 'wk-stage0');
console.log('WK_START title=' + await page.evaluate(()=>document.getElementById('wkTitle').textContent) +
            ' wkMode=' + await page.evaluate(()=>window.__G.wkMode));

for (let r=1; r<=4; r++){
  await page.click('#wkPlay');
  await poll(()=>window.__G.screen==='play', 9000, 'wk-play r'+r);
  // forceer winst in tijd-modus: leidende score + klok bijna 0
  await page.evaluate(()=>{ const G=window.__G; G.score=[1,0]; G.matchTime=1; });
  await poll(()=>document.getElementById('wkScreen').classList.contains('show'), 6000, 'wk-after r'+r);
  const t = await page.evaluate(()=>document.getElementById('wkTitle').textContent);
  console.log('  na ronde '+r+': ' + t);
}
const champ = await page.evaluate(()=>document.getElementById('wkTitle').textContent);
console.log('WK_RESULT=' + JSON.stringify(champ) + ' (verwacht KAMPIOEN)');

// ===== Tijd-modus + golden goal (lokaal 1p) =====
await page.click('#wkHome'); await page.waitForTimeout(200);
await page.click('#btnSettings'); await page.waitForTimeout(150);
await page.click('#tMode');   // -> Speeltijd
await page.waitForTimeout(100);
const modeVal = await page.evaluate(()=>document.querySelector('#tMode .val').textContent);
console.log('MODE_TOGGLE=' + modeVal);
await page.click('#setBack'); await page.waitForTimeout(100);
await page.click('#btn1p'); await page.waitForTimeout(200);
await page.click('#teamGrid .team:first-child');
await poll(()=>window.__G.screen==='play', 9000, 'time-play');
// gelijk + klok op 0 -> golden goal
await page.evaluate(()=>{ const G=window.__G; G.score=[2,2]; G.matchTime=1; });
await poll(()=>window.__G.golden===true, 5000, 'golden');
console.log('GOLDEN_GOAL=' + await page.evaluate(()=>window.__G.golden));
// golden goal: volgend doelpunt beslist
await page.evaluate(()=>{ const G=window.__G; G.ball.x=W-5; G.ball.y=400; G.ball.vx=8; });
await poll(()=>window.__G.screen==='over', 5000, 'golden-over');
console.log('GOLDEN_OVER screen=' + await page.evaluate(()=>window.__G.screen) + ' winner=' + await page.evaluate(()=>window.__G.winner));

// ===== Pauze/opgeven =====
await page.click('#overMenu'); await page.waitForTimeout(150);
await page.click('#btn1p'); await page.waitForTimeout(150);
await page.click('#teamGrid .team:first-child');
await poll(()=>window.__G.screen==='play', 9000, 'pause-play');
await page.click('#quitBtn'); await page.waitForTimeout(150);
console.log('PAUSE paused=' + await page.evaluate(()=>window.__G.paused) + ' overlay=' + await page.evaluate(()=>document.getElementById('pauseScreen').classList.contains('show')));
await page.click('#pauseQuit'); await page.waitForTimeout(150);
console.log('QUIT screen=' + await page.evaluate(()=>window.__G.screen) + ' wkMode=' + await page.evaluate(()=>window.__G.wkMode));

console.log('--- ERRORS ('+errors.length+') ---'); errors.forEach(e=>console.log(e));
await browser.close();
process.exit(errors.length?1:0);
