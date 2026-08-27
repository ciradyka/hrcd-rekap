-- ============================================================================
-- hrcd-rekap : 0129_impor_pendaftaran_xxxvii.sql
--
-- Memasukkan 100 regu yang mendaftar lewat Google Form HRCD XXXVII ke tabel
-- `pendaftaran` dan `regu`. Sumbernya berkas jawaban form
-- `FORM_PENDAFTARAN_HRCD_XXXVII_Jawaban.xlsx`, 100 baris, isian terakhir
-- 21 Agustus 2026.
--
-- ---------------------------------------------------------------------------
-- SATU BARIS FORM = SATU PENDAFTARAN
--
-- Formnya diisi per REGU, bukan per sekolah, jadi tiap baris jadi satu
-- `pendaftaran` berisi satu regu dengan kode pembayarannya sendiri. Itu
-- keputusan pemilik acara, bukan bawaan datanya: menggabungkan enam regu satu
-- sekolah jadi satu kode akan menagih satu pembina untuk regu yang bukan
-- urusannya, dan di data ini tujuh sekolah memang mengirim regunya lewat dua
-- nomor pembina yang berbeda.
--
-- ---------------------------------------------------------------------------
-- SEMUANYA BELUM MEMBAYAR
--
-- Kolom `status` dibiarkan pada bawaannya, `menunggu_pembayaran`. Form memang
-- meminta bukti transfer dan hampir semua mengunggahnya, tapi berkasnya ada di
-- Google Drive, bukan di Storage kita -- dan yang menentukan lunas adalah meja
-- pembayaran, bukan adanya lampiran. `metode_bayar` dan `bukti_transfer`
-- karena itu dibiarkan NULL; keduanya diisi saat berkasnya dipindahkan.
--
-- Nomor dada dan kloter juga NULL: keduanya lahir di `daftar_ulang_batch`,
-- bukan di sini.
--
-- ---------------------------------------------------------------------------
-- BISA DIJALANKAN ULANG
--
-- Tiap baris membawa `kunci_kirim` yang dihitung dari nomor barisnya di
-- spreadsheet -- `md5('hrcd-xxxvii-form-<baris>')::uuid` -- dan `pendaftaran`
-- punya unique index atas kolom itu sejak 0006. Menjalankan migrasi ini dua
-- kali tidak melahirkan seratus pendaftaran kedua; yang sudah ada dilewati.
--
-- Kode pembayarannya TIDAK dihitung dari nomor baris. Ia diundi seperti di
-- `submit_pendaftaran`, dengan pengulangan sampai tidak bentrok, supaya kode
-- yang sudah beredar di produksi tidak mungkin tertimpa.
--
-- ---------------------------------------------------------------------------
-- SEKOLAH
--
-- 28 sekolah, dari 43 tulisan berbeda di form. Penyamaannya memakai
-- `kunci()` Python di `tools/normalize_sekolah.py`, hasilnya dibaca orang, lalu
-- nama bakunya ditulis tangan di sini -- persis urutan yang diminta
-- runbook-sekolah.md bagian 12.2. Menyerahkan pencocokan itu ke
-- `kunci_sekolah()` database sudah pernah dicoba di 0061 dan meloloskan enam
-- sekolah tanpa dibakukan.
--
-- Empat tulisan disatukan tangan, karena kunci mana pun tidak boleh cukup
-- rakus untuk menyatukannya sendiri:
--
--   'sman negeri 1 sukadana'           -> SMAN 1 Sukadana
--   'SMA NEGERI 2 CIA'                 -> SMAN 2 Ciamis    (ketikan terpotong)
--   'SMPN1 a CIKONENG'                 -> SMPN 1 Cikoneng
--   'Jalatrang' / 'Jalatrang Cipaku'   -> SMK As-Sulthoniah
--
-- Yang terakhir bukan salah ketik melainkan dua kolom yang tertukar: Jalatrang
-- adalah DESA tempat sekolahnya berada, dan nama sekolahnya justru ditulis di
-- kolom Gugus Depan. Dipastikan ke pemilik acara beserta alamat lengkapnya.
--
-- 13 sekolah belum ada di daftar kurasi dan lahir di sini dengan alamat
-- KOSONG. Alamatnya tidak dikarang dari kolom Kwartir Ranting form -- runbook
-- bagian 1 menyebut kolom itu petunjuk arah, bukan sumber kebenaran. Daftar
-- kerjanya ada di docs/sekolah-belum-tuntas.md.
--
-- ---------------------------------------------------------------------------
-- DUA PAGAR YANG FORM GOOGLE TIDAK TAHU
--
-- `regu` punya tiga pagar atas nama regu, dan Google Form tidak tahu satu pun:
-- maksimal 20 karakter dan tidak boleh kembar (0051), serta tidak boleh
-- memuat angka (0052). Sebelas regu di sini melanggar salah satunya, dan
-- namanya sudah beredar di sekolahnya sebelum sistem ini melihatnya.
--
-- Dua pagar dilonggarkan lebih dulu, atas keputusan pemilik acara, dan
-- alasannya ada di kepala masing-masing migrasi:
--
--   0127  batas panjang 20 -> 25    menampung COBOY GEULIS PASUNDAN (21),
--                                   WIJAYA KUSUMA NAWASENA (22),
--                                   LAKSAMANA MALA HAYATI (21)
--   0128  angka boleh di EKOR       menampung CAKRA 1/2/4 dan AGRESI 1/2/3,
--                                   enam regu SMKN 2 Ciamis
--
-- KEDUANYA WAJIB dijalankan lebih dulu. Berkas ini sendirian di database yang
-- masih berbatas 20 gagal di regu keempat, dan yang masih menolak angka gagal
-- di regu ke-74.
--
-- Nama kembar tidak bisa diselesaikan dengan melonggarkan pagar: nama juara
-- dibacakan di depan lapangan, dan nama yang sudah disebut kehilangan
-- momennya. Dua pasang, dan yang mendaftar lebih dulu berhak atas namanya --
-- persis yang akan terjadi kalau mereka melewati form kita, karena
-- nama_regu_dipakai() memblokir yang belakangan SAMBIL DIKETIK:
--
--   GARUDA   MTs Al-Hasan Banjarsari  21 Agt  -> tetap GARUDA
--            SMPN 1 Cipaku            27 Agt  -> GARUDA CIPAKU
--   TERATAI  MTs Al-Hasan Banjarsari  21 Agt  -> tetap TERATAI
--            MTs Bahrul Anwar         27 Agt  -> TERATAI BAHRUL ANWAR
--
-- Ekor nama sekolah adalah keputusan pemilik acara. Kedua pembina perlu
-- diberi tahu: yang tercetak di blangko dan dibacakan di lapangan adalah nama
-- yang di sini, bukan yang mereka tulis di form.
--
-- ---------------------------------------------------------------------------
-- YANG TIDAK DITANYAKAN FORM
--
-- Form XXXVII tidak menanyakan barak maupun jumlah yang menginap, jadi
-- `butuh_barak` false dan `jumlah_menginap` 0 untuk seluruh baris. Keduanya
-- ditanyakan ulang di meja daftar ulang lewat `ubah_jumlah_menginap()`.
--
-- Form juga tidak menanyakan siapa ketua regunya. Yang dipakai sebagai
-- `nama_ketua` adalah "Nama Lengkap Anggota 1", dan empat sisanya masuk
-- `regu.anggota` berurutan. Seluruh 100 regu mengisi kelimanya.
--
-- Sepuluh regu tidak mengisi Contact Person Pembina -- MTs Al-Hasan Banjarsari
-- (4), SMPN 3 Kawali (5), SMPN 2 Kawali (1). `kontak_wa` NOT NULL, jadi
-- ketiganya diberi penanda 'belum ada' yang terbaca sebagai kekosongan di
-- layar, bukan sebagai nomor yang gagal dihubungi. Nomornya dikejar terpisah.
-- ---------------------------------------------------------------------------
-- DUA TABEL SEMENTARA, DIBUANG DENGAN TANGAN
--
-- Keduanya sengaja TIDAK memakai `on commit drop`. Produksi menjalankan
-- migrasi lewat `psql --single-transaction`, jadi di sana klausa itu benar;
-- `tests/run.sh` tidak, dan di autocommit `create temporary table ... on
-- commit drop` membuang tabelnya seketika di ujung statement yang membuatnya.
-- Berkas ini pertama kali ditulis begitu dan gagal di baris berikutnya dengan
-- 'relation "impor_form" does not exist' -- hanya di laptop, bukan di
-- produksi. Yang dibuang di ujung berkas ini adalah gantinya, dan ia benar di
-- kedua cara menjalankan.
-- ============================================================================

