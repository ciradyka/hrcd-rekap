-- ============================================================================
-- hrcd-rekap : 0033_nama_pos_xxxvii.sql
--
-- MENGGANTIKAN 0032. Isinya sama persis kecuali satu nama: Pos 1 adalah
-- **Kepramukaan**, bukan "Teknik Kepramukaan". Panitia menyebutnya begitu,
-- dan nama pos adalah teks yang dibaca di lapangan — bukan istilah teknis.
--
-- ---------------------------------------------------------------------------
-- KENAPA BERKAS BARU, BUKAN 0032 YANG DISUNTING
--
-- 0032 sudah pernah DITERAPKAN — ia berjalan, mencetak alasannya menolak
-- memasang data, dan tercatat sebagai migrasi yang sudah jalan. Menyuntingnya
-- sekarang membuat berkas di git berbeda dari yang benar-benar dijalankan,
-- dan itu tepat yang dilarang final-architecture.md bagian 2.
--
-- JANGAN MENJALANKAN 0032 LAGI. Kalau dijalankan setelah berkas ini, ia
-- memasang kembali nama yang lama. Berkas inilah yang berlaku.
--
-- ---------------------------------------------------------------------------
-- PENJAGANYA SAMA: hanya jalan kalau edisi aktif BELUM memuat satu nilai pun.
-- Mengganti aturan penilaian di tengah lomba membuat nilai yang sudah masuk
-- kehilangan komponen induknya — yang hilang bukan angkanya, melainkan
-- artinya.
--
-- Nama Pos 3 ('P3K dan Kim') TIDAK disebut panitia; ia diturunkan dari isinya.
-- Empat nama lain diambil apa adanya: Kepramukaan, Halang Rintang, PBB,
-- Yel-yel.
-- ============================================================================

do $$
declare
  v_edisi smallint;
  v_nilai int;
begin
  select nomor into v_edisi from edisi where is_active;
  if v_edisi is null then
    raise notice '0033: belum ada edisi aktif — bagian data dilewati.';
    return;
  end if;

  select count(*) into v_nilai
  from nilai_mentah n join wahana w on w.id = n.wahana_id
  where w.edisi = v_edisi;

  if v_nilai > 0 then
    raise notice '0033: edisi % sudah memuat % nilai — konfigurasi TIDAK diubah.',
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
    (v_edisi, 1, 'Kepramukaan',        1.00, false),
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

    -- Menaksir: yang ditulis SELISIH, jadi makin kecil makin baik.
    --
    -- TANGGA DI BAWAH INI SUDAH USANG — lihat 0035, yang menggantinya dengan
    -- angka dari panitia: turun 20 tiap meter sampai menyentuh 0. Dua tingkat
    -- terakhir di sini memang ditandai asumsi sejak awal, dan asumsinya
    -- meleset di dua hal: selisih 2 m ternyata 60 (bukan sama dengan 3 m), dan
    -- poinnya habis di 0 (bukan berhenti di 20 seperti Pos 2). Dibiarkan apa
    -- adanya karena migrasi adalah catatan sejarah, bukan keadaan terkini.
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

  raise notice '0033: konfigurasi HRCD XXXVII terpasang untuk edisi %.', v_edisi;
end;
$$;
