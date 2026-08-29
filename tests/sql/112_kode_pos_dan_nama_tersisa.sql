\echo '--- 112. kode pos Kabupaten Ciamis, empat nama berjenjang, rekap nilai utuh'

-- 0160 dijalankan tepat sebelum berkas ini. Database uji tidak memuat baris
-- ketikan pembina yang jadi alasan migrasinya ada, jadi yang diperiksa di sini
-- bukan jumlah barisnya melainkan bahwa jalur yang MEMANG berlaku berjalan
-- benar, dan bahwa pagarnya masih terpasang.

do $$
declare v_alamat text;
begin
  -- 1. Ketiga nama tanpa jenjang mendapat bentuk pendidikannya. Ketiganya
  --    lahir dari impor 0157, jadi ketiganya ADA di database uji.
  assert exists (select 1 from sekolah where name = 'MA Al-Hikmah'),
    '112.1 GAGAL: "Al-Hikmah" belum jadi "MA Al-Hikmah"';
  assert exists (select 1 from sekolah where name = 'MA Intensif An-Najmu'),
    '112.2 GAGAL: "Intesif An-Najmu" belum jadi "MA Intensif An-Najmu"';
  assert exists (select 1 from sekolah where name = 'PDF Ulya PP Darussalam'),
    '112.3 GAGAL: "Pdf Ulya Pp Darussalam" belum jadi "PDF Ulya PP Darussalam"';

  assert not exists (select 1 from sekolah
                      where name in ('Al-Hikmah', 'Intesif An-Najmu',
                                     'Pdf Ulya Pp Darussalam')),
    '112.4 GAGAL: nama lama tanpa jenjang masih ada';

  -- 2. Kode posnya ikut terisi lewat kecamatannya.
  select address into v_alamat from sekolah where name = 'MA Al-Hikmah';
  assert v_alamat like '%Jawa Barat 46252, Indonesia',
    format('112.5 GAGAL: MA Al-Hikmah (Kec. Cipaku) bukan 46252: %s', v_alamat);
end;
$$;

do $$
declare v_sisa int; v_salah int;
begin
  -- 3. Tidak ada satu pun alamat Kabupaten Ciamis yang tertinggal tanpa kode
  --    pos. Ini yang menahan impor berikutnya menambah alamat setengah jadi.
  select count(*) into v_sisa from sekolah
   where address like '%Kabupaten Ciamis%' and address !~ '\m\d{5}\M';
  assert v_sisa = 0,
    format('112.6 GAGAL: %s alamat Kabupaten Ciamis tanpa kode pos', v_sisa);

  -- 4. Kode pos Kabupaten Ciamis selalu 462xx, 463xx, atau 46352 — tidak
  --    pernah angka provinsi lain. Menangkap salah tempel di tabel rujukan.
  select count(*) into v_salah from sekolah
   where address like '%Kabupaten Ciamis%'
     and substring(address from '\m(\d{5})\M') !~ '^46(2[0-9][0-9]|3[0-9][0-9])$';
  assert v_salah = 0,
    format('112.7 GAGAL: %s kode pos di luar rentang Kabupaten Ciamis', v_salah);
end;
$$;

do $$
declare v_kp text;
begin
  -- 5. Kecamatan Ciamis dicocokkan lewat DESA, bukan lewat kecamatan. Kalau
  --    seseorang menyederhanakannya jadi satu kode pos per kecamatan, dua
  --    baris ini akan bertabrakan — keduanya Kec. Ciamis, kode posnya beda.
  select substring(address from '\m(\d{5})\M') into v_kp
    from sekolah where name = 'SMAN 3 Ciamis';   -- Maleber
  assert v_kp = '46214',
    format('112.8 GAGAL: SMAN 3 Ciamis (Maleber) bukan 46214: %s', v_kp);

  select substring(address from '\m(\d{5})\M') into v_kp
    from sekolah where name = 'MTsN 1 Ciamis';   -- Panyingkiran
  assert v_kp = '46211',
    format('112.9 GAGAL: MTsN 1 Ciamis (Panyingkiran) bukan 46211: %s', v_kp);
end;
$$;

do $$
declare v_kembar int; v_regu int; v_nilai int;
begin
  -- 6. Penggantian nama tidak melahirkan kembar, dan rekap nilai utuh.
  select count(*) into v_kembar from (
    select kunci_sekolah(name) from sekolah group by 1 having count(*) > 1) x;
  assert v_kembar = 0, format('112.10 GAGAL: %s kunci sekolah kembar', v_kembar);

  select count(*) into v_regu  from regu;
  select count(*) into v_nilai from nilai_mentah;
  assert v_regu > 0, '112.11 GAGAL: tabel regu kosong sesudah 0160';

  assert not exists (select 1 from pendaftaran where sekolah_id is null),
    '112.12 GAGAL: ada pendaftaran tanpa sekolah';

  raise notice '112: % regu, % nilai tetap utuh.', v_regu, v_nilai;
end;
$$;

\echo '112 kode pos dan nama tersisa: LULUS'
