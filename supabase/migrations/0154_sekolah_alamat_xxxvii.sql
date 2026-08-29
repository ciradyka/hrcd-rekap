-- ============================================================================
-- hrcd-rekap : 0154_sekolah_alamat_xxxvii.sql
-- Sekolah edisi XXXVII: leburkan yang kembar, bakukan nama, isi alamat.
--
-- KENAPA ADA
--
-- Tabel `sekolah` produksi memuat 216 baris; 188 di antaranya datang dari
-- daftar kurasi 0063 dan alamatnya baku. Duapuluh delapan sisanya lahir dari
-- `submit_pendaftaran` edisi ini — pembina mengetik nama sekolahnya sendiri
-- dan yang tersimpan apa adanya. Limabelas di antaranya beralamat KOSONG, dan
-- itu 45 regu yang undangan serta suratnya tidak punya alamat sama sekali.
--
-- Alamat di berkas ini dicari lewat urutan sumber runbook-sekolah.md bagian 6:
-- seluruhnya dari Data Referensi Kemendikdasmen, dan NPSN-nya ditulis di
-- sebelah tiap baris supaya bisa diperiksa ulang tanpa mencari lagi. Bentuknya
-- mengikuti bagian 8: jalan, desa, `Kec.` + kecamatan, kabupaten, provinsi +
-- kode pos, `Indonesia`. **Kode pos dikosongkan kalau Referensi tidak
-- memuatnya** — menebaknya dari kecamatan tidak akan diperiksa siapa pun
-- sampai ada surat nyasar.
--
-- YANG TIDAK DISENTUH SAMA SEKALI
--
-- `regu`, `nilai_mentah`, `closing_regu`, `keberangkatan_regu`, `kloter`, dan
-- seluruh rekap nilai. Hanya DUA tabel yang menunjuk ke `sekolah` —
-- `pendaftaran.sekolah_id` dan `kejuaraan_manual.sekolah_id` — dan peleburan
-- di bawah cuma mengalihkan kedua kolom itu, persis seperti 0061. Nilai satu
-- regu pun tidak berpindah: nilai menempel pada regu, regu menempel pada
-- pendaftaran, dan id pendaftaran tidak berubah. Blok penutup MEMBUKTIKANNYA —
-- jumlah baris keempat tabel dicatat sebelum dan sesudah lalu dibandingkan,
-- dan satu baris yang bergeser membuat migrasi ini gagal keras.
--
-- YANG SENGAJA DIBIARKAN, DAN KENAPA
--
-- Enam baris tidak disentuh karena menebaknya lebih berbahaya daripada
-- membiarkannya kosong (runbook bagian 6). Semuanya disebut ulang lewat
-- `raise notice` di ujung berkas supaya panitia melihatnya tanpa membuka
-- dokumen mana pun:
--
-- SATU PASANGAN TERNYATA BUKAN KEMBAR, DAN PAGARNYA YANG MENEMUKAN
--
-- `MA Al-Azhar Kota Banjar` semula ditulis di daftar peleburan, karena
-- alamatnya sama persis dengan baris kurasi `MA Al-Azhar Citangkolo Kota
-- Banjar`. Ternyata produksi cuma punya SATU barisnya — yang bernama panjang
-- tidak pernah sampai ke sana — jadi yang benar mengganti nama, bukan
-- melebur. Yang menemukannya pagar `pasangan peleburan salah` saat migrasi
-- ini dijalankan ke produksi, dan ia berhenti SEBELUM satu baris pun berubah.
-- Pagar yang cuma sopan akan melewatinya dan meninggalkan nama pendek itu
-- selamanya.
--
--   * `SMK Lps Ciamis` — di Jl. R.E. Martadinata No. 23 ada SMK LPS 1 DAN
--     SMK LPS 2. Alamatnya sama; namanya yang harus dilengkapi angka, dan
--     angka itu tidak ada di mana pun kecuali di kepala pembinanya.
--   * `SMP AL Fadliliyah Darussalam` — tidak ada SMP di kompleks Darussalam,
--     yang ada MTs Al-Fadliliyah Darussalam. Nol regu, jadi tidak mendesak.
--   * `SMAN 1 Majalengka` — nol regu, dan alamatnya sudah berbentuk baku.
--
-- DUA SEKOLAH DIPUTUSKAN OLEH PETUNJUK FORM, BUKAN OLEH PENCARIAN
--
-- `MA Mujahidin` dan `MTs Mujahidin` punya DUA kandidat yang sama-sama satu
-- yayasan MA+MTs di satu alamat: Kec. Cipaku Kabupaten Ciamis dan Kec.
-- Sukaratu Kabupaten TASIKMALAYA. Yang memutuskan bukan pencarian, melainkan
-- kolom kwartir ranting di form pendaftaran — `docs/sekolah-belum-tuntas.md`
-- bagian E mencatatnya "Cipaku / Ciamis" untuk keduanya. Tanpa kolom itu
-- sepuluh regu akan menerima surat yang menyeberang kabupaten.
--
-- `SMA IT Nurul Huda` tidak ada di Data Referensi sama sekali; yang terdaftar
-- SMP IT Nurul Huda (Pamarican dan Panjalu) dan MA Nurul Huda (Kawali).
-- Petunjuk formnya "Pamarican / Ciamis", dan di Pamarican yang ada
-- SMP IT Nurul Huda Margajaya. Alamatnya dipinjam dari sana dengan keyakinan
-- `sedang` dan dicatat begitu — satu SMA baru yang belum masuk Dapodik adalah
-- penjelasan yang masuk akal, tetapi tetap belum dipastikan.
--
-- BISA DIJALANKAN DUA KALI, dan pencocokannya lewat `kunci_sekolah(name)`
-- bukan nama persis. Produksi menulis "SMA TERPADU AL-MUAAWANAH", impor 0129
-- menulis "SMA Terpadu Al-Muaawanah", dan keduanya sekolah yang sama —
-- mencocokkan huruf demi huruf membuat migrasi ini benar di satu database dan
-- DIAM di database lain, yang justru bentuk kegagalan yang paling sulit
-- terlihat. Indeks unique menjamin satu kunci paling banyak satu baris, jadi
-- pencocokan ini tetap tepat satu baris.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Potret data nilai SEBELUM apa pun terjadi. Dibandingkan di blok penutup.
--
--    Tanpa `on commit drop`: psql menjalankan tiap perintah dalam transaksinya
--    sendiri, jadi tabelnya akan lenyap sebelum baris berikutnya membacanya.
--    Ia dibuang sendiri di ujung berkas — pola yang sama dengan 0061.
-- ---------------------------------------------------------------------------
drop table if exists potret_nilai_0154;
create temporary table potret_nilai_0154 as
select (select count(*) from regu)               as regu,
       (select count(*) from nilai_mentah)       as nilai_mentah,
       (select count(*) from closing_regu)       as closing_regu,
       (select count(*) from keberangkatan_regu) as keberangkatan_regu,
       (select count(*) from pendaftaran)        as pendaftaran;

