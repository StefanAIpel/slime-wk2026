import { chromium } from 'playwright';
const PAGE_URL = new globalThis.URL('./index.html', import.meta.url).href + '?debug=1';
const errors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
page.on('pageerror', e => errors.push('pageerror: '+e.message));
page.on('console', m => { if (m.type()==='error') errors.push('console: '+m.text()); });
async function poll(fn, ms=9000, label=''){ const t0=Date.now(); while(Date.now()-t0<ms){ if(await page.evaluate(fn)) return true; await page.waitForTimeout(120);} throw new Error('timeout: '+label); }
await page.goto(PAGE_URL, { waitUntil:'load' });
await page.waitForTimeout(800);

// 1) menu -> high scores -> list loads (network)
await page.click('#btnLeaders');
await page.waitForTimeout(2500);
const lbText = (await page.evaluate(()=>document.getElementById('lbList').textContent)).slice(0,120);
console.log('LB_LIST_INITIAL=' + JSON.stringify(lbText));
await page.click('#lbBack'); await page.waitForTimeout(200);

// 2) play a full World Cup run (leaderboard is World Cup-only) and submit the points
await page.click('#btnWK'); await page.waitForTimeout(300);
await page.click('#teamGrid .team:first-child'); await page.waitForTimeout(500);
const uniqName = 'TEST_' + Date.now();
for (let r=0;r<4;r++){
  await page.click('#wkPlay');
  await poll(()=>window.__G.screen==='play', 9000, 'wk-play r'+r);
  await page.evaluate(()=>{ const G=window.__G; G.score=[1,0]; G.matchTime=1; });   // force a win in time mode
  await poll(()=>document.getElementById('wkScreen').classList.contains('show'), 6000, 'wk-after r'+r);
}
const champ = await page.evaluate(()=>document.getElementById('wkTitle').textContent);
const hasSubmit = await page.evaluate(()=>!!document.getElementById('wkSubmit'));
console.log('WK_DONE title=' + JSON.stringify(champ) + ' submitBtn=' + hasSubmit);
await page.fill('#wkName', uniqName);
await page.click('#wkSubmit');
await page.waitForTimeout(2800);
const sendStatus = await page.evaluate(()=>document.getElementById('wkStatus').textContent);
console.log('SEND_STATUS=' + JSON.stringify(sendStatus));

// 3) reopen high scores, confirm the name is there
await page.click('#wkHome'); await page.waitForTimeout(200);
await page.click('#btnLeaders'); await page.waitForTimeout(2800);
const found = await page.evaluate(n=>document.getElementById('lbList').textContent.includes(n), uniqName);
console.log('FOUND_IN_LB=' + found + ' (name=' + uniqName + ')');

console.log('--- ERRORS ('+errors.length+') ---'); errors.forEach(e=>console.log(e));
await browser.close();
process.exit((errors.length || !found) ? 1 : 0);
