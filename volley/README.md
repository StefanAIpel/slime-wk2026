# Slime Volleyball 🏐

Retro slime volleyball in a bright indoor arena — part of **SlimeScore**, the
sibling of [Slime Soccer / Slime World Cup](https://soccer.slimescore.nl).

> **This folder is the source of truth for the standalone Slime Volleyball bundle.**
> It is automatically synced to [`StefanAIpel/slime-volley`](https://github.com/StefanAIpel/slime-volley)
> by `.github/workflows/sync-volley.yml` (SSH deploy key `SLIME_VOLLEY_DEPLOY_KEY`)
> on every change under `volley/` on `main`. Netlify deploys `slime-volley` →
> **volley.slimescore.com / .app**. So: just edit files here; the rest is automatic.

Built the same way as the soccer game: **vanilla JS + HTML5 Canvas, no build step**.
Three files do everything — `index.html` (DOM screens), `game.js` (the whole game),
`style.css`. Plus a lazy-loaded `leaderboard.js`, a `service-worker.js` (network-first)
and a `manifest.webmanifest` so it installs as a PWA.

## Play
- **1 Player** — rally against the computer (Easy → Pro).
- **2 Players** — same keyboard / phone.
- **First to 3 / 5 / 7** — pick the match length on the setup screen.

### Controls
| | Move | Jump | Smash |
|---|---|---|---|
| **Player 1** | `A` / `D` | `W` | `S` |
| **Player 2** | `←` / `→` | `↑` | `↓` |

Touch buttons appear on phones/tablets. `ESC` (or ☰) pauses.

### Rules
- The ball touching the **floor on your side** scores for the other side.
- You **can't cross the net** — play the ball back over it.
- **No catching.** Instead, hold **Smash** while you hit the ball in the air above
  net height to spike it down hard.
- **Double jump** — tap jump again mid-air for extra height.
- The side that won the point **serves** next. If nobody serves within **12 seconds**
  the serve drops automatically.

## Slimescore
The Slimescore (high scores) records your best **1-player wins**; points scale with
difficulty and winning margin. It also cross-links to **Slime Soccer** — both games
are part of *SlimeScore*. Points are recomputed server-side from the match facts
(anti-cheat), reusing the same Supabase project as the soccer game (a separate
`slime_volley_leaderboard` table + `slime_volley_submit` RPC).

## Architecture (`game.js`, numbered sections)
0. Canvas + world constants (net in the middle, `GROUND`, radii, physics)
1. Teams (12 volleyball nations) + inline SVG flags
2. AI levels · 3. Settings (localStorage) · i18n (EN/NL)
4. Audio (fully synthesized — no audio assets) · 5. Input (keyboard + touch)
6. Entities · 7. Game state · 8. Particles
9. Physics (slime/ball/net, smash) · 10. AI · 11. Match flow (serve/point/win)
12. Render (indoor arena, court, net, slimes, ball, HUD) · 13. Main loop
14. UI / DOM screens · 15. Wiring · 16. Test hooks (`?debug=1`)

## Deploy
Handled automatically (see the note at the top): edit under `volley/` → push to
`main` → the GitHub Action mirrors this folder to the **root** of `slime-volley` →
Netlify (connected to `slime-volley`, no build) serves **volley.slimescore.com / .app**.

## Develop / test
```bash
node --check game.js leaderboard.js service-worker.js   # syntax
# serve the folder and open it:
npx http-server . -p 8080             # then http://localhost:8080
```
`?debug=1` (or localhost) exposes `window.__G` / `window.__TEST` for headless tests.
