-- ============================================================================
-- hrcd-rekap : tests/sql/28_sekolah_satu_baris.sql
-- Satu sekolah, satu baris (migrasi 0061).
--
-- Yang dijaga paling keras ada dua, dan keduanya pernah gagal diam-diam:
--
-- 1. **Alamat berbeda tidak lagi melahirkan baris baru.** Ini penyebab
--    aslinya: `SMPN 1 CIAMIS` muncul tiga kali di kotak pilihan pendaftaran
--    karena tiga pembina mengetik alamatnya dengan tiga cara.
-- 2. **Penolakannya datang dari DATABASE.** Kotak pilihan di layar hanya
--    menawarkan yang sudah ada; ia tidak menahan `submit_pendaftaran` yang
--    dipanggil langsung, tidak menahan import, dan tidak menahan siapa pun
--    yang mengetik nama sekolahnya sendiri karena sekolahnya belum terdaftar.
--
-- Dan satu yang harus TIDAK terjadi: dua sekolah yang memang berbeda tetap
-- boleh hidup berdampingan. Itu kebutuhan asli yang membuat 0001 memakai
-- alamat sebagai pembeda, dan menghapusnya sambil merusak kebutuhan itu bukan
-- perbaikan.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Kunci penyamaannya: jinak, dan cuma sejinak itu.
-- ---------------------------------------------------------------------------
do $$
begin
  -- Besar-kecil huruf dan tanda baca hilang.
  assert kunci_sekolah('SMPN 1 CIAMIS') = kunci_sekolah('SMPN 1 Ciamis'),
         'besar-kecil huruf seharusnya tidak membedakan';
  assert kunci_sekolah('MTs Al-Fadliliyah') = kunci_sekolah('MTS AL FADLILIYAH'),
         'tanda hubung seharusnya tidak membedakan';
  assert kunci_sekolah('  SMPN   1  Ciamis  ') = kunci_sekolah('SMPN 1 Ciamis'),
         'spasi berlebih seharusnya tidak membedakan';

  -- Bentuk "Negeri" disamakan, karena pembina menulis dua-duanya.
  assert kunci_sekolah('SMP Negeri 1 Ciamis') = kunci_sekolah('SMPN 1 Ciamis'),
         'SMP Negeri 1 dan SMPN 1 adalah satu sekolah';
  assert kunci_sekolah('SMK Negeri 3 Tasikmalaya') = kunci_sekolah('SMKN 3 Tasikmalaya'),
         'SMK Negeri 3 dan SMKN 3 adalah satu sekolah';
  assert kunci_sekolah('MTs N 5 Ciamis') = kunci_sekolah('MTsN 5 Ciamis'),
         'MTs N 5 dan MTsN 5 adalah satu sekolah';

  -- Huruf status Dapodik (S = Swasta) dibuang — migrasi 0062. Ia status,
  -- bukan nama, dan pembina menulis dua-duanya.
  assert kunci_sekolah('SMKS Galuh Rahayu') = kunci_sekolah('SMK Galuh Rahayu'),
         'SMKS dan SMK adalah satu sekolah';
  assert kunci_sekolah('MAS Al-Kautsar') = kunci_sekolah('MA Al-Kautsar'),
         'MAS dan MA adalah satu sekolah';
  assert kunci_sekolah('MTsS Al-Fadliliyah') = kunci_sekolah('MTs Al-Fadliliyah'),
         'MTsS dan MTs adalah satu sekolah';

  -- Tapi singkatan di dalam NAMA tidak dibuang. "SMA Terpadu X" dan "SMA X"
  -- bisa saja dua sekolah, dan kunci yang menyamakannya melebur keduanya
  -- tanpa suara — kekeliruan yang lebih sulit ditemukan daripada baris kembar.
  assert kunci_sekolah('SMAT Riyadlul Ulum') <> kunci_sekolah('SMA Riyadlul Ulum'),
         'SMAT tidak boleh disamakan dengan SMA begitu saja';

  -- Dan TIDAK lebih jauh dari itu. Ekor kabupaten adalah satu-satunya yang
  -- memisahkan dua sekolah senama (runbook bagian 5); kunci yang membuangnya
  -- akan melebur keduanya tanpa suara.
  assert kunci_sekolah('MAN 3 Ciamis') <> kunci_sekolah('MAN 3 Tasikmalaya'),
         'MAN 3 Ciamis dan MAN 3 Tasikmalaya adalah DUA sekolah (NPSN berbeda)';
  assert kunci_sekolah('MTs PUI Cijantung') <> kunci_sekolah('MA PUI Cijantung'),
         'jenjang berbeda adalah sekolah berbeda';
  assert kunci_sekolah('SMPN 1 Ciamis') <> kunci_sekolah('SMPN 2 Ciamis'),
         'angka sekolah tidak boleh ikut hilang';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Alamat berbeda TIDAK melahirkan baris baru.
-- ---------------------------------------------------------------------------
do $$
declare
  v_n_awal   int;
  v_n_akhir  int;
  v_id_1     uuid;
  v_id_2     uuid;
  v_alamat   text;
