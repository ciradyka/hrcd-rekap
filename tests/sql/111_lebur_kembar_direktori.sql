\echo '--- 111. kembar bawaan impor dilebur, kode pos Banjaranyar dibetulkan'

do $$
begin
  -- Keempat nama yang dibuang tidak boleh kembali. `MAN 1 Ciamis` yang paling
  -- penting: ia sudah dilebur 0154, lalu dihidupkan lagi impor 0157 karena
  -- penyaringan impor memakai NAMA sedangkan yang membuktikan dua baris satu
  -- sekolah adalah NPSN.
  assert not exists (select 1 from sekolah where kunci_sekolah(name) = kunci_sekolah('MAN 1 Ciamis')),
    '111.1 GAGAL: MAN 1 Ciamis hidup lagi — periksa impor direktori berikutnya';
  assert not exists (select 1 from sekolah where kunci_sekolah(name) = kunci_sekolah('SMAN 1 Banjaranyar')),
    '111.2 GAGAL: SMAN 1 Banjaranyar masih ada di sebelah SMAN 2 Banjarsari';
  assert not exists (select 1 from sekolah
                      where kunci_sekolah(name) = kunci_sekolah('SMP Islam Terpadu Muhammad Danu Fathahillah')),
    '111.3 GAGAL: nama panjang SMP IT MD Fathahillah masih ada';
  assert not exists (select 1 from sekolah where kunci_sekolah(name) = kunci_sekolah('MA Al Islah')),
    '111.4 GAGAL: MA Al Islah masih ada di sebelah MA Al-Ishlah';

  -- Yang bertahan harus tetap ada.
  assert exists (select 1 from sekolah where name = 'MAN Darussalam'), '111.5 GAGAL: MAN Darussalam hilang';
  assert exists (select 1 from sekolah where name = 'SMP IT MD Fathahillah'), '111.6 GAGAL: SMP IT MD Fathahillah hilang';
end;
$$;

do $$
declare v_n int;
begin
  -- Seluruh sepuluh desa Kec. Banjaranyar memakai 46384. Angka 46383 milik
  -- Kec. Banjarsari, kecamatan asalnya sebelum mekar tahun 2015.
  select count(*) into v_n from sekolah
   where address like '%Kec. Banjaranyar%' and address like '%46383%';
  assert v_n = 0, format('111.7 GAGAL: %s alamat Kec. Banjaranyar masih berkode pos 46383', v_n);

  select count(*) into v_n from sekolah
   where address like '%Kec. Banjarsari%' and address like '%46384%';
  assert v_n = 0, format('111.8 GAGAL: %s alamat Kec. Banjarsari memakai 46384', v_n);
end;
$$;

\echo '111 lebur kembar direktori: LULUS'
