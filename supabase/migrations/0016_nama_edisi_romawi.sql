-- ============================================================================
-- hrcd-rekap : 0016_nama_edisi_romawi.sql
--
-- Nama edisi yang DIBACA ORANG memakai angka Romawi: "HRCD XXXVII".
-- Itu bentuk resmi yang dipakai panitia di poster, sertifikat, dan kwitansi.
--
-- Yang TIDAK ikut berubah, karena bukan teks tampilan melainkan pengenal
-- yang harus pendek dan mudah diketik:
--   * username akun    -> meja1hrcd37, pos1hrcd37, admin.ciradyka
--   * nomor kwitansi   -> KW-HRCD37-0013 (dirakit dari edisi_aktif())
--   * nama project     -> hrcd37 (Cloudflare, URL)
--   * kolom edisi.nomor -> tetap 37, karena dipakai berhitung
--
-- Satu baris ini mengubah SEMUA tampilan sekaligus: header layar panitia,
-- judul kwitansi, dan judul lembar cetak kloter — ketiganya membaca
-- edisi.name, tidak ada yang menuliskannya sendiri di kode.
-- ============================================================================

update edisi set name = 'HRCD XXXVII' where nomor = 37;
