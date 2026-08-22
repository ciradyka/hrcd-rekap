-- ============================================================================
-- Cleanup data operasional tidak boleh menghapus master Asal Sekolah.
--
-- Snapshot menyimpan seluruh isi sekolah, bukan hanya jumlahnya. Dengan itu
-- tes juga menangkap perubahan id, nama, alamat, atau timestamp yang tidak
-- sengaja dilakukan oleh script reset.
-- ============================================================================

create temporary table sekolah_sebelum_cleanup as table sekolah;

\ir ../../supabase/checks/cleanup_data_uji.sql

do $$
begin
  assert not exists (
    (select * from sekolah_sebelum_cleanup except select * from sekolah)
    union all
    (select * from sekolah except select * from sekolah_sebelum_cleanup)
  ), 'cleanup mengubah master Asal Sekolah';

  assert (select count(*) from pendaftaran) = 0,
         'cleanup tidak menghapus seluruh pendaftaran';
  assert (select count(*) from regu) = 0,
         'cleanup tidak menghapus seluruh regu';
end;
$$;
