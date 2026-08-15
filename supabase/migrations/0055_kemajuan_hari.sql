-- ============================================================================
-- hrcd-rekap : 0055_kemajuan_hari.sql
--
-- Tiga angka kemajuan hari-H, satu baris, untuk lencana di layar Home.
--
-- ---------------------------------------------------------------------------
-- KENAPA SATU VIEW, BUKAN TIGA QUERY DARI KLIEN
--
-- Home dibuka tiap kali panitia kembali dari layar lain — puluhan kali sehari,
-- oleh belasan orang. `ringkasanMeja()` sudah menembakkan dua permintaan;
-- menambah tiga lagi menjadikannya lima, untuk tiga angka yang database bisa
-- hitung sekaligus dalam satu kali jalan.
--
-- ---------------------------------------------------------------------------
-- PENYEBUTNYA BERANTAI, DAN ITU DISENGAJA
--
--   berangkat / siap      — dari yang sudah bernomor dada, berapa yang jalan
--   datang    / berangkat — dari yang jalan, berapa yang sudah pulang
--
-- Pembilang yang satu jadi penyebut berikutnya. Regu tidak bisa datang tanpa
-- berangkat, jadi menghitung kedatangan terhadap SELURUH regu akan
-- menampilkan angka yang tidak mungkin penuh sampai kloter terakhir lepas —
-- dan angka yang tidak pernah bisa penuh berhenti dibaca.
--
-- ---------------------------------------------------------------------------
-- YANG SEBENARNYA DIJAWAB ANGKA KEDUA
--
-- Selisihnya: berangkat dikurangi datang = REGU YANG MASIH DI JALUR. Itu bukan
-- statistik, itu hitungan kepala. Angka itu harus nol sebelum ada panitia yang
-- pulang, dan sepanjang sore ia satu-satunya yang menjawab "masih ada berapa
-- di luar sana".
--
-- ---------------------------------------------------------------------------
-- TERBUKA UNTUK SELURUH PANITIA
--
-- Tidak ada nilai, tidak ada peringkat, tidak ada PII — cuma tiga hitungan.
-- Operator pos pun boleh melihatnya; ia berdiri di jalur dan pertanyaan
-- "masih ada berapa" juga miliknya.
-- ============================================================================

create or replace view v_kemajuan_hari as
with siap as (
  select r.id
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  where not r.is_cancelled
    and d.status = 'lunas'
    and r.nomor_dada is not null
)
select
  (select count(*) from siap)::int                                as regu_siap,
  (select count(*) from siap s
   join keberangkatan_regu kb on kb.regu_id = s.id)::int          as regu_berangkat,
  (select count(*) from siap s
   join closing_regu c on c.regu_id = s.id)::int                  as regu_datang;

comment on view v_kemajuan_hari is
  'Tiga hitungan untuk lencana Home: siap (bernomor dada), berangkat, datang. '
  'berangkat - datang = regu yang masih di jalur, dan itu harus nol sebelum '
  'panitia pulang.';

grant select on v_kemajuan_hari to authenticated;
