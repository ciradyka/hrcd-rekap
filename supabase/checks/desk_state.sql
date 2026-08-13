-- Bahan uji: apa yang tersedia di layar panitia saat ini?
select 'menunggu bayar' as keadaan, count(*) from pendaftaran where status = 'menunggu_pembayaran'
union all select 'lunas, ada regu belum bernomor',
  count(distinct d.id) from pendaftaran d join regu r on r.pendaftaran_id = d.id
  where d.status = 'lunas' and r.nomor_dada is null and not r.is_cancelled
union all select 'stok nomor dada tersedia',
  count(*) from nomor_dada_stok s
  where not exists (select 1 from regu r where r.nomor_dada = s.nomor)
    and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor);
