-- ============================================================================
-- hrcd-rekap : 0127_nama_regu_dua_puluh_lima.sql
--
-- Batas atas nama regu naik dari 20 ke 25 karakter.
--
-- ---------------------------------------------------------------------------
-- KENAPA
--
-- Keputusan pemilik acara, dan yang memicunya nyata: 100 regu yang mendaftar
-- lewat Google Form XXXVII masuk lewat 0128, dan tiga di antaranya melewati
-- 20 — "COBOY GEULIS PASUNDAN" (21), "WIJAYA KUSUMA NAWASENA" (22),
-- "LAKSAMANA MALA HAYATI" (21). Form Google tidak tahu pagar kita, jadi nama
-- itu sudah beredar di sekolahnya sebelum sistem ini pernah melihatnya.
--
-- ---------------------------------------------------------------------------
-- KENAPA 25 TIDAK MENGKHIANATI ALASAN 20
--
-- 0051 menurunkan 20 dari lebar kolom Nama Regu di blangko pos: 48mm pada
-- 10pt memuat ~21 karakter kapital, jadi 20 memberi satu karakter jarak, dan
-- alasannya "supaya nama tidak terpotong DIAM-DIAM di kertas cadangan".
--
-- Angka 48mm itu sudah tidak berlaku. Kolomnya kini **44mm** — dipersempit
-- dengan sengaja, dan alasannya ditulis panjang di `web/style.css`: panitia
-- memilih kotak nilai yang lebar daripada nama yang utuh, dan 44mm memang
-- SUDAH di bawah kebutuhan nama 20 karakter. Blangko itu karena itu sudah
-- memotong hari ini, pada nama yang lolos pagar 20, dan elipsisnya adalah
-- jaring pengaman yang disengaja — bukan kecelakaan.
--
-- Jadi yang dijaga 20 sudah tidak dijaga oleh 20. Yang membuat pemotongan itu
-- tidak berbahaya juga sudah ditulis di sana: regu dikenali dari NOMOR DADA
-- di kolom pertama, bukan dari namanya.
--
-- Yang TIDAK ikut berubah, dan sengaja: lebar kolomnya. Melebarkannya
-- mengambil milimeter dari kolom penilaian — 23mm per kotak di Pos 3 yang
-- punya tujuh — dan itu keputusan panitia yang tidak diminta siapa pun untuk
-- dibatalkan.
--
-- ---------------------------------------------------------------------------
-- YANG IKUT BERUBAH
--
--   `regu_nama_panjang`                    check 1..20  -> 1..25
--   `NAMA_MAKS` di live/js/daftar.js       20 -> 25 (maxlength kotak isian)
--   pesan galat di web/js/api.js + live/   "paling panjang 20" -> 25
--
-- Ketiganya WAJIB bergerak bersama. Kotak isian yang masih `maxlength="20"`
-- membuat pembina tidak bisa mengetik nama yang database sebenarnya terima,
-- dan tidak ada galat apa pun yang muncul — hurufnya cuma berhenti masuk.
--
-- `regu_nama_regu_tiga_huruf` (0120) tidak disentuh: itu batas BAWAH, dan ia
-- menghitung HURUF sedangkan yang di sini menghitung KARAKTER.
-- ============================================================================

alter table regu drop constraint if exists regu_nama_panjang;
alter table regu add constraint regu_nama_panjang
  check (length(trim(nama_regu)) between 1 and 25);

comment on constraint regu_nama_panjang on regu is
  'Nama regu 1-25 karakter. Sampai 0127 batasnya 20, diturunkan dari lebar '
  'kolom blangko pos yang sejak itu justru dipersempit jadi 44mm dan memotong '
  'dengan elipsis atas keputusan panitia. Batas bawahnya terpisah: '
  'regu_nama_regu_tiga_huruf (0120), yang menghitung huruf, bukan karakter.';

do $blok$
declare v_n integer;
begin
  select count(*) into v_n from regu where length(trim(nama_regu)) > 20;
  raise notice '0127: batas nama regu 25 karakter terpasang; % nama yang ada melewati 20.', v_n;
end;
$blok$;
