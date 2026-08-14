-- ============================================================================
-- hrcd-rekap : seed.sql
-- Konfigurasi edisi 37 (contoh angka dari docs/rancangan-b.md 2.2) + baris
-- wajib: status_acara, kloter 1-40, stok nomor dada 1-500.
-- ============================================================================

insert into edisi (nomor, name, tahun, tanggal_lomba, biaya_per_regu,
                   maks_regu_per_kloter, kloter_dasar, kloter_maks,
                   lompatan_kloter, interval_berangkat_menit, is_active)
values (37, 'HRCD XXXVII', 2027, date '2027-02-21', 250000, 10, 30, 40, 2, 4, true);

-- Pos 0 dan Pos 5 adalah garis start dan garis finish (migrasi 0025): tempat
-- yang sama, disebut Pos 0 saat berangkat dan Pos 5 saat kembali. Keduanya
-- TIDAK dinilai — tidak punya baris wahana — dan yang dicatat di sana waktu.
-- Namanya ditulis di sini, bukan hanya di migrasi 0025, supaya database yang
-- disiapkan dari nol sudah benar tanpa perlu menjalankan ulang migrasi mana
-- pun. (Migrasi 0025 tetap ada untuk database yang sudah terlanjur berjalan.)
insert into pos (edisi, nomor, name, bobot) values
  (37, 0, 'Keberangkatan', 1.00),
  (37, 1, 'Pos 1', 1.00),
  (37, 2, 'Pos 2', 1.00),
  (37, 3, 'Pos 3', 1.00),
  (37, 4, 'Pos 4', 1.00),
  (37, 5, 'Kedatangan', 1.00);

-- Satu contoh per bentuk konversi — angka persis dari rancangan-b.md supaya
-- tes bisa mencocokkan hasil hitung dengan dokumen.
insert into wahana (edisi, pos, kode, name, type, form, poin_maks,
                    raw_terbaik, raw_terburuk, poin_benar, poin_salah,
                    total_soal, rentang_mentah_min, rentang_mentah_maks, sort_order)
values
  -- raw 40 detik => 100 * (90-40)/(90-20) = 71.43
  (37, 1, 'lari_zigzag',  'Lari Zig-zag',        'wahana', 'kecil_baik', 100,
   20, 90, null, null, null, 5, 300, 1),
  -- raw 3 kena dari maks 5 => 100 * (3-0)/(5-0) = 60
  (37, 2, 'lempar_sasaran', 'Lempar Sasaran',    'wahana', 'besar_baik', 100,
   5, 0, null, null, null, 0, 5, 1),
  -- centang => 50, tidak => 0
  (37, 3, 'impk',          'IMPK',               'soal',   'biner', 50,
   null, null, 50, 0, null, 0, 1, 1),
  -- 7 benar dari 10 => 100 * 7/10 = 70
  (37, 4, 'soal_umum',     'Soal Pengetahuan',   'soal',   'benar_per_total', 100,
   null, null, null, null, 10, 0, 10, 1),
  -- benar +10, salah -5 (poin_salah negatif), clamp [0, 100]
  (37, 5, 'sandi_morse',   'Sandi Morse',        'soal',   'benar_kurang_salah', 100,
   null, null, 10, -5, null, 0, 20, 1);

insert into kontrak_opsi (edisi, label, menit, sort_order) values
  (37, '3,5 jam', 210, 1),
  (37, '4 jam',   240, 2),
  (37, '4,5 jam', 270, 3);

insert into konfig_penalti (edisi, blok_menit, penalti_per_blok,
                            penalti_tanpa_checkout, penalti_per_anggota_hilang,
                            nilai_pos_terlewat)
values (37, 10, 10, 100, 20, 0);

-- Saklar hari-H: satu baris.
insert into status_acara (id) values (true);

-- 40 kloter (30 dasar + 31-40 cadangan).
insert into kloter (nomor) select generate_series(1, 40);

-- Stok nomor dada fisik 1-500.
insert into nomor_dada_stok (nomor) select generate_series(1, 500);
