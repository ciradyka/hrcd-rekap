-- ============================================================================
-- hrcd-rekap : 0157_direktori_sekolah_ciamis.sql
-- 309 SMP/MTs/SMA/SMK/MA se-Kabupaten Ciamis, supaya pembina memilih dari
-- daftar dan tidak lagi mengetik nama sekolahnya sendiri.
--
-- KENAPA ADA
--
-- Seluruh kerusakan nama sekolah yang dibereskan 0154 sampai 0156 lahir dari
-- satu tempat: form pendaftaran menerima nama yang DIKETIK. "SMK MAARIF NU
-- CIAMIS" lahir karena "SMK Ma'arif NU Ciamis" tidak ketemu di kotak carinya,
-- dan pembina mengetik apa adanya. Isi kotak itu `sekolah`, dan sampai
-- sekarang isinya cuma sekolah yang SUDAH pernah mendaftar — jadi sekolah
-- baru selalu mengetik, dan setiap ketikan adalah kesempatan lahirnya kembar.
--
-- Daftarnya diambil dari Data Referensi Kemendikdasmen, satu halaman per
-- kecamatan untuk keduapuluh tujuh kecamatan Kabupaten Ciamis, jenjang dikdas
-- dan dikmen. SD, MI, dan SLB dibuang — ketiganya tidak pernah ikut HRCD.
--
-- YANG PERLU DIKETAHUI SEBELUM MEMBACA ALAMATNYA
--
-- Alamat baris-baris ini **bukan alamat kurasi**. Ia disalin dari kolom alamat
-- Dapodik apa adanya, dirapikan seperlunya: desa, kecamatan, dan kabupaten
-- yang tertulis dua kali dibuang (runbook bagian 8), dan kode pos dipakai
-- hanya kalau Dapodik memang memuatnya — delapan dari 309.
--
-- Bedanya dengan 212 baris yang sudah ada penting dan tidak terlihat dari
-- tabelnya: yang lama dicari satu per satu, punya NPSN tercatat, keyakinan,
-- dan URL sumber di `tools/data/sekolah_alamat.json`. Yang baru tidak.
-- **Berkas itu tetap jadi penanda mana yang terkurasi**, dan sekolah mana pun
-- di sini yang benar-benar mendaftar tahun depan harus dikurasi seperti biasa
-- sebelum alamatnya dipakai berkirim surat.
--
-- KENAPA HANYA KABUPATEN CIAMIS
--
-- Peserta datang dari 24 kabupaten/kota, jadi ini menutup sebagian saja —
-- tetapi bagian terbesarnya, dan mengambil seluruh Jawa Barat berarti puluhan
-- ribu baris untuk memenuhi kotak cari yang dipakai sekali setahun. Yang di
-- luar Ciamis tetap mengetik, persis seperti sekarang.
--
-- REKAP NILAI TIDAK DISENTUH. Hanya `insert`; tidak ada baris yang diubah,
-- dilebur, atau dihapus, jadi tidak ada `pendaftaran.sekolah_id` yang
-- berpindah. Blok penutup membandingkan jumlah barisnya.
--
-- DUA KUNCI DIPAKAI UNTUK MENYARING, BUKAN SATU
--
-- Baris yang sudah ada disaring lewat `kunci_sekolah()` DAN lewat `kunci()`
-- agresif milik tools/normalize_sekolah.py. Runbook bagian 12.2 sudah menulis
-- kenapa: kunci database sengaja jinak, jadi ia meloloskan `SMK Maarif NU
-- Ciamis` di sebelah `SMK Ma'arif NU Ciamis`. Percobaan pertama impor ini
-- hanya memakai kunci database, dan delapan baris kembar lolos — termasuk
-- `MTs Al-Fadilliyah Darussalam`, `SMP Terpadu Arrisalah`, dan `MTs
-- Assalimiyah`, yang ketiganya sudah ada dengan ejaan lain.
--
-- HURUF S SWASTA DIBUANG, DAN ITU BUKAN KERAPIAN
--
-- Dapodik menulis status swasta sebagai akhiran: `MTSS`, `SMAS`, `SMKS` —
-- kadang menempel, kadang TERPISAH (`MTS S AL-HASAN`). Runbook bagian 4
-- membuangnya karena tidak pernah diucapkan siapa pun. Percobaan pertama
-- impor ini hanya membuang yang menempel, dan hasilnya duabelas baris kembar
-- baru: `MTs S Al-Hasan Banjarsari` di sebelah `MTs Al-Hasan Banjarsari` yang
-- sudah ada, dan `kunci_sekolah()` tidak menyamakan keduanya. Yang menemukan
-- itu `supabase/checks/sekolah_kembar.sql` — pemeriksa yang baru dipasang
-- kemarin, pada impor pertama yang dijalankan sesudahnya.
--
-- -- BISA DIJALANKAN DUA KALI: yang dimasukkan hanya yang `kunci_sekolah()`-nya
-- belum ada, jadi jalanan kedua memasukkan nol baris.
-- ============================================================================

drop table if exists potret_0157;
create temporary table potret_0157 as
select (select count(*) from regu)         as regu,
       (select count(*) from nilai_mentah) as nilai_mentah,
       (select count(*) from closing_regu) as closing_regu,
       (select count(*) from pendaftaran)  as pendaftaran,
       (select count(*) from sekolah)      as sekolah;

