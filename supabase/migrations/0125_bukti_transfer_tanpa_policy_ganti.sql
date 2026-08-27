-- ============================================================================
-- hrcd-rekap : 0125_bukti_transfer_tanpa_policy_ganti.sql
--
-- Membuang policy UPDATE pada bucket `bukti` yang sempat dipasang lalu
-- ternyata TIDAK menyelesaikan apa pun.
--
-- ---------------------------------------------------------------------------
-- APA YANG DICOBA, DAN KENAPA GAGAL
--
-- Rencananya: bukti transfer memakai nama tetap `<kunci_kirim>/bukti.jpg` dan
-- unggahan berikutnya menimpanya, supaya satu pendaftaran menyimpan satu
-- berkas. Menimpa berarti UPDATE, jadi policy update ditambahkan dengan
-- syarat yang persis sama dengan policy tulisnya.
--
-- Diuji langsung ke produksi, dan hasilnya:
--
--   INSERT `<uuid>/bukti.jpg`                 -> 200
--   POST ulang dengan `x-upsert: true`        -> 403 RLS
--   PUT ke objek yang sama                    -> 403 RLS
--
-- Policy update-nya ada dan syaratnya terpenuhi, tetapi Supabase Storage tetap
-- menolak. Jalur upsert-nya juga membaca objek yang ada, dan `anon` sengaja
-- TIDAK punya policy select di bucket ini. Membuka select untuk anon akan
-- menyelesaikan galatnya sekaligus membuat siapa pun yang mengetahui satu
-- UUID kiriman bisa MEMBACA bukti pembayaran sekolah itu — dan bukti
-- pembayaran orang lain bukan urusan siapa pun kecuali panitia.
--
-- ---------------------------------------------------------------------------
-- YANG DIPILIH SEBAGAI GANTINYA
--
-- Tetap satu unggahan satu objek bernama acak, INSERT saja. Yang tersimpan di
-- `pendaftaran.bukti_transfer` selalu yang terakhir, jadi satu pendaftaran
-- tetap punya tepat satu bukti yang berarti.
--
-- Harganya disebut supaya tidak jadi kejutan: pembina yang salah pilih foto
-- lalu mengunggah yang benar meninggalkan satu berkas yatim di bucket — tidak
-- dirujuk pendaftaran mana pun, tidak bisa dibaca siapa pun tanpa hak
-- `pembayaran`, dan berukuran puluhan kilobyte. Untuk satu acara berisi
-- ratusan pendaftaran itu jauh lebih murah daripada membuka hak baca.
--
-- Policy update-nya dibuang karena hak yang tidak dipakai tetap hak: ia
-- membuat siapa pun yang mengetahui satu UUID bisa MENIMPA bukti sekolah itu,
-- dan tidak ada satu baris kode pun yang membutuhkannya.
-- ============================================================================

do $blok$
begin
  execute 'drop policy if exists bukti_transfer_ganti on storage.objects';
  raise notice '0125: policy update bucket `bukti` dipastikan tidak ada.';
exception
  when insufficient_privilege or undefined_table or invalid_schema_name then
    raise warning '0125: TIDAK BISA membuang policy storage.objects lewat '
      'migrasi. Di Dashboard > Storage > bukti > Policies, hapus policy '
      'UPDATE bernama bukti_transfer_ganti kalau ada.';
end;
$blok$;
