-- ============================================================================
-- hrcd-rekap : 0136_tanggal_daftar_dari_form.sql
--
-- Menyamakan TANGGAL DAFTAR di layar Data Peserta dengan Timestamp di jawaban
-- Google Form, dan menyegarkan nama ketua serta anggota dari kiriman TERAKHIR
-- tiap regu.
--
-- ---------------------------------------------------------------------------
-- KENAPA TANGGALNYA SALAH SEMUA
--
-- `pendaftaran.created_at` terisi saat BARISNYA DIBUAT di database, bukan saat
-- pembina menekan Kirim. Seluruh pendaftaran yang masuk lewat impor karena itu
-- bertanggal hari impornya dijalankan — 28 Agustus, jam yang sama untuk
-- ratusan baris — sementara yang sebenarnya tersebar dari 21 sampai 28
-- Agustus. Kolom yang seharusnya menjawab "siapa mendaftar lebih dulu" tidak
-- menjawab apa pun.
--
-- ---------------------------------------------------------------------------
-- YANG DISENTUH, DAN YANG TIDAK
--
--   created_at   diganti Timestamp form
--   nama_ketua   diganti isi kiriman TERAKHIR
--   anggota      diganti isi kiriman TERAKHIR
--
--   nama regu    TIDAK. Sebagian sudah diganti panitia untuk memecah tabrakan
--                nama, dan mengembalikannya ke nama form akan membuat dua regu
--                bernama sama — persis yang dicegah indeks regu_nama_unik.
--   sekolah      TIDAK. Ia kunci pencarian di banyak layar, dan ejaan di form
--                bukan sumber kebenarannya (runbook bagian 1).
--   golongan     TIDAK. Ia menentukan harga dan blangko; salah golongan bukan
--                salah ketik.
--   kontak       TIDAK. Panitia sudah membetulkan sebagian lewat layar Data
--                Peserta, dan menimpanya berarti membuang pekerjaan itu.
--
-- Keputusan pemilik acara, 28 Agustus 2026.
--
-- ---------------------------------------------------------------------------
-- "KALAU ADA YANG SAMA, PAKAI YANG TERAKHIR"
--
-- Dua belas nama muncul lebih dari sekali di form, dan keduanya BUKAN hal yang
-- sama:
--
--   enam KIRIMAN ULANG    nama dan sekolahnya sama — pembina mengirim dua kali,
--                         kadang dengan ketua yang berbeda. Yang dipakai baris
--                         TERAKHIR, dan itulah aturan yang diminta.
--   enam TABRAKAN NAMA    nama sama, sekolah BERBEDA — dua regu yang berlainan
--                         yang kebetulan menamai diri sama. Bukan duplikat, dan
--                         tidak boleh dilebur.
--
-- Tabrakan itu sudah diselesaikan lebih dulu oleh panitia dengan mengganti
-- nama salah satunya. Karena itu 13 regu di bawah dicocokkan lewat
-- NOMOR BARIS yang ditulis tangan, bukan lewat namanya: nama di database sudah
-- tidak sama dengan nama di form. Yang menemukan pasangannya nama KETUA —
-- satu-satunya yang tidak ikut berubah saat regunya diganti nama.
--
-- ---------------------------------------------------------------------------
-- LIMA BARIS FORM SENGAJA DILEWATI
--
-- Baris berikut tidak punya regu di database sama sekali, dan TIDAK diimpor di
-- sini — keputusan pemilik acara: mengimpor di tengah acara berisiko
-- melahirkan regu kembar dengan yang sudah masuk lewat jalur lain.
--
--   baris 108  Sakura                SMP IT MD Fathahillah  (kiriman pertama,
--                                    sudah diwakili sakura 1/sakura 2)
--   baris 111  Rajawali              SMP IT MD Fathahillah  (idem)
--   baris 105  Cakrawala             SMA 1 Sindangkasih     (idem)
--   baris 117  Wiraga (...)          SMPN 2 Ciamis          (idem)
--   baris 150  Griya Wesi Jaya       SMK LPS 1 Ciamis       — BELUM ADA sama
--              sekali: tidak ada sekolah maupun regunya di database. Ini yang
--              perlu ditindaklanjuti panitia.
--
-- Empat yang pertama sebenarnya SUDAH terpakai lewat tabel rename di atas;
-- yang benar-benar tertinggal cuma Griya Wesi Jaya.
--
-- ---------------------------------------------------------------------------
-- AMAN DIJALANKAN ULANG
--
-- Seluruhnya UPDATE dengan nilai tetap yang dihitung dari berkas form, bukan
-- dari keadaan database. Menjalankannya dua kali menulis nilai yang sama.
--
-- Nama yang tidak ketemu TIDAK menggagalkan migrasi — ia dilaporkan lewat
-- raise notice. Database uji dan produksi tidak memuat regu yang sama persis
-- (dev punya baris uji, produksi punya pendaftaran lewat form), dan migrasi
-- yang berhenti karena satu nama tidak ada akan menahan 145 baris lain yang
-- benar.
-- ============================================================================

create temporary table sinkron_form (
  nama_kunci text primary key,
  baris      integer not null,
  waktu      timestamptz not null,
  ketua      text not null,
  anggota    text[]
);