-- ---------------------------------------------------------------------------
-- 1. Baris kembar: satu sekolah yang tertulis dua kali.
--
--    Keenamnya lolos unique index `kunci_sekolah(name)` karena fungsi itu
--    sengaja JINAK (CLAUDE.md 12.10): ia mengganti tanda baca dengan SPASI,
--    bukan menghapusnya, jadi "Ma'arif" jadi "ma arif" dan tidak pernah
--    bertemu "maarif"; dan "SMA 1" tidak punya huruf N sehingga tidak pernah
--    runtuh ke "sman 1". Melonggarkan fungsinya BUKAN jawabannya — itu akan
--    melebur dua sekolah berbeda tanpa ada yang memeriksa hasilnya.
--
--    Yang BERTAHAN disebut satu per satu, bukan dipilih "yang tertua": tiap
--    pasangan punya alasannya sendiri, dan pasangan yang salah pilih menghapus
--    baris yang justru sedang dipakai regu.
-- ---------------------------------------------------------------------------
drop table if exists lebur_0154;
create temporary table lebur_0154 (buang text, simpan text, alasan text);
insert into lebur_0154 (buang, simpan, alasan) values
  ('SMK MAARIF NU CIAMIS', 'SMK Ma''arif NU Ciamis',
   'satu NPSN 20254633; Dapodik menulis SMKS MAARIF NU CIAMIS'),
  ('SMA IT MD FATAHILLAH', 'SMA IT MD Fathahillah',
   'satu NPSN 70051695; Dapodik menulis Fathahillah'),
  ('SMP IT MUHAMADANU FATAHILAH', 'SMP IT MD Fathahillah',
   'satu NPSN 70003434; resminya SMP Islam Terpadu Muhammad Danu Fathahillah, jadi MD = Muhammad Danu'),
  ('MAN 1 Ciamis', 'MAN Darussalam',
   'satu NPSN 20276451; runbook bagian 5 menahan nama MAN Darussalam karena itu yang diucapkan orang');

