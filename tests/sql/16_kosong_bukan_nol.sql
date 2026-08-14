-- ============================================================================
-- hrcd-rekap : tests/sql/16_kosong_bukan_nol.sql
-- Dua aturan panitia yang saling berlawanan, dan harus tetap berlawanan.
--
--   KOSONG (tidak ada baris nilai_mentah)  ->  0 poin, komponen tidak dinilai
--   NOL    (ada baris, nilai_1 = 0)        ->  poin penuh, kalau tangganya
--                                              memang menghargai nol
--
-- Untuk Menaksir keduanya adalah dua ujung terjauh yang mungkin: selisih 0 m
-- berarti taksirannya TEPAT dan bernilai 100, sementara kotak yang dibiarkan
-- kosong bernilai 0. Satu ketukan memisahkan nilai tertinggi dari nilai
-- terendah.
--
-- Yang menakutkan dari kekeliruan di sini adalah ia TIDAK menimbulkan galat.
-- Satu `coalesce(nilai_1, 0)` yang tampak ramah, atau satu `where nilai_1 > 0`
-- yang tampak seperti pembersihan, sudah cukup — dan yang berubah cuma angka
-- di kolom paling kanan, yang tidak ada seorang pun hitung ulang dengan tangan.
--
-- Berkas ini menguji aturannya lewat data sungguhan: satu baris nilai dihapus,
-- akibatnya diperiksa, lalu dikembalikan.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 16.1 Baris yang HILANG menyumbang tepat nol — tidak lebih, tidak kurang.
--
--      Bukan sekadar "nilainya turun". Diperiksa turunnya PERSIS sebesar poin
--      komponen itu: kalau baris yang hilang malah dihitung sebagai nol mentah
--      dan tetap masuk agregasi, angkanya juga turun — tapi turunnya salah.
-- ---------------------------------------------------------------------------
do $$
declare
  v_regu    uuid;
  v_wahana  uuid;
  v_pos     smallint;
  v_n1      numeric;
  v_n2      numeric;
  v_sumber  text;
  v_oleh    uuid;
  v_poin    numeric;
  v_sebelum numeric;
  v_sesudah numeric;
  v_terisi1 int;
  v_terisi2 int;
begin
  -- Satu nilai apa pun yang benar-benar ada di database uji.
  select n.regu_id, n.wahana_id, w.pos, n.nilai_1, n.nilai_2, n.source, n.created_by
    into strict v_regu, v_wahana, v_pos, v_n1, v_n2, v_sumber, v_oleh
  from nilai_mentah n join wahana w on w.id = n.wahana_id
  where w.edisi = edisi_aktif()
  order by n.id limit 1;

  select poin into strict v_poin from v_poin_wahana
  where regu_id = v_regu and wahana_id = v_wahana;

  select nilai_pos, jumlah_terisi into v_sebelum, v_terisi1
  from v_lembar_pos where pos = v_pos and regu_id = v_regu;

  delete from nilai_mentah where regu_id = v_regu and wahana_id = v_wahana;

  select nilai_pos, jumlah_terisi into v_sesudah, v_terisi2
  from v_lembar_pos where pos = v_pos and regu_id = v_regu;

  assert v_sesudah = v_sebelum - v_poin,
    format('baris hilang seharusnya mengurangi %s poin: %s -> %s',
           v_poin, v_sebelum, v_sesudah);
  assert v_terisi2 = v_terisi1 - 1,
    format('jumlah_terisi tidak berkurang: %s -> %s', v_terisi1, v_terisi2);

  -- Dikembalikan persis seperti semula, termasuk sumber dan penginputnya.
  insert into nilai_mentah (regu_id, wahana_id, nilai_1, nilai_2, source, created_by)
  values (v_regu, v_wahana, v_n1, v_n2, v_sumber, v_oleh);

  select nilai_pos into v_sesudah from v_lembar_pos
  where pos = v_pos and regu_id = v_regu;
  assert v_sesudah = v_sebelum,
    format('nilai tidak kembali seperti semula: %s <> %s', v_sesudah, v_sebelum);
end;
$$;

-- ---------------------------------------------------------------------------
-- 16.2 Nilai mentah NOL adalah nilai, bukan ketiadaan nilai.
--
--      Barisnya harus tetap tercacah sebagai terisi, dan poinnya harus
--      mengikuti aturan komponennya — untuk tangga Menaksir itu berarti 100,
--      justru yang tertinggi.
-- ---------------------------------------------------------------------------
do $$
declare
  v_regu   uuid;
  v_wahana uuid;
  v_pos    smallint;
  v_n1     numeric;
  v_n2     numeric;
  v_terisi int;
  v_ada    int;
begin
  select n.regu_id, n.wahana_id, w.pos, n.nilai_1, n.nilai_2
    into strict v_regu, v_wahana, v_pos, v_n1, v_n2
  from nilai_mentah n join wahana w on w.id = n.wahana_id
  where w.edisi = edisi_aktif() and w.rentang_mentah_min <= 0
  order by n.id limit 1;

  update nilai_mentah set nilai_1 = 0, nilai_2 = case when nilai_2 is null then null else 0 end
  where regu_id = v_regu and wahana_id = v_wahana;

  select jumlah_terisi into v_terisi from v_lembar_pos
  where pos = v_pos and regu_id = v_regu;
  select count(*) into v_ada from v_poin_wahana
  where regu_id = v_regu and wahana_id = v_wahana;

  assert v_ada = 1, 'baris bernilai 0 hilang dari v_poin_wahana';
  assert v_terisi > 0, 'baris bernilai 0 tidak dihitung terisi';

  update nilai_mentah set nilai_1 = v_n1, nilai_2 = v_n2
  where regu_id = v_regu and wahana_id = v_wahana;
end;
$$;

-- ---------------------------------------------------------------------------
-- 16.3 Tangga Menaksir: 0 mentah adalah poin TERTINGGI, dan tidak adanya baris
--      adalah poin terendah. Diuji lewat hitung_poin langsung, karena di
--      database uji komponen `menaksir` memang tidak ada (konfigurasi XXXVI).
-- ---------------------------------------------------------------------------
do $$
declare
  v_tangga jsonb := '[{"sampai": 0, "poin": 100},
                      {"sampai": 1, "poin": 80},
                      {"sampai": 2, "poin": 60},
                      {"sampai": 3, "poin": 40},
                      {"sampai": 4, "poin": 20}]'::jsonb;
begin
  assert hitung_poin('bertingkat', 0, null, 100,
                     null, null, null, null, null, v_tangga) = 100,
    'selisih 0 m harus 100 poin — itu taksiran yang TEPAT, bukan kosong';
end;
$$;

-- ---------------------------------------------------------------------------
-- 16.4 Kolom `petunjuk` (0037) ada, boleh kosong, dan kosong berarti layar
--      menyusun keterangannya sendiri. Yang dijaga cuma keberadaannya:
--      isinya kalimat untuk manusia, dan itu bukan urusan tes.
-- ---------------------------------------------------------------------------
do $$
declare v_nullable text;
begin
  select is_nullable into v_nullable from information_schema.columns
  where table_name = 'wahana' and column_name = 'petunjuk';
  assert v_nullable = 'YES',
    format('wahana.petunjuk seharusnya boleh kosong, ternyata %L', v_nullable);
end;
$$;

select '16_kosong_bukan_nol OK' as hasil;
