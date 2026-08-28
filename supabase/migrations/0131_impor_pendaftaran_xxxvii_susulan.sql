-- ============================================================================
-- hrcd-rekap : 0131_impor_pendaftaran_xxxvii_susulan.sql
--
-- Memasukkan jawaban Google Form HRCD XXXVII mulai baris 102 (28 Agustus
-- 2026 05:33:03) sampai baris 142. Bentuknya meneruskan 0129 dan 0130:
-- satu baris form menjadi satu pendaftaran, status tetap menunggu pembayaran,
-- dan bukti transfer berupa link Google Drive yang bisa dibuka dari nota.
--
-- Tiga baris adalah kiriman ulang, bukan regu baru. Baris 111 mengulang regu
-- baris 110 dengan lima anggota yang sama; baris 128 dan 129 adalah versi
-- lebih lama CAKRA DWIPA yang dikirim lagi dengan data paling lengkap pada
-- baris 133. Ketiganya sengaja tidak dimasukkan.
--
-- Sebelas nama perlu dibedakan sebelum masuk. Enam bertabrakan dengan regu
-- dari seratus baris pertama (GARUDA, EDELWEIS, WIRAGA, ELANG HITAM,
-- NISKALA, NEBULA); CAKRAWALA, SAKURA, dan RAJAWALI sudah dipakai regu
-- Internal; lalu SAKURA dan RAJAWALI masing-masing dipakai lagi oleh regu
-- kedua dari sekolah yang sama pada susulan ini. Sesuai aturan penamaan,
-- benturan antar-sekolah diberi ekor sekolah, sedangkan dua regu dari sekolah
-- yang sama diberi nomor 1 dan 2; unique index nama regu tidak dilonggarkan.
--
-- Beberapa baris sudah dimasukkan panitia lewat form baru sebelum migrasi ini
-- dijalankan. Karena kunci_kirim mereka bukan kunci sumber di bawah, migrasi
-- mencocokkannya lewat nama + golongan, lalu menuntut sekolah ATAU nomor kontak
-- yang sama. Nama ketua dan anggota tidak menjadi kunci karena isian manualnya
-- banyak disingkat; setelah cocok, keduanya diganti isi lengkap dari workbook.
-- Nama yang sama tetapi golongan dan kedua petunjuk itu berbeda menggagalkan
-- seluruh transaksi, bukan ditempeli bukti milik orang lain.
-- Nama regu yang sudah memiliki nomor dada tidak diubah. Nomornya sendiri juga
-- tidak pernah ditulis oleh migrasi ini.
-- Satu pendaftaran manual dapat memuat beberapa regu dari beberapa baris Form.
-- Karena satu nota hanya mempunyai satu kolom bukti, link baris terakhir dalam
-- pendaftaran gabungan menjadi link nota itu secara deterministik.
--
-- Aman dijalankan ulang: baris baru membawa kunci_kirim deterministik, dan
-- baris yang sudah ada ditemukan lagi lewat identitas regunya. Status lunas,
-- bila panitia sudah memverifikasinya, tidak disentuh.
-- ============================================================================

create temporary table impor_form_susulan (
  baris       integer primary key,
  sekolah     text    not null,
  nama_regu   text    not null,
  golongan    text    not null,
  nama_ketua  text    not null,
  anggota     text[]  not null,
  kontak_wa   text    not null,
  nama_kontak text,
  bukti       text    not null
);

