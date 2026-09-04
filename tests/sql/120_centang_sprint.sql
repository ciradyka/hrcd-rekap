\echo '--- 120. centang sprint: dua arah, satu jejak, berpagar panitia'

do $$
declare
  v_jumlah int;
  v_oleh   text;
  v_pada   timestamptz;
  v_ditolak boolean := false;
begin
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);

  -- 120.1 Mencentang menyimpan satu baris untuk edisi AKTIF, bukan edisi lain.
  perform set_centang_sprint('s6-desa', true);
  select count(*) into v_jumlah
    from centang_sprint where kode = 's6-desa' and edisi = edisi_aktif();
  assert v_jumlah = 1,
    format('120.1 GAGAL: %s baris centang, bukan 1', v_jumlah);

  -- 120.2 Jejaknya ikut terisi. Ini yang menggantikan pagar hak akses
  --       (lihat kepala 0170), jadi kalau ia kosong pagarnya hilang tanpa
  --       ada yang mengeluh.
  select dicentang_oleh, dicentang_pada into v_oleh, v_pada
    from v_centang_sprint where kode = 's6-desa';
  assert v_oleh is not null, '120.2 GAGAL: nama pencentang tidak tercatat';
  assert v_pada is not null, '120.2 GAGAL: waktu centang tidak tercatat';

  -- 120.3 Mencentang DUA KALI tidak menggandakan barisnya, dan tidak
  --       memindahkan jejaknya ke orang kedua. Yang berguna dari kolom itu
  --       siapa yang MENYELESAIKAN, bukan siapa yang terakhir mengetuk.
  perform set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', true);
  perform set_centang_sprint('s6-desa', true);
  select count(*) into v_jumlah
    from centang_sprint where kode = 's6-desa' and edisi = edisi_aktif();
  assert v_jumlah = 1,
    format('120.3 GAGAL: centang kedua menggandakan baris (%s)', v_jumlah);
  assert (select dicentang_oleh from v_centang_sprint where kode = 's6-desa')
         = v_oleh,
    '120.3 GAGAL: jejak berpindah ke pencentang kedua';

  -- 120.4 Membatalkan menghapus barisnya, bukan menyetel kolom jadi false.
  --       Kalau suatu hari ada kolom `selesai`, tes ini yang menangkapnya.
  perform set_centang_sprint('s6-desa', false);
  select count(*) into v_jumlah
    from centang_sprint where kode = 's6-desa' and edisi = edisi_aktif();
  assert v_jumlah = 0,
    format('120.4 GAGAL: %s baris tersisa sesudah dibatalkan', v_jumlah);

  -- 120.5 Membatalkan yang memang belum dicentang bukan galat. Dua orang
  --       yang membatalkan tugas yang sama beruntun adalah kejadian rapat
  --       yang biasa, bukan kesalahan yang perlu diteriakkan.
  perform set_centang_sprint('s6-desa', false);

  -- 120.6 Kode yang tidak sesuai bentuk ditolak. Kode dipakai jadi id elemen
  --       di layar, dan yang tidak berbentuk begitu tidak akan pernah cocok
  --       dengan tugas mana pun — ia cuma jadi baris yatim.
  begin
    perform set_centang_sprint('S6 Desa!', true);
  exception when others then v_ditolak := true;
  end;
  assert v_ditolak, '120.6 GAGAL: kode berbentuk salah diterima';
end $$;

-- ---------------------------------------------------------------------------
-- 120.7 Pagarnya menempati kursi, bukan memindai nama (CLAUDE.md 13.8).
--       Panggilan yang sama dijalankan dua kali; yang berubah di antaranya
--       satu hal saja — apakah pemanggilnya panitia.
-- ---------------------------------------------------------------------------
do $$
declare v_ditolak boolean := false;
begin
  -- `lama_hrcd36` ADA di akun_panitia tetapi is_active false, dan peran()
  -- menyaringnya. Sengaja memakai akun yang ada, bukan uuid karangan: yang
  -- ingin dijaga bukan "uuid asing ditolak" melainkan "akun yang sudah
  -- dinonaktifkan berhenti bisa menulis".
  perform set_config('app.uid', '00000000-0000-0000-0000-0000000000ff', true);
  begin
    perform set_centang_sprint('s1-inti', true);
  exception when others then v_ditolak := true;
  end;
  assert v_ditolak, '120.7 GAGAL: bukan panitia bisa mencentang';

  -- uid yang sama persis dipakai lagi, kali ini milik panitia.
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  perform set_centang_sprint('s1-inti', true);
  assert (select count(*) from centang_sprint where kode = 's1-inti') = 1,
    '120.7 GAGAL: panitia justru tidak bisa mencentang';
  perform set_centang_sprint('s1-inti', false);
end $$;

-- ---------------------------------------------------------------------------
-- 120.8 View-nya hanya membuka edisi AKTIF. Centang edisi lalu yang ikut
--       terbaca akan membuat papan sprint tahun ini terbuka setengah penuh
--       di hari pertama kepanitiaan baru — dan tidak ada satu pun tanda
--       bahwa yang tercentang itu pekerjaan orang lain, tahun lalu.
-- ---------------------------------------------------------------------------
do $$
declare v_edisi_lain int;
begin
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);

  select nomor into v_edisi_lain from edisi where nomor <> edisi_aktif() limit 1;
  if v_edisi_lain is null then
    insert into edisi (nomor, name, tahun, tanggal_lomba, biaya_per_regu,
                       is_active)
    values (999, 'HRCD UJI 120', 2099, date '2099-01-01', 1000, false)
    returning nomor into v_edisi_lain;
  end if;

  insert into centang_sprint (edisi, kode) values (v_edisi_lain, 's1-akses')
    on conflict do nothing;

  assert not exists (select 1 from v_centang_sprint where kode = 's1-akses'),
    '120.8 GAGAL: centang edisi lain ikut terbaca di edisi aktif';

  delete from centang_sprint where edisi = v_edisi_lain;
  delete from edisi where nomor = 999;
end $$;

\echo '    120 OK'