drop table if exists direktori_0157;
create temporary table direktori_0157 (nama text, alamat text);
insert into direktori_0157 (nama, alamat) values
  ('Al-Hikmah',
   'Buniseuri, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat 46252, Indonesia'),   -- NPSN 69976341
  ('Intesif An-Najmu',
   'Jln Pesantren An Najmu No. 02 cikawung Cintaratu Lakbok, Cintaratu, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat 46385, Indonesia'),   -- NPSN 69976342
  ('MA Al Amin Puloerang',
   'Dsn. Sukamukti RT 015 RW 005, Puloerang, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276439
  ('MA Al Falaah',
   'CIKADONGDONG, Sukamulya, Kec. Purwadadi, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69983476
  ('MA Al Islah',
   'Jl. Raya Panjalu No. 02, Cihaurbeuti, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276441
  ('MA Al Istiqomah Rajadesa',
   'Jl. Jamuresi No. 28 Citapen Pasir, Sukajaya, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276442
  ('MA Al Khoeriyah',
   'JL. RAYA SUKAMANTRI HUJUNGTIWU, Hujungtiwu, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69976343
  ('MA Al Makmur',
   'Cintaratu, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69941667
  ('MA Al-Munawwar Gegempalan',
   'Jl. Gegempalan No 72 Cikanyere Rt 05, Gegempalan, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276443
  ('MA Aliyul Chowas',
   'Dsn kereteg RT 06/02, Kec. Sadananya, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70046355
  ('MA Argayasa',
   'Jalatrang, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276444
  ('MA Ashomadiyah',
   'JL. KH. AHMAD FADIL HANDAPHERANG, Handapherang, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69993909
  ('MA Babussalam',
   'Jl. Mekarsari Km. 3, Mekarsari, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276447
  ('MA Daarul Huda',
   'Jl. Sadananya Link.Karangsari RT.02 RW.10, Maleber, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70059223
  ('MA Guppi Al Barkah',
   'Sukajadi, Kec. Sadananya, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276453
  ('MA Kertabumi',
   'Jl. Prabudimuntur, Kertabumi, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276456
  ('MA Ma`arif Darul Hikam',
   'Cieurih, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70043451
  ('MA Ma`arif Miftahul Ulum Ciamis',
   'Jl. Citapen 04 Bangunsirna, Sukamaju, Baregbeg, Sukamaju, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70027705
  ('MA Ma`arif NU Al-Islah',
   'Jl.padomasan No.02, Pasawahan, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 60728058
  ('MA Maarif Lakbok',
   'Jl. Pengairan Kedungsari, Baregbeg, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276458
  ('MA Madinatunnajah',
   'Jl. Siliwangi Blok Cacaban, NATANEGARA, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69941668
  ('MA Margajaya',
   'Jl. Gardu Ciilat, Margajaya, Kec. Sukadana, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69955696
  ('MA Mekarwangi',
   'Jalan Panji Siliwangi No. 03, Mekarwangi, Kec. Sukamantri, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276459
  ('MA Miftahul Falah',
   'Jl. Babakan No.20, Panumbangan, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276460
  ('MA Miftahul Ulum',
   'Jl. Raya Gunungcupu No. 37, Gunungcupu, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276081
  ('MA Muslimin',
   'Jl. Pasanggrahan No. 245 Panjalu, Panjalu, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20280181
  ('MA Nurussalam',
   'Kujang, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20280183
  ('MA PERSIS 100 Banjarsari',
   'Ciherang, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20280186
  ('MA PERSIS 109 Kujang',
   'Jl. Lokasana No.09 Rt.03 Rw.02, Kujang, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20280188
  ('MA PUI Banjarsari',
   'Jl. Raya Timur Banjarsari No. 22, Cibadak, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20280191
  ('MA Plus Azzahra',
   'Hegarmanah, Kec. Cidolog, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70059370
  ('MA Plus Darul Ulum',
   'JL. RAYA SUKAMAJU PETIRHILIR RT.03 RW.03, Sukamaju, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69993915
  ('MA Plus Nurul Hidayah',
   'Jln. Malabar, Sidamulih, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20280190
  ('MA Sabilurrosyad',
   'Jl. Hayawang Rajadesa, Dayeuhluhur, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20280195
  ('MA Sidik Jahra',
   'JL. PASAREAN SIDIK JAHRA NO. 01, Andapraja, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69983475
  ('MA Terpadu Pakunagara',
   'Jl.raya Kawali Cipaku Km.3,5, Gereba, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276078
  ('MA Unggulan Darul Amira',
   'Padamulya, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 60728059
  ('MA Ypps Sukahurip',
   'Jl. Sukamaju No. 80 Sukajaya, Sukahurip, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20280202
  ('MAN 1 Ciamis',
   'Jln. KH. Ahmad Fadlil II No.53, Dewasari, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276451
  ('MAN 4 Ciamis',
   'Jl.sukajadi Ii Kec.pamarican, Sukajadi, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20280197
  ('MTs Adawiyyah Al-Mubarroq',
   'Jalan Raya Pangandaran Km 5, Cicapar, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211979
  ('MTs Al Amin Cikaso',
   'Karangsari Rt.07/02, Cikaso, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278593
  ('MTs Al Amin Puloerang',
   'Dsn. Sukamukti RT 015 RW 005, Puloerang, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211992
  ('MTs Al Barkah',
   'Sukajadi, Kec. Sadananya, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278710
  ('MTs Al Hidayah Ciomas',
   'Cangkuang, Mandalare, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278686
  ('MTs Al Huda Sukajadi',
   'Jl. Sukajadi I No.375, Sukajadi, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278673
  ('MTs Al Ihsan',
   'Jl Awilega No 43 Rt 02 Rw 01, Benteng, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278602
  ('MTs Al Irsyad Cikande',
   'Dsn. Cikande Rt 36/10, Jatinagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278648
  ('MTs Al Istiqomah Sukajaya',
   'Jl. Jamuresi No.28 Citapen Pasir Sukajaya, Sukajaya, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278702
  ('MTs Al Mansur Hujungtiwu',
   'Hujungtiwu, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278688
  ('MTs Al Muawanah',
   'Jln. Banjar - Manonjaya No. 83, Beber, Kec. Cimaragas, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278631
  ('MTs Al-Fatah Mambaus Sholihin',
   'Karangmalang Rt 029 Rw009, Puloerang, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278657
  ('MTs Al-Fattah',
   'Jl.ciamis-Cimaragas, Bojongmengger, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278618
  ('MTs Al-Hidayah Banjarsari',
   'Jl Raya Pangandaran No.19, Cikupa, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278595
  ('MTs Al-Hikmah Cikoneng',
   'Sindangsari, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69927479
  ('MTs Al-Ikhlas Kaso',
   'Jln. Batugimbal No. 14 Balegede, Kaso, Kec. Tambaksari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278725
  ('MTs Al-Ikhlas Susuru',
   'KERTAJAYA, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278677
  ('MTs Al-Imam',
   'Sidaharja, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278672
  ('MTs Al-Ishlah',
   'Jl. Raya Cihaurbeuti No. 02 RT/RW. 01/01 Ds/, Cihaurbeuti, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278609
  ('MTs Al-Ittihaad',
   'JL. KAWALI- CIREBON, Winduraja, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70029091
  ('MTs Al-Munawwar Gegempalan',
   'Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20212002
  ('MTs Al-Muzayyin',
   'Rajadesa, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69995547
  ('MTs Annur',
   'Jl.sadananya Blok Islamic Center, Mangkubumi, Kec. Sadananya, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278713
  ('MTs As-Sakinah',
   'Jl. Yudhasantana, Cibeureum, Kec. Sukamantri, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278723
  ('MTs Ash-Shiddiqin',
   'Jln. Tentara Pelajar No. 12, Panaragan, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278625
  ('MTs Asysyifaa',
   'Jalan Raya Cidolog Nomor 469 Cidolog Kode Pos, Cidolog, Kec. Cidolog, Kabupaten Ciamis, Jawa Barat 46352, Indonesia'),   -- NPSN 20278603
  ('MTs At-Tarbiyah',
   'Gunungsari, Kec. Sadananya, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278712
  ('MTs Azzikra Ciamis',
   'Jl. Otista RT.19 RW.09, Ciharalang, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70059210
  ('MTs Babakan',
   'Babakan Rt. 01/01, Karangampel, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278597
  ('MTs Bahrul Ulum',
   'Mandalare, Mandalare, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278689
  ('MTs Budiasih',
   'Jln Wilanta No 08 Cihideung Ii Budiasih, Budiasih, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278718
  ('MTs Cidoyang',
   'Dsn. Cidoyang Rt. 01 Rw. 20, Jalatrang, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278637
  ('MTs Cieurih',
   'Bangbayang, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278638
  ('MTs Cijulang',
   'Jln Raya Cihaurbeuti N0 114, Sukahaji, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278610
  ('MTs Cinyasag',
   'Jalan Ciamis-Cirebon No. 503, Kertayasa, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278678
  ('MTs Daarul Huda',
   'Jl. Sadananya Lingkungan Karangsari RT.02/RW.10, Maleber, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69995623
  ('MTs Darul Amira',
   'Padamulya, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278612
  ('MTs Darul Fikri',
   'Jl. Gardu - Ciilat Km 3 Cipondok, Selacai, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278640
  ('MTs Darul Ulum',
   'Jl Awimenak, Petirhilir, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278599
  ('MTs Fisabilillah',
   'H. Ahmad Yasin No. 22 Rt. 015 Rw. 005, Pasirnagara, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278675
  ('MTs Guppi Cileungsir',
   'Jalan Sukamaju No. 110, Cileungsir, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278709
  ('MTs Janggala',
   'Hegarmanah, Kec. Cidolog, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278604
  ('MTs Karangpari',
   'Karangpari, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278707
  ('MTs Kertabumi',
   'Jl. Prabudimuntur Sukamulya, Kertabumi, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278619
  ('MTs Kubangpari',
   'Kubangpari Rt.013/rw.001, Bangunsari, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278674
  ('MTs Lengkongsari',
   'Jl Raya Banjar Km 3, Pamalayan, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278615
  ('MTs Ma''arif Darulhikam',
   'Cieurih, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70060388
  ('MTs Madinatunnajah',
   'Jl. Siliwangi Blok Cacaban Rt.011 Rw.004, Kertayasa, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278681
  ('MTs Margaharja',
   'Jl. Pasar Dongkal No. 39 Rt.018 Rw.005, Margaharja, Kec. Sukadana, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278646
  ('MTs Margajaya',
   'Margajaya, Kec. Sukadana, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278721
  ('MTs Miftahul Falah',
   'Jl. Babakan No.20 Rt.003/rw.005, Panumbangan, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278692
  ('MTs Miftahul Huda',
   'Jl. Jalatrang No.56, Cimari, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278628
  ('MTs Miftahul Ulum',
   'Jl. Raya Gunungcupu No. 37, Sukamanah, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278715
  ('MTs Multazam',
   'Nagarajaya, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278680
  ('MTs Muslimin Panjalu',
   'Jl. Pasanggrahan No. 245 Panjalu, Panjalu, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278687
  ('MTs NU Ciamis',
   'Jln Benteng Blk. No 8/10 RT. 003/RW. 024 Ciamis, Ciamis, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278601
  ('MTs Nagarapageuh',
   'Jl. Nagarapageuh-Panawangan No.46 Rt. 07/02, Nagarapageuh, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 60727390
  ('MTs Nurul Amal',
   'Bojongmengger, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70058994
  ('MTs Nurul Anwar',
   'Jl. Wanasigra No.59 Rt.005 Rw.002, Wanasigra, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278717
  ('MTs Nurul Faqih',
   'Cipaku, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69983282
  ('MTs Nurul Huda',
   'Sukahurip, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70059036
  ('MTs Nurul Huda Al-Husna',
   'Cikupa, Kec. Lumbung, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69927484
  ('MTs Nurul Huda Tanjungsari',
   'Tanjungsari, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211973
  ('MTs Nurussalam',
   'Kujang, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278630
  ('MTs PERSIS Sindangkasih',
   'Jl. Raya Ancol No. 27 Ancol I Sindangkasih, Sindangkasih, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278716
  ('MTs PUI Banjarsari',
   'Jalan Raya Timur Banjarsari, Banjaranyar, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278591
  ('MTs PUI Ciparigi',
   'Jl. Dipakusumah No. 77 Ciparigi, Ciparigi, Kec. Sukadana, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278720
  ('MTs PUI Gereba',
   'Jl. Kawali-Cipaku No. 375, Ciakar, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278639
  ('MTs Panawangan',
   'Jl. Raya Pusparaya No. 01, Sagalaherang, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278679
  ('MTs Persis.100 Banjarsari',
   'Dsn. Kubangpari Rt,02/Rw.05, Ciherang, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20263171
  ('MTs Purwadadi',
   'Jl. Pramuka No. 168, Purwadadi, Kec. Purwadadi, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278696
  ('MTs Riyadlul Ulum',
   'Sindangsari, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211962
  ('MTs Sa Nurul-Hidayah',
   'Malabar Rt. 31 Rw. 09, Sidamulih, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278676
  ('MTs Sabilissalam',
   'Jl. Sukadana Km 03, Pusakanagara, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278598
  ('MTs Sabilurrosyad',
   'Jl. Hayawang-Rajadesa Rt.16 Rw.05, Jatinagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211964
  ('MTs Sholihul Amin',
   'Purwajaya, Kec. Purwadadi, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70037991
  ('MTs Sidamulya',
   'Jl. Pasar Sidamulya No. 29, Sidamulya, Kec. Cisaga, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278643
  ('MTs Sidarahayu',
   'Jl.Sidarahayu, Sidarahayu, Kec. Purwadadi, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278697
  ('MTs Sindangbarang',
   'KP. TONGGOH, Sindangbarang, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69983332
  ('MTs Sirnarasa',
   'Dsn.Ciceuri, Ciomas, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278690
  ('MTs Tahfizhil Quran',
   'Jl. Lokasana No. 09 Rt.02 Rw. 03, Kujang, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278624
  ('MTs Talagasari',
   'Jln. Majasir 48 Rt 09 Rw 05, Sindangsari, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278654
  ('MTs Terpadu Riyadlul Hidayah Al-Munawwarah',
   'Jln. Masjid No. 02 Rt. 01 Rw. 01, Jatinagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69726722
  ('MTs Utama',
   'Jl. Utama 1 No 28, Utama, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278616
  ('MTs Vip Mambaushsholihin Lakbok',
   'Jl. Raya Cintaratu No. 32, Cintaratu, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278658
  ('MTs Ypps Sukahurip',
   'Jalan Sukamaju No, 80, Sukahurip, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278611
  ('MTsN 10 Ciamis',
   'Jl. Sasak Seng No.21, Ciherang, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278590
  ('MTsN 11 Ciamis',
   'Jl. Panji Siliwangi No. 3 Mekarwangi Sukamantri Ciamis, Mekarwangi, Kec. Sukamantri, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278722
  ('MTsN 12 Ciamis',
   'Jl. Raya Cihawar No. 151, Sukaharja, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278699
  ('MTsN 13 Ciamis',
   'Jl. Cipancur No. 06, Sirnabaya, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278700
  ('MTsN 14 Ciamis',
   'Jl. Raya Kawunglarang-Rancah No. 163, Kawunglarang, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278704
  ('MTsN 15 Ciamis',
   'Jl. Handapherang No. 94, Handapherang, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278613
  ('MTsN 16 Ciamis',
   'Jln. Nanjung No.109 Km.03 Rt 04 Rw 19, Bangunharja, Kec. Cisaga, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278641
  ('MTsN 17 Ciamis',
   'Jl. Gagak Ngampar No. 54, Dadiharja, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278705
  ('MTsN 3 Ciamis',
   'Jalan Banjarangsana No. 15, Banjarangsana, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278691
  ('MTsN 6 Ciamis',
   'Jln. Sukajadi No. 02, Maparah, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211871
  ('MTsN 7 Ciamis',
   'Jl. Raya Pamarican No. 106 Rt. 018 Rw. 007, Sukahurip, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278671
  ('MTsN 8 Ciamis',
   'Jl. Puskesmas Lakbok, Sukanagara, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278655
  ('MTsN 9 Ciamis',
   'Jl. Raya Sindangkasih No. 56, Sindangkasih, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278714
  ('Pdf Ulya Pp Darussalam',
   'JL. KH AHMAD FADLIL I KAMPUS PESANTREN DARUSSALAM, Handapherang, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69937222
  ('SMA Al Manshur',
   'Jl. Panjalu Kawali KM.7 RT.36 RW.14, Sandingtaman, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70042032
  ('SMA Al Muminun Cipaku',
   'RT 07/01 PANYINGKIRAN MUKTISARI CIPAKU, Muktisari, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20263276
  ('SMA Al-Fadlil',
   'Jl. Banjarsari-Lakbok No. 17, Kalapasawit, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70011225
  ('SMA Erha Jatinagara',
   'Jatinagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69988140
  ('SMA Ibnu Siena Cikoneng',
   'JL. MARGALUYU NO. 117 CIKONENG, Margaluyu, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20256408
  ('SMA Islam Terpadu Ar-Rofi`i Jatiluhur',
   'Rancah, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70040620
  ('SMA Islam Terpadu Irfani Quranicpreneur Bilingual School',
   'Jl. Jenderal Ahmad Yani No. 257 RT.001 RW.002, Kertasari, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70043021
  ('SMA Nusantara Ciamis',
   'Sukamaju, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70010787
  ('SMA Plus Informatika',
   'JL. BOJONGHUNI NO. 9 CIAMIS, Maleber, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20251798
  ('SMA Plus Multazam',
   'Jalan Pesantren Sindangsari, Nagarajaya, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211562
  ('SMA Tahfidz Anharul Ulum',
   'Winduraja, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70024225
  ('SMAN 1 Banjaranyar',
   'JL. SUKADANA NO. 239, Cigayam, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20255008
  ('SMAN 1 Lakbok',
   'JL.RAYA CINTAJAYA LAKBOK, Cintajaya, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211502
  ('SMAN 1 Lumbung',
   'JL. RAYA LUMBUNG NO. 251, Lumbung, Kec. Lumbung, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20263279
  ('SMAN 1 Panumbangan',
   'Buanamekar, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70013944
  ('SMK Al Fattah Bojongmengger',
   'JL. CIAMIS-CIMARAGAS, Bojongmengger, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20254638
  ('SMK Al Huda Turalak',
   'Jalan Sukamaju, Sukamaju, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20254634
  ('SMK Al Ikhlas Susuru Panawangan',
   'JLN SUSURU - KERTAJAYA, KERTAJAYA, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20254646
  ('SMK Al Manar',
   'JL RAYA BANJAR-BANJARSARI KM. 15, Kertahayu, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276075
  ('SMK Al-Asyariah',
   'Jln. Rancawiru Utama, Utama, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat 46271, Indonesia'),   -- NPSN 69949542
  ('SMK Al-Huda Sadananya',
   'JL. SADANANYA KM 9 SADANANYA CIAMIS, Sadananya, Kec. Sadananya, Kabupaten Ciamis, Jawa Barat 46256, Indonesia'),   -- NPSN 69759288
  ('SMK Al-Husna',
   'JL. BANJAR-CIAMIS, Mekarmukti, Kec. Cisaga, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69774870
  ('SMK Bahrul Uluum Kawali',
   'Jl. Kuwu Madjasir No.01 RT.09/RW.05, Sindangsari, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20254636
  ('SMK Daarul Muttaqien',
   'Jl. Raya Panjalu-Kawali No 778, Payungsari, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69984154
  ('SMK Farmasi Pasundan Kawali',
   'JL. SILIWANGI NO. 266 KAWALI CIAMIS, Kawalimukti, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20253142
  ('SMK Galuh Rahayu Sindangkasih',
   'JL. RAYA SUKARAJA SINDANGKASIH CIAMIS, Sukaraja, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20254622
  ('SMK Hepweti Ciamis',
   'JL. SILIWANGI 52 CIAMIS, Maleber, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211492
  ('SMK Hidayah Pakuan',
   'Jl.Pakuan No 3 Kawalimukti, Kawalimukti, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69894020
  ('SMK Industri Perunggasan Panjalu (ipp)',
   'Dsn. Mandala RT/RW. 18/06, Kertamandala, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69947388
  ('SMK Informatika Al Ihya Banjarsari',
   'JL. RAYA BANJARSARI - LAKBOK NO. 138 KM 3, Sindanghayu, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20254643
  ('SMK Lpt Ciamis',
   'JL. KEDUNG PANJANG NO. 69 MALEBER CIAMIS, Maleber, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211530
  ('SMK MA Arif NU Al Mushlihuun',
   'Jln Cintanagara No. 01, Cintanagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69954591
  ('SMK MA Arif NU Al Muzayyin',
   'Dsn Jagamulya RT. 004 RW. 005, Rajadesa, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69952943
  ('SMK MA Arif NU Cidolog',
   'Cidolog, Kec. Cidolog, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69907851
  ('SMK MA Arif NU Tarbiyatul Huda Cimaragas',
   'Jl.Banjar Manonjaya Beber Cimaragas Ciamis, Beber, Kec. Cimaragas, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69920674
  ('SMK MA Arif Nurul Huda Utsmaniyyah Lumbung',
   'Lumbungsari, Kec. Lumbung, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69976651
  ('SMK MA Arif Riyadlush Sholawat',
   'Cieurih, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69976927
  ('SMK Ma`arif NU Banjarsari',
   'Ciherang, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69995497
  ('SMK Maarif NU Cihaurbeuti',
   'JL. CIHAURBEUTI NO. 114 CIHAURBEUTI, Sukahaji, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20272055
  ('SMK Maarif NU Cipaku',
   'Dsn Kidul Rt. 12 Rw. 07, Buniseuri, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69948105
  ('SMK Manarul Huda',
   'Cileungsir, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69950863
  ('SMK Ma’arif NU Kawali',
   'Jl. Kawali-Panjalu RT.22 RW.07, Margamulya, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70040370
  ('SMK Miftahul Huda Ii Jatinagara',
   'Jl. Mulyasari No. 43 05/02, Bayasari, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20263295
  ('SMK Muhammadiyah 1 Banjarsari',
   'JL. PASAR BARU NO.124, Cibadak, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211497
  ('SMK Muhammadiyah 2 Banjarsari',
   'JL. PASAR BARU NO.126, Cibadak, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211498
  ('SMK Muhammadiyah 3 Banjarsari',
   'JL LAPANG KAWASEN PASAR BARU CIBADAK NO 126, Cibadak, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20254648
  ('SMK Muhammadiyah Kawali',
   'JLN. PORONGGOL RAYA NO. 18, Kawalimukti, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211566
  ('SMK Nurul Huda Panumbangan',
   'Sindangmukti, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20254644
  ('SMK Pasawahan Banjarsari',
   'Pasawahan, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20268924
  ('SMK Peternakan Ciamis',
   'Baregbeg, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70003746
  ('SMK Plus Multazam Panawangan',
   'JL. PESANTREN SINDANGSARI, Nagarajaya, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20263299
  ('SMK Putra Panjalu',
   'Panjalu, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69965478
  ('SMK Taruna Bangsa',
   'JL. RAYA BANJAR KM.3 CIJANTUNG CIAMIS, Dewasari, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20237887
  ('SMK Terpadu Yakpidatek',
   'JL. RAYA BANJAR KM. 03 NO. 141 CIJEUNGJING - CIAMIS, Dewasari, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20254627
  ('SMK Tri Bintang Purwadadi',
   'JLN. BENDUNG MANGANTI SIDARAHAYU NO. 08, Sidarahayu, Kec. Purwadadi, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69762706
  ('SMK Vip Mambaus',
   'CINTARATU, Cintaratu, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69759274
  ('SMK Yasira',
   'JLN. RAYA BANJAR KM. 06, Pamalayan, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20253143
  ('SMKN 1 Panjalu',
   'Jalan Raya Sukamantri Hujungtiwu, Hujungtiwu, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69759219
  ('SMKN 1 Panumbangan',
   'Jl. Sukakerta No 443 Panumbangan, Sukakerta, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69968464
  ('SMKN 1 Purwadadi',
   'Jln. Winong I No 102 RT001/001 Ciamis, Purwadadi, Kec. Purwadadi, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69972417
  ('SMKN 1 Tambaksari',
   'Jalan Raya Tambaksari No. 47, RT. 04/02 Kampung Linggaharja Mekarsari, Tambaksari, Kec. Tambaksari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70055164
  ('SMP Al Huda Turalak',
   'Jln. Sukamaju no. 11, Sukamaju, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69786482
  ('SMP At Tibyan',
   'Mekarjadi, Kec. Sadananya, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69985576
  ('SMP Calistung Nusantara',
   'Pusakasari, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70058153
  ('SMP Daarul Falah Cijeungjing',
   'Jl. Kh. Ahmad Fadil No Dsn Handapherang, Handapherang, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20256483
  ('SMP IT Al-Amanah',
   'Panjalu, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70051028
  ('SMP IT As Shofa',
   'Kertabumi, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70056224
  ('SMP IT Boarding School Al-Jaohar',
   'Kampung Sukamulya, Dsn. Citaman RT. 031/012, Sandingtaman, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70004320
  ('SMP IT Irfani Quranicpreneur Bilingual School',
   'Jl. Jenderal Ahmad Yani No.257 RT 003/RW 002 Kertasari - Ciamis, Kertasari, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat 46213, Indonesia'),   -- NPSN 69993001
  ('SMP IT Miftahul Huda Ii',
   'Jln Mulyasari No. 40, Bayasari, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20263180
  ('SMP IT Miftahun Nidzom',
   'Kertabumi, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70058568
  ('SMP IT Nurul Huda',
   'Hujungtiwu, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69948101
  ('SMP IT Nurul Huda Utsmaniyah Lumbungsari',
   'Lumbungsari, Kec. Lumbung, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20263182
  ('SMP IT Riyadlul Khoer Cituur',
   'Jln. Raya Pangandaran, Sindangrasa, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70056226
  ('SMP IT Saadatul Ulfah',
   'Jl. Kilanang, Rancah, Kec. Rancah, Kabupaten Ciamis, Jawa Barat 46387, Indonesia'),   -- NPSN 70037489
  ('SMP Ibnu Siena Cikoneng Ciamis',
   'Jl. Raya Margaluyu Cikoneng Ciamis, Margaluyu, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211531
  ('SMP Inspirasi',
   'Jl. Baru H. Sanusi Sidampit, Pamokolan, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69987104
  ('SMP Islam Asb Miftahul Ulum',
   'Dsn. Depok, Padamulya, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69786696
  ('SMP Islam MA Arif NU Cikoneng',
   'Gegempalan, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69863244
  ('SMP Islam Terpadu Anharul Ulum',
   'Jl. Kawali-Cirebon, Winduraja, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70033610
  ('SMP Islam Terpadu Ar-Rofii Jatiluhur',
   'Rancah, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70000863
  ('SMP Islam Terpadu As-Sulthoniah',
   'RT 014 RW 007 Dsn, Jalatrang, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70004672
  ('SMP Islam Terpadu Daarul Falaah',
   'Komplek Pesantren daarul falaah, Sukamaju, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70005817
  ('SMP Islam Terpadu Ma`arif Al Barkah',
   'Jalan Raya Ciamis Banjar Km. 17 Dusuan Karangkamulyan, Karangkamulyan, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69978591
  ('SMP Islam Terpadu Magnashofa',
   'Beber, Kec. Cimaragas, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69973315
  ('SMP Islam Terpadu Miftahul Huda Ii An-Nawawi',
   'Jl. Mulyasari Bayasari Jatinagara, Bayasari, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69981540
  ('SMP Islam Terpadu Muhammad Danu Fathahillah',
   'Jalan Pasanggrahan RT 05 RW 08, Saguling, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70003434
  ('SMP Islam Terpadu Nurul Huda',
   'Margajaya, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69993153
  ('SMP Islam Terpadu Nurussalam',
   'Cidolog, Kec. Cidolog, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69752281
  ('SMP Islam Terpadu Nuurussalaam',
   'Jl. Cimanggu RT 05 RW 10, Jalatrang, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69989186
  ('SMP Islam Terpadu Riyadlul Qur`an',
   'Margaharja, Kec. Sukadana, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69978374
  ('SMP Ma`arif NU Al Husaeniyah',
   'Sirnabaya, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69973821
  ('SMP Ma`arif NU Jatinagara',
   'Sukanagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69965026
  ('SMP Maarief NU Lakbok',
   'Baregbeg, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69799884
  ('SMP Maarif NU Cipasung',
   'Beber, Kec. Cimaragas, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70042945
  ('SMP Maarif NU Nurul Hikmah',
   'Dsn. Tonggoh Rt. 002 Rw. 012, Pusakasari, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69948103
  ('SMP Manarul Huda',
   'Cileungsir, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69965753
  ('SMP Miftahul Khoer Boarding School',
   'Dsn. Mandala RT/RW. 17/06, Kertamandala, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69948104
  ('SMP Muhammadiyah Banjarsari',
   'Jl. Pasar Hewan, Cibadak, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69969007
  ('SMP Muhammadiyah Cikoneng',
   'Jln. Tentara Pelajar Cikoneng No. 2, Cikoneng, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211521
  ('SMP Muhammadiyah Kawali',
   'Jl Poronggol Raya 17 Kawali, Kawalimukti, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211513
  ('SMP Pasundan Sidamulih',
   'Jalan Malabar, Sidamulih, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211515
  ('SMP Plus Al Mugni',
   'Jalan Raya Timur Km. 2, Ciherang, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69973622
  ('SMP Plus Arriyadhoh',
   'Budiharja, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70036070
  ('SMP Plus Bina Pandu Mandiri',
   'Werasari, Kec. Sadananya, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20258105
  ('SMP Plus Darul Ihsan',
   'Walahir, Sukaresik, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69759287
  ('SMP Plus MA Arif NU Al Hikmah Cihaurbeuti',
   'Sukamaju, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20263194
  ('SMP Plus MA Arif NU Ciamis',
   'Jln. Citapen No.04 Bangunsirna, Sukamaju, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20257271
  ('SMP Plus MA Arif NU Cipaku',
   'Cieurih, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20263195
  ('SMP Plus MA Arif NU Purwadadi',
   'Jln. Panineungan Rt/rw 04/04, Purwajaya, Kec. Purwadadi, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20268723
  ('SMP Plus Ma`arif Al-Mushlihuun',
   'Jln. Cintangara No. 01 Rt/Rw 01/01, Cintanagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20268269
  ('SMP Plus PERSIS Panumbangan',
   'Jl Garahang Blok Cikadal, Tanjungmulya, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20253933
  ('SMP Plus Pasawahan',
   'Pasawahan, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20252969
  ('SMP Terpadu Al Muaawanah Rajadesa',
   'Jl. Kh Ahmad Romli No. 26, Rajadesa, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20263202
  ('SMP Terpadu Babussalam',
   'Jl. Bojonghuni No. 75 Bojonghuni, Maleber, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69954080
  ('SMP Terpadu Ishlahul Mubtadiin',
   'Sumberjaya, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69966200
  ('SMPN 1 Atap 1 Banjarsari',
   'Banjaranyar, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20252095
  ('SMPN 1 Cidolog',
   'Jalan, Jelegong, Kec. Cidolog, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211520
  ('SMPN 1 Cihaurbeuti',
   'Jl. Panjalu No.29, Sukamulya, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211623
  ('SMPN 1 Jatinagara',
   'Jl. Hayawang No. 149, Jatinagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211642
  ('SMPN 1 Lakbok',
   'Jalan Raya Lakbok No. 530, Sukanagara, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211632
  ('SMPN 1 Pamarican',
   'Pamarican, Pamarican, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211627
  ('SMPN 1 Panawangan',
   'Jalan Raya Panawangan No. 118, Panawangan, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211628
  ('SMPN 1 Panjalu',
   'Jl. Raya Timur No. 139 Panjalu, Panjalu, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211630
  ('SMPN 1 Panumbangan',
   'Jl. Raya Panumbangan No. 163, Panumbangan, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211631
  ('SMPN 1 Rancah',
   'Rancah, Rancah, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211657
  ('SMPN 1 Sadananya',
   'Jln. Sadananya, Sadananya, Kec. Sadananya, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211658
  ('SMPN 1 Sindangkasih',
   'Jl. Lenggorsari, Gunungcupu, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211659
  ('SMPN 1 Sukadana',
   'Jl. Cisena No.47 Sukadana, Sukadana, Kec. Sukadana, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211660
  ('SMPN 1 Tambaksari',
   'Jalan Raya Tambaksari No. 47, Mekarsari, Kec. Tambaksari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211662
  ('SMPN 2 Banjarsari',
   'Jalan Raya Cicapar No. 95, Cicapar, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211663
  ('SMPN 2 Cihaurbeuti',
   'Jln. Panjalu (legokkondang) Cihaurbeuti - Ciamis, Cihaurbeuti, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211654
  ('SMPN 2 Cikoneng',
   'Jalan Kujang, Nasol, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211647
  ('SMPN 2 Cisaga',
   'Jl. Rancah Blok Noong No. 292, Sukahurip, Kec. Cisaga, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211650
  ('SMPN 2 Jatinagara',
   'JL. VETERAN NO. 12, Mulyasari, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69727375
  ('SMPN 2 Lakbok',
   'Jl. Cintajaya, Cintajaya, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat 46385, Indonesia'),   -- NPSN 20211653
  ('SMPN 2 Lumbung',
   'Lumbung, Sadewata, Kec. Lumbung, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211622
  ('SMPN 2 Pamarican',
   'Jln. Raya Kertahayu No. 247, Kertahayu, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211591
  ('SMPN 2 Panjalu',
   'Jl. Kawali Panjalu, Sandingtaman, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211594
  ('SMPN 2 Panumbangan',
   'Jl. Raya Sindangherang No. 503, Sindangmukti, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211595
  ('SMPN 2 Purwadadi',
   'Padaringan, Kec. Purwadadi, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20252423
  ('SMPN 2 Rajadesa',
   'Rajadesa, Sukaharja, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211597
  ('SMPN 2 Rancah',
   'Jl. Rajadesa No.286 Cileungsir, Cileungsir, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211598
  ('SMPN 2 Sukamantri',
   'Jalan Siliwangi, Sindanglaya, Kec. Sukamantri, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20253043
  ('SMPN 2 Tambaksari',
   'Jl. Kapten Harsono 143, Sukasari, Kec. Tambaksari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211589
  ('SMPN 3 Banjarsari',
   'Jalan Sukadana No 238, Cigayam, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211588
  ('SMPN 3 Cipaku',
   'Mekarsari, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20252319
  ('SMPN 3 Cisaga',
   'Jln. Prajadinata No. 23 Bangunharja Cisaga, Bangunharja, Kec. Cisaga, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20253028
  ('SMPN 3 Lakbok',
   'Jalan Mekarjaya Nomor 199, Sidaharja, Kec. Lakbok, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211583
  ('SMPN 3 Pamarican',
   'Pamarican, Bantarsari, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20253243
  ('SMPN 3 Panawangan',
   'Jl. Raya Ciamis - Cirebon KM. 40, Gardujaya, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211586
  ('SMPN 3 Panumbangan',
   'Jl. Buanamekar, Buanamekar, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20253054
  ('SMPN 3 Rancah',
   'Jalan Dadiharja, Dadiharja, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211600
  ('SMPN 4 Banjarsari',
   'Jln. Raya Lakbok KM 05, Sindangasih, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20253080
  ('SMPN 4 Pamarican',
   'Jln. Wiryo Taruno No. 1 Sukamukti, Sukamukti, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20269188
  ('SMPN 4 Panawangan',
   'Jl. Rompe No.01, Nagarajati, Kec. Panawangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20253091
  ('SMPN 4 Rajadesa',
   'Jln. Jamuresi, Sukajaya, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211618
  ('SMPN 4 Rancah',
   'Cisontrol, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211619
  ('SMPN 5 Banjarsari',
   'Panyindangan Rt 02 Rw 07, Kalijaya, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211620
  ('SMPN 5 Ciamis',
   'Jl. Jenderal Sudirman No. 76, Ciamis, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211612
  ('SMPN 5 Rajadesa',
   'Tigaherang, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211645
  ('SMPN 6 Rajadesa',
   'Jln. Rancah - Panawangan, Andapraja, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69838663
  ('SMPN 7 Banjarsari',
   'Langkapsari, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20252419
  ('SMPN 7 Ciamis',
   'Jln Baktikarya II Kertasari, Kertasari, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20251796
  ('SMPN 8 Ciamis',
   'Jalan Raya Imbanagara No.517, Imbanagara Raya, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211604
  ('SMPN Satu Atap 1 Jatinagara',
   'Cintanagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20251818
  ('SMPN Satu Atap 1 Panumbangan',
   'Payungagung, Kec. Panumbangan, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20253051
  ('SMPN Satu Atap 1 Sukamantri',
   'Tenggerraharja, Kec. Sukamantri, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20255305
  ('SMPN Satu Atap Cipaku',
   'Jl. Sadananya-Kawali, Sukawening, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia');   -- NPSN 20253052

do $$
declare v_n int;
begin
  insert into sekolah (name, address)
  select d.nama, d.alamat
    from direktori_0157 d
   where not exists (select 1 from sekolah s
                      where kunci_sekolah(s.name) = kunci_sekolah(d.nama));
  get diagnostics v_n = row_count;
  raise notice '0157: % sekolah direktori ditambahkan.', v_n;
end $$;

do $$
declare
  s potret_0157%rowtype;
  n_regu int; n_nilai int; n_closing int; n_daftar int; n_sekolah int;
begin
  select * into s from potret_0157;
  select count(*) into n_regu    from regu;
  select count(*) into n_nilai   from nilai_mentah;
  select count(*) into n_closing from closing_regu;
  select count(*) into n_daftar  from pendaftaran;
  select count(*) into n_sekolah from sekolah;

  assert (n_regu, n_nilai, n_closing, n_daftar)
         = (s.regu, s.nilai_mentah, s.closing_regu, s.pendaftaran),
    format('0157: DATA NILAI BERGESER — regu %s->%s, nilai %s->%s, closing %s->%s, pendaftaran %s->%s',
           s.regu, n_regu, s.nilai_mentah, n_nilai, s.closing_regu, n_closing,
           s.pendaftaran, n_daftar);
  assert n_sekolah >= s.sekolah,
    format('0157: baris sekolah BERKURANG %s -> %s', s.sekolah, n_sekolah);

  raise notice '0157: % baris sekolah (dari %). Rekap nilai utuh — % regu, % nilai, % closing.',
               n_sekolah, s.sekolah, n_regu, n_nilai, n_closing;
end $$;

drop table if exists potret_0157;
drop table if exists direktori_0157;
