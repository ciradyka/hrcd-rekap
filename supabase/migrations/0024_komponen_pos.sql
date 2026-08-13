-- ============================================================================
-- hrcd-rekap : 0024_komponen_pos.sql
--
-- Konfigurasi komponen penilaian tiap pos, disalin dari lembar Google Sheets
-- yang benar-benar dipakai panitia di HRCD XXXVI.
--
-- INI DATA, BUKAN ATURAN. `docs/alur-lomba.md` bagian 9.1 menegaskan aturan
-- penilaian berubah setiap tahun. Yang ditulis di sini adalah TITIK AWAL —
-- angka tahun lalu, supaya layar Input Pos punya sesuatu yang nyata untuk
-- ditampilkan sejak hari pertama. Panitia mengubahnya lewat baris konfigurasi,
-- bukan lewat migrasi baru.
--
-- BOBOT TIAP KOLOM DIHITUNG MUNDUR DARI SHEET, bukan ditanyakan. Kolom Nilai
-- Pos di sheet berisi angka jadi; poin_maks di sini dipilih supaya rumus
-- `besar_baik` menghasilkan angka yang sama persis. Contoh Pos 1, regu 002
-- (SATE TUSUK) dengan 6 / 5 / 0 / v / 1:
--
--   kepramukaan 6  -> 200 x 6/20  =  60
--   semaphore   5  -> 100 x 5/10  =  50
--   tebak sandi 0  -> 100 x 0/5   =   0
--   kompas      v  -> biner        = 100
--   tebak simpul 1 -> 100 x 1/5   =  20
--                                   ----
--                                    230   <- sama dengan sheet
--
-- Dua sel di sheet TIDAK cocok dengan rumusnya (Pos 3 regu 016 tertulis 380,
-- rumusnya 355; Pos 4 regu 009 tertulis 100, rumusnya 80). Keduanya kemungkinan
-- besar ketikan tangan di atas formula. Angka di sini mengikuti RUMUS, bukan
-- kedua sel itu — 20 baris lain di kedua pos cocok tanpa sisa.
--
-- Kolom "Keunikan" di lembar Pos Bayangan sengaja tidak dibuat: rentangnya
-- tertulis (0 - 0) dan seluruh isinya nol, jadi ia kolom mati. Buat lewat
-- layar konfigurasi kalau tahun ini benar-benar dipakai.
--
-- Migrasi ini AMAN DIJALANKAN ULANG: pos dan komponen yang sudah ada di-update
-- di tempat, sehingga nilai yang terlanjur masuk tidak kehilangan induknya.
-- ============================================================================

do $$
declare
  v_edisi smallint;
  v_sisa  text;
