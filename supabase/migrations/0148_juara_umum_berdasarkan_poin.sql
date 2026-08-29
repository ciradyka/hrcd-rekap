-- ============================================================================
-- hrcd-rekap : 0148_juara_umum_berdasarkan_poin.sql
-- Juara Umum ditentukan total poin gelar, bukan banyaknya gelar.
--
-- Juara I sampai Harapan III bernilai 6, 5, 4, 3, 2, 1. Versi lama sudah
-- menghitung bobot itu, tetapi masih mengurutkan jumlah gelar lebih dahulu;
-- enam Harapan dapat mengalahkan tiga Juara I. Jumlah skor lomba tetap menjadi
-- tie-breaker ketika total poin gelarnya sama.
-- ============================================================================

do $$
declare
  v_def text := pg_get_functiondef('hasil_kejuaraan()'::regprocedure);
  v_lama text := 'order by jumlah_juara desc, bobot_juara desc, jumlah_skor desc, nama_sekolah';
  v_baru text := 'order by bobot_juara desc, jumlah_skor desc, nama_sekolah';
begin
  assert position(v_lama in v_def) > 0,
    '0148: urutan lama hasil_kejuaraan() tidak ditemukan';
  v_def := replace(v_def, v_lama, v_baru);
  execute v_def;
end;
$$;

do $$
declare v_def text := pg_get_functiondef('hasil_kejuaraan()'::regprocedure);
begin
  assert v_def like '%order by bobot_juara desc, jumlah_skor desc, nama_sekolah%',
    '0148: total poin gelar belum menjadi urutan utama';
  assert v_def not like '%order by jumlah_juara desc, bobot_juara desc%',
    '0148: jumlah gelar masih mengalahkan total poin';
end;
$$;