do $$
declare r record; v_p int; v_k int; v_total int := 0;
begin
  for r in select * from lebur_0154 order by buang loop
    if not exists (select 1 from sekolah where kunci_sekolah(name) = kunci_sekolah(r.buang)) then
      raise notice '0154: (dilewati) "%" memang tidak ada.', r.buang;
      continue;
    end if;
    if not exists (select 1 from sekolah where kunci_sekolah(name) = kunci_sekolah(r.simpan)) then
      raise exception '0154: "%" ada tetapi "%" tidak — pasangan peleburan salah',
                      r.buang, r.simpan;
    end if;

    update pendaftaran d
       set sekolah_id = (select id from sekolah where kunci_sekolah(name) = kunci_sekolah(r.simpan))
     where d.sekolah_id = (select id from sekolah where kunci_sekolah(name) = kunci_sekolah(r.buang));
    get diagnostics v_p = row_count;

    update kejuaraan_manual m
       set sekolah_id = (select id from sekolah where kunci_sekolah(name) = kunci_sekolah(r.simpan))
     where m.sekolah_id = (select id from sekolah where kunci_sekolah(name) = kunci_sekolah(r.buang));
    get diagnostics v_k = row_count;

    delete from sekolah where kunci_sekolah(name) = kunci_sekolah(r.buang);
    v_total := v_total + 1;
    raise notice '0154: "%" -> "%" (% pendaftaran, % penghargaan dialihkan) — %',
                 r.buang, r.simpan, v_p, v_k, r.alasan;
  end loop;
  raise notice '0154: % baris kembar dilebur.', v_total;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Nama dan alamat baku.
