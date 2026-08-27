-- ============================================================================
-- hrcd-rekap : 0123_policy_storage_per_peran.sql
--
-- Unggahan bukti transfer oleh pembina ditolak "permission denied for function
-- pos_saya", dan tidak ada satu pun yang salah pada policy buktinya sendiri.
--
-- ---------------------------------------------------------------------------
-- APA YANG SEBENARNYA TERJADI
--
-- `storage.objects` sekarang punya empat policy: tiga milik bucket `lembar`
-- (0047, ditulis ulang 0064, ditambah 0081) dan dua milik bucket `bukti`
-- (0121). Tidak satu pun di antaranya menyebut peran, jadi SEMUANYA berlaku
-- untuk PUBLIC — termasuk `anon`.
--
-- Policy permissive di-OR-kan, tetapi OR itu tetap harus MENGEVALUASI setiap
-- syaratnya. Syarat milik `lembar` memanggil `peran()` dan `pos_saya()`, dan
-- `anon` tidak berhak menjalankan keduanya. Evaluasinya tidak menghasilkan
-- "false" melainkan GALAT, dan galat itu membatalkan seluruh INSERT sebelum
-- syarat bucket `bukti` — yang sebenarnya lolos — sempat dibaca.
--
-- Jadi yang ditolak bukan pembinanya, melainkan pertanyaannya: anon ditanyai
-- "pos berapa kamu?" pada saat mengunggah bukti pembayaran.
--
-- ---------------------------------------------------------------------------
-- KENAPA JAWABANNYA `TO`, BUKAN MEMBERI HAK EXECUTE KEPADA anon
--
-- Menambahkan `grant execute on function pos_saya, peran to anon` akan
-- menyelesaikan galatnya dan membuka dua fungsi yang membaca identitas panitia
-- kepada seluruh internet — untuk alasan yang tidak ada hubungannya dengan
-- keduanya. Yang benar adalah tidak menanyakannya sejak awal.
--
-- `alter policy ... to <peran>` mempersempit policy ke peran yang memang
-- dituju. Policy yang tidak berlaku untuk sebuah peran TIDAK dievaluasi sama
-- sekali untuk peran itu, jadi `anon` tidak pernah lagi menyentuh `pos_saya()`.
--
--   lembar  -> `authenticated` saja. Tidak pernah ada petugas anonim.
--   bukti   -> tulis: `anon` DAN `authenticated`, karena pembina mengunggah
--              tanpa login sementara panitia yang membantu di meja SUDAH
--              login, dan keduanya mengunggah bukti yang sama.
--              baca:  `authenticated` saja — syaratnya memanggil
--              `boleh_apa_saja()`, dan itu pertanyaan yang sama tidak sahnya
--              untuk anon.
--
-- ---------------------------------------------------------------------------
-- PELAJARAN YANG LEBIH BESAR DARIPADA BUG INI
--
-- Menambahkan policy ke tabel yang SUDAH punya policy bukan tindakan yang
-- berdiri sendiri: peran baru yang diberi jalan masuk akan ikut mengevaluasi
-- seluruh syarat lama. Tes lokal tidak menangkapnya karena `storage` tidak ada
-- di database uji, dan `psql` menerapkan migrasinya sebagai superuser yang
-- boleh menjalankan fungsi apa pun. Yang menangkapnya adalah satu unggahan
-- sungguhan dari HP.
-- ============================================================================

do $blok$
begin
  execute 'alter policy foto_lembar_baca  on storage.objects to authenticated';
  execute 'alter policy foto_lembar_tulis on storage.objects to authenticated';
  raise notice '0123: policy bucket `lembar` dipersempit ke authenticated.';
exception
  when undefined_object then
    raise notice '0123: policy bucket `lembar` tidak ada — dilewati.';
  when insufficient_privilege or undefined_table or invalid_schema_name then
    raise warning '0123: TIDAK BISA mengubah policy storage.objects lewat '
      'migrasi. Di Dashboard > Storage > Policies, setel policy lembar ke '
      'peran `authenticated`.';
end;
$blok$;

-- Terpisah dari blok di atas: 0081 menambahkannya belakangan, dan proyek yang
-- belum menerapkannya tidak boleh membuat kedua policy sebelumnya ikut batal.
do $blok$
begin
  execute 'alter policy foto_lembar_hapus on storage.objects to authenticated';
  raise notice '0123: policy hapus bucket `lembar` dipersempit ke authenticated.';
exception
  when undefined_object then
    raise notice '0123: policy foto_lembar_hapus tidak ada — dilewati.';
  when insufficient_privilege or undefined_table or invalid_schema_name then
    raise warning '0123: policy foto_lembar_hapus tidak bisa dipersempit.';
end;
$blok$;

do $blok$
begin
  execute 'alter policy bukti_transfer_tulis on storage.objects to anon, authenticated';
  execute 'alter policy bukti_transfer_baca  on storage.objects to authenticated';
  raise notice '0123: bukti transfer boleh diunggah anon maupun panitia.';
exception
  when undefined_object then
    raise warning '0123: policy bucket `bukti` tidak ada — terapkan 0121 dulu.';
  when insufficient_privilege or undefined_table or invalid_schema_name then
    raise warning '0123: TIDAK BISA mengubah policy storage.objects lewat '
      'migrasi. Di Dashboard > Storage > Policies, setel bukti_transfer_tulis '
      'ke peran `anon` dan `authenticated`, dan bukti_transfer_baca ke '
      '`authenticated`.';
end;
$blok$;
