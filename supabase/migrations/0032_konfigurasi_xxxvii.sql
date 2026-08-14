-- ============================================================================
-- hrcd-rekap : 0032_konfigurasi_xxxvii.sql
--
-- Format penilaian HRCD XXXVII. Seluruhnya DATA — tidak satu baris kode pun
-- ikut berubah, karena layar Input Pos dan Rekapitulasi memang membangun
-- kolomnya dari tabel `pos` dan `wahana`.
--
--   Pos 0  Keberangkatan        garis start, tidak dinilai
--   Pos 1  Teknik Kepramukaan   Semaphore, Tebak Simpul, Menaksir
--   Pos 2  Halang Rintang       Bakiak, Lari Balok, Balap Karung
--   Pos 3  P3K & Kim            Bidai (5 bagian), Kim Lihat, Kim Cium
--   Pos 4  PBB                  4 bagian
--   Pos 5  Yel-yel              4 bagian
--   Pos 6  Kedatangan           garis finish, tidak dinilai
--
-- ---------------------------------------------------------------------------
-- DIJAGA: HANYA JALAN KALAU BELUM ADA SATU NILAI PUN
--
-- Migrasi ini MENGGANTI seluruh konfigurasi penilaian satu edisi. Kalau
-- dijalankan setelah lomba mulai, nilai yang sudah masuk kehilangan komponen
-- induknya — dan yang hilang bukan angkanya saja, melainkan artinya.
--
-- Jadi bagian datanya dilewati bila `nilai_mentah` edisi ini sudah berisi.
-- Itu juga yang membuatnya aman di database uji, yang memang penuh nilai dari
-- tes 02-09: di sana migrasi ini tidak melakukan apa-apa, dan seluruh tes
-- yang bersandar pada konfigurasi XXXVI tetap hijau. Pola yang sama dipakai
-- 0024 ("bagian datanya dilewati").
--
-- ---------------------------------------------------------------------------
-- KEDATANGAN PINDAH DARI POS 5 KE POS 6
--
-- Format lama memakai Pos 5 sebagai garis finish. Format baru memakai Pos 5
-- untuk Yel-yel, jadi salah satunya harus mengalah. Yang pindah garis
-- finishnya, karena nomor pos penilaian disebut panitia di lapangan
-- ("Pos 5 yel-yel") sedangkan nomor garis finish tidak pernah disebut siapa
-- pun — ia dikenal sebagai "finish", bukan sebagai angka.
--
-- Pos 6 sebelumnya dipakai Kostum (pos bayangan XXXVI). Format XXXVII tidak
-- memuat pos bayangan, jadi barisnya dibuang lebih dulu.
--
-- ---------------------------------------------------------------------------
-- TIGA ANGKA YANG BELUM DITETAPKAN PANITIA — DITANDAI, BUKAN DISEMBUNYIKAN
--
-- 1. Tangga Menaksir baru disebut sampai "selisih 2-3 m = 60". Diteruskan di
--    sini mengikuti bentuk tangga Pos 2 yang memang sudah pasti (lima tingkat,
--    berhenti di 20): <=5 m = 40, lebih dari itu = 20.
-- 2. Kim Cium belum disebut berapa objeknya. Disamakan dengan Kim Lihat: 10.
-- 3. Bidai memakai daftar INPUT yang diberikan panitia (Posisi, Teknik,
--    Kerapihan & Kebersihan, Kecepatan, Kerja Sama). Uraian panitia menyebut
--    "diagnosis dan penanganan awal" sebagai kriteria pertama dan menggabung
--    kecepatan dengan kerja sama; keduanya sama-sama lima bagian x 20 = 100,
--    tapi isinya berbeda.
--
-- Ketiganya diubah dengan satu UPDATE satu baris — tidak perlu migrasi baru.
-- ============================================================================

do $$
declare
  v_edisi smallint;
  v_nilai int;
