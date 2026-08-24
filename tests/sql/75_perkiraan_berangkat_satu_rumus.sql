-- ============================================================================
-- hrcd-rekap : tests/sql/75_perkiraan_berangkat_satu_rumus.sql
-- Perkiraan berangkat menyebar ke SELURUH kloter edisi, bukan ke jumlah yang
-- kebetulan dibutuhkan.
--
-- Pasangannya di sisi layar: `tests/departure_calculator.test.mjs`. Kedua
-- berkas menjaga satu keputusan yang sama dari dua arah — kalau salah satu
-- rumus diubah tanpa yang lain, Kalkulator Keberangkatan dan kertas kloter
-- menyebut jam berbeda untuk kloter yang sama, dan tidak ada yang gagal.
-- Pernah terjadi: 0105 mengganti pembagi di sini dan sisi JS tidak ikut,
-- selisihnya 37 menit di K60.
--
-- Yang diperiksa UJUNG-UJUNGNYA, bukan angka jam tertentu. Jendela dan jumlah
-- kloter adalah konfigurasi per edisi (CLAUDE.md 10.7); tes yang memaku
-- "09:23" jadi pekerjaan tahunan untuk menjaga sesuatu yang bukan itu
-- maksudnya.
-- ============================================================================

\echo '--- 75. perkiraan berangkat satu rumus'
\set ON_ERROR_STOP on

do $blok$
declare
  e         record;
  v_mulai   timestamptz;
  v_batas   timestamptz;
  v_tengah  timestamptz;
begin
  select * into e from edisi where is_active;
  if not found then
    raise notice '75 dilewati: tidak ada edisi aktif.';
    return;
  end if;

  v_mulai := (e.tanggal_lomba + e.jam_mulai_berangkat) at time zone 'Asia/Jakarta';
  v_batas := (e.tanggal_lomba + e.jam_batas_berangkat) at time zone 'Asia/Jakarta';

  -- 75.1 Kloter pertama berangkat tepat di awal jendela.
  assert perkiraan_berangkat_kloter(1) = v_mulai,
    format('75.1 GAGAL: K1 %s, harusnya %s', perkiraan_berangkat_kloter(1), v_mulai);

  -- 75.2 Kloter TERAKHIR EDISI — bukan kloter terakhir yang terisi — jatuh
  --      tepat di batas. Inilah keputusan yang diperdebatkan: membagi dengan
  --      jumlah kloter yang dibutuhkan akan melempar cadangan ke luar jendela,
  --      dan CLAUDE.md 10.1 menuntut yang terakhir sudah berangkat pukul
  --      sepuluh.
  assert perkiraan_berangkat_kloter(e.kloter_maks) = v_batas,
    format('75.2 GAGAL: K%s (kloter terakhir edisi) %s, harusnya %s',
           e.kloter_maks, perkiraan_berangkat_kloter(e.kloter_maks), v_batas);

  -- 75.3 Tidak ada kloter edisi yang jatuh di luar jendela.
  assert not exists (
    select 1 from generate_series(1, e.kloter_maks) k
    where perkiraan_berangkat_kloter(k) < v_mulai
       or perkiraan_berangkat_kloter(k) > v_batas),
    '75.3 GAGAL: ada kloter yang perkiraannya di luar jendela keberangkatan';

  -- 75.4 Sebarannya merata: yang di tengah jatuh di tengah jendela. Menjaga
  --      ujungnya saja akan tetap hijau untuk fungsi yang menaruh SEMUA kloter
  --      selain yang pertama dan terakhir di jam yang sama.
  if e.kloter_maks >= 3 and e.kloter_maks % 2 = 1 then
    v_tengah := v_mulai + (v_batas - v_mulai) / 2;
    assert perkiraan_berangkat_kloter((e.kloter_maks + 1) / 2) = v_tengah,
      format('75.4 GAGAL: kloter tengah %s, harusnya %s',
             perkiraan_berangkat_kloter((e.kloter_maks + 1) / 2), v_tengah);
  end if;
end;
$blok$;

select '75_perkiraan_berangkat_satu_rumus OK' as hasil;
