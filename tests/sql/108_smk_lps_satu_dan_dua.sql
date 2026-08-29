\echo '--- 108. SMK LPS 1 dan LPS 2 berdampingan, alamatnya sama'

do $$
declare v1 text; v2 text;
begin
  -- Keduanya harus ADA. Nama pembeda yang berdiri sendiri tidak membedakan
  -- apa pun: "SMK LPS 1 Ciamis" tanpa LPS 2 di sebelahnya terbaca seperti
  -- satu-satunya LPS, dan pembina LPS 2 tahun depan akan memilihnya.
  select address into v1 from sekolah where name = 'SMK LPS 1 Ciamis';
  assert v1 is not null, '108.1 GAGAL: SMK LPS 1 Ciamis tidak ada';
  select address into v2 from sekolah where name = 'SMK LPS 2 Ciamis';
  assert v2 is not null, '108.2 GAGAL: SMK LPS 2 Ciamis tidak ada';

  -- Alamatnya memang sama; keduanya berdiri di Jl. R.E. Martadinata No. 23.
  assert v1 = v2, format('108.3 GAGAL: alamat keduanya berbeda: %s vs %s', v1, v2);
  assert v1 like 'Jl. R.E. Martadinata No. 23, Maleber, Kec. Ciamis,%46214, Indonesia',
    format('108.4 GAGAL: alamat LPS tidak baku: %s', v1);

  -- Nama tanpa angka tidak boleh kembali: itu yang membuat pendaftaran XXXVII
  -- tidak bisa diputuskan tanpa bertanya ke pemilik acara.
  assert not exists (select 1 from sekolah where kunci_sekolah(name) = kunci_sekolah('SMK Lps Ciamis')),
    '108.5 GAGAL: nama SMK Lps Ciamis tanpa angka masih ada';
end;
$$;

\echo '108 SMK LPS 1 dan 2: LULUS'
