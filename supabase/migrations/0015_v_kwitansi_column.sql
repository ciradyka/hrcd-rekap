-- ============================================================================
-- hrcd-rekap : 0015_v_kwitansi_column.sql
--
-- Sisa terakhir dari rename 0012. View menyimpan nama kolom OUTPUT-nya
-- sendiri; me-rename kolom di tabel sumber TIDAK ikut mengubahnya. Jadi
-- v_kwitansi masih mengeluarkan "diverifikasi_pada" padahal tabelnya sudah
-- "verified_at" — inkonsistensi yang menyesatkan siapa pun yang membaca view
-- ini nanti.
--
-- Ditemukan lewat pemindaian pg_get_viewdef/pg_get_functiondef terhadap
-- database live, bukan dari berkas migrasi — dan itu memang satu-satunya cara
-- menemukannya, karena berkas migrasi tidak tahu bentuk akhir objek.
--
-- Tidak ada kode aplikasi yang membaca view ini, jadi ini kerapian, bukan
-- perbaikan kerusakan.
-- ============================================================================

alter view v_kwitansi rename column diverifikasi_pada to verified_at;