create temporary table impor_form (
  baris       integer primary key,
  sekolah     text    not null,
  nama_regu   text    not null,
  golongan    text    not null,
  nama_ketua  text    not null,
  anggota     text[]  not null,
  kontak_wa   text    not null,
  nama_kontak text
);

insert into impor_form (baris, sekolah, nama_regu, golongan, nama_ketua,
                        anggota, kontak_wa, nama_kontak) values
  (2, 'MTs Al-Hasan Banjarsari', 'GARUDA', 'penggalang_pa',
   'YOKI RAMADHI',
   array['ALDI AMU MUROZAQ', 'MAHER GIBRAN ALGHIFARY', 'DIKA NURPRADANA', 'KAMAJAYA SUKMA PAWITRA'],
   'belum ada', null),
  (3, 'MTs Al-Hasan Banjarsari', 'TERATAI', 'penggalang_pi',
   'RIFFA''A NUR AZIZAH',
   array['DARIS SETIA NINGSIH', 'ZAHRA AUDIA', 'DEVI PUSWITA', 'KEULIS NUR AZIZAH AZZAHRA'],
   'belum ada', null),
  (4, 'MTs Al-Hasan Banjarsari', 'EDELWEIS A', 'penggalang_pi',
   'AYUNIA CHARLIANTI',
   array['DEBIYLA ZAHRA MEYFA', 'SYIFA NUR LATIFAH', 'DINARA SYAFIRA', 'SABILA NILNAMUNA'],
   'belum ada', null),
  (5, 'MTs Al-Hasan Banjarsari', 'ELANG', 'penggalang_pa',
   'HAZIQ ARYA PRATAMA',
   array['WILLY ALFIKRI', 'MUHAMMAD DZIKRI MAULANA', 'ADAM GHANI KAUTSAR', 'MUHAMMAD HASBI ABDILLAH'],
   'belum ada', null),
  (6, 'SMPN 2 Kawali', 'ASTER PRADOEKA', 'penggalang_pi',
   'Fitya Najiyah Rahmadan',
   array['Salsa Syakila Zahra', 'Agni Nurhasanah', 'Zahira', 'Widad Dwi Razwanti'],
   'belum ada', null),
  (7, 'SMPN 3 Kawali', 'ALAMANDA', 'penggalang_pi',
   'SANI AULIA RAMADHAN',
   array['ALYA NUR NABILAH', 'MESYA ROSLIANI', 'SINTYA NUR AMANAH', 'SITI MAESAROH'],
   'belum ada', null),
  (8, 'SMPN 3 Kawali', 'CAMELIA', 'penggalang_pi',
   'DIANDRA ANNISA NAWA NUGRAHA',
   array['HILDA HIDAYAH', 'KHANZA HUMAIRA BILQIS', 'SILVI MAULIDA', 'ZAHRA NUR AZIZAH'],
   'belum ada', null),
  (9, 'SMPN 3 Kawali', 'ASTER', 'penggalang_pi',
   'SOLIHATUNNISA',
   array['KESYA SHLAAWATI', 'NATASYA ASYIFA PUTRI', 'AYRA RAHMA JULIYANTI', 'SYIFATUL KAMILAH'],
   'belum ada', null),
  (10, 'SMPN 3 Kawali', 'CARACAL', 'penggalang_pa',
   'DESTA AKSIOMA MUSTOFA',
   array['MUHAMMAD FAUZAN AL GHIFARI', 'DYAN RACHMAT KOMARI', 'MUHAMMAD NAUFAL ARIF ADISANTIKA', 'GILANG FERDIANSAH RAMADAN'],
   'belum ada', null),
  (11, 'SMPN 3 Kawali', 'MAUNG', 'penggalang_pa',
   'ADITYA RAHMAN SAPUTRA',
   array['AGUS SUPRIATNA', 'DAFA BILFAQIH ABYAN', 'MAHESA PURTA ASUARI', 'PASYA FADILLA'],
   'belum ada', null),
  (12, 'MTsN 1 Ciamis', 'TIMUN MAS', 'penggalang_pi',
   'KIKIS RINDU APRILLIA',
   array['AZKA SELVA NUR FADILLAH', 'AYU INTAN NURAENI', 'ARNI MEILANI', 'SITI NURHASANAH'],
   '088971832802', null),
  (13, 'MTsN 1 Ciamis', 'THE JALANGKUNG', 'penggalang_pa',
   'NAUFAL ZATNIKA',
   array['EVAN MUHAMAD FADIL', 'MUH ZIDAN ZAKI BUDIAWAN', 'REVAN PERMANA', 'TIO FAUQO SYAHID'],
   '088971832802', null),
  (14, 'SMPN 1 Cimaragas', 'PANCA PUSPITA', 'penggalang_pi',
   'ADE RISMAYANTI',
   array['SITI MUDRIKAH', 'ANGGUN FEBBY ARIANY', 'SISKA VARLIANA PUTRI', 'ROSELLA'],
   '085860555358', null),
  (15, 'SMPN 1 Cimaragas', 'MATAHARI', 'penggalang_pi',
   'ADIA RAFA FATHINA',
   array['PUTRI SALSABILA NUR AZIZAH', 'APRILIA PUTRI LESTARI', 'AQILA KAYALANI', 'NADYA GALUH MULYANI'],
   '085322800405', null),
  (16, 'MTsN 1 Ciamis', 'MARIO BROSS GEULIS', 'penggalang_pi',
   'WINARNI NURRIZQIAH',
   array['SHINY QURRATU QALBI', 'SYAKIRA HASYA JANEETA', 'ALIN NAWAL K', 'PUTRI BILQIS'],
   '088971832802', null),
  (17, 'SMPN 1 Kawali', 'JALAK DEWATA', 'penggalang_pa',
   'Dimas Bagja Ar Rasyid',
   array['Achmad Rizal Mutaqin', 'Athif Falihul Faiq Cherdiana', 'Rafka Rafasya Pratama', 'Rizqi Adhitya Pramudita'],
   '08988777900', null),
  (18, 'MTsN 1 Ciamis', 'CRAZY BOYS', 'penggalang_pa',
   'ALBANI MUHAMMAD NASIR',
   array['YAZID FATHUROHMAN MUBAROK', 'MUHAMAD BARIZ HIELMI', 'DAFIAN APRILIO', 'DEFASA SATRIA MAULANA'],
   '088971832802', null),
  (19, 'MTsN 1 Ciamis', 'COBOY GEULIS PASUNDAN', 'penggalang_pi',
   'ZAHIRA NURUL ''AINI',
   array['RARA FANY FAUZIAH', 'NAIRA SYAHLA AJAHRA', 'MALA NURULFADILAH', 'HILYANI RAISA SUCIANI QOLBY'],
   '088971832802', null),
  (20, 'SMPN 1 Kawali', 'WIJAYA KUSUMA NAWASENA', 'penggalang_pi',
   'Alia Shofia Maulida',
   array['Aisyah Citra Nila Kusumah', 'Aqila Putri Ginsa', 'Nazwa Dalilah', 'Sefira Sajidah Zahra'],
   '087828486646', null),
  (21, 'SMPN 1 Kawali', 'VIOLET NISKALA', 'penggalang_pi',
   'Khalisa Shafa Ghaissani',
   array['Alfira Klarisa Putri', 'Ilma Firda Hasbiya', 'Kaila Najla Humaira', 'Melani Triesahapsari'],
   '087828486646', null),
  (22, 'SMPN 1 Kawali', 'JAGUAR WISESA', 'penggalang_pa',
   'Muhammad Fakhri Nizam Ali',
   array['Devaleskha Tysta Khalfani', 'Nanda Nektar An-Nahl', 'Raqilla Idraki Lattanzio', 'Taufik Khoirul Fajar'],
   '08988777900', null),
  (23, 'SMPN 1 Ciamis', 'BOUGENVILE', 'penggalang_pi',
   'Shafa Milana Anggraeni Setiawan',
   array['Novidha Anastasya Putri', 'Azkiya Kirey Anzio', 'Agnya Nur Fadillah', 'Syifa Zakiyya Filardha Razqi'],
   '08112292012', 'ibu Fitri latuperisa'),
  (24, 'MA Sirnarasa', 'CAKRA NUSA', 'penegak_pa',
   'MUHAMMAD FIKRI PRATAMA',
   array['ABDAN NASIR BAHRAWI', 'HILMY FARRAS FATIH', 'MUHAMMAD RIZQY ATTALA ROSADI', 'MUHAMMAD ZUFAR FAIQ K'],
   '089518698998', null),
  (25, 'SMAN 1 Baregbeg', 'RHINO', 'penegak_pa',
   'FANZI HAERUDIN',
   array['RAFKA MAULI RESTU SYAPUTRA', 'FADEL MUHAMMAD FAUZI', 'SUNAN ANGKAWIJAYA', 'RADITIYA RUHIYAT SAPUTRA'],
   '085223168786', null),
  (26, 'SMAN 1 Sukadana', 'AVARSA', 'penegak_pi',
   'Indah Nurhusna',
   array['Haira Salsyabila', 'Tiara Qianisa Putri', 'Nurul Meilahafifah', 'Sinta Nuraini'],
   '082318383182', null),
  (27, 'SMAN 1 Sukadana', 'ANYELIR', 'penegak_pi',
   'Alexandriani Siratuyunin',
   array['Silvi Nuraeni', 'Dara Nukeu Pebrianti', 'Sri Putri Lestari', 'Andin Keisya Putri'],
   '082318383182', null),
  (28, 'SMAN 1 Sukadana', 'MOLDA', 'penegak_pi',
   'MEILANI AWALIYAH',
   array['OKTAVIANI AZZAHRA', 'LEANI INSANI PUTRI', 'DESPITA TRI HANDAYANI', 'SITI SALMAH KHAIRUNNISA'],
   '082318383182', null),
  (29, 'SMAN 1 Sukadana', 'NGABRET', 'penegak_pi',
   'Imelda Yustanza',
   array['Zaskia Maulida', 'Shifa Nurul Aulia', 'Salsabila Azzahra', 'Anggun Alviani'],
   '082318383182', null),
  (30, 'SMAN 1 Sukadana', 'AGREMA', 'penegak_pi',
   'ICHA HAPIPAH',
   array['AISYATUL HUSNA', 'KIKI AZA AMELIA', 'ATIKA BALQIS AZIZAH', 'RAHMA AZILA PUTRI'],
   '082318383182', 'ka erna yuliana'),
  (31, 'SMAN 1 Sukadana', 'NISKALA', 'penegak_pi',
   'ISMAJATI',
   array['Sarah Aulya Zahra', 'Risnina Aprilia Diany', 'Risma Nur Afifah', 'Lulu Aulia Juniar'],
   '08231838182', null),
  (32, 'SMAN 1 Sukadana', 'BANGKONG LUNCAT', 'penegak_pa',
   'Anil Nirwana Juniar',
   array['Adhitya Afrilianto Gunawan', 'Yuda Prasetiyo', 'Aan Nurfaturohman', 'Miptah Parid'],
   '082318383182', null),
  (33, 'SMAN 1 Sukadana', 'KAUM GABUT', 'penegak_pa',
   'MUHAMMAD AZKA AULIA',
   array['FAUZAN ZULKIFLI HASAN', 'ADITYA MUHAMMAD REZKY', 'RENO MEIZA ADRIAN', 'TEMMY TRI AWALUDIN'],
   '082318383182', null),
  (34, 'SMAN 1 Sukadana', 'GUNDAL GANDIL', 'penegak_pa',
   'Dika nugraha',
   array['Evan rofiqulvian', 'Haikal hamdi', 'Raka nurcahya fadila', 'Aditya muhamad dafa'],
   '082318383182', null),
  (35, 'SMAN 1 Sukadana', 'EDELWEIS B', 'penegak_pi',
   'Nindia putri juniar',
   array['Salsabila Juliani', 'Fina jaoharotul huda', 'Nita', 'Rifa Salma azahra'],
   '082318383182', null),
  (36, 'SMPN 1 Ciamis', 'BUNGA TELANG', 'penggalang_pi',
   'Adzkya Qanayya Rakhmat Mulyana',
   array['Rd.roro edlyn elgiva w.', 'Ica cahyani', 'Anisya''ban Khoirul anam', 'Chika ayunda rahma'],
   '0811200292011', null),
  (37, 'SMPN 1 Cikoneng', 'BANTENG', 'penggalang_pa',
   'SYAFIQ ARIEF NUGRAHA',
   array['ZAKIY MUHAMMAD TAZKIYYA', 'MUHAMAD RIFKI', 'ADITIA DWI PUTRA', 'DADANG DARUSMAN'],
   '081321692092', null),
  (38, 'SMPN 1 Cikoneng', 'RAFLESIA', 'penggalang_pi',
   'BELA NURAENI',
   array['ZAHIRA SITI FATITUZZAHRO', 'KEISHA NUR QAIREEN', 'ADELLIA RAMADHANI FATIMAH', 'SAHIRA FARRAS GHAISANI'],
   '081321692092', null),
  (39, 'SMAN 1 Panawangan', 'RIMBA BOY', 'penegak_pa',
   'ANGGI HENDRIANA',
   array['ARI MULYA GUMILAR', 'DENNIS ZAIDAN FATURRACHMAN', 'SANDRA MALIK', 'SHANDIKA FEBRIYANA'],
   '081312250007', null),
  (40, 'SMAN 1 Panawangan', 'WIRAGA', 'penegak_pa',
   'Raka nur fahrizka',
   array['Irawan Riswanto', 'Fahrul Fauzi', 'Muhammad Dzikri N.H', 'Rayi nur fahrizka'],
   '081312250007', null),
  (41, 'SMAN 1 Sukadana', 'CENDANA', 'penegak_pi',
   'desy wulanika',
   array['lyris Khoirunnisa', 'nuryza aprilyani', 'decha fadillah shilvana', 'nida aulia'],
   '082318383182', null),
  (42, 'MTs Mujahidin', 'LIMA ELANG TANGGUH', 'penggalang_pa',
   'Nanda Najiullah Arham',
   array['Rafa Arkana Hamizan', 'Muhamad Fahri', 'M. Fazri Setiawan', 'Badri Maulana'],
   '081320073291', null),
  (43, 'MTs Mujahidin', 'LIMA ELANG GAGAH', 'penggalang_pa',
   'GALIH PURNAMA RAMADHAN',
   array['FARDA RIDHO RAMADHAN', 'NURSIDIK RAMDANI', 'RAKHA SYAFIQ ABDULLAH', 'IRFAN HANDIANA'],
   '081320073291', null),
  (44, 'MTs Mujahidin', 'LIMA ELANG BERANI', 'penggalang_pa',
   'FIRDIAN MAULANA',
   array['SEPTA DWINUGRAHA PUTRA', 'FAQIH DHIYAULHAQ SYAHPUTRA', 'AZKA N. ARIFIN', 'ADE AGUSTIANA'],
   '081320073291', null),
  (45, 'MTs Mujahidin', 'LIMA ELANG CERDIK', 'penggalang_pa',
   'KAFFA FAWWAZ AL TAMIS',
   array['DIFFA NAFIZ AUFAR', 'AGUNG IKHWAN NAFIZ', 'TAUFAN ADZIM H. FAYYAZ', 'RAFFA ADYTIA NUGRAHA'],
   '081320073291', null),
  (46, 'MTs Mujahidin', 'LIMA MATAHARI HEBAT', 'penggalang_pi',
   'REYSHA ALICE SALSABILA',
   array['NAYLA WULAN GERHANA', 'TASYA AULIYA NISAUZZAKIYAH', 'IZDIHAR SERIYUSLI', 'FITRI KHOIRUNNISA'],
   '081320073291', null),
  (47, 'MTs Mujahidin', 'LIMA MATAHARI CANTIK', 'penggalang_pi',
   'CLARESA PUTRI SITI KHOJANAH',
   array['VERA NUR RAHAYU', 'DESWITA NADILA CANTIKA', 'AVISA TAZKIYATUN NISA', 'RAYA NURUL AKILA'],
   '081320073291', null),
  (48, 'SMAN 1 Sukadana', 'KECET KECET', 'penegak_pa',
   'Azam Muhammad Zildan',
   array['Eka Julian Pratama', 'Adi Febrian', 'Restu Agustian', 'Satria Daffa Yunansyah'],
   '082318383182', null),
  (49, 'SMAN 1 Panawangan', 'NEBULA', 'penegak_pi',
   'anisa nur syamsyah',
   array['Rahmawati Oktaviani', 'Sri Agustina', 'Amanda nafisa fitri', 'Laila nur fitriasari'],
   '081312250007', null),
  (50, 'MA Mujahidin', 'NARARA', 'penegak_pi',
   'ATIA TUNNISA',
   array['SRI ASIH', 'KEYLA AZZAHRA PEBRIANTI', 'VIDYA WARDATUL ''AINI', 'NADIA INDRIANI'],
   '081323765964', null),
  (51, 'MA Mujahidin', 'EX GARUDA', 'penegak_pa',
   'AGUNG AKBAR SIDIK',
   array['FAHRI FAIZ FARHANI', 'MUHAMMAD SAEFUL DAFA', 'IHSAN NASULLOH', 'NYCEP YUDISTIRA'],
   '081211304457', null),
  (52, 'MA Mujahidin', 'PIIT BONDOL', 'penegak_pa',
   'MUHAMAD BAYU SETIAWAN',
   array['SHEVA FAUJAN HILMI', 'RO''UP SOLEHUDIN', 'RAUHAN HERDIANSYAH', 'IMAM NURJAMIL'],
   '081211304457', null),
  (53, 'MA Mujahidin', 'SATWIKA', 'penegak_pi',
   'DIAN SRI MULYANI',
   array['AULIA SALSABILA', 'RISMA', 'PUTRI SITI ATIAH', 'SUCI AYU LESTARI'],
   '081323765964', null),
  (54, 'MTsN 1 Ciamis', 'SRIKANDI DENIM', 'penggalang_pi',
   'ANNISA AMELIA QOLBI',
   array['RAINA ALMUKHSANATUNNISA', 'ADILA MAULIDA SANUSI', 'SITI SILKA KUMALA', 'YANTI KUMALA'],
   '088971832802', null),
  (55, 'SMAN 1 Kawali', 'RANGGAYUNAN', 'penegak_pa',
   'Rifki kosasih',
   array['Al Firyal Azhar', 'Ari Afrizal Nuryana', 'Daffa Khaerul Iman', 'Lionel Alfon Nicola'],
   '082119352827', null),
  (56, 'SMAN 1 Kawali', 'CITRARESMI', 'penegak_pi',
   'ADINDA SYAIMA RAIHANUNNISA',
   array['SALSABILA SETIANI', 'ISTI AGUSTIN', 'NAZWA ASRIAH KUSNADI', 'HILDA NUR AISAH'],
   '082119352827', null),
  (57, 'SMAN 1 Kawali', 'DEWI UMMA', 'penegak_pi',
   'AKILA LATIFA SYAWALIAH',
   array['FRANSISCA INDRIYANI', 'NASYWA LAILATUL HUSNA', 'ADINDA RIZQYATUL MUBAROKAH', 'TINA AMELIA RAHMA'],
   '082119352827', null),
  (58, 'SMAN 1 Kawali', 'RATU DEWATA', 'penegak_pi',
   'NUNIK NURSOBAH',
   array['DEWI ANDINI', 'RAHMA ANGGI WIGUNA', 'NAJLA RAISYA TSABITAH', 'NABILA LATHIFATUNNISA'],
   '082119352827', null),
  (59, 'SMAN 1 Kawali', 'DEWI LARA', 'penegak_pi',
   'IIS ISTIANAH',
   array['ALLISTYA RAIYA RAMAWATI', 'HAIFA NUR FADILA', 'DZALFA FATIMATUL KAMILA', 'RAISYA CAMEELA EL MAHROM'],
   '082119352827', null),
  (60, 'SMAN 2 Ciamis', 'BANCET HEJO', 'penegak_pa',
   'Asep Nugraha',
   array['Fauzian Rizki Firdaus', 'Muhammad Rafli', 'Arif Rahman Firdaus', 'Damar Wulan Wijaya'],
   '082262634124', 'Ibu Nurislah'),
  (61, 'SMAN 2 Ciamis', 'REGU SERAYA', 'penegak_pi',
   'Kirana Ramadani Putri',
   array['Lisda Nurhidayah', 'Chelsea Kirana Maharani', 'Alya Haya Nafiisah', 'Maulida siti rundati'],
   '082262634124', null),
  (62, 'SMAN 1 Kawali', 'SINGACALA', 'penegak_pa',
   'ADIT RADITYA',
   array['RIZQY FEBRIAN ARRASYID', 'ANDIKA GEOPANO', 'PASHA MAULANA EL-HAQ', 'ZAMZAM MUBAROK UDHMA'],
   '082119352827', null),
  (63, 'SMA IT Nurul Huda', 'SERSANT', 'penegak_pa',
   'ABDUL AZIZ RAMDANI',
   array['WILDAN HILMIANSYAH', 'GILANG RAMADAN', 'YOSEP DARMAWAN', 'WILDAN MAULANA HILMANSYAH'],
   '081312042034', null),
  (64, 'MA Bahrul Anwar', 'JOKO TINGKIR', 'penegak_pa',
   'AGNI M ABDU ROSID',
   array['AHMAD JAELANI', 'EFILIAN ILHAM R', 'M RIZQI ZIYAD S', 'ARROFI SIHABUL M'],
   '082319605067', null),
  (65, 'MA Bahrul Anwar', 'LASKAR TANI', 'penegak_pa',
   'YUDA KAMIL P',
   array['M HUSNI MUBAROK', 'AHMAD FAUZI GIBRAN', 'IRFAN MAULIDI', 'FABBY NUR AKMAL J'],
   '082319605067', null),
  (66, 'MA Bahrul Anwar', 'ASTRA JINGGA', 'penegak_pa',
   'AZMI ZAIDAN ZS',
   array['AKBAR PURNAMA S', 'M ILHAM S', 'RANDHIKA M FAUZI', 'AHMAD HIDAYAT'],
   '082319605067', null),
  (67, 'MA Bahrul Anwar', 'ROJALI', 'penegak_pa',
   'M ZAIDAN A',
   array['ZIKRI MAULANA', 'ALDI ROSDIANSYAH', 'M AQIL ABDUL M', 'M RAVI NUR AZI'],
   '082319605067', null),
  (68, 'MA Bahrul Anwar', 'SEKAR WIDYA', 'penegak_pi',
   'RINI FITRIANI',
   array['ISNA KAMALIATUL M', 'ROSA RIKA N', 'ZASKIA CAHYA', 'AIRA FITRI YANI'],
   '082319605067', null),
  (69, 'MA Bahrul Anwar', 'CENDANA B', 'penegak_pi',
   'IRNA INDAH HAYATI',
   array['WITRI SALSA R', 'DINI WAHYUNI', 'ZIHAN HASYRI A', 'HUSNA CHOIRUN N'],
   '082319605067', null),
  (70, 'SMK As-Sulthoniah', 'MANGGALA', 'penegak_pi',
   'Meylana Septiani',
   array['Nuraeni', 'Mega Aulis', 'Keisha Rahmadina', 'Anit Anita Tiarawati'],
   '081213097843', null),
  (71, 'SMK As-Sulthoniah', 'TUTUT', 'penegak_pi',
   'Asep Andi Maulana',
   array['Deris Khoerusadiq', 'Ahmad Fahri Alfi Fauzan', 'Febriansyah Muharom', 'Fikri Nakhlak Rafi'],
   '081213097843', null),
  (72, 'SMPN 1 Cipaku', 'REGU MATAHARI B', 'penggalang_pi',
   'Rifka Kayla azzahra',
   array['Luthfia Nur maulida', 'Raisya nurfadilah', 'Layla Nur fathonah', 'Raeesa amanda putri'],
   '085659503086', 'Puteri dewi ang gini'),
  (73, 'SMK As-Sulthoniah', 'EDELWEIS', 'penegak_pi',
   'Apwa Maupatul Pauzah',
   array['Syarah Heryani', 'Shalwa Nurul Hidayah', 'Deasifa Damayanti', 'Mutiara Ardilah Nurfala'],
   '081213097843', null),
  (74, 'SMPN 1 Cipaku', 'GARUDA CIPAKU', 'penggalang_pa',
   'Fathan Fadlika Maulidan',
   array['Muhamad Adrian Putra Khoeruman', 'Muhammad Rafi Nurohmat', 'Fery Marwan Septian', 'Arfandi Khairul Adam'],
   '085794019830', 'andre ramandra'),
  (75, 'SMKN 2 Ciamis', 'CAKRA 1', 'penegak_pi',
   'Syifa Khoerunisa',
   array['Sifa Januarista', 'Agni Nurul Jannah', 'Nur Farjanah', 'Annisa Wulandari'],
   '08112113126', 'Dewi Aryanti'),
  (76, 'SMKN 1 Rancah', 'KIRANA', 'penegak_pi',
   'RIKA NUR AYUNINGSIH',
   array['AMELIA BUNGA SAFITRI', 'YENI NURA''ENI', 'YASMIN PUTRI KHUMAIRAH', 'RAHMAWATI'],
   '085212553553', null),
  (77, 'SMKN 1 Rancah', 'SURALAKSANA', 'penegak_pa',
   'REYHAN ADHIRA FEBRIAN',
   array['RIFKY RAMDANI', 'ADE ALI RIDZWAN', 'JAYA RAMDANI', 'IPNU OKTA SAPUTRA'],
   '085321081547', null),
  (78, 'MTs Bahrul Anwar', 'SYUDUDU', 'penggalang_pa',
   'M FARHAN',
   array['MAURIZ HUSNI M', 'AZMI ALIF HILMI', 'M IJAD BADRUJAMAN', 'ARVIN NUGRAHA'],
   '082319605067', null),
  (79, 'MTs Bahrul Anwar', 'PASUKAN SATRIA', 'penggalang_pa',
   'ASEP MAULANA',
   array['AGIS RIADI H', 'FAISAL ABDUL H', 'AZKA DARMAWAN', 'NAJA ZAINURROHMAN'],
   '082319605067', null),
  (80, 'MTs Bahrul Anwar', 'SCARLET', 'penggalang_pa',
   'AZZAM FADL ABQORY',
   array['HILMI NIZAR M', 'M YASIR AL-BANA', 'LU''LU ABDUL LATIF', 'DAES PADIL PRATAMA'],
   '082319605067', null),
  (81, 'SMKN 2 Ciamis', 'CAKRA 4', 'penegak_pi',
   'Aira Nanda Heraldine',
   array['Siska Aulia', 'Nova Nuraeni', 'Salsa Rahmawati', 'Lisna Setiawati'],
   '08112113126', 'Dewi Ariyanti'),
  (82, 'MTs Bahrul Anwar', 'KENANGA', 'penggalang_pi',
   'EUIS SITI NURROHMAH',
   array['SINTA SAMSIATU ROHMAH', 'RATIH QIBTYAH H', 'NISWAH KHOIROTUN H', 'NAZMI GILDA A'],
   '082319605067', null),
  (83, 'MTs Bahrul Anwar', 'TERATAI BAHRUL ANWAR', 'penggalang_pi',
   'BALQIS LAELA S',
   array['FATIMAH AZZAHRA', 'HANI LAELATUL H', 'AMELIA RAHMA N', 'ALMA ZAKIATUL F'],
   '082319605067', null),
  (84, 'SMAN 2 Ciamis', 'MENTARI STECU', 'penegak_pi',
   'NABILA NURFELLIA',
   array['AMIRAH HAIRANI SYARIEF', 'SILVI ANGGRAINI PUTRI', 'AIRA PUTRI AMARA', 'REGINA AULIA PUTRI'],
   '082262634124', null),
  (85, 'MA IPHI Pamarican', 'EL - FAQIH', 'penegak_pa',
   'Naufal Ari Fahreza',
   array['Ihsan Maulana', 'Rahmat Khoyrur Rizqi', 'Raihan Amdar Kanastren', 'Adelpi Rosadi'],
   '081323643027', null),
  (86, 'SMKN 2 Ciamis', 'AGRESI 1', 'penegak_pa',
   'EQBAL FARIS AL-GHIFARI',
   array['DENDA ERLANGGA', 'M.FAJAR MAULANA', 'ELVAN ARSYAVINE', 'M RIZALUL HAQ'],
   '087884243026', null),
  (87, 'SMKN 2 Ciamis', 'AGRESI 3', 'penegak_pa',
   'RIFKI MUHAMMAD SYAMSI',
   array['MUHAMAD MULQI HAJAZI', 'ARIS RIZKI FADILAH', 'FAZRIN FADRIYANSYAH', 'ANDIKA SYIFA NURROHMAN'],
   '087884243026', null),
  (88, 'SMAN 2 Ciamis', 'KECEBONG', 'penegak_pi',
   'Lisna nurinayah',
   array['Almira firdiani cahya', 'Annabella Raina syaban', 'Dara safittri Azzahra', 'Raisya setya'],
   '082262634124', 'Nurislah'),
  (89, 'SMKN 1 Banjar', 'SATRIA CAKRAWALA', 'penegak_pa',
   'SEPTIAN ABDURAHMAN',
   array['DAVA AZIZ NURRAHMAN', 'MOHAMAD FACHRY SEPTIAN RAMDANI', 'DANDI JULIANA NUGRAHA', 'ERIX PRASETYO NUGRAHA'],
   '082320615528', null),
  (90, 'SMKN 1 Banjar', 'PUTRI KANJEUNG', 'penegak_pi',
   'YUDITH DWI ARYANI',
   array['PUPUT MELATI AMELINA', 'ZAHRATU SIPA', 'DINDA AULIA', 'TIARA OKTAVIANI'],
   '082320615528', null),
  (91, 'SMKN 1 Banjar', 'CAKRA DYNATA', 'penegak_pa',
   'DHINAR DHIYAAUL HAQ',
   array['RAYHAN AKBAR ENDRIANSYAH', 'IKHSAN SURYA NUGRAHA', 'MUHAMMAD AZRIL GINANJAR', 'REHAN NUR''ALAMSYAH'],
   '082320615528', null),
  (92, 'SMKN 2 Ciamis', 'CAKRA 2', 'penegak_pi',
   'Silfa Aima',
   array['Zulfa Fauziah', 'Syifa Apriliani Padila', 'Asila', 'Wulan Nurfadila'],
   '08112113126', 'Dewy Ariyanti'),
  (93, 'SMKN 1 Banjar', 'ROYAL RANGERS', 'penegak_pi',
   'DIAH AYU LESTARI',
   array['NOVI YULIANI', 'ELA SETIAWATI', 'AIRIN ASY SYIFA', 'ALFIANA NUR MAHMUDAH'],
   '082320615528', null),
  (94, 'SMAN 2 Ciamis', 'WIRA KENCANA', 'penegak_pa',
   'Rafka Aditia Dariyat',
   array['Risqy Azhar Fadhilah', 'Sazki Syifaur Rohim', 'Zahran Izyan Ahmad Luthfii', 'Moch Rafa Fadillah'],
   '081222948065', null),
  (95, 'SMAN 2 Ciamis', 'PABUDU', 'penegak_pi',
   'Dewi Sri Juliya',
   array['Ita Nursipa Hidayati', 'Keysha Fiarrayyan Rahmadani', 'Tuti Aiynul Hamdiyah', 'Aurel Putri Andani'],
   '082262634124', null),
  (96, 'SMKN 2 Ciamis', 'AGRESI 2', 'penegak_pa',
   'ANDRA ALTAVIAN',
   array['ZAKI MUBAROK', 'M.HUSNI PUTRA PRATAMA', 'RIZKY FADIEL MAULANA', 'AZMI NAILFAHD'],
   '087884243026', null),
  (97, 'SMAN 2 Ciamis', 'PURBALINGGA', 'penegak_pa',
   'Rikza Haikal Ainursyam',
   array['Rizki Rauffaturohman', 'Arif Farhan Nulhakim', 'Ahmad Hidayat Nurul Akbar', 'Lintang Faishal Alfikri'],
   '081222948065', null),
  (98, 'SMAN 1 Cihaurbeuti', 'LAKSAMANA MALA HAYATI', 'penegak_pi',
   'Sry Fanny Agustin',
   array['Nayla Salsabila', 'Alifia Tiara Sakhi', 'Heisya Putri Juani', 'Dilla Azzahra'],
   '085246366971', 'Kak Nina'),
  (99, 'SMAN 1 Cihaurbeuti', 'PRABU SILIWANGI', 'penegak_pa',
   'Fathir Hasya Al khalifi',
   array['Syafiq Muhammad Fauzi', 'Yandi Muhammad Hamzah', 'Sandi nur Aziz', 'Muhammad Syauqi Ebany Alzam'],
   '085246366971', 'Kak Nina'),
  (100, 'SMAN 3 Ciamis', 'WONDAMA', 'penegak_pa',
   'Hasbi aviona',
   array['Dafin adilla putra perdana', 'Ilham maulana', 'Marshya tri maulana', 'Septian Alam Ramadhan'],
   '082317958637', null),
  (101, 'SMPN 3 Baregbeg', 'ELANG HITAM', 'penggalang_pa',
   'MUHAMMAD IQBAL AL FIKRI',
   array['SANDI KHOERURRIZKI AMMRULLAH', 'IQBAL KHARISMA JULIANA', 'WILDAN MUHAMMAD MUHTAR', 'DANI PERMANA'],
   '081224915746', null);

