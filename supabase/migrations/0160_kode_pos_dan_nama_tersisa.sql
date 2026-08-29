-- ============================================================================
-- hrcd-rekap : 0160_kode_pos_dan_nama_tersisa.sql
-- Kode pos untuk 297 alamat direktori, dan empat nama yang tidak berjenjang.
--
-- KENAPA ADA
--
-- 0157 memasukkan 309 sekolah se-Kabupaten Ciamis dari Data Referensi, dan
-- kolom alamat Dapodik memuat kode pos hanya pada delapan di antaranya. Bentuk
-- alamat yang dipakai repositori ini (runbook bagian 8) menyertakan kode pos:
--
--   jalan, desa, Kec. X, Kabupaten Y, Jawa Barat NNNNN, Indonesia
--
-- Jadi 297 baris berbentuk benar tetapi tidak lengkap, dan itu kelihatan di
-- kotak cari pendaftaran — dua sekolah bersebelahan, yang satu berkode pos,
-- yang satu tidak.
--
-- DARI MANA ANGKANYA, DAN KENAPA BOLEH DIPERCAYA
--
-- Dari daftar kode pos per desa se-Kabupaten Ciamis. Yang membuatnya layak
-- dipakai bukan situsnya, melainkan bahwa ia DIUJI DULU terhadap isi produksi
-- sendiri: 130 baris kurasi di Kabupaten Ciamis sudah punya kode pos, dan
-- rujukan itu setuju dengan SELURUH 130 — nol berbeda, nol desa yang tidak
-- dikenalnya. Termasuk dua angka yang dulu sempat diperdebatkan: Panyingkiran
-- 46211 (bukan 46251) dan Cigayam 46384 (bukan 46383, dibetulkan 0159).
--
-- DUA CARA MENCOCOKKAN, DAN KENAPA HARUS DUA
--
-- Dua puluh enam kecamatan Kabupaten Ciamis memakai SATU kode pos untuk
-- seluruh desanya, jadi nama kecamatannya sudah cukup. Kecamatan Ciamis
-- TIDAK: dua belas desanya terbagi ke enam kode pos (46211 sampai 46219),
-- karena ia kecamatan kotanya. Mencocokkan Kec. Ciamis lewat kecamatan akan
-- memberi angka yang salah kepada sebelas dari dua belas desanya, jadi ia
-- dicocokkan lewat NAMA DESA dan punya tabelnya sendiri di bawah.
--
-- EMPAT NAMA YANG TIDAK BERJENJANG
--
-- Data Referensi menulis nama satuan tanpa bentuk pendidikannya, dan untuk
-- tiga baris bentuk itu tidak ikut tersalin waktu 0157 dibuat. Bentuknya
-- diambil dari halaman NPSN masing-masing:
--
--   Al-Hikmah              -> MA Al-Hikmah            (NPSN 69976341, bentuk MA)
--   Intesif An-Najmu       -> MA Intensif An-Najmu    (NPSN 69976342, bentuk MA)
--   Pdf Ulya Pp Darussalam -> PDF Ulya PP Darussalam  (NPSN 69937222, bentuk PDF Ulya)
--
-- "Intensif" ditulis dengan huruf N yang di daftar resmi hilang. Data
-- Referensi mengejanya "INTESIF", dan direktori lain menyalin ejaan itu dari
-- sana — jadi keduanya satu sumber, bukan dua. Yang menentukan di sini kotak
-- cari: pembina mengetik "intensif", dan "Intesif" tidak akan ketemu. Tidak
-- ada satu pendaftaran pun yang menunjuk baris ini, jadi ini murni soal bisa
-- ditemukan atau tidak.
--
-- PDF Ulya setara SMA, jadi ia memang boleh ikut golongan Penegak. Pendidikan
-- Diniyah Formal jenjang Ulya adalah satuan formal di bawah Kemenag; namanya
-- ditulis huruf besar seperti singkatan lain.
--
-- SMP AL FADLILIYAH DARUSSALAM: ALAMATNYA DIISI, TIDAK DILEBUR
--
-- Baris ini satu-satunya di seluruh tabel yang alamatnya bukan alamat:
-- "Jl KH Ahmad Fadhil", tanpa desa, tanpa kecamatan, tanpa kabupaten — tanda
-- khas alamat yang DIKETIK di form pendaftaran. Ia diberi alamat kampus
-- pesantrennya dan ejaannya disamakan dengan baris MTs-nya.
--
-- Yang TIDAK dilakukan di sini: meleburnya. Data Referensi tidak memuat SMP
-- dengan nama itu — kompleks Pesantren Darussalam terdaftar sebagai MI, MTs
-- Al-Fadliliyah Darussalam (NPSN 20211978), SMA Plus Darussalam, dan PDF Ulya.
-- Jadi ada dua kemungkinan yang sama masuk akalnya: SMP yang memang ada tetapi
-- belum terdaftar, atau salah ketik untuk MTs-nya. Keduanya setingkat
-- Penggalang, jadi tidak ada di data yang bisa memutuskan. Meleburnya
-- memindahkan pendaftaran, dan itu keputusan pemilik acara, bukan keputusan
-- yang boleh diambil diam-diam oleh sebuah migrasi (CLAUDE.md 12.3). Blok
-- terakhir mencetak `raise notice` supaya pertanyaannya tidak hilang.
--
-- REKAP NILAI TIDAK DISENTUH. Hanya `sekolah.name` dan `sekolah.address` yang
-- diubah; tidak ada baris dilebur, ditambah, atau dihapus, jadi tidak ada
-- `pendaftaran.sekolah_id` yang berpindah. Blok penutup membandingkan
-- jumlahnya.
--
-- BISA DIJALANKAN DUA KALI: penggantian nama menyaring nama lamanya, dan
-- pengisian kode pos hanya mengenai alamat yang berakhir "Jawa Barat,".
-- ============================================================================