begin
  select count(*) into v_n_awal from sekolah;

  insert into sekolah (name, address)
  values ('SMPN 9 Uji Kembar', 'Jl. Pertama No. 1')
  returning id into v_id_1;

  -- Nama sama, alamat beda: dulu lolos, sekarang ditolak.
  begin
    insert into sekolah (name, address)
    values ('SMPN 9 Uji Kembar', 'Jl. Pertama No. 1, Ciamis');
    assert false, 'nama sama dengan alamat beda seharusnya ditolak sekarang';
  exception when unique_violation then null;
  end;

  -- Ejaan nama yang berbeda pun ditolak.
  begin
    insert into sekolah (name, address)
    values ('SMP NEGERI 9 UJI KEMBAR', 'Jl. Lain Sama Sekali');
    assert false, 'SMP Negeri 9 dan SMPN 9 seharusnya ditolak sebagai kembar';
  exception when unique_violation then null;
  end;

  -- Sekolah yang memang berbeda tetap masuk. Ini kebutuhan asli 0001 dan ia
  -- tidak boleh ikut mati.
  insert into sekolah (name, address)
  values ('SMPN 9 Uji Kembar Tasikmalaya', 'Jl. Kedua No. 2')
  returning id into v_id_2;
  assert v_id_1 <> v_id_2, 'dua sekolah berbeda seharusnya dua baris';

  select count(*) into v_n_akhir from sekolah;
  assert v_n_akhir = v_n_awal + 2,
         format('seharusnya bertambah 2 baris, bertambah %s', v_n_akhir - v_n_awal);

  delete from sekolah where id in (v_id_1, v_id_2);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Lewat pintu yang sebenarnya: submit_pendaftaran.
--
--    Dua pembina dari sekolah yang sama, alamat diketik berbeda, dan yang
--    kedua bahkan mengetik namanya dengan huruf kapital semua. Satu sekolah,
--    dua pendaftaran.
-- ---------------------------------------------------------------------------
do $$
declare
  v_n     int;
  v_alamat text;
  v_regu  jsonb := jsonb_build_array(jsonb_build_object(
            'nama_regu', 'Uji Pintu Pertama', 'nama_ketua', 'Ketua Uji',
            'golongan', 'penggalang_pa'));
begin
  perform submit_pendaftaran(
    'SMPN 8 Uji Pintu', 'Jl. Benar No. 10, Ciamis', false, '081200000001', v_regu);

  perform submit_pendaftaran(
    'SMPN 8 UJI PINTU', 'jln benar no 10', false, '081200000002',
    jsonb_build_array(jsonb_build_object(
      'nama_regu', 'Uji Pintu Kedua', 'nama_ketua', 'Ketua Uji',
      'golongan', 'penggalang_pi')));

  select count(*) into v_n from sekolah
   where kunci_sekolah(name) = kunci_sekolah('SMPN 8 Uji Pintu');
  assert v_n = 1, format('seharusnya satu baris sekolah, ada %s', v_n);

  -- Alamat kurasi bertahan. Pembina kedua sedang mendaftarkan regu, bukan
  -- sedang memperbaiki data kita — kalau alamatnya ikut tertimpa, satu salah
  -- ketik menghapus alamat yang sudah benar.
  select address into v_alamat from sekolah
   where kunci_sekolah(name) = kunci_sekolah('SMPN 8 Uji Pintu');
  assert v_alamat = 'Jl. Benar No. 10, Ciamis',
         format('alamat seharusnya tidak tertimpa, jadi %L', v_alamat);

  -- Dua pendaftaran, dan keduanya menunjuk sekolah yang sama. Ini yang
  -- membuat penyebaran kloter bekerja: regu kedua sekolah ini terbaca satu
  -- sekolah, jadi mereka TIDAK berangkat bareng (CLAUDE.md 12.5).
  select count(distinct d.sekolah_id) into v_n
    from pendaftaran d join sekolah s on s.id = d.sekolah_id
   where kunci_sekolah(s.name) = kunci_sekolah('SMPN 8 Uji Pintu');
  assert v_n = 1, format('dua pendaftaran seharusnya satu sekolah_id, ada %s', v_n);

  delete from regu where pendaftaran_id in (
    select d.id from pendaftaran d join sekolah s on s.id = d.sekolah_id
     where kunci_sekolah(s.name) = kunci_sekolah('SMPN 8 Uji Pintu'));
  delete from pendaftaran where sekolah_id in (
    select id from sekolah where kunci_sekolah(name) = kunci_sekolah('SMPN 8 Uji Pintu'));
  delete from sekolah where kunci_sekolah(name) = kunci_sekolah('SMPN 8 Uji Pintu');
end $$;

-- ---------------------------------------------------------------------------
-- 4. Seluruh isi tabel lolos — kalau tidak, migrasinya gagal di produksi dan
--    yang menemukannya adalah apply-migration yang merah.
-- ---------------------------------------------------------------------------
do $$
declare v_n int;
begin
  select count(*) into v_n from (
    select 1 from sekolah group by kunci_sekolah(name) having count(*) > 1) x;
  assert v_n = 0, format('%s nama sekolah masih kembar', v_n);
end $$;

\echo '28 sekolah satu baris: LULUS'