insert into impor_form_susulan
  (baris, sekolah, nama_regu, golongan, nama_ketua, anggota,
   kontak_wa, nama_kontak, bukti) values
  (102, 'SMA Terpadu Al-Muaawanah', 'MUTIARA TIMUR', 'penegak_pa',
   'NAUFAL RAZIQ ATHAULLAH',
   array['ALIF AZIZ MUHAMMAD ILYAS', 'FATHAN NASRULLOH', 'MUHAMMAD ALPAN FAUZAN', 'ARYA MANGGALA'],
   '082130741090', null,
   'https://drive.google.com/file/d/1TrXrKSvTMBu_4nxWakdeLxLYkWDIMwdL/view'),
  (103, 'SMA 1 Sindangkasih', 'Macan Gersang', 'penegak_pa',
   'Radit Mahmudi Raksadinata',
   array['Adib Fawwaz Elmumtaz', 'Andika Maulana', 'Maulif Zakki Algiffari', 'Muhammad Radithya Alfarobi'],
   '085224408668', null,
   'https://drive.google.com/file/d/1eoIMjiT1Kk_7UQXoFjQnIezGuUWGIgi1/view'),
  (104, 'SMA 1 Sindangkasih', 'GARUDA SINDANGKASIH', 'penegak_pa',
   'Ridwan Akbar Hilabi',
   array['Adrian Dwika Cahyono', 'Rendi Nugraha', 'Rafi Wafa Fadilah', 'Ramjan Fauzan'],
   '085224408668', null,
   'https://drive.google.com/file/d/1z3dB3dKIhkGDP1Jku_wlMVSWwCWSIfOH/view'),
  (105, 'SMA 1 Sindangkasih', 'CAKRAWALA SINDANGKASIH', 'penegak_pi',
   'Rani Nurhayati',
   array['Meyra Nurmawati', 'Khilda Hana Hanifa', 'Fuji Rahmawati', 'Tasyaa Aisil Gina'],
   '085224408668', null,
   'https://drive.google.com/file/d/1VZPE2mI06uzn8OrYpxcU_tK3LkQbD9Cw/view'),
  (106, 'SMP IT MD Fathahillah', 'SAKURA 1', 'penggalang_pi',
   'Zakiyatun Nafsi',
   array['Annisa Miftahul Jannah F.S.', 'Silvi Nurfauziah', 'Ghaitsa Zahira Shofa', 'Aisy Zahra Ramadhani'],
   '085546971995', null,
   'https://drive.google.com/file/d/1OlGuezXmIQfSbLcwR91npSw7gT1vbSo3/view'),
  (107, 'SMAN 1 Cisaga', 'EDELWEIS CISAGA', 'penegak_pi',
   'Richy Meranti Pratiwi',
   array['Keyla Suci Aprilia', 'Delista Solihah', 'Nindy Pratiwi', 'Nayla Julia Puspita'],
   '085133340001', null,
   'https://drive.google.com/file/d/1CB4Jp2oMzVUQ8XquW8SgObKepEiYe4uw/view'),
  (108, 'SMP IT MD Fathahillah', 'SAKURA 2', 'penggalang_pi',
   'Ripa Nur Adawiah',
   array['Aliyya Septiani Az Zahra', 'Aisyah Rahmadani', 'Daniza Nur Alifa', 'Riffa Aldia Sya''bani'],
   '085546971995', null,
   'https://drive.google.com/file/d/1STD5dcqYQ-A7u8Lr52ija5Ohr6x8_S0U/view'),
  (109, 'SMP IT MD Fathahillah', 'RAJAWALI 1', 'penggalang_pa',
   'Rifal Pramudya Hidayat',
   array['Riffat Nawfal Hidayat', 'Hasbi Nur Arif', 'Hisyam Aufa Rahman', 'Nova Novianto'],
   '085546971995', null,
   'https://drive.google.com/file/d/1Pt6UF_TNQu9PoBg9yMP5n29THzPHDidj/view'),
  (110, 'SMP IT MD Fathahillah', 'RAJAWALI 2', 'penggalang_pa',
   'Muhammad Iqbal Maulana',
   array['Dzaky Mirza Setiawan', 'Hasby Mughni Ramadhan', 'Yuga Aditia Widianto', 'Muhammad Azhar Nur Maajid'],
   '085546971995', null,
   'https://drive.google.com/file/d/1yIjMdu60k6idHrcb7idBlgXpm1tPadys/view'),
  (112, 'SMKN 2 Ciamis', 'CAKRA 3', 'penegak_pi',
   'SHEYLA FITRI YANI',
   array['RISKA AMELIA', 'NOVITA AYU WILDANINGSIH', 'NUR ASYFA YULIANTI', 'FREYA ZHAFIRAH MAULANA'],
   '08112113126', 'Dewi Aryanti',
   'https://drive.google.com/file/d/1RbR6g9pfLmCBBqrSUdyJj8W4k6cZhHTD/view'),
  (113, 'SMA IT MD Fathahillah', 'Sangga Pendobrak', 'penegak_pa',
   'Ibnu Fadillah',
   array['Fadli Nabil Choiri', 'Revan Geraldi Putra', 'Muhammad Raditya Ilham', 'Nawfal Arkana Ikbar Fawwaz'],
   '085546971995', null,
   'https://drive.google.com/file/d/1m-AmAH--ZyhSQg6sM7CaL3sr2Lq4APfa/view'),
  (114, 'SMPN 2 Ciamis', 'Jaga Galuh', 'penggalang_pi',
   'Noviana Safitri',
   array['Tesa Trijaya', 'Annisa Marsha Putri', 'Gelsi Fatysha Putri Eriane', 'Lulu Asy-Syifa Arraniry'],
   '085314561528', null,
   'https://drive.google.com/file/d/1OQsOUp_yvlwKLYXkYM_QAVPbAAO2mB0Q/view'),
  (115, 'SMPN 2 Ciamis', 'Someah', 'penggalang_pi',
   'Azkia Rahma Nadhifah',
   array['Khanza Aqilah Salsabila', 'Azkia Nurpadilah', 'Raisya Khairunnisa', 'Nela Guritno'],
   '085314561528', null,
   'https://drive.google.com/file/d/1ayQ6NNwAnehcanY3o3KtntcXfLnm4xGo/view'),
  (116, 'SMP BP Plus Ma''arif NU Ciamis', 'KOMODO', 'penggalang_pa',
   'M Faizal Mubarok',
   array['M Zaidan Faqih Al Hawari', 'Faisal Nur Alam', 'Shofar Yanuar Akbar', 'Muhammad Rafka Zaelani'],
   '082216565471', null,
   'https://drive.google.com/file/d/1LmURVP4aLTE8NyNJqA5U0ybsLs_nx9vy/view'),
  (117, 'SMPN 2 Ciamis', 'WIRAGA CIAMIS', 'penggalang_pa',
   'Rizki Alif Kurniawan',
   array['Arfadhia Sahaqueel Aqmar', 'Aldrian Pradipto', 'Randi Kusuma Ramadan', 'Kainnes Wira Pratama'],
   '085210911982', null,
   'https://drive.google.com/file/d/1819bMo9jhOUaLqXvQeeHMuhA-WfN2ERz/view'),
  (118, 'SMP BP Plus Ma''arif NU Ciamis', 'BUAYA PUTIH', 'penggalang_pi',
   'Naisya Siti Nurfadilah',
   array['Tsania Miladia Rahma', 'Jenisya Halwani', 'Azzahra Agustina', 'Zyhara Nurul Fadillah'],
   '087880778943', null,
   'https://drive.google.com/file/d/114c3jr5rOha8TquDlBOE65de7kuwV-j4/view'),
  (119, 'SMPN 2 Ciamis', 'Viking', 'penggalang_pa',
   'Arraffi Yudistira Prasetya',
   array['Bilfakih Rey Alteza Pratama', 'Rafa Ardianto Wibowo', 'Rahes Mahesa Edwinscyah', 'Fardhan Sakha El''faiz'],
   '085210911982', null,
   'https://drive.google.com/file/d/1J7UG4bNLFECApLX_d0PfyA4fVfa5S1eU/view'),
  (120, 'MTs Al-Fadliliyah Darussalam', 'WEINSON', 'penggalang_pi',
   'RAFANDA KRISFA FATINA',
   array['KAHLA GHAIDA ARSYFA RAFANI', 'AISHA JENAHARA SAKHI', 'AQILA YULIA ISKANDAR', 'FARAH AINI KHAIRUNNISA'],
   '085723414717', null,
   'https://drive.google.com/file/d/1bOtgpZ0ZYAPURPWGboUatxtyzymCiBra/view'),
  (121, 'MTs Al-Fadliliyah Darussalam', 'ARGANTARA', 'penggalang_pi',
   'RAIYA AWALIYA',
   array['ARIENINDYA KIRANA PUTRI', 'ASHFA ATQIYA ADEEVAH', 'ZIVARA SARINA MAULIDA', 'FADYA RAFIFATU RIFDA'],
   '085723414717', null,
   'https://drive.google.com/file/d/18wLSkhtLGEDx9ALa_KdmTb0k5Y3s5gf4/view'),
  (122, 'MTs Al-Fadliliyah Darussalam', 'FEARIS STEPSS', 'penggalang_pi',
   'ZAHWA ANAYA KEYSHA',
   array['CYRIL ELLIORA RAQIYA', 'SHOFIYATUL MECCA ADWA', 'GHINA MUTIARA HAFSA', 'IZZA NURFAAKHIRA'],
   '085723414717', null,
   'https://drive.google.com/file/d/19QAL4wRsKF82LwcIkWKC5y0jM3HKz30L/view'),
  (123, 'SMKN 2 Ciamis', 'agresi 5', 'penegak_pa',
   'MUHAMMAD RIZKI PRATAMA',
   array['MUHAMMAD NU''MAN BAEHAQI', 'SAHRUL AFRIANSYAH', 'LUTPIANSYAH', 'ALDI NUGRAHA'],
   '087884243026', null,
   'https://drive.google.com/file/d/1TgCmAcqAEykJl31oE_ABq0RU-4jz5P7B/view'),
  (124, 'MTsN 4 Ciamis', 'ELANG HITAM CIPAKU', 'penggalang_pa',
   'MUHAMMAD RAIHAN FATHUSYIDQI',
   array['HAFIZ FIRDANSYAH', 'ZAQI WIJAYAKUSUMAH', 'AZRIEL APRIANSYAH', 'MALIK NUROHMAN'],
   '085323424474', null,
   'https://drive.google.com/file/d/19DokWwk_baGH7sPmz9cztXxh33T1xko3/view'),
  (125, 'MTs Al-Fadliliyah Darussalam', 'RENGGANIS', 'penggalang_pi',
   'JULAIKA NUSANTARA QUEEN',
   array['HANAN HAFIDZAH HISAN', 'AFIKA NURKHOFIFAH SAMSURIJAL', 'DIANDRA AZZAHRA NOVIARI', 'TIARA RISKA SYA`BANI'],
   '085723414717', null,
   'https://drive.google.com/file/d/10kvXYKmTH8ODoif3_97P4sZ-ae8ML3E5/view'),
  (126, 'SMAN 3 Ciamis', 'Cendrawasih', 'penegak_pa',
   'ADE'' YUSUF MAULANA',
   array['REZKI ARDIANSYAH.H', 'DIAN NUGRAHA', 'FAJAR NURSIDIK', 'ALFAN ALIANDANA'],
   '082317958637', null,
   'https://drive.google.com/file/d/12yGs9BojOo7hACRDJ0lsXF9FE0dPR5Yl/view'),
  (127, 'MTs Al-Fadliliyah Darussalam', 'NISKALA AL-FADLILIYAH', 'penggalang_pi',
   'ATHIRA ZAKIA',
   array['NISWATUN NAFI`AH', 'ZASKIA DINDA SULISTIA', 'ZELDA SASKIA SUDRAJAT', 'SYAKIRA AULIA HIFZHA AZKIYA'],
   '085723414717', null,
   'https://drive.google.com/file/d/1rJr9eYQf55w8lDeXiRpnsyiDyOU5O3c_/view'),
  (130, 'MTsN 4 Ciamis', 'NEBULA CIPAKU', 'penggalang_pi',
   'ASRI AWALIA',
   array['AULIA SRI FUJI', 'NADA NUR KAMILA', 'MELISA SALMA RAIHANA', 'TSALITSA ASTI RAINA'],
   '085323424474', null,
   'https://drive.google.com/file/d/1WRvUfGa0ow7Go5vYS3_CeXFljoStu7GL/view'),
  (131, 'MTs Al-Fadliliyah Darussalam', 'VALESTRA', 'penggalang_pi',
   'RIFA KIFATUNNISA',
   array['ZADA ARISSA', 'NAIFA RAIDANI BILQIS', 'KHAULLA NURUL AFFIQA', 'ELGIVA SHOFIA FAWWAZAH'],
   '085723414717', null,
   'https://drive.google.com/file/d/120tLEE-gnQxZ-ZylBP-qda8dzSi4hYel/view'),
  (132, 'MTs Al-Fadliliyah Darussalam', 'M.B.G', 'penggalang_pa',
   'MOH. ADWITIYA',
   array['ARYA DWI PUTRA', 'M. NAFIS RAIHAN', 'AFZA CHOIRUL FATAA', 'HEGRIN MAHFUZH GEMAYEL'],
   '085723414717', null,
   'https://drive.google.com/file/d/1rkpl52monY398vAOGiHO-fsBn7DrtZ5q/view'),
  (133, 'SMPN 1 Cimaragas', 'CAKRA DWIPA', 'penggalang_pa',
   'RADIKA ATAYA PUTRA ESTETIA',
   array['RAJJU ARIANSYAH', 'IRSANDI AWALLUL FALAH', 'FIKRI ANUGRAH', 'MUHAMMAD FAHRI ADITYA'],
   '085322800405', null,
   'https://drive.google.com/file/d/1klOJC536Yo-M5SZ9HPUowo5aI1ONxC5i/view'),
  (134, 'MTs Al-Fadliliyah Darussalam', 'KOPDES', 'penggalang_pa',
   'AZKA ALIYAN HIDAYAT',
   array['GHIFARI RAHMAD GHANI', 'IRFAN YAHDI ISKANDAR SALEH', 'BARA DZAKI HIDAYAT', 'GRANADA SULTHAN MUHAMMAD'],
   '085723414717', null,
   'https://drive.google.com/file/d/1YM6KSx3MS3li-yLDSBySIDoUR2ZgBm-w/view'),
  (135, 'MTs Al-Fadliliyah Darussalam', 'KHONG GUAN', 'penggalang_pa',
   'GALANG AZZAM ASH-SHIDDIQY',
   array['FAAIQ ZULFAHMI AZZAM', 'ANDI MUHAMMAD THARIQ ATHAYA', 'MASHDAR MANSHURIAH ADNAN', 'MUHAMMAD DIRA TSAQIIF'],
   '085723414717', null,
   'https://drive.google.com/file/d/1Qekgwfut66Wt1Dpl-jQxHsFugKfIGOJw/view'),
  (136, 'MAN 2 Ciamis', 'NAVADIKARA', 'penegak_pi',
   'ALMA ASYOFI AULIA',
   array['SITI MELISA MAULIDA', 'LINA CAHLIANI', 'MEGA AGUSTIANI', 'YURIANI NURUL AZIZAH'],
   '085323234789', 'Novi Yulianti',
   'https://drive.google.com/file/d/1F9pYnWBOGZjqjK5rXFC591MjQbZHE9Ak/view'),
  (137, 'MAN Darussalam', 'Paramita', 'penegak_pi',
   'Elpa Thiana',
   array['Shofa Attahliyah Qorihah', 'Agni Putri Anwar', 'Reivana Puspita Sekarwangi', 'Sofi Hernanda'],
   '081321627362', null,
   'https://drive.google.com/file/d/1G9fJ7GpOeqRKUs_X_zWsqAa_lMb5Rznq/view'),
  (138, 'MAN Darussalam', 'Edelwist', 'penegak_pi',
   'Syahla Ardelia Arjani Sanjaya',
   array['Zivanna Elite Fathihatus Silmy', 'Zaskia Rahmania Aprilianty', 'Azka Almira Rahmania', 'Alya Nailil Amni Azizah'],
   '081321627362', null,
   'https://drive.google.com/file/d/1MsC3OkP6WJTGkorwyYdLscJ6Jg_zdT4o/view'),
  (139, 'MAN Darussalam', 'Pikopi', 'penegak_pi',
   'Nasywa Janzabila',
   array['Aida Sabila Qurrota Aini', 'Dewi Latifatul Alawiyah', 'Zahra Laila Fadlilah', 'Azkiya Ramdhani Fauzi'],
   '081321627362', null,
   'https://drive.google.com/file/d/1m1X0msRP2NaoopGxwiyzrMco2IaZWquj/view'),
  (140, 'MAN Darussalam', 'Wiratama', 'penegak_pa',
   'Muhammad Raihan Pratama',
   array['Muhammad Hasbyallah', 'Khoirul Fathir', 'Muhammad Samy Yassar', 'Muhammad Irsyad'],
   '083130965734', null,
   'https://drive.google.com/file/d/1J6pmrEwT6dXz8HaNYDcG4XZa4MzYtKUL/view'),
  (141, 'MAN Darussalam', 'Heulang Heuay', 'penegak_pa',
   'Muhammad Zaidan Aldaffa Abdullah',
   array['Muhammad Wildan Fajri', 'Fathir Rahman Ghifari', 'Fitra Faiq Angkasa', 'Arsyad Ghani Wardana'],
   '083130965734', null,
   'https://drive.google.com/file/d/1Boxy7mDJWrjPQDxmpzmnOo_rkdOZzzXJ/view'),
  (142, 'SMAN 1 Banjar', 'Singa Jaya Patroman', 'penegak_pa',
   'Chairul Fikri Mubarok',
   array['Raihan Daffa Pratama', 'Fadlan Azka Alfatih', 'Nabil Andiyusuf', 'Raesa Zidna Ilma'],
   '085220567876', null,
   'https://drive.google.com/file/d/1u0AcJ6BxOr7g6UXebfN1P0GgEue8Wb3u/view');

