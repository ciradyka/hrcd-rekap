-- ============================================================================
-- hrcd-rekap : 0093_configure_fifo_capacity.sql
-- Data konfigurasi FIFO edisi aktif dipisah dari DDL 0092.
--
-- Pemisahan ini membuat dev_database.sh dapat menjalankannya ulang setelah
-- seed: seluruh migration mula-mula berjalan saat tabel edisi masih kosong.
-- ============================================================================

update edisi
set kloter_dasar = greatest(kloter_dasar, 60),
    kloter_maks = greatest(kloter_maks, 60),
    lompatan_kloter = 1,
    maks_eksternal_per_kloter = 5,
    maks_intern_per_kloter = 3,
    perkiraan_regu_eksternal = 300,
    perkiraan_regu_intern = 50
where is_active;

insert into kloter (nomor)
select generate_series(1, (select kloter_maks from edisi where is_active))::smallint
on conflict (nomor) do nothing;
