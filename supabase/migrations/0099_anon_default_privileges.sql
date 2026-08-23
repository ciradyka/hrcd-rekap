-- ============================================================================
-- hrcd-rekap : 0099_anon_default_privileges.sql
-- Semua relasi baru tertutup untuk anon kecuali sengaja dibuka.
--
-- Supabase memberi grant lewat default privileges role migrasi. Pencabutan
-- `on all tables` di 0003 hanya mengenai relasi yang sudah ada saat itu, jadi
-- tabel dan view yang dibuat sesudahnya lahir terbuka lagi. Bersihkan seluruh
-- ACL sekarang, buka kembali lima relasi publik yang memang dirancang untuk
-- peserta, lalu ubah default-nya agar migrasi berikutnya mulai dari tertutup.
-- ============================================================================

alter default privileges in schema public revoke all on tables from anon;

revoke all on all tables in schema public from anon;

grant select on sekolah, v_edisi_publik, v_fase_live, v_publik_ringkas,
                v_kelengkapan_publik
to anon;
