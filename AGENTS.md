# SlimeScore — developer & agent guide

Status/setup reference for **both** SlimeScore games. Read this first if you're a
new developer or an AI agent working in this repo.

## The SlimeScore family
| Game | Source | Lives at | Deploys to | Domain |
|---|---|---|---|---|
| **Slime Soccer** (Slime World Cup '26) | this repo root (`slime-wk2026`) | — | Netlify (git, from `main`) | **soccer.slimescore.com** (+ `slime-wk2026.netlify.app` fallback) |
| **Slime Volleyball** | `volley/` in this repo | auto-synced → `StefanAIpel/slime-volley` (root) | Netlify (from `slime-volley`) | **volley.slimescore.com / .app** |

**Auto-sync:** `.github/workflows/sync-volley.yml` mirrors `volley/` → the root of the
`slime-volley` repo on every push to `main` (SSH deploy key secret `SLIME_VOLLEY_DEPLOY_KEY`).
So you can develop the volley game here in `volley/`; the workflow fills `slime-volley`.
> Pick ONE source per game. If a dedicated session works **directly** in `slime-volley`,
> disable this workflow + remove `volley/` here to avoid two sources clobbering each other.

### Current status (2026-06)
- Soccer: **v0.15 beta**, live. Modes: 1P (Friendly), 2P local, **World Cup** (1P knockout), **Online** (P2P).
- Volley: **v0.1 beta**, in `slime-volley`. Modes: 1P vs AI, 2P local, first-to 3/5/7.
  **Missing vs soccer: World Cup/tournament + Online + timed mode** — see [`volley/PORTING.md`](volley/PORTING.md).

## Golden rules (both games)
- **No build step.** Plain `index.html` + `game.js` + `style.css`, served as-is. Don't add a bundler.
- **Vanilla JS + Canvas 2D.** No frameworks. ES5/ES2017-ish; `'use strict'`.
- **i18n EN/NL.** All UI text goes through `I18N`/`t()`; English is the fallback. The product
  **names stay English** ("Slime World Cup", "Slime Volleyball", "SlimeScore"). Localized country
  names via `NL_NAMES`. DOM strings use `data-i18n` / `data-i18n-html` / `data-i18n-ph` + `applyStaticI18n()`.
- **Flags = inline SVG** in `FLAG_SVG` (viewBox `0 0 90 60`, double-quoted attrs only so they encode
  into a data URI). `flagBg()` for CSS, `flagImage()` for the canvas HUD (with stripe fallback).
- **Fixed-timestep loop** (`STEP = 1000/60`, accumulator). Keep simulation deterministic.
- **Debug gate:** `window.__G` / `window.__TEST` are only exposed on `localhost` or with `?debug=1`
  (used by headless tests). Don't expose globals unconditionally.
- **Don't put the model identifier / secrets in committed files.**

## Anatomy of a game (`game.js`, numbered sections)
Both games follow the same skeleton:
0. Canvas + world constants (`W=1160,H=600`, `GROUND`, radii, physics). Soccer adds goals; volley adds a centre **net**.
1. Teams + inline SVG flags  ·  2. AI levels  ·  3. Settings (localStorage)  ·  i18n
4. Audio  ·  5. Input (keyboard + touch pads, pointer routing)  ·  6. Entities  ·  7. Game state `G` + `SCREEN`
8. Particles  ·  9. Physics  ·  10. AI  ·  11. Match flow  ·  12. Render  ·  13. Main loop
14. UI / DOM overlays  ·  15. Wiring  ·  16. Test hooks

- **State machine:** one `G` object; `G.screen` (`SCREEN.*`) drives `tick()` and `render()`.
  DOM "overlays" (`.overlay` divs, toggled by `showOverlay(id)`) sit on top of the live canvas.
- **Audio:** soccer ships `assets/audio/*.mp3` (bg music + whistle) + synth crowd; **volley is
  fully synthesized** (no audio assets) — prefer the synth approach for new sound.

## Backend (shared Supabase project `eymkdhdmekcxbapmyask`)
Accessed by REST with the anon publishable key (safe; gated by RLS). See `leaderboard.js`.
- **Soccer leaderboard:** table `slime_leaderboard`, RPC `slime_submit_score` (SECURITY DEFINER —
  recomputes points server-side from match facts = anti-cheat). Read-only public policy.
- **Online lobby:** table `slime_lobby`, RPCs `slime_find_or_wait` / `slime_cancel` / `slime_online_count`.
  TURN creds via edge function `slime-turn` (`TURN_API` in `game.js`).
- **Volley leaderboard:** table `slime_volley_leaderboard`, RPC `slime_volley_submit` (same anti-cheat pattern).
- **Anti-cheat convention:** clients submit *facts*; a SECURITY DEFINER RPC computes points & inserts.
  Never grant anon direct INSERT; keep only a public SELECT policy.

## Dev / test / CI
```bash
npm ci
npm run check       # node --check + ESLint on game.js/leaderboard.js/service-worker.js for BOTH apps
npm run test:logic  # brackettest.mjs (soccer World Cup bracket sim)
npm test            # check + test:logic  (what CI runs)
npx http-server . -p 8080     # soccer ;  use volley/ for the volley app
```
- CI: `.github/workflows/ci.yml` runs `npm test` on push/PR. Keep it green.
- ESLint flat config in `eslint.config.js` (covers `volley/*.js` too).
- Headless smoke (Playwright, ad-hoc): serve the folder, load with `?debug=1`, drive via `window.__TEST`.

## Working agreement
- Branch + PR into `main` (don't push to `main` directly). Squash-merge on green CI.
- Touch the soccer app at the repo root; touch the volley app under `volley/` (auto-syncs on merge).
- When you change deploy/domains, update the table at the top of this file.

➡️ **Porting work (volley ← soccer): [`volley/PORTING.md`](volley/PORTING.md).**