drop table if exists potret_0160;
create temporary table potret_0160 as
select (select count(*) from regu)         as regu,
       (select count(*) from nilai_mentah) as nilai_mentah,
       (select count(*) from closing_regu) as closing_regu,
       (select count(*) from pendaftaran)  as pendaftaran,
       (select count(*) from sekolah)      as sekolah;

-- ---------------------------------------------------------------------------
-- 1. Empat nama.
-- ---------------------------------------------------------------------------
drop table if exists nama_0160;
create temporary table nama_0160 (lama text, baru text, npsn text);
insert into nama_0160 (lama, baru, npsn) values
  ('Al-Hikmah',                    'MA Al-Hikmah',                 '69976341'),
  ('Intesif An-Najmu',             'MA Intensif An-Najmu',         '69976342'),
  ('Pdf Ulya Pp Darussalam',       'PDF Ulya PP Darussalam',       '69937222'),
  ('SMP AL Fadliliyah Darussalam', 'SMP Al-Fadliliyah Darussalam', null);

do $$
declare r record; v_n int; v_total int := 0;
begin
  for r in select * from nama_0160 order by lama loop
    if not exists (select 1 from sekolah where name = r.lama) then
      raise notice '0160: (dilewati) "%" memang tidak ada.', r.lama;
      continue;
    end if;
    -- Nama barunya tidak boleh sudah dipakai baris LAIN: itu peleburan, dan
    -- peleburan bukan pekerjaan migrasi ini.
    if exists (select 1 from sekolah
                where kunci_sekolah(name) = kunci_sekolah(r.baru)
                  and name <> r.lama) then
      raise exception '0160: "%" sudah ada sebagai baris lain — itu peleburan, bukan penggantian nama', r.baru;
    end if;
    update sekolah set name = r.baru where name = r.lama;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
    raise notice '0160: "%" -> "%" (NPSN %).', r.lama, r.baru, coalesce(r.npsn, 'tidak terdaftar');
  end loop;
  raise notice '0160: % nama dibakukan.', v_total;
end $$;

-- Alamat kampus pesantrennya. Desa Dewasari, Kec. Cijeungjing, sama dengan
-- baris MTs-nya, dan 46271 kode pos seluruh sebelas desa Cijeungjing.
update sekolah
   set address = 'Jl. K.H. Ahmad Fadlil I, Dewasari, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat 46271, Indonesia'
 where name = 'SMP Al-Fadliliyah Darussalam'
   and address not like '%Kec. Cijeungjing%';

-- ---------------------------------------------------------------------------
-- 2. Kode pos: dua puluh enam kecamatan yang seragam.
-- ---------------------------------------------------------------------------
drop table if exists kodepos_kec_0160;
create temporary table kodepos_kec_0160 (kecamatan text, kodepos text);
insert into kodepos_kec_0160 (kecamatan, kodepos) values
  ('Banjaranyar', '46384'),
  ('Banjarsari', '46383'),
  ('Baregbeg', '46274'),
  ('Cidolog', '46352'),
  ('Cihaurbeuti', '46262'),
  ('Cijeungjing', '46271'),
  ('Cikoneng', '46261'),
  ('Cimaragas', '46381'),
  ('Cipaku', '46252'),
  ('Cisaga', '46386'),
  ('Jatinagara', '46273'),
  ('Kawali', '46253'),
  ('Lakbok', '46385'),
  ('Lumbung', '46258'),
  ('Pamarican', '46382'),
  ('Panjalu', '46264'),
  ('Panawangan', '46255'),
  ('Panumbangan', '46263'),
  ('Purwadadi', '46385'),
  ('Rajadesa', '46254'),
  ('Rancah', '46387'),
  ('Sadananya', '46256'),
  ('Sindangkasih', '46268'),
  ('Sukadana', '46272'),
  ('Sukamantri', '46264'),
  ('Tambaksari', '46388');

