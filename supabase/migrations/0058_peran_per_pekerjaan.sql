-- ============================================================================
-- hrcd-rekap : 0058_peran_per_pekerjaan.sql
-- Peran mengikuti pekerjaan yang benar-benar ada di lapangan.
--
-- KENAPA
--
-- Tiga peran lama dinamai menurut TEMPAT DUDUK, bukan pekerjaan: `meja`
-- adalah semua yang duduk di meja, dan itu menyatukan empat pekerjaan yang di
-- lapangan dipegang orang berbeda — yang menerima pendaftaran, yang
-- memverifikasi pembayaran, yang memberi nomor dada, dan yang memberangkatkan
-- kloter. Koordinator yang ingin satu orang hanya memegang pembayaran tetap
-- harus memberinya seluruh paket.
--
-- Peran baru dinamai menurut pekerjaannya:
--
--   registrasi  pendaftaran, pembayaran, daftar ulang, daftar kloter
--   gerbang     keberangkatan, kedatangan
--   juri_pos    satu pos, ditentukan kolom `pos` (1-5 di edisi 37)
--   admin       semuanya
--
-- `gerbang` menamai TEMPATNYA, dan itu disengaja: Pos 0 dan Pos 5 adalah
-- garis start dan garis finish (migrasi 0025) — satu tempat yang sama,
-- disebut dua nama menurut arah lari. Orang yang berjaga di sana memegang
-- keduanya.
--
-- SEMUA PERAN MEMEGANG LIVE SCORE. Papan itu versi panitia (v_klasemen_live
-- _score, cuma peran admin di database sampai 0057) dan tidak membocorkan apa
-- pun ke peserta — fase live yang menentukan itu. Yang berjaga di pos ingin
-- tahu klasemen sama seperti yang di meja.
--
-- APA YANG BERUBAH UNTUK AKUN YANG SUDAH ADA
--
-- Ini BUKAN migrasi yang netral seperti 0057. Peran lama dipindah:
--
--   meja          -> registrasi   KEHILANGAN keberangkatan + kedatangan
--   operator_pos  -> juri_pos     tidak berubah, kecuali dapat live score
--
-- Yang kehilangan itu disengaja — pekerjaan gerbang sekarang punya perannya
-- sendiri. Kalau ada orang yang memang memegang keduanya, koordinator
-- mencentangnya kembali di layar Akun; centang selalu menang atas peran
-- (0057), dan itulah gunanya.
--
-- Migrasi ini MENULIS ULANG hak tiap akun sesuai paket perannya. Centang yang
-- pernah disesuaikan tangan akan hilang. Itu bisa diterima sekarang karena
-- layar Akun baru dipasang hari ini dan belum ada yang menyesuaikannya; kalau
-- suatu hari perlu diulang, jangan lakukan ini begitu saja.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Nilai peran yang diizinkan.
--
--    Dua check constraint sekaligus: yang mendaftar nilainya, dan yang
--    memasangkan peran dengan kolom `pos`. Yang kedua sempat terlewat waktu
--    ditulis pertama kali dan baru ketahuan karena juri_pos jadi tidak wajib
--    punya pos sama sekali.
-- ---------------------------------------------------------------------------
-- IF EXISTS: berkas ini dijalankan ulang di tests/dev_database.sh sesudah
-- seed, dan di sana constraint-nya sudah dilepas lebih dulu supaya seed yang
-- memakai nama peran lama bisa masuk.
alter table akun_panitia drop constraint if exists akun_panitia_peran_check;
alter table akun_panitia drop constraint if exists akun_panitia_check;

update akun_panitia set peran = 'registrasi' where peran = 'meja';
update akun_panitia set peran = 'juri_pos'   where peran = 'operator_pos';

alter table akun_panitia add constraint akun_panitia_peran_check
  check (peran in ('admin', 'registrasi', 'gerbang', 'juri_pos'));
-- juri_pos wajib punya pos; peran lain wajib tidak.
alter table akun_panitia add constraint akun_panitia_check
  check ((peran = 'juri_pos') = (pos is not null));

-- ---------------------------------------------------------------------------
-- 2. Paket tiap peran. Satu tempat — dipakai migrasi ini, layar Akun waktu
--    membuat akun, Worker gateway, dan provision_accounts.py.
--
--    `live_score` ada di SEMUA paket. Kalau suatu hari ada peran yang tidak
--    boleh melihat klasemen, keluarkan dari paketnya di sini, bukan dengan
--    mencabut centangnya satu per satu.
-- ---------------------------------------------------------------------------
create or replace function paket_peran(p_peran text)
returns text[]
language sql immutable
as $$
  select case p_peran
    when 'admin' then array[
      'pendaftaran','pembayaran','daftar_ulang','cetak_kloter',
      'keberangkatan','kedatangan','pos','live_score','rekap','akun',
      'pengaturan']
    when 'registrasi' then array[
      'pendaftaran','pembayaran','daftar_ulang','cetak_kloter','live_score']
    when 'gerbang' then array[
      'keberangkatan','kedatangan','live_score']
    -- Posnya sendiri yang membatasi barisnya — pos_saya(), tidak disentuh.
    when 'juri_pos' then array['pos','live_score']
    else array[]::text[]
  end
$$;

-- ---------------------------------------------------------------------------
-- 3. Tulis ulang hak tiap akun sesuai paket perannya. Lihat catatan di kepala
--    berkas: ini menghapus centang yang pernah disesuaikan tangan.
-- ---------------------------------------------------------------------------
delete from akun_hak;
insert into akun_hak (user_id, fitur)
select a.user_id, f
from akun_panitia a, unnest(paket_peran(a.peran)) as f
on conflict do nothing;

do $$
declare r record;
begin
  for r in
    select a.peran, count(distinct a.user_id) akun, count(h.fitur) / greatest(count(distinct a.user_id), 1) fitur
      from akun_panitia a left join akun_hak h on h.user_id = a.user_id
     group by a.peran order by a.peran
  loop
    raise notice '0058: peran % — % akun, % fitur masing-masing', r.peran, r.akun, r.fitur;
  end loop;
end $$;

comment on function paket_peran(text) is
  'Centang awal tiap peran. Dipakai migrasi, layar Akun, Worker, dan provision_accounts.py — satu daftar, bukan empat.';
