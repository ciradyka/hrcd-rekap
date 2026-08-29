\echo '--- 113. kembar ejaan dilebur, nama Satu Atap dibakukan, rekap nilai utuh'

do $$
begin
  -- 1. Yang bertahan nama kurasinya, yang panjang hilang.
  assert exists (select 1 from sekolah where name = 'MA Darul Huda'),
    '113.1 GAGAL: MA Darul Huda hilang — yang dilebur seharusnya yang satunya';
  assert not exists (select 1 from sekolah where name = 'MA Daarul Huda'),
    '113.2 GAGAL: MA Daarul Huda (NPSN 70059223) masih ada';

  assert exists (select 1 from sekolah where name = 'SMK Galuh Rahayu'),
    '113.3 GAGAL: SMK Galuh Rahayu hilang';
  assert not exists (select 1 from sekolah where name = 'SMK Galuh Rahayu Sindangkasih'),
    '113.4 GAGAL: SMK Galuh Rahayu Sindangkasih (NPSN 20254622) masih ada';

  -- 2. Kelima Satu Atap ditulis dengan cara yang sama, supaya pembina yang
  --    mengetik "satu atap" menemukan kelimanya dan bukan empat.
  assert exists (select 1 from sekolah where name = 'SMPN Satu Atap 1 Banjarsari'),
    '113.5 GAGAL: SMPN 1 Atap 1 Banjarsari belum dibakukan';
  assert not exists (select 1 from sekolah where name like '%1 Atap%'),
    '113.6 GAGAL: masih ada nama yang meringkas "Satu Atap" jadi "1 Atap"';
end;
$$;

do $$
declare v_n int;
begin
  select count(*) into v_n from sekolah where name like 'SMPN Satu Atap%';
  assert v_n = 5, format('113.7 GAGAL: %s baris SMPN Satu Atap, seharusnya 5', v_n);
end;
$$;

do $$
declare v_kembar int; v_regu int;
begin
  -- 3. Peleburan tidak meninggalkan pendaftaran yatim, dan tidak melahirkan
  --    kembar baru.
  select count(*) into v_kembar from (
    select kunci_sekolah(name) from sekolah group by 1 having count(*) > 1) x;
  assert v_kembar = 0, format('113.8 GAGAL: %s kunci sekolah kembar', v_kembar);

  assert not exists (select 1 from pendaftaran where sekolah_id is null),
    '113.9 GAGAL: ada pendaftaran tanpa sekolah';
  assert not exists (
    select 1 from pendaftaran d
     where not exists (select 1 from sekolah s where s.id = d.sekolah_id)),
    '113.10 GAGAL: ada pendaftaran menunjuk sekolah yang sudah dihapus';

  select count(*) into v_regu from regu;
  assert v_regu > 0, '113.11 GAGAL: tabel regu kosong sesudah 0161';
  raise notice '113: % regu tetap utuh.', v_regu;
end;
$$;

\echo '113 lebur kembar ejaan: LULUS'
