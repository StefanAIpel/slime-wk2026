/* ============================================================================
   Slimescore — Supabase REST (anon publishable key + RLS).
   No SDK: direct fetch to /rest/v1. Key is public/safe (RLS).
   Shared project "Familie Trivia". Table: slime_volley_leaderboard.
   Anti-cheat: submit posts the match FACTS to a SECURITY DEFINER RPC that
   recomputes the points server-side; the client can't post inflated points.
   ============================================================================ */
(function () {
  'use strict';
  const URL = 'https://eymkdhdmekcxbapmyask.supabase.co';
  const KEY = 'sb_publishable_Iizoz0duFVLID2xYpphhGw_kUPUuXUI';
  const TABLE = 'slime_volley_leaderboard';
  const headers = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' };

  async function rpc(fn, args) {
    try {
      const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method:'POST', headers, body: JSON.stringify(args||{}) });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  // Submit a 1-player win. Server recomputes points from the facts. Returns points|null.
  async function submit(entry) {
    try {
      const r = await rpc('slime_volley_submit', {
        p_name:  String(entry.name || 'Anonymous').slice(0, 20),
        p_team:  String(entry.team || '').slice(0, 4),
        p_diff:  String(entry.diff || 'normal'),
        p_towin: entry.toWin | 0,
        p_sf:    entry.sf | 0,
        p_sa:    entry.sa | 0,
      });
      const v = Array.isArray(r) ? r[0] : r;
      return (v === null || v === undefined) ? null : v;
    } catch (e) { return null; }
  }

  async function top(limit = 12) {
    try {
      const q = `select=name,team,diff,points,created_at&order=points.desc,created_at.desc&limit=${limit}`;
      const res = await fetch(`${URL}/rest/v1/${TABLE}?${q}`, { headers });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  // 1-based rank of a score = (# strictly-higher) + 1, via an exact count header.
  async function rank(points) {
    try {
      const res = await fetch(`${URL}/rest/v1/${TABLE}?select=points&points=gt.${points | 0}`,
        { headers: Object.assign({ 'Prefer': 'count=exact', 'Range': '0-0' }, headers) });
      const cr = res.headers.get('content-range') || '';
      const total = parseInt(cr.split('/')[1], 10);
      return Number.isFinite(total) ? total + 1 : null;
    } catch (e) { return null; }
  }

  window.Leaderboard = { submit, top, rank, enabled: true };
})();
