-- ============================================================================
-- hrcd-rekap : 0155_sekolah_kode_pos.sql
-- Kode pos untuk 30 sekolah, dan satu yang salah dibetulkan.
--
-- KENAPA ADA
--
-- Data Referensi Kemendikdasmen TIDAK memuat kode pos sama sekali, jadi 20
-- alamat yang dipasang 0154 berakhir tanpa kode pos, bersama sebelas baris
-- lama yang sudah begitu sejak kurasi. Suratnya tetap sampai — alamatnya
-- memuat desa, kecamatan, dan kabupaten — tetapi kode pos memangkas satu
-- tahap sortir dan mengurangi risiko.
--
-- DICARI PER DESA, BUKAN PER KECAMATAN
--
-- Runbook bagian 6 melarang menebak kode pos dari kecamatan, dan larangannya
-- bukan teoretis: Kec. Pamarican punya TIGA kode (46361, 46365, 46382) dan
-- Kec. Ciamis punya SEMBILAN (46211-46219). Menyalin kode kecamatan akan
-- salah untuk lima desa di antaranya. Yang dipakai di sini pasangan
-- (kecamatan, desa) dari kodepos.co.id.
--
-- YANG MEMBUATNYA BISA DIPERCAYA: 179 BARIS KURASI YANG SUDAH ADA
--
-- Delapan belas sekolah kurasi berdiri di Kec. Ciamis, masing-masing dengan
-- desa dan kode pos yang sudah diverifikasi lebih dulu. Kesembilan belasnya
-- cocok dengan direktori tanpa kecuali: Ciamis 46211, Kertasari 46213,
-- Maleber 46214, Sindangrasa 46215, Linggasari 46216, Imbanagara 46219.
-- Direktori yang cocok delapan belas kali bukan lagi tebakan.
--
-- SATU YANG SALAH, DAN CARA KETAHUANNYA
--
-- `MTsN 1 Ciamis` dipasang 0154 dengan kode pos **46251**, diambil dari situs
-- resmi sekolahnya sendiri — sumber tingkat 3 menurut runbook bagian 6. Desanya
-- Panyingkiran, dan dua direktori yang berbeda sama-sama menyebut Panyingkiran
-- **46211**; keduanya juga sama-sama menyebut rentang Kec. Ciamis 46211-46219,
-- yang tidak memuat 46251 sama sekali. Delapan belas tetangganya di kecamatan
-- yang sama mendukung direktori. Jadi yang dipakai 46211, dan sengketanya
-- dicatat di docs/sekolah-belum-tuntas.md bagian C — tempat yang memang sudah
-- ada untuk kode pos yang diperdebatkan.
--
-- Ini juga jawaban kenapa sumber tingkat 1 tetap dicocokkan ke sumber lain:
-- alamat jalannya benar dari situs sekolah, kode posnya tidak.
--
-- HANYA KOLOM `address` YANG BERUBAH. Tidak ada baris dilebur, tidak ada nama
-- diganti, tidak ada baris dihapus. Blok penutup memeriksa jumlah baris nilai
-- sebelum dan sesudah, sama seperti 0154.
--
-- BISA DIJALANKAN DUA KALI: `where address is distinct from` menyaring baris
-- yang alamatnya sudah sama.
-- ============================================================================

drop table if exists potret_nilai_0155;
create temporary table potret_nilai_0155 as
select (select count(*) from regu)         as regu,
       (select count(*) from nilai_mentah) as nilai_mentah,
       (select count(*) from closing_regu) as closing_regu,
       (select count(*) from sekolah)      as sekolah,
       (select count(*) from pendaftaran)  as pendaftaran;