-- ---------------------------------------------------------------------------
-- 3. Kode pos: dua belas desa Kecamatan Ciamis, yang TIDAK seragam.
-- ---------------------------------------------------------------------------
drop table if exists kodepos_ciamis_0160;
create temporary table kodepos_ciamis_0160 (desa text, kodepos text);
insert into kodepos_ciamis_0160 (desa, kodepos) values
  ('Benteng', '46217'),
  ('Ciamis', '46211'),
  ('Cigembor', '46212'),
  ('Cisadap', '46215'),
  ('Imbanagara', '46219'),
  ('Imbanagara Raya', '46219'),
  ('Kertasari', '46213'),
  ('Linggasari', '46216'),
  ('Maleber', '46214'),
  ('Panyingkiran', '46211'),
  ('Pawindan', '46218'),
  ('Sindangrasa', '46215');

do $$
declare v_kec int; v_kota int;
begin
  update sekolah s
     set address = replace(s.address, 'Jawa Barat, Indonesia',
                           'Jawa Barat ' || k.kodepos || ', Indonesia')
    from kodepos_kec_0160 k
   where s.address like '%Kec. ' || k.kecamatan || ',%'
     and s.address like '%Kabupaten Ciamis%'
     and s.address like '%Jawa Barat, Indonesia';
  get diagnostics v_kec = row_count;

  update sekolah s
     set address = replace(s.address, 'Jawa Barat, Indonesia',
                           'Jawa Barat ' || k.kodepos || ', Indonesia')
    from kodepos_ciamis_0160 k
   where s.address like '%, ' || k.desa || ', Kec. Ciamis,%'
     and s.address like '%Kabupaten Ciamis%'
     and s.address like '%Jawa Barat, Indonesia';
  get diagnostics v_kota = row_count;

  raise notice '0160: % kode pos lewat kecamatan, % lewat desa Kec. Ciamis.', v_kec, v_kota;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Pemeriksaan penutup.
-- ---------------------------------------------------------------------------
do $$
declare
  s potret_0160%rowtype;
  n_regu int; n_nilai int; n_closing int; n_daftar int; n_sekolah int;
  v_sisa int; v_kembar int;
begin
  select * into s from potret_0160;
  select count(*) into n_regu    from regu;
  select count(*) into n_nilai   from nilai_mentah;
  select count(*) into n_closing from closing_regu;
  select count(*) into n_daftar  from pendaftaran;
  select count(*) into n_sekolah from sekolah;

  assert (n_regu, n_nilai, n_closing, n_daftar, n_sekolah)
         = (s.regu, s.nilai_mentah, s.closing_regu, s.pendaftaran, s.sekolah),
    format('0160: DATA BERGESER — regu %s->%s, nilai %s->%s, closing %s->%s, pendaftaran %s->%s, sekolah %s->%s',
           s.regu, n_regu, s.nilai_mentah, n_nilai, s.closing_regu, n_closing,
           s.pendaftaran, n_daftar, s.sekolah, n_sekolah);

  -- Tidak ada lagi alamat Kabupaten Ciamis tanpa kode pos.
  select count(*) into v_sisa from sekolah
   where address like '%Kabupaten Ciamis%' and address !~ '\m\d{5}\M';
  assert v_sisa = 0,
    format('0160: masih ada %s alamat Kabupaten Ciamis tanpa kode pos', v_sisa);

  -- Penggantian nama tidak melahirkan kembar.
  select count(*) into v_kembar from (
    select kunci_sekolah(name) from sekolah group by 1 having count(*) > 1) x;
  assert v_kembar = 0, format('0160: %s kunci sekolah kembar', v_kembar);

  raise notice '0160: % sekolah, rekap nilai utuh — % regu, % nilai, % closing.',
               n_sekolah, n_regu, n_nilai, n_closing;
end $$;

-- Pertanyaan yang sengaja TIDAK diputuskan migrasi ini. Dicetak tiap kali
-- dijalankan supaya tidak hilang di antara catatan lain.
do $$
begin
  if exists (select 1 from sekolah where name = 'SMP Al-Fadliliyah Darussalam')
     and exists (select 1 from sekolah where name = 'MTs Al-Fadliliyah Darussalam') then
    raise notice '0160: PERIKSA — "SMP Al-Fadliliyah Darussalam" tidak ada di Data Referensi, dan "MTs Al-Fadliliyah Darussalam" (NPSN 20211978) beralamat sama. Keduanya setingkat Penggalang. Kalau pemilik acara memastikan keduanya satu sekolah, peleburannya perlu migrasi tersendiri.';
  end if;
end $$;

drop table if exists potret_0160;
drop table if exists nama_0160;
drop table if exists kodepos_kec_0160;
drop table if exists kodepos_ciamis_0160;
