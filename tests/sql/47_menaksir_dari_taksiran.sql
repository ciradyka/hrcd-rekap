-- ============================================================================
-- hrcd-rekap : tests/sql/47_menaksir_dari_taksiran.sql — migrasi 0085.
--
-- KENAPA HITUNGAN INI PERLU MESIN.
--
-- Poin tidak pernah disimpan; ia diturunkan tiap kali dibaca. Jadi hitungan
-- yang salah TIDAK menimbulkan galat apa pun — ia cuma menghasilkan angka
-- yang masuk akal, di kolom yang memang berisi angka, pada regu yang memang
-- ikut lomba. Yang menangkapnya bukan layar merah melainkan orang yang
-- kebetulan menghitung ulang.
--
-- Empat hal yang harus benar bersamaan:
--   1. yang masuk tangga adalah SELISIH terhadap jawaban benar, bukan
--      angka yang diketik;
--   2. selisih sampai 1 meter (100 cm) tetap 100 — yang bergeser dari 0035,
--      dan alasannya taksiran kini punya dua angka di belakang koma;
--   3. arahnya tidak penting: menaksir lebih besar dan lebih kecil dengan
--      selisih yang sama bernilai sama (itu gunanya abs);
--   4. komponen TANPA jawaban benar tidak ikut berubah sedikit pun — Pos 2
--      memakai `bertingkat` yang sama untuk waktu tempuh, dan kalau ia ikut
--      dibaca sebagai selisih, seluruh Pos 2 salah tanpa satu tanda pun.
-- ============================================================================

\echo '--- 47. menaksir dinilai dari taksiran peserta'

do $blok$
declare
  -- Tangga dalam SENTIMETER, sama dengan yang dipasang 0086. Angka di tes
  -- ini pun sentimeter: 734 adalah taksiran 7,34 m yang diketik petugas.
  v_tangga jsonb := '[{"sampai": 100, "poin": 100},
                      {"sampai": 200, "poin": 80},
                      {"sampai": 300, "poin": 60},
                      {"sampai": 400, "poin": 40},
                      {"sampai": 500, "poin": 20}]'::jsonb;
  v_poin   numeric;

begin
  -- Memanggil hitung_poin LANGSUNG, bukan lewat view: yang diuji
  -- aritmetikanya, dan lewat view ia bergantung pada baris nilai yang
  -- kebetulan ada di database uji.
  -- ---------------------------------------------------------------------
  -- 47.1 Selisih, bukan angka yang diketik.
  --      |855 - 734| = 121 cm -> tingkat "sampai 200" -> 80.
  -- ---------------------------------------------------------------------
  v_poin := hitung_poin('bertingkat', 734, null, 100, null, null,
                        null, null, null, v_tangga, 855);
  assert v_poin = 80,
    format('47.1 GAGAL: taksir 734 cm (selisih 121) bernilai %s, seharusnya 80',
           v_poin);
  raise notice '47.1 OK — taksir 734 cm, selisih 121 cm, poin %.', v_poin;

  -- ---------------------------------------------------------------------
  -- 47.2 Selisih SATU SENTIMETER tetap 100.
  --
  --      Inilah yang membedakan 0085 dari 0035: dengan tangga lama, 8.56
  --      jatuh ke tingkat kedua dan bernilai 80. Lomba menaksir yang
  --      menuntut ketepatan sentimeter bukan lomba menaksir lagi.
  -- ---------------------------------------------------------------------
  v_poin := hitung_poin('bertingkat', 856, null, 100, null, null,
                        null, null, null, v_tangga, 855);
  assert v_poin = 100,
    format('47.2 GAGAL: taksir 856 cm (selisih 1 cm) bernilai %s, seharusnya 100',
           v_poin);

  -- Batasnya sendiri: selisih PERSIS 1 meter masih 100, 1.01 sudah turun.
  v_poin := hitung_poin('bertingkat', 755, null, 100, null, null,
                        null, null, null, v_tangga, 855);
  assert v_poin = 100,
    format('47.2 GAGAL: selisih persis 100 cm bernilai %s, seharusnya 100', v_poin);

  v_poin := hitung_poin('bertingkat', 754, null, 100, null, null,
                        null, null, null, v_tangga, 855);
  assert v_poin = 80,
    format('47.2 GAGAL: selisih 101 cm bernilai %s, seharusnya 80', v_poin);
  raise notice '47.2 OK — selisih 1 cm dan 100 cm sama-sama 100; 101 cm turun ke 80.';

  -- ---------------------------------------------------------------------
  -- 47.3 Arah tidak penting.
  -- ---------------------------------------------------------------------
  assert hitung_poin('bertingkat', 855 - 250, null, 100, null, null,
                     null, null, null, v_tangga, 855)
       = hitung_poin('bertingkat', 855 + 250, null, 100, null, null,
                     null, null, null, v_tangga, 855),
    '47.3 GAGAL: menaksir kurang dan lebih dengan selisih sama bernilai beda';
  raise notice '47.3 OK — menaksir kurang dan lebih bernilai sama.';

  -- Lebih dari seluruh tangga: 0, dan itu memang jawabannya.
  v_poin := hitung_poin('bertingkat', 2000, null, 100, null, null,
                        null, null, null, v_tangga, 855);
  assert v_poin = 0,
    format('47.3 GAGAL: selisih 1145 cm bernilai %s, seharusnya 0', v_poin);

  -- ---------------------------------------------------------------------
  -- 47.4 TANPA jawaban benar, tangganya berlaku apa adanya.
  --
  --      Pos 2 memakai `bertingkat` yang sama untuk waktu tempuh. Kalau ia
  --      ikut dibaca sebagai selisih, seluruh Pos 2 salah tanpa satu tanda
  --      pun — dan itu jenis kerusakan yang cuma bisa dijaga tes.
  -- ---------------------------------------------------------------------
  v_poin := hitung_poin('bertingkat', 200, null, 100, null, null,
                        null, null, null, v_tangga, null);
  assert v_poin = 80,
    format('47.4 GAGAL: tanpa jawaban benar, nilai 200 bernilai %s, '
           'seharusnya 80 (tangga apa adanya)', v_poin);
  raise notice '47.4 OK — komponen tanpa jawaban benar tidak ikut berubah.';
