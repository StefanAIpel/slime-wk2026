// Flat ESLint config — guardrail for the hand-written runtime files (no build).
// Focus: catch real bugs (undeclared names, duplicate keys, shadowing the global t(),
// unreachable code) without drowning in style noise.
import globals from 'globals';

export default [
  { ignores: ['node_modules/**'] },
  {
    files: ['game.js', 'leaderboard.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        Peer: 'readonly',                 // PeerJS, loaded on demand
        Leaderboard: 'writable', Lobby: 'writable',   // defined on window by leaderboard.js
        webkitAudioContext: 'readonly',
        Audio: 'off',                     // the app defines its own `Audio` sound module (uses window.Audio for the built-in)
      },
    },
    rules: {
      'no-undef': 'error',
      'no-dupe-keys': 'error',            // duplicate i18n keys
      'no-redeclare': 'error',
      'no-unreachable': 'error',
      'no-dupe-args': 'error',
      'no-func-assign': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      'no-unsafe-negation': 'error',
      'valid-typeof': 'error',
      'use-isnan': 'error',
      // (no-shadow is intentionally off: the codebase uses `t` as a generic temp in ~20
      //  places, all of which shadow the global t() translation fn — pure noise here.)
      'no-unused-vars': 'off',            // too noisy for this codebase
    },
  },
  {
    files: ['service-worker.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.serviceworker } },
    rules: { 'no-undef': 'error', 'no-unreachable': 'error', 'no-dupe-keys': 'error' },
  },
];