begin
  select nomor into v_edisi from edisi where is_active;

  -- Berkas ini menyentuh DATA edisi, bukan bentuk tabel. Di database uji ia
  -- dijalankan sebelum seed.sql sempat membuat edisinya — itu bukan galat,
  -- cukup dilewati. Di produksi edisinya sudah lama ada.
  if v_edisi is null then
    raise notice 'belum ada edisi aktif — komponen pos dilewati';
    return;
  end if;

  if (select konfigurasi_terkunci from status_acara) then
    raise exception 'konfigurasi sedang terkunci — buka kuncinya di status_acara dulu, lalu jalankan ulang migrasi ini';
  end if;

  -- 1. Pos ------------------------------------------------------------------
  -- Pos 5 tidak ikut diberi nama: lembarnya tidak ada di antara yang
  -- diserahkan panitia, jadi menebak namanya hanya akan menanamkan tebakan
  -- ke dalam database.
  insert into pos (edisi, nomor, name, bobot, bayangan) values
    (v_edisi, 1, 'Keagamaan dan Kepramukaan',     1.00, false),
    (v_edisi, 2, 'Kesehatan dan Pengetahuan Umum', 1.00, false),
    (v_edisi, 3, 'Games',                          1.00, false),
    (v_edisi, 4, 'Praktik Kesehatan',              1.00, false),
    (v_edisi, 6, 'Kostum',                         1.00, true)
  on conflict (edisi, nomor) do update
    set name = excluded.name, bayangan = excluded.bayangan;

  -- 2. Komponen -------------------------------------------------------------
  insert into wahana (edisi, pos, kode, name, type, form, poin_maks,
                      raw_terbaik, raw_terburuk, poin_benar, poin_salah,
                      total_soal, tingkat, satuan,
                      rentang_mentah_min, rentang_mentah_maks, sort_order)
  values
    -- ---- Pos 1 — Keagamaan dan Kepramukaan (maks 600) ----
    -- Pos 1 tidak menerima soal dari pos manapun (alur-lomba.md 7.5), jadi
    -- seluruh komponennya bertipe wahana.
    (v_edisi, 1, 'kepramukaan_keagamaan', 'Kepramukaan Keagamaan', 'wahana', 'besar_baik',
     200, 20, 0, null, null, null, null, null, 0, 20, 1),
    (v_edisi, 1, 'semaphore', 'Semaphore', 'wahana', 'besar_baik',
     100, 10, 0, null, null, null, null, null, 0, 10, 2),
    (v_edisi, 1, 'tebak_sandi', 'Tebak Sandi', 'wahana', 'besar_baik',
     100, 5, 0, null, null, null, null, null, 0, 5, 3),
    (v_edisi, 1, 'kompas', 'Kompas', 'wahana', 'biner',
     100, null, null, 100, 0, null, null, null, 0, 1, 4),
    (v_edisi, 1, 'tebak_simpul', 'Tebak Simpul', 'wahana', 'besar_baik',
     100, 5, 0, null, null, null, null, null, 0, 5, 5),

    -- ---- Pos 2 — Kesehatan dan Pengetahuan Umum (maks 300) ----
    -- Soalnya dibagikan di Pos 1 dan dikoreksi di sini (alur-lomba.md 7.4),
    -- karena itu type='soal'.
    (v_edisi, 2, 'soal_kesehatan_pengetahuan_umum', 'Soal Kesehatan dan Pengetahuan Umum',
     'soal', 'besar_baik', 200, 20, 0, null, null, null, null, null, 0, 20, 1),
    (v_edisi, 2, 'pbb_dasar', 'PBB Dasar', 'wahana', 'besar_baik',
     100, 10, 0, null, null, null, null, null, 0, 10, 2),

    -- ---- Pos 3 — Games (maks 475) ----
    (v_edisi, 3, 'logika', 'Logika', 'soal', 'besar_baik',
     100, 10, 0, null, null, null, null, null, 0, 10, 1),
    -- Merayap dinilai berjenjang 1,5 — nilai mentahnya boleh pecahan.
    (v_edisi, 3, 'merayap', 'Merayap', 'wahana', 'besar_baik',
     100, 6, 0, null, null, null, null, null, 0, 6, 2),
    (v_edisi, 3, 'balap_karung', 'Balap Karung', 'wahana', 'besar_baik',
     100, 10, 0, null, null, null, null, null, 0, 10, 3),
    -- Lempar pisau: poin = nilai mentahnya sendiri (sheet menulis 40 -> 40).
    -- Judul kolom di sheet berbunyi (10 - 100), tapi isinya banyak yang 0,
    -- jadi batas bawah yang diterima di sini 0 — menolak angka yang benar-
    -- benar tertulis di kertas bukan validasi, itu kehilangan data.
    (v_edisi, 3, 'lempar_pisau', 'Lempar Pisau', 'wahana', 'besar_baik',
     100, 100, 0, null, null, null, null, null, 0, 100, 4),
    (v_edisi, 3, 'poros_bumi', 'Poros Bumi', 'wahana', 'besar_baik',
     75, 3, 0, null, null, null, null, null, 0, 3, 5),

    -- ---- Pos 4 — Praktik Kesehatan (maks 300) ----
    (v_edisi, 4, 'praktik_kesehatan', 'Praktik Kesehatan (Ketepatan)', 'wahana', 'biner',
     50, null, null, 50, 0, null, null, null, 0, 1, 1),
    -- Kecepatan praktik: tangga poin, bukan garis lurus (lihat 0022).
    -- satuan=detik membuat layar menampilkan kotak Menit + Detik seperti di
    -- lembar; yang tersimpan tetap satu angka dalam detik.
    (v_edisi, 4, 'waktu_praktik', 'Waktu Praktik', 'wahana', 'bertingkat',
     50, null, null, null, null, null,
     '[{"sampai": 60, "poin": 50}, {"sampai": 90, "poin": 30}, {"sampai": 120, "poin": 15}]'::jsonb,
     'detik', 0, 900, 2),
    (v_edisi, 4, 'kim_cium', 'Kim Cium', 'wahana', 'besar_baik',
     100, 5, 0, null, null, null, null, null, 0, 5, 3),
    (v_edisi, 4, 'kim_lihat', 'Kim Lihat', 'wahana', 'besar_baik',
     100, 5, 0, null, null, null, null, null, 0, 5, 4),

    -- ---- Pos 6 — Kostum, pos bayangan (maks 100) ----
    (v_edisi, 6, 'kreativitas', 'Kreativitas', 'wahana', 'besar_baik',
     40, 40, 0, null, null, null, null, null, 0, 40, 1),
    (v_edisi, 6, 'kekompakan', 'Kekompakan', 'wahana', 'besar_baik',
     30, 30, 0, null, null, null, null, null, 0, 30, 2),
    (v_edisi, 6, 'kesopanan', 'Kesopanan', 'wahana', 'besar_baik',
     30, 30, 0, null, null, null, null, null, 0, 30, 3)

  on conflict (edisi, pos, kode) do update set
    name = excluded.name,
    type = excluded.type,
    form = excluded.form,
    poin_maks = excluded.poin_maks,
    raw_terbaik = excluded.raw_terbaik,
    raw_terburuk = excluded.raw_terburuk,
    poin_benar = excluded.poin_benar,
    poin_salah = excluded.poin_salah,
    total_soal = excluded.total_soal,
    tingkat = excluded.tingkat,
    satuan = excluded.satuan,
    rentang_mentah_min = excluded.rentang_mentah_min,
    rentang_mentah_maks = excluded.rentang_mentah_maks,
    sort_order = excluded.sort_order;

  -- 3. Komponen contoh dari seed.sql ---------------------------------------
  -- seed.sql memasang lima komponen contoh (satu per bentuk konversi) supaya
  -- tes bisa mencocokkan hasil hitung dengan angka di rancangan-b.md. Di
  -- lapangan mereka hanya jadi kolom asing di lembar pos. Dibuang di sini —
  -- TAPI hanya yang belum pernah dipakai. Yang sudah punya nilai adalah
  -- riwayat penilaian sungguhan; menghapusnya akan menghapus nilai regu.
  delete from wahana w
  where w.edisi = v_edisi
    and w.kode in ('lari_zigzag', 'lempar_sasaran', 'impk', 'soal_umum', 'sandi_morse')
    and not exists (select 1 from nilai_mentah n where n.wahana_id = w.id);

  select string_agg(w.kode, ', ' order by w.kode) into v_sisa
  from wahana w
  where w.edisi = v_edisi
    and w.kode in ('lari_zigzag', 'lempar_sasaran', 'impk', 'soal_umum', 'sandi_morse');
  if v_sisa is not null then
    raise notice 'komponen contoh masih terpakai dan tidak dihapus: %', v_sisa;
  end if;
end;
$$;