--
--    Kolom pertama nama yang ADA SEKARANG di produksi, kolom kedua nama baku
--    menurut runbook bagian 4, kolom ketiga alamat lengkapnya. Keduanya
--    dipisah supaya baris yang cuma perlu alamat tetap terbaca sebagai satu
--    hal yang sama, bukan sebagai penggantian nama yang tidak terjadi.
-- ---------------------------------------------------------------------------
drop table if exists baku_0154;
create temporary table baku_0154 (nama_lama text, nama_baku text, alamat text);
insert into baku_0154 (nama_lama, nama_baku, alamat) values
  ('MA Bahrul Anwar',
   'MA Bahrul Anwar',
   'Dusun Cicurug, Mekarsari, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70044831
  ('MTs Bahrul Anwar',
   'MTs Bahrul Anwar',
   'Dusun Cicurug RT 05 RW 04, Mekarsari, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69955929
  ('MA Sirnarasa',
   'MA Sirnarasa',
   'Dusun Ciceuri RT 10 RW 05, Ciomas, Kec. Panjalu, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20280196
  ('MA IPHI Pamarican',
   'MA IPHI Pamarican',
   'Jl. Raya Pamarican No. 424, Pamarican, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20276455
  ('MTsN 1 Ciamis',
   'MTsN 1 Ciamis',
   'Jl. Panyingkiran No. 70, Panyingkiran, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat 46251, Indonesia'),   -- NPSN 20278600
  ('MTsN 4 Ciamis',
   'MTsN 4 Ciamis',
   'Jl. Raya Buniseuri No. 17, Muktisari, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278635
  ('SMPN 1 Kawali',
   'SMPN 1 Kawali',
   'Jl. Veteran No. 37, Kawali, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211633
  ('SMPN 2 Kawali',
   'SMPN 2 Kawali',
   'Jl. Sindangraja, Citeureup, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211652
  ('SMPN 3 Kawali',
   'SMPN 3 Kawali',
   'Jl. Kebon Kopi RT 05 RW 05 Dusun Karangmulya, Karangpawitan, Kec. Kawali, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211582
  ('SMPN 3 Baregbeg',
   'SMPN 3 Baregbeg',
   'Jl. Raya Desa Jelat, Dusun Mekarmulya RT 01 RW 06, Jelat, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69969012
  ('SMPN 4 Ciamis',
   'SMPN 4 Ciamis',
   'Jl. Tentara Pelajar No. 2, Ciamis, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20211613
  ('SMA IT MD Fathahillah',
   'SMA IT MD Fathahillah',
   'Jl. Pasanggrahan-Saguling RT 05 RW 08, Saguling, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70051695
  ('SMP IT MD Fathahillah',
   'SMP IT MD Fathahillah',
   'Jl. Pasanggrahan RT 05 RW 08, Saguling, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70003434
  ('SMK As-Sulthoniah',
   'SMK As-Sulthoniah',
   'Dusun Desa RT 014 RW 007, Jalatrang, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69988146
  ('MTs Adzkia',
   'MTs Adzkia',
   'Dusun Desa RT 01 RW 03, Kertaharja, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 69976289
  ('MA Adzkia',
   'MA Adzkia',
   'Dusun Desa RT 01 RW 03, Kertaharja, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- belum ada NPSN terdaftar; alamat dari MTs Adzkia satu yayasan
  ('SMA TERPADU AL-MUAAWANAH',
   'SMA Terpadu Al-Mu''aawanah',
   'Jl. KH. Ahmad Romli No. 26, Rajadesa, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 70006980
  ('MA Al-Azhar Kota Banjar',
   'MA Al-Azhar Citangkolo Kota Banjar',
   'Jl. Pesantren No. 02, Kujangsari, Kec. Langensari, Kota Banjar, Jawa Barat 46345, Indonesia'),   -- NPSN 20277086
  ('SMA 1 Sindangkasih',
   'SMAN 1 Sindangkasih',
   'Jl. Raya Sindangkasih Cikoneng, Sindangkasih, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat 46268, Indonesia'),   -- NPSN 20238437, baris kurasi yang kehilangan huruf N
  ('SMAN 1 SINDANGKASIH',
   'SMAN 1 Sindangkasih',
   'Jl. Raya Sindangkasih Cikoneng, Sindangkasih, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat 46268, Indonesia'),   -- NPSN 20238437
  ('MA Mujahidin',
   'MA Mujahidin',
   'Jl. KH. Fachruddin No. 96 Dusun Urug RT 004 RW 002, Pusakasari, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20280180
  ('MTs Mujahidin',
   'MTs Mujahidin',
   'Jl. KH. Fachruddin No. 96 Dusun Urug, Jalatrang, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278636
  ('SMA IT Nurul Huda',
   'SMA IT Nurul Huda',
   'Dusun Sukasari RT 026 RW 011, Margajaya, Kec. Pamarican, Kabupaten Ciamis, Jawa Barat, Indonesia');   -- belum ada NPSN terdaftar; alamat dari SMP IT Nurul Huda Margajaya (NPSN 69993153) satu yayasan

do $$
declare r record; v_nama int := 0; v_alamat int := 0; v_p int;
begin
  for r in select * from baku_0154 order by nama_baku loop
    if not exists (select 1 from sekolah where kunci_sekolah(name) = kunci_sekolah(r.nama_lama)) then
      raise notice '0154: (dilewati) "%" tidak ada di tabel sekolah.', r.nama_lama;
      continue;
    end if;

    if r.nama_lama <> r.nama_baku then
      -- Nama bakunya sudah ada berarti keduanya satu sekolah yang tertulis dua
      -- kali, dan yang benar melebur — bukan berhenti. Ini bukan kemungkinan
      -- teoretis: begitu satu baris diganti nama, `kunci_sekolah()`-nya ikut
      -- berubah, jadi pendaftaran berikutnya yang mengetik nama LAMA melahirkan
      -- baris baru lagi. Yang membuatnya ketahuan justru menjalankan migrasi
      -- ini dua kali di database dev, dengan impor pendaftaran di antaranya.
      -- `and <> nama_lama` bukan kehati-hatian berlebih: `SMAN 1 SINDANGKASIH`
      -- dan `SMAN 1 Sindangkasih` punya kunci_sekolah() yang SAMA — bedanya
      -- cuma huruf besar — jadi tanpa syarat ini barisnya menemukan DIRINYA
      -- SENDIRI, lalu mencoba menghapus dirinya dan ditolak foreign key
      -- pendaftaran. Kunci sama berarti satu baris, dan satu baris cuma perlu
      -- diganti namanya.
      if exists (select 1 from sekolah
                  where kunci_sekolah(name) = kunci_sekolah(r.nama_baku)
                    and kunci_sekolah(name) <> kunci_sekolah(r.nama_lama)) then
        update pendaftaran d
           set sekolah_id = (select id from sekolah where kunci_sekolah(name) = kunci_sekolah(r.nama_baku))
         where d.sekolah_id = (select id from sekolah where kunci_sekolah(name) = kunci_sekolah(r.nama_lama));
        get diagnostics v_p = row_count;

        update kejuaraan_manual m
           set sekolah_id = (select id from sekolah where kunci_sekolah(name) = kunci_sekolah(r.nama_baku))
         where m.sekolah_id = (select id from sekolah where kunci_sekolah(name) = kunci_sekolah(r.nama_lama));

        delete from sekolah where kunci_sekolah(name) = kunci_sekolah(r.nama_lama);
        update sekolah
           set name = r.nama_baku, address = r.alamat
         where kunci_sekolah(name) = kunci_sekolah(r.nama_baku)
           and (name, address) is distinct from (r.nama_baku, r.alamat);
        raise notice '0154: "%" dilebur ke "%" (% pendaftaran dialihkan)',
                     r.nama_lama, r.nama_baku, v_p;
        continue;
      end if;
      -- Dihitung hanya kalau namanya MEMANG masih beda. Baris yang sudah
      -- baku tetap cocok lewat kunci_sekolah() — `SMAN 1 SINDANGKASIH` dan
      -- `SMAN 1 Sindangkasih` satu kunci — dan menghitungnya membuat
      -- jalanan kedua melaporkan penggantian nama yang tidak terjadi.
      if exists (select 1 from sekolah
                  where kunci_sekolah(name) = kunci_sekolah(r.nama_lama)
                    and name <> r.nama_baku) then
        v_nama := v_nama + 1;
        raise notice '0154: nama "%" -> "%"', r.nama_lama, r.nama_baku;
      end if;
    end if;

    update sekolah
       set name = r.nama_baku, address = r.alamat
     where kunci_sekolah(name) = kunci_sekolah(r.nama_lama)
       and (name, address) is distinct from (r.nama_baku, r.alamat);
    if found then v_alamat := v_alamat + 1; end if;
  end loop;
  raise notice '0154: % baris dibakukan, % di antaranya ganti nama.', v_alamat, v_nama;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Buktikan rekap nilai tidak tersentuh, lalu sebutkan yang masih menunggu
--    jawaban pembina.
-- ---------------------------------------------------------------------------
do $$
declare
  s potret_nilai_0154%rowtype;
  n_regu int; n_nilai int; n_closing int; n_berangkat int; n_daftar int;
  v_kosong int; v_sekolah int;
begin
  select * into s from potret_nilai_0154;
  select count(*) into n_regu      from regu;
  select count(*) into n_nilai     from nilai_mentah;
  select count(*) into n_closing   from closing_regu;
  select count(*) into n_berangkat from keberangkatan_regu;
  select count(*) into n_daftar    from pendaftaran;

  assert (n_regu, n_nilai, n_closing, n_berangkat, n_daftar)
         = (s.regu, s.nilai_mentah, s.closing_regu, s.keberangkatan_regu, s.pendaftaran),
    format('0154: DATA NILAI BERGESER — regu %s->%s, nilai %s->%s, closing %s->%s, berangkat %s->%s, pendaftaran %s->%s',
           s.regu, n_regu, s.nilai_mentah, n_nilai, s.closing_regu, n_closing,
           s.keberangkatan_regu, n_berangkat, s.pendaftaran, n_daftar);

  assert not exists (select 1 from pendaftaran where sekolah_id is null),
    '0154: ada pendaftaran yang kehilangan sekolahnya';

  select count(*) into v_sekolah from sekolah;
  select count(*) into v_kosong  from sekolah where btrim(address) = '';
  raise notice '0154: % baris sekolah, % masih beralamat kosong.', v_sekolah, v_kosong;
  raise notice '0154: rekap nilai utuh — % regu, % nilai, % closing, % keberangkatan.',
               n_regu, n_nilai, n_closing, n_berangkat;

  raise notice '0154: MASIH MENUNGGU JAWABAN PEMBINA, sengaja tidak ditebak —';
  raise notice '0154:   SMK Lps Ciamis: SMK LPS 1 atau SMK LPS 2, dua-duanya Jl. R.E. Martadinata No. 23';
  raise notice '0154:   SMP AL Fadliliyah Darussalam, SMAN 1 Majalengka: nol regu, tidak mendesak';
end $$;

drop table if exists potret_nilai_0154;
drop table if exists lebur_0154;
drop table if exists baku_0154;
