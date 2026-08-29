\echo '--- 110. alamat direktori berbentuk baku'

do $$
declare v_n int;
begin
  -- Diperiksa hanya alamat yang memang alamat: delapan sekolah karangan dari
  -- 01_seed_uji beralamat "Ciamis" atau "Jl. Batal 1" tanpa satu koma pun.
  select count(*) into v_n from sekolah
   where address like '%,%' and address ~ '^(JALAN|Jalan|JLN|Jln|JL\.|JL )';
  assert v_n = 0, format('110.1 GAGAL: %s alamat memakai Jalan/JLN/JL, bukan "Jl."', v_n);

  select count(*) into v_n from sekolah
   where address like '%,%' and address ~ '\mNo\.[0-9]';
  assert v_n = 0, format('110.2 GAGAL: %s alamat menulis "No.17" tanpa spasi', v_n);

  select count(*) into v_n from sekolah
   where address like '%,%' and address ~* '(kec|kab|ds|kel|desa)\.[A-Za-z]';
  assert v_n = 0, format('110.3 GAGAL: %s alamat memuat wilayah yang menempel', v_n);

  -- Bagian jalan tidak boleh HURUF BESAR SEMUA: ia dibaca pembina di kotak
  -- pilihan, berjajar dengan 520 baris lain.
  select count(*) into v_n from sekolah
   where address like '%,%'
     and upper(split_part(address, ',', 1)) = split_part(address, ',', 1)
     and length(split_part(address, ',', 1)) > 8
     and split_part(address, ',', 1) ~ '[A-Za-z]{3}';
  assert v_n = 0, format('110.4 GAGAL: %s alamat berhuruf besar semua', v_n);

  raise notice '110: bentuk alamat baku di seluruh tabel sekolah.';
end;
$$;

\echo '110 alamat direktori baku: LULUS'
