-- ============================================================================
-- hrcd-rekap : 0097_kontrak_boleh_dari_gerbang.sql
-- Petugas gerbang boleh mengisi kontrak waktu.
--
-- ---------------------------------------------------------------------------
-- APA YANG SALAH, DAN KENAPA IA MENGHENTIKAN PAGI HARI-H
--
-- `konfirmasi_kontrak` dipagari `boleh('daftar_ulang')`. Satu-satunya yang
-- memanggilnya di seluruh aplikasi adalah kolom "Kontrak waktu" di layar
-- Keberangkatan (web/js/app.js), dan layar itu digerbangi hak `keberangkatan`.
-- Kedua hak itu tidak pernah bertemu di satu peran:
--
--   registrasi  pendaftaran, pembayaran, daftar_ulang, cetak_kloter,
--               live_score          -> punya haknya, tidak bisa buka layarnya
--   gerbang     keberangkatan, kedatangan, live_score
--                                   -> bisa buka layarnya, tidak punya haknya
--
-- Jadi selain admin, TIDAK ADA yang bisa mengisi `regu.kontrak_menit`. Dan
-- `berangkatkan_kloter` (0064) menolak kloter yang masih memuat regu tanpa
-- kontrak — jadi Kloter 1 tidak bisa diberangkatkan pukul 07:00 sementara
-- upacara sudah berjalan, tanpa jalan keluar dari layar itu.
--
-- Ini sisa pemetaan 0064. Peran lama `meja` memegang meja pendaftaran DAN
-- garis start sekaligus (0018 menulis pagarnya `peran() not in ('admin',
-- 'meja')`), lalu 0058 memecahnya jadi registrasi + gerbang. Saat 0064
-- menerjemahkan seluruh pagar ke `boleh()`, `ceklis_berangkat` di berkas yang
-- sama dipetakan ke `keberangkatan` dengan benar; yang ini ikut terbawa ke
-- `daftar_ulang` karena dulu satu peran mengerjakan keduanya.
--
-- ---------------------------------------------------------------------------
-- KENAPA DUA HAK, BUKAN DIPINDAH KE `keberangkatan` SAJA
--
-- Konfirmasi kontrak memang pekerjaan garis start — `v_keberangkatan` bahkan
-- punya posisi 'konfirmasi_kontrak' untuk kloter yang masih tiga giliran lagi,
-- supaya petugas staging menanyakannya sebelum kloternya maju. Tetapi meja
-- daftar ulang juga menanyakannya saat menyerahkan nomor dada, dan sebelum
-- 0058 memang satu orang yang mengerjakan keduanya. Mencabutnya dari
-- `daftar_ulang` akan menutup pintu yang selama ini terbuka untuk admin dan
-- registrasi tanpa satu pun alasan lapangan.
--
-- `boleh_apa_saja()` (0064) sudah ada persis untuk hal seperti ini.
--
-- Yang TIDAK berubah: pagar "regu ini sudah berangkat" tetap hanya bisa
-- ditembus pemegang `pengaturan`. Kontrak menentukan penalti yang sudah
-- berjalan, dan itu koreksi yang harus meninggalkan jejak.
-- ============================================================================

create or replace function konfirmasi_kontrak(
  p_regu  uuid,
  p_menit smallint
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_kloter smallint;
begin
  -- INI yang berubah. Dua pintu untuk satu pekerjaan, karena dua meja memang
  -- mengerjakannya: garis start saat memanggil kloter, dan meja daftar ulang
  -- saat menyerahkan nomor dada.
  if not boleh_apa_saja('keberangkatan', 'daftar_ulang') then
    raise exception 'tidak berhak: keberangkatan';
  end if;
  if not exists (select 1 from kontrak_opsi
                 where edisi = edisi_aktif() and menit = p_menit) then
    raise exception 'kontrak % menit bukan pilihan edisi ini', p_menit;
  end if;

  select kloter_nomor into v_kloter from regu where id = p_regu;
  if not found then
    raise exception 'regu tidak ditemukan';
  end if;
  if v_kloter is null then
    raise exception 'regu belum daftar ulang (belum punya kloter)';
  end if;
  -- Setelah REGU INI tercatat berangkat, kontraknya menentukan penalti yang
  -- sudah berjalan — perbaikan susulan hanya lewat admin. Kloter yang pergi
  -- tanpa dia tidak menghalangi apa pun.
  if not boleh('pengaturan') and regu_sudah_berangkat(p_regu) then
    raise exception 'regu ini sudah berangkat — koreksi kontrak hanya lewat admin';
  end if;

  update regu set kontrak_menit = p_menit where id = p_regu;
end;
$$;

comment on function konfirmasi_kontrak(uuid, smallint) is
  'Mencatat kontrak waktu satu regu. Boleh dari garis start (hak keberangkatan) maupun dari meja daftar ulang (hak daftar_ulang) — keduanya menanyakannya, dan sebelum 0058 keduanya satu peran.';
