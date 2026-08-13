-- Read-only: berapa banyak data nyata di database ini?
-- Dipakai untuk memutuskan strategi migrasi rename (ALTER hati-hati vs
-- bangun ulang dari nol). TIDAK mengubah apa pun.
select 'sekolah' as tabel, count(*) from sekolah
union all select 'pendaftaran', count(*) from pendaftaran
union all select 'regu', count(*) from regu
union all select 'pembayaran', count(*) from pembayaran
union all select 'akun_panitia', count(*) from akun_panitia
union all select 'nilai_mentah', count(*) from nilai_mentah
union all select 'closing_regu', count(*) from closing_regu
union all select 'keberangkatan_regu', count(*) from keberangkatan_regu
union all select 'nomor_dada_stok', count(*) from nomor_dada_stok
union all select 'riwayat', count(*) from riwayat
union all select 'edisi', count(*) from edisi
order by 1;
