# ⚽ Slime World Cup

Retro **slime soccer** in a modern kit — a remake of the early-2000s *Slime Soccer*
vibe, tied to the **2026 World Cup**. Play the computer, two players on the same
screen, or **online against a friend**. Mobile-first (touch), great on desktop with
WASD / arrow keys. Pure **HTML5 canvas + vanilla JS, no build step**.

- **Live:** https://slime-wk2026.netlify.app
- **Local:** open `index.html` in a browser. Online mode + leaderboard need internet.
- **Version:** see the footer (`v0.x beta`). The name **"Slime World Cup"** stays in English everywhere.

---

## Modes
- **🏆 World Cup** — a real, randomly-seeded **16-team knockout** drawn from a **24-country
  pool** (your pick + 15 random others). You play your own timed match each round; the rest
  are auto-simulated by team strength. Win 4 rounds (R16 → QF → SF → Final) to lift the cup,
  then submit your score to the leaderboard. Difficulty includes **Rising** (ramps up each round).
- **⚽ Friendly** — 1 player vs computer (Easy / Normal / Hard / World Cup level).
- **👥 2 Players** — same device (desktop keyboard, or split touch on a phone).
- **🌐 Online** — peer-to-peer via a 4-letter code (Play a friend), or **Quick match**
  (server-matchmade), 2-minute matches. The Online screen shows a live lobby count.

## Controls
| | Move | Jump | Catch / hold ball |
|---|---|---|---|
| **Player 1** | `A` `D` (or ◀ ▶ touch) | `W` | `S` |
| **Player 2** (2P) | `←` `→` | `↑` | `↓` |
| **Touch** | on-screen pads | jump pad | hold the 🤲 pad |

`Space` also jumps. **Double-jump:** tap jump again in mid-air. **Catch & throw:** hold the
catch key/pad to clamp the ball, release to throw. `ESC` = pause (local). Lingering in your
own goal area too long gets you sent out (anti-goal-hanging). On a timed tie → **golden goal**.
A **❓ How-to-play** screen (menu + in-game, auto-pauses) explains all of this.

## Settings (saved in `localStorage`, key prefix `slimewk_`)
Sound, volume, CRT effect, match type (goals/timed) + length, computer level, and
**language (English / Nederlands)**. Everything except the game name "Slime World Cup"
and the event name "World Cup" is translated.

---

## Architecture
No bundler, no framework. Three hand-written files do everything:

| File | Role |
|---|---|
| `index.html` | All screens/overlays as static DOM (menu, setup, team-select, online, World Cup, game-over, leaderboard, rules, pause). Static strings carry `data-i18n*` attributes. |
| `game.js` | The whole game (~2.5k lines, sectioned by numbered comments). |
| `leaderboard.js` | Lazy-loaded Supabase REST client: `window.Leaderboard` (submit/top) + `window.Lobby` (findOrWait/cancel/count). |
| `style.css` | All styling. Responsive via `(pointer:fine)`, `(pointer:coarse)` and `max-height:620px` (landscape phones). |
| `service-worker.js` | Network-first cache (offline fallback). |
| `manifest.webmanifest` | PWA manifest; icons in `assets/icons/`. |

### `game.js` map (follow the numbered section comments)
`1. Teams` · `2. Settings` + **i18n** (`I18N{en,nl}`, `t(key,vars)`, `applyStaticI18n`,
`teamName`) · `3. Audio` (Web Audio + `assets/audio/*.mp3`) · `4. Input` (keyboard +
coordinate-based touch zones) · `5. Entities` · `8. Physics` (fixed 60 Hz) · `9. AI`
(`AI_LEVELS`, `computeAI`) · `12. Online netcode` (PeerJS, host-authoritative) ·
`13. Rendering` (Canvas 2D) · `14. Main loop` · World Cup bracket · `16. wiring + init`.

### Teams & flags
`TEAMS` (24 entries: `code,name,color,trim,strength,stripes`). Flags are **inline SVG**
(`FLAG_SVG` keyed by code) turned into a `data:` URI: each team's `flag` becomes a CSS
background (used by every `style="background:${t.flag}"` site), and the in-game HUD draws
the same SVG via `flagImage()`. Dutch names live in `NL_NAMES`. The team grid is sorted
alphabetically by localized name.
**Add a team:** add a `TEAMS` row + a `FLAG_SVG[CODE]` (viewBox `0 0 90 60`, double-quoted
attrs only so it encodes cleanly) + a `NL_NAMES[CODE]`. Update the `brackettest` pool count.

### i18n
`I18N = { en, nl }`; `t('key', {vars})` interpolates `{var}` and **falls back to English**
(a missing key shows English, never breaks). Static DOM uses `data-i18n` (textContent),
`data-i18n-html` (innerHTML), `data-i18n-ph` (placeholder); `applyStaticI18n()` runs on
load and on language switch. Dynamic strings call `t()`. **Add a string:** add the key to
both `en` and `nl`, then reference it via an attribute or `t()`.

---

## Backend (Supabase — project "Familie Trivia", anon key + RLS)
Direct REST from `leaderboard.js`; the publishable anon key is safe (RLS-guarded).

- **`slime_leaderboard`** — World Cup scores. RLS: public read; anon insert bounded
  (name 1–20, scores 0–99). `submit()` POSTs, `top()` reads the top N by points.
  `mode='worldcup'`, `difficulty` stored in English (stable across UI languages).
- **`slime_lobby`** — quick-match pairing. RPCs (SECURITY DEFINER): `slime_find_or_wait`
  (atomic claim/insert, self-cleans rows >90s), `slime_cancel`, and **`slime_online_count`**
  (aggregate-only `{waiting, playing}` for the on-screen count — never exposes codes/names).

> Schema/RPCs are managed in Supabase, not in this repo. If you fork, point `URL`/`KEY`
> in `leaderboard.js` (and `TURN_API` in `game.js`) at your own project and recreate the
> two tables + three RPCs.

---

## Development
No install needed to run (open `index.html`). Tooling is for tests only.

```bash
npm test            # CI gate: node --check (syntax) + brackettest.mjs (headless logic)
npm run test:browser  # Playwright smoke/goal/wk tests (need Chrome: npx playwright install chrome)
npm run test:lb       # writes a real leaderboard row — run manually, not in CI
```
- **`brackettest.mjs`** loads `game.js` in a Node `vm` with a minimal DOM stub and drives
  the tournament/physics logic — no browser. This is what CI runs.
- The Playwright tests navigate with `?debug=1`, which exposes `window.__G` / `window.__TEAMS`
  (gated to localhost/`?debug=1` so production stays clean). They pin `channel:'chrome'`.
- **CI** (`.github/workflows`): on every push/PR runs `npm run check` + `npm run test:logic`
  on Node 20. Browser tests need a browser + network, so they're run manually.

## Deploy
Static site on **Netlify** (publish dir = repo root, no build). Push to `main` → auto-deploy.
The service worker is **network-first**, so deploys show immediately; bump `CACHE` in
`service-worker.js` when assets change to evict old caches.

## Contributing
- Keep the **no-build** model: edit `game.js` / `style.css` / `index.html` directly.
- Match the existing style (terse, commented by section). Run `npm test` before pushing.
- Beware shadowing the global `t()` translation function with a local `t` variable.
- PRs: branch off `main`, keep CI green, squash-merge.

---
Built for the 2026 World Cup. ⚽
