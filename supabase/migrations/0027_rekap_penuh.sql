-- ============================================================================
-- hrcd-rekap : 0027_rekap_penuh.sql
--
-- Dua hal, dan keduanya soal "siapa boleh melihat apa, kapan":
--
--   1. `v_rekap_penuh` — lembar Rekapitulasi lengkap untuk PANITIA. Bentuknya
--      meniru spreadsheet yang dipakai panitia selama tujuh tahun: satu baris
--      per regu, SATU KOLOM PER KOMPONEN (bukan per pos), Nilai Pos di ujung
--      tiap kelompok, lalu kolom waktu, lalu Nilai Total.
--
--   2. `v_progres_publik` dibuka sejak hari pertama, bukan sejak fase
--      'progres'.
--
-- ---------------------------------------------------------------------------
-- KENAPA REKAP PANITIA TIDAK MEMAKAI v_lembar_pos SAJA
--
-- `v_lembar_pos` melayani satu pos dan sengaja begitu: operator pos hanya
-- boleh melihat posnya sendiri. Rekap ini kebalikannya — ia hanya berguna
-- kalau memuat SELURUH pos sekaligus, dan itu berarti ia bukan untuk operator
-- pos. Pagarnya dipasang di dalam view: `peran() in ('admin','meja')`.
--
-- Itu bukan sekadar soal hak akses melainkan soal angka yang jujur. View ini
-- `security_invoker`, jadi RLS `sel_nilai` ikut menggigit: operator pos hanya
-- membaca `nilai_mentah` pos-nya sendiri. Kalau ia dibiarkan membuka rekap,
-- kolom pos lain kosong DAN Nilai Total ikut mengecil — bukan tampilan sempit
-- melainkan tampilan PALSU, yang justru dilarang rancangan-b.md 14.6. Lebih
-- baik nol baris daripada total yang salah.
--
-- ---------------------------------------------------------------------------
-- KENAPA PERINGKAT DIAMBIL DARI v_klasemen, BUKAN DIHITUNG ULANG DI SINI
--
-- Menulis `rank() over (...)` sekali lagi di berkas ini akan melahirkan mesin
-- peringkat kedua yang suatu hari berbeda pendapat dengan yang pertama —
-- persis kesalahan yang dijaga ketat di layar Input Pos (layar tidak pernah
-- menghitung skor sendiri). Jadi peringkat di-LEFT JOIN dari `v_klasemen`.
--
-- Akibatnya yang harus dipahami pembaca: regu yang belum diceklis berangkat,
-- atau yang kloternya belum berangkat, TIDAK punya peringkat — kolomnya
-- kosong. Itu memang aturan klasemen (rancangan-b.md 11.12), dan sepanjang
-- lomba berjalan sebagian besar baris memang belum berperingkat. Nilainya
-- tetap terlihat; yang belum ada hanya nomor urutnya.
--
-- ---------------------------------------------------------------------------
-- HALAMAN PESERTA TIDAK DISENTUH BERKAS INI
--
-- `v_progres_publik` tetap terkunci di fase 'progres'/'penuh' (0026): sebelum
-- lomba dimulai, peserta tidak melihat rekap apa pun. Itu keputusan panitia,
-- dan berkas ini sengaja tidak melonggarkannya — satu-satunya yang ditambahkan
-- di sini adalah layar untuk panitia sendiri.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Rekapitulasi lengkap untuk panitia
--
-- `nilai` dan `poin_pos` berbentuk objek JSON, bukan larik, supaya layar bisa
-- langsung mencari kolomnya tanpa memindai apa pun — pola yang sama dengan
-- v_lembar_pos (0023).
--
--   nilai    = {"1.semaphore": {"nilai_1": 5, "nilai_2": null}, ...} SEMUA pos
--   poin_pos = {"1": 260.00, "2": 220.00, ...}
--
-- Kuncinya diberi awalan nomor pos, dan itu bukan hiasan: `wahana.kode` hanya
-- unik per (edisi, pos, kode), bukan per edisi. Dua pos yang kebetulan memakai
-- kode yang sama akan saling menimpa kalau kuncinya cuma kodenya — dan yang
-- hilang adalah kolom nilai, tanpa satu pun galat.
-- ---------------------------------------------------------------------------
create view v_rekap_penuh with (security_invoker = on) as
select
  r.id            as regu_id,
  kl.peringkat,
  r.nomor_dada,
  r.nama_regu,
  s.name          as nama_sekolah,
  r.golongan,

  coalesce((
    select jsonb_object_agg(w.pos || '.' || w.kode, jsonb_build_object(
             'nilai_1', n.nilai_1, 'nilai_2', n.nilai_2))
    from nilai_mentah n
    join wahana w on w.id = n.wahana_id
    where n.regu_id = r.id and w.edisi = edisi_aktif()
  ), '{}'::jsonb) as nilai,

  coalesce((
    select jsonb_object_agg(pp.pos::text, pp.poin_pos)
    from v_poin_pos pp
    where pp.regu_id = r.id
  ), '{}'::jsonb) as poin_pos,

  r.kloter_nomor  as kloter,
  k.jam_berangkat,
  c.jam_datang,
  r.kontrak_menit,
  pw.selisih_menit,
  -- Lama tempuh sebenarnya, dalam menit. Panitia memakainya untuk membaca
  -- selisih tanpa menghitung di kepala: tempuh 245 menit dengan kontrak 240
  -- berarti telat 5. Spreadsheet lama memecahnya jadi kolom jam dan kolom
  -- menit terpisah karena rumusnya butuh begitu; di sini satu angka cukup.
  case when k.jam_berangkat is not null and c.jam_datang is not null
    then round(extract(epoch from (c.jam_datang - k.jam_berangkat)) / 60)::int
  end             as tempuh_menit,
  c.anggota_hadir,

  t.total_pos,
  pw.penalti_waktu,
  t.penalti_checkout,
  t.penalti_anggota,
  t.total,

  exists (select 1 from keberangkatan_regu kb where kb.regu_id = r.id)
                  as sudah_berangkat,
  (c.regu_id is not null) as sudah_closing

from regu r
join pendaftaran d      on d.id = r.pendaftaran_id
join sekolah s          on s.id = d.sekolah_id
join v_total_skor t     on t.regu_id = r.id
join v_penalti_waktu pw on pw.regu_id = r.id
left join v_klasemen kl on kl.regu_id = r.id
left join kloter k      on k.nomor = r.kloter_nomor
left join closing_regu c on c.regu_id = r.id
where peran() in ('admin', 'meja');

-- Grant per-view, bukan massal — pola yang sama dengan 0005 dan 0023. `anon`
-- sengaja TIDAK disebut: rekap ini memuat angka nilai sebelum diumumkan, dan
-- satu-satunya jalur anon ke database memang tidak boleh menyentuhnya.
grant select on v_rekap_penuh to authenticated;

comment on view v_rekap_penuh is
  'Lembar Rekapitulasi lengkap untuk panitia: satu baris per regu, nilai '
  'mentah tiap komponen SELURUH pos, Nilai Pos per pos, kolom waktu, dan '
  'Nilai Total. Hanya admin dan meja — operator pos akan mendapat total yang '
  'salah karena RLS memotong nilai_mentah pos lain.';
