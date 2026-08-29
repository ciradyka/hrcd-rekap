-- ============================================================================
-- hrcd-rekap : 0147_waktu_nol_pos_2.sql
-- Waktu 00:00 di Pos 2 berarti tidak menyelesaikan lomba, jadi nol poin.
--
-- Tangga lama membaca semua waktu sampai batas pertama sebagai nilai penuh;
-- akibatnya 0 detik mendapat 100. Tingkat khusus tepat di nol memperbaikinya
-- tanpa mengubah 1 detik sampai batas pertama, dan tanpa mengubah Menaksir
-- yang memang sah bernilai mentah nol.
-- ============================================================================

update wahana
set tingkat = jsonb_build_array(jsonb_build_object('sampai', 0, 'poin', 0)) || tingkat
where edisi = edisi_aktif()
  and pos = 2
  and satuan = 'detik'
  and form = 'bertingkat'
  and not tingkat @> '[{"sampai": 0, "poin": 0}]'::jsonb;

do $$
declare v_n int;
begin
  select count(*) into v_n
  from wahana
  where edisi = edisi_aktif() and pos = 2 and satuan = 'detik'
    and form = 'bertingkat'
    and tingkat @> '[{"sampai": 0, "poin": 0}]'::jsonb;
  assert v_n = 3,
    format('0147: tingkat nol terpasang pada %s komponen Pos 2, seharusnya 3', v_n);
end;
$$;

-- Snapshot harus langsung membawa hasil baru; scheduled refresh berikutnya
-- tetap akan menjaganya setiap lima menit.
select segarkan_cache_live_score();
