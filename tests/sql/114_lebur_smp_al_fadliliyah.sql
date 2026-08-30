\echo '--- 114. SMP Al-Fadliliyah dilebur ke MTs-nya, pendaftaran ikut pindah'

-- Database uji tidak memuat baris `SMP Al-Fadliliyah Darussalam` — ia lahir
-- dari sebuah pendaftaran di produksi. Jadi jalur yang berlaku di sini jalur
-- "dilewati", dan itu justru yang paling penting diuji: migrasi peleburan yang
-- pasangannya tidak ada harus DIAM, bukan gagal.

do $$
begin
  assert not exists (select 1 from sekolah where name = 'SMP Al-Fadliliyah Darussalam'),
    '114.1 GAGAL: SMP Al-Fadliliyah Darussalam masih ada sesudah 0162';
  assert exists (select 1 from sekolah where name = 'MTs Al-Fadliliyah Darussalam'),
    '114.2 GAGAL: MTs Al-Fadliliyah Darussalam hilang — yang dilebur seharusnya SMP-nya';
end;
$$;

-- Peleburan yang sama dijalankan sungguhan di sini, atas sepasang baris
-- karangan, supaya jalur yang di produksi cuma berjalan sekali tetap punya
-- tes yang menempati kursinya. Yang diperiksa satu hal: pendaftaran IKUT
-- PINDAH, bukan ikut terhapus.
do $$
declare
  v_lama uuid; v_baru uuid; v_daftar uuid;
  n_sebelum int; n_sesudah int; v_tujuan uuid;
begin
  insert into sekolah (name, address) values
    ('SMP Uji Lebur 0162', 'Jl. Uji, Uji, Kec. Uji, Kabupaten Uji, Jawa Barat 40000, Indonesia')
    returning id into v_lama;
  insert into sekolah (name, address) values
    ('MTs Uji Lebur 0162', 'Jl. Uji, Uji, Kec. Uji, Kabupaten Uji, Jawa Barat 40000, Indonesia')
    returning id into v_baru;

  select id into v_daftar from pendaftaran limit 1;
  assert v_daftar is not null, '114.3 GAGAL: tidak ada pendaftaran untuk diuji';

  select count(*) into n_sebelum from pendaftaran;
  update pendaftaran set sekolah_id = v_lama where id = v_daftar;

  -- Bentuk yang sama persis dengan 0162.
  update pendaftaran set sekolah_id = v_baru where sekolah_id = v_lama;
  delete from sekolah where id = v_lama;

  select count(*) into n_sesudah from pendaftaran;
  assert n_sesudah = n_sebelum,
    format('114.4 GAGAL: pendaftaran hilang saat peleburan, %s -> %s', n_sebelum, n_sesudah);

  select sekolah_id into v_tujuan from pendaftaran where id = v_daftar;
  assert v_tujuan = v_baru,
    '114.5 GAGAL: pendaftaran tidak berpindah ke sekolah yang bertahan';

  assert not exists (select 1 from sekolah where id = v_lama),
    '114.6 GAGAL: baris yang dilebur masih ada';

  rollback;
end;
$$;

do $$
declare v_kembar int; v_regu int;
begin
  select count(*) into v_kembar from (
    select kunci_sekolah(name) from sekolah group by 1 having count(*) > 1) x;
  assert v_kembar = 0, format('114.7 GAGAL: %s kunci sekolah kembar', v_kembar);

  assert not exists (select 1 from pendaftaran where sekolah_id is null),
    '114.8 GAGAL: ada pendaftaran tanpa sekolah';

  select count(*) into v_regu from regu;
  assert v_regu > 0, '114.9 GAGAL: tabel regu kosong sesudah 0162';
  raise notice '114: % regu tetap utuh.', v_regu;
end;
$$;

\echo '114 lebur SMP Al-Fadliliyah: LULUS'
