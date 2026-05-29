# ⚽ World Cup Slime

Retro **slime soccer** in a modern kit — a remake of the early-2000s *Slimiathlete /
Slime Soccer* vibe, tied to the **2026 World Cup**. Play the computer, two players on
the same screen, or **online against a friend**. Mobile-first, but plays great on
desktop with WASD / arrow keys. Pure HTML5 canvas + vanilla JS, no build step.

## Play
- **Online (deployed):** see the Netlify URL.
- **Local:** open `index.html` in your browser (double-click). Online mode needs internet (PeerJS).

## Modes
- **🏆 World Cup** — a real, randomly-seeded **16-team knockout**. The 20-country pool is
  drawn fresh every tournament (your pick + 15 random others), so the bracket is never
  fixed in advance. You play your own 2-minute match each round; the other matches are
  auto-simulated by team strength, so right after your match you see who advanced and who
  you face in the quarter-final. Win 4 rounds (R16 → QF → SF → Final) to lift the cup.
- **1 Player** — vs computer (Easy → World Cup level)
- **2 Players** — same keyboard
- **Online** — peer-to-peer via a 4-letter code (no account, no server)

## Controls
| | Move | Jump |
|---|---|---|
| Player 1 | `A` / `D` or ◀ ▶ | `W` / `Space` / ▲ |
| Player 2 (2P) | arrows ← → | arrow ↑ |
| Mobile | touch buttons | touch button |

`ESC` = pause (local modes).

## Tech
- **Render/physics:** Canvas 2D, fixed 60 Hz timestep.
- **Audio:** fully synthesized via Web Audio (no asset files).
- **Online:** [PeerJS](https://peerjs.com) WebRTC, host-authoritative netcode.
- **Leaderboard:** Supabase REST (anon key + RLS), table `slime_leaderboard`.
- **UI:** modern Rubik typography; the canvas pitch, floodlights, crowd and goals stay.

## Development
```bash
# headless bracket + runtime logic test (no browser needed)
node brackettest.mjs

# full browser smoke tests (require: npm i -D playwright + Chrome)
node smoketest.mjs
node goaltest.mjs
node wktest.mjs
node lbtest.mjs
```

## Deploy
Static site → Netlify (publish dir = root, no build). Pushing to `main` deploys automatically.

---
Built for the 2026 World Cup. ⚽
