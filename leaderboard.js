/* ============================================================================
   Leaderboard — Supabase REST (anon publishable key + RLS).
   Geen SDK nodig: directe fetch naar /rest/v1. Key is publiek/veilig (RLS).
   Project: "Familie Trivia" (gedeeld). Tabel: slime_leaderboard.
   ============================================================================ */
(function () {
  'use strict';
  const URL = 'https://eymkdhdmekcxbapmyask.supabase.co';
  const KEY = 'sb_publishable_Iizoz0duFVLID2xYpphhGw_kUPUuXUI';
  const TABLE = 'slime_leaderboard';
  const headers = {
    'apikey': KEY,
    'Authorization': 'Bearer ' + KEY,
    'Content-Type': 'application/json',
  };

  // Submit a World Cup run via the RPC, which recomputes the points server-side from the
  // match facts (anti-cheat: the client can't post inflated points). Returns points|null.
  async function submit(entry) {
    try {
      const r = await rpc('slime_submit_score', {
        p_name: String(entry.name || 'Anonymous').slice(0, 20),
        p_team: String(entry.team || '').slice(0, 4),
        p_diff: String(entry.diff || 'rising'),
        p_rounds: entry.rounds | 0,
        p_champion: !!entry.champion,
        p_gf: entry.gf | 0,
        p_ga: entry.ga | 0,
      });
      const v = Array.isArray(r) ? r[0] : r;
      return (v === null || v === undefined) ? null : v;
    } catch (e) { return null; }
  }

  async function top(limit = 10) {
    try {
      const q = `select=name,team,score_for,score_against,points,difficulty,created_at` +
                `&order=points.desc,created_at.desc&limit=${limit}`;
      const res = await fetch(`${URL}/rest/v1/${TABLE}?${q}`, { headers });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  // --- Quick-match lobby (atomic pairing via SECURITY DEFINER RPCs) ---
  async function rpc(fn, args) {
    try {
      const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers, body: JSON.stringify(args || {}),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }
  window.Lobby = {
    // returns { role:'host'|'guest', host_code:string|null } or null on error
    async findOrWait(code, name) {
      const r = await rpc('slime_find_or_wait', { p_code: code, p_name: name || null });
      return Array.isArray(r) ? (r[0] || null) : (r && r.role ? r : null);
    },
    cancel(code) { return rpc('slime_cancel', { p_code: code }); },
    // aggregate-only lobby activity: { waiting, playing } or null on error
    async count() {
      const r = await rpc('slime_online_count', {});
      const row = Array.isArray(r) ? r[0] : r;
      return row ? { waiting: row.waiting | 0, playing: row.playing | 0 } : null;
    },
  };

  window.Leaderboard = { submit, top, enabled: true };
})();
