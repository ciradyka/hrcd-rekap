-- ============================================================================
-- hrcd-rekap : 0115_sekolah_baku_dua_baris.sql
-- Dua baris `sekolah` yang lahir dari form pendaftaran, dirapikan dengan
-- tangan.
--
-- APA YANG TERJADI
--
-- Sampai 27 Agustus 2026 autocomplete sekolah menuntut ketikan menjadi
-- POTONGAN UTUH dari nama sekolah. Pembina mengetik "SMA 2", "SMAN 2 Ciamis"
-- tidak muncul karena satu huruf `n` di tengah, dan ia mendaftarkan
-- sekolahnya sendiri. Yang tertinggal dua baris:
--
--     sma 2 ciamis       <jl ahmad yani>
--     SMAN 1 MAJALENGKA  <jl jendral sudirman, Kabupaten Ciamis>
--
-- Pencariannya sudah diperbaiki (#607, #608) — itu menahan yang berikutnya,
-- tetapi tidak menyentuh yang sudah terlanjur ada. Migrasi inilah yang
-- menyentuhnya.
--
-- DUA BARIS, DUA MASALAH YANG BERBEDA
--
--   `sma 2 ciamis` adalah SEKOLAH YANG SAMA dengan `SMAN 2 Ciamis` yang
--   sudah ada di daftar kurasi (0063). Ia dilebur: pendaftarannya dialihkan,
--   barisnya dihapus. Baris kembar memecah pencarian, rekap, dan identitas
--   pendaftaran (CLAUDE.md 12.9) — dan alamat `jl ahmad yani` bukan alamat
--   SMAN 2 Ciamis, yang ada di Jl. K.H. Ahmad Dahlan No. 2.
--
--   `SMAN 1 MAJALENGKA` adalah SEKOLAH LAIN yang memang belum pernah ikut,
--   jadi ia TIDAK dilebur ke mana pun — nama dan alamatnya saja yang
--   dibakukan. Alamat yang diketik pembina menyebut "Kabupaten Ciamis"
--   padahal sekolahnya di Kabupaten Majalengka; itu bukan alamat yang boleh
--   dipakai pembina lain untuk memastikan sekolahnya benar.
--
-- KENAPA DITULIS TANGAN, BUKAN DENGAN NORMALISASI
--
-- Pelajaran 0062, dan ia mahal: 0061 mencocokkan produksi ke daftar kurasi
-- dengan kunci yang salah dan enam sekolah lolos tanpa dibakukan. Dua baris,
-- disebut satu per satu dari isi produksi yang benar-benar dibaca hari ini,
-- bisa diperiksa ulang oleh siapa pun tanpa perlu mempercayai satu fungsi
-- pun.
--
-- Alamat SMAN 1 Majalengka dari Dapodik (NPSN 20213893), bentuknya mengikuti
-- runbook-sekolah.md bagian 8: jalan, desa, Kec., kabupaten, provinsi + kode
-- pos, Indonesia.
--
-- BISA DIJALANKAN DUA KALI
--
-- Semua langkah di bawah mencari baris yang mau diubah lebih dulu. Kalau
-- barisnya sudah tidak ada — sudah dijalankan, atau database uji yang memang
-- tidak pernah memuatnya — tidak ada satu pun baris yang tersentuh.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Laporkan dulu apa yang akan diubah. Migrasi yang menghapus baris tanpa
--    menyebut baris mana adalah migrasi yang tidak bisa diperiksa sesudahnya.
-- ---------------------------------------------------------------------------
do $blok$
declare r record;
begin
  for r in
    select s.name, s.address,
           (select count(*) from pendaftaran d where d.sekolah_id = s.id) as n_daftar
      from sekolah s
     where s.name in ('sma 2 ciamis', 'SMAN 1 MAJALENGKA')
     order by s.name
  loop
    raise notice '0115: akan dirapikan — % <%>, % pendaftaran',
                 r.name, r.address, r.n_daftar;
  end loop;
end;
$blok$;

-- ---------------------------------------------------------------------------
-- 2. Lebur baris kembar ke baris kurasi.
--
--    Pemetaannya lewat `kunci_sekolah()`, bukan `=` biasa: yang dicari baris
--    TUJUAN-nya, dan nama tujuan ditulis di sini dalam ejaan bakunya. Kalau
--    suatu saat ejaan di produksi berbeda besar-kecil hurufnya, kunci itu
--    yang tetap menemukannya.
-- ---------------------------------------------------------------------------
-- Tanpa `on commit drop`: psql menjalankan tiap perintah dalam transaksinya
-- sendiri, jadi tabelnya akan lenyap sebelum baris berikutnya membacanya.
-- Ia dibuang sendiri di ujung berkas.
drop table if exists sekolah_lebur;
create temporary table sekolah_lebur (lama text, tujuan text);
insert into sekolah_lebur (lama, tujuan) values
  ('sma 2 ciamis', 'SMAN 2 Ciamis');

do $blok$
declare v_baris int; v_daftar int;
begin
  drop table if exists peta_lebur;
  create temporary table peta_lebur as
  select lama.id as id_lama, tujuan.id as id_tujuan, lama.name as nama_lama
    from sekolah_lebur m
    join sekolah lama   on lama.name = m.lama
    join sekolah tujuan on kunci_sekolah(tujuan.name) = kunci_sekolah(m.tujuan)
   where lama.id <> tujuan.id;

  select count(*) into v_baris from peta_lebur;
  if v_baris = 0 then
    raise notice '0115: tidak ada baris kembar yang perlu dilebur.';
    return;
  end if;

  update pendaftaran d set sekolah_id = p.id_tujuan
    from peta_lebur p
   where d.sekolah_id = p.id_lama;
  get diagnostics v_daftar = row_count;

  delete from sekolah where id in (select id_lama from peta_lebur);

  raise notice '0115: % baris kembar dihapus, % pendaftaran dialihkan.',
               v_baris, v_daftar;
end;
$blok$;

-- ---------------------------------------------------------------------------
-- 3. Nama dan alamat baku untuk sekolah yang memang baru.
--
--    Bukan peleburan: barisnya tetap, isinya yang dibetulkan. Id-nya tidak
--    berubah, jadi pendaftaran yang sudah menempel padanya tidak tersentuh
--    sama sekali.
-- ---------------------------------------------------------------------------
drop table if exists sekolah_ganti;
create temporary table sekolah_ganti (lama text, nama text, alamat text);
insert into sekolah_ganti (lama, nama, alamat) values
  ('SMAN 1 MAJALENGKA',
   'SMAN 1 Majalengka',
   'Jl. K.H. Abdul Halim No. 113, Majalengka Kulon, Kec. Majalengka, Kabupaten Majalengka, Jawa Barat 45418, Indonesia');

do $blok$
declare v_baris int;
begin
  -- `where` yang memang berarti: Supabase menolak UPDATE tanpa penyaring
  -- (CLAUDE.md 14.6), dan ekstensi yang menolaknya TIDAK ada di database uji.
  update sekolah s set name = g.nama, address = g.alamat
    from sekolah_ganti g
   where s.name = g.lama;
  get diagnostics v_baris = row_count;

  raise notice '0115: % nama sekolah dibakukan.', v_baris;
end;
$blok$;

-- ---------------------------------------------------------------------------
-- 4. Periksa hasilnya, lalu tinggalkan satu pagar untuk tahun depan.
--
--    Yang dilaporkan cuma SATU tanda: nama yang seluruhnya huruf kecil atau
--    seluruhnya huruf besar. Kedua baris yang dirapikan di atas berbentuk
--    persis begitu, dan tidak satu pun dari 188 baris kurasi lainnya —
--    juga tidak satu pun sekolah buatan tes.
--
--    Alamat sengaja TIDAK ikut diperiksa, walau "tidak berakhir Indonesia"
--    juga menandai keduanya. Sekolah yang benar-benar baru selalu masuk
--    dengan alamat ketikan pembina, jadi pemeriksaan itu akan menyala tiap
--    tahun untuk baris yang tidak salah apa-apa — dan pemeriksa yang
--    berbunyi palsu adalah pemeriksa yang berhenti dipercaya. Delapan
--    sekolah buatan tes SQL menyalakannya di database uji, dan itu saja
--    sudah cukup jadi bukti.
--
--    NOTICE, bukan galat: sekolah baru memang lahir dari ketikan, dan
--    menolaknya berarti menolak pendaftaran.
-- ---------------------------------------------------------------------------
do $blok$
declare r record; v_sisa int := 0;
begin
  assert not exists (select 1 from sekolah where name = 'sma 2 ciamis'),
    '0115: baris kembar sma 2 ciamis masih ada';
  assert not exists (select 1 from sekolah where name = 'SMAN 1 MAJALENGKA'),
    '0115: SMAN 1 MAJALENGKA belum dibakukan';

  for r in
    select name, address from sekolah
     where name = lower(name) or name = upper(name)
     order by name
  loop
    v_sisa := v_sisa + 1;
    raise notice '0115: nama masih berupa ketikan form — % <%>', r.name, r.address;
  end loop;

  if v_sisa = 0 then
    raise notice '0115: seluruh % baris sekolah sudah berbentuk baku.',
                 (select count(*) from sekolah);
  end if;
end;
$blok$;

drop table if exists peta_lebur;
drop table if exists sekolah_lebur;
drop table if exists sekolah_ganti;