insert into sinkron_form (nama_kunci, baris, waktu, ketua, anggota) values

  ('agrema', 30, '2026-08-24 13:31:50.484000+07', 'ICHA HAPIPAH',
   array['AISYATUL HUSNA', 'KIKI AZA AMELIA', 'ATIKA BALQIS AZIZAH', 'RAHMA AZILA PUTRI']),
  ('agresi 1', 86, '2026-08-27 17:49:49.616000+07', 'EQBAL FARIS AL-GHIFARI',
   array['DENDA ERLANGGA', 'M.FAJAR MAULANA', 'ELVAN ARSYAVINE', 'M RIZALUL HAQ']),
  ('agresi 2', 96, '2026-08-27 20:41:12.296000+07', 'ANDRA ALTAVIAN',
   array['ZAKI MUBAROK', 'M.HUSNI PUTRA PRATAMA', 'RIZKY FADIEL MAULANA', 'AZMI NAILFAHD']),
  ('agresi 3', 87, '2026-08-27 18:01:06.607000+07', 'RIFKI MUHAMMAD SYAMSI',
   array['MUHAMAD MULQI HAJAZI', 'ARIS RIZKI FADILAH', 'FAZRIN FADRIYANSYAH', 'ANDIKA SYIFA NURROHMAN']),
  ('agresi 5', 123, '2026-08-28 11:02:08.355000+07', 'MUHAMMAD RIZKI PRATAMA',
   array['MUHAMMAD NU''MAN BAEHAQI', 'SAHRUL AFRIANSYAH', 'LUTPIANSYAH', 'ALDI NUGRAHA']),
  ('alamanda', 7, '2026-08-22 10:19:55.721000+07', 'SANI AULIA RAMADHAN',
   array['ALYA NUR NABILAH', 'MESYA ROSLIANI', 'SINTYA NUR AMANAH', 'SITI MAESAROH']),
  ('anyelir', 27, '2026-08-24 13:24:49.414000+07', 'Alexandriani Siratuyunin',
   array['Silvi Nuraeni', 'Dara Nukeu Pebrianti', 'Sri Putri Lestari', 'Andin Keisya Putri']),
  ('argantara', 121, '2026-08-28 10:57:52.280000+07', 'RAIYA AWALIYA',
   array['ARIENINDYA KIRANA PUTRI', 'ASHFA ATQIYA ADEEVAH', 'ZIVARA SARINA MAULIDA', 'FADYA RAFIFATU RIFDA']),
  ('aster', 9, '2026-08-22 10:33:47.414000+07', 'SOLIHATUNNISA',
   array['KESYA SHLAAWATI', 'NATASYA ASYIFA PUTRI', 'AYRA RAHMA JULIYANTI', 'SYIFATUL KAMILAH']),
  ('aster pradoeka', 6, '2026-08-22 05:33:10.614000+07', 'Fitya Najiyah Rahmadan',
   array['Salsa Syakila Zahra', 'Agni Nurhasanah', 'Zahira', 'Widad Dwi Razwanti']),
  ('astra jingga', 66, '2026-08-26 22:07:27.051000+07', 'AZMI ZAIDAN ZS',
   array['AKBAR PURNAMA S', 'M ILHAM S', 'RANDHIKA M FAUZI', 'AHMAD HIDAYAT']),
  ('avarsa', 26, '2026-08-24 13:23:34.633000+07', 'Indah Nurhusna',
   array['Haira Salsyabila', 'Tiara Qianisa Putri', 'Nurul Meilahafifah', 'Sinta Nuraini']),
  ('bancet hejo', 60, '2026-08-26 19:23:01.522000+07', 'Asep Nugraha',
   array['Fauzian Rizki Firdaus', 'Muhammad Rafli', 'Arif Rahman Firdaus', 'Damar Wulan Wijaya']),
  ('bangkong luncat', 32, '2026-08-24 14:07:51.658000+07', 'Anil Nirwana Juniar',
   array['Adhitya Afrilianto Gunawan', 'Yuda Prasetiyo', 'Aan Nurfaturohman', 'Miptah Parid']),
  ('banteng', 37, '2026-08-24 22:20:05.344000+07', 'SYAFIQ ARIEF NUGRAHA',
   array['ZAKIY MUHAMMAD TAZKIYYA', 'MUHAMAD RIFKI', 'ADITIA DWI PUTRA', 'DADANG DARUSMAN']),
  ('bougenvile', 23, '2026-08-22 13:43:39.574000+07', 'Shafa Milana Anggraeni Setiawan',
   array['Novidha Anastasya Putri', 'Azkiya Kirey Anzio', 'Agnya Nur Fadillah', 'Syifa Zakiyya Filardha Razqi']),
  ('buaya putih', 118, '2026-08-28 10:15:26.320000+07', 'Naisya Siti Nurfadilah',
   array['Tsania Miladia Rahma', 'Jenisya Halwani', 'Azzahra Agustina', 'Zyhara Nurul Fadillah']),
  ('bunga patroman', 145, '2026-08-28 14:04:23.058000+07', 'Aulia Ramadhani Putri',
   array['Nabila Rizqia Rahmat', 'Davina Dzikra Nurfawwaza', 'Naura Anindya Putri', 'Tasya Tanti Apriliani']),
  ('bunga telang', 36, '2026-08-24 19:40:48.792000+07', 'Adzkya Qanayya Rakhmat Mulyana',
   array['Rd.roro edlyn elgiva w.', 'Ica cahyani', 'Anisya''ban Khoirul anam', 'Chika ayunda rahma']),
  ('cakra 1', 75, '2026-08-27 15:05:46.631000+07', 'Syifa Khoerunisa',
   array['Sifa Januarista', 'Agni Nurul Jannah', 'Nur Farjanah', 'Annisa Wulandari']),
  ('cakra 2', 92, '2026-08-27 19:04:21.789000+07', 'Silfa Aima',
   array['Zulfa Fauziah', 'Syifa Apriliani Padila', 'Asila', 'Wulan Nurfadila']),
  ('cakra 3', 112, '2026-08-28 08:34:33.599000+07', 'SHEYLA FITRI YANI',
   array['RISKA AMELIA', 'NOVITA AYU WILDANINGSIH', 'NUR ASYFA YULIANTI', 'FREYA ZHAFIRAH MAULANA']),
  ('cakra 4', 81, '2026-08-27 16:00:20.252000+07', 'Aira Nanda Heraldine',
   array['Siska Aulia', 'Nova Nuraeni', 'Salsa Rahmawati', 'Lisna Setiawati']),
  ('cakra dwipa', 133, '2026-08-28 11:15:52.970000+07', 'RADIKA ATAYA PUTRA ESTETIA',
   array['RAJJU ARIANSYAH', 'IRSANDI AWALLUL FALAH', 'FIKRI ANUGRAH', 'MUHAMMAD FAHRI ADITYA']),
  ('cakra dynata', 91, '2026-08-27 19:02:40.993000+07', 'DHINAR DHIYAAUL HAQ',
   array['RAYHAN AKBAR ENDRIANSYAH', 'IKHSAN SURYA NUGRAHA', 'MUHAMMAD AZRIL GINANJAR', 'REHAN NUR''ALAMSYAH']),
  ('cakra nusa', 24, '2026-08-24 07:26:11.055000+07', 'MUHAMMAD FIKRI PRATAMA',
   array['ABDAN NASIR BAHRAWI', 'HILMY FARRAS FATIH', 'MUHAMMAD RIZQY ATTALA ROSADI', 'MUHAMMAD ZUFAR FAIQ K']),
  ('cakrawala sindangkasih', 105, '2026-08-28 06:55:51.590000+07', 'Rani Nurhayati',
   array['Meyra Nurmawati', 'Khilda Hana Hanifa', 'Fuji Rahmawati', 'Tasyaa Aisil Gina']),
  ('cakrawira', 144, '2026-08-28 14:03:09.519000+07', 'IKBAL MAULANA',
   array['MUHAMMAD FAUZAN KAMIL MUBAROK', 'ADE ILHAM FATHUL BARRI', 'ALDI AKBAR FIRMANSYAH', 'RIZKY DENDY RAMADHAN']),
  ('camelia', 8, '2026-08-22 10:28:59.724000+07', 'DIANDRA ANNISA NAWA NUGRAHA',
   array['HILDA HIDAYAH', 'KHANZA HUMAIRA BILQIS', 'SILVI MAULIDA', 'ZAHRA NUR AZIZAH']),
  ('caracal', 10, '2026-08-22 10:41:14.665000+07', 'DESTA AKSIOMA MUSTOFA',
   array['MUHAMMAD FAUZAN AL GHIFARI', 'DYAN RACHMAT KOMARI', 'MUHAMMAD NAUFAL ARIF ADISANTIKA', 'GILANG FERDIANSAH RAMADAN']),
  ('cendana', 41, '2026-08-25 12:47:17.503000+07', 'desy wulanika',
   array['lyris Khoirunnisa', 'nuryza aprilyani', 'decha fadillah shilvana', 'nida aulia']),
  ('cendana b', 69, '2026-08-26 22:17:20.054000+07', 'IRNA INDAH HAYATI',
   array['WITRI SALSA R', 'DINI WAHYUNI', 'ZIHAN HASYRI A', 'HUSNA CHOIRUN N']),
  ('cendrawasih', 126, '2026-08-28 11:09:30.324000+07', 'ADE'' YUSUF MAULANA',
   array['REZKI ARDIANSYAH.H', 'DIAN NUGRAHA', 'FAJAR NURSIDIK', 'ALFAN ALIANDANA']),
  ('citraresmi', 56, '2026-08-26 18:25:49.844000+07', 'ADINDA SYAIMA RAIHANUNNISA',
   array['SALSABILA SETIANI', 'ISTI AGUSTIN', 'NAZWA ASRIAH KUSNADI', 'HILDA NUR AISAH']),
  ('coboy geulis pasundan', 19, '2026-08-22 12:42:22.975000+07', 'ZAHIRA NURUL ''AINI',
   array['RARA FANY FAUZIAH', 'NAIRA SYAHLA AJAHRA', 'MALA NURULFADILAH', 'HILYANI RAISA SUCIANI QOLBY']),
  ('crazy boys', 18, '2026-08-22 12:34:25.853000+07', 'ALBANI MUHAMMAD NASIR',
   array['YAZID FATHUROHMAN MUBAROK', 'MUHAMAD BARIZ HIELMI', 'DAFIAN APRILIO', 'DEFASA SATRIA MAULANA']),
  ('dewi lara', 59, '2026-08-26 18:59:56.321000+07', 'IIS ISTIANAH',
   array['ALLISTYA RAIYA RAMAWATI', 'HAIFA NUR FADILA', 'DZALFA FATIMATUL KAMILA', 'RAISYA CAMEELA EL MAHROM']),
  ('dewi umma', 57, '2026-08-26 18:38:24.518000+07', 'AKILA LATIFA SYAWALIAH',
   array['FRANSISCA INDRIYANI', 'NASYWA LAILATUL HUSNA', 'ADINDA RIZQYATUL MUBAROKAH', 'TINA AMELIA RAHMA']),
  ('edelweis', 73, '2026-08-27 12:02:51.492000+07', 'Apwa Maupatul Pauzah',
   array['Syarah Heryani', 'Shalwa Nurul Hidayah', 'Deasifa Damayanti', 'Mutiara Ardilah Nurfala']),
  ('edelweis a', 4, '2026-08-21 18:00:01.708000+07', 'AYUNIA CHARLIANTI',
   array['DEBIYLA ZAHRA MEYFA', 'SYIFA NUR LATIFAH', 'DINARA SYAFIRA', 'SABILA NILNAMUNA']),
  ('edelweis b', 35, '2026-08-24 19:17:07.802000+07', 'Nindia putri juniar',
   array['Salsabila Juliani', 'Fina jaoharotul huda', 'Nita', 'Rifa Salma azahra']),
  ('edelweis cisaga', 107, '2026-08-28 07:36:01.175000+07', 'Richy Meranti Pratiwi',
   array['Keyla Suci Aprilia', 'Delista Solihah', 'Nindy Pratiwi', 'Nayla Julia Puspita']),
  ('edelwist', 138, '2026-08-28 12:58:35.793000+07', 'Syahla Ardelia Arjani Sanjaya',
   array['Zivanna Elite Fathihatus Silmy', 'Zaskia Rahmania Aprilianty', 'Azka Almira Rahmania', 'Alya Nailil Amni Azizah']),
  ('el - faqih', 85, '2026-08-27 16:35:56.721000+07', 'Naufal Ari Fahreza',
   array['Ihsan Maulana', 'Rahmat Khoyrur Rizqi', 'Raihan Amdar Kanastren', 'Adelpi Rosadi']),
  ('elang', 5, '2026-08-21 18:45:50.402000+07', 'HAZIQ ARYA PRATAMA',
   array['WILLY ALFIKRI', 'MUHAMMAD DZIKRI MAULANA', 'ADAM GHANI KAUTSAR', 'MUHAMMAD HASBI ABDILLAH']),
  ('elang hitam', 101, '2026-08-27 23:00:55.415000+07', 'MUHAMMAD IQBAL AL FIKRI',
   array['SANDI KHOERURRIZKI AMMRULLAH', 'IQBAL KHARISMA JULIANA', 'WILDAN MUHAMMAD MUHTAR', 'DANI PERMANA']),
  ('elang hitam cipaku', 124, '2026-08-28 11:06:31.856000+07', 'MUHAMMAD RAIHAN FATHUSYIDQI',
   array['HAFIZ FIRDANSYAH', 'ZAQI WIJAYAKUSUMAH', 'AZRIEL APRIANSYAH', 'MALIK NUROHMAN']),
  ('ex garuda', 51, '2026-08-26 10:09:51.283000+07', 'AGUNG AKBAR SIDIK',
   array['FAHRI FAIZ FARHANI', 'MUHAMMAD SAEFUL DAFA', 'IHSAN NASULLOH', 'NYCEP YUDISTIRA']),
  ('fearis stepss', 122, '2026-08-28 10:59:59.810000+07', 'ZAHWA ANAYA KEYSHA',
   array['CYRIL ELLIORA RAQIYA', 'SHOFIYATUL MECCA ADWA', 'GHINA MUTIARA HAFSA', 'IZZA NURFAAKHIRA']),
  ('garuda', 2, '2026-08-21 16:40:28.087000+07', 'YOKI RAMADHI',
   array['ALDI AMU MUROZAQ', 'MAHER GIBRAN ALGHIFARY', 'DIKA NURPRADANA', 'KAMAJAYA SUKMA PAWITRA']),
  ('garuda cipaku', 74, '2026-08-27 12:04:36.506000+07', 'Fathan Fadlika Maulidan',
   array['Muhamad Adrian Putra Khoeruman', 'Muhammad Rafi Nurohmat', 'Fery Marwan Septian', 'Arfandi Khairul Adam']),
  ('garuda sindangkasih', 104, '2026-08-28 06:49:51.887000+07', 'Ridwan Akbar Hilabi',
   array['Adrian Dwika Cahyono', 'Rendi Nugraha', 'Rafi Wafa Fadilah', 'Ramjan Fauzan']),
  ('griya wesi jaya', 150, '2026-08-28 14:55:16.601000+07', 'Azka Mugia Bagja',
   array['Muhammad Rizky Prasetya', 'Muhamad Husni Farihi', 'Fahri Tria Fauzi', 'Raffa Muhamad Ilham']),
  ('gundal gandil', 34, '2026-08-24 14:24:13.419000+07', 'Dika nugraha',
   array['Evan rofiqulvian', 'Haikal hamdi', 'Raka nurcahya fadila', 'Aditya muhamad dafa']),
  ('heulang heuay', 141, '2026-08-28 13:16:52.408000+07', 'Muhammad Zaidan Aldaffa Abdullah',
   array['Muhammad Wildan Fajri', 'Fathir Rahman Ghifari', 'Fitra Faiq Angkasa', 'Arsyad Ghani Wardana']),
  ('jaga galuh', 114, '2026-08-28 10:02:40.645000+07', 'Noviana Safitri',
   array['Tesa Trijaya', 'Annisa Marsha Putri', 'Gelsi Fatysha Putri Eriane', 'Lulu Asy-Syifa Arraniry']),
  ('jaguar wisesa', 22, '2026-08-22 13:14:21.578000+07', 'Muhammad Fakhri Nizam Ali',
   array['Devaleskha Tysta Khalfani', 'Nanda Nektar An-Nahl', 'Raqilla Idraki Lattanzio', 'Taufik Khoirul Fajar']),
  ('jalak dewata', 17, '2026-08-22 12:33:01.513000+07', 'Dimas Bagja Ar Rasyid',
   array['Achmad Rizal Mutaqin', 'Athif Falihul Faiq Cherdiana', 'Rafka Rafasya Pratama', 'Rizqi Adhitya Pramudita']),
  ('joko tingkir', 64, '2026-08-26 21:58:12.539000+07', 'AGNI M ABDU ROSID',
   array['AHMAD JAELANI', 'EFILIAN ILHAM R', 'M RIZQI ZIYAD S', 'ARROFI SIHABUL M']),
  ('kaum gabut', 33, '2026-08-24 14:21:57.544000+07', 'MUHAMMAD AZKA AULIA',
   array['FAUZAN ZULKIFLI HASAN', 'ADITYA MUHAMMAD REZKY', 'RENO MEIZA ADRIAN', 'TEMMY TRI AWALUDIN']),
  ('kecebong', 88, '2026-08-27 18:04:10.058000+07', 'Lisna nurinayah',
   array['Almira firdiani cahya', 'Annabella Raina syaban', 'Dara safittri Azzahra', 'Raisya setya']),
  ('kecet kecet', 48, '2026-08-25 20:52:42.862000+07', 'Azam Muhammad Zildan',
   array['Eka Julian Pratama', 'Adi Febrian', 'Restu Agustian', 'Satria Daffa Yunansyah']),
  ('kenanga', 82, '2026-08-27 16:01:06.586000+07', 'EUIS SITI NURROHMAH',
   array['SINTA SAMSIATU ROHMAH', 'RATIH QIBTYAH H', 'NISWAH KHOIROTUN H', 'NAZMI GILDA A']),
  ('khong guan', 135, '2026-08-28 11:19:06.858000+07', 'GALANG AZZAM ASH-SHIDDIQY',
   array['FAAIQ ZULFAHMI AZZAM', 'ANDI MUHAMMAD THARIQ ATHAYA', 'MASHDAR MANSHURIAH ADNAN', 'MUHAMMAD DIRA TSAQIIF']),
  ('kirana', 76, '2026-08-27 15:26:43.701000+07', 'RIKA NUR AYUNINGSIH',
   array['AMELIA BUNGA SAFITRI', 'YENI NURA''ENI', 'YASMIN PUTRI KHUMAIRAH', 'RAHMAWATI']),
  ('komodo', 116, '2026-08-28 10:10:42.012000+07', 'M Faizal Mubarok',
   array['M Zaidan Faqih Al Hawari', 'Faisal Nur Alam', 'Shofar Yanuar Akbar', 'Muhammad Rafka Zaelani']),
  ('kopdes', 134, '2026-08-28 11:16:51.982000+07', 'AZKA ALIYAN HIDAYAT',
   array['GHIFARI RAHMAD GHANI', 'IRFAN YAHDI ISKANDAR SALEH', 'BARA DZAKI HIDAYAT', 'GRANADA SULTHAN MUHAMMAD']),
  ('laksamana mala hayati', 98, '2026-08-27 21:03:08.603000+07', 'Sry Fanny Agustin',
   array['Nayla Salsabila', 'Alifia Tiara Sakhi', 'Heisya Putri Juani', 'Dilla Azzahra']),
  ('laskar tani', 65, '2026-08-26 22:03:14.901000+07', 'YUDA KAMIL P',
   array['M HUSNI MUBAROK', 'AHMAD FAUZI GIBRAN', 'IRFAN MAULIDI', 'FABBY NUR AKMAL J']),
  ('lima elang berani', 44, '2026-08-25 13:54:26.631000+07', 'FIRDIAN MAULANA',
   array['SEPTA DWINUGRAHA PUTRA', 'FAQIH DHIYAULHAQ SYAHPUTRA', 'AZKA N. ARIFIN', 'ADE AGUSTIANA']),
  ('lima elang cerdik', 45, '2026-08-25 13:58:28.318000+07', 'KAFFA FAWWAZ AL TAMIS',
   array['DIFFA NAFIZ AUFAR', 'AGUNG IKHWAN NAFIZ', 'TAUFAN ADZIM H. FAYYAZ', 'RAFFA ADYTIA NUGRAHA']),
  ('lima elang gagah', 43, '2026-08-25 13:51:25.687000+07', 'GALIH PURNAMA RAMADHAN',
   array['FARDA RIDHO RAMADHAN', 'NURSIDIK RAMDANI', 'RAKHA SYAFIQ ABDULLAH', 'IRFAN HANDIANA']),
  ('lima elang tangguh', 42, '2026-08-25 13:48:36.167000+07', 'Nanda Najiullah Arham',
   array['Rafa Arkana Hamizan', 'Muhamad Fahri', 'M. Fazri Setiawan', 'Badri Maulana']),
  ('lima matahari cantik', 47, '2026-08-25 14:05:20.960000+07', 'CLARESA PUTRI SITI KHOJANAH',
   array['VERA NUR RAHAYU', 'DESWITA NADILA CANTIKA', 'AVISA TAZKIYATUN NISA', 'RAYA NURUL AKILA']),
  ('lima matahari hebat', 46, '2026-08-25 14:01:45.555000+07', 'REYSHA ALICE SALSABILA',
   array['NAYLA WULAN GERHANA', 'TASYA AULIYA NISAUZZAKIYAH', 'IZDIHAR SERIYUSLI', 'FITRI KHOIRUNNISA']),
  ('m.b.g', 132, '2026-08-28 11:14:34.605000+07', 'MOH. ADWITIYA',
   array['ARYA DWI PUTRA', 'M. NAFIS RAIHAN', 'AFZA CHOIRUL FATAA', 'HEGRIN MAHFUZH GEMAYEL']),
  ('macan gersang', 103, '2026-08-28 06:41:00.403000+07', 'Radit Mahmudi Raksadinata',
   array['Adib Fawwaz Elmumtaz', 'Andika Maulana', 'Maulif Zakki Algiffari', 'Muhammad Radithya Alfarobi']),
  ('manggala', 70, '2026-08-27 11:46:01.957000+07', 'Meylana Septiani',
   array['Nuraeni', 'Mega Aulis', 'Keisha Rahmadina', 'Anit Anita Tiarawati']),
  ('mario bross geulis', 16, '2026-08-22 12:27:02.859000+07', 'WINARNI NURRIZQIAH',
   array['SHINY QURRATU QALBI', 'SYAKIRA HASYA JANEETA', 'ALIN NAWAL K', 'PUTRI BILQIS']),
  ('matahari', 15, '2026-08-22 12:17:53.266000+07', 'ADIA RAFA FATHINA',
   array['PUTRI SALSABILA NUR AZIZAH', 'APRILIA PUTRI LESTARI', 'AQILA KAYALANI', 'NADYA GALUH MULYANI']),
  ('maung', 11, '2026-08-22 10:45:36.776000+07', 'ADITYA RAHMAN SAPUTRA',
   array['AGUS SUPRIATNA', 'DAFA BILFAQIH ABYAN', 'MAHESA PURTA ASUARI', 'PASYA FADILLA']),
  ('mentari stecu', 84, '2026-08-27 16:08:21.760000+07', 'NABILA NURFELLIA',
   array['AMIRAH HAIRANI SYARIEF', 'SILVI ANGGRAINI PUTRI', 'AIRA PUTRI AMARA', 'REGINA AULIA PUTRI']),
  ('molda', 28, '2026-08-24 13:26:19.564000+07', 'MEILANI AWALIYAH',
   array['OKTAVIANI AZZAHRA', 'LEANI INSANI PUTRI', 'DESPITA TRI HANDAYANI', 'SITI SALMAH KHAIRUNNISA']),
  ('mutiara timur', 102, '2026-08-28 05:33:02.566000+07', 'NAUFAL RAZIQ ATHAULLAH',
   array['ALIF AZIZ MUHAMMAD ILYAS', 'FATHAN NASRULLOH', 'MUHAMMAD ALPAN FAUZAN', 'ARYA MANGGALA']),
  ('narara', 50, '2026-08-26 10:00:40.655000+07', 'ATIA TUNNISA',
   array['SRI ASIH', 'KEYLA AZZAHRA PEBRIANTI', 'VIDYA WARDATUL ''AINI', 'NADIA INDRIANI']),
  ('navadikara', 136, '2026-08-28 12:13:16.680000+07', 'ALMA ASYOFI AULIA',
   array['SITI MELISA MAULIDA', 'LINA CAHLIANI', 'MEGA AGUSTIANI', 'YURIANI NURUL AZIZAH']),
  ('nebula', 49, '2026-08-26 08:32:14.423000+07', 'anisa nur syamsyah',
   array['Rahmawati Oktaviani', 'Sri Agustina', 'Amanda nafisa fitri', 'Laila nur fitriasari']),
  ('nebula cipaku', 130, '2026-08-28 11:11:21.266000+07', 'ASRI AWALIA',
   array['AULIA SRI FUJI', 'NADA NUR KAMILA', 'MELISA SALMA RAIHANA', 'TSALITSA ASTI RAINA']),
  ('ngabret', 29, '2026-08-24 13:26:56.888000+07', 'Imelda Yustanza',
   array['Zaskia Maulida', 'Shifa Nurul Aulia', 'Salsabila Azzahra', 'Anggun Alviani']),
  ('niskala', 31, '2026-08-24 13:41:53.355000+07', 'ISMAJATI',
   array['Sarah Aulya Zahra', 'Risnina Aprilia Diany', 'Risma Nur Afifah', 'Lulu Aulia Juniar']),
  ('niskala al-fadliliyah', 127, '2026-08-28 11:09:40.791000+07', 'ATHIRA ZAKIA',
   array['NISWATUN NAFI`AH', 'ZASKIA DINDA SULISTIA', 'ZELDA SASKIA SUDRAJAT', 'SYAKIRA AULIA HIFZHA AZKIYA']),
  ('pabudu', 95, '2026-08-27 20:02:11.094000+07', 'Dewi Sri Juliya',
   array['Ita Nursipa Hidayati', 'Keysha Fiarrayyan Rahmadani', 'Tuti Aiynul Hamdiyah', 'Aurel Putri Andani']),
  ('panca puspita', 14, '2026-08-22 12:05:59.834000+07', 'ADE RISMAYANTI',
   array['SITI MUDRIKAH', 'ANGGUN FEBBY ARIANY', 'SISKA VARLIANA PUTRI', 'ROSELLA']),
  ('paramita', 137, '2026-08-28 12:47:38.596000+07', 'Elpa Thiana',
   array['Shofa Attahliyah Qorihah', 'Agni Putri Anwar', 'Reivana Puspita Sekarwangi', 'Sofi Hernanda']),
  ('pasukan satria', 79, '2026-08-27 15:55:19.065000+07', 'ASEP MAULANA',
   array['AGIS RIADI H', 'FAISAL ABDUL H', 'AZKA DARMAWAN', 'NAJA ZAINURROHMAN']),
  ('piit bondol', 52, '2026-08-26 10:15:17.607000+07', 'MUHAMAD BAYU SETIAWAN',
   array['SHEVA FAUJAN HILMI', 'RO''UP SOLEHUDIN', 'RAUHAN HERDIANSYAH', 'IMAM NURJAMIL']),
  ('pikopi', 139, '2026-08-28 13:07:09.985000+07', 'Nasywa Janzabila',
   array['Aida Sabila Qurrota Aini', 'Dewi Latifatul Alawiyah', 'Zahra Laila Fadlilah', 'Azkiya Ramdhani Fauzi']),
  ('prabu siliwangi', 99, '2026-08-27 21:10:01.117000+07', 'Fathir Hasya Al khalifi',
   array['Syafiq Muhammad Fauzi', 'Yandi Muhammad Hamzah', 'Sandi nur Aziz', 'Muhammad Syauqi Ebany Alzam']),
  ('purbalingga', 97, '2026-08-27 20:46:49.818000+07', 'Rikza Haikal Ainursyam',
   array['Rizki Rauffaturohman', 'Arif Farhan Nulhakim', 'Ahmad Hidayat Nurul Akbar', 'Lintang Faishal Alfikri']),
  ('putri kanjeung', 90, '2026-08-27 18:54:20.075000+07', 'YUDITH DWI ARYANI',
   array['PUPUT MELATI AMELINA', 'ZAHRATU SIPA', 'DINDA AULIA', 'TIARA OKTAVIANI']),
  ('raflesia', 38, '2026-08-24 22:30:33.190000+07', 'BELA NURAENI',
   array['ZAHIRA SITI FATITUZZAHRO', 'KEISHA NUR QAIREEN', 'ADELLIA RAMADHANI FATIMAH', 'SAHIRA FARRAS GHAISANI']),
  ('rajawali', 110, '2026-08-28 07:57:50.933000+07', 'Muhammad Iqbal Maulana',
   array['Dzaky Mirza Setiawan', 'Hasby Mughni Ramadhan', 'Yuga Aditia Widianto', 'Muhammad Azhar Nur Maajid']),
  ('rajawali 1', 109, '2026-08-28 07:49:12.958000+07', 'Rifal Pramudya Hidayat',
   array['Riffat Nawfal Hidayat', 'Hasbi Nur Arif', 'Hisyam Aufa Rahman', 'Nova Novianto']),
  ('rajawali 2', 111, '2026-08-28 08:03:45.016000+07', 'Muhammad Iqbal Maulana',
   array['Dzaky Mirza Setiawan', 'Hasby Mughni Ramadhan', 'Yuga Aditia Widianto', 'Muhammad Azhar Nur Maajid']),
  ('ranggayunan', 55, '2026-08-26 17:34:33.522000+07', 'Rifki kosasih',
   array['Al Firyal Azhar', 'Ari Afrizal Nuryana', 'Daffa Khaerul Iman', 'Lionel Alfon Nicola']),
  ('ratu dewata', 58, '2026-08-26 18:46:14.548000+07', 'NUNIK NURSOBAH',
   array['DEWI ANDINI', 'RAHMA ANGGI WIGUNA', 'NAJLA RAISYA TSABITAH', 'NABILA LATHIFATUNNISA']),
  ('regu matahari b', 72, '2026-08-27 12:04:19.839000+07', 'Rifka Kayla azzahra',
   array['Luthfia Nur maulida', 'Raisya nurfadilah', 'Layla Nur fathonah', 'Raeesa amanda putri']),
  ('regu seraya', 61, '2026-08-26 20:39:43.257000+07', 'Kirana Ramadani Putri',
   array['Lisda Nurhidayah', 'Chelsea Kirana Maharani', 'Alya Haya Nafiisah', 'Maulida siti rundati']),
  ('rengganis', 125, '2026-08-28 11:06:49.283000+07', 'JULAIKA NUSANTARA QUEEN',
   array['HANAN HAFIDZAH HISAN', 'AFIKA NURKHOFIFAH SAMSURIJAL', 'DIANDRA AZZAHRA NOVIARI', 'TIARA RISKA SYA`BANI']),
  ('rhino', 25, '2026-08-24 11:57:24.002000+07', 'FANZI HAERUDIN',
   array['RAFKA MAULI RESTU SYAPUTRA', 'FADEL MUHAMMAD FAUZI', 'SUNAN ANGKAWIJAYA', 'RADITIYA RUHIYAT SAPUTRA']),
  ('rimba boy', 39, '2026-08-25 12:14:35.366000+07', 'ANGGI HENDRIANA',
   array['ARI MULYA GUMILAR', 'DENNIS ZAIDAN FATURRACHMAN', 'SANDRA MALIK', 'SHANDIKA FEBRIYANA']),
  ('rojali', 67, '2026-08-26 22:11:30.246000+07', 'M ZAIDAN A',
   array['ZIKRI MAULANA', 'ALDI ROSDIANSYAH', 'M AQIL ABDUL M', 'M RAVI NUR AZI']),
  ('romusa', 148, '2026-08-28 14:18:53.885000+07', 'Tresnawati Maulidia',
   array['Fitria Septiana', 'Seni Nur Septiani', 'Natara Qalbi Alfaathir', 'Qisty Aulia Anwar']),
  ('royal rangers', 93, '2026-08-27 19:10:22.187000+07', 'DIAH AYU LESTARI',
   array['NOVI YULIANI', 'ELA SETIAWATI', 'AIRIN ASY SYIFA', 'ALFIANA NUR MAHMUDAH']),
  ('sakura 1', 106, '2026-08-28 07:29:14.505000+07', 'Zakiyatun Nafsi',
   array['Annisa Miftahul Jannah F.S.', 'Silvi Nurfauziah', 'Ghaitsa Zahira Shofa', 'Aisy Zahra Ramadhani']),
  ('sakura 2', 108, '2026-08-28 07:38:31.615000+07', 'Ripa Nur Adawiah',
   array['Aliyya Septiani Az Zahra', 'Aisyah Rahmadani', 'Daniza Nur Alifa', 'Riffa Aldia Sya''bani']),
  ('sangga pendobrak', 113, '2026-08-28 09:41:21.239000+07', 'Ibnu Fadillah',
   array['Fadli Nabil Choiri', 'Revan Geraldi Putra', 'Muhammad Raditya Ilham', 'Nawfal Arkana Ikbar Fawwaz']),
  ('satria cakrawala', 89, '2026-08-27 18:37:35.202000+07', 'SEPTIAN ABDURAHMAN',
   array['DAVA AZIZ NURRAHMAN', 'MOHAMAD FACHRY SEPTIAN RAMDANI', 'DANDI JULIANA NUGRAHA', 'ERIX PRASETYO NUGRAHA']),
  ('satwika', 53, '2026-08-26 10:21:46.506000+07', 'DIAN SRI MULYANI',
   array['AULIA SALSABILA', 'RISMA', 'PUTRI SITI ATIAH', 'SUCI AYU LESTARI']),
  ('scarlet', 80, '2026-08-27 15:58:12.177000+07', 'AZZAM FADL ABQORY',
   array['HILMI NIZAR M', 'M YASIR AL-BANA', 'LU''LU ABDUL LATIF', 'DAES PADIL PRATAMA']),
  ('sekar widya', 68, '2026-08-26 22:14:27.304000+07', 'RINI FITRIANI',
   array['ISNA KAMALIATUL M', 'ROSA RIKA N', 'ZASKIA CAHYA', 'AIRA FITRI YANI']),
  ('sersant', 63, '2026-08-26 21:30:44.120000+07', 'ABDUL AZIZ RAMDANI',
   array['WILDAN HILMIANSYAH', 'GILANG RAMADAN', 'YOSEP DARMAWAN', 'WILDAN MAULANA HILMANSYAH']),
  ('singa jaya patroman', 142, '2026-08-28 13:56:07.682000+07', 'Chairul Fikri Mubarok',
   array['Raihan Daffa Pratama', 'Fadlan Azka Alfatih', 'Nabil Andiyusuf', 'Raesa Zidna Ilma']),
  ('singacala', 62, '2026-08-26 21:08:51.841000+07', 'ADIT RADITYA',
   array['RIZQY FEBRIAN ARRASYID', 'ANDIKA GEOPANO', 'PASHA MAULANA EL-HAQ', 'ZAMZAM MUBAROK UDHMA']),
  ('someah', 115, '2026-08-28 10:07:41.748000+07', 'Azkia Rahma Nadhifah',
   array['Khanza Aqilah Salsabila', 'Azkia Nurpadilah', 'Raisya Khairunnisa', 'Nela Guritno']),
  ('spartan scout 666', 147, '2026-08-28 14:08:42.846000+07', 'M.Dhieka Rahmat Ghazali',
   array['Muhammad Dzakwan Aushof', 'Muhamad Fakhrul Musyaffa', 'Fadlan Ikbalurrahman', 'Rafif Fauzan Athallah']),
  ('srikandi denim', 54, '2026-08-26 12:53:35.105000+07', 'ANNISA AMELIA QOLBI',
   array['RAINA ALMUKHSANATUNNISA', 'ADILA MAULIDA SANUSI', 'SITI SILKA KUMALA', 'YANTI KUMALA']),
  ('srikandi nusantara', 151, '2026-08-28 15:10:53.164000+07', 'Aulia altafunysa',
   array['Brainy qurratu a''yun', 'Lisana shidqi aliyya', 'Maharani najwa almira', 'Siti nurhidayah']),
  ('suralaksana', 77, '2026-08-27 15:46:15.593000+07', 'REYHAN ADHIRA FEBRIAN',
   array['RIFKY RAMDANI', 'ADE ALI RIDZWAN', 'JAYA RAMDANI', 'IPNU OKTA SAPUTRA']),
  ('syududu', 78, '2026-08-27 15:52:29.166000+07', 'M FARHAN',
   array['MAURIZ HUSNI M', 'AZMI ALIF HILMI', 'M IJAD BADRUJAMAN', 'ARVIN NUGRAHA']),
  ('teratai', 3, '2026-08-21 17:11:27.672000+07', 'RIFFA''A NUR AZIZAH',
   array['DARIS SETIA NINGSIH', 'ZAHRA AUDIA', 'DEVI PUSWITA', 'KEULIS NUR AZIZAH AZZAHRA']),
  ('teratai bahrul anwar', 83, '2026-08-27 16:04:09.545000+07', 'BALQIS LAELA S',
   array['FATIMAH AZZAHRA', 'HANI LAELATUL H', 'AMELIA RAHMA N', 'ALMA ZAKIATUL F']),
  ('the jalangkung', 13, '2026-08-22 12:02:06.222000+07', 'NAUFAL ZATNIKA',
   array['EVAN MUHAMAD FADIL', 'MUH ZIDAN ZAKI BUDIAWAN', 'REVAN PERMANA', 'TIO FAUQO SYAHID']),
  ('timun mas', 12, '2026-08-22 11:50:39.810000+07', 'KIKIS RINDU APRILLIA',
   array['AZKA SELVA NUR FADILLAH', 'AYU INTAN NURAENI', 'ARNI MEILANI', 'SITI NURHASANAH']),
  ('tutut', 71, '2026-08-27 11:57:45.088000+07', 'Asep Andi Maulana',
   array['Deris Khoerusadiq', 'Ahmad Fahri Alfi Fauzan', 'Febriansyah Muharom', 'Fikri Nakhlak Rafi']),
  ('valestra', 131, '2026-08-28 11:12:15.045000+07', 'RIFA KIFATUNNISA',
   array['ZADA ARISSA', 'NAIFA RAIDANI BILQIS', 'KHAULLA NURUL AFFIQA', 'ELGIVA SHOFIA FAWWAZAH']),
  ('viking', 119, '2026-08-28 10:15:33.709000+07', 'Arraffi Yudistira Prasetya',
   array['Bilfakih Rey Alteza Pratama', 'Rafa Ardianto Wibowo', 'Rahes Mahesa Edwinscyah', 'Fardhan Sakha El''faiz']),
  ('violet niskala', 21, '2026-08-22 13:04:32.087000+07', 'Khalisa Shafa Ghaissani',
   array['Alfira Klarisa Putri', 'Ilma Firda Hasbiya', 'Kaila Najla Humaira', 'Melani Triesahapsari']),
  ('weinson', 120, '2026-08-28 10:50:25.620000+07', 'RAFANDA KRISFA FATINA',
   array['KAHLA GHAIDA ARSYFA RAFANI', 'AISHA JENAHARA SAKHI', 'AQILA YULIA ISKANDAR', 'FARAH AINI KHAIRUNNISA']),
  ('wijaya kusuma nawasena', 20, '2026-08-22 12:48:36.082000+07', 'Alia Shofia Maulida',
   array['Aisyah Citra Nila Kusumah', 'Aqila Putri Ginsa', 'Nazwa Dalilah', 'Sefira Sajidah Zahra']),
  ('wira kencana', 94, '2026-08-27 19:34:22.107000+07', 'Rafka Aditia Dariyat',
   array['Risqy Azhar Fadhilah', 'Sazki Syifaur Rohim', 'Zahran Izyan Ahmad Luthfii', 'Moch Rafa Fadillah']),
  ('wiraga', 40, '2026-08-25 12:16:11.032000+07', 'Raka nur fahrizka',
   array['Irawan Riswanto', 'Fahrul Fauzi', 'Muhammad Dzikri N.H', 'Rayi nur fahrizka']),
  ('wiraga ciamis', 117, '2026-08-28 10:12:08.005000+07', 'Rizki Alif Kurniawan',
   array['Arfadhia Sahaqueel Aqmar', 'Aldrian Pradipto', 'Randi Kusuma Ramadan', 'Kainnes Wira Pratama']),
  ('wiratama', 140, '2026-08-28 13:11:58.451000+07', 'Muhammad Raihan Pratama',
   array['Muhammad Hasbyallah', 'Khoirul Fathir', 'Muhammad Samy Yassar', 'Muhammad Irsyad']),
  ('wondama', 100, '2026-08-27 22:34:40.077000+07', 'Hasbi aviona',
   array['Dafin adilla putra perdana', 'Ilham maulana', 'Marshya tri maulana', 'Septian Alam Ramadhan']);

