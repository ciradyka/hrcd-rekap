-- ============================================================================
-- hrcd-rekap : tests/sql/86_nama_regu_dua_puluh_lima.sql
--
-- Batas atas nama regu 25 karakter (0127). Tes 21 menguji batas LAMA di
-- tempatnya sendiri — ia berjalan sebelum 0127 dan memang harus tetap
-- menolak 21 karakter di sana, karena itulah yang benar pada saat itu.
--
-- Yang diuji di sini tiga hal, dan yang ketiga yang paling mudah lupa:
--   86.1  25 karakter DITERIMA
--   86.2  26 karakter DITOLAK
--   86.3  batas bawah tiga huruf (0120) masih berlaku
-- ============================================================================

\set ON_ERROR_STOP on

begin;

insert into sekolah (name, address) values ('SMPN Uji 86', 'Ciamis');
insert into pendaftaran (sekolah_id, kode_pembayaran, jumlah_regu, kontak_wa)
select id, 'HRCD37-T86001', 1, '081200000086' from sekolah where name = 'SMPN Uji 86';

-- 86.1  Tepat 25 karakter diterima.
insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
select id, 'ABCDEFGHIJ KLMNO PQRSTUV', 'Uji Ketua', 'penggalang_pa'
from pendaftaran where kode_pembayaran = 'HRCD37-T86001';

do $blok$
begin
  if not exists (select 1 from regu
                 where nama_regu = 'ABCDEFGHIJ KLMNO PQRSTUV') then
    raise exception '86.1 GAGAL: nama 25 karakter tidak tersimpan';
  end if;
  raise notice '86.1 LULUS: nama 25 karakter diterima.';
end;
$blok$;

-- 86.2  Dua puluh enam karakter ditolak.
do $blok$
begin
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
    select id, 'ABCDEFGHIJ KLMNO PQRSTUVWX', 'Uji Ketua', 'penggalang_pi'
    from pendaftaran where kode_pembayaran = 'HRCD37-T86001';
    raise exception '86.2 GAGAL: nama 26 karakter diterima';
  exception when check_violation then
    raise notice '86.2 LULUS: nama 26 karakter ditolak.';
  end;
end;
$blok$;

-- 86.3  Batas bawah 0120 tidak ikut longgar.
do $blok$
begin
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
    select id, 'A B', 'Uji Ketua', 'penegak_pa'
    from pendaftaran where kode_pembayaran = 'HRCD37-T86001';
    raise exception '86.3 GAGAL: nama dua huruf diterima';
  exception when check_violation then
    raise notice '86.3 LULUS: batas bawah tiga huruf masih berlaku.';
  end;
end;
$blok$;

rollback;
