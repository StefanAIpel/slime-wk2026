import { chromium } from 'playwright';

const URL = new URL('./index.html', import.meta.url).href;
const errors = [];
const logs = [];

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });

page.on('console', m => { logs.push(`[${m.type()}] ${m.text()}`); if (m.type()==='error') errors.push('console: '+m.text()); });
page.on('pageerror', e => errors.push('pageerror: '+e.message));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shot-1-menu.png' });

// --- 1P flow ---
await page.click('#btn1p');
await page.waitForTimeout(400);
await page.screenshot({ path: 'shot-2-teams.png' });
// kies eerste team (Nederland)
await page.click('#teamGrid .team:first-child');
await page.waitForTimeout(500);
const scr1 = await page.evaluate(() => window.__G.screen);
console.log('SCREEN_AFTER_PICK=' + scr1);

// wacht countdown uit + speel
await page.waitForTimeout(3500);
const scr2 = await page.evaluate(() => window.__G.screen);
console.log('SCREEN_PLAY=' + scr2);

// simuleer beweging+sprong
await page.keyboard.down('d'); await page.waitForTimeout(300);
await page.keyboard.down('w'); await page.waitForTimeout(150); await page.keyboard.up('w');
await page.waitForTimeout(400); await page.keyboard.up('d');
const st = await page.evaluate(() => ({ p1x: window.__G.p1.x, ballx: window.__G.ball.x, bally: window.__G.ball.y, frame: window.__G.frame }));
console.log('STATE=' + JSON.stringify(st));
await page.screenshot({ path: 'shot-3-play.png' });

// forceer een doelpunt + game over render
await page.evaluate(() => { window.__G.score=[4,2]; window.__G.ball.x=20; window.__G.ball.y=380; });
await page.waitForTimeout(800);
const scr3 = await page.evaluate(() => window.__G.screen);
console.log('SCREEN_AFTER_GOAL=' + scr3);
await page.screenshot({ path: 'shot-4-after.png' });

// terug naar menu, test 2P pad
await page.evaluate(() => { try{ backToMenu(); }catch(e){} });
await page.waitForTimeout(300);
await page.click('#btn2p');
await page.waitForTimeout(300);
await page.click('#teamGrid .team:nth-child(2)');
await page.waitForTimeout(200);
await page.click('#teamGrid .team:nth-child(3)');
await page.waitForTimeout(400);
const scr4 = await page.evaluate(() => window.__G.screen);
console.log('SCREEN_2P=' + scr4);
await page.screenshot({ path: 'shot-5-2p.png' });

console.log('PEER_DEFINED=' + await page.evaluate(()=> typeof Peer!=='undefined'));
console.log('--- ERRORS ('+errors.length+') ---');
errors.forEach(e=>console.log(e));

await browser.close();
process.exit(errors.length ? 1 : 0);
