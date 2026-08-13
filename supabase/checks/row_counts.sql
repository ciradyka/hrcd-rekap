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
union all select 'history', count(*) from history
union all select 'edisi', count(*) from edisi
union all select 'pendaftaran BER-nama_kontak', count(nama_kontak) from pendaftaran
union all select 'sekolah BER-name', count(name) from sekolah
union all select 'regu AKTIF (is_cancelled=false)', count(*) from regu where not is_cancelled
union all select 'room', count(*) from room
union all select 'edisi is_active', count(*) from edisi where is_active
union all select 'SMOKE: pendaftaran BER-nama_kontak', count(nama_kontak) from pendaftaran
order by 1;