-- Sekolah baru lahir dengan alamat kosong, seperti 0129. Kolom kwartir pada
-- Google Form adalah petunjuk wilayah, bukan alamat yang boleh disalin.
create temporary table impor_sekolah_susulan (nama text primary key);

insert into impor_sekolah_susulan (nama)
select distinct sekolah from impor_form_susulan;

create temporary table impor_hasil_susulan (
  baris          integer primary key references impor_form_susulan (baris),
  pendaftaran_id uuid not null
);

do $blok$
declare
  v_s record;
  v_n integer := 0;
begin
  for v_s in select * from impor_sekolah_susulan order by nama loop
    if not exists (
      select 1 from sekolah where kunci_sekolah(name) = kunci_sekolah(v_s.nama)
    ) then
      insert into sekolah (name, address) values (v_s.nama, '');
      v_n := v_n + 1;
      raise notice '0131: sekolah baru - %', v_s.nama;
    end if;
  end loop;
  raise notice '0131: % sekolah baru dibuat.', v_n;
end;
$blok$;

do $blok$
declare
  v_f       record;
  v_batch   uuid;
  v_sek     uuid;
  v_kunci   uuid;
  v_kode    text;
  v_pakai   record;
  v_baru    integer := 0;
  v_ada     integer := 0;
begin
  for v_f in select * from impor_form_susulan order by baris loop
    v_batch := null;
    v_kunci := md5('hrcd-xxxvii-form-' || v_f.baris)::uuid;

    select id into v_sek from sekolah
     where kunci_sekolah(name) = kunci_sekolah(v_f.sekolah);
    if v_sek is null then
      raise exception '0131: sekolah % tidak ketemu setelah dibuat', v_f.sekolah;
    end if;

    -- Jalur pertama: baris yang pernah dibuat migrasi ini sendiri.
    select id into v_batch from pendaftaran where kunci_kirim = v_kunci;

    -- Jalur kedua: baris yang telanjur dimasukkan lewat form baru. Nama dan
    -- golongan harus cocok, ditambah sekolah ATAU nomor kontak. Pagar terakhir
    -- membedakan CAKRAWALA/Sakura/Rajawali milik Internal SMAN 1 Ciamis dari
    -- tiga regu susulan yang semula memakai nama sama.
    if v_batch is null then
      select r.pendaftaran_id into v_batch
      from regu r
      join pendaftaran d on d.id = r.pendaftaran_id
      join sekolah s on s.id = d.sekolah_id
      where not r.is_cancelled
        and lower(regexp_replace(trim(r.nama_regu), '\s+', ' ', 'g')) in (
          lower(regexp_replace(trim(v_f.nama_regu), '\s+', ' ', 'g')),
          case v_f.baris
            when 108 then 'sakura b'
            when 110 then 'rajawali b'
            else lower(regexp_replace(trim(v_f.nama_regu), '\s+', ' ', 'g'))
          end
        )
        and r.golongan = v_f.golongan
        and (kunci_sekolah(s.name) = kunci_sekolah(v_f.sekolah)
             or d.kontak_wa = v_f.kontak_wa);

      if v_batch is not null then
        v_ada := v_ada + 1;
      elsif exists (
        select 1 from regu r
        where not r.is_cancelled
          and lower(regexp_replace(trim(r.nama_regu), '\s+', ' ', 'g'))
            = lower(regexp_replace(trim(v_f.nama_regu), '\s+', ' ', 'g'))
      ) then
        select s.name as sekolah, r.golongan, r.nama_ketua, r.anggota,
               d.kontak_wa
          into v_pakai
          from regu r
          join pendaftaran d on d.id = r.pendaftaran_id
          join sekolah s on s.id = d.sekolah_id
         where not r.is_cancelled
           and lower(regexp_replace(trim(r.nama_regu), '\s+', ' ', 'g'))
             = lower(regexp_replace(trim(v_f.nama_regu), '\s+', ' ', 'g'));

        raise exception '0131: nama % baris % sudah dipakai <% / % / % / % / %>; sumber <% / % / % / % / %>',
          v_f.nama_regu, v_f.baris,
          v_pakai.sekolah, v_pakai.golongan, v_pakai.nama_ketua,
          v_pakai.anggota, v_pakai.kontak_wa,
          v_f.sekolah, v_f.golongan, v_f.nama_ketua,
          v_f.anggota, v_f.kontak_wa;
      end if;
    end if;

    if v_batch is null then
      loop
        v_kode := 'HRCD' || edisi_aktif() || '-' ||
                  upper(substr(md5(gen_random_uuid()::text), 1, 6));
        exit when not exists (
          select 1 from pendaftaran where kode_pembayaran = v_kode
        );
      end loop;

      insert into pendaftaran (
        sekolah_id, kode_pembayaran, butuh_barak, jumlah_menginap,
        jumlah_regu, kontak_wa, kunci_kirim, nama_kontak,
        metode_bayar, bukti_transfer
      ) values (
        v_sek, v_kode, false, 0, 1, v_f.kontak_wa, v_kunci,
        v_f.nama_kontak, 'transfer', v_f.bukti
      ) returning id into v_batch;

      insert into regu (
        pendaftaran_id, nama_regu, nama_ketua, golongan, anggota
      ) values (
        v_batch, v_f.nama_regu, v_f.nama_ketua, v_f.golongan,
        nullif(v_f.anggota, '{}')
      );
      v_baru := v_baru + 1;
    else
      -- Pilihan transfer dan nota berasal langsung dari kolom BJB Google
      -- Form. Kontak WA juga sumber yang sama; nama kontak yang lebih lengkap
      -- dari isian manual dipertahankan.
      update pendaftaran
         set sekolah_id     = v_sek,
             kontak_wa      = v_f.kontak_wa,
             nama_kontak    = coalesce(nama_kontak, v_f.nama_kontak),
             metode_bayar   = 'transfer',
             bukti_transfer = v_f.bukti
       where id = v_batch;

      update regu
         set nama_regu  = case
                            when nomor_dada is null then v_f.nama_regu
                            else nama_regu
                          end,
             nama_ketua = v_f.nama_ketua,
             anggota    = nullif(v_f.anggota, '{}')
       where pendaftaran_id = v_batch
         and not is_cancelled
         and lower(regexp_replace(trim(nama_regu), '\s+', ' ', 'g')) in (
           lower(regexp_replace(trim(v_f.nama_regu), '\s+', ' ', 'g')),
           case v_f.baris
             when 108 then 'sakura b'
             when 110 then 'rajawali b'
             else lower(regexp_replace(trim(v_f.nama_regu), '\s+', ' ', 'g'))
           end
         );
    end if;

    insert into impor_hasil_susulan (baris, pendaftaran_id)
    values (v_f.baris, v_batch);
  end loop;

  raise notice '0131: % pendaftaran dibuat, % yang sudah ada dilengkapi.',
    v_baru, v_ada;
