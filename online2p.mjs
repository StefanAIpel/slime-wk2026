import pw from '/Users/appel/node_modules/playwright/index.js';
const { chromium } = pw;
const URL = 'file:///Users/appel/Projects/slime-wk2026/index.html';
const errors = [];
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });

function watch(p, tag){ p.on('pageerror', e=>errors.push(`[${tag}] pageerror: `+e.message)); p.on('console', m=>{ if(m.type()==='error') errors.push(`[${tag}] console: `+m.text()); }); }
async function poll(p, fn, ms=12000, label=''){ const t0=Date.now(); while(Date.now()-t0<ms){ if(await p.evaluate(fn)) return true; await p.waitForTimeout(150);} throw new Error('timeout: '+label); }
const screenOf = p => p.evaluate(()=>window.__G.screen);

const host = await ctx.newPage(); watch(host,'HOST');
const guest = await ctx.newPage(); watch(guest,'GUEST');
await host.goto(URL,{waitUntil:'load'}); await guest.goto(URL,{waitUntil:'load'});
await host.waitForTimeout(500);

// HOST: online -> host -> code
await host.click('#btnOnline'); await host.click('#btnHost');
await poll(host, ()=>{ const c=document.getElementById('hostCode').textContent; return c && c.length===4 && c!=='...'; }, 15000, 'hostcode');
const code = await host.evaluate(()=>document.getElementById('hostCode').textContent);
console.log('CODE=' + code);

// GUEST: online -> join -> code
await guest.click('#btnOnline'); await guest.click('#btnJoin');
await guest.fill('#joinCode', code); await guest.click('#joinGo');
await poll(host, ()=>window.__G.net && window.__G.net.connected, 15000, 'host-connected');
console.log('CONNECTED ✓');

// HOST: start -> kies eigen team (NED = eerste)
await host.click('#hostStart'); await host.waitForTimeout(400);
await host.click('#teamGrid .team:first-child');         // host kiest NED -> stuurt needTeam
// GUEST: krijgt teamkeuze -> kiest 2e team
await poll(guest, ()=>document.getElementById('teamScreen').classList.contains('show'), 15000, 'guest-teampick');
await guest.click('#teamGrid .team:nth-child(2)');       // guest kiest ARG

// beide moeten in count/play komen
await poll(host, ()=>['count','play'].includes(window.__G.screen), 15000, 'host-play');
await poll(guest, ()=>['count','play'].includes(window.__G.screen), 15000, 'guest-play');
await host.waitForTimeout(3600);  // countdown uit
console.log('HOST_SCREEN=' + await screenOf(host) + ' GUEST_SCREEN=' + await screenOf(guest));

// guest moet host-state ontvangen (netTarget + teams kloppen)
const guestState = await guest.evaluate(()=>({
  hasTarget: !!window.__G.netTarget,
  p1team: window.__G.p1 && window.__G.p1.team.code,
  p2team: window.__G.p2 && window.__G.p2.team.code,
  mode: window.__G.mode,
}));
console.log('GUEST_STATE=' + JSON.stringify(guestState));

// HOST scoort in RECHTER doel (host=links=p1 wint punt)
await poll(host, ()=>window.__G.screen==='play', 8000, 'host-play2');
await host.evaluate(()=>{ const G=window.__G; G.ball.x=W-5; G.ball.y=400; G.ball.vx=8; G.ball.vy=0; });
await poll(guest, ()=>window.__G.screen==='goal' || window.__G.score[0]>=1, 8000, 'guest-goal');
console.log('AFTER_GOAL host=' + JSON.stringify(await host.evaluate(()=>window.__G.score)) + ' guest=' + JSON.stringify(await guest.evaluate(()=>window.__G.score)));

// HOST forceert winst
await poll(host, ()=>window.__G.screen==='play', 12000, 'host-play3');
await host.evaluate(()=>{ const G=window.__G; G.score=[4,1]; G.ball.x=W-5; G.ball.y=400; G.ball.vx=8; });
await poll(host, ()=>window.__G.screen==='over', 8000, 'host-over');
// guest moet OVER-scherm tonen (de 50%-miss fix)
await poll(guest, ()=>document.getElementById('overScreen').classList.contains('show'), 8000, 'guest-over-overlay');
console.log('GUEST_OVER_SHOWN ✓ ; guest rematch-knop verborgen=' + await guest.evaluate(()=>getComputedStyle(document.getElementById('overRematch')).display==='none'));

// REVANCHE door host (online = directe same-teams rematch, geen dialog) -> guest gaat weer spelen
await host.click('#overRematch');
await poll(guest, ()=>!document.getElementById('overScreen').classList.contains('show') && ['count','play'].includes(window.__G.screen), 10000, 'guest-rematch');
console.log('REMATCH guest_screen=' + await screenOf(guest) + ' overlay_weg ✓');

// DISCONNECT: sluit guest -> host moet het merken en terug naar online-scherm
await guest.close();
await poll(host, ()=>window.__G.mode==='1p' && document.getElementById('onlineScreen').classList.contains('show'), 12000, 'host-disconnect');
console.log('HOST_DISCONNECT_HANDLED ✓ status=' + JSON.stringify(await host.evaluate(()=>document.getElementById('onlineStatus').textContent)));

console.log('--- ERRORS ('+errors.length+') ---'); errors.forEach(e=>console.log(e));
await browser.close();
process.exit(errors.length?1:0);