begin
  select nomor into v_edisi from edisi where is_active;
  if v_edisi is null then
    raise notice '0032: belum ada edisi aktif — bagian data dilewati.';
    return;
  end if;

  select count(*) into v_nilai
  from nilai_mentah n join wahana w on w.id = n.wahana_id
  where w.edisi = v_edisi;

  if v_nilai > 0 then
    raise notice '0032: edisi % sudah memuat % nilai — konfigurasi TIDAK diubah.',
      v_edisi, v_nilai;
    return;
  end if;

  -- ---------------------------------------------------------------------
  -- 1. Bersihkan konfigurasi lama edisi ini
  -- ---------------------------------------------------------------------
  delete from wahana where edisi = v_edisi;
  -- Kostum (pos bayangan XXXVI) tidak ada di format baru, dan nomornya
  -- dibutuhkan garis finish.
  delete from pos where edisi = v_edisi and nomor = 6;

  -- ---------------------------------------------------------------------
  -- 2. Pos
  -- ---------------------------------------------------------------------
  -- Garis finish dipindah lebih dulu supaya nomor 5 kosong untuk Yel-yel.
  update pos set nomor = 6 where edisi = v_edisi and nomor = 5;

  insert into pos (edisi, nomor, name, bobot, bayangan) values
    (v_edisi, 0, 'Keberangkatan',      1.00, false),
    (v_edisi, 1, 'Teknik Kepramukaan', 1.00, false),
    (v_edisi, 2, 'Halang Rintang',     1.00, false),
    (v_edisi, 3, 'P3K dan Kim',        1.00, false),
    (v_edisi, 4, 'PBB',                1.00, false),
    (v_edisi, 5, 'Yel-yel',            1.00, false),
    (v_edisi, 6, 'Kedatangan',         1.00, false)
  on conflict (edisi, nomor) do update
    set name = excluded.name, bobot = excluded.bobot,
        bayangan = excluded.bayangan;

  -- ---------------------------------------------------------------------
  -- 3. Komponen
  --
  -- Yang ditulis petugas selalu DATA MENTAH di tempat data mentah memang ada
  -- (jumlah benar, waktu, selisih), dan POIN hanya di tempat penilaiannya
  -- memang penghakiman juri (bidai, PBB, yel-yel). Yang kedua dinyatakan
  -- sebagai `besar_baik` dengan raw_terbaik = poin_maks: nilai mentahnya
  -- sama dengan poinnya, satu lawan satu.
  -- ---------------------------------------------------------------------
  insert into wahana (edisi, pos, kode, name, type, form, poin_maks,
                      raw_terbaik, raw_terburuk, poin_benar, poin_salah,
                      total_soal, tingkat, satuan, golongan,
                      rentang_mentah_min, rentang_mentah_maks, sort_order)
  values
    -- ---- Pos 1 — Teknik Kepramukaan (maks 300) ----
    -- 5 kata, 1 kata = 20 poin.
    (v_edisi, 1, 'semaphore', 'Semaphore', 'wahana', 'besar_baik',
     100, 5, 0, null, null, null, null, null, null, 0, 5, 1),

    -- Tebak Simpul: SATU lomba, DUA baris — skalanya berbeda per golongan
    -- (0030). Tiap regu hanya bisa mengisi barisnya sendiri; server menolak
    -- yang lain.
    (v_edisi, 1, 'tebak_simpul_pg_pa', 'Tebak Simpul', 'wahana', 'besar_baik',
     100, 5, 0, null, null, null, null, null, 'penggalang_pa', 0, 5, 2),
    (v_edisi, 1, 'tebak_simpul_pg_pi', 'Tebak Simpul', 'wahana', 'besar_baik',
     100, 5, 0, null, null, null, null, null, 'penggalang_pi', 0, 5, 2),
    (v_edisi, 1, 'tebak_simpul_pn_pa', 'Tebak Simpul', 'wahana', 'besar_baik',
     100, 10, 0, null, null, null, null, null, 'penegak_pa', 0, 10, 2),
    (v_edisi, 1, 'tebak_simpul_pn_pi', 'Tebak Simpul', 'wahana', 'besar_baik',
     100, 10, 0, null, null, null, null, null, 'penegak_pi', 0, 10, 2),

    -- Menaksir: yang ditulis SELISIH, jadi makin kecil makin baik — dan
    -- tangganya berhenti di 20, bukan 0 (dua tingkat terakhir asumsi).
    (v_edisi, 1, 'menaksir', 'Menaksir', 'wahana', 'bertingkat',
     100, null, null, null, null, null,
     '[{"sampai": 0, "poin": 100}, {"sampai": 1, "poin": 80},
       {"sampai": 3, "poin": 60}, {"sampai": 5, "poin": 40},
       {"sampai": 100000, "poin": 20}]'::jsonb,
     null, null, 0, 1000, 3),

    -- ---- Pos 2 — Halang Rintang (maks 300) ----
    -- Waktu dalam DETIK. Tingkat terakhir berbatas besar karena aturannya
    -- berhenti di 20 poin, bukan 0.
    (v_edisi, 2, 'bakiak', 'Bakiak', 'wahana', 'bertingkat',
     100, null, null, null, null, null,
     '[{"sampai": 30, "poin": 100}, {"sampai": 40, "poin": 80},
       {"sampai": 50, "poin": 60}, {"sampai": 60, "poin": 40},
       {"sampai": 100000, "poin": 20}]'::jsonb,
     'detik', null, 0, 3600, 1),
    (v_edisi, 2, 'lari_balok', 'Lari Balok', 'wahana', 'bertingkat',
     100, null, null, null, null, null,
     '[{"sampai": 30, "poin": 100}, {"sampai": 40, "poin": 80},
       {"sampai": 50, "poin": 60}, {"sampai": 60, "poin": 40},
       {"sampai": 100000, "poin": 20}]'::jsonb,
     'detik', null, 0, 3600, 2),
    (v_edisi, 2, 'balap_karung', 'Balap Karung', 'wahana', 'bertingkat',
     100, null, null, null, null, null,
     '[{"sampai": 20, "poin": 100}, {"sampai": 25, "poin": 80},
       {"sampai": 30, "poin": 60}, {"sampai": 40, "poin": 40},
       {"sampai": 100000, "poin": 20}]'::jsonb,
     'detik', null, 0, 3600, 3),

    -- ---- Pos 3 — P3K dan Kim (maks 300) ----
    -- Bidai: penilaian juri, jadi mentah = poin (raw_terbaik = poin_maks).
    (v_edisi, 3, 'bidai_posisi', 'Posisi Bidai', 'wahana', 'besar_baik',
     20, 20, 0, null, null, null, null, null, null, 0, 20, 1),
    (v_edisi, 3, 'bidai_teknik', 'Teknik Bidai', 'wahana', 'besar_baik',
     20, 20, 0, null, null, null, null, null, null, 0, 20, 2),
    (v_edisi, 3, 'bidai_kerapihan', 'Kerapihan dan Kebersihan', 'wahana', 'besar_baik',
     20, 20, 0, null, null, null, null, null, null, 0, 20, 3),
    (v_edisi, 3, 'bidai_kecepatan', 'Kecepatan', 'wahana', 'besar_baik',
     20, 20, 0, null, null, null, null, null, null, 0, 20, 4),
    (v_edisi, 3, 'bidai_kerja_sama', 'Kerja Sama', 'wahana', 'besar_baik',
     20, 20, 0, null, null, null, null, null, null, 0, 20, 5),
    -- 10 objek, gambar 15 detik lalu 30 detik menulis, berulang.
    (v_edisi, 3, 'kim_lihat', 'Kim Lihat', 'wahana', 'besar_baik',
     100, 10, 0, null, null, null, null, null, null, 0, 10, 6),
    -- 3 menit bebas mencium seluruh objek. Jumlah objek ASUMSI = 10.
    (v_edisi, 3, 'kim_cium', 'Kim Cium', 'wahana', 'besar_baik',
     100, 10, 0, null, null, null, null, null, null, 0, 10, 7),

    -- ---- Pos 4 — PBB (maks 100) ----
    (v_edisi, 4, 'pbb_sikap', 'Sikap Sempurna', 'wahana', 'besar_baik',
     20, 20, 0, null, null, null, null, null, null, 0, 20, 1),
    (v_edisi, 4, 'pbb_gerakan', 'Gerakan Dasar', 'wahana', 'besar_baik',
     30, 30, 0, null, null, null, null, null, null, 0, 30, 2),
    (v_edisi, 4, 'pbb_kekompakan', 'Kekompakan', 'wahana', 'besar_baik',
     30, 30, 0, null, null, null, null, null, null, 0, 30, 3),
    (v_edisi, 4, 'pbb_kerapihan', 'Kerapihan', 'wahana', 'besar_baik',
     20, 20, 0, null, null, null, null, null, null, 0, 20, 4),

    -- ---- Pos 5 — Yel-yel (maks 100) ----
    (v_edisi, 5, 'yel_kreativitas', 'Kreativitas', 'wahana', 'besar_baik',
     35, 35, 0, null, null, null, null, null, null, 0, 35, 1),
    (v_edisi, 5, 'yel_kekompakan', 'Kekompakan', 'wahana', 'besar_baik',
     25, 25, 0, null, null, null, null, null, null, 0, 25, 2),
    (v_edisi, 5, 'yel_semangat', 'Semangat', 'wahana', 'besar_baik',
     20, 20, 0, null, null, null, null, null, null, 0, 20, 3),
    (v_edisi, 5, 'yel_penampilan', 'Penampilan', 'wahana', 'besar_baik',
     20, 20, 0, null, null, null, null, null, null, 0, 20, 4);

  raise notice '0032: konfigurasi HRCD XXXVII terpasang untuk edisi %.', v_edisi;
end;
$$;
