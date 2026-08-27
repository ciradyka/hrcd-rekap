-- ============================================================================
-- hrcd-rekap : tests/sql/87_nama_regu_angka_di_belakang.sql
--
-- Angka di nama regu boleh, tapi hanya di belakang (0128).
--
-- Tes 22 menguji larangan LAMA di tempatnya sendiri, sebelum migrasi ini, dan
-- memang harus tetap menolak "REGU 1" di sana.
--
--   87.1  "CAKRA 1" diterima          -- yang dibuka
--   87.2  "08477484" ditolak          -- nomor WA nyasar, yang tetap dijaga
--   87.3  "SMA 2 CIAMIS" ditolak      -- angka di tengah
--   87.4  nama KETUA berangka tetap ditolak -- pelonggaran tidak menular
-- ============================================================================

\set ON_ERROR_STOP on

begin;

insert into sekolah (name, address) values ('SMKN Uji 87', 'Ciamis');
insert into pendaftaran (sekolah_id, kode_pembayaran, jumlah_regu, kontak_wa)
select id, 'HRCD37-T87001', 1, '081200000087' from sekolah where name = 'SMKN Uji 87';

-- 87.1  Angka sebagai ekor diterima.
insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
select id, 'CAKRA 1', 'Uji Ketua', 'penegak_pi'
from pendaftaran where kode_pembayaran = 'HRCD37-T87001';

do $blok$
begin
  if not exists (select 1 from regu where nama_regu = 'CAKRA 1') then
    raise exception '87.1 GAGAL: "CAKRA 1" tidak tersimpan';
  end if;
  raise notice '87.1 LULUS: angka sebagai ekor diterima.';
end;
$blok$;

-- 87.2  Nomor yang nyasar ke kotak nama tetap ditolak. Yang menangkapnya bisa
--       check ini ATAU batas tiga huruf (0120) — keduanya benar, dan tes ini
--       sengaja tidak memilih salah satunya: yang diuji bahwa ia TIDAK MASUK.
do $blok$
begin
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
    select id, '08477484', 'Uji Ketua', 'penegak_pa'
    from pendaftaran where kode_pembayaran = 'HRCD37-T87001';
    raise exception '87.2 GAGAL: nama yang seluruhnya angka diterima';
  exception when check_violation then
    raise notice '87.2 LULUS: nomor yang nyasar ke kotak nama ditolak.';
  end;
end;
$blok$;

-- 87.3  Angka di TENGAH ditolak.
do $blok$
begin
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
    select id, 'SMA 2 CIAMIS', 'Uji Ketua', 'penggalang_pa'
    from pendaftaran where kode_pembayaran = 'HRCD37-T87001';
    raise exception '87.3 GAGAL: angka di tengah nama diterima';
  exception when check_violation then
    raise notice '87.3 LULUS: angka di tengah nama ditolak.';
  end;
end;
$blok$;

-- 87.4  Nama ORANG tetap menolak angka apa pun — termasuk di belakang.
do $blok$
begin
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
    select id, 'ELANG SENJA', 'Uji Ketua 2', 'penggalang_pi'
    from pendaftaran where kode_pembayaran = 'HRCD37-T87001';
    raise exception '87.4 GAGAL: nama ketua berangka diterima';
  exception when check_violation then
    raise notice '87.4 LULUS: nama ketua berangka tetap ditolak.';
  end;
end;
$blok$;

rollback;
