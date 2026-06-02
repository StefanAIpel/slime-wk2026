# Slime Volleyball — porting guide & gap analysis

What the volley app currently has, what was **left out** when it was derived from
Slime Soccer, and exactly where the soccer source lives so you can port it.

> Soccer source = the repo root (`game.js`, `leaderboard.js`, `style.css`,
> `index.html`). Line numbers are approximate anchors in soccer `game.js` (~2495 lines).

## What volley already has ✅
1P vs AI (Easy→Pro) · 2P local · first-to **3/5/7** · net physics + **smash** (no catch) ·
**12s auto-serve** · 12 nations + SVG flags · NL/EN i18n · settings · touch controls · PWA ·
fully-synth audio · **Slimescore** (1P-win leaderboard, anti-cheat) + cross-link to Slime Soccer.

## Missing vs soccer (to port) ❌

### 1. World Cup / 1-player tournament  ← highest value, no networking
Soccer has a full 16-team knockout: you play your match each round, others are simulated.
- **Soccer source:** `setupWK()` ~1659, `showWKStage()` ~1728, `wkStartMatch()` ~1746,
  `wkMatchEnd()` ~1753, `wkSim()`/`wkPlayOut()` ~1675, `wkBuildNextRound()`, `wkBracketHTML()` ~1707,
  `wkPoints()` ~1789, `submitWKRun()` ~1831 → RPC `slime_submit_score`. Per-round difficulty via
  `effDiff()` ~786 (`WK_DIFFS` "rising"). DOM `#wkScreen`; bracket CSS in `style.css` (`.bracket`,`.bk-*`).
- **Port into volley:**
  - Reuse the bracket data model + `wkSim` (seed by `team.strength`, already on volley TEAMS).
  - Each user match is **first-to-N** (volley) instead of a timed match — call the existing
    volley match flow (`startMatch`/`setupServe`), then in `endMatch()` branch to a `wkMatchEnd`.
  - Copy `#wkScreen` markup + the `.bracket`/`.bk-*` CSS over to `volley/`.
  - Scoring/points: add a `slime_volley_cup_submit` RPC (or extend `slime_volley_submit` with a
    `p_rounds`/`p_champion`) so cup runs post to `slime_volley_leaderboard` with the anti-cheat pattern.
  - Pool size: volley has 12 teams → use an **8-team** bracket (or add teams) instead of 16.

### 2. Online (P2P, host-authoritative)  ← biggest job; backend already exists
Soccer plays online over PeerJS with the host simulating and broadcasting state.
- **Soccer source (game.js §11 "Online netcode" ~1071):** `makeNet()` ~1113,
  `iceServers()`/`TURN_SERVERS` ~1081 + `TURN_API` (edge fn `slime-turn`) ~1089,
  `buildOnlineSlimes()` ~1057, `packEnt`/`packBall`/`sendStateMaybe`/`applyNetState()` ~1196,
  `randomCode()`, `goOnline()` ~1932, lobby UI ~1932-2050, `ensurePeer()` (peerjs@1.5.4 via unpkg) ~1923.
  - **Lobby/matchmaking:** `leaderboard.js` → `window.Lobby` (`findOrWait`/`cancel`/`count`) →
    RPCs `slime_find_or_wait` / `slime_cancel` / `slime_online_count` + table `slime_lobby`. **Reusable as-is.**
  - **DOM:** `#onlineScreen` (host/join, share code, WhatsApp/copy-link) + `#matchupScreen` confirm.
- **Port into volley:**
  - `makeNet()` is host-authoritative → maps cleanly. The host already owns scoring (floor touch),
    so guests just render + send their input.
  - **Sync these in the state payload:** `ball`, both slimes, `score`, `G.screen`, **and the serve
    state** (`server`, `serveTimer`) — volley has a SERVE phase soccer doesn't (`applyNetState` must handle it).
  - **Input packet must include the smash/`down` bit** (used mid-air), not just left/right/jump.
  - Drop soccer-only fields from the payload: `matchMode`, `golden`, `matchTime`. Win = first-to-N.
  - TURN (`slime-turn`) + `Lobby` + `slime_lobby` need **no changes** — reuse the same backend.

### 3. Timed match mode + golden goal  ← optional (volley spec said no timed mode)
- **Soccer source:** `settings.matchMode` `'goals'|'time'` ~159, `updateMatchTimer()` ~1011,
  `G.golden`, scoreboard clock ~1466. By spec volley is **first-to-N only**, so this is likely a skip;
  port only if you want a "best in X minutes / most rallies" variant.

### 4. Bigger team pool / extras  ← optional
Soccer has 24 nations; volley has 12 (by design). Add more FIVB nations if you want a 16-team cup.

## Intentionally dropped — do NOT port (these are by design)
- **Catch / hold ball** (`tryCatch` ~673, `holdBall` ~684, `releaseBall` ~700, `HOLD_MAX`) →
  replaced by the mid-air **smash**. Volleyball has no catch.
- **Anti-goal-camping** (`inCampZone` ~1023, `updateAntiCamp` ~1024, `drawCampZones`) → N/A (no goals).
- **Audio asset files** (`assets/audio/*.mp3`) → volley is fully synthesized on purpose.

## Volley-specific gotchas when porting any soccer code
- Slimes are **constrained to their own half** by the net (`clamp` in `updateSlime`), not the full field.
- Scoring is a **floor touch** → rally point; the **winner serves** next; match ends at **first-to-N**
  (no timer, no golden goal).
- There is a **SERVE phase** (`SCREEN.SERVE`, `setupServe`, 12s auto-serve) with no soccer equivalent —
  any new match flow (tournament/online) must route through it.
- Brand/colours follow **SlimeScore** (royal blue + orange + gold); reuse `volley/style.css` tokens.

## Suggested order
1. **1P tournament** (self-contained, reuses volley match flow + soccer bracket model).
2. **Online** (reuse `makeNet` + the existing `Lobby`/TURN backend; add serve-state sync).
3. Optional: more teams / a timed variant.
