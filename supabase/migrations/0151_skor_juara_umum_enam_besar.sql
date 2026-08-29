-- Pemecah poin Juara Umum hanya memakai skor regu yang menghasilkan poin,
-- yaitu peringkat 1 sampai 6. Skor regu di bawahnya tidak ikut dihitung.

do $$
declare
  v_def text := pg_get_functiondef('hasil_kejuaraan()'::regprocedure);
  v_lama text := 'sum(total) as jumlah_skor';
  v_baru text := 'sum(total) filter (where nomor_juara <= 6) as jumlah_skor';
begin
  assert position(v_lama in v_def) > 0,
    '0151: perhitungan jumlah skor lama tidak ditemukan';

  execute replace(v_def, v_lama, v_baru);
end;
$$;

comment on column v_kejuaraan.jumlah_skor is
  'Jumlah skor regu sekolah yang berada di peringkat 1-6 dalam cakupan Juara Umum; pemecah poin sama.';

do $$
begin
  assert pg_get_functiondef('hasil_kejuaraan()'::regprocedure) like
    '%sum(total) filter (where nomor_juara <= 6) as jumlah_skor%',
    '0151: jumlah skor belum dibatasi ke enam besar';
end;
$$;
