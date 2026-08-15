-- ============================================================================
-- hrcd-rekap : supabase/checks/seed_data_uji.sql
--
-- DATA UJI untuk melihat layar Input Pos dan Rekapitulasi terisi. BUKAN
-- migrasi — jangan pernah dijalankan setelah pendaftaran asli dibuka.
--
-- Pasangannya `cleanup_data_uji.sql`, yang membuang persis apa yang berkas ini
-- pasang. Keduanya memakai kosakata yang sama supaya jelas mereka sepasang.
--
-- ---------------------------------------------------------------------------
-- ASALNYA DATA INI
--
-- 50 regu HRCD XXXVI yang diberikan panitia sebagai contoh isi lembar Pos 1.
-- Dipakai apa adanya, dengan tiga penyesuaian yang disebutkan supaya tidak
-- dikira data sungguhan. Sisanya 46 regu:
--
--   * Nomor dada 010 dan 032 kosong di daftar aslinya, jadi dilewati. Lubang
--     nomornya sengaja dibiarkan — begitulah rupa daftar nyata setelah ada
--     regu yang batal.
--   * Nomor 007 dan 033 bergolongan "INTERN PA" — regu kelas dari sekolah
--     tuan rumah, dan nama "sekolah"-nya memang nama kelas ("XII MIPA 3").
--     Dibuang atas permintaan panitia, karena XXXVII tidak punya golongan
--     intern dan memaksakannya ke `penegak_pa` akan membuat mereka muncul di
--     klasemen Penegak PA seolah sekolah luar. Sisa 46 regu.
--   * Alamat setiap sekolah ditulis "(data uji — HRCD XXXVI)". Ini penanda
--     yang disengaja: `cleanup_data_uji.sql` tidak bisa membedakan sekolah uji
--     dari sekolah sungguhan, jadi pembedanya harus terbaca mata manusia.
--
-- ---------------------------------------------------------------------------
-- SENGAJA TIDAK LENGKAP
--
-- Nilai TIDAK diisi merata, karena rekap yang semuanya hijau tidak
-- memperlihatkan apa pun. Yang dipasang adalah potret pertengahan lomba:
--
--   Pos 1, 2, 3  semua regu terisi          -> panel kelengkapan hijau
--   Pos 4        hanya kloter 1-3           -> sisanya "kosong"
--   Pos 5        hanya kloter 1-2, dan
--                sebagian regu cuma 2 dari
--                4 komponen                 -> muncul sebagai "sebagian"
--
-- Dua regu sengaja tidak punya baris closing (-100), dan empat regu datang
-- dengan 4 anggota (-20). Keduanya jalur pengurangan yang paling jarang
-- terlihat sebelum hari-H, dan paling mahal kalau ternyata salah hitung.
--
-- Angkanya diturunkan dari nomor dada, bukan dari random() — supaya
-- menjalankan ulang berkas ini menghasilkan rekap yang sama persis, dan
-- tangkapan layar kemarin masih bisa dibandingkan dengan yang hari ini.
--
-- ---------------------------------------------------------------------------
-- YANG TIDAK DISENTUH
--
-- `status_acara` dibiarkan di fase `pra`. Menggesernya akan membuat
-- publish-live.yml menerbitkan data uji ini ke halaman peserta — 46 regu
-- karangan dengan nama sekolah sungguhan, terbaca siapa pun.
-- ============================================================================

do $$
declare
  v_admin  uuid;
  v_ada    int;
  v_regu   int;
  v_nilai  int;
