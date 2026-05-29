import pw from '/Users/appel/node_modules/playwright/index.js';
import { pathToFileURL } from 'node:url';
const { chromium } = pw;
const TEST_URL = pathToFileURL(new URL('./index.html', import.meta.url).pathname).href;
const errors = [];
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => errors.push('pageerror: '+e.message));
page.on('console', m => { if (m.type()==='error') errors.push('console: '+m.text()); });
await page.goto(TEST_URL,{waitUntil:'load'});
await page.waitForTimeout(800);

// 1) menu -> topscores -> lijst laadt (netwerk)
await page.click('#btnLeaders');
await page.waitForTimeout(2500);
const lbText = (await page.evaluate(()=>document.getElementById('lbList').textContent)).slice(0,120);
console.log('LB_LIST_INITIAL=' + JSON.stringify(lbText));
await page.screenshot({ path:'shot-lb.png' });
await page.click('#lbBack'); await page.waitForTimeout(200);

// 2) speel 1p, forceer winst, submit score
await page.click('#btn1p'); await page.waitForTimeout(300);
await page.click('#teamGrid .team:first-child'); await page.waitForTimeout(3300);
const uniqName = 'TEST_' + (await page.evaluate(()=>window.__G.frame));
await page.evaluate(()=>{ const G=window.__G; G.screen='play'; G.score=[4,1]; G.ball.x=W-5; G.ball.y=400; G.ball.vx=8; });
await page.waitForTimeout(500);
const overInfo = await page.evaluate(()=>({ screen:window.__G.screen, submitVisible: getComputedStyle(document.getElementById('lbSubmit')).display!=='none' }));
console.log('OVER=' + JSON.stringify(overInfo));
// vul naam + verstuur
await page.fill('#lbName', uniqName);
await page.click('#lbSend');
await page.waitForTimeout(2500);
const sendStatus = await page.evaluate(()=>document.getElementById('lbStatus').textContent);
console.log('SEND_STATUS=' + JSON.stringify(sendStatus));

// 3) open topscores opnieuw, check of de naam erin staat
await page.click('#overLeaders'); await page.waitForTimeout(2500);
const found = await page.evaluate(n=>document.getElementById('lbList').textContent.includes(n), uniqName);
console.log('FOUND_IN_LB=' + found);

console.log('--- ERRORS ('+errors.length+') ---'); errors.forEach(e=>console.log(e));
await browser.close();
process.exit(errors.length?1:0);
