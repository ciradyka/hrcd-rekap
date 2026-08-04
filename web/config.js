/* ============================================================================
   hrcd-rekap : config.js — satu-satunya file yang berbeda antara lingkungan.
   Mode 'dev'      : uji lokal (tests/dev_server.py + Postgres lokal).
   Mode 'supabase' : produksi — isi nilai di bawah, JANGAN pernah menaruh
                     service key di sini (anon key memang publik).
   ========================================================================== */

window.HRCD = {
  mode: "dev",
  devUrl: "http://127.0.0.1:8787",

  // --- produksi (mode: "supabase") ---
  // supabaseUrl: "https://xxxx.supabase.co",
  // anonKey:     "eyJ...",
  // gerbangUrl:  "https://gerbang.hrcd.workers.dev",
  // domainAkun:  "panitia.hrcd.local",   // username + '@' + domain ini = email auth
  // turnstileSiteKey: "0x4AAA...",
};