end;
$blok$;

-- Pagar isi: seluruh 38 respons unik harus memiliki regu yang cocok dan
-- pendaftarannya harus mempunyai link nota Drive. Tabel hasil menjadi kunci
-- pemeriksaan karena satu pendaftaran dapat memuat beberapa baris Form, dan
-- nama regu yang sudah bernomor dada sengaja boleh mempertahankan nama lamanya.
-- Status pembayaran sengaja tidak diperiksa maupun diubah.
do $blok$
declare
  v_n integer;
begin
  select count(*) into v_n
  from impor_form_susulan f
  join impor_hasil_susulan h on h.baris = f.baris
  join pendaftaran d
    on d.id = h.pendaftaran_id
   and d.metode_bayar = 'transfer'
   and d.bukti_transfer like 'https://drive.google.com/file/d/%/view'
  join regu r
    on r.pendaftaran_id = d.id
   and r.golongan = f.golongan
   and r.nama_ketua = f.nama_ketua
   and r.anggota = f.anggota
   and not r.is_cancelled
  join sekolah s
    on s.id = d.sekolah_id
   and kunci_sekolah(s.name) = kunci_sekolah(f.sekolah);

  if v_n <> (select count(*) from impor_form_susulan) then
    raise exception '0131: baru % dari % respons unik yang terpasang lengkap',
      v_n, (select count(*) from impor_form_susulan);
  end if;
  raise notice '0131: % respons unik terpasang lengkap.', v_n;
end;
$blok$;

drop table impor_hasil_susulan;
drop table impor_form_susulan;
drop table impor_sekolah_susulan;
