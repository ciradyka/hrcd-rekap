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
--   2. selisih sampai 1 meter tetap 100 — inilah yang bergeser dari 0035,
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
  v_tangga jsonb := '[{"sampai": 1, "poin": 100},
                      {"sampai": 2, "poin": 80},
                      {"sampai": 3, "poin": 60},
                      {"sampai": 4, "poin": 40},
                      {"sampai": 5, "poin": 20}]'::jsonb;
  v_poin   numeric;

begin
  -- Memanggil hitung_poin LANGSUNG, bukan lewat view: yang diuji
  -- aritmetikanya, dan lewat view ia bergantung pada baris nilai yang
  -- kebetulan ada di database uji.
  -- ---------------------------------------------------------------------
  -- 47.1 Selisih, bukan angka yang diketik.
  --      |8.55 - 7.34| = 1.21 -> tingkat "sampai 2" -> 80.
  -- ---------------------------------------------------------------------
  v_poin := hitung_poin('bertingkat', 7.34, null, 100, null, null,
                        null, null, null, v_tangga, 8.55);
  assert v_poin = 80,
    format('47.1 GAGAL: taksir 7.34 (selisih 1.21) bernilai %s, seharusnya 80', v_poin);
  raise notice '47.1 OK — taksir 7.34, selisih 1.21, poin %.', v_poin;

  -- ---------------------------------------------------------------------
  -- 47.2 Selisih SATU SENTIMETER tetap 100.
  --
  --      Inilah yang membedakan 0085 dari 0035: dengan tangga lama, 8.56
  --      jatuh ke tingkat kedua dan bernilai 80. Lomba menaksir yang
  --      menuntut ketepatan sentimeter bukan lomba menaksir lagi.
  -- ---------------------------------------------------------------------
  v_poin := hitung_poin('bertingkat', 8.56, null, 100, null, null,
                        null, null, null, v_tangga, 8.55);
  assert v_poin = 100,
    format('47.2 GAGAL: taksir 8.56 (selisih 0.01) bernilai %s, seharusnya 100', v_poin);

  -- Batasnya sendiri: selisih PERSIS 1 meter masih 100, 1.01 sudah turun.
  v_poin := hitung_poin('bertingkat', 7.55, null, 100, null, null,
                        null, null, null, v_tangga, 8.55);
  assert v_poin = 100,
    format('47.2 GAGAL: selisih persis 1 m bernilai %s, seharusnya 100', v_poin);

  v_poin := hitung_poin('bertingkat', 7.54, null, 100, null, null,
                        null, null, null, v_tangga, 8.55);
  assert v_poin = 80,
    format('47.2 GAGAL: selisih 1.01 m bernilai %s, seharusnya 80', v_poin);
  raise notice '47.2 OK — selisih 0.01 dan 1.00 sama-sama 100; 1.01 turun ke 80.';

  -- ---------------------------------------------------------------------
  -- 47.3 Arah tidak penting.
  -- ---------------------------------------------------------------------
  assert hitung_poin('bertingkat', 8.55 - 2.5, null, 100, null, null,
                     null, null, null, v_tangga, 8.55)
       = hitung_poin('bertingkat', 8.55 + 2.5, null, 100, null, null,
                     null, null, null, v_tangga, 8.55),
    '47.3 GAGAL: menaksir kurang dan lebih dengan selisih sama bernilai beda';
  raise notice '47.3 OK — menaksir kurang dan lebih bernilai sama.';

  -- Lebih dari seluruh tangga: 0, dan itu memang jawabannya.
  v_poin := hitung_poin('bertingkat', 20, null, 100, null, null,
                        null, null, null, v_tangga, 8.55);
  assert v_poin = 0,
    format('47.3 GAGAL: selisih 11.45 m bernilai %s, seharusnya 0', v_poin);

  -- ---------------------------------------------------------------------
  -- 47.4 TANPA jawaban benar, tangganya berlaku apa adanya.
  --
  --      Pos 2 memakai `bertingkat` yang sama untuk waktu tempuh. Kalau ia
  --      ikut dibaca sebagai selisih, seluruh Pos 2 salah tanpa satu tanda
  --      pun — dan itu jenis kerusakan yang cuma bisa dijaga tes.
  -- ---------------------------------------------------------------------
  v_poin := hitung_poin('bertingkat', 2, null, 100, null, null,
                        null, null, null, v_tangga, null);
  assert v_poin = 80,
    format('47.4 GAGAL: tanpa jawaban benar, nilai 2 bernilai %s, '
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
begin
  select jawaban_benar, tingkat, rentang_mentah_maks
    into v_jawab, v_tingkat, v_maks
  from wahana where edisi = edisi_aktif() and kode = 'menaksir';

  if not found then
    raise notice '47.5 DILEWATI — edisi ini tidak punya komponen menaksir.';
    return;
  end if;

  assert v_jawab = 8.55,
    format('47.5 GAGAL: jawaban benar %s, seharusnya 8.55', v_jawab);
  assert jsonb_array_length(v_tingkat) = 5,
    format('47.5 GAGAL: tangganya %s tingkat, seharusnya 5',
           jsonb_array_length(v_tingkat));
  assert (v_tingkat -> 0 ->> 'sampai')::numeric = 1
     and (v_tingkat -> 0 ->> 'poin')::numeric = 100,
    format('47.5 GAGAL: tingkat pertama %s, seharusnya sampai 1 poin 100',
           v_tingkat -> 0);
  -- Rentang selisih yang lama (99999999.99) akan menerima 8550 tanpa
  -- berkedip, dan 8550 adalah 8.55 yang titiknya terlewat.
  assert v_maks <= 1000,
    format('47.5 GAGAL: rentang mentah maks %s masih rentang selisih', v_maks);
  raise notice '47.5 OK — jawaban 8.55 m, tangga lima tingkat, rentang maks %.',
    v_maks;
end;
$blok$;

\echo '--- 47 SELESAI'