-- ---------------------------------------------------------------------------
-- Sekolah yang belum ada dibuat di sini. Pencariannya lewat kunci_sekolah()
-- supaya ejaan yang beda tanda baca mendarat di baris yang sama, dan alamat
-- yang sudah ada TIDAK ditimpa (runbook bagian 12.1).
-- ---------------------------------------------------------------------------
create temporary table impor_sekolah (nama text primary key, alamat text not null);

insert into impor_sekolah (nama, alamat) values
  ('MA Bahrul Anwar', ''),
  ('MA IPHI Pamarican', ''),
  ('MA Mujahidin', ''),
  ('MA Sirnarasa', ''),
  ('MTs Al-Hasan Banjarsari', ''),
  ('MTs Bahrul Anwar', ''),
  ('MTs Mujahidin', ''),
  ('MTsN 1 Ciamis', ''),
  ('SMA IT Nurul Huda', ''),
  ('SMAN 1 Baregbeg', ''),
  ('SMAN 1 Cihaurbeuti', ''),
  ('SMAN 1 Kawali', ''),
  ('SMAN 1 Panawangan', ''),
  ('SMAN 1 Sukadana', ''),
  ('SMAN 2 Ciamis', ''),
  ('SMAN 3 Ciamis', ''),
  ('SMK As-Sulthoniah', 'Dusun Desa RT 014/007, Jalatrang, Kec. Cipaku, Kab. Ciamis, Jawa Barat'),
  ('SMKN 1 Banjar', ''),
  ('SMKN 1 Rancah', ''),
  ('SMKN 2 Ciamis', ''),
  ('SMPN 1 Ciamis', ''),
  ('SMPN 1 Cikoneng', ''),
  ('SMPN 1 Cimaragas', ''),
  ('SMPN 1 Cipaku', ''),
  ('SMPN 1 Kawali', ''),
  ('SMPN 2 Kawali', ''),
  ('SMPN 3 Baregbeg', ''),
  ('SMPN 3 Kawali', '');