begin
  -- -------------------------------------------------------------------------
  -- Penjaga: berkas ini hanya untuk database kosong. Kalau sudah ada sekolah,
  -- kita tidak bisa tahu mana yang uji dan mana yang sungguhan — dan menimpa
  -- pendaftaran asli dengan data karangan bukan kesalahan yang bisa diurungkan
  -- dengan git revert.
  -- -------------------------------------------------------------------------
  select count(*) into v_ada from sekolah;
  if v_ada > 0 then
    raise exception
      'Sudah ada % sekolah di database. Berkas ini hanya untuk database '
      'kosong — jalankan cleanup_data_uji.sql dulu kalau memang isinya data '
      'uji, dan JANGAN jalankan sama sekali kalau isinya pendaftaran asli.',
      v_ada;
  end if;

  select user_id into v_admin from akun_panitia
  where peran = 'admin' and is_active order by username limit 1;
  if v_admin is null then
    raise exception 'Tidak ada akun admin aktif — kolom created_by tidak bisa diisi.';
  end if;

  -- -------------------------------------------------------------------------
  -- Daftar regunya. Satu tempat, satu bentuk — sekolah, pendaftaran, regu,
  -- kloter, dan nilai semuanya diturunkan dari tabel sementara ini.
  -- -------------------------------------------------------------------------
  create temporary table daftar_uji (
    nomor_dada integer primary key,
    nama_regu  text not null,
    sekolah    text not null,
    golongan   text not null
  ) on commit drop;

  insert into daftar_uji values
    (  1, 'KALAKI RACING',           'SMA TERPADU CIKANYERE',        'penegak_pa'),
    (  2, 'SATE TUSUK',              'SMPN 1 BAREGBEG',              'penggalang_pi'),
    (  3, 'KAMBING HITAM',           'SMPN 1 BAREGBEG',              'penggalang_pa'),
    (  4, 'RIMBA KUYY',              'MTSN 2 CIAMIS',                'penggalang_pa'),
    (  5, 'SATYA PAJAJARAN',         'SMKN 3 TASIKMALAYA',           'penegak_pi'),
    (  6, 'GENG ELITE',              'MA AL-ISHLAH',                 'penegak_pa'),
    (  8, 'CITRALOKA SUKAPURA 1',    'SMKN MANONJAYA',               'penegak_pi'),
    (  9, 'BOMBANG RARANG',          'SMAN 1 CIHAURBEUTI',           'penegak_pa'),
    ( 11, 'KOPASA MANECIS',          'MAN 6 CIAMIS',                 'penegak_pi'),
    ( 12, 'BOMBANG KENCANA',         'SMAN 1 CIHAURBEUTI',           'penegak_pi'),
    ( 13, 'PHAIS OREGH',             'SMA TERPADU CIKANYERE',        'penegak_pi'),
    ( 14, 'NAMIRA PUI CIJANTUNG',    'MTS PUI CIJANTUNG',            'penggalang_pi'),
    ( 15, 'PERKASA',                 'MA PUI CIJANTUNG',             'penegak_pa'),
    ( 16, 'EXPOSE PUI CIJANTUNG',    'MA PUI CIJANTUNG',             'penegak_pa'),
    ( 17, 'DEPIRA PUI CIJANTUNG',    'MA PUI CIJANTUNG',             'penegak_pi'),
    ( 18, 'KIWANA PEHUNG',           'SMKN 1 LOSARANG',              'penegak_pa'),
    ( 19, 'PARADIS',                 'MA PUI CIJANTUNG',             'penegak_pi'),
    ( 20, 'MOJANG TO FIGHT',         'SMPN 2 CIAMIS',                'penggalang_pi'),
    ( 21, 'PANCARAGA MANECIS',       'MAN 6 CIAMIS',                 'penegak_pi'),
    ( 22, 'KING KOBRA NESACIP',      'SMKN 1 CIPAKU',                'penegak_pa'),
    ( 23, 'KI WANA LAS',             'SMKN 1 LOSARANG',              'penegak_pa'),
    ( 24, 'LASKAR CONDONG 2',        'SMPT RIYADLUL ULUM WADDAWAH',  'penggalang_pa'),
    ( 25, 'NYI ITEUNG',              'SMA INFORMATIKA CIAMIS',       'penegak_pi'),
    ( 26, 'SANGGA EMPIRE',           'SMA INFORMATIKA CIAMIS',       'penegak_pa'),
    ( 27, 'R.A KARTINI',             'MA BKMU CIKIJING',             'penegak_pi'),
    ( 28, 'BRINGKA NESACIP',         'SMKN 1 CIPAKU',                'penegak_pi'),
    ( 29, 'WANA KARWEK',             'SMKN 1 LOSARANG',              'penegak_pa'),
    ( 30, 'SEEENJAAAA',              'SMKN 2 BANJAR',                'penegak_pa'),
    ( 31, 'BAREGBEG EMFIRE',         'SMAN 1 BAREGBEG',              'penegak_pa'),
    ( 34, 'DYAH PITALOKA',           'SMK SILIWANGI AMS BANJARSARI', 'penegak_pi'),
    ( 35, 'BEBELAC SQUAD',           'SMKN 1 RAJADESA',              'penegak_pa'),
    ( 36, 'BLACK MIEEE',             'SMPN 1 BAREGBEG',              'penggalang_pi'),
    ( 37, 'BAKPAO TUTUNGZ',          'SMPN 1 BAREGBEG',              'penggalang_pi'),
    ( 38, 'ARIMBI SQUAD',            'MTSN 2 CIAMIS',                'penggalang_pi'),
    ( 39, 'TERNO DAY',               'MA IBADUL GHAFUR',             'penegak_pa'),
    ( 40, 'GARUDA BANGSA',           'MTSN 2 CIAMIS',                'penggalang_pa'),
    ( 41, 'COLOR RAINBOW',           'SMA TERPADU CIKANYERE',        'penegak_pi'),
    ( 42, 'MEGASTRIUM',              'SMKN 2 BANJAR',                'penegak_pi'),
    ( 43, 'NYI WANAGRI',             'SMKN 1 LOSARANG',              'penegak_pi'),
    ( 44, 'ADAM MALIK',              'SMA IT AL-FALAH',              'penegak_pa'),
    ( 45, 'NANYA KA URANG??',        'MA IBADUL GHAFUR',             'penegak_pa'),
    ( 46, 'PIBERA PUI CIJANTUNG',    'MA PUI CIJANTUNG',             'penegak_pi'),
    ( 47, 'VICTORIA',                'MA PUI CIJANTUNG',             'penegak_pi'),
    ( 48, 'LASKAR INTISAB',          'MTS PUI CIJANTUNG',            'penggalang_pa'),
    ( 49, 'MAUNG BODAS',             'SMK SILIWANGI AMS BANJARSARI', 'penegak_pa'),
    ( 50, 'CAK-CAK HEUYAY',          'SMPN 1 BAREGBEG',              'penggalang_pa');

  -- -------------------------------------------------------------------------
  -- Sekolah, lalu satu pendaftaran per sekolah. Sekolah yang mengirim beberapa
  -- regu tetap SATU pendaftaran — begitulah bentuknya di alur asli, dan itu
  -- yang membuat layar Daftar Ulang punya sesuatu untuk dikelompokkan.
  -- -------------------------------------------------------------------------
  insert into sekolah (name, address)
  select distinct sekolah, '(data uji — HRCD XXXVI)' from daftar_uji;

  insert into pendaftaran (sekolah_id, kode_pembayaran, kontak_wa,
                           jumlah_regu, jumlah_pendamping, butuh_barak, status)
  select s.id,
         'UJI-' || lpad((row_number() over (order by s.name))::text, 3, '0'),
         '08000000000',
         count(d.nomor_dada),
         1,
         (count(d.nomor_dada) > 2),   -- sekolah besar menginap
         'lunas'
  from sekolah s join daftar_uji d on d.sekolah = s.name
  group by s.id, s.name;

  -- -------------------------------------------------------------------------
  -- Regu, berikut kloternya. 10 regu per kloter, urut nomor dada — persis
  -- aturan yang dipakai daftar_ulang_batch.
  -- -------------------------------------------------------------------------
  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan,
                    nomor_dada, kloter_nomor, urutan_kloter, kontrak_menit)
  select p.id,
         d.nama_regu,
         'Ketua ' || d.nama_regu,
         d.golongan,
         d.nomor_dada,
         ((rn - 1) / 10 + 1)::smallint,
         ((rn - 1) % 10 + 1)::smallint,
         (array[210, 240, 270])[(d.nomor_dada % 3) + 1]
  from (select *, row_number() over (order by nomor_dada) as rn
        from daftar_uji) d
  join sekolah s     on s.name = d.sekolah
  join pendaftaran p on p.sekolah_id = s.id;

  -- Kloter berangkat mulai 07.00 WIB, berjarak 15 menit.
  update kloter set jam_berangkat =
    timestamptz '2027-02-21 07:00+07' + make_interval(mins => (nomor - 1) * 15)
  where nomor between 1 and 5;

  -- -------------------------------------------------------------------------
  -- Closing. Selisih datang -20..+20 menit terhadap kontrak, diturunkan dari
  -- nomor dada — cukup lebar untuk memunculkan penalti 0, 10, dan 20 sekaligus.
  --
  -- Dua regu (nomor dada kelipatan 17) sengaja TIDAK punya baris closing:
  -- itulah -100 tanpa checkout. Empat regu (kelipatan 11) datang berempat:
  -- itulah -20 per anggota hilang.
  -- -------------------------------------------------------------------------
  insert into closing_regu (regu_id, jam_datang, anggota_hadir, recorded_by)
  select r.id,
         k.jam_berangkat
           + make_interval(mins => r.kontrak_menit)
           + make_interval(mins => (r.nomor_dada * 13) % 41 - 20),
         case when r.nomor_dada % 11 = 0 then 4 else 5 end,
         v_admin
  from regu r join kloter k on k.nomor = r.kloter_nomor
  where r.nomor_dada % 17 <> 0;

  -- -------------------------------------------------------------------------
  -- Nilai. Satu perintah untuk seluruh 24 komponen: bentuknya yang menentukan
  -- angka mentah apa yang masuk akal, bukan daftar per lomba yang harus
  -- ditulis ulang tiap kali konfigurasi berubah.
  --
  --   besar_baik  -> jumlah benar / poin juri, 0..raw_terbaik
  --   bertingkat + satuan detik -> 15..50 detik
  --   bertingkat tanpa satuan   -> selisih 0..6 meter (Menaksir)
  --
  -- `komponen_berlaku` memastikan tiap regu hanya mendapat baris Tebak Simpul
  -- golongannya sendiri — tanpa itu, setiap regu mengisi empat baris dan Pos 1
  -- membengkak jadi 600.
  -- -------------------------------------------------------------------------
  insert into nilai_mentah (regu_id, wahana_id, nilai_1, source, created_by)
  select r.id, w.id,
         case
           when w.form = 'bertingkat' and w.satuan = 'detik'
             then 15 + (r.nomor_dada * 7 + length(w.kode)) % 36
           when w.form = 'bertingkat'
             then (r.nomor_dada * 3) % 7
           else (r.nomor_dada * 7 + length(w.kode)) % (w.raw_terbaik + 1)::int
         end,
         'manual', v_admin
  from regu r
  cross join wahana w
  where w.edisi = edisi_aktif()
    and komponen_berlaku(w.golongan, r.golongan)
    -- Potret pertengahan lomba: pos belakang belum semuanya masuk.
    and (w.pos <= 3
         or (w.pos = 4 and r.kloter_nomor <= 3)
         or (w.pos = 5 and r.kloter_nomor <= 2
             -- Sebagian regu baru dua dari empat komponen Yel-Yel: inilah yang
             -- harus muncul sebagai "sebagian", bukan "lengkap".
             and (r.nomor_dada % 4 <> 0 or w.sort_order <= 2)));

  select count(*) into v_regu  from regu;
  select count(*) into v_nilai from nilai_mentah;
  raise notice 'Data uji terpasang: % regu, % nilai, % sekolah.',
    v_regu, v_nilai, (select count(*) from sekolah);
end;
$$;
