-- ============================================================================
-- hrcd-rekap : tests/sql/42_kode_lomba_stabil.sql — migrasi 0079.
--
-- YANG DIUJI, dan kenapa ia perlu mesin:
--
-- Sebelum 0079, kunci foto sebuah lomba DITURUNKAN dari namanya tiap kali
-- dibaca. Mengganti nama lomba karena itu memutus seluruh foto yang sudah
-- diunggah untuknya — tanpa galat, tanpa layar merah, tanpa satu pun tanda.
-- Kerusakan yang tidak bersuara hanya bisa dijaga tes.
--
-- Tiga hal yang harus benar bersamaan:
--   1. Baris baru mendapat kunci tanpa diminta (trigger).
--   2. Kunci itu TIDAK bergerak waktu namanya diganti.
--   3. Kunci lama tetap terbaca untuk baris yang kolomnya belum terisi.
-- ============================================================================

\echo '--- 42. kode lomba tetap walau namanya berganti'

do $blok$
declare
  v_edisi  smallint := edisi_aktif();
  v_kunci  text;
  v_kunci2 text;
begin
  -- Pos 19 dipakai sebagai ruang kerja: di luar 1-5 yang dipakai lomba
  -- sungguhan, jadi tes ini tidak pernah bertabrakan dengan konfigurasi edisi
  -- mana pun (pos_nomor_check mengizinkan 1-20 sejak 0021).
  delete from wahana where edisi = v_edisi and pos = 19;
  delete from pos where edisi = v_edisi and nomor = 19;
  -- wahana menunjuk pos (edisi, nomor), jadi posnya harus ada lebih dulu.
  insert into pos (edisi, nomor, name, bobot) values (v_edisi, 19, 'Uji 42', 1.00);

  -- ---------------------------------------------------------------------
  -- 1. Baris baru mendapat kunci sendiri.
  -- ---------------------------------------------------------------------
  -- raw_terbaik/raw_terburuk wajib untuk bentuk besar_baik (wahana_check1).
  insert into wahana (edisi, pos, kode, name, type, form, poin_maks,
                      raw_terbaik, raw_terburuk,
                      rentang_mentah_min, rentang_mentah_maks, sort_order)
  values (v_edisi, 19, 'uji_bendera', 'Semaphore', 'wahana', 'besar_baik',
          100, 5, 0, 0, 5, 1);

  select kode_lomba into v_kunci
  from wahana where edisi = v_edisi and pos = 19 and kode = 'uji_bendera';

  assert v_kunci = 'semaphore',
    format('42.1 GAGAL: kunci baris baru "%s", seharusnya "semaphore"', v_kunci);
  raise notice '42.1 OK — baris baru mendapat kunci "%" tanpa diminta.', v_kunci;

  -- ---------------------------------------------------------------------
  -- 2. Namanya diganti — kuncinya tidak boleh ikut.
  --
  -- Inilah yang dulu rusak: "Semaphore" jadi "Bendera" membuat kuncinya jadi
  -- `bendera`, dan seluruh foto berkode `semaphore` tidak ketemu lagi.
  -- ---------------------------------------------------------------------
  update wahana set name = 'Bendera', rentang_mentah_maks = 10
  where edisi = v_edisi and pos = 19 and kode = 'uji_bendera';

  select kode_lomba into v_kunci2
  from wahana where edisi = v_edisi and pos = 19 and kode = 'uji_bendera';

  assert v_kunci2 = v_kunci,
    format('42.2 GAGAL: kunci berpindah dari "%s" jadi "%s" hanya karena '
           'namanya diganti — foto lama akan hilang', v_kunci, v_kunci2);
  raise notice '42.2 OK — nama jadi "Bendera 0-10", kunci tetap "%".', v_kunci2;

  -- ---------------------------------------------------------------------
  -- 3. Baris yang kolomnya BELUM terisi tetap terbaca dengan kunci lama.
  --
  -- Migrasi lama menyisipkan wahana tanpa menyebut kolom ini; pembacanya harus
  -- tetap menemukan mereka, kalau tidak foto yang sudah ada justru diputus
  -- oleh migrasi yang dibuat untuk mencegah itu.
  -- ---------------------------------------------------------------------
  update wahana set kode_lomba = null
  where edisi = v_edisi and pos = 19 and kode = 'uji_bendera';

  select kode_lomba_wahana(kode_lomba, lomba, name) into v_kunci2
  from wahana where edisi = v_edisi and pos = 19 and kode = 'uji_bendera';

  assert v_kunci2 = 'bendera',
    format('42.3 GAGAL: cadangan menghasilkan "%s", seharusnya "bendera"',
           v_kunci2);
  raise notice '42.3 OK — kolom kosong jatuh ke hitungan lama ("%").', v_kunci2;

  -- ---------------------------------------------------------------------
  -- 4. Komponen berkelompok memakai nama LOMBA-nya, bukan nama sendiri.
  -- ---------------------------------------------------------------------
  insert into wahana (edisi, pos, kode, name, lomba, type, form, poin_maks,
                      raw_terbaik, raw_terburuk,
                      rentang_mentah_min, rentang_mentah_maks, sort_order)
  values (v_edisi, 19, 'uji_bidai_a', 'Teknik Bidai', 'Pembidaian',
          'wahana', 'besar_baik', 25, 25, 0, 0, 25, 2);

  select kode_lomba into v_kunci
  from wahana where edisi = v_edisi and pos = 19 and kode = 'uji_bidai_a';

  assert v_kunci = 'pembidaian',
    format('42.4 GAGAL: kunci komponen berkelompok "%s", seharusnya '
           '"pembidaian"', v_kunci);
  raise notice '42.4 OK — komponen berkelompok berkunci "%".', v_kunci;

  delete from wahana where edisi = v_edisi and pos = 19;
  delete from pos where edisi = v_edisi and nomor = 19;
end;
$blok$;

\echo '--- 42 SELESAI'