do $blok$
declare
  v_s   record;
  v_ada uuid;
  v_n   integer := 0;
begin
  for v_s in select * from impor_sekolah order by nama loop
    select id into v_ada from sekolah
     where kunci_sekolah(name) = kunci_sekolah(v_s.nama);
    if v_ada is null then
      insert into sekolah (name, address) values (v_s.nama, v_s.alamat);
      v_n := v_n + 1;
      raise notice '0129: sekolah baru - % <%>', v_s.nama, v_s.alamat;
    end if;
  end loop;
  raise notice '0129: % sekolah baru dibuat.', v_n;
end;
$blok$;

-- ---------------------------------------------------------------------------
-- Satu pendaftaran per baris form, beserta regunya.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_f     record;
  v_batch uuid;
  v_kode  text;
  v_sek   uuid;
  v_kunci uuid;
  v_baru  integer := 0;
  v_lewat integer := 0;
begin
  for v_f in select * from impor_form order by baris loop
    v_kunci := md5('hrcd-xxxvii-form-' || v_f.baris)::uuid;

    if exists (select 1 from pendaftaran where kunci_kirim = v_kunci) then
      v_lewat := v_lewat + 1;
      continue;
    end if;

    select id into v_sek from sekolah
     where kunci_sekolah(name) = kunci_sekolah(v_f.sekolah);
    if v_sek is null then
      raise exception '0129: sekolah % tidak ketemu setelah dibuat', v_f.sekolah;
    end if;

    loop
      v_kode := 'HRCD' || edisi_aktif() || '-' ||
                upper(substr(md5(gen_random_uuid()::text), 1, 6));
      exit when not exists (select 1 from pendaftaran where kode_pembayaran = v_kode);
    end loop;

    insert into pendaftaran (sekolah_id, kode_pembayaran, butuh_barak,
                             jumlah_menginap, jumlah_regu, kontak_wa,
                             kunci_kirim, nama_kontak)
    values (v_sek, v_kode, false, 0, 1, v_f.kontak_wa, v_kunci, v_f.nama_kontak)
    returning id into v_batch;

    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan, anggota)
    values (v_batch, v_f.nama_regu, v_f.nama_ketua, v_f.golongan,
            nullif(v_f.anggota, '{}'));

    v_baru := v_baru + 1;
  end loop;

  raise notice '0129: % pendaftaran dibuat, % dilewati karena sudah ada.',
    v_baru, v_lewat;
end;
$blok$;

-- ---------------------------------------------------------------------------
-- Pagar: yang dihitung bukan "migrasi berjalan" melainkan seratus baris form
-- itu benar-benar punya regunya di database. Menjalankan ulang harus
-- menghasilkan angka yang sama persis.
-- ---------------------------------------------------------------------------
do $blok$
declare v_n integer;
begin
  select count(*) into v_n
  from impor_form f
  join pendaftaran d on d.kunci_kirim = md5('hrcd-xxxvii-form-' || f.baris)::uuid
  join regu r on r.pendaftaran_id = d.id
  where r.nama_regu = f.nama_regu and r.golongan = f.golongan;

  if v_n <> (select count(*) from impor_form) then
    raise exception '0129: % dari % baris form tidak punya regu yang cocok',
      (select count(*) from impor_form) - v_n, (select count(*) from impor_form);
  end if;
  raise notice '0129: % baris form terpasang lengkap.', v_n;
end;
$blok$;

drop table impor_form;
drop table impor_sekolah;
