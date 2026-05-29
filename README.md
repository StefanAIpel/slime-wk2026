# ⚽🟧 Slime WK 2026

Retro **slime soccer** voor het WK 2026 — Nederland centraal, 16 landen.
Speel tegen de computer, met z'n tweeën op dezelfde pc, of **online tegen een vriend**.
Werkt op desktop én mobiel. Pure HTML5 canvas + vanilla JS, geen build.

## Spelen
- **Online (gedeployed):** zie de Netlify-URL.
- **Lokaal:** open `index.html` in je browser (dubbelklik). Online-modus vereist internet (PeerJS).

## Modi
- **1 speler** — vs computer (Makkelijk → WK-niveau)
- **2 spelers** — zelfde toetsenbord
- **Online** — peer-to-peer via een 4-letter code (geen account, geen server)

## Besturing
| | Bewegen | Springen |
|---|---|---|
| Speler 1 | `A` / `D` of ◀ ▶ | `W` / `Spatie` / ▲ |
| Speler 2 (2P) | pijltjes ← → | pijltje ↑ |
| Mobiel | touch-knoppen | touch-knop |

`ESC` = pauze (lokale modi).

## Techniek
- **Render/physics:** Canvas 2D, vaste 60Hz tijdstap.
- **Geluid:** volledig gesynthetiseerd via Web Audio (geen assets).
- **Online:** [PeerJS](https://peerjs.com) WebRTC, host-authoritative netcode.
- **Leaderboard:** Supabase REST (anon key + RLS), tabel `slime_leaderboard`.

## Ontwikkeling
```bash
# headless smoketest (vereist Chrome + playwright)
node smoketest.mjs
node goaltest.mjs
```

## Deploy
Statische site → Netlify (publish dir = root, geen build). Push naar `main` deployt automatisch.

---
Gemaakt voor het WK 2026. Hup Holland Hup! 🟧
