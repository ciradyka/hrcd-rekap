-- ============================================================================
-- hrcd-rekap : 0112_buang_v_klasemen_pratinjau.sql
-- Buang `v_klasemen_pratinjau` — nama yang sudah dinyatakan tidak dipakai lagi
-- oleh 0050, lalu tanpa sengaja dihidupkan kembali oleh 0065.
--
-- ---------------------------------------------------------------------------
-- RIWAYATNYA, KARENA INILAH YANG MEMBUATNYA MUDAH TERULANG
--
-- 0049 membuat `v_klasemen_pratinjau`. 0050 menggantinya jadi
-- `v_klasemen_live_score` dengan alasan yang ditulis panjang di kepalanya:
--
--     Satu hal dengan dua nama — "Live Score" di menu, `pratinjau` di kode —
--     memaksa setiap percakapan berikutnya membayar ongkos penerjemahan, dan
--     pemelihara berikutnya adalah siswa SMA yang tidak ikut percakapan ini.
--
-- 0065 lalu menulis `drop view if exists v_klasemen_pratinjau;` diikuti
-- `create or replace view v_klasemen_pratinjau ...` — nama lamanya lahir
-- kembali sebagai view KEDUA, bukan sebagai penggantian yang sudah ada.
--
-- ---------------------------------------------------------------------------
-- KENAPA INI BUKAN SEKADAR SAMPAH
--
-- Dua view berisi klasemen yang sama dengan pagar hak yang BERBEDA:
--
--   v_klasemen_live_score   lewat klasemen_live_score(), boleh('live_score')
--                           sejak 0067/0069 — INI yang dibaca layar
--   v_klasemen_pratinjau    boleh('pengaturan') — tidak dibaca apa pun
--
-- Siapa pun yang bertanya "siapa boleh melihat klasemen lebih awal" bisa
-- menemukan yang salah lebih dulu, dan yang salah justru yang namanya sudah
-- dinyatakan mati. CLAUDE.md 13.1 melarang dua mekanisme untuk satu
-- pertanyaan; ini bentuknya yang lain.
--
-- ---------------------------------------------------------------------------
-- EMPAT VIEW LAIN YANG SEMPAT DICURIGAI SAMA — DIPERIKSA, DAN TIDAK SAMA
--
-- Pemindaian yang menemukan ini juga menyebut `v_barak`, `v_kwitansi`,
-- `v_lembar_nilai`, dan `v_monitoring_input` sebagai "tidak dibaca siapa pun".
-- Diperiksa satu per satu di luar berkas migrasi, dan tiga di antaranya
-- ternyata punya pembaca:
--
--   v_monitoring_input   tests/sql/03_alur.sql, 08_lembar_pos.sql, 31_view_hak.sql
--   v_lembar_nilai       tests/sql/03_alur.sql
--   v_barak              tests/sql/03_alur.sql
--
-- Tes yang menduduki kursi hak (31) memakai `v_monitoring_input` justru untuk
-- membuktikan isolasi pos, jadi membuangnya berarti membuang penjaganya.
-- Ketiganya DIBIARKAN, dan catatan ini ada supaya pemindaian berikutnya tidak
-- mengangkatnya lagi dari nol.
--
-- `v_kwitansi` memang tidak punya pembaca di mana pun — kwitansi dicetak dari
-- sisi layar, bukan dari view ini. Ia sengaja TIDAK ikut dibuang di sini:
-- membuangnya keputusan pemilik acara, bukan keputusan berkas ini, dan tidak
-- ada yang mendesak lima hari sebelum lomba.
-- ============================================================================

drop view if exists v_klasemen_pratinjau;

do $blok$
begin
  assert not exists (select 1 from pg_views
                     where schemaname = 'public'
                       and viewname = 'v_klasemen_pratinjau'),
    '0112: v_klasemen_pratinjau masih ada';

  -- Yang dipakai layar tidak boleh ikut terbawa.
  assert exists (select 1 from pg_views
                 where schemaname = 'public'
                   and viewname = 'v_klasemen_live_score'),
    '0112: v_klasemen_live_score ikut hilang — ini yang dibaca layar';

  raise notice '0112: v_klasemen_pratinjau dibuang; klasemen tinggal satu nama.';
end;
$blok$;
