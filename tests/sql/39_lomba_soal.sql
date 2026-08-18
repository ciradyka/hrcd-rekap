-- ============================================================================
-- hrcd-rekap : tests/sql/39_lomba_soal.sql
-- Lima lomba soal baru dan bobot Pembidaian (migrasi 0076).
--
-- YANG DIJAGA
--
-- Konfigurasi penilaian adalah DATA, bukan kode (rancangan-b) — jadi tidak ada
-- satu baris pun di aplikasi yang akan menolak angka yang salah di sini.
-- Kalau `poin_maks` dan `total_soal` tidak sepasang, tidak ada galat: petugas
-- mengetik jumlah benar seperti biasa, poinnya keluar, dan angkanya salah
-- sepanjang acara.
--
-- Karena itu yang diuji bukan "barisnya ada", melainkan "1 benar = 5 poin"
-- dihitung lewat rumus yang sesungguhnya dipakai.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 39.1  Kelima komponen ada, bentuknya benar_per_total, dan berdiri sendiri.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_edisi smallint := edisi_aktif();
  r       record;
  v_n     integer := 0;
begin
  for r in
    select kode, pos, name, type, form, poin_maks, total_soal,
           rentang_mentah_min, rentang_mentah_maks, lomba, golongan
    from wahana
    where edisi = v_edisi
      and kode in ('keagamaan','kepramukaan','kesehatan','pengetahuan_umum','logika')
    order by pos, kode
  loop
    v_n := v_n + 1;
    assert r.type = 'soal',
      format('%s: type harus soal, bukan %s', r.kode, r.type);
    assert r.form = 'benar_per_total',
      format('%s: form harus benar_per_total, bukan %s', r.kode, r.form);
    assert r.total_soal > 0,
      format('%s: total_soal wajib terisi untuk benar_per_total', r.kode);
    -- Batas isian HARUS sama dengan jumlah soalnya. Kalau lebih longgar,
    -- petugas bisa mengetik 12 dari 10 soal dan poinnya melewati maksimum
    -- sebelum di-clamp; kalau lebih ketat, jawaban sempurna ditolak.
    assert r.rentang_mentah_maks = r.total_soal,
      format('%s: rentang atas %s tidak sama dengan %s soal',
             r.kode, r.rentang_mentah_maks, r.total_soal);
    assert r.rentang_mentah_min = 0, format('%s: rentang bawah harus 0', r.kode);
    -- Keputusan pemilik acara: masing-masing lomba tersendiri, bukan satu
    -- lomba berisi dua penilaian. NULL yang menyatakannya (CLAUDE.md 11.7).
    assert r.lomba is null,
      format('%s: lomba harus NULL — ia lombanya sendiri, dapat %s', r.kode, r.lomba);
    assert r.golongan is null,
      format('%s: golongan harus NULL — berlaku untuk keempat golongan', r.kode);
  end loop;

  assert v_n = 5, format('seharusnya 5 komponen soal, ada %s', v_n);
  raise notice '39.1 OK — lima komponen soal, semuanya benar_per_total dan berdiri sendiri.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 39.2  SATU BENAR = LIMA POIN. Dihitung lewat hitung_poin(), rumus yang
--       sesungguhnya dipakai — bukan dengan mengalikan sendiri di tes ini.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_edisi smallint := edisi_aktif();
  r       record;
  v_satu  numeric;
  v_penuh numeric;
begin
  for r in
    select kode, poin_maks, total_soal from wahana
    where edisi = v_edisi
      and kode in ('keagamaan','kepramukaan','kesehatan','pengetahuan_umum','logika')
  loop
    v_satu := hitung_poin('benar_per_total', 1, null, r.poin_maks,
                          null, null, null, null, r.total_soal, null);
    assert v_satu = 5,
      format('%s: satu jawaban benar seharusnya 5 poin, dapat %s', r.kode, v_satu);

    v_penuh := hitung_poin('benar_per_total', r.total_soal, null, r.poin_maks,
                           null, null, null, null, r.total_soal, null);
    assert v_penuh = r.poin_maks,
      format('%s: semua benar seharusnya %s poin, dapat %s',
             r.kode, r.poin_maks, v_penuh);
  end loop;
  raise notice '39.2 OK — 1 benar = 5 poin di kelimanya, dan semua benar = poin maksimum.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 39.3  Nol benar = nol poin, dan angka di luar akal tetap terkurung.
--
-- Clamp-nya diuji karena rentang isian dijaga di layar dan di impor — dua
-- tempat yang bisa dilewati, misalnya oleh baris yang ditempel dari Sheets.
-- ---------------------------------------------------------------------------
do $blok$
declare v_edisi smallint := edisi_aktif(); v_maks numeric; v_soal numeric; v_p numeric;
begin
  select poin_maks, total_soal into v_maks, v_soal from wahana
  where edisi = v_edisi and kode = 'logika';

  v_p := hitung_poin('benar_per_total', 0, null, v_maks, null, null, null, null, v_soal, null);
  assert v_p = 0, format('nol benar seharusnya nol poin, dapat %s', v_p);

  v_p := hitung_poin('benar_per_total', v_soal + 5, null, v_maks,
                     null, null, null, null, v_soal, null);
  assert v_p = v_maks,
    format('lebih dari jumlah soal seharusnya tetap %s, dapat %s', v_maks, v_p);
  raise notice '39.3 OK — nol jadi nol, dan kelebihan tetap terkurung di maksimum.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 39.4  Pembidaian berjumlah 100 dan tiap barisnya 1:1.
--
--       Dilewati di database uji, yang seed-nya tidak punya Pembidaian.
--       Yang dijaga di sini: `poin_maks` tidak boleh naik sendirian.
--       `besar_baik` menghitung poin_maks x nilai / raw_terbaik, jadi menaikkan
--       poin_maks tanpa raw_terbaik membuat juri yang menulis 20 dapat 25.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_edisi smallint := edisi_aktif();
  r       record;
  v_n     integer;
  v_jum   numeric;
begin
  select count(*) into v_n from wahana
  where edisi = v_edisi and pos = 3 and lomba = 'Pembidaian';
  if v_n = 0 then
    raise notice '39.4 DILEWATI — Pembidaian tidak ada di database ini.';
    return;
  end if;

  select sum(poin_maks) into v_jum from wahana
  where edisi = v_edisi and pos = 3 and lomba = 'Pembidaian';
  assert v_jum = 100, format('Pembidaian berjumlah %s, seharusnya 100', v_jum);

  for r in
    select kode, poin_maks, raw_terbaik, rentang_mentah_maks from wahana
    where edisi = v_edisi and pos = 3 and lomba = 'Pembidaian'
  loop
    assert r.raw_terbaik = r.poin_maks,
      format('%s: raw_terbaik %s tidak mengikuti poin_maks %s — angka yang '
             'ditulis juri tidak lagi sama dengan poinnya',
             r.kode, r.raw_terbaik, r.poin_maks);
    assert r.rentang_mentah_maks = r.poin_maks,
      format('%s: batas isian %s tidak mengikuti poin_maks %s',
             r.kode, r.rentang_mentah_maks, r.poin_maks);
    assert hitung_poin('besar_baik', r.poin_maks, null, r.poin_maks,
                       r.raw_terbaik, 0, null, null, null, null) = r.poin_maks,
      format('%s: nilai penuh tidak menghasilkan poin penuh', r.kode);
  end loop;
  raise notice '39.4 OK — Pembidaian 100 poin, kelimanya 1:1.';
end $blok$;
