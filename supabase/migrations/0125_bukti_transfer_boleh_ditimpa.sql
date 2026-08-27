-- ============================================================================
-- hrcd-rekap : 0125_bukti_transfer_boleh_ditimpa.sql
--
-- Satu pendaftaran menyimpan SATU bukti transfer, dan mengunggah ulang
-- menimpanya.
--
-- ---------------------------------------------------------------------------
-- KENAPA
--
-- 0121 memberi setiap unggahan nama acak, jadi pembina yang salah pilih foto
-- lalu mengunggah yang benar meninggalkan foto pertama di bucket selamanya:
-- tidak tertaut ke pendaftaran mana pun, tidak bisa dilihat siapa pun, dan
-- tidak bisa dihapus karena anon memang tidak punya hak hapus. Satu pembina
-- yang ragu-ragu tiga kali menyisakan dua berkas yatim.
--
-- Sekarang namanya TETAP — `<kunci_kirim>/bukti.jpg` — dan unggahan berikutnya
-- menimpa yang sama. Satu pendaftaran, satu berkas, dan yang tersimpan di
-- `pendaftaran.bukti_transfer` selalu menunjuk isi terbaru.
--
-- ---------------------------------------------------------------------------
-- YANG DIBUKA, DAN YANG TETAP TERTUTUP
--
-- Menimpa berarti UPDATE, dan storage.objects belum punya policy update untuk
-- bucket ini — Supabase menolak `x-upsert: true` dengan "new row violates
-- row-level security policy". Itu diuji langsung ke produksi, bukan ditebak.
--
-- Policy di bawah membuka UPDATE dengan syarat yang PERSIS sama dengan
-- policy tulisnya: nama objek wajib `<uuid>/<sesuatu>.jpg`. Artinya seseorang
-- hanya bisa menimpa berkas di dalam folder yang nama UUID-nya ia ketahui, dan
-- UUID itu lahir di HP pembina serta tidak pernah dikirim ke mana pun selain
-- bersama pendaftarannya sendiri.
--
-- Yang TETAP tertutup untuk anon: membaca dan menghapus. Menimpa bukti sendiri
-- adalah pekerjaan pembina; membaca bukti sekolah lain bukan.
--
-- Harganya, dan ini nyata: siapa pun yang mengetahui satu UUID kiriman — dari
-- tangkapan layar konsol, misalnya — dapat menimpa buktinya. Sebelum ini ia
-- hanya bisa menambah berkas yatim yang tidak dirujuk apa pun. Yang menahan
-- keduanya sama: UUID acak 122 bit yang tidak pernah ditampilkan di layar.
-- ============================================================================

do $blok$
begin
  execute $pol$
    create policy bukti_transfer_ganti on storage.objects for update
    to anon, authenticated
    using (
      bucket_id = 'bukti'
      and name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[a-z0-9-]+[.]jpg$'
    )
    with check (
      bucket_id = 'bukti'
      and name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[a-z0-9-]+[.]jpg$'
    )
  $pol$;
  raise notice '0125: bukti transfer boleh ditimpa oleh pengunggahnya.';
exception
  when duplicate_object then
    raise notice '0125: policy bukti_transfer_ganti sudah ada — dilewati.';
  when insufficient_privilege or undefined_table or invalid_schema_name then
    raise warning '0125: TIDAK BISA memasang policy storage.objects lewat '
      'migrasi. Di Dashboard > Storage > bukti > Policies, tambahkan policy '
      'UPDATE untuk peran anon dan authenticated dengan syarat yang sama '
      'seperti policy tulisnya.';
end;
$blok$;
