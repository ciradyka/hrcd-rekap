-- ============================================================================
-- Cleanup data operasional tidak boleh menghapus master Asal Sekolah.
--
-- Snapshot menyimpan seluruh isi sekolah, bukan hanya jumlahnya. Dengan itu
-- tes juga menangkap perubahan id, nama, alamat, atau timestamp yang tidak
-- sengaja dilakukan oleh script reset.
-- ============================================================================

create temporary table sekolah_sebelum_cleanup as table sekolah;

-- Bentuk sendiri seluruh state yang wajib dipulihkan. Test tidak boleh
-- bergantung pada kebetulan test sebelumnya meninggalkan state ini.
update kloter set
  jam_berangkat = timestamptz '2026-08-29 07:00+07',
  dicetak_pada = timestamptz '2026-08-28 20:00+07'
where nomor = (select min(nomor) from kloter);
update status_acara set
  daftar_ulang_ditutup = true,
  fase_live = 'penuh',
  konfigurasi_terkunci = true
where id = true;

do $$
begin
  assert exists (select 1 from kloter where jam_berangkat is not null),
         'fixture cleanup tidak punya jam berangkat';
  assert exists (select 1 from kloter where dicetak_pada is not null),
         'fixture cleanup tidak punya tanda cetak';
  assert (select daftar_ulang_ditutup and fase_live = 'penuh'
                 and konfigurasi_terkunci
          from status_acara where id = true),
         'fixture cleanup tidak memasang saklar hari-H';
end;
$$;

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
  assert not exists (select 1 from kloter where jam_berangkat is not null),
         'cleanup meninggalkan jam berangkat di kloter';
  assert not exists (select 1 from kloter where dicetak_pada is not null),
         'cleanup meninggalkan tanda cetak di kloter';
  assert (select not daftar_ulang_ditutup and fase_live = 'pra'
                 and not konfigurasi_terkunci
          from status_acara where id = true),
         'cleanup tidak mengembalikan saklar hari-H';
end;
$$;
