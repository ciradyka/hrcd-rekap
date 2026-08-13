-- PostgREST menyimpan cache skema. Fungsi dengan tanda tangan BARU (mis.
-- submit_pendaftaran + p_nama_kontak dari 0013) tidak terlihat sampai cache
-- itu dimuat ulang — gejalanya "Could not find the function ... in the schema
-- cache" padahal fungsinya jelas ada di database.
notify pgrst, 'reload schema';
