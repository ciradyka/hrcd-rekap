-- ============================================================================
-- hrcd-rekap : 0156_smk_lps_satu_dan_dua.sql
-- `SMK Lps Ciamis` dilengkapi angkanya, dan saudaranya ikut didaftarkan.
--
-- KENAPA ADA
--
-- Di Jl. R.E. Martadinata No. 23 berdiri DUA sekolah: SMK LPS 1 Ciamis
-- (NPSN 20211529) dan SMK LPS 2 Ciamis (NPSN 20251831). Keduanya satu alamat,
-- satu desa, dan yang membedakannya cuma angka di namanya. Pendaftaran XXXVII
-- masuk dengan nama `SMK Lps Ciamis` — tanpa angka — jadi tidak ada satu pun
-- data yang bisa memutuskan yang mana.
--
-- 0154 sengaja tidak menebaknya dan mencatatnya lewat `raise notice`. Pemilik
-- acara menjawab: yang mendaftar **LPS 1**.
--
-- KENAPA LPS 2 IKUT DIMASUKKAN PADAHAL BELUM ADA YANG MENDAFTAR
--
-- Karena namanya yang membedakan keduanya, dan nama itu baru berarti kalau
-- lawannya juga ada (CLAUDE.md 12.8). `SMK LPS 1 Ciamis` yang berdiri sendiri
-- di kotak pilihan pendaftaran terbaca seperti satu-satunya LPS, dan pembina
-- LPS 2 tahun depan akan memilihnya — persis kesalahan yang angka itu dibuat
-- untuk mencegah. Nol regu bukan alasan menundanya; justru inilah saat yang
-- murah untuk memasangnya.
--
-- ALAMAT KEDUANYA SAMA, DAN ITU MEMANG BENAR
--
-- Data Referensi menulis keduanya di Jl. RE Martadinata No. 23, desa Maleber,
-- Kec. Ciamis. Kode pos Maleber 46214 — angka yang sama dipakai empat sekolah
-- kurasi lain di desa itu (MA Darul Huda, SMA Informatika Ciamis, SMAN 3
-- Ciamis, SMKN 2 Ciamis), jadi ia bukan tebakan dari kecamatan.
--
-- REKAP NILAI TIDAK DISENTUH. Satu baris diganti nama dan alamat, satu baris
-- baru ditambahkan; tidak ada yang dilebur maupun dihapus, jadi tidak ada
-- `pendaftaran.sekolah_id` yang berpindah. Blok penutup membuktikannya dengan
-- membandingkan jumlah baris sebelum dan sesudah.
--
-- BISA DIJALANKAN DUA KALI: penggantian nama menyaring nama lamanya, dan
-- penambahan memakai `where not exists`.
-- ============================================================================

drop table if exists potret_0156;
create temporary table potret_0156 as
select (select count(*) from regu)        as regu,
       (select count(*) from nilai_mentah) as nilai_mentah,
       (select count(*) from closing_regu) as closing_regu,
       (select count(*) from pendaftaran)  as pendaftaran;

do $$
declare
  v_alamat constant text :=
    'Jl. R.E. Martadinata No. 23, Maleber, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat 46214, Indonesia';
  v_n int;
begin
  -- 1. Yang sudah ada dilengkapi angkanya. Dicocokkan lewat kunci_sekolah()
  --    supaya ejaan `Lps` / `LPS` / `lps` sama-sama tertangkap.
  update sekolah
     set name = 'SMK LPS 1 Ciamis', address = v_alamat
   where kunci_sekolah(name) = kunci_sekolah('SMK Lps Ciamis')
     and (name, address) is distinct from ('SMK LPS 1 Ciamis', v_alamat);
  get diagnostics v_n = row_count;
  if v_n > 0 then
    raise notice '0156: "SMK Lps Ciamis" -> "SMK LPS 1 Ciamis" (NPSN 20211529).';
  else
    raise notice '0156: (dilewati) tidak ada baris "SMK Lps Ciamis" untuk dilengkapi.';
  end if;

  -- 2. Keduanya didaftarkan kalau belum ada. LPS 1 ikut di sini, bukan cuma
  --    diandalkan dari penggantian nama di atas: database uji dan dev tidak
  --    pernah memuat baris `SMK Lps Ciamis`, jadi tanpa langkah ini migrasinya
  --    benar di produksi dan berhenti di tempat lain.
  insert into sekolah (name, address)
  select 'SMK LPS 1 Ciamis', v_alamat
   where not exists (select 1 from sekolah
                      where kunci_sekolah(name) = kunci_sekolah('SMK LPS 1 Ciamis'));
  get diagnostics v_n = row_count;
  if v_n > 0 then
    raise notice '0156: baris "SMK LPS 1 Ciamis" ditambahkan (NPSN 20211529).';
  end if;

  insert into sekolah (name, address)
  select 'SMK LPS 2 Ciamis', v_alamat
   where not exists (select 1 from sekolah
                      where kunci_sekolah(name) = kunci_sekolah('SMK LPS 2 Ciamis'));
  get diagnostics v_n = row_count;
  if v_n > 0 then
    raise notice '0156: baris "SMK LPS 2 Ciamis" ditambahkan (NPSN 20251831).';
  end if;

  assert exists (select 1 from sekolah where name = 'SMK LPS 1 Ciamis'),
    '0156: SMK LPS 1 Ciamis tidak ada sesudah migrasi ini';
  assert exists (select 1 from sekolah where name = 'SMK LPS 2 Ciamis'),
    '0156: SMK LPS 2 Ciamis tidak ada sesudah migrasi ini';
  assert not exists (select 1 from sekolah where kunci_sekolah(name) = kunci_sekolah('SMK Lps Ciamis')),
    '0156: nama tanpa angka masih ada';
end $$;

do $$
declare
  s potret_0156%rowtype;
  n_regu int; n_nilai int; n_closing int; n_daftar int;
begin
  select * into s from potret_0156;
  select count(*) into n_regu    from regu;
  select count(*) into n_nilai   from nilai_mentah;
  select count(*) into n_closing from closing_regu;
  select count(*) into n_daftar  from pendaftaran;

  assert (n_regu, n_nilai, n_closing, n_daftar)
         = (s.regu, s.nilai_mentah, s.closing_regu, s.pendaftaran),
    format('0156: DATA NILAI BERGESER — regu %s->%s, nilai %s->%s, closing %s->%s, pendaftaran %s->%s',
           s.regu, n_regu, s.nilai_mentah, n_nilai, s.closing_regu, n_closing,
           s.pendaftaran, n_daftar);

  raise notice '0156: rekap nilai utuh — % regu, % nilai, % closing, % pendaftaran.',
               n_regu, n_nilai, n_closing, n_daftar;
end $$;

drop table if exists potret_0156;
