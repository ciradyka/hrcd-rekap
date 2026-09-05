-- ============================================================================
-- hrcd-rekap : stok_nomor_dada.sql
--
-- Menyamakan `nomor_dada_stok` dengan KAIN YANG BENAR-BENAR DICETAK panitia.
--
-- HRCD XXXVII:
--
--     Eksternal   001 - 250
--     Internal     1001 - 1100
--
-- ---------------------------------------------------------------------------
-- KENAPA BUKAN MIGRASI
--
-- Stok bukan skema, melainkan DATA OPERASIONAL satu edisi — daftar kain yang
-- dibawa panitia tahun ini. Migrasi dijalankan juga di database uji, dan di
-- sana 300 regu disimulasikan serentak oleh `tests/concurrency_test.py`;
-- memangkas stok jadi 250 lewat migrasi akan mematikan uji beban yang tidak
-- ada hubungannya dengan kain edisi 37. Berkas ini dijalankan dengan sengaja,
-- ke produksi saja, lewat `apply-migration.yml`.
--
-- ---------------------------------------------------------------------------
-- APA YANG BERUBAH KARENA STOK BENAR
--
-- Tiga hal ikut membetulkan dirinya sendiri, karena ketiganya membaca stok
-- dan bukan angka yang ditulis di kode:
--
--   1. Pesan galat Meja Daftar Ulang. `v_rentang_nomor_dada` (0116) menyusun
--      kalimatnya dari isi stok, jadi ia langsung berbunyi "Nomor dada intern
--      adalah dari 1001 - 1100" tanpa satu baris kode pun disentuh.
--   2. Lembar cadangan "form tabel" di layar Input Pos dicetak satu baris per
--      nomor yang ADA di stok. Stok yang kelebihan berarti ratusan baris
--      kosong bernomor kain yang tidak pernah dibawa siapa pun, dan tiap
--      barisnya menyuruh petugas mencari slip yang tidak ada.
--   3. Nomor di luar kain fisik ditolak sejak di meja ("nomor dada di luar
--      stok yang disiapkan admin").
--
-- ---------------------------------------------------------------------------
-- YANG TIDAK AKAN DIHAPUS
--
-- Nomor yang SUDAH DIPAKAI regu atau sudah dipensiunkan tidak disentuh, apa
-- pun isi daftar di atas — keduanya kenyataan lapangan yang lebih berhak
-- daripada daftar ini, dan foreign key-nya memang menahan. Semuanya
-- dilaporkan satu per satu supaya yang menjalankan tahu persis apa yang
-- tersisa dan kenapa.
--
-- Aman dijalankan dua kali.
-- ============================================================================

drop table if exists stok_kain;
create temporary table stok_kain (jenis text, dari integer, sampai integer);
insert into stok_kain (jenis, dari, sampai) values
  ('Eksternal',    1,  250),
  ('Internal',    1001, 1100);

-- ---------------------------------------------------------------------------
-- 1. Keadaan sekarang, sebelum disentuh.
-- ---------------------------------------------------------------------------
do $blok$
declare r record;
begin
  for r in
    select k.jenis, k.dari, k.sampai,
           (select count(*) from nomor_dada_stok s
             where s.nomor between k.dari and k.sampai) as di_dalam,
           (select count(*) from nomor_dada_stok s
             where s.nomor between k.dari and k.sampai
               and exists (select 1 from regu g where g.nomor_dada = s.nomor)) as terpakai
    from stok_kain k order by k.dari
  loop
    raise notice 'stok: % % - % — % nomor ada, % sudah dipakai regu',
                 r.jenis, r.dari, r.sampai, r.di_dalam, r.terpakai;
  end loop;

  raise notice 'stok: % nomor di luar kedua deret (akan diperiksa satu per satu)',
    (select count(*) from nomor_dada_stok s
      where not exists (select 1 from stok_kain k
                        where s.nomor between k.dari and k.sampai));
end;
$blok$;

-- ---------------------------------------------------------------------------
-- 2. Lengkapi yang kurang.
-- ---------------------------------------------------------------------------
insert into nomor_dada_stok (nomor)
select g from stok_kain k, generate_series(k.dari, k.sampai) g
on conflict (nomor) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Buang yang berlebih — kecuali yang sudah dipakai atau dipensiunkan.
-- ---------------------------------------------------------------------------
do $blok$
declare r record; v_buang int; v_tahan int := 0;
begin
  for r in
    select s.nomor,
           (select g.nama_regu from regu g where g.nomor_dada = s.nomor) as regu,
           exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor) as pensiun
    from nomor_dada_stok s
    where not exists (select 1 from stok_kain k
                      where s.nomor between k.dari and k.sampai)
      and (exists (select 1 from regu g where g.nomor_dada = s.nomor)
           or exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor))
    order by s.nomor
  loop
    v_tahan := v_tahan + 1;
    raise notice 'stok: % DITAHAN — %', r.nomor,
      case when r.regu is not null then format('dipakai regu %s', r.regu)
           else 'sudah dipensiunkan' end;
  end loop;

  delete from nomor_dada_stok s
   where not exists (select 1 from stok_kain k
                     where s.nomor between k.dari and k.sampai)
     and not exists (select 1 from regu g where g.nomor_dada = s.nomor)
     and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor);
  get diagnostics v_buang = row_count;

  raise notice 'stok: % nomor dibuang, % ditahan.', v_buang, v_tahan;
end;
$blok$;

-- ---------------------------------------------------------------------------
-- 4. Hasilnya, dan apa yang akan tercetak.
-- ---------------------------------------------------------------------------
do $blok$
declare r record;
begin
  select * into r from v_rentang_nomor_dada;
  raise notice 'stok: SEKARANG Eksternal % - %, Internal % - %.',
               r.eksternal_mulai, r.eksternal_sampai, r.intern_mulai, r.intern_sampai;
  raise notice 'stok: lembar cadangan "form tabel" akan mencetak % baris.',
               (select count(*) from nomor_dada_stok);

  -- Deret yang berlubang membuat lembar cadangan mencetak nomor yang tidak
  -- ada: layar membangunnya dari ujung ke ujung tiap deret, bukan dari daftar
  -- nomornya satu per satu. Kalau baris ini menyala, periksa "DITAHAN" di
  -- atas — nomor yang tertahan di luar deret itulah lubangnya.
  if (select count(*) from nomor_dada_stok)
     <> (select coalesce(sum(sampai - dari + 1), 0) from stok_kain) then
    raise notice 'stok: PERHATIAN — isi stok tidak persis sama dengan kedua '
                 'deret, jadi lembar cadangan bisa memuat nomor yang tidak ada.';
  end if;
end;
$blok$;

drop table if exists stok_kain;
