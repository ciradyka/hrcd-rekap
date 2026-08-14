/* ============================================================================
   hrcd-rekap : config.js — satu-satunya file yang berbeda antara lingkungan.
   Mode 'dev'      : uji lokal (tests/dev_server.py + Postgres lokal).
   Mode 'supabase' : produksi — isi nilai di bawah, JANGAN pernah menaruh
                     service key di sini (anon key memang publik).
   ========================================================================== */

window.HRCD = {
  mode: "supabase",
  // Dipakai HANYA saat mode "dev". Ditulis di sini supaya mengganti satu kata
  // di baris atas benar-benar cukup untuk mencoba layar secara lokal — persis
  // seperti yang dijanjikan README. Tanpa baris ini, api.js memakai devUrl
  // yang kosong dan setiap permintaan mendarat di penyaji berkas statis, yang
  // menjawabnya dengan "501 Unsupported method ('POST')".
  devUrl: "http://127.0.0.1:8787",
  supabaseUrl: "https://pwszijhnftvqjkdldqrf.supabase.co",
  anonKey: "sb_publishable_fVRvaYucCPJxOiphJWC_ZQ_8hgFKDsi",
  gatewayUrl: "https://gateway.ciradyka.workers.dev",
  // Situs peserta — pendaftaran + rekap live. Berdiri di Worker sendiri sejak
  // 14 Agustus 2026 (lihat live/wrangler.toml). Ditulis di sini, bukan di
  // dalam app.js, karena alamatnya berganti tiap edisi bersama nomor
  // edisinya — dan config.js memang satu-satunya berkas yang berbeda antar
  // lingkungan.
  pesertaUrl: "https://hrcd37.ciradyka.workers.dev",
  domainAkun: "ciradyka.com",   // username + '@' + domain ini = email auth
  // turnstileSiteKey sengaja tidak diisi — Turnstile dinonaktifkan untuk
  // edisi 37 (keputusan sadar, lihat workers/gateway/worker.js).
};
