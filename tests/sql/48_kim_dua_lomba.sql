-- ============================================================================
-- hrcd-rekap : tests/sql/48_kim_dua_lomba.sql — migrasi 0087.
--
-- KENAPA PEMISAHAN INI PERLU DIJAGA MESIN.
--
-- `lomba` cuma satu kolom teks, dan mengisinya kembali dengan 'KIM' tidak
-- menimbulkan galat apa pun — ia hanya menggabungkan kembali dua lomba jadi
-- satu di tiga tempat sekaligus: blangko dicetak satu master alih-alih dua,
-- foto slip ditumpuk jadi satu kolom, dan papan Live Score menyebut satu
-- nama yang tidak pernah diumumkan panitia.
--
-- Yang diuji tiga hal:
--   1. keduanya berdiri sendiri (`lomba` kosong);
--   2. kunci fotonya BERBEDA — kunci yang sama berarti dua lomba berbagi
--      satu tumpukan foto, dan itu persis keadaan yang dipisahkan;
--   3. keduanya masih berupa lomba yang bisa dinilai — `lomba` pengelompokan
--      tampilan, bukan bahan hitungan, jadi pemisahan ini tidak boleh
--      menyentuh bentuk maupun poin maksimalnya.
-- ============================================================================

\echo '--- 48. Kim Lihat dan Kim Cium dua lomba terpisah'

do $blok$
declare
  v_edisi  smallint := edisi_aktif();
  v_lomba  integer;
  v_kunci  integer;
  v_maks   integer;
begin
  select count(*) into v_kunci
  from wahana where edisi = v_edisi and kode in ('kim_lihat', 'kim_cium');

  if v_kunci <> 2 then
    raise notice '48 DILEWATI — edisi ini tidak punya kedua komponen KIM.';
    return;
  end if;

  -- ---------------------------------------------------------------------
  -- 48.1 Keduanya berdiri sendiri.
  -- ---------------------------------------------------------------------
  select count(*) into v_lomba
  from wahana where edisi = v_edisi and kode in ('kim_lihat', 'kim_cium')
    and lomba is not null;

  assert v_lomba = 0,
    format('48.1 GAGAL: %s komponen KIM masih bernaung di bawah satu lomba',
           v_lomba);
  raise notice '48.1 OK — keduanya lomba tersendiri.';

  -- ---------------------------------------------------------------------
  -- 48.2 Kunci fotonya berbeda.
  -- ---------------------------------------------------------------------
  select count(distinct kode_lomba) into v_kunci
  from wahana where edisi = v_edisi and kode in ('kim_lihat', 'kim_cium');

  assert v_kunci = 2,
    format('48.2 GAGAL: kedua komponen KIM berbagi %s kunci foto — foto '
           'keduanya akan menumpuk jadi satu kolom', v_kunci);
  raise notice '48.2 OK — dua kunci foto, dua tumpukan.';

  -- ---------------------------------------------------------------------
  -- 48.3 Keduanya masih bisa dinilai.
  --
  --      `lomba` pengelompokan TAMPILAN; yang menghitung skor `form` dan
  --      `poin_maks`, dan pemisahan ini tidak menyentuh keduanya. Yang
  --      diperiksa di sini karena itu bukan angkanya — konfigurasi penilaian
  --      berganti tiap edisi, dan tes yang memakunya akan lulus tahun depan
  --      sambil menyembunyikan yang sudah salah — melainkan bahwa kedua
  --      baris masih punya bentuk dan poin maksimal, yaitu masih berupa
  --      lomba yang bisa dinilai.
  -- ---------------------------------------------------------------------
  select count(*) into v_maks
  from wahana where edisi = v_edisi and kode in ('kim_lihat', 'kim_cium')
    and (form is null or poin_maks is null);

  assert v_maks = 0,
    '48.3 GAGAL: ada komponen KIM yang kehilangan bentuk atau poin maksimalnya';
  raise notice '48.3 OK — keduanya masih berupa lomba yang bisa dinilai.';
end;
$blok$;

\echo '--- 48 SELESAI'
