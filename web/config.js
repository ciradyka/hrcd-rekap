/* ============================================================================
   hrcd-rekap : config.js — satu-satunya file yang berbeda antara lingkungan.
   Mode 'dev'      : uji lokal (tests/dev_server.py + Postgres lokal).
   Mode 'supabase' : produksi — isi nilai di bawah, JANGAN pernah menaruh
                     service key di sini (anon key memang publik).
   ========================================================================== */

window.HRCD = {
  mode: "supabase",
  supabaseUrl: "https://pwszijhnftvqjkdldqrf.supabase.co",
  anonKey: "sb_publishable_fVRvaYucCPJxOiphJWC_ZQ_8hgFKDsi",
  gatewayUrl: "https://gateway.ciradyka.workers.dev",
  domainAkun: "ciradyka.com",   // username + '@' + domain ini = email auth
  // turnstileSiteKey sengaja tidak diisi — Turnstile dinonaktifkan untuk
  // edisi 37 (keputusan sadar, lihat workers/gateway/worker.js).
};
