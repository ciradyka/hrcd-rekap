-- Read-only: buktikan pendaftaran dari uji browser benar-benar mendarat utuh,
-- termasuk kolom nama_kontak yang baru dan kolom hasil rename tier-2.
select d.kode_pembayaran, s.name as sekolah, s.address as alamat,
       d.nama_kontak, d.kontak_wa, d.jumlah_regu, d.created_at,
       (select string_agg(r.nama_regu || ' / ' || r.nama_ketua, ', ')
        from regu r where r.pendaftaran_id = d.id) as regu
from pendaftaran d
join sekolah s on s.id = d.sekolah_id
where s.name like 'SMOKE TEST BROWSER%'
order by d.created_at;