end;
$blok$;

-- ---------------------------------------------------------------------------
-- 47.5 Konfigurasi Menaksir edisi ini benar-benar terpasang.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_jawab   numeric;
  v_tingkat jsonb;
  v_maks    numeric;
  v_satuan  text;
begin
  select jawaban_benar, tingkat, rentang_mentah_maks, satuan
    into v_jawab, v_tingkat, v_maks, v_satuan
  from wahana where edisi = edisi_aktif() and kode = 'menaksir';

  if not found then
    raise notice '47.5 DILEWATI — edisi ini tidak punya komponen menaksir.';
    return;
  end if;

  -- SENTIMETER, bukan meter (0086). Nilai mentah tidak punya koma, jadi yang
  -- disimpan satuan terkecil yang bulat dan yang dilihat orang meter — aturan
  -- yang sama dengan `detik`: kertas berbunyi 00:47, database menyimpan 47.
  assert v_jawab = 855,
    format('47.5 GAGAL: jawaban benar %s, seharusnya 855 (sentimeter)', v_jawab);
  assert jsonb_array_length(v_tingkat) = 5,
    format('47.5 GAGAL: tangganya %s tingkat, seharusnya 5',
           jsonb_array_length(v_tingkat));
  assert (v_tingkat -> 0 ->> 'sampai')::numeric = 100
     and (v_tingkat -> 0 ->> 'poin')::numeric = 100,
    format('47.5 GAGAL: tingkat pertama %s, seharusnya sampai 100 cm poin 100',
           v_tingkat -> 0);
  -- 10000 cm = 100 m menolak "855" yang lahir dari titik yang terlewat, dan
  -- masih longgar untuk apa pun yang bisa ditaksir dengan mata.
  assert v_maks = 10000,
    format('47.5 GAGAL: rentang mentah maks %s, seharusnya 10000 cm', v_maks);
  assert v_satuan = 'meter',
    format('47.5 GAGAL: satuan %L — tanpa penanda ini layar menampilkan '
           'sentimeter apa adanya', v_satuan);
  raise notice '47.5 OK — jawaban 855 cm, lima tingkat, maks % cm, satuan %.',
    v_maks, v_satuan;
end;
$blok$;

\echo '--- 47 SELESAI'
