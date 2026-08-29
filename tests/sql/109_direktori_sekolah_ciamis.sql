\echo '--- 109. direktori sekolah Ciamis masuk tanpa menabrak yang sudah ada'

do $$
declare v_sekolah int; v_kembar int; v_cacat int;
begin
  select count(*) into v_sekolah from sekolah;
  assert v_sekolah > 300,
    format('109.1 GAGAL: baru %s baris sekolah, direktori Ciamis tidak masuk', v_sekolah);

  -- Indeks unique tetap berdiri: tidak boleh ada kunci kembar sesudah 326
  -- baris masuk sekaligus.
  select count(*) into v_kembar from (
    select kunci_sekolah(name) from sekolah group by 1 having count(*) > 1) x;
  assert v_kembar = 0, format('109.2 GAGAL: %s kunci sekolah kembar', v_kembar);

  -- Alamat direktori tetap menuruti bentuk runbook bagian 8: berakhir
  -- ", Indonesia" dan memakai "Kec. ". Kode pos TIDAK diwajibkan — Dapodik
  -- cuma memuatnya untuk delapan dari 326, dan menebak sisanya dilarang.
  --
  --    Diperiksa hanya alamat yang memang alamat: delapan sekolah karangan
  --    dari 01_seed_uji dan 0092/0105 beralamat "Ciamis" atau "Jl. Batal 1",
  --    tanpa satu koma pun, dan memang tidak dimaksudkan berbentuk alamat
  --    surat. Keberadaan koma yang membedakannya.
  select count(*) into v_cacat from sekolah
   where address like '%,%'
     and (address not like '%, Indonesia' or address not like '%Kec. %');
  assert v_cacat = 0, format('109.3 GAGAL: %s alamat tidak menuruti bentuk baku', v_cacat);

  -- Kolom jalan tidak boleh mengulang desa/kecamatan/kabupaten yang sudah
  -- punya tempat sendiri. Dapodik menuliskannya dua kali; 0157 memotongnya.
  select count(*) into v_cacat from sekolah
   where address ~* '(Kabupaten|Kab\.).*(Kabupaten|Kab\.)';
  assert v_cacat = 0, format('109.4 GAGAL: %s alamat menyebut kabupaten dua kali', v_cacat);

  raise notice '109: % baris sekolah, tidak ada kunci kembar.', v_sekolah;
end;
$$;

do $$
begin
  -- Sekolah yang sudah dikurasi tidak boleh tergeser baris direktori.
  assert exists (select 1 from sekolah where name = 'SMK LPS 1 Ciamis'),
    '109.5 GAGAL: SMK LPS 1 Ciamis hilang sesudah impor direktori';
  assert exists (select 1 from sekolah
                  where name = 'MTsN 1 Ciamis' and address like '%46211%'),
    '109.6 GAGAL: alamat kurasi MTsN 1 Ciamis tertimpa baris direktori';
end;
$$;

\echo '109 direktori sekolah Ciamis: LULUS'
