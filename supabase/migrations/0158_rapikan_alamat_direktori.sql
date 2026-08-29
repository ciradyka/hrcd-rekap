-- ============================================================================
-- hrcd-rekap : 0158_rapikan_alamat_direktori.sql
-- 158 alamat direktori dirapikan bentuknya. Tidak ada baris ditambah, dilebur,
-- atau dihapus — hanya kolom `address`.
--
-- KENAPA ADA
--
-- 0157 menyalin alamat dari Data Referensi apa adanya, dan kolom alamat
-- Dapodik ditulis ratusan operator sekolah tanpa aturan bersama. Hasilnya
-- terlihat begitu 521 baris berjajar di kotak pilihan pendaftaran:
--
--   MAN 4 Ciamis        Jl.sukajadi Ii Kec.pamarican
--   MA Al Falaah        CIKADONGDONG
--   MA Ma`arif NU Al-Islah   Jl.padomasan No.02
--   MA Plus Nurul Hidayah    Jln. Malabar
--
-- Yang dibetulkan cuma BENTUKNYA, bukan isinya. Tidak satu nama jalan pun
-- diganti, tidak satu nomor pun ditambahkan.
--
--   * `Jalan` / `JLN` / `JL` jadi `Jl.` (runbook bagian 8)
--   * `Jl.sukajadi` dan `No.02` dipisahkan jadi `Jl. Sukajadi` dan `No. 02`
--   * HURUF BESAR SEMUA jadi huruf judul; akronim (RT, RW, KH, PGRI, NU) dan
--     angka romawi tetap besar
--   * `Kec.pamarican` yang menempel dipotong — kecamatan sudah punya tempat
--     sendiri di alamat yang dirakit, dan menuliskannya dua kali dilarang
--     runbook bagian 8
--
-- SATU KEPUTUSAN YANG SEMPAT SALAH, DAN ITU SEBABNYA DIPERIKSA
--
-- Percobaan pertama memasukkan `KM` ke daftar akronim yang huruf besarnya
-- dipertahankan. Akibatnya lima baris KURASI ikut berubah — `Jl. Raya Banjar
-- Km. 3` jadi `KM. 3` — padahal `Km.` itulah bentuk yang dipakai 179 baris
-- terverifikasi. Migrasi yang merapikan tidak boleh merusak yang sudah rapi.
-- Sesudah itu daftar ini disaring sekali lagi terhadap `sekolah_alamat.json`:
-- baris kurasi DIKECUALIKAN seluruhnya, apa pun bentuknya. Empat belas di
-- antaranya sebenarnya akan ikut rapi (`KM 03` jadi `Km 03`), tetapi alamat
-- yang sudah diverifikasi terhadap sumber tidak diubah oleh migrasi yang
-- pekerjaannya merapikan impor. Ketidakseragaman KM/Km itu sudah ada sejak
-- kurasi dan dibiarkan. Keseluruhan 158 baris yang berubah berasal dari 0157.
--
-- REKAP NILAI TIDAK DISENTUH, dan jumlah baris sekolah pun tidak berubah.
-- Blok penutup membandingkan keduanya.
--
-- BISA DIJALANKAN DUA KALI: `where address is distinct from` menyaring yang
-- sudah sama.
-- ============================================================================

drop table if exists potret_0158;
create temporary table potret_0158 as
select (select count(*) from regu)         as regu,
       (select count(*) from nilai_mentah) as nilai_mentah,
       (select count(*) from closing_regu) as closing_regu,
       (select count(*) from pendaftaran)  as pendaftaran,
       (select count(*) from sekolah)      as sekolah;

drop table if exists rapi_0158;
create temporary table rapi_0158 (nama text, alamat text);
insert into rapi_0158 (nama, alamat) values
  ('Intesif An-Najmu',
   'Jl. Pesantren An Najmu No. 02 Cikawung Cintaratu Lakbok, Cintaratu, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat 46385, Indonesia'),
  ('MA Al Falaah',
   'Cikadongdong, Sukamulya, Kec. Purwadadi, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MA Al Khoeriyah',
   'Jl. Raya Sukamantri Hujungtiwu, Hujungtiwu, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MA Al-Munawwar Gegempalan',
   'Jl. Gegempalan No 72 Cikanyere RT 05, Gegempalan, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MA Aliyul Chowas',
   'Dsn Kereteg RT 06/02, Kec. Sadananya, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MA Ashomadiyah',
   'Jl. KH. Ahmad Fadil Handapherang, Handapherang, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MA Daarul Huda',
   'Jl. Sadananya Link.Karangsari RT 02 RW 10, Maleber, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MA Ma`arif NU Al-Islah',
   'Jl. Padomasan No. 02, Pasawahan, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MA Mekarwangi',
   'Jl. Panji Siliwangi No. 03, Mekarwangi, Kec. Sukamantri, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MA Miftahul Falah',
   'Jl. Babakan No. 20, Panumbangan, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MA PERSIS 109 Kujang',
   'Jl. Lokasana No. 09 RT 03 RW 02, Kujang, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MA Plus Darul Ulum',
   'Jl. Raya Sukamaju Petirhilir RT 03 RW 03, Sukamaju, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MA Plus Nurul Hidayah',
   'Jl. Malabar, Sidamulih, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MA Sidik Jahra',
   'Jl. Pasarean Sidik Jahra No. 01, Andapraja, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MA Terpadu Pakunagara',
   'Jl. Raya Kawali Cipaku Km.3,5, Gereba, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MAN 1 Ciamis',
   'Jl. KH. Ahmad Fadlil II No. 53, Dewasari, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MAN 4 Ciamis',
   'Jl. Sukajadi II, Sukajadi, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Adawiyyah Al-Mubarroq',
   'Jl. Raya Pangandaran Km 5, Cicapar, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Al Amin Cikaso',
   'Karangsari RT 07/02, Cikaso, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Al Huda Sukajadi',
   'Jl. Sukajadi I No. 375, Sukajadi, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Al Ihsan',
   'Jl. Awilega No 43 RT 02 RW 01, Benteng, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Al Irsyad Cikande',
   'Dsn. Cikande RT 36/10, Jatinagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Al Istiqomah Sukajaya',
   'Jl. Jamuresi No. 28 Citapen Pasir Sukajaya, Sukajaya, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Al Muawanah',
   'Jl. Banjar - Manonjaya No. 83, Beber, Kec. Cimaragas, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Al-Fatah Mambaus Sholihin',
   'Karangmalang RT 029 RW009, Puloerang, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Al-Fattah',
   'Jl. ciamis-Cimaragas, Bojongmengger, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Al-Hidayah Banjarsari',
   'Jl. Raya Pangandaran No. 19, Cikupa, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Al-Ikhlas Kaso',
   'Jl. Batugimbal No. 14 Balegede, Kaso, Kec. Tambaksari, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Al-Ikhlas Susuru',
   'Kertajaya, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Al-Ishlah',
   'Jl. Raya Cihaurbeuti No. 02 Rt/Rw 01/01 Ds/, Cihaurbeuti, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Al-Ittihaad',
   'Jl. Kawali- Cirebon, Winduraja, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Annur',
   'Jl. Sadananya Blok Islamic Center, Mangkubumi, Kec. Sadananya, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Ash-Shiddiqin',
   'Jl. Tentara Pelajar No. 12, Panaragan, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Asysyifaa',
   'Jl. Raya Cidolog Nomor 469 Cidolog Kode Pos, Cidolog, Kec. Cidolog, Kabupaten Ciamis, Jawa Barat 46352, Indonesia'),
  ('MTs Azzikra Ciamis',
   'Jl. Otista RT 19 RW 09, Ciharalang, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Babakan',
   'Babakan RT 01/01, Karangampel, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Budiasih',
   'Jl. Wilanta No 08 Cihideung II Budiasih, Budiasih, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Cidoyang',
   'Dsn. Cidoyang RT 01 RW 20, Jalatrang, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Cijulang',
   'Jl. Raya Cihaurbeuti N0 114, Sukahaji, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Cinyasag',
   'Jl. Ciamis-Cirebon No. 503, Kertayasa, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Daarul Huda',
   'Jl. Sadananya Lingkungan Karangsari RT 02/RW 10, Maleber, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Darul Ulum',
   'Jl. Awimenak, Petirhilir, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Fisabilillah',
   'H. Ahmad Yasin No. 22 RT 015 RW 005, Pasirnagara, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Guppi Cileungsir',
   'Jl. Sukamaju No. 110, Cileungsir, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Kubangpari',
   'Kubangpari RT 013/RW 001, Bangunsari, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Lengkongsari',
   'Jl. Raya Banjar Km 3, Pamalayan, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Madinatunnajah',
   'Jl. Siliwangi Blok Cacaban RT 011 RW 004, Kertayasa, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Margaharja',
   'Jl. Pasar Dongkal No. 39 RT 018 RW 005, Margaharja, Kec. Sukadana, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Miftahul Falah',
   'Jl. Babakan No. 20 RT 003/RW 005, Panumbangan, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Miftahul Huda',
   'Jl. Jalatrang No. 56, Cimari, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Nagarapageuh',
   'Jl. Nagarapageuh-Panawangan No. 46 RT 07/02, Nagarapageuh, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs NU Ciamis',
   'Jl. Benteng Blk. No 8/10 RT 003/RW 024 Ciamis, Ciamis, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Nurul Anwar',
   'Jl. Wanasigra No. 59 RT 005 RW 002, Wanasigra, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Persis.100 Banjarsari',
   'Dsn. Kubangpari Rt,02/Rw 05, Ciherang, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs PUI Banjarsari',
   'Jl. Raya Timur Banjarsari, Banjaranyar, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Sa Nurul-Hidayah',
   'Malabar RT 31 RW 09, Sidamulih, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Sabilurrosyad',
   'Jl. Hayawang-Rajadesa RT 16 RW 05, Jatinagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Sidarahayu',
   'Jl. Sidarahayu, Sidarahayu, Kec. Purwadadi, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Sindangbarang',
   'KP. Tonggoh, Sindangbarang, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Tahfizhil Quran',
   'Jl. Lokasana No. 09 RT 02 RW 03, Kujang, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Talagasari',
   'Jl. Majasir 48 RT 09 RW 05, Sindangsari, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Terpadu Riyadlul Hidayah Al-Munawwarah',
   'Jl. Masjid No. 02 RT 01 RW 01, Jatinagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTs Ypps Sukahurip',
   'Jl. Sukamaju No, 80, Sukahurip, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTsN 10 Ciamis',
   'Jl. Sasak Seng No. 21, Ciherang, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTsN 16 Ciamis',
   'Jl. Nanjung No. 109 Km.03 RT 04 RW 19, Bangunharja, Kec. Cisaga, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTsN 3 Ciamis',
   'Jl. Banjarangsana No. 15, Banjarangsana, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTsN 6 Ciamis',
   'Jl. Sukajadi No. 02, Maparah, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('MTsN 7 Ciamis',
   'Jl. Raya Pamarican No. 106 RT 018 RW 007, Sukahurip, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('Pdf Ulya Pp Darussalam',
   'Jl. KH Ahmad Fadlil I Kampus Pesantren Darussalam, Handapherang, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMA Al Manshur',
   'Jl. Panjalu Kawali Km.7 RT 36 RW 14, Sandingtaman, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMA Al Muminun Cipaku',
   'RT 07/01 Panyingkiran Muktisari Cipaku, Muktisari, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMA Ibnu Siena Cikoneng',
   'Jl. Margaluyu No. 117 Cikoneng, Margaluyu, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMA Islam Terpadu Irfani Quranicpreneur Bilingual School',
   'Jl. Jenderal Ahmad Yani No. 257 RT 001 RW 002, Kertasari, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMA Plus Informatika',
   'Jl. Bojonghuni No. 9 Ciamis, Maleber, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMA Plus Multazam',
   'Jl. Pesantren Sindangsari, Nagarajaya, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMAN 1 Banjaranyar',
   'Jl. Sukadana No. 239, Cigayam, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMAN 1 Lakbok',
   'Jl. Raya Cintajaya Lakbok, Cintajaya, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMAN 1 Lumbung',
   'Jl. Raya Lumbung No. 251, Lumbung, Kec. Lumbung, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Al Fattah Bojongmengger',
   'Jl. Ciamis-Cimaragas, Bojongmengger, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Al Huda Turalak',
   'Jl. Sukamaju, Sukamaju, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Al Ikhlas Susuru Panawangan',
   'Jl. Susuru - Kertajaya, KERTAJAYA, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Al Manar',
   'Jl. Raya Banjar-Banjarsari Km. 15, Kertahayu, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Al-Asyariah',
   'Jl. Rancawiru Utama, Utama, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat 46271, Indonesia'),
  ('SMK Al-Huda Sadananya',
   'Jl. Sadananya Km 9 Sadananya Ciamis, Sadananya, Kec. Sadananya, Kabupaten Ciamis, Jawa Barat 46256, Indonesia'),
  ('SMK Al-Husna',
   'Jl. Banjar-Ciamis, Mekarmukti, Kec. Cisaga, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Bahrul Uluum Kawali',
   'Jl. Kuwu Madjasir No. 01 RT 09/RW 05, Sindangsari, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Farmasi Pasundan Kawali',
   'Jl. Siliwangi No. 266 Kawali Ciamis, Kawalimukti, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Galuh Rahayu Sindangkasih',
   'Jl. Raya Sukaraja Sindangkasih Ciamis, Sukaraja, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Hepweti Ciamis',
   'Jl. Siliwangi 52 Ciamis, Maleber, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Hidayah Pakuan',
   'Jl. Pakuan No 3 Kawalimukti, Kawalimukti, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Industri Perunggasan Panjalu (ipp)',
   'Dsn. Mandala Rt/Rw 18/06, Kertamandala, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Informatika Al Ihya Banjarsari',
   'Jl. Raya Banjarsari - Lakbok No. 138 Km 3, Sindanghayu, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Lpt Ciamis',
   'Jl. Kedung Panjang No. 69 Maleber Ciamis, Maleber, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK MA Arif NU Al Mushlihuun',
   'Jl. Cintanagara No. 01, Cintanagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK MA Arif NU Al Muzayyin',
   'Dsn Jagamulya RT 004 RW 005, Rajadesa, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK MA Arif NU Tarbiyatul Huda Cimaragas',
   'Jl. Banjar Manonjaya Beber Cimaragas Ciamis, Beber, Kec. Cimaragas, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Ma’arif NU Kawali',
   'Jl. Kawali-Panjalu RT 22 RW 07, Margamulya, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Maarif NU Cihaurbeuti',
   'Jl. Cihaurbeuti No. 114 Cihaurbeuti, Sukahaji, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Maarif NU Cipaku',
   'Dsn Kidul RT 12 RW 07, Buniseuri, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Muhammadiyah 1 Banjarsari',
   'Jl. Pasar Baru No. 124, Cibadak, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Muhammadiyah 2 Banjarsari',
   'Jl. Pasar Baru No. 126, Cibadak, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Muhammadiyah 3 Banjarsari',
   'Jl. Lapang Kawasen Pasar Baru Cibadak No 126, Cibadak, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Muhammadiyah Kawali',
   'Jl. Poronggol Raya No. 18, Kawalimukti, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Plus Multazam Panawangan',
   'Jl. Pesantren Sindangsari, Nagarajaya, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Taruna Bangsa',
   'Jl. Raya Banjar Km.3 Cijantung Ciamis, Dewasari, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Terpadu Yakpidatek',
   'Jl. Raya Banjar Km. 03 No. 141 Cijeungjing - Ciamis, Dewasari, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Tri Bintang Purwadadi',
   'Jl. Bendung Manganti Sidarahayu No. 08, Sidarahayu, Kec. Purwadadi, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Vip Mambaus',
   'Cintaratu, Cintaratu, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMK Yasira',
   'Jl. Raya Banjar Km. 06, Pamalayan, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMKN 1 Panjalu',
   'Jl. Raya Sukamantri Hujungtiwu, Hujungtiwu, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMKN 1 Purwadadi',
   'Jl. Winong I No 102 RT001/001 Ciamis, Purwadadi, Kec. Purwadadi, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMKN 1 Tambaksari',
   'Jl. Raya Tambaksari No. 47, RT. 04/02 Kampung Linggaharja Mekarsari, Tambaksari, Kec. Tambaksari, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Al Huda Turalak',
   'Jl. Sukamaju No. 11, Sukamaju, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Daarul Falah Cijeungjing',
   'Jl. KH. Ahmad Fadil No Dsn Handapherang, Handapherang, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Islam Terpadu Daarul Falaah',
   'Komplek Pesantren Daarul Falaah, Sukamaju, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Islam Terpadu Ma`arif Al Barkah',
   'Jl. Raya Ciamis Banjar Km. 17 Dusuan Karangkamulyan, Karangkamulyan, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Islam Terpadu Muhammad Danu Fathahillah',
   'Jl. Pasanggrahan RT 05 RW 08, Saguling, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP IT Irfani Quranicpreneur Bilingual School',
   'Jl. Jenderal Ahmad Yani No. 257 RT 003/RW 002 Kertasari - Ciamis, Kertasari, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat 46213, Indonesia'),
  ('SMP IT Miftahul Huda Ii',
   'Jl. Mulyasari No. 40, Bayasari, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP IT Riyadlul Khoer Cituur',
   'Jl. Raya Pangandaran, Sindangrasa, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Maarif NU Nurul Hikmah',
   'Dsn. Tonggoh RT 002 RW 012, Pusakasari, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Miftahul Khoer Boarding School',
   'Dsn. Mandala Rt/Rw 17/06, Kertamandala, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Muhammadiyah Cikoneng',
   'Jl. Tentara Pelajar Cikoneng No. 2, Cikoneng, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Muhammadiyah Kawali',
   'Jl. Poronggol Raya 17 Kawali, Kawalimukti, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Pasundan Sidamulih',
   'Jl. Malabar, Sidamulih, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Plus Al Mugni',
   'Jl. Raya Timur Km. 2, Ciherang, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Plus MA Arif NU Ciamis',
   'Jl. Citapen No. 04 Bangunsirna, Sukamaju, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Plus MA Arif NU Purwadadi',
   'Jl. Panineungan Rt/rw 04/04, Purwajaya, Kec. Purwadadi, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Plus Ma`arif Al-Mushlihuun',
   'Jl. Cintangara No. 01 Rt/Rw 01/01, Cintanagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Plus PERSIS Panumbangan',
   'Jl. Garahang Blok Cikadal, Tanjungmulya, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMP Terpadu Al Muaawanah Rajadesa',
   'Jl. KH Ahmad Romli No. 26, Rajadesa, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 1 Cidolog',
   'Jelegong, Kec. Cidolog, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 1 Cihaurbeuti',
   'Jl. Panjalu No. 29, Sukamulya, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 1 Lakbok',
   'Jl. Raya Lakbok No. 530, Sukanagara, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 1 Panawangan',
   'Jl. Raya Panawangan No. 118, Panawangan, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 1 Sadananya',
   'Jl. Sadananya, Sadananya, Kec. Sadananya, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 1 Sukadana',
   'Jl. Cisena No. 47 Sukadana, Sukadana, Kec. Sukadana, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 1 Tambaksari',
   'Jl. Raya Tambaksari No. 47, Mekarsari, Kec. Tambaksari, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 2 Banjarsari',
   'Jl. Raya Cicapar No. 95, Cicapar, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 2 Cihaurbeuti',
   'Jl. Panjalu (Legokkondang) Cihaurbeuti - Ciamis, Cihaurbeuti, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 2 Cikoneng',
   'Jl. Kujang, Nasol, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 2 Jatinagara',
   'Jl. Veteran No. 12, Mulyasari, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 2 Pamarican',
   'Jl. Raya Kertahayu No. 247, Kertahayu, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 2 Rancah',
   'Jl. Rajadesa No. 286 Cileungsir, Cileungsir, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 2 Sukamantri',
   'Jl. Siliwangi, Sindanglaya, Kec. Sukamantri, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 3 Banjarsari',
   'Jl. Sukadana No 238, Cigayam, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 3 Cisaga',
   'Jl. Prajadinata No. 23 Bangunharja Cisaga, Bangunharja, Kec. Cisaga, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 3 Lakbok',
   'Jl. Mekarjaya Nomor 199, Sidaharja, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 3 Panawangan',
   'Jl. Raya Ciamis - Cirebon Km. 40, Gardujaya, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 3 Rancah',
   'Jl. Dadiharja, Dadiharja, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 4 Banjarsari',
   'Jl. Raya Lakbok Km 05, Sindangasih, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 4 Pamarican',
   'Jl. Wiryo Taruno No. 1 Sukamukti, Sukamukti, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 4 Panawangan',
   'Jl. Rompe No. 01, Nagarajati, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 4 Rajadesa',
   'Jl. Jamuresi, Sukajaya, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 5 Banjarsari',
   'Panyindangan RT 02 RW 07, Kalijaya, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 6 Rajadesa',
   'Jl. Rancah - Panawangan, Andapraja, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 7 Ciamis',
   'Jl. Baktikarya II Kertasari, Kertasari, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),
  ('SMPN 8 Ciamis',
   'Jl. Raya Imbanagara No. 517, Imbanagara Raya, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia');

do $$
declare r record; v_n int := 0;
begin
  for r in select * from rapi_0158 order by nama loop
    update sekolah
       set address = r.alamat
     where kunci_sekolah(name) = kunci_sekolah(r.nama)
       and address is distinct from r.alamat;
    if found then v_n := v_n + 1; end if;
  end loop;
  raise notice '0158: % alamat dirapikan.', v_n;
end $$;

do $$
declare
  s potret_0158%rowtype;
  n_regu int; n_nilai int; n_closing int; n_daftar int; n_sekolah int; v_cacat int;
begin
  select * into s from potret_0158;
  select count(*) into n_regu    from regu;
  select count(*) into n_nilai   from nilai_mentah;
  select count(*) into n_closing from closing_regu;
  select count(*) into n_daftar  from pendaftaran;
  select count(*) into n_sekolah from sekolah;

  assert (n_regu, n_nilai, n_closing, n_daftar, n_sekolah)
         = (s.regu, s.nilai_mentah, s.closing_regu, s.pendaftaran, s.sekolah),
    format('0158: JUMLAH BARIS BERGESER — regu %s->%s, nilai %s->%s, closing %s->%s, pendaftaran %s->%s, sekolah %s->%s',
           s.regu, n_regu, s.nilai_mentah, n_nilai, s.closing_regu, n_closing,
           s.pendaftaran, n_daftar, s.sekolah, n_sekolah);

  select count(*) into v_cacat from sekolah
   where address like '%,%'
     and (address ~ '^(JALAN|Jalan|JLN|Jln|JL\.|JL )' or address ~ '\mNo\.[0-9]'
          or address ~* '(kec|kab|ds|kel|desa)\.[A-Za-z]');
  assert v_cacat = 0, format('0158: %s alamat masih berbentuk mentah', v_cacat);

  raise notice '0158: % baris sekolah, rekap nilai utuh — % regu, % nilai, % closing.',
               n_sekolah, n_regu, n_nilai, n_closing;
end $$;

drop table if exists potret_0158;
drop table if exists rapi_0158;
