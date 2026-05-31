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

  async function submit(entry) {
    try {
      const body = {
        name: String(entry.name || 'Anonymous').slice(0, 20),
        team: String(entry.team || '').slice(0, 4),
        score_for: Math.max(0, Math.min(99, entry.score_for | 0)),
        score_against: Math.max(0, Math.min(99, entry.score_against | 0)),
        points: Math.max(0, Math.min(99999, entry.points | 0)),
        mode: entry.mode || '1p',
        difficulty: (entry.difficulty || '').slice(0, 12),
      };
      const res = await fetch(`${URL}/rest/v1/${TABLE}`, {
        method: 'POST',
        headers: Object.assign({ 'Prefer': 'return=minimal' }, headers),
        body: JSON.stringify(body),
      });
      return res.ok;
    } catch (e) { return false; }
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
  };

  window.Leaderboard = { submit, top, enabled: true };
})();