-- ---------------------------------------------------------------------------
-- Kunci penyamaannya sama persis dengan indeks regu_nama_unik (0051): huruf
-- kecil, spasi beruntun dirapatkan. Memakai kunci yang berbeda dari indeksnya
-- berarti dua nama yang database anggap sama bisa mendarat di baris berbeda.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_regu   integer;
  v_daftar integer;
  v_hilang text;
begin
  update regu r
     set nama_ketua = f.ketua,
         anggota    = f.anggota
    from sinkron_form f
   where lower(regexp_replace(trim(r.nama_regu), '\s+', ' ', 'g')) = f.nama_kunci
     and not r.is_cancelled;
  get diagnostics v_regu = row_count;

  update pendaftaran d
     set created_at = f.waktu
    from regu r join sinkron_form f
      on lower(regexp_replace(trim(r.nama_regu), '\s+', ' ', 'g')) = f.nama_kunci
   where r.pendaftaran_id = d.id and not r.is_cancelled;
  get diagnostics v_daftar = row_count;

  select string_agg(format('%s (baris %s)', f.nama_kunci, f.baris), ', '
                    order by f.baris)
    into v_hilang
  from sinkron_form f
  where not exists (
    select 1 from regu r
    where lower(regexp_replace(trim(r.nama_regu), '\s+', ' ', 'g')) = f.nama_kunci
      and not r.is_cancelled);

  raise notice '0136: % regu disegarkan, % pendaftaran bertanggal form.',
    v_regu, v_daftar;
  if v_hilang is not null then
    raise notice '0136: nama berikut tidak ada di database dan DILEWATI: %', v_hilang;
  end if;
end;
$blok$;

-- ---------------------------------------------------------------------------
-- Pagar: tidak boleh ada lagi pendaftaran yang bertanggal hari impor. Yang
-- diperiksa bukan "update-nya berjalan" melainkan tidak ada lagi baris yang
-- masih memakai jam yang sama untuk ratusan pendaftaran sekaligus.
-- ---------------------------------------------------------------------------
do $blok$
declare v_sisa integer;
begin
  select count(*) into v_sisa
  from pendaftaran d
  where exists (select 1 from regu r join sinkron_form f
                  on lower(regexp_replace(trim(r.nama_regu), '\s+', ' ', 'g')) = f.nama_kunci
                where r.pendaftaran_id = d.id and not r.is_cancelled)
    and d.created_at not in (select waktu from sinkron_form);

  if v_sisa > 0 then
    raise exception '0136: % pendaftaran masih tidak bertanggal form', v_sisa;
  end if;
  raise notice '0136: seluruh pendaftaran yang cocok sudah bertanggal form.';
end;
$blok$;

drop table sinkron_form;
