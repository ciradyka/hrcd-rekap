-- ============================================================================
-- hrcd-rekap : tests/sql/46_tanggal_lomba.sql — migrasi 0083.
--
-- KENAPA SEBUAH TANGGAL DIJAGA MESIN.
--
-- `tanggal_lomba` adalah ALAS seluruh perkiraan jam berangkat: kolom
-- `perkiraan_berangkat` dihitung darinya, dan bagian 10 rancangan
-- menyandarkan seluruh pagi pada perkiraan itu.
--
-- Yang membuatnya perlu tes: kalau alasnya salah, JAM-nya tetap benar.
-- "07:00", "07:04", "07:08" terbaca persis seperti yang diharapkan, dan tidak
-- ada satu pun galat, layar merah, atau kolom kosong yang muncul. Selama
-- setahun penuh angka itu salah hari tanpa ada yang melihatnya.
--
-- Karena itu yang diuji BUKAN cuma isi kolomnya, melainkan tanggal yang
-- benar-benar keluar dari view yang dibaca layar Keberangkatan.
-- ============================================================================

\echo '--- 46. tanggal lomba 29 Agustus 2026'

do $blok$
declare
  v_tanggal date;
  v_tahun   smallint;
  v_salah   integer;
  v_baris   integer;
begin
  select tanggal_lomba, tahun into strict v_tanggal, v_tahun
  from edisi where is_active;

  -- ---------------------------------------------------------------------
  -- 46.1 Kolomnya sendiri.
  -- ---------------------------------------------------------------------
  assert v_tanggal = date '2026-08-29',
    format('46.1 GAGAL: tanggal lomba %s, seharusnya 2026-08-29', v_tanggal);
  assert v_tahun = 2026,
    format('46.1 GAGAL: tahun %s, seharusnya 2026', v_tahun);
  raise notice '46.1 OK — HRCD XXXVII, tanggal % (tahun %).', v_tanggal, v_tahun;

  -- ---------------------------------------------------------------------
  -- 46.2 Yang keluar dari view Keberangkatan jatuh di HARI ITU.
  --
  -- Dibaca dalam WIB, bukan zona sesi database: sesi Supabase berjalan di
  -- UTC, dan 2026-08-29 07:00 WIB adalah 2026-08-28 24:00 UTC — tanggal 28
  -- kalau dibaca mentah-mentah (pelajaran migrasi 0056). Tes yang lupa
  -- menyebut zonanya akan gagal justru saat kodenya benar.
  -- ---------------------------------------------------------------------
  select count(*) into v_baris from v_keberangkatan;

  if v_baris = 0 then
    raise notice '46.2 DILEWATI — belum ada kloter berisi regu.';
    return;
  end if;

  select count(*) into v_salah
  from v_keberangkatan
  where (perkiraan_berangkat at time zone 'Asia/Jakarta')::date <> v_tanggal;

  assert v_salah = 0,
    format('46.2 GAGAL: %s dari %s kloter berperkiraan di luar hari lomba',
           v_salah, v_baris);
  raise notice '46.2 OK — % kloter, semuanya berperkiraan pada hari lomba.',
    v_baris;
end;
$blok$;

\echo '--- 46 SELESAI'
