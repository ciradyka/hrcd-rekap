-- ============================================================================
-- hrcd-rekap : 0128_nama_regu_angka_di_belakang.sql
--
-- Nama regu boleh memuat angka, TAPI hanya sebagai ekor: "CAKRA 1" diterima,
-- "08477484" dan "SMA 2 CIAMIS" tidak.
--
-- Hanya `regu.nama_regu` yang melonggar. `nama_ketua`, `regu.anggota`, dan
-- `pendaftaran.nama_kontak` tetap menolak angka mana pun -- alasannya di
-- bawah, dan ia berbeda dari alasan nama regu.
--
-- ---------------------------------------------------------------------------
-- KENAPA
--
-- Keputusan pemilik acara, dipicu enam regu SMKN 2 Ciamis yang mendaftar lewat
-- Google Form XXXVII: CAKRA 1, CAKRA 2, CAKRA 4, AGRESI 1, AGRESI 2, AGRESI 3.
-- Satu sekolah mengirim enam regu dan menomorinya untuk membedakan -- cara
-- yang wajar, dan sudah dipakai sebelum sistem ini pernah melihat namanya.
--
-- 0052 melarang seluruh angka, dengan dua alasan. Yang ini menerima alasan
-- pertama seutuhnya dan melepas yang kedua:
--
--   1. KOLOM TERTUKAR -- nomor WhatsApp diketik di kotak Nama. Ini yang
--      dijaga, dan bentuknya khas: angkanya di DEPAN dan tidak ada nama sama
--      sekali. "08477484" tetap ditolak, dan itulah seluruh isi migrasi ini.
--
--   2. REGU DINOMORI SENDIRI -- "REGU 1", "REGU 2", bersaing dengan nomor
--      dada di lembar yang sama. Ini yang dilepas: pemilik acara memutuskan
--      pembina boleh menomori regunya, karena "CAKRA 1" dan "CAKRA 2" memang
--      dua regu berbeda dari satu sekolah dan tidak ada nama lain yang mereka
--      pakai.
--
-- ---------------------------------------------------------------------------
-- BENTUKNYA
--
--   trim(nama_regu) ~ '^[^0-9]+[0-9]*$'
--
-- Dibaca: satu atau lebih karakter BUKAN angka, lalu angka sebanyak apa pun
-- di ujung, lalu habis. Tiga akibatnya, dan ketiganya disengaja:
--
--   diterima   CAKRA 1, AGRESI 3, RAJAWALI, ELANG-2
--   ditolak    08477484        angka di depan, tidak ada namanya
--   ditolak    SMA 2 CIAMIS    angka di TENGAH -- bukan penomoran regu,
--                              hampir selalu isian yang nyasar
--
-- Nama yang cuma angka juga sudah ditolak oleh `regu_nama_regu_tiga_huruf`
-- (0120), yang menuntut minimal tiga HURUF. Dua pagar itu tidak tumpang
-- tindih: 0120 menghitung huruf, yang ini mengatur letaknya.
--
-- ---------------------------------------------------------------------------
-- KENAPA KOLOM NAMA ORANG TIDAK IKUT
--
-- Alasan kedua di atas cuma berlaku untuk nama regu. Tidak ada seorang pun
-- bernama "Nur Aisyah 2", jadi angka di kolom nama orang tetap berarti kolom
-- tertukar, dan pelonggaran yang sama di sana hanya membuka kembali kekeliruan
-- yang baru ketahuan di meja daftar ulang saat pembinanya sudah pulang.
--
-- ---------------------------------------------------------------------------
-- YANG WAJIB IKUT BERUBAH
--
--   `ADA_ANGKA` di live/js/daftar.js -- dipakai enam tempat, dan HANYA yang
--   memeriksa nama regu yang boleh berganti. Lima sisanya nama orang.
--   Pesan galat di web/js/api.js + salinan live/.
--
-- Form yang masih menolak "CAKRA 1" sambil diketik membuat pembina berhenti
-- mengetik pada aturan yang database sebenarnya sudah terima -- dan tidak ada
-- galat apa pun yang muncul di sisi kita.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Berhenti lebih dulu kalau ada nama yang bahkan aturan baru ini tolak, dengan
-- menyebut pelanggarnya. Aturan yang MELONGGAR memang tidak mungkin menolak
-- baris yang tadinya lolos -- tapi berkas ini juga dijalankan di database yang
-- pernah menerima nama lewat jalur lain, dan pesan Postgres hanya menyebut
-- satu baris.
-- ---------------------------------------------------------------------------
do $blok$
declare v_sisa text;
begin
  select string_agg(nama_regu, ', ') into v_sisa
  from regu
  where not is_cancelled and trim(nama_regu) !~ '^[^0-9]+[0-9]*$';

  if v_sisa is not null then
    raise exception '0128: nama regu berikut tetap tidak sah -- angkanya bukan di belakang: %', v_sisa;
  end if;
  raise notice '0128: data yang ada lolos aturan angka-di-belakang.';
end;
$blok$;

alter table regu drop constraint if exists regu_nama_regu_tanpa_angka;
alter table regu drop constraint if exists regu_nama_regu_angka_di_belakang;
alter table regu add constraint regu_nama_regu_angka_di_belakang
  check (trim(nama_regu) ~ '^[^0-9]+[0-9]*$');

comment on constraint regu_nama_regu_angka_di_belakang on regu is
  'Angka boleh, tapi hanya sebagai ekor: "CAKRA 1" ya, "08477484" dan '
  '"SMA 2 CIAMIS" tidak. Sampai 0128 aturannya melarang angka mana pun; yang '
  'dilepas cuma larangan menomori regu, bukan pagar terhadap nomor WA yang '
  'nyasar ke kotak nama. Kolom nama ORANG tetap menolak angka apa pun (0052).';
