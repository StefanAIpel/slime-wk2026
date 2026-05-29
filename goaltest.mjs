import pw from '/Users/appel/node_modules/playwright/index.js';
const { chromium } = pw;
const URL = 'file:///Users/appel/Projects/slime-wk2026/index.html';
const errors = [];
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => errors.push('pageerror: '+e.message));
page.on('console', m => { if (m.type()==='error') errors.push('console: '+m.text()); });
await page.goto(URL, { waitUntil:'load' });
await page.waitForTimeout(600);
await page.click('#btn1p');
await page.waitForTimeout(300);
await page.click('#teamGrid .team:first-child');
await page.waitForTimeout(3400);                 // countdown klaar
console.log('screen=' + await page.evaluate(()=>window.__G.screen));

// echte goal forceren: bal in linkerdoel -> rechts (p2) scoort
await page.evaluate(()=>{ const G=window.__G; G.ball.x=5; G.ball.y=400; G.ball.vx=-5; G.ball.vy=0; });
await page.waitForTimeout(250);
const after = await page.evaluate(()=>({screen:window.__G.screen, score:window.__G.score}));
console.log('AFTER_GOAL=' + JSON.stringify(after));
await page.screenshot({ path:'shot-goal.png' });

// win forceren
await page.evaluate(()=>{ const G=window.__G; G.screen='play'; G.score=[0,4]; G.ball.x=5; G.ball.y=400; G.ball.vx=-5; });
await page.waitForTimeout(400);
const over = await page.evaluate(()=>({screen:window.__G.screen, winner:window.__G.winner, overlay:document.getElementById('overScreen').classList.contains('show')}));
console.log('AFTER_WIN=' + JSON.stringify(over));
await page.screenshot({ path:'shot-over.png' });

// online host: klik en kijk of er een code komt (PeerJS broker bereikbaar?)
await page.evaluate(()=>{ try{ backToMenu(); }catch(e){} });
await page.waitForTimeout(200);
await page.click('#btnOnline'); await page.waitForTimeout(200);
await page.click('#btnHost'); await page.waitForTimeout(2500);
const host = await page.evaluate(()=>({ code:document.getElementById('hostCode').textContent, status:document.getElementById('onlineStatus').textContent }));
console.log('HOST=' + JSON.stringify(host));
await page.screenshot({ path:'shot-online.png' });

console.log('--- ERRORS ('+errors.length+') ---'); errors.forEach(e=>console.log(e));
await browser.close();
process.exit(errors.length?1:0);