drop table if exists pos_0155;
create temporary table pos_0155 (nama text, alamat text);
insert into pos_0155 (nama, alamat) values
  ('MA Adzkia',
   'Dusun Desa RT 01 RW 03, Kertaharja, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat 46271, Indonesia'),   -- kode pos 46271
  ('MA Al-Ma''sum Malausma',
   'Jl. Desa Malausma - Bungursari, Malausma, Kec. Malausma, Kabupaten Majalengka, Jawa Barat 45464, Indonesia'),   -- kode pos 45464
  ('MA Bahrul Anwar',
   'Dusun Cicurug, Mekarsari, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat 46252, Indonesia'),   -- kode pos 46252
  ('MA IPHI Pamarican',
   'Jl. Raya Pamarican No. 424, Pamarican, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat 46382, Indonesia'),   -- kode pos 46382
  ('MA Mujahidin',
   'Jl. KH. Fachruddin No. 96 Dusun Urug RT 004 RW 002, Pusakasari, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat 46252, Indonesia'),   -- kode pos 46252
  ('MA Sirnarasa',
   'Dusun Ciceuri RT 10 RW 05, Ciomas, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat 46264, Indonesia'),   -- kode pos 46264
  ('MAN 1 Kota Tasikmalaya',
   'Jl. Awipari 1, Awipari, Kec. Cibeureum, Kota Tasikmalaya, Jawa Barat 46196, Indonesia'),   -- kode pos 46196
  ('MAN 6 Ciamis',
   'Jl. Rumah Sakit No. 20, Situmandala, Kec. Rancah, Kabupaten Ciamis, Jawa Barat 46387, Indonesia'),   -- kode pos 46387
  ('MTs Adzkia',
   'Dusun Desa RT 01 RW 03, Kertaharja, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat 46271, Indonesia'),   -- kode pos 46271
  ('MTs Al-Iqna Cisaga',
   'Jl. Cimanggu No. 09 RT 01 RW 08, Cisaga, Kec. Cisaga, Kabupaten Ciamis, Jawa Barat 46386, Indonesia'),   -- kode pos 46386
  ('MTs Al-Istiqomah Kiarapayung',
   'Jl. Rancah-Ciilat No. 131, Kiarapayung, Kec. Rancah, Kabupaten Ciamis, Jawa Barat 46387, Indonesia'),   -- kode pos 46387
  ('MTs Bahrul Anwar',
   'Dusun Cicurug RT 05 RW 04, Mekarsari, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat 46252, Indonesia'),   -- kode pos 46252
  ('MTs Mujahidin',
   'Jl. KH. Fachruddin No. 96 Dusun Urug, Jalatrang, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat 46252, Indonesia'),   -- kode pos 46252
  ('MTs Rancah',
   'Jl. Cibeureum No. 50, Rancah, Kec. Rancah, Kabupaten Ciamis, Jawa Barat 46387, Indonesia'),   -- kode pos 46387
  ('MTsN 1 Ciamis',
   'Jl. Panyingkiran No. 70, Panyingkiran, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat 46211, Indonesia'),   -- kode pos 46211
  ('MTsN 4 Ciamis',
   'Jl. Raya Buniseuri No. 17, Muktisari, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat 46252, Indonesia'),   -- kode pos 46252
  ('MTsN 5 Ciamis',
   'Dusun Mandalagiri RT 03 RW 03, Cisontrol, Kec. Rancah, Kabupaten Ciamis, Jawa Barat 46387, Indonesia'),   -- kode pos 46387
  ('SMA IT MD Fathahillah',
   'Jl. Pasanggrahan-Saguling RT 05 RW 08, Saguling, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat 46274, Indonesia'),   -- kode pos 46274
  ('SMA IT Nurul Huda',
   'Dusun Sukasari RT 026 RW 011, Margajaya, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat 46382, Indonesia'),   -- kode pos 46382
  ('SMA Terpadu Al-Mu''aawanah',
   'Jl. KH. Ahmad Romli No. 26, Rajadesa, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat 46254, Indonesia'),   -- kode pos 46254
  ('SMK As-Sulthoniah',
   'Dusun Desa RT 014 RW 007, Jalatrang, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat 46252, Indonesia'),   -- kode pos 46252
  ('SMK Siliwangi AMS Banjarsari',
   'Jl. Raya Timur No. 60, Cibadak, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat 46383, Indonesia'),   -- kode pos 46383
  ('SMP IT MD Fathahillah',
   'Jl. Pasanggrahan RT 05 RW 08, Saguling, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat 46274, Indonesia'),   -- kode pos 46274
  ('SMP IT Nurul Huda Margajaya',
   'Dusun Sukasari RT 026 RW 011, Margajaya, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat 46382, Indonesia'),   -- kode pos 46382
  ('SMP Terpadu Dampasan',
   'Dusun Tuban RT 02 RW 06, Ratawangi, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat 46383, Indonesia'),   -- kode pos 46383
  ('SMPN 1 Kawali',
   'Jl. Veteran No. 37, Kawali, Kec. Kawali, Kabupaten Ciamis, Jawa Barat 46253, Indonesia'),   -- kode pos 46253
  ('SMPN 2 Kawali',
   'Jl. Sindangraja, Citeureup, Kec. Kawali, Kabupaten Ciamis, Jawa Barat 46253, Indonesia'),   -- kode pos 46253
  ('SMPN 3 Baregbeg',
   'Jl. Raya Desa Jelat, Dusun Mekarmulya RT 01 RW 06, Jelat, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat 46274, Indonesia'),   -- kode pos 46274
  ('SMPN 3 Kawali',
   'Jl. Kebon Kopi RT 05 RW 05 Dusun Karangmulya, Karangpawitan, Kec. Kawali, Kabupaten Ciamis, Jawa Barat 46253, Indonesia'),   -- kode pos 46253
  ('SMPN 4 Ciamis',
   'Jl. Tentara Pelajar No. 2, Ciamis, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat 46211, Indonesia');   -- kode pos 46211

do $$
declare r record; v_n int := 0;
begin
  for r in select * from pos_0155 order by nama loop
    update sekolah
       set address = r.alamat
     where kunci_sekolah(name) = kunci_sekolah(r.nama)
       and address is distinct from r.alamat;
    if found then
      v_n := v_n + 1;
    end if;
  end loop;
  raise notice '0155: % alamat diberi kode pos.', v_n;
end $$;

do $$
declare
  s potret_nilai_0155%rowtype;
  n_regu int; n_nilai int; n_closing int; n_sekolah int; n_daftar int; v_tanpa int;
begin
  select * into s from potret_nilai_0155;
  select count(*) into n_regu    from regu;
  select count(*) into n_nilai   from nilai_mentah;
  select count(*) into n_closing from closing_regu;
  select count(*) into n_sekolah from sekolah;
  select count(*) into n_daftar  from pendaftaran;

  assert (n_regu, n_nilai, n_closing, n_sekolah, n_daftar)
         = (s.regu, s.nilai_mentah, s.closing_regu, s.sekolah, s.pendaftaran),
    format('0155: JUMLAH BARIS BERGESER — regu %s->%s, nilai %s->%s, closing %s->%s, sekolah %s->%s, pendaftaran %s->%s',
           s.regu, n_regu, s.nilai_mentah, n_nilai, s.closing_regu, n_closing,
           s.sekolah, n_sekolah, s.pendaftaran, n_daftar);

  select count(*) into v_tanpa from sekolah
   where btrim(address) <> '' and address !~ '[0-9]{5}, Indonesia$';
  raise notice '0155: % sekolah, % alamat masih tanpa kode pos.', n_sekolah, v_tanpa;
  raise notice '0155: rekap nilai utuh — % regu, % nilai, % closing.', n_regu, n_nilai, n_closing;
end $$;

drop table if exists potret_nilai_0155;
drop table if exists pos_0155;
